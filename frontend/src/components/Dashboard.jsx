import React, { useState, useEffect } from 'react';
import api from '../api';
import AdminPanel from './AdminPanel';

export default function Dashboard({ user, onLogout }) {
  const [dashboardUrl, setDashboardUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMonitoring, setShowMonitoring] = useState(false);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard');
        setDashboardUrl(res.data.dashboard_url);
      } catch (err) {
        console.error("Error fetching dashboard", err);
      } finally {
        setLoading(false);
      }
    };
    
    if (user.role === 'admin') {
      setLoading(false);
      setShowMonitoring(true);
    } else {
      fetchDashboard();
    }
  }, [user]);

  const canSeeMonitoring = user.role === 'admin' || user.position_name === 'Directorio';

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Subtle Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white shadow-sm shrink-0 border-b">
        <div className="flex items-center gap-6">
          <img src="/assets/logo.png" alt="Logo" className="h-8 w-auto" onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 className="text-lg font-bold text-slate-800">
            {user.name}
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
                 Administrar Portal
               </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-4">
           {user.position_name && <span className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded border uppercase tracking-widest">{user.position_name}</span>}
           {user.role === 'admin' && !user.position_name && <span className="text-xs font-bold text-blue-400 bg-blue-50 px-2 py-1 rounded border uppercase tracking-widest">Admin</span>}
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
        ) : dashboardUrl ? (
          <div className="relative w-full h-full overflow-hidden bg-slate-200">
            <iframe
              title="Power BI Dashboard"
              src={dashboardUrl}
              className="w-full h-full border-none"
              allowFullScreen={true}
            ></iframe>
            {/* Bloque para tapar la esquina inferior izquierda (Logo de Power BI) */}
            <div className="absolute bottom-0 left-0 w-[200px] h-[36px] bg-[#f3f2f1] z-10 pointer-events-none"></div>
            {/* Bloque para tapar la esquina inferior derecha (Iconos de redes/compartir) */}
            <div className="absolute bottom-0 right-0 w-[220px] h-[36px] bg-[#f3f2f1] z-10 pointer-events-none"></div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xl text-gray-400 font-light px-10 text-center">
            No tienes un tablero asignado para tu puesto actual.
          </div>
        )}
      </main>
    </div>
  );
}
