import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
  Calendar, Users, Briefcase, Activity, 
  TrendingUp, BarChart2, PieChart as PieIcon, Filter,
  Mail, Edit, Trash2, Eye, EyeOff, Plus
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

export default function AdminPanel({ token, user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ by_position: [], over_time: [], top_users: [] });
  const [activeTab, setActiveTab] = useState(currentUser.role === 'admin' ? 'users' : 'logs');
  const [statsRange, setStatsRange] = useState('7d');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState('');
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', name: '', email: '', role: 'user', position_id: '' });
  const [showPassword, setShowPassword] = useState({});
 
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [posFormData, setPosFormData] = useState({ name: '', dashboard_url: '', dashboard_name: '' });

  const fetchData = async () => {
    try {
      let fromDate = null;
      const now = new Date();
      if (statsRange === '7d') fromDate = format(subDays(now, 7), 'yyyy-MM-dd');
      else if (statsRange === '30d') fromDate = format(subDays(now, 30), 'yyyy-MM-dd');
      else if (statsRange === 'month') fromDate = format(startOfMonth(now), 'yyyy-MM-dd');

      const queryParams = new URLSearchParams();
      if (fromDate) queryParams.append('from', fromDate);
      if (selectedPositionId) queryParams.append('positionId', selectedPositionId);
      if (selectedDashboard) queryParams.append('dashboardName', selectedDashboard);
      
      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
      
      if (currentUser.role === 'admin') {
        const [uRes, pRes, lRes, sRes] = await Promise.all([
          api.get('/users'),
          api.get('/positions'),
          api.get('/logs'),
          api.get(`/stats${query}`)
        ]);
        setUsers(uRes.data);
        setPositions(pRes.data);
        setLogs(lRes.data);
        setStats(sRes.data || { by_position: [], over_time: [], top_users: [] });
      } else {
        const [lRes, sRes] = await Promise.all([
          api.get('/logs'),
          api.get(`/stats${query}`)
        ]);
        setLogs(lRes.data);
        setStats(sRes.data || { by_position: [], over_time: [], top_users: [] });
      }
    } catch (err) { 
      console.error("Fetch error:", err); 
    }
  };

  useEffect(() => { fetchData() }, [token, statsRange, selectedPositionId, selectedDashboard]);

  const handleUserModal = (u = null) => {
    setEditingUser(u);
    setUserFormData(u ? { username: u.username, password: '', name: u.name, email: u.email || '', role: u.role, position_id: u.position_id || '' } : { username: '', password: '', name: '', email: '', role: 'user', position_id: '' });
    setShowUserModal(true);
  };

  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      const data = { ...userFormData, position_id: userFormData.position_id || null };
      if (editingUser) await api.put(`/users/${editingUser.id}`, data);
      else await api.post('/users', data);
      setShowUserModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handleSendCredentials = async (id) => {
    try {
      const res = await api.post(`/users/send-credentials/${id}`, {});
      alert(res.data.message);
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handleUserDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este usuario?")) return;
    try { await api.delete(`/users/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handlePosModal = (p = null) => {
    setEditingPos(p);
    setPosFormData(p ? { name: p.name, dashboard_url: p.dashboard_url, dashboard_name: p.dashboard_name || p.name } : { name: '', dashboard_url: '', dashboard_name: '' });
    setShowPosModal(true);
  };

  const handlePosSave = async (e) => {
    e.preventDefault();
    try {
      if (editingPos) await api.put(`/positions/${editingPos.id}`, posFormData);
      else await api.post('/positions', posFormData);
      setShowPosModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handlePosDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este puesto? No debe tener usuarios asignados.")) return;
    try { await api.delete(`/positions/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      {/* Header Con Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Panel de Control</h2>
          <p className="text-slate-500 text-sm font-medium">Gestión administrativa y métricas de usabilidad.</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border p-1.5 gap-1">
          {currentUser.role === 'admin' && (
            <>
              <button 
                onClick={() => setActiveTab('users')} 
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Users size={16} /> Usuarios
              </button>
              <button 
                onClick={() => setActiveTab('positions')} 
                className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'positions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <Briefcase size={16} /> Puestos
              </button>
            </>
          )}
          <button 
            onClick={() => setActiveTab('logs')} 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg transition ${activeTab === 'logs' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            <Activity size={16} /> Seguimiento
          </button>
        </div>
      </div>

      {activeTab === 'users' && currentUser.role === 'admin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Directorio de Colaboradores</h3>
            <button onClick={() => handleUserModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
              <Plus size={16} /> Nuevo Usuario
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                   <th className="p-4 pl-6">Identidad / Cuenta</th>
                   <th className="p-4">Nombre</th>
                   <th className="p-4">Puesto</th>
                   <th className="p-4">Acceso</th>
                   <th className="p-4 pr-6 text-right">Mantenimiento</th>
                 </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-slate-800">{u.username}</div>
                      <div className="text-slate-400 text-xs font-medium">{u.email || '—'}</div>
                    </td>
                    <td className="p-4 text-slate-600 font-medium">{u.name}</td>
                    <td className="p-4">
                      {u.position_name ? (
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-100">{u.position_name}</span>
                      ) : (
                        <span className="text-slate-300 italic text-xs">Sin asignar</span>
                      )}
                    </td>
                    <td className="p-4 min-w-[140px]">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 ${showPassword[u.id] ? 'text-slate-800' : 'text-transparent select-none'}`}>
                          {showPassword[u.id] ? u.password_plain : '••••••••'}
                        </span>
                        <button 
                          onClick={() => setShowPassword(prev => ({...prev, [u.id]: !prev[u.id]}))}
                          className="text-slate-400 hover:text-blue-500 transition"
                        >
                          {showPassword[u.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleSendCredentials(u.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Enviar credenciales"><Mail size={16} /></button>
                        <button onClick={() => handleUserModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar"><Edit size={16} /></button>
                        <button onClick={() => handleUserDel(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Borrar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'positions' && currentUser.role === 'admin' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
           <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Puestos y Dashboards</h3>
            <button onClick={() => handlePosModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all transform hover:scale-105 active:scale-95">Nuevo Puesto</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                 <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                   <th className="p-4 pl-6">Tablero</th>
                   <th className="p-4">Puesto/Categoría</th>
                   <th className="p-4">Preview URL</th>
                   <th className="p-4 pr-6 text-right">Mantenimiento</th>
                 </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {positions.map(p => (
                  <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-indigo-700">{p.dashboard_name || 'Tablero Sin Nombre'}</div>
                    </td>
                    <td className="p-4">
                      <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold border border-indigo-100">{p.name}</span>
                    </td>
                    <td className="p-4 text-[10px] font-mono text-slate-400 break-all max-w-xs">{p.dashboard_url.substring(0, 100)}...</td>
                    <td className="p-4 pr-6 text-right">
                       <div className="flex justify-end gap-1">
                        <button onClick={() => handlePosModal(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar"><Edit size={16} /></button>
                        <button onClick={() => handlePosDel(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-6">
          {/* Filtros de Estadísticas */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Filter size={18} />
                </div>
                <span className="text-sm font-bold text-slate-700">Filtro Temporal:</span>
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                  {['7d', '30d', 'month', 'all'].map(r => (
                    <button 
                      key={r}
                      onClick={() => setStatsRange(r)}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${statsRange === r ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-900'}`}
                    >
                      {r === '7d' ? '7 Días' : r === '30d' ? '30 Días' : r === 'month' ? 'Este Mes' : 'Todo'}
                    </button>
                  ))}
                </div>
              </div>

              {currentUser.role === 'admin' && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-700">Filtrar por Puesto:</span>
                    <select 
                      value={selectedPositionId} 
                      onChange={e => setSelectedPositionId(e.target.value)}
                      className="p-2 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition"
                    >
                      <option value="">— Ver Todos —</option>
                      {positions.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-slate-700">Por Tablero:</span>
                    <select 
                      value={selectedDashboard} 
                      onChange={e => setSelectedDashboard(e.target.value)}
                      className="p-2 rounded-xl border-slate-200 bg-slate-50 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-100 transition"
                    >
                      <option value="">— Ver Todos —</option>
                      {[...new Set(positions.map(p => p.dashboard_name).filter(Boolean))].map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
            
            <div className="text-xs text-slate-400 font-medium italic">
              Actualizado: {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
                 <Activity size={24} />
              </div>
              <div className="text-2xl font-black text-slate-900">{stats.kpis?.total_logins || 0}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Ingresos</div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
                 <Users size={24} />
              </div>
              <div className="text-2xl font-black text-slate-900">{stats.kpis?.unique_users || 0}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Usuarios Activos</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
                 <Briefcase size={24} />
              </div>
              <div className="text-2xl font-black text-slate-900">{stats.by_position?.length || 0}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Puestos Consultados</div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
                 <TrendingUp size={24} />
              </div>
              <div className="text-2xl font-black text-slate-900">{Math.round((stats.kpis?.total_logins || 0) / (stats.kpis?.unique_users || 1))}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Frecuencia Avg.</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico de Evolución Diaria */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp size={20} className="text-blue-500" />
                <h3 className="font-bold text-slate-800">Tendencia Diaria</h3>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.over_time || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="count" name="Ingresos" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, strokeWidth: 2, fill: '#fff'}} activeDot={{r: 6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico de Evolución Mensual */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart2 size={20} className="text-purple-500" />
                <h3 className="font-bold text-slate-800">Evolutivo Mensual</h3>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.over_time_month || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Bar dataKey="count" name="Ingresos" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico de Torta: Puestos */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-6">
                <PieIcon size={20} className="text-indigo-500" />
                <h3 className="font-bold text-slate-800">Accesos por Puesto</h3>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.by_position || []} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="name">
                      {(stats.by_position || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Usuarios */}
            <div className="bg-white rounded-2xl shadow-sm border p-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart2 size={20} className="text-emerald-500" />
                <h3 className="font-bold text-slate-800">Usuarios más Activos</h3>
              </div>
              <div className="space-y-4">
                {(stats.top_users || []).map((u, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-700">{u.name}</span>
                      <span className="text-slate-400">{u.count} ingresos</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(u.count / (stats.top_users[0]?.count || 1)) * 100}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Últimos Logs */}
            <div className="bg-white rounded-2xl shadow-sm border p-6 overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity size={20} className="text-slate-400" />
                  <h3 className="font-bold text-slate-800">Actividad Reciente</h3>
                </div>
              </div>
              <div className="space-y-3 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                {logs.slice(0, 10).map(l => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 transition hover:border-blue-200 group">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 group-hover:text-blue-600 group-hover:border-blue-200 flex items-center justify-center font-bold shrink-0 transition-all">{l.name.substring(0,1)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-slate-900 truncate">{l.name}</div>
                      <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                        {l.position_name || 'Sin puesto'} • {format(new Date(l.login_time), "d 'de' MMMM, HH:mm", { locale: es })}
                      </div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-slate-400 text-sm italic py-4 text-center">Sin actividad reciente.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUserSave} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-6 text-slate-900">{editingUser ? 'Actualizar Colaborador' : 'Nuevo Integrante'}</h3>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Usuario ID</label>
                  <input required placeholder="ej. mpons" value={userFormData.username} onChange={e => setUserFormData({...userFormData, username: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Contraseña</label>
                  <input 
                    type="text"
                    placeholder={editingUser ? "Vacío = sin cambios" : "Pass segura"} 
                    required={!editingUser} 
                    value={userFormData.password} 
                    onChange={e => setUserFormData({...userFormData, password: e.target.value})} 
                    className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none" 
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Email Institucional</label>
                <input type="email" placeholder="nombre@neumaticospons.com" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre Completo</label>
                <input required placeholder="Nombre y Apellido" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Privilegios</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none">
                    <option value="user">Visualizador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Puesto Operativo</label>
                  <select value={userFormData.position_id} onChange={e => setUserFormData({...userFormData, position_id: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-blue-100 focus:bg-white transition-all outline-none" disabled={userFormData.role==='admin'}>
                    <option value="">— Ninguno —</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">Cancelar</button>
              <button type="submit" className="px-6 py-3 bg-blue-600 text-white text-sm font-black rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Guardar Cambios</button>
            </div>
          </form>
        </div>
      )}

      {showPosModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePosSave} className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-6 text-slate-900">{editingPos ? 'Editar Puesto' : 'Vincular Nuevo Puesto'}</h3>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Referencia del Puesto</label>
                  <input required placeholder="ej. Asesor Comercial" value={posFormData.name} onChange={e => setPosFormData({...posFormData, name: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Nombre del Tablero</label>
                  <input required placeholder="ej. Ventas Regionales" value={posFormData.dashboard_name} onChange={e => setPosFormData({...posFormData, dashboard_name: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">URL Pública de Power BI (Link de inserción)</label>
                <textarea required placeholder="Pegue aquí el link iframe..." value={posFormData.dashboard_url} onChange={e => setPosFormData({...posFormData, dashboard_url: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-3 rounded-xl focus:ring-4 focus:ring-indigo-100 outline-none h-32 font-mono text-xs text-slate-500" />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setShowPosModal(false)} className="px-5 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition">Cerrar</button>
              <button type="submit" className="px-6 py-3 bg-indigo-600 text-white text-sm font-black rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">Asignar Reporte</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
