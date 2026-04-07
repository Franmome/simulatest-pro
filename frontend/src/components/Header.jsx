import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Header({ title, children, sideW, onMenuToggle, mobileMenuOpen }) {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const menuRef = useRef(null)

  const nombreCompleto = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Usuario'

  const avatarUrl = user?.user_metadata?.avatar_url || null

  const iniciales = nombreCompleto
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

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
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
      setLoggingOut(false)
    }
  }

  // Calcular el left del header: en móvil cuando el menú está abierto, left = 0; en escritorio usa sideW
  const getHeaderLeft = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return mobileMenuOpen ? '0' : '0'
    }
    return sideW
  }

  return (
    <header
      className="fixed top-0 right-0 z-40 glass-effect shadow-sm flex items-center justify-between px-4 md:px-6 py-3 transition-all duration-300"
      style={{ left: getHeaderLeft() }}
    >
      <div className="flex items-center gap-4 md:gap-8">
        {/* Botón hamburguesa para móvil */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="text-xl font-bold tracking-tight text-blue-700 font-headline">
          {title}
        </span>
        {children}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        {/* Barra de búsqueda: oculta en móvil */}
        <div className="relative hidden md:block">
          <input
            className="bg-surface-container-low border-none rounded-full py-2 px-10 text-sm focus:ring-2 focus:ring-primary w-56 transition-all"
            placeholder="Buscar simulacros..."
            type="text"
          />
          <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-lg">
            search
          </span>
        </div>

        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all">
          <span className="material-symbols-outlined">notifications</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(prev => !prev)}
            className="flex items-center gap-2 hover:opacity-90 transition-all active:scale-95"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={nombreCompleto}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20 shadow-sm" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-primary/20">
                {iniciales}
              </div>
            )}
            <span className="material-symbols-outlined text-slate-400 text-lg hidden sm:inline">
              {menuOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl py-2 border border-outline-variant/10 z-50 animate-fade-in">
              <div className="px-4 py-3 border-b border-surface-container-high flex items-center gap-3">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={nombreCompleto} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-bold text-xs">
                    {iniciales}
                  </div>
                )}
                <div className="overflow-hidden">
                  <p className="text-sm font-bold text-on-surface truncate">{nombreCompleto}</p>
                  <p className="text-xs text-on-surface-variant truncate">{user?.email}</p>
                </div>
              </div>

              <button onClick={() => { setMenuOpen(false); navigate('/perfil') }}
                className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">person</span>
                Mi perfil
              </button>
              <button onClick={() => { setMenuOpen(false); navigate('/planes') }}
                className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">workspace_premium</span>
                Mis planes
              </button>
              <button onClick={() => { setMenuOpen(false); navigate('/configuracion') }}
                className="w-full text-left px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low flex items-center gap-3 transition-colors">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">settings</span>
                Ajustes
              </button>

              <div className="border-t border-surface-container-high my-1" />

              <button onClick={handleLogout} disabled={loggingOut}
                className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-error-container/30 flex items-center gap-3 transition-colors disabled:opacity-50">
                <span className="material-symbols-outlined text-lg">logout</span>
                {loggingOut ? 'Cerrando...' : 'Cerrar sesión'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}