import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function QuickPill({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-surface-container text-on-surface-variant',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary-container/40 text-secondary',
  }

  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${tones[tone] || tones.default}`}>
      {children}
    </span>
  )
}

export default function Header({ title, children, expanded, onMenuClick }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef(null)

  const nombreCompleto =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario'

  const avatarUrl = user?.user_metadata?.avatar_url || null

  const iniciales = useMemo(() => {
    return nombreCompleto
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }, [nombreCompleto])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [menuOpen])

  const handleLogout = async () => {
    setLoggingOut(true)
    setMenuOpen(false)

    try {
      await logout()
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
      setLoggingOut(false)
    }
  }

  const leftClass = expanded ? 'md:left-68' : 'md:left-[4.75rem]'

  return (
    <header
      className={`fixed top-0 right-0 left-0 z-40 bg-background/85 backdrop-blur-xl border-b border-outline-variant/10 shadow-sm flex items-center justify-between px-4 md:px-6 py-3 transition-all duration-300 ${leftClass}`}
    >
      {/* Izquierda */}
      <div className="flex items-center gap-3 md:gap-6 min-w-0">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-all"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hidden sm:block">
            Panel principal
          </p>
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-primary font-headline truncate">
            {title}
          </h1>
        </div>

        {children && (
          <div className="hidden lg:flex items-center gap-2 min-w-0">
            {children}
          </div>
        )}
      </div>

      {/* Derecha */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Búsqueda */}
        <div className="relative hidden md:block">
          <input
            className="bg-surface-container-low border border-outline-variant/10 rounded-full py-2 px-10 text-sm focus:ring-2 focus:ring-primary/20 outline-none w-56 xl:w-64 transition-all"
            placeholder="Buscar simulacros..."
            type="text"
          />
          <span className="material-symbols-outlined absolute left-3 top-2 text-on-surface-variant text-lg">
            search
          </span>
        </div>

        {/* Notificaciones */}
        <button className="relative p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-all">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-error" />
        </button>

        {/* Usuario */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="flex items-center gap-2 hover:opacity-90 transition-all active:scale-95 bg-surface-container-lowest border border-outline-variant/10 rounded-full pl-1.5 pr-2 py-1.5"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={nombreCompleto}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20 shadow-sm"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-primary/20">
                {iniciales}
              </div>
            )}

            <div className="hidden lg:block text-left min-w-0 max-w-[140px]">
              <p className="text-sm font-bold text-on-surface truncate">{nombreCompleto}</p>
              <p className="text-[10px] text-on-surface-variant truncate">
                {user?.email}
              </p>
            </div>

            <span className="material-symbols-outlined text-on-surface-variant text-lg hidden sm:inline">
              {menuOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-14 w-72 bg-surface-container-lowest rounded-3xl shadow-2xl py-2 border border-outline-variant/10 z-50 animate-fade-in overflow-hidden">
              {/* Header usuario */}
              <div className="px-4 py-4 border-b border-outline-variant/10 flex items-center gap-3">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={nombreCompleto}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-xs">
                    {iniciales}
                  </div>
                )}

                <div className="overflow-hidden flex-1">
                  <p className="text-sm font-bold text-on-surface truncate">{nombreCompleto}</p>
                  <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>

                  <div className="flex gap-2 mt-2">
                    <QuickPill tone="primary">Cuenta activa</QuickPill>
                    <QuickPill tone="secondary">En línea</QuickPill>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/perfil')
                }}
                className="w-full text-left px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-on-surface-variant">person</span>
                <div>
                  <p className="font-semibold">Mi perfil</p>
                  <p className="text-[10px] text-on-surface-variant">Ver progreso y resultados</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/planes')
                }}
                className="w-full text-left px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-on-surface-variant">workspace_premium</span>
                <div>
                  <p className="font-semibold">Mis planes</p>
                  <p className="text-[10px] text-on-surface-variant">Suscripciones y acceso premium</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setMenuOpen(false)
                  navigate('/configuracion')
                }}
                className="w-full text-left px-4 py-3 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-on-surface-variant">settings</span>
                <div>
                  <p className="font-semibold">Ajustes</p>
                  <p className="text-[10px] text-on-surface-variant">Preferencias y configuración</p>
                </div>
              </button>

              <div className="border-t border-outline-variant/10 my-1" />

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full text-left px-4 py-3 text-sm text-error hover:bg-error-container/30 flex items-center gap-3 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
                <div>
                  <p className="font-semibold">{loggingOut ? 'Cerrando...' : 'Cerrar sesión'}</p>
                  <p className="text-[10px] opacity-80">Salir de esta cuenta</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}