import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../context/LangContext'

const NAV_DEFS = [
  { icon: 'home',              labelKey: 'nav.dashboard',  path: '/dashboard' },
  { icon: 'assignment',        labelKey: 'nav.simulacros', path: '/catalogo'  },
  { icon: 'workspace_premium', labelKey: 'nav.plans',      path: '/planes'    },
  { icon: 'menu_book',         labelKey: 'nav.study',      path: '/estudio'   },
  { icon: 'leaderboard',       labelKey: 'nav.results',    path: '/perfil'    },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const isActive = (path) => location.pathname.startsWith(path)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-1 safe-area-inset-bottom">
      {NAV_DEFS.map(item => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
            isActive(item.path) ? 'text-primary' : 'text-slate-400'
          }`}
        >
          <span className="material-symbols-outlined text-[22px]"
            style={{ fontVariationSettings: isActive(item.path) ? "'FILL' 1" : "'FILL' 0" }}>
            {item.icon}
          </span>
          <span className="text-[9px] font-bold">{t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  )
}