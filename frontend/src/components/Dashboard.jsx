import React, { useState, useEffect } from 'react';
import api from '../api';
import AdminPanel from './AdminPanel';

export default function Dashboard({ user, onLogout }) {
  const [dashboards, setDashboards] = useState([]);
  const [activeDashboard, setActiveDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMonitoring, setShowMonitoring] = useState(false);
  
  // States for Password Change
  const [showChangePass, setShowChangePass] = useState(false);
  const [passData, setPassData] = useState({ current: '', new: '', confirm: '' });
  const [passStatus, setPassStatus] = useState({ type: '', msg: '' });

  // State for Obfuscated URL
  const [obsUrl, setObsUrl] = useState('');

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        const res = await api.get('/dashboard');
        const list = res.data.dashboards || [];
        setDashboards(list);
        if (list.length > 0 && !activeDashboard) {
           setActiveDashboard(list[0]);
        }
      } catch (err) {
        console.error("Error fetching dashboards", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (user.role === 'admin') {
      setLoading(false);
      setShowMonitoring(true);
      fetchDashboards();
    } else {
      fetchDashboards();
    }
  }, [user]);

  // Effect to handle "Obfuscated" URL loading
  useEffect(() => {
    setObsUrl(''); // Clear first
    if (activeDashboard?.dashboard_url) {
      const timer = setTimeout(() => {
        // We set it after a small delay to confuse simple scrapers
        setObsUrl(activeDashboard.dashboard_url);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeDashboard]);

  // NEW: Intelligent Heartbeat (Visibility & Idle Detection)
  useEffect(() => {
    let lastActive = Date.now();
    const handleActivity = () => { lastActive = Date.now(); };
    
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    const interval = setInterval(() => {
      const isVisible = document.visibilityState === 'visible';
      const isIdle = (Date.now() - lastActive) > 300000; // 5 minutes inactivity limit
      
      if (isVisible && !isIdle && !showMonitoring && activeDashboard) {
        api.post('/logs/heartbeat', { dashboard_url: activeDashboard.dashboard_url }).catch(() => {});
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [showMonitoring, activeDashboard]);

  const handleChangePass = async (e) => {
    e.preventDefault();
    if (passData.new !== passData.confirm) {
      return setPassStatus({ type: 'error', msg: 'Las contraseñas nuevas no coinciden' });
    }
    try {
      await api.put('/auth/change-password', { 
        currentPassword: passData.current, 
        newPassword: passData.new 
      });
      setPassStatus({ type: 'success', msg: 'Contraseña cambiada con éxito' });
      setTimeout(() => {
        setShowChangePass(false);
        setPassData({ current: '', new: '', confirm: '' });
        setPassStatus({ type: '', msg: '' });
      }, 2000);
    } catch (err) {
      setPassStatus({ type: 'error', msg: err.response?.data?.error || 'Error al cambiar contraseña' });
    }
  };

  const canSeeMonitoring = user.role === 'admin' || user.can_view_metrics;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Subtle Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white shadow-sm shrink-0 border-b">
        <div className="flex items-center gap-6">
          <img src="/assets/logo.png" alt="Logo" className="h-8 w-auto" onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
            {user.name} {activeDashboard && <span className="font-light text-slate-400 normal-case tracking-normal"> | {activeDashboard.dashboard_name}</span>}
          </h1>
          {canSeeMonitoring && (
            <div className="flex bg-gray-100 rounded-lg p-1">
               <button 
                onClick={() => setShowMonitoring(false)} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${!showMonitoring ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 Mi Tablero
               </button>
               <button 
                onClick={() => setShowMonitoring(true)} 
                className={`px-3 py-1 text-xs font-bold rounded-md transition ${showMonitoring ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 {user.role === 'admin' ? 'Administrar Portal' : 'Métricas y Análisis'}
               </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
           {user.position_name && <span className="hidden md:inline text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded border uppercase tracking-widest">{user.position_name}</span>}
           <button 
            onClick={() => setShowChangePass(true)}
            className="text-[10px] font-bold text-slate-500 hover:text-blue-600 transition"
           >
             🔑 Cambiar Clave
           </button>
           <button
            onClick={onLogout}
            className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-100 transition"
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden bg-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 font-medium italic animate-pulse">Cargando tablero...</div>
        ) : showMonitoring ? (
          <div className="h-full overflow-y-auto w-full bg-white">
            <AdminPanel token={localStorage.getItem('token')} user={user} />
          </div>
        ) : dashboards.length > 0 ? (
          <div className="flex flex-col h-full">
            {dashboards.length > 1 && (
              <div className="flex bg-white border-b overflow-x-auto no-scrollbar">
                {dashboards.map((db, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveDashboard(db);
                    }}
                    className={`px-6 py-3 text-xs font-bold transition-all relative font-mono tracking-tight uppercase whitespace-nowrap ${activeDashboard?.dashboard_url === db.dashboard_url ? 'text-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    {db.dashboard_name}
                    {activeDashboard?.dashboard_url === db.dashboard_url && (
                      <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>
                    )}
                  </button>
                ))}
              </div>
            )}
            <div className="flex-1 relative overflow-hidden bg-slate-200">
              {/* Iframe Shield: Transparent overlay to prevent easy direct interaction/cloning via context menu */}
              <div 
                className="absolute inset-x-0 top-0 h-10 z-20" 
                onContextMenu={(e) => e.preventDefault()}
              ></div>
              <iframe
                title="Portal Tableros"
                src={obsUrl}
                className="w-full h-full border-none transition-opacity duration-700"
                style={{ opacity: obsUrl ? 1 : 0 }}
                allowFullScreen={true}
              ></iframe>
              {/* Power BI Bottom Covers */}
              <div className="absolute bottom-0 left-0 w-[200px] h-[36px] bg-[#f3f2f1] z-10 pointer-events-none"></div>
              <div className="absolute bottom-0 right-0 w-[220px] h-[36px] bg-[#f3f2f1] z-10 pointer-events-none"></div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xl text-gray-400 font-light px-10 text-center">
            No tienes un tablero asignado para tu puesto actual.
          </div>
        )}
      </main>

      {/* Change Password Modal */}
      {showChangePass && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b bg-slate-50">
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Seguridad de la Cuenta</h2>
              <p className="text-xs text-slate-500 font-medium">Actualiza tu contraseña de acceso al portal.</p>
            </div>
            <form onSubmit={handleChangePass} className="p-6 space-y-4">
              {passStatus.msg && (
                <div className={`p-3 rounded-lg text-xs font-bold ${passStatus.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {passStatus.msg}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Contraseña Actual</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={passData.current}
                  onChange={e => setPassData({...passData, current: e.target.value})}
                />
              </div>
              <hr />
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Nueva Contraseña</label>
                <input 
                  type="password" 
                  required
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={passData.new}
                  onChange={e => setPassData({...passData, new: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1">Confirmar Nueva Contraseña</label>
                <input 
                   type="password" 
                   required
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                   value={passData.confirm}
                   onChange={e => setPassData({...passData, confirm: e.target.value})}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => { setShowChangePass(false); setPassStatus({type:'', msg:''}); }}
                  className="flex-1 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200 transition"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
