import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/admin',              icon: 'dashboard',      label: 'Dashboard'        },
  { to: '/admin/evaluaciones', icon: 'inventory_2',    label: 'Evaluaciones'     },
  { to: '/admin/usuarios',     icon: 'group',          label: 'Usuarios'         },
  { to: '/admin/tesoreria',    icon: 'payments',       label: 'Tesorería'        },
  { to: '/admin/editor',       icon: 'edit_note',      label: 'Editor de Página' },
  { to: '/admin/errores',      icon: 'report_problem', label: 'Errores'          },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => { await logout(); navigate('/login') }
  const isActive = (path) => path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-2 mb-10">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-on-primary">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
        </div>
        <div>
          <h2 className="text-base font-extrabold text-primary font-headline leading-none">Academia Pro</h2>
          <p className="text-[11px] text-on-surface-variant mt-0.5">Consola Admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map(({ to, icon, label }) => (
          <Link key={to} to={to} onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all
              ${isActive(to) ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container hover:translate-x-1'}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-outline-variant/20 space-y-1">
        <button onClick={() => { navigate('/admin/evaluaciones/nueva'); setSidebarOpen(false) }}
          className="w-full mb-3 bg-primary text-on-primary py-2.5 rounded-full font-bold text-xs uppercase tracking-wider hover:bg-primary/90 active:scale-95 transition-all">
          + Nuevo Paquete
        </button>
        <button onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 text-error w-full hover:bg-error/10 rounded-lg transition-all text-sm">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body">

      {/* Sidebar desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 flex-col p-4 z-40 border-r border-outline-variant/20 bg-surface-container-lowest">
        <SidebarContent />
      </aside>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full flex flex-col p-4 bg-surface-container-lowest border-r border-outline-variant/20">
            <SidebarContent />
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <main className="md:ml-64 flex-1 min-h-screen bg-background">
        {/* Header móvil admin */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 border-b border-outline-variant/20 bg-surface-container-lowest sticky top-0 z-40">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-surface-container">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-bold text-primary">Consola Admin</span>
        </div>
        <Outlet />
      </main>
    </div>
  )
}