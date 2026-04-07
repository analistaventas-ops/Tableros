require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database'); // Ahora es el cliente de Supabase
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: (process.env.SMTP_PORT == 465), // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false // Often needed for some SMTP servers
  }
});

// Verify connection on startup (optional but helpful for logs)
transporter.verify((error, success) => {
  if (error) {
    console.warn("[SMTP] Ready error:", error.message);
  } else {
    console.log("[SMTP] Servidor listo para enviar correos");
  }
});

const app = express();

// Seguridad básica sin bloquear iframes de Power BI o políticas de origen cruzado
app.use(helmet({
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false
})); 
app.use(express.json());

// Restringir CORS (sólo permitimos orígenes aprobados)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://tableros-delta.vercel.app'
];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por la política CORS del servidor'));
    }
  }
}));

// Límite global contra Spam / Denegación de servicio (DDoS)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3000, 
  message: { error: 'Demasiadas solicitudes. Servidor bloqueado temporalmente por seguridad.' }
});

// Límite estricto para Login (Fuerza Bruta)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15, // máximo 15 intentos en 15 minutos por IP
  message: { error: 'Múltiples intentos detectados. Cuenta bloqueada temporalmente por 15 minutos.' }
});

app.use('/api/', globalLimiter);

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Helper for Argentine Date (UTC-3)
function getTodayAr() {
  return new Intl.DateTimeFormat('fr-CA', {timeZone: 'America/Argentina/Buenos_Aires'}).format(new Date());
}

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

app.post('/api/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  const { data: user, error } = await db
    .from('users')
    .select('*, user_positions(positions(name, can_view_metrics))')
    .eq('username', username)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found or database error' });
  
  const positions = user.user_positions ? user.user_positions.map(up => up.positions).filter(Boolean) : [];
  const position_name = positions.map(p => p.name).join(', ');
  
  const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
  if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });

  const can_view_metrics = positions.some(p => p.can_view_metrics === true);

  const token = jwt.sign({ 
    id: user.id, 
    username: user.username, 
    role: user.role, 
    position_name: position_name,
    can_view_metrics: can_view_metrics
  }, JWT_SECRET, { expiresIn: '8h' });

  // Registro de acceso (log inicial de login en activity_sessions)
  const today = getTodayAr();
  await db.from('activity_sessions').upsert({ 
    user_id: user.id, 
    dashboard_url: 'LOGIN_PORTAL', 
    session_date: today,
    duration_minutes: 1, // Start with 1 min to show in charts immediately
    last_ping: new Date().toISOString()
  }, { onConflict: 'user_id, dashboard_url, session_date' });

  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, position_name: position_name, can_view_metrics } });
});

app.get('/api/me', authenticateToken, async (req, res) => {
  const { data: user, error } = await db
    .from('users')
    .select('id, username, name, role, user_positions(positions(*))')
    .eq('id', req.user.id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });
  
  const positions = user.user_positions ? user.user_positions.map(up => up.positions).filter(Boolean) : [];
  
  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    positions,
    position_name: positions.length > 0 ? positions.map(p => p.name).join(', ') : null,
    can_view_metrics: positions.some(p => p.can_view_metrics === true)
  });
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  // Get all positions for this user
  const { data: userPos, error: posErr } = await db
    .from('user_positions')
    .select('position_id')
    .eq('user_id', req.user.id);

  if (posErr) return res.status(500).json({ error: 'Error getting user positions' });
  const positionIds = userPos.map(up => up.position_id);

  if (positionIds.length === 0) return res.json({ dashboards: [] });

  // Get all linked dashboards for these positions
  const { data: links, error: linkErr } = await db
    .from('dashboard_links')
    .select('url, dashboard_types(name)')
    .in('position_id', positionIds);

  if (linkErr) return res.status(500).json({ error: 'Error getting dashboards' });
  
  const dashboards = links.map(link => ({
    dashboard_url: link.url,
    dashboard_name: link.dashboard_types ? link.dashboard_types.name : 'Sin Nombre'
  }));

  res.json({ dashboards });
});

