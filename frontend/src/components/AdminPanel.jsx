import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, LineChart, Line, Legend 
} from 'recharts';
import { 
  Calendar, Users, Briefcase, Activity, 
  TrendingUp, BarChart2, PieChart as PieIcon, Filter,
  Mail, Edit, Trash2, Eye, EyeOff, Plus, Link as LinkIcon, Layout
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

const COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981'];

export default function AdminPanel({ token, user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [dashboardTypes, setDashboardTypes] = useState([]);
  const [dashboardLinks, setDashboardLinks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ by_position: [], over_time: [], top_users: [] });
  const [activeTab, setActiveTab] = useState(currentUser.role === 'admin' ? 'users' : 'logs');
  const [statsRange, setStatsRange] = useState('7d');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState('');
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', name: '', email: '', role: 'user', position_ids: [] });

  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [posFormData, setPosFormData] = useState({ name: '' });

  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeFormData, setTypeFormData] = useState({ name: '', description: '' });

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [editingLink, setEditingLink] = useState(null);
  const [linkFormData, setLinkFormData] = useState({ position_id: '', dashboard_type_id: '', url: '' });

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
      const isDirectorio = currentUser.position_name?.includes('Directorio');
      
      if (currentUser.role === 'admin') {
        const [uRes, pRes, tRes, lkRes, lRes, sRes] = await Promise.all([
          api.get('/users'),
          api.get('/positions'),
          api.get('/dashboard-types'),
          api.get('/dashboard-links'),
          api.get('/logs'),
          api.get(`/stats${query}`)
        ]);
        setUsers(uRes.data);
        setPositions(pRes.data);
        setDashboardTypes(tRes.data);
        setDashboardLinks(lkRes.data);
        setLogs(lRes.data);
        setStats(sRes.data || { by_position: [], over_time: [], top_users: [] });
      } else {
        const [pRes, lRes, sRes] = await Promise.all([
          isDirectorio ? api.get('/positions') : Promise.resolve({ data: [] }),
          api.get('/logs'),
          api.get(`/stats${query}`)
        ]);
        if (isDirectorio) setPositions(pRes.data);
        setLogs(lRes.data);
        setStats(sRes.data || { by_position: [], over_time: [], top_users: [] });
      }
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => { fetchData() }, [token, statsRange, selectedPositionId, selectedDashboard]);

  // USERS HANDLERS
  const handleUserModal = (u = null) => {
    setEditingUser(u);
    setUserFormData(u ? 
      { username: u.username, name: u.name, email: u.email || '', role: u.role, position_ids: u.position_ids || [], password: '' } : 
      { username: '', password: '', name: '', email: '', role: 'user', position_ids: [] }
    );
    setShowUserModal(true);
  };
  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) await api.put(`/users/${editingUser.id}`, userFormData);
      else await api.post('/users', userFormData);
      setShowUserModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };
  const handleUserDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este usuario?")) return;
    try { await api.delete(`/users/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  // POSITIONS HANDLERS
  const handlePosModal = (p = null) => {
    setEditingPos(p);
    setPosFormData(p ? { name: p.name } : { name: '' });
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
    if (!window.confirm("¿Seguro que quieres eliminar este puesto?")) return;
    try { await api.delete(`/positions/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  // DASHBOARD TYPES HANDLERS
  const handleTypeModal = (t = null) => {
    setEditingType(t);
    setTypeFormData(t ? { name: t.name, description: t.description } : { name: '', description: '' });
    setShowTypeModal(true);
  };
  const handleTypeSave = async (e) => {
    e.preventDefault();
    try {
      if (editingType) await api.put(`/dashboard-types/${editingType.id}`, typeFormData);
      else await api.post('/dashboard-types', typeFormData);
      setShowTypeModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };
  const handleTypeDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este tipo de tablero?")) return;
    try { await api.delete(`/dashboard-types/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  // DASHBOARD LINKS HANDLERS
  const handleLinkModal = (l = null) => {
    setEditingLink(l);
    setLinkFormData(l ? 
      { position_id: l.position_id, dashboard_type_id: l.dashboard_type_id, url: l.url } : 
      { position_id: '', dashboard_type_id: '', url: '' }
    );
    setShowLinkModal(true);
  };
  const handleLinkSave = async (e) => {
    e.preventDefault();
    try {
      if (editingLink) await api.put(`/dashboard-links/${editingLink.id}`, linkFormData);
      else await api.post('/dashboard-links', linkFormData);
      setShowLinkModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };
  const handleLinkDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar esta asignación?")) return;
    try { await api.delete(`/dashboard-links/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-full pb-20">
      {/* Header Con Tabs */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {currentUser.role === 'admin' ? 'Panel de Control' : 'Seguimiento de Gestión'}
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            {currentUser.role === 'admin' ? 'Gestión de matriz de tableros y métricas.' : 'Análisis de uso y métricas de desempeño de tableros.'}
          </p>
        </div>
        <div className="flex flex-wrap bg-white rounded-xl shadow-sm border p-1.5 gap-1">
          {currentUser.role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('users')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Users size={14} /> Usuarios</button>
              <button onClick={() => setActiveTab('positions')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === 'positions' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Briefcase size={14} /> Puestos</button>
              <button onClick={() => setActiveTab('types')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === 'types' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Layout size={14} /> Conceptos</button>
              <button onClick={() => setActiveTab('links')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === 'links' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><LinkIcon size={14} /> Asignaciones</button>
            </>
          )}
          <button onClick={() => setActiveTab('logs')} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition ${activeTab === 'logs' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Activity size={14} /> Seguimiento</button>
        </div>
      </div>

      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Colaboradores</h3>
            <button onClick={() => handleUserModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all transform hover:scale-105">
              <Plus size={16} /> Nuevo Usuario
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                  <th className="p-4 pl-6">Usuario</th>
                  <th className="p-4">Nombre</th>
                  <th className="p-4">Puestos</th>
                  <th className="p-4">Rol</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-800">{u.username}</td>
                    <td className="p-4 text-slate-600 font-bold">{u.name}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {u.positions?.map((p, i) => (
                          <span key={i} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">{p.name}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${u.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{u.role}</span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                         <button onClick={() => handleUserModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16} /></button>
                         {currentUser.id !== u.id && <button onClick={() => handleUserDel(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'positions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
          <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Puestos / Roles</h3>
            <button onClick={() => handlePosModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all transform hover:scale-105">Nuevo Puesto</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                  <th className="p-4 pl-6">Nombre del Puesto</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {positions.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-indigo-700">{p.name}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                         <button onClick={() => handlePosModal(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16} /></button>
                         <button onClick={() => handlePosDel(p.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'types' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
          <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Conceptos de Tablero</h3>
            <button onClick={() => handleTypeModal()} className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all transform hover:scale-105">Nuevo Concepto</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                  <th className="p-4 pl-6">Concepto (Ej: Daily)</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {dashboardTypes.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-purple-700">{t.name}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                         <button onClick={() => handleTypeModal(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16} /></button>
                         <button onClick={() => handleTypeDel(t.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'links' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="flex justify-between items-center p-5 border-b bg-slate-50/50">
            <h3 className="font-bold text-slate-800">Matriz de Asignación (Puesto + Concepto = Link)</h3>
            <button onClick={() => handleLinkModal()} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all transform hover:scale-105">Vincular Tablero</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                  <th className="p-4 pl-6">Puesto</th>
                  <th className="p-4">Concepto</th>
                  <th className="p-4">URL Power BI</th>
                  <th className="p-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {dashboardLinks.map(lk => (
                  <tr key={lk.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="p-4 pl-6 font-bold text-slate-700">{lk.positions?.name}</td>
                    <td className="p-4">
                      <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-100">{lk.dashboard_types?.name}</span>
                    </td>
                    <td className="p-4 text-[10px] font-mono text-slate-400 truncate max-w-xs">{lk.url.substring(0, 80)}...</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-1">
                         <button onClick={() => handleLinkModal(lk)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"><Edit size={16} /></button>
                         <button onClick={() => handleLinkDel(lk.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {dashboardLinks.length === 0 && (
                  <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic">No hay links asignados. Comienza vinculando un puesto con un concepto.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* BARRA DE FILTROS AVANZADA */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Rango Temporal</label>
              <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border">
                {[
                  { id: '7d', label: '7 días' },
                  { id: '30d', label: '30 días' },
                  { id: 'month', label: 'Mes actual' },
                  { id: 'all', label: 'Histórico' }
                ].map(r => (
                  <button 
                    key={r.id} 
                    onClick={() => setStatsRange(r.id)} 
                    className={`flex-1 px-3 py-2 text-[10px] font-bold rounded-lg transition-all ${statsRange === r.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-2"><Filter size={10} /> Filtrar por Puesto</label>
              <select 
                value={selectedPositionId} 
                onChange={e => setSelectedPositionId(e.target.value)}
                className="w-full bg-slate-50 border p-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="">Todos los puestos</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 flex items-center gap-2"><Layout size={10} /> Filtrar por Tablero</label>
              <select 
                value={selectedDashboard} 
                onChange={e => setSelectedDashboard(e.target.value)}
                className="w-full bg-slate-50 border p-2.5 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              >
                <option value="">Todos los conceptos</option>
                {dashboardTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            
            <button 
              onClick={() => { setSelectedPositionId(''); setSelectedDashboard(''); setStatsRange('7d'); }}
              className="px-4 py-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all group"
              title="Limpiar Filtros"
            >
              <Trash2 size={18} className="group-hover:scale-110 transition-transform" />
            </button>
          </div>

          {/* GRID DE KPIS CANÓNICOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Accesos', value: stats.kpis?.total_logins, icon: Activity, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Usuarios Únicos', value: stats.kpis?.unique_users, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Tableros Activos', value: dashboardLinks.length, icon: Layout, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Roles de Empresa', value: positions.length, icon: Briefcase, color: 'text-orange-600', bg: 'bg-orange-50' }
            ].map((kpi, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5 group hover:shadow-md transition-all">
                <div className={`${kpi.bg} ${kpi.color} p-4 rounded-2xl group-hover:scale-110 transition-transform`}><kpi.icon size={24} /></div>
                <div>
                  <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value || 0}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{kpi.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* DASHBOARD DE ANÁLISIS VISUAL */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* GRÁFICO DE EVOLUCIÓN (Línea) */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-200"><TrendingUp size={18} /></div>
                  <h3 className="font-extrabold text-slate-800">Evolución de Uso</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border">Frecuencia Diaria</span>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.over_time || []} margin={{ top: 5, right: 30, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={4} dot={{r: 5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 8, strokeWidth: 0}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* USO POR CONCEPTO (Barras) */}
            <div className="bg-white rounded-3xl shadow-sm border p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-purple-600 p-2 rounded-lg text-white shadow-lg shadow-purple-200"><BarChart2 size={18} /></div>
                <h3 className="font-extrabold text-slate-800">Los Más Usados</h3>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.by_dashboard || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 10, fontWeight: 800}} width={90} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{fill: '#f8fafc'}} />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 10, 10, 0]} barSize={20}>
                      { (stats.by_dashboard || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />) }
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* DISTRIBUCIÓN POR PUESTO (Pie) */}
            <div className="bg-white rounded-3xl shadow-sm border p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-emerald-600 p-2 rounded-lg text-white shadow-lg shadow-emerald-200"><PieIcon size={18} /></div>
                <h3 className="font-extrabold text-slate-800">Acceso por Rol</h3>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.by_position || []} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5}>
                      { (stats.by_position || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />) }
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '10px', fontWeight: 700}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TOP USUARIOS ACTIVOS */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border overflow-hidden flex flex-col">
               <div className="p-8 border-b flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-orange-600 p-2 rounded-lg text-white shadow-lg shadow-orange-200"><Users size={18} /></div>
                    <h3 className="font-extrabold text-slate-800">Top 8 Colaboradores</h3>
                  </div>
               </div>
               <div className="p-6 flex-1">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {(stats.top_users || []).map((u, i) => (
                     <div key={i} className="flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-black text-xs border border-white shadow-sm">{u.name?.substring(0,1)}</div>
                          <div>
                            <div className="text-sm font-black text-slate-700">{u.name}</div>
                            <div className="text-[10px] font-bold text-slate-400">Total interacciones</div>
                          </div>
                        </div>
                        <div className="bg-slate-100 px-4 py-2 rounded-xl text-sm font-black text-slate-600">{u.count}</div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>

          </div>

          {/* TABLA DE AUDITORÍA (Logs crudos) */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-slate-800 p-2 rounded-lg text-white"><Calendar size={18} /></div>
                <h3 className="font-bold text-slate-800">Historial Detallado (Últimos 100)</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50/50 text-slate-400 text-[10px] uppercase tracking-widest font-black border-b">
                    <th className="p-4 pl-8">Colaborador</th>
                    <th className="p-4">Puesto</th>
                    <th className="p-4">Fecha y Hora</th>
                    <th className="p-4">Acción / Tablero</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-8 font-bold text-slate-700">{log.name} <span className="text-slate-400 font-normal">({log.username})</span></td>
                      <td className="p-4"><span className="text-slate-500">{log.position_name}</span></td>
                      <td className="p-4 text-slate-400 font-medium">{format(new Date(log.login_time), 'dd MMM, HH:mm', { locale: es })}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-md font-bold text-[10px] ${log.dashboard_url === 'LOGIN' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {log.dashboard_url === 'LOGIN' ? '🚀 INICIO SESIÓN' : '📊 VIO TABLERO'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL USUARIOS */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUserSave} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border animate-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-6">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
            <div className="space-y-4">
              <input required placeholder="Username" value={userFormData.username} onChange={e => setUserFormData({...userFormData, username: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" />
              <input type="text" placeholder={editingUser ? "Password (dejar vacío para no cambiar)" : "Password"} required={!editingUser} value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" />
              <input required placeholder="Nombre Completo" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" />
              <input type="email" placeholder="Email" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100" />
              <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100">
                <option value="user">Visualizador</option>
                <option value="admin">Admin</option>
              </select>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Asignar Puestos/Roles</label>
                <div className="max-h-40 overflow-y-auto border rounded-xl p-2 bg-slate-50">
                  {positions.map(p => (
                    <label key={p.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition">
                      <input type="checkbox" checked={userFormData.position_ids.includes(p.id)} onChange={e => {
                        const ids = e.target.checked ? [...userFormData.position_ids, p.id] : userFormData.position_ids.filter(id => id !== p.id);
                        setUserFormData({...userFormData, position_ids: ids});
                      }} />
                      <span className="text-xs font-bold text-slate-700">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-2">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-black rounded-lg hover:bg-blue-700 shadow-md">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PUESTOS */}
      {showPosModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePosSave} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border animate-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-6">{editingPos ? 'Editar Puesto' : 'Nuevo Puesto'}</h3>
            <input required placeholder="Ej: Directorio, Encargado Colón..." value={posFormData.name} onChange={e => setPosFormData({...posFormData, name: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100" />
            <div className="mt-8 flex justify-end gap-2">
              <button type="button" onClick={() => setShowPosModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cerrar</button>
              <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-black rounded-lg hover:bg-indigo-700">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CONCEPTOS */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleTypeSave} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-sm border animate-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-6">{editingType ? 'Editar Concepto' : 'Nuevo Concepto'}</h3>
            <input required placeholder="Ej: Daily, Integral Comercial..." value={typeFormData.name} onChange={e => setTypeFormData({...typeFormData, name: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-purple-100 mb-4" />
            <textarea placeholder="Descripción opcional" value={typeFormData.description} onChange={e => setTypeFormData({...typeFormData, description: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-purple-100 h-20 text-sm" />
            <div className="mt-8 flex justify-end gap-2">
              <button type="button" onClick={() => setShowTypeModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cerrar</button>
              <button type="submit" className="px-6 py-2 bg-purple-600 text-white font-black rounded-lg hover:bg-purple-700">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL ASIGNACIONES */}
      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleLinkSave} className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-lg border animate-in zoom-in duration-200">
            <h3 className="text-xl font-black mb-6">Configurar Link de Tablero</h3>
            <div className="space-y-4">
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Para el Puesto:</label>
                 <select required value={linkFormData.position_id} onChange={e => setLinkFormData({...linkFormData, position_id: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700">
                   <option value="">— Seleccionar Puesto —</option>
                   {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Concepto del Tablero:</label>
                 <select required value={linkFormData.dashboard_type_id} onChange={e => setLinkFormData({...linkFormData, dashboard_type_id: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-slate-700">
                   <option value="">— Seleccionar Concepto —</option>
                   {dashboardTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                 </select>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">URL de Power BI:</label>
                 <textarea required placeholder="Pegue la URL específica para este puesto y concepto" value={linkFormData.url} onChange={e => setLinkFormData({...linkFormData, url: e.target.value})} className="w-full border p-3 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 h-32 font-mono text-xs text-slate-500" />
               </div>
            </div>
            <div className="mt-8 flex justify-end gap-2">
              <button type="button" onClick={() => setShowLinkModal(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-emerald-600 text-white font-black rounded-lg hover:bg-emerald-700 shadow-md">Guardar Asignación</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
