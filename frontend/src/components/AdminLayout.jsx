import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/admin',               icon: 'dashboard',      label: 'Dashboard'          },
  { to: '/admin/evaluaciones',  icon: 'inventory_2',    label: 'Evaluaciones'       },
  { to: '/admin/usuarios',      icon: 'group',          label: 'Usuarios'           },
  { to: '/admin/tesoreria',     icon: 'payments',       label: 'Tesorería'          },
  { to: '/admin/editor',        icon: 'edit_note',      label: 'Editor de Página'   },
  { to: '/admin/errores',       icon: 'report_problem', label: 'Errores del Sistema'},
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate         = useNavigate()
  const location         = useLocation()
  const [sideOpen, setSideOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  const nombreAdmin = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Admin'
  const iniciales = nombreAdmin.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url || null

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-5 border-b border-outline-variant/20">
        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-on-primary text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-primary leading-none truncate">SimulaTest Pro</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">Consola Admin</p>
        </div>
      </div>

      {/* Info del admin */}
      <div className="mx-3 mt-4 mb-2 p-3 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-3">
        {avatarUrl ? (
          <img src={avatarUrl} alt={nombreAdmin}
               className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center
                          text-on-primary text-xs font-bold flex-shrink-0">
            {iniciales}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-on-surface truncate">{nombreAdmin}</p>
          <p className="text-[10px] text-primary font-semibold truncate">{user?.email}</p>
        </div>
        <span className="w-2 h-2 bg-secondary rounded-full flex-shrink-0" title="En línea" />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setSideOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
              ${isActive(to)
                ? 'bg-primary text-on-primary shadow-sm shadow-primary/20'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
          >
            <span className="material-symbols-outlined text-[20px] flex-shrink-0"
                  style={{ fontVariationSettings: isActive(to) ? "'FILL' 1" : "'FILL' 0" }}>
              {icon}
            </span>
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-4 pt-3 border-t border-outline-variant/20 space-y-1">

        {/* Botón volver al modo normal */}
        <button
          onClick={() => { setSideOpen(false); navigate('/dashboard') }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                     text-secondary bg-secondary/10 hover:bg-secondary/20 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span>Modo normal</span>
        </button>

        {/* Nuevo paquete */}
        <button
          onClick={() => { setSideOpen(false); navigate('/admin/evaluaciones/nueva') }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold
                     bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          <span>+ Nuevo Paquete</span>
        </button>

        {/* Cerrar sesión */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                     text-error hover:bg-error/10 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body">

      {/* ── Overlay mobile ── */}
      {sideOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* ── Sidebar desktop (fijo) ── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 flex-col z-40
                        border-r border-outline-variant/20 bg-surface-container-lowest">
        <SidebarContent />
      </aside>

      {/* ── Sidebar mobile (drawer) ── */}
      <aside className={`lg:hidden fixed left-0 top-0 h-full w-72 flex flex-col z-40
                         border-r border-outline-variant/20 bg-surface-container-lowest
                         transition-transform duration-300
                         ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col lg:ml-64 min-w-0">

        {/* ── Top header (mobile only) ── */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3
                           bg-surface-container-lowest border-b border-outline-variant/20">
          <button
            onClick={() => setSideOpen(true)}
            className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant transition-all"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-on-primary text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            </div>
            <span className="text-sm font-bold text-primary truncate">Consola Admin</span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                         bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="hidden sm:inline">Modo normal</span>
            </button>
            {avatarUrl ? (
              <img src={avatarUrl} alt={nombreAdmin}
                   className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center
                              text-on-primary text-xs font-bold">
                {iniciales}
              </div>
            )}
          </div>
        </header>

        {/* ── Contenido ── */}
        <main className="flex-1 min-h-screen bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}