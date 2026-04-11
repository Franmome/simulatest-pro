import { useState, useMemo } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { to: '/admin',              icon: 'dashboard',      label: 'Dashboard',         hint: 'Resumen general' },
  { to: '/admin/evaluaciones', icon: 'inventory_2',    label: 'Evaluaciones',      hint: 'Simulacros base' },
  { to: '/admin/paquetes',     icon: 'package_2',      label: 'Paquetes',          hint: 'Catálogo comercial' },
  { to: '/admin/usuarios',     icon: 'group',          label: 'Usuarios',          hint: 'Accesos y roles' },
  { to: '/admin/tesoreria',    icon: 'payments',       label: 'Tesorería',         hint: 'Ventas y cupones' },
  { to: '/admin/editor',       icon: 'edit_note',      label: 'Editor de Página',  hint: 'Textos visibles' },
  { to: '/admin/errores',      icon: 'report_problem', label: 'Errores del Sistema', hint: 'Monitoreo técnico' },
]

function QuickChip({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-surface-container text-on-surface-variant',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary-container/40 text-secondary',
  }

  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${tones[tone] || tones.default}`}>
      {children}
    </span>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sideOpen, setSideOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  const nombreAdmin =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Admin'

  const iniciales = nombreAdmin
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  const avatarUrl = user?.user_metadata?.avatar_url || null

  const rutaActual = useMemo(() => {
    return navItems.find(item => isActive(item.to))
  }, [location.pathname])

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-outline-variant/20">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
          <span
            className="material-symbols-outlined text-on-primary text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            school
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-extrabold text-primary leading-none truncate">
            SimulaTest Pro
          </p>
          <p className="text-[10px] text-on-surface-variant mt-1 uppercase tracking-widest font-bold">
            Consola Admin
          </p>
        </div>
      </div>

      {/* Info admin */}
      <div className="mx-3 mt-4 mb-2 p-3 rounded-2xl bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nombreAdmin}
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold flex-shrink-0">
              {iniciales}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-on-surface truncate">{nombreAdmin}</p>
            <p className="text-[10px] text-primary font-semibold truncate">{user?.email}</p>
          </div>

          <span className="w-2 h-2 bg-secondary rounded-full flex-shrink-0" title="En línea" />
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          <QuickChip tone="primary">Administrador</QuickChip>
          <QuickChip tone="secondary">En línea</QuickChip>
        </div>
      </div>

      {/* Guía mini */}
      <div className="mx-3 mb-2 p-3 rounded-2xl bg-surface-container border border-outline-variant/15">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          Flujo recomendado
        </p>
        <div className="space-y-1.5 text-[11px] text-on-surface-variant leading-relaxed">
          <p>1. Crea evaluación</p>
          <p>2. Agrega niveles y preguntas</p>
          <p>3. Configura versiones y precios</p>
          <p>4. Sube material y publica</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon, label, hint }) => {
          const active = isActive(to)

          return (
            <Link
              key={to}
              to={to}
              onClick={() => setSideOpen(false)}
              className={`group flex items-start gap-3 px-3 py-3 rounded-2xl text-sm transition-all ${
                active
                  ? 'bg-primary text-on-primary shadow-sm shadow-primary/20'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {icon}
              </span>

              <div className="min-w-0">
                <p className={`font-semibold truncate ${active ? 'text-on-primary' : ''}`}>
                  {label}
                </p>
                <p className={`text-[10px] truncate ${
                  active ? 'text-primary-fixed' : 'text-on-surface-variant'
                }`}>
                  {hint}
                </p>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 pb-4 pt-3 border-t border-outline-variant/20 space-y-2">
        <button
          onClick={() => {
            setSideOpen(false)
            navigate('/dashboard')
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-secondary bg-secondary/10 hover:bg-secondary/20 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          <span>Modo normal</span>
        </button>

        <button
          onClick={() => {
            setSideOpen(false)
            navigate('/admin/evaluaciones/nueva')
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          <span>+ Nuevo Paquete</span>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-background text-on-surface font-body">
      {/* Overlay mobile */}
      {sideOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSideOpen(false)}
        />
      )}

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-72 flex-col z-40 border-r border-outline-variant/20 bg-surface-container-lowest">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-80 max-w-[88vw] flex flex-col z-40 border-r border-outline-variant/20 bg-surface-container-lowest transition-transform duration-300 ${
          sideOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col lg:ml-72 min-w-0">
        {/* Top header mobile */}
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-surface-container-lowest border-b border-outline-variant/20">
          <button
            onClick={() => setSideOpen(true)}
            className="p-2 rounded-lg hover:bg-surface-container text-on-surface-variant transition-all"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span
                className="material-symbols-outlined text-on-primary text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                school
              </span>
            </div>

            <div className="min-w-0">
              <span className="text-sm font-bold text-primary truncate block">Consola Admin</span>
              <span className="text-[10px] text-on-surface-variant truncate block">
                {rutaActual?.label || 'Panel'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-secondary/10 text-secondary hover:bg-secondary/20 transition-all"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span className="hidden sm:inline">Modo normal</span>
            </button>

            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={nombreAdmin}
                className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold">
                {iniciales}
              </div>
            )}
          </div>
        </header>

        {/* Header desktop */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center justify-between px-8 bg-background/85 backdrop-blur-xl border-b border-outline-variant/10">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Área actual
            </p>
            <h2 className="text-sm font-bold text-on-surface truncate">
              {rutaActual?.label || 'Panel Admin'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/evaluaciones/nueva')}
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
            >
              Nuevo paquete
            </button>

            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 rounded-full border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all"
            >
              Modo normal
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 min-h-screen bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  )
}