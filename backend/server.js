require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database'); // Ahora es el cliente de Supabase
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const app = express();
app.use(express.json());
app.use(cors());
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const { data: user, error } = await db
    .from('users')
    .select('*, positions(name)')
    .eq('username', username)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found or database error' });
  
  const position_name = user.positions ? user.positions.name : '';
  const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
  if (!passwordIsValid) return res.status(401).json({ error: 'Invalid password' });

  const token = jwt.sign({ 
    id: user.id, 
    username: user.username, 
    role: user.role, 
    position_name: position_name 
  }, JWT_SECRET, { expiresIn: '8h' });

  // Registro de acceso (log)
  const { data: pos } = await db.from('positions').select('dashboard_url').eq('id', user.position_id).single();
  const url = pos ? pos.dashboard_url : '';
  await db.from('access_logs').insert({ user_id: user.id, dashboard_url: url });

  res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, position_name: position_name } });
});

app.get('/api/me', authenticateToken, async (req, res) => {
  const { data: user, error } = await db
    .from('users')
    .select('id, username, name, role, positions(name)')
    .eq('id', req.user.id)
    .single();

  if (error || !user) return res.status(404).json({ error: 'User not found' });
  
  res.json({
    ...user,
    position_name: user.positions ? user.positions.name : null
  });
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  const { data, error } = await db
    .from('users')
    .select('positions(dashboard_url)')
    .eq('id', req.user.id)
    .single();

  if (error || !data) return res.status(500).json({ error: 'Error getting dashboard url' });
  res.json({ dashboard_url: data.positions ? data.positions.dashboard_url : '' });
});

app.get('/api/logs', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.position_name !== 'Directorio') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  const { data, error } = await db
    .from('access_logs')
    .select(`
      id,
      login_time,
      dashboard_url,
      users (
        username,
        name,
        positions (name)
      )
    `)
    .order('login_time', { ascending: false })
    .limit(100);

  if (error) return res.status(500).json({ error: 'Database error' });
  
  // Adaptamos el formato de retorno para que sea igual al anterior
  const formatted = data.map(log => ({
    id: log.id,
    username: log.users.username,
    name: log.users.name,
    login_time: log.login_time,
    dashboard_url: log.dashboard_url,
    position_name: log.users.positions ? log.users.positions.name : ''
  }));
  
  res.json(formatted);
});

app.get('/api/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.position_name !== 'Directorio') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { from, to, positionId } = req.query; // Formato esperado: YYYY-MM-DD
  
  const { data, error } = await db.rpc('get_enhanced_stats', { 
    start_date: from || null, 
    end_date: to || null,
    target_position_id: positionId || null
  });
  
  if (error) {
    console.error("Stats Error:", error);
    return res.status(500).json({ error: 'Error fetching dashboard stats' });
  }
  
  res.json(data);
});

// POSITIONS CRUD
app.get('/api/positions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { data, error } = await db.from('positions').select('*').order('name');
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json(data);
});

app.post('/api/positions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, dashboard_url, dashboard_name } = req.body;
  if (!name || !dashboard_url) return res.status(400).json({ error: 'Missing Required fields' });
  
  const { data, error } = await db.from('positions').insert({ 
    name, 
    dashboard_url, 
    dashboard_name: dashboard_name || name 
  }).select().single();
  if (error) return res.status(500).json({ error: 'Database error or duplicate name' });
  res.json(data);
});

app.put('/api/positions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, dashboard_url, dashboard_name } = req.body;
  const { error } = await db.from('positions').update({ 
    name, 
    dashboard_url, 
    dashboard_name 
  }).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'Database error' });
  res.json({ success: true });
});

app.delete('/api/positions/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  
  // Check users count
  const { count, error: countErr } = await db
    .from('users')
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
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { data, error } = await db
    .from('users')
    .select('*, positions(name)')
    .order('id', { ascending: false });

  if (error) return res.status(500).json({ error: 'Database error' });
  
  const formatted = data.map(u => ({
    ...u,
    position_name: u.positions ? u.positions.name : ''
  }));
  res.json(formatted);
});

app.post('/api/users', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { username, password, name, email, role, position_id } = req.body;
  if (!username || !password || !name || !role) return res.status(400).json({ error: 'Missing required fields' });

  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  const { data, error } = await db.from('users').insert({
    username,
    password_hash: hash,
    password_plain: password,
    name,
    email: email || null,
    role,
    position_id: position_id || null
  }).select().single();

  if (error) {
    if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
    return res.status(500).json({ error: 'Database error' });
  }
  res.json(data);
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { id } = req.params;
  const { username, name, email, role, position_id, password } = req.body;

  let updates = { username, name, email: email || null, role, position_id: position_id || null };

  if (password) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    updates.password_hash = hash;
    updates.password_plain = password;
  }

  const { error } = await db.from('users').update(updates).eq('id', id);
  if (error) return res.status(500).json({ error: 'Database error' });
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
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Tus credenciales - Portal Neumaticos Pons',
      html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #d32f2f;">Acceso al Portal de Tableros</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Se te ha asignado acceso al portal interno. Aquí están tus datos:</p>
          <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Usuario:</strong> ${user.username}</p>
            <p><strong>Contraseña:</strong> ${user.password_plain}</p>
          </div>
          <p>Puedes acceder al portal desde tu navegador habitual.</p>
          <hr />
          <p style="font-size: 12px; color: #777;">Este es un mensaje automático del sistema de Neumáticos Pons.</p>
        </div>
      `
    });
    res.json({ success: true, message: `Credenciales enviadas a ${user.email}` });
  } catch (mailErr) {
    console.error("Email error:", mailErr);
    res.status(500).json({ error: 'Error al enviar el correo real', details: mailErr.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app; // Necesario para Vercel
