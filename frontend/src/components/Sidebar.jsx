import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config.js'

const navItems = [
  { icon: 'home',              label: 'Inicio',      path: '/dashboard' },
  { icon: 'assignment',        label: 'Simulacros',  path: '/catalogo'  },
  { icon: 'workspace_premium', label: 'Planes',      path: '/planes'    },
  { icon: 'leaderboard',       label: 'Mi progreso', path: '/perfil'    },
  { icon: 'menu_book',         label: 'Estudio',     path: '/estudio'   },
]

export default function Sidebar({ expanded, setExpanded }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  const isActive = (path) => location.pathname.startsWith(path)

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
      setLoggingOut(false)
    }
  }

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="fixed left-0 top-0 h-full z-50 bg-slate-50 border-r border-slate-200/60 flex flex-col py-4 overflow-hidden transition-all duration-300 ease-in-out"
      style={{ width: expanded ? '16rem' : '4.5rem' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3.5 mb-6 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg flex-shrink-0">
          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            {APP.icon}
          </span>
        </div>
        <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'}`}>
          <h2 className="text-base font-extrabold text-blue-800 leading-tight font-headline whitespace-nowrap">
            {APP.name}
          </h2>
          <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold whitespace-nowrap">
            Mentor Digital
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-0.5 px-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={!expanded ? item.label : undefined}
            className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 text-left w-full
              ${isActive(item.path)
                ? 'bg-primary/10 text-primary'
                : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
          >
            <span
              className="material-symbols-outlined text-xl flex-shrink-0"
              style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}
            >
              {item.icon}
            </span>
            <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              {item.label}
            </span>
          </button>
        ))}

        {/* Admin */}
        {user?.role === 'admin' && (
          <button
            onClick={() => navigate('/admin')}
            title={!expanded ? 'Panel Admin' : undefined}
            className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 text-left w-full mt-1
              ${isActive('/admin')
                ? 'bg-primary/10 text-primary'
                : 'text-primary/60 hover:bg-primary/10 hover:text-primary'
              }`}
          >
            <span className="material-symbols-outlined text-xl flex-shrink-0"
              style={{ fontVariationSettings: isActive('/admin') ? "'FILL' 1" : "'FILL' 0" }}>
              admin_panel_settings
            </span>
            <span className={`text-sm font-bold whitespace-nowrap transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              Panel Admin
            </span>
          </button>
        )}
      </nav>

      {/* Inferior */}
      <div className="flex flex-col gap-0.5 px-2 pt-3 border-t border-slate-200/60">
        <button
          onClick={() => navigate('/configuracion')}
          title={!expanded ? 'Ajustes' : undefined}
          className={`flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 text-left w-full
            ${isActive('/configuracion')
              ? 'bg-primary/10 text-primary'
              : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
            }`}
        >
          <span className="material-symbols-outlined text-xl flex-shrink-0">settings</span>
          <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            Ajustes
          </span>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={!expanded ? 'Cerrar sesión' : undefined}
          className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all duration-150 text-left w-full text-slate-600 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl flex-shrink-0">logout</span>
          <span className={`text-sm font-semibold whitespace-nowrap transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            {loggingOut ? 'Cerrando...' : 'Cerrar sesión'}
          </span>
        </button>
      </div>
    </aside>
  )
}