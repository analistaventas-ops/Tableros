import React, { useState, useEffect } from 'react';
import api from '../api';

export default function AdminPanel({ token, user: currentUser }) {
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [activeTab, setActiveTab] = useState(currentUser.role === 'admin' ? 'users' : 'logs');
  
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({ username: '', password: '', name: '', email: '', role: 'user', position_id: '' });
  const [showPassword, setShowPassword] = useState({});
 
  const [showPosModal, setShowPosModal] = useState(false);
  const [editingPos, setEditingPos] = useState(null);
  const [posFormData, setPosFormData] = useState({ name: '', dashboard_url: '' });

  const fetchData = async () => {
    try {
      if (currentUser.role === 'admin') {
        const [uRes, pRes, lRes, sRes] = await Promise.all([
          api.get('/api/users'),
          api.get('/api/positions'),
          api.get('/api/logs'),
          api.get('/api/stats')
        ]);
        setUsers(uRes.data);
        setPositions(pRes.data);
        setLogs(lRes.data);
        setStats(sRes.data);
      } else {
        const [lRes, sRes] = await Promise.all([
          api.get('/api/logs'),
          api.get('/api/stats')
        ]);
        setLogs(lRes.data);
        setStats(sRes.data);
      }
    } catch (err) { 
      console.error("Fetch error:", err); 
      alert("Error al cargar datos del servidor: " + (err.response?.data?.error || err.message));
    }
  };

  useEffect(() => { fetchData() }, [token]);

  const handleUserModal = (u = null) => {
    setEditingUser(u);
    setUserFormData(u ? { username: u.username, password: '', name: u.name, email: u.email || '', role: u.role, position_id: u.position_id || '' } : { username: '', password: '', name: '', email: '', role: 'user', position_id: '' });
    setShowUserModal(true);
  };

  const handleUserSave = async (e) => {
    e.preventDefault();
    try {
      const data = { ...userFormData, position_id: userFormData.position_id || null };
      if (editingUser) await api.put(`/api/users/${editingUser.id}`, data);
      else await api.post('/api/users', data);
      setShowUserModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handleSendCredentials = async (id) => {
    try {
      const res = await api.post(`/api/users/send-credentials/${id}`, {});
      alert(res.data.message);
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handleUserDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este usuario?")) return;
    try { await api.delete(`/api/users/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handlePosModal = (p = null) => {
    setEditingPos(p);
    setPosFormData(p ? { name: p.name, dashboard_url: p.dashboard_url } : { name: '', dashboard_url: '' });
    setShowPosModal(true);
  };

  const handlePosSave = async (e) => {
    e.preventDefault();
    try {
      if (editingPos) await api.put(`/api/positions/${editingPos.id}`, posFormData);
      else await api.post('/api/positions', posFormData);
      setShowPosModal(false);
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  const handlePosDel = async (id) => {
    if (!window.confirm("¿Seguro que quieres eliminar este puesto? No debe tener usuarios asignados.")) return;
    try { await api.delete(`/api/positions/${id}`); fetchData(); } catch (err) { alert(err.response?.data?.error || "Error"); }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Panel de Gestión</h2>
          <p className="text-gray-500 text-sm">Administración de usuarios, puestos y control de accesos.</p>
        </div>
        <div className="flex bg-white rounded-lg shadow-sm border p-1">
          {currentUser.role === 'admin' && (
            <>
              <button onClick={() => setActiveTab('users')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'users' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>Usuarios</button>
              <button onClick={() => setActiveTab('positions')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'positions' ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>Puestos</button>
            </>
          )}
          <button onClick={() => setActiveTab('logs')} className={`px-4 py-1.5 text-sm font-medium rounded-md transition ${activeTab === 'logs' ? 'bg-gray-800 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>Seguimiento</button>
        </div>
      </div>

      {activeTab === 'users' && currentUser.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
           <div className="flex justify-between items-center p-4 border-b bg-gray-50/50">
            <h3 className="font-bold text-gray-700">Listado de Usuarios</h3>
            <button onClick={() => handleUserModal()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition">
              <span>+ Nuevo Usuario</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wider font-semibold border-b">
                   <th className="p-4">Usuario / Email</th>
                   <th className="p-4">Nombre Completo</th>
                   <th className="p-4">Puesto Asignado</th>
                   <th className="p-4">Password</th>
                   <th className="p-4 text-right">Acciones</th>
                 </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/80 transition">
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{u.username}</div>
                      <div className="text-gray-400 text-xs">{u.email || 'Sin email'}</div>
                    </td>
                    <td className="p-4 text-gray-600">{u.name}</td>
                    <td className="p-4">
                      {u.position_name ? (
                        <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium border border-blue-100">{u.position_name}</span>
                      ) : (
                        <span className="text-gray-400 italic">No asignado</span>
                      )}
                    </td>
                    <td className="p-4 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${showPassword[u.id] ? 'text-gray-800' : 'text-gray-300 contrast-0'}`}>
                          {showPassword[u.id] ? u.password_plain : '••••••••'}
                        </span>
                        <button 
                          onClick={() => {
                            setShowPassword(prev => ({...prev, [u.id]: !prev[u.id]}));
                            if (!showPassword[u.id]) {
                              setTimeout(() => {
                                setShowPassword(prev => ({...prev, [u.id]: false}));
                              }, 10000);
                            }
                          }}
                          className="text-[10px] text-blue-500 hover:underline font-bold"
                        >
                          {showPassword[u.id] ? 'Ocultar' : 'Ver'}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => handleSendCredentials(u.id)} className="text-green-600 hover:text-green-700 font-medium" title="Enviar credenciales por mail">Mail</button>
                      <button onClick={() => handleUserModal(u)} className="text-blue-600 hover:text-blue-700 font-medium">Editar</button>
                      <button onClick={() => handleUserDel(u.id)} className="text-red-600 hover:text-red-700 font-medium">Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'positions' && currentUser.role === 'admin' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
           <div className="flex justify-between items-center p-4 border-b bg-gray-50/50">
            <h3 className="font-bold text-gray-700">Puestos y Dashboards</h3>
            <button onClick={() => handlePosModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition">Nuevo Puesto</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                 <tr className="bg-gray-50 text-gray-400 text-xs uppercase border-b">
                   <th className="p-4">Puesto</th>
                   <th className="p-4">URL del Tablero</th>
                   <th className="p-4 text-right">Acciones</th>
                 </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {positions.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 font-bold text-gray-800">{p.name}</td>
                    <td className="p-4 text-xs font-mono text-gray-400 break-all max-w-md">{p.dashboard_url}</td>
                    <td className="p-4 text-right space-x-3">
                      <button onClick={() => handlePosModal(p)} className="text-blue-600 hover:text-blue-700 font-medium">Editar</button>
                      <button onClick={() => handlePosDel(p.id)} className="text-red-600 hover:text-red-700 font-medium">Borrar</button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <h3 className="font-bold text-gray-700 mb-4">Uso por Usuario (Top 10)</h3>
              <div className="space-y-4">
                {stats.map((s, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-gray-400">{s.count} accesos</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, (s.count / (stats[0]?.count || 1)) * 100)}%` }}></div>
                    </div>
                  </div>
                ))}
                {stats.length === 0 && <p className="text-gray-400 text-sm italic">Sin datos de uso aún.</p>}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6 overflow-hidden flex flex-col">
              <h3 className="font-bold text-gray-700 mb-4">Última Actividad</h3>
              <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                {logs.map(l => (
                  <div key={l.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold shrink-0">{l.name.substring(0,1)}</div>
                    <div>
                      <div className="text-sm font-semibold">{l.name}</div>
                      <div className="text-xs text-gray-500">{l.position_name || 'Sin puesto'} • {new Date(l.login_time).toLocaleString('es-AR')}</div>
                    </div>
                  </div>
                ))}
                {logs.length === 0 && <p className="text-gray-400 text-sm italic">No hay logs registrados.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleUserSave} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm border">
            <h3 className="text-xl font-bold mb-6 text-gray-800">{editingUser ? 'Actualizar Usuario' : 'Nuevo Integrante'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Usuario de acceso</label>
                <input required placeholder="ej. mpons" value={userFormData.username} onChange={e => setUserFormData({...userFormData, username: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="relative">
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Contraseña</label>
                <input 
                  type={showPassword.modal ? "text" : "password"}
                  placeholder={editingUser ? "Dejar vacío para no cambiar" : "Contraseña segura"} 
                  required={!editingUser} 
                  value={userFormData.password} 
                  onChange={e => setUserFormData({...userFormData, password: e.target.value})} 
                  className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                />
                <button type="button" onClick={() => setShowPassword({modal: !showPassword.modal})} className="absolute right-3 bottom-2.5 text-gray-400 text-xs hover:text-gray-600 font-bold uppercase tracking-tighter">{showPassword.modal ? 'Ocultar' : 'Ver'}</button>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Email (Recuperación)</label>
                <input type="email" placeholder="email@neumaticospons.com" value={userFormData.email} onChange={e => setUserFormData({...userFormData, email: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre Completo</label>
                <input required placeholder="Nombre y Apellido" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Privilegios</label>
                  <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="user">Colaborador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Puesto</label>
                  <select value={userFormData.position_id} onChange={e => setUserFormData({...userFormData, position_id: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" disabled={userFormData.role==='admin'}>
                    <option value="">- Seleccione -</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setShowUserModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">Cancelar</button>
              <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition">Guardar Usuario</button>
            </div>
          </form>
        </div>
      )}

      {showPosModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handlePosSave} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border">
            <h3 className="text-xl font-bold mb-6 text-gray-800">{editingPos ? 'Editar Configuración Web' : 'Nuevo Puesto'}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Nombre del Puesto</label>
                <input required placeholder="ej. Asesor Comercial" value={posFormData.name} onChange={e => setPosFormData({...posFormData, name: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase mb-1 block">Enlace de Visualización (iFrame URL)</label>
                <textarea required placeholder="Pegue la URL completa del link público de PowerBI..." value={posFormData.dashboard_url} onChange={e => setPosFormData({...posFormData, dashboard_url: e.target.value})} className="w-full border p-2.5 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-32 font-mono text-xs text-gray-500 leading-relaxed" />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => setShowPosModal(false)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition">Cerrar</button>
              <button type="submit" className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition">Vincular Tablero</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
