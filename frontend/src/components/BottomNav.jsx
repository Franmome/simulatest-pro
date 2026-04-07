import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { icon: 'home',              label: 'Inicio',     path: '/dashboard' },
  { icon: 'assignment',        label: 'Simulacros', path: '/catalogo'  },
  { icon: 'workspace_premium', label: 'Planes',     path: '/planes'    },
  { icon: 'leaderboard',       label: 'Progreso',   path: '/perfil'    },
  { icon: 'menu_book',         label: 'Estudio',    path: '/estudio'   },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 safe-area-inset-bottom">
      {navItems.map(item => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
            isActive(item.path) ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}>
            {item.icon}
          </span>
          <span className="text-[9px] font-bold">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}