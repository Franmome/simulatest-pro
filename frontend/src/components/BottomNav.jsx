import { useNavigate, useLocation } from 'react-router-dom'
import { useLang } from '../context/LangContext'
import { useAuth } from '../context/AuthContext'

const NAV_DEFS = [
  { icon: 'home',              labelKey: 'nav.dashboard',  path: '/dashboard' },
  { icon: 'assignment',        label: 'Paquetes',          path: '/catalogo',  adminOnly: true },
  { icon: 'manage_accounts',   label: 'Análisis',          path: '/analisis-perfil' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useLang()
  const { user } = useAuth()
  const esAdmin = user?.role === 'admin'
  const isActive = (path) => location.pathname.startsWith(path)

  const navItems = NAV_DEFS.filter(d => !d.adminOnly || esAdmin)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-1 safe-area-inset-bottom">
      {navItems.map(item => (
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
          <span className="text-[9px] font-bold">{item.label || t(item.labelKey)}</span>
        </button>
      ))}
    </nav>
  )
}