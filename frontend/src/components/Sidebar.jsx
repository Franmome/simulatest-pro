import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import APP from '../utils/app.config.js'

const NAV_DEFS = [
  { icon: 'home',              labelKey: 'nav.dashboard',  path: '/dashboard', hint: 'Vista principal'     },
  { icon: 'assignment',        labelKey: 'nav.simulacros', path: '/catalogo',  hint: 'Paquetes y pruebas'  },
  { icon: 'workspace_premium', labelKey: 'nav.plans',      path: '/planes',    hint: 'Suscripciones'       },
  { icon: 'leaderboard',       labelKey: 'nav.results',    path: '/perfil',    hint: 'Resultados y métricas' },
  { icon: 'menu_book',         labelKey: 'nav.study',      path: '/estudio',   hint: 'Material y recursos' },
]

function QuickPill({ children, active = false }) {
  return (
    <span
      className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-slate-200/70 text-slate-600'
      }`}
    >
      {children}
    </span>
  )
}

export default function Sidebar({ expanded, setExpanded }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { t } = useLang()
  const [loggingOut, setLoggingOut] = useState(false)

  const navItems = NAV_DEFS.map(d => ({ ...d, label: t(d.labelKey) }))

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

  const nombreUsuario =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario'

  const iniciales = useMemo(() => {
    return nombreUsuario
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [nombreUsuario])

  const avatarUrl = user?.user_metadata?.avatar_url || null
  const esAdmin = user?.role === 'admin'

  const currentItem = NAV_DEFS.find(item => isActive(item.path))

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className="fixed left-0 top-0 h-full z-50 bg-slate-50 border-r border-slate-200/60 flex flex-col py-4 overflow-hidden transition-all duration-300 ease-in-out shadow-sm"
      style={{ width: expanded ? '17rem' : '4.75rem' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-3.5 mb-5 flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/20 flex-shrink-0">
          <span
            className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
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

      {/* Usuario */}
      <div className={`mx-2.5 mb-4 rounded-2xl border border-slate-200/70 bg-white/70 transition-all duration-200 ${
        expanded ? 'p-3' : 'p-2'
      }`}>
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nombreUsuario}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/15"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {iniciales}
            </div>
          )}

          <div className={`overflow-hidden transition-all duration-200 ${expanded ? 'opacity-100 max-w-xs' : 'opacity-0 max-w-0'}`}>
            <p className="text-sm font-bold text-slate-800 truncate">{nombreUsuario}</p>
            <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>

        {expanded && (
          <div className="flex flex-wrap gap-2 mt-3">
            {currentItem && <QuickPill active>{t(currentItem.labelKey)}</QuickPill>}
            {esAdmin && <QuickPill>Admin</QuickPill>}
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-2">
        {navItems.map(item => {
          const active = isActive(item.path)

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              title={!expanded ? item.label : undefined}
              className={`flex items-start gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-left w-full ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
              }`}
            >
              <span
                className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {item.icon}
              </span>

              <div className={`min-w-0 transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                <p className="text-sm font-semibold whitespace-nowrap">{item.label}</p>
                <p className="text-[10px] whitespace-nowrap opacity-80">{item.hint}</p>
              </div>
            </button>
          )
        })}

        {/* Admin */}
        {esAdmin && (
          <button
            onClick={() => navigate('/admin')}
            title={!expanded ? 'Panel Admin' : undefined}
            className={`flex items-start gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-left w-full mt-1 ${
              isActive('/admin')
                ? 'bg-primary/10 text-primary'
                : 'text-primary/70 hover:bg-primary/10 hover:text-primary'
            }`}
          >
            <span
              className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5"
              style={{ fontVariationSettings: isActive('/admin') ? "'FILL' 1" : "'FILL' 0" }}
            >
              admin_panel_settings
            </span>

            <div className={`min-w-0 transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
              <p className="text-sm font-bold whitespace-nowrap">Panel Admin</p>
              <p className="text-[10px] whitespace-nowrap opacity-80">Gestión completa</p>
            </div>
          </button>
        )}
      </nav>

      {/* Footer */}
      <div className="flex flex-col gap-1 px-2 pt-3 border-t border-slate-200/60">
        <button
          onClick={() => navigate('/configuracion')}
          title={!expanded ? 'Ajustes' : undefined}
          className={`flex items-start gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-left w-full ${
            isActive('/configuracion')
              ? 'bg-primary/10 text-primary'
              : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
          }`}
        >
          <span className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5">settings</span>

          <div className={`min-w-0 transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <p className="text-sm font-semibold whitespace-nowrap">{t('nav.config')}</p>
            <p className="text-[10px] whitespace-nowrap opacity-80">Cuenta y preferencias</p>
          </div>
        </button>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          title={!expanded ? 'Cerrar sesión' : undefined}
          className="flex items-start gap-3 px-3 py-3 rounded-2xl transition-all duration-150 text-left w-full text-slate-600 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-xl flex-shrink-0 mt-0.5">logout</span>

          <div className={`min-w-0 transition-all duration-200 ${expanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
            <p className="text-sm font-semibold whitespace-nowrap">
              {loggingOut ? t('common.loading') : t('nav.logout')}
            </p>
            <p className="text-[10px] whitespace-nowrap opacity-80">
              Salir de la cuenta actual
            </p>
          </div>
        </button>
      </div>
    </aside>
  )
}