app.get('/api/logs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.can_view_metrics) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { start_date, end_date, user_id, position_id, dashboard_name } = req.query;
  
  // Query activity_sessions for the detailed audit table
  let queryBuilder = db
    .from('activity_sessions')
    .select(`
      id,
      start_time,
      last_ping,
      duration_minutes,
      dashboard_url,
      session_date,
      users (
        name,
        role,
        user_positions (
          positions (name, id)
        )
      )
    `);

  // Application of filters
  if (start_date) queryBuilder = queryBuilder.gte('session_date', start_date);
  if (end_date) queryBuilder = queryBuilder.lte('session_date', end_date);
  if (user_id) queryBuilder = queryBuilder.eq('user_id', user_id);
  
  // Dashboard filtering is tricky because session has URL, not name.
  // We'll filter it in memory after fetching to keep it simple, OR fetch URLs first.
  // For now, let's just fetch and filter below.

  const { data, error } = await queryBuilder
    .order('last_ping', { ascending: false })
    .limit(500); 

  if (error) {
    console.error("Logs Error:", error);
    return res.status(200).json([]); // Resilient return
  }
  
  // We need to match dashboard_url with a name. 
  // We'll fetch dashboard_links to map URLs to names.
  const { data: links } = await db.from('dashboard_links').select('url, dashboard_types(name)');
  const urlToName = {};
  if (links) {
    links.forEach(lk => {
      urlToName[lk.url] = lk.dashboard_types?.name || 'Desconocido';
    });
  }

  const formatted = data
    .filter(session => {
      // Filter out sessions without associated users (db lookup safety)
      if (!session.users) return false;

      // Filter out LOGIN_PORTAL as requested (not a dashboard access)
      if (session.dashboard_url === 'LOGIN_PORTAL') return false;

      // Always exclude admin users from the metrics and logs
      if (session.users.role === 'admin') return false;
      
      // Filter by dashboard name if requested
      if (dashboard_name && dashboard_name !== '') {
        const name = urlToName[session.dashboard_url] || 'General';
        if (name !== dashboard_name) return false;
      }

      // Filter by position if requested
      if (position_id) {
        const pIds = session.users?.user_positions?.map(up => up.positions?.id) || [];
        if (!pIds.includes(parseInt(position_id))) return false;
      }

      return true;
    })
    .map(session => {
      const userPositions = session.users.user_positions ? session.users.user_positions.map(up => up.positions?.name).filter(Boolean) : [];
      return {
        id: session.id,
        name: session.users.name || 'Usuario Desconocido',
        start_time: session.start_time,
        last_ping: session.last_ping,
        duration_minutes: session.duration_minutes || 0,
        dashboard_url: session.dashboard_url,
        dashboard_name: urlToName[session.dashboard_url] || 'General',
        position_name: userPositions.join(', ')
      };
    });
  
  res.json(formatted);
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.can_view_metrics) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const { 
      from, to, positionId, dashboardName, userId,
      start_date, end_date, position_id, dashboard_name, user_id 
    } = req.query;
    
    const { data: statsData, error: statsError } = await db.rpc('get_enhanced_stats', { 
      start_date: start_date || from || null, 
      end_date: end_date || to || null,
      target_position_id: (position_id || positionId) ? parseInt(position_id || positionId) : null,
      target_dashboard_name: dashboard_name || dashboardName || null,
      target_user_id: (user_id || userId) ? parseInt(user_id || userId) : null,
      exclude_admins: true
    });
    
    if (statsError) {
      console.error("Stats RPC Error:", statsError);
      return res.status(200).json(null); 
    }
    
    res.json(statsData);
  } catch (err) {
    console.error("Stats processing error:", err);
    res.status(200).json(null);
  }
});

// NEW HEARTBEAT: Upsert into activity_sessions to keep DB clean
app.post('/api/logs/heartbeat', authenticateToken, async (req, res) => {
  const { dashboard_url } = req.body;
  if (!dashboard_url) return res.status(400).json({ error: 'Missing URL' });
  
  const today = getTodayAr();
  
  // UPSERT logic: if session exists for today/user/dashboard, increment duration. Otherwise create.
  // Note: we assume +1 minute (actually 30s but we count by pings)
  const { data: existing } = await db
    .from('activity_sessions')
    .select('id, duration_minutes')
    .eq('user_id', req.user.id)
    .eq('dashboard_url', dashboard_url)
    .eq('session_date', today)
    .single();

  if (existing) {
    await db.from('activity_sessions')
      .update({ 
        last_ping: new Date().toISOString(),
        duration_minutes: existing.duration_minutes + 1 // Approximating 1 unit per ping
      })
      .eq('id', existing.id);
  } else {
    await db.from('activity_sessions').insert({
      user_id: req.user.id,
      dashboard_url: dashboard_url,
      session_date: today,
      duration_minutes: 1
    });
  }
  
  res.json({ success: true });
});

// DASHBOARD TYPES CRUD
app.get('/api/dashboard-types', authenticateToken, async (req, res) => {
  const { data, error } = await db.from('dashboard_types').select('*').order('name');
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

app.post('/api/dashboard-types', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, description } = req.body;
  const { data, error } = await db.from('dashboard_types').insert({ name, description }).select().single();
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

app.put('/api/dashboard-types/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, description } = req.body;
  const { error } = await db.from('dashboard_types').update({ name, description }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

app.delete('/api/dashboard-types/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { error } = await db.from('dashboard_types').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

// DASHBOARD LINKS (The Matrix) CRUD
app.get('/api/dashboard-links', authenticateToken, async (req, res) => {
  const { data, error } = await db
    .from('dashboard_links')
    .select('*, positions(name), dashboard_types(name)');
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

app.post('/api/dashboard-links', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { position_id, dashboard_type_id, url } = req.body;
  const { data, error } = await db.from('dashboard_links').insert({ position_id, dashboard_type_id, url }).select().single();
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

app.put('/api/dashboard-links/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { position_id, dashboard_type_id, url } = req.body;
  const { error } = await db.from('dashboard_links').update({ position_id, dashboard_type_id, url }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

app.delete('/api/dashboard-links/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { error } = await db.from('dashboard_links').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

// POSITIONS CRUD
app.get('/api/positions', authenticateToken, async (req, res) => {
  const { data, error } = await db.from('positions').select('*').order('name');
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

app.post('/api/positions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, can_view_metrics } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  
  const { data, error } = await db.from('positions').insert({ name, can_view_metrics: can_view_metrics ? true : false }).select().single();
  if (error) return res.status(500).json({ error: 'Database error or duplicate name' });
  res.json(data);
});

app.put('/api/positions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, can_view_metrics } = req.body;
  const { error } = await db.from('positions').update({ name, can_view_metrics: can_view_metrics ? true : false }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

app.delete('/api/positions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  
  // Check users count (via user_positions)
  const { count, error: countErr } = await db
    .from('user_positions')
    .select('*', { count: 'exact', head: true })
    .eq('position_id', req.params.id);

  if (countErr) return res.status(500).json({ error: 'Database error' });
  if (count > 0) return res.status(400).json({ error: 'Cannot delete position, it is currently assigned to users.' });
  
  const { error } = await db.from('positions').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

// USERS CRUD
app.get('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && !req.user.can_view_metrics) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { data, error } = await db
    .from('users')
    .select('*, user_positions(positions(id, name))')
    .order('id', { ascending: false });

  if (error) return res.status(500).json({ error: 'Database error' });
  
  const formatted = data.map(u => {
    const userPositions = u.user_positions ? u.user_positions.map(up => up.positions).filter(Boolean) : [];
    return {
      ...u,
      positions: userPositions,
      position_ids: userPositions.map(p => p.id),
      position_name: userPositions.map(p => p.name).join(', ')
    };
  });
  res.json(formatted);
});

app.post('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { username, password, name, email, role, position_ids } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Missing required fields' });

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const { data: newUser, error: userError } = await db.from('users').insert({
    username,
    password_hash: hash,
    password_plain: password,
    name,
    email: email || null,
    role
  }).select().single();

  if (userError) {
    if (userError.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    return res.status(500).json({ error: 'Database error' });
  }

  // Insert multiple positions
  if (position_ids && position_ids.length > 0) {
    const rels = position_ids.map(pid => ({ user_id: newUser.id, position_id: pid }));
    await db.from('user_positions').insert(rels);
  }

  res.json(newUser);
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { username, name, email, role, position_ids, password } = req.body;

  let updates = { username, name, email: email || null, role };

  if (password) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    updates.password_hash = hash;
    updates.password_plain = password;
  }

  const { error: userError } = await db.from('users').update(updates).eq('id', id);
  if (userError) return res.status(500).json({ error: 'Database error' });

  // Update positions: Delete then Insert
  await db.from('user_positions').delete().eq('user_id', id);
  if (position_ids && position_ids.length > 0) {
    const rels = position_ids.map(pid => ({ user_id: id, position_id: pid }));
    await db.from('user_positions').insert(rels);
  }

  res.json({ success: true });
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  if (id == req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  const { error } = await db.from('users').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

app.post('/api/users/send-credentials/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  
  const { data: user, error } = await db
    .from('users')
    .select('username, name, email, password_plain')
    .eq('id', id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });
  if (!user.email) return res.status(400).json({ error: 'User has no email defined' });
  
  if (!process.env.SMTP_PASS || process.env.SMTP_PASS === 'tu_password_de_aplicacion') {
    console.log(`[SIMULATED EMAIL] To: ${user.email} - Usuario: ${user.username} | Pass: ${user.password_plain}`);
    return res.json({ success: true, message: `Simulacion: Email a ${user.email} con pass.` });
  }

  try {
    const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
    if (!fromEmail || !process.env.SMTP_PASS) {
      return res.status(500).json({ 
        error: 'SMTP no configurado', 
        details: 'Faltan variables de entorno SMTP_USER o SMTP_PASS en Vercel.' 
      });
    }

    await transporter.sendMail({
      from: fromEmail,
      to: user.email,
      subject: 'Tus credenciales - Portal Neumáticos Pons',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
          <h2 style="color: #1e293b; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Acceso al Portal de Tableros</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Se te ha asignado acceso al portal interno de Neumáticos Pons. Aquí están tus datos de acceso:</p>
          <div style="background: #f8fafc; padding: 20px; border-radius: 15px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <p style="margin: 5px 0;"><strong>💻 Usuario:</strong> ${user.username}</p>
            <p style="margin: 5px 0;"><strong>🔑 Contraseña:</strong> ${user.password_plain}</p>
          </div>
          <p>Puedes acceder a la plataforma haciendo clic en el siguiente botón:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://tableros-delta.vercel.app" style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; font-weight: bold; display: inline-block;">Acceder al Portal</a>
          </div>
          <p style="font-size: 13px; color: #64748b;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br/>https://tableros-delta.vercel.app</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">Este es un mensaje automático del sistema de Neumáticos Pons.</p>
        </div>
      `
    });
    res.json({ success: true, message: `Credenciales enviadas a ${user.email}` });
  } catch (mailErr) {
    console.error("Email error details:", mailErr);
    res.status(500).json({ 
      error: 'Error de servidor SMTP', 
      details: mailErr.message,
      technical: mailErr.code || 'UNKNOWN'
    });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; // Necesario para Vercel
