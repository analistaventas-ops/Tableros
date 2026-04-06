import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Cell
} from 'recharts';
import { 
  Calendar, Users, Briefcase, Activity, 
  Edit, Trash2, Plus, Layout,
  Zap, Clock, UserCheck, Star,
  Trash, Filter, TrendingUp, TrendingDown,
  Target, Percent, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function AdminPanel({ token, user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [dashboardTypes, setDashboardTypes] = useState([]);
  const [dashboardLinks, setDashboardLinks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ 
    kpis: { 
      active_users_30d: 0, 
      adoption_rate: 0, 
      total_sessions: 0, 
      avg_sessions_user: 0, 
      avg_time_session: 0, 
      top_dashboard: { name: 'N/A', count: 0 },
      inactive_users_count: 0,
      var_active_30d: 0,
      var_sessions: 0,
      var_time: 0
    }, 
    by_position: [], 
    over_time: [], 
    by_dashboard: [], 
    engagement: [],
    top_users: []
  });
  
  const [activeTab, setActiveTab] = useState(currentUser.role === 'admin' ? 'users' : 'logs');
  const [statsRange, setStatsRange] = useState('7d');
  const [selectedPositionId, setSelectedPositionId] = useState('');
  const [selectedDashboard, setSelectedDashboard] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  
  // MODAL STATES
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
      if (statsRange === '7d') {
        const d = new Date(); d.setDate(d.getDate() - 7);
        fromDate = d.toISOString().split('T')[0];
      } else if (statsRange === '30d') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        fromDate = d.toISOString().split('T')[0];
      }

      const queryParams = new URLSearchParams();
      if (fromDate) queryParams.append('from', fromDate);
      if (selectedPositionId) queryParams.append('positionId', selectedPositionId);
      if (selectedDashboard) queryParams.append('dashboardName', selectedDashboard);
      if (selectedUserId) queryParams.append('userId', selectedUserId);
      
      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const isDirectorio = currentUser.position_name?.toLowerCase().includes('directorio');
      
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
        setStats(sRes.data || stats);
      } else {
        const [pRes, lRes, sRes, uRes] = await Promise.all([
          isDirectorio ? api.get('/positions') : Promise.resolve({ data: [] }),
          api.get('/logs'),
          api.get(`/stats${query}`),
          isDirectorio ? api.get('/users') : Promise.resolve({ data: [] })
        ]);
        if (isDirectorio) {
          setPositions(pRes.data);
          setUsers(uRes.data);
        }
        setLogs(lRes.data);
        setStats(sRes.data || stats);
      }
    } catch (err) { console.error("Fetch error:", err); }
  };

  useEffect(() => { fetchData() }, [token, statsRange, selectedPositionId, selectedDashboard, selectedUserId]);

  // CRUD HANDLERS (Same as before but consistent)
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
      setShowUserModal(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };
  const handleUserDel = async (id) => {
    if (!window.confirm("¿Eliminar usuario?")) return;
    try { await api.delete(`/users/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

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
      setShowPosModal(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

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
      setShowTypeModal(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handleLinkModal = (l = null) => {
    setEditingLink(l);
    setLinkFormData(l ? { position_id: l.position_id, dashboard_type_id: l.dashboard_type_id, url: l.url } : { position_id: '', dashboard_type_id: '', url: '' });
    setShowLinkModal(true);
  };
  const handleLinkSave = async (e) => {
    e.preventDefault();
    try {
      if (editingLink) await api.put(`/dashboard-links/${editingLink.id}`, linkFormData);
      else await api.post('/dashboard-links', linkFormData);
      setShowLinkModal(false); fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const COLORS = ['#3b82f6', '#8b5cf6', '#6366f1', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="p-8 bg-slate-50 min-h-screen pb-24">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
        <div className="flex items-center gap-4">
          <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
            <Layout size={32} className={activeTab === 'logs' ? 'text-slate-800' : 'text-blue-600'} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight uppercase">
              {currentUser.role === 'admin' ? 'Panel de Control' : 'Seguimiento de Uso'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{currentUser.role} logueado</p>
            </div>
          </div>
        </div>

        <div className="flex bg-white rounded-2xl shadow-sm border border-slate-200 p-1.5 gap-1.5 transition-all">
          {currentUser.role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('users')} className={`px-5 py-2.5 text-[10px] font-black uppercase transition-all rounded-xl ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Colaboradores</button>
              <button onClick={() => setActiveTab('positions')} className={`px-5 py-2.5 text-[10px] font-black uppercase transition-all rounded-xl ${activeTab === 'positions' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Puestos</button>
              <button onClick={() => setActiveTab('types')} className={`px-5 py-2.5 text-[10px] font-black uppercase transition-all rounded-xl ${activeTab === 'types' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Conceptos</button>
              <button onClick={() => setActiveTab('links')} className={`px-5 py-2.5 text-[10px] font-black uppercase transition-all rounded-xl ${activeTab === 'links' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Asignaciones</button>
            </>
          )}
          <button onClick={() => setActiveTab('logs')} className={`px-5 py-2.5 text-[10px] font-black uppercase transition-all rounded-xl ${activeTab === 'logs' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Seguimiento y Métricas</button>
        </div>
      </div>

      {/* RENDER CONTENT BASED ON ACTIVE TAB */}
      {(activeTab === 'users' || activeTab === 'positions' || activeTab === 'types' || activeTab === 'links') && currentUser.role === 'admin' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
           {/* Tablas CRUD (Simplified for better flow) */}
           {activeTab === 'users' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex justify-between items-center p-6 bg-slate-50/50 border-b">
                  <h3 className="font-black text-slate-800 text-sm uppercase">Lista de Colaboradores</h3>
                  <button onClick={() => handleUserModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all active:scale-95 shadow-md"><Plus size={14} /> Nuevo Usuario</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black border-b">
                      <tr>
                        <th className="p-5 pl-8">Usuario / Nombre</th>
                        <th className="p-5">Área / Puestos</th>
                        <th className="p-5">Rol</th>
                        <th className="p-5 text-right pr-8">Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-600">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-slate-50 group">
                          <td className="p-5 pl-8">
                            <div className="font-black text-slate-800">{u.username}</div>
                            <div className="text-[10px] opacity-60 font-bold">{u.name}</div>
                          </td>
                          <td className="p-5">
                            <div className="flex flex-wrap gap-1">
                              {u.positions?.map((p, i) => <span key={i} className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[9px] font-black border border-blue-100">{p.name}</span>)}
                              {(!u.positions || u.positions.length === 0) && <span className="text-slate-300 italic">Sin puesto</span>}
                            </div>
                          </td>
                          <td className="p-5">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${u.role === 'admin' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-700'}`}>{u.role}</span>
                          </td>
                          <td className="p-5 text-right pr-8">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={() => handleUserModal(u)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"><Edit size={16} /></button>
                               {currentUser.id !== u.id && <button onClick={() => handleUserDel(u.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>}
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
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
                <div className="flex justify-between items-center p-6 bg-slate-50/50 border-b">
                  <h3 className="font-black text-slate-800 text-sm uppercase tracking-tight">Esquema de Áreas</h3>
                  <button onClick={() => handlePosModal()} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase transition-all shadow-md">Nuevo Puesto</button>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black border-b"><tr><th className="p-5 pl-8">Nombre del Área</th><th className="p-5 text-right pr-8">Acciones</th></tr></thead>
                  <tbody className="divide-y">
                    {positions.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 group">
                        <td className="p-5 pl-8 font-black text-indigo-700 uppercase tracking-tighter text-sm">{p.name}</td>
                        <td className="p-5 text-right pr-8">
                          <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handlePosModal(p)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"><Edit size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           )}

           {activeTab === 'types' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
                <div className="flex justify-between items-center p-6 bg-slate-50/50 border-b">
                  <h3 className="font-black text-slate-800 text-sm uppercase">Reportes Maestros</h3>
                  <button onClick={() => handleTypeModal()} className="bg-purple-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-md">Nuevo Concepto</button>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black border-b"><tr><th className="p-5 pl-8">Nombre del Concepto</th><th className="p-5 text-right pr-8">Gestión</th></tr></thead>
                  <tbody className="divide-y font-black text-purple-700">
                    {dashboardTypes.map(t => (
                      <tr key={t.id} className="hover:bg-slate-50 group">
                        <td className="p-5 pl-8">{t.name}</td>
                        <td className="p-5 text-right pr-8">
                          <button onClick={() => handleTypeModal(t)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"><Edit size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
           )}

           {activeTab === 'links' && (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex justify-between items-center p-6 bg-slate-50/50 border-b">
                  <h3 className="font-black text-slate-800 text-sm uppercase">Matriz de Conexión (Power BI Links)</h3>
                  <button onClick={() => handleLinkModal()} className="bg-emerald-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase shadow-md">Crear Nueva Asignación</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-400 text-[9px] uppercase font-black border-b">
                      <tr>
                        <th className="p-5 pl-8">Puesto</th>
                        <th className="p-5">Concepto</th>
                        <th className="p-5">Origen del Iframe</th>
                        <th className="p-5 text-right pr-8">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-slate-700 font-bold">
                      {dashboardLinks.map(lk => (
                        <tr key={lk.id} className="hover:bg-emerald-50/20 group">
                          <td className="p-5 pl-8 text-slate-800">{lk.positions?.name}</td>
                          <td className="p-5">
                            <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">{lk.dashboard_types?.name}</span>
                          </td>
                          <td className="p-5 text-[9px] font-mono text-slate-400 truncate max-w-xs italic">{lk.url.substring(0, 100)}...</td>
                          <td className="p-5 text-right pr-8">
                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                               <button onClick={() => handleLinkModal(lk)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl"><Edit size={16} /></button>
                               <button onClick={() => handleLinkDel(lk.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
           )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
          
          {/* HEADER SECTORIAL */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="p-4 bg-slate-900 rounded-3xl text-white shadow-xl rotate-3"><Zap size={24} /></div>
               <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Product Analytics Dashboard</h3>
                  <p className="text-xs font-bold text-slate-400">Análisis detallado de adopción, retención y comportamiento de usuarios.</p>
               </div>
            </div>
            
            {/* FILTROS AVANZADOS COMPACTOS */}
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-3">
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                {[{ id: '7d', l: '7d' }, { id: '30d', l: '30d' }, { id: 'all', l: 'Todo' }].map(r => (
                  <button key={r.id} onClick={() => setStatsRange(r.id)} className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all ${statsRange === r.id ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>{r.l}</button>
                ))}
              </div>
              <div className="h-4 w-px bg-slate-200"></div>
              <select value={selectedDashboard} onChange={e => setSelectedDashboard(e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-700 outline-none cursor-pointer">
                <option value="">Tablero: Todos</option>
                {dashboardTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <select value={selectedPositionId} onChange={e => setSelectedPositionId(e.target.value)} className="bg-slate-50 border-none px-3 py-1.5 rounded-xl text-[10px] font-black text-slate-700 outline-none cursor-pointer">
                <option value="">Área/Puesto: Todos</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button onClick={() => { setSelectedPositionId(''); setSelectedDashboard(''); setSelectedUserId(''); setStatsRange('30d'); }} className="p-2 text-slate-400 hover:text-red-500 bg-slate-50 rounded-xl transition-all" title="Reiniciar Filtros">
                <Trash size={14} />
              </button>
            </div>
          </div>

          {/* KPI GRILL (7 CARDS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {[
              { label: 'Activos (30d)', val: stats.kpis?.active_users_30d || 0, icon: <UserCheck />, clr: 'blue', var: stats.kpis?.active_users_30d_var },
              { label: '% Adopción', val: (stats.kpis?.adoption_rate || 0) + '%', icon: <Percent />, clr: 'emerald', var: stats.kpis?.adoption_rate_var },
              { label: 'Total Sesiones', val: stats.kpis?.total_sessions || 0, icon: <Activity />, clr: 'indigo', var: stats.kpis?.total_sessions_var },
              { label: 'Avg Sesiones', val: stats.kpis?.sessions_per_user || 0, icon: <Target />, clr: 'amber', var: stats.kpis?.sessions_per_user_var },
              { label: 'Avg Tiempo', val: (stats.kpis?.avg_time_per_session || 0) + 'm', icon: <Clock />, clr: 'purple', var: stats.kpis?.avg_time_per_session_var },
              { label: 'Top Tablero', val: (stats.by_dashboard || [])[0]?.name || 'N/A', icon: <Star />, clr: 'rose', var: null, sub: `${(stats.by_dashboard || [])[0]?.count || 0} accesos` },
              { label: 'Inactivos', val: stats.kpis?.inactive_users || 0, icon: <Trash />, clr: 'slate', var: null }
            ].map((k, i) => {
              const colorMap = {
                blue: 'bg-blue-50 text-blue-600 border-blue-200',
                emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                indigo: 'bg-indigo-50 text-indigo-600 border-indigo-200',
                amber: 'bg-amber-50 text-amber-600 border-amber-200',
                purple: 'bg-purple-50 text-purple-600 border-purple-200',
                rose: 'bg-rose-50 text-rose-600 border-rose-200',
                slate: 'bg-slate-50 text-slate-600 border-slate-200'
              };
              const activeClr = colorMap[k.clr] || colorMap.slate;

              return (
                <div key={i} className={`bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group hover:${activeClr.split(' ')[2]} transition-all flex flex-col justify-between`}>
                  <div>
                    <div className={`w-8 h-8 rounded-xl ${activeClr.split(' ')[0]} ${activeClr.split(' ')[1]} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                      {React.cloneElement(k.icon, { size: 16, strokeWidth: 3 })}
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">{k.label}</p>
                    <h4 className="text-xl font-black text-slate-800 truncate">{k.val}</h4>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    {k.var !== null && k.var !== undefined ? (
                      <span className={`text-[9px] font-black flex items-center gap-1 ${k.var >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {k.var >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                          {Math.abs(k.var)}%
                      </span>
                    ) : <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">{k.sub || '---'}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* MAIN CHARTS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* LÍNEA DE TIEMPO (EVOLUCIÓN) */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><Activity size={18} className="text-blue-500" /> Frecuencia Diaria</h3>
                    <p className="text-[10px] font-bold text-slate-400">Evolución de sesiones vs días anteriores.</p>
                  </div>
                </div>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.over_time || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#94a3b8'}} />
                      <Tooltip contentStyle={{borderRadius: '20px', border: 'none', shadow: 'none', padding: '15px'}} itemStyle={{fontWeight: 900}} />
                      <Line type="monotone" dataKey="count" name="Accesos" stroke="#3b82f6" strokeWidth={5} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
            </div>

            {/* SEGMENTACIÓN POR ENGAGEMENT */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><Target size={18} className="text-emerald-500" /> Engagement Score</h3>
                <div className="space-y-4">
                   {(stats.engagement_segments || []).map((seg, idx) => {
                     const engagementColors = ['bg-slate-400', 'bg-blue-400', 'bg-indigo-500', 'bg-emerald-500'];
                     const barColor = engagementColors[idx % engagementColors.length];
                     return (
                       <div key={idx} className="space-y-1.5">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-tight">
                             <span className="text-slate-500">{seg.segment}</span>
                             <span className="text-slate-800">{seg.users} usuarios</span>
                          </div>
                          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                             <div className={`h-full transition-all duration-1000 ${barColor}`} style={{ width: `${(seg.users / (stats.kpis?.active_users_30d || 1) * 100)}%` }}></div>
                          </div>
                       </div>
                     );
                   })}
                   {(!stats.engagement_segments || stats.engagement_segments.length === 0) && (
                     <div className="flex flex-col items-center justify-center h-48 opacity-20 italic font-black text-xs uppercase">No hay segmentos suficientes</div>
                   )}
                </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-8 flex items-center gap-2"><Layout size={18} className="text-purple-500" /> Distribución por Dashboard</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                     <BarChart data={stats.by_dashboard || []} layout="vertical">
                       <XAxis type="number" hide />
                       <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fontSize: 9, fontWeight: 900, fill: '#64748b'}} width={120} />
                       <Tooltip />
                       <Bar dataKey="count" fill="#818cf8" radius={[0, 10, 10, 0]} barSize={20} />
                     </BarChart>
                   </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2"><UserCheck size={18} className="text-blue-500" /> Auditoría en Tiempo Real (UTC-3)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                       <thead className="bg-slate-50 text-[8px] uppercase font-black text-slate-400 border-b">
                          <tr>
                             <th className="py-4 px-2">Usuario</th>
                             <th className="py-4 px-2">Tablero</th>
                             <th className="py-4 px-2">Time</th>
                             <th className="py-4 px-2 text-right">Data</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y text-[10px]">
                          {logs.slice(0, 15).map(s => (
                            <tr key={s.id} className="hover:bg-slate-50 transition-all font-bold">
                               <td className="py-4 px-2">
                                  <div className="text-slate-800 font-black truncate max-w-[100px]">{s.name}</div>
                                  <div className="text-[8px] text-slate-400 uppercase">{s.position_name}</div>
                               </td>
                               <td className="py-4 px-2 font-black text-blue-600 uppercase tracking-tighter">{s.dashboard_name}</td>
                               <td className="py-4 px-2">
                                  <span className="bg-slate-100 px-2 py-1 rounded text-[8px] font-black">{s.duration_minutes || 1}m</span>
                               </td>
                               <td className="py-4 px-2 text-right text-[8px] font-black text-slate-400">
                                  {format(new Date(s.start_time), 'HH:mm | dd/MM')}
                               </td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL OVERLAYS (Maintained focus on clean, high-contrast modal design) */}
      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
          <form onSubmit={handleUserSave} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight italic">CONFIGURAR COLABORADOR</h3>
              <div className="p-2 bg-blue-50 text-blue-500 rounded-xl"><Users size={24} /></div>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Usuario ID</label>
                   <input required placeholder="username" value={userFormData.username} onChange={e => setUserFormData({...userFormData, username: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-blue-100 font-bold text-slate-800" />
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Clave de Acceso</label>
                   <input type="text" placeholder={editingUser ? "••••••" : "Contraseña"} required={!editingUser} value={userFormData.password} onChange={e => setUserFormData({...userFormData, password: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-blue-100 font-bold" />
                 </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Nombre Público</label>
                <input required placeholder="Nombre Completo" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-blue-100 font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Rol de Acceso</label>
                   <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-blue-100 font-black text-slate-800 appearance-none">
                     <option value="user">Visualizador</option>
                     <option value="admin">Administrador</option>
                   </select>
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block px-1">Email</label>
                   <input type="email" placeholder="email@neumaticospons.com" value={userFormData.email || ''} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 outline-none focus:ring-4 focus:ring-blue-100 font-bold" />
                 </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 block font-bold text-slate-300">Asignación de Puestos:</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {positions.map(p => (
                    <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border ${userFormData.position_ids.includes(p.id) ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-blue-300'}`}>
                      <input type="checkbox" className="hidden" checked={userFormData.position_ids.includes(p.id)} onChange={e => {
                        const ids = e.target.checked ? [...userFormData.position_ids, p.id] : userFormData.position_ids.filter(id => id !== p.id);
                        setUserFormData({...userFormData, position_ids: ids});
                      }} />
                      <span className="text-[10px] font-black uppercase leading-none">{p.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-10 flex gap-3">
              <button type="button" onClick={() => setShowUserModal(false)} className="flex-1 px-4 py-4 text-[10px] font-black uppercase text-slate-400 hover:bg-slate-100 rounded-2xl transition-all">Cancelar</button>
              <button type="submit" className="flex-[2] px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl shadow-slate-200 active:scale-95 transition-all">Sincronizar Datos</button>
            </div>
          </form>
        </div>
      )}

      {/* OTHER MODALS (Simplified consistently) */}
      {showPosModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
          <form onSubmit={handlePosSave} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-200 animate-in zoom-in-95 duration-200">
             <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic">Configurar Puesto</h3>
             <input required placeholder="Nombre del Área" value={posFormData.name} onChange={e => setPosFormData({...posFormData, name: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-indigo-100 outline-none font-black text-slate-700" />
             <div className="flex gap-2 mt-8">
               <button type="button" onClick={() => setShowPosModal(false)} className="flex-1 p-4 rounded-2xl font-black text-[10px] uppercase text-slate-400">Cerrar</button>
               <button type="submit" className="flex-1 bg-indigo-600 text-white p-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-indigo-100">Guardar</button>
             </div>
          </form>
        </div>
      )}

      {showTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
          <form onSubmit={handleTypeSave} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm border border-slate-200 animate-in zoom-in-95 duration-200">
             <h3 className="text-xl font-black text-slate-800 mb-6 uppercase italic">Concepto de Reporte</h3>
             <input required placeholder="Ej: Daily, Inventario..." value={typeFormData.name} onChange={e => setTypeFormData({...typeFormData, name: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-purple-100 outline-none font-black text-slate-700 mb-4" />
             <textarea placeholder="Descripción del reporte" value={typeFormData.description || ''} onChange={e => setTypeFormData({...typeFormData, description: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-purple-100 outline-none font-bold text-slate-500 h-24 text-xs" />
             <div className="flex gap-2 mt-8">
               <button type="button" onClick={() => setShowTypeModal(false)} className="flex-1 p-4 rounded-2xl font-black text-[10px] uppercase text-slate-400">Cerrar</button>
               <button type="submit" className="flex-1 bg-purple-600 text-white p-4 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-purple-100">Guardar</button>
             </div>
          </form>
        </div>
      )}

      {showLinkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 z-[100]">
          <form onSubmit={handleLinkSave} className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-xl border border-slate-200 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center mb-8">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight uppercase italic">Vincular Iframe</h3>
               <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Filter size={20} /></div>
             </div>
             <div className="grid grid-cols-2 gap-4 mb-4">
                 <div>
                   <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 block">Para el Puesto:</label>
                   <select required value={linkFormData.position_id} onChange={e => setLinkFormData({...linkFormData, position_id: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 font-black text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100">
                     <option value="">SELECCIONAR PUESTO</option>
                     {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                   </select>
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 block">Tipo de Reporte:</label>
                   <select required value={linkFormData.dashboard_type_id} onChange={e => setLinkFormData({...linkFormData, dashboard_type_id: e.target.value})} className="w-full border border-slate-200 p-4 rounded-2xl bg-slate-50 font-black text-slate-700 outline-none focus:ring-4 focus:ring-emerald-100">
                     <option value="">SELECCIONAR CONCEPTO</option>
                     {dashboardTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                 </div>
             </div>
             <div>
               <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1 block">URL Iframe (Power BI Embed):</label>
               <textarea required placeholder="Pegue aquí el enlace completo del iframe..." value={linkFormData.url} onChange={e => setLinkFormData({...linkFormData, url: e.target.value})} className="w-full border border-slate-200 p-5 rounded-2xl bg-slate-50 font-mono text-[10px] text-slate-400 focus:ring-4 focus:ring-emerald-100 shadow-inner h-40 outline-none" />
             </div>
             <div className="flex gap-3 mt-10">
               <button type="button" onClick={() => setShowLinkModal(false)} className="flex-1 p-4 rounded-2xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-50">Cerrar</button>
               <button type="submit" className="flex-[2] bg-emerald-600 text-white p-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-100 active:scale-95 transition-all">Implementar Vínculo</button>
             </div>
          </form>
        </div>
      )}
    </div>
  );
}
