import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import APP from '../utils/app.config.js'

const navItems = [
  { icon: 'home',              label: 'Inicio',     path: '/dashboard' },
  { icon: 'assignment',        label: 'Simulacros', path: '/catalogo'  },
  { icon: 'workspace_premium', label: 'Planes',     path: '/planes'    },
  { icon: 'leaderboard',       label: 'Progreso',   path: '/perfil'    },
  { icon: 'menu_book',         label: 'Estudio',    path: '/estudio'   },
]

function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = (path) => location.pathname.startsWith(path)
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 flex justify-around items-center h-16">
      {navItems.map(item => (
        <button key={item.path} onClick={() => navigate(item.path)}
          className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${isActive(item.path) ? 'text-primary' : 'text-slate-400'}`}>
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

export default function Layout({ title, headerChildren }) {
  const [expanded, setExpanded] = useState(false)
  const sideW = expanded ? '16rem' : '4.5rem'

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="hidden md:block">
        <Sidebar expanded={expanded} setExpanded={setExpanded} />
      </div>

      <div className="flex-1 flex flex-col md:transition-all md:duration-300"
           style={{ marginLeft: typeof window !== 'undefined' && window.innerWidth >= 768 ? sideW : 0 }}>
        <Header title={title} sideW={sideW}>{headerChildren}</Header>

        <main className="flex-1 animate-fade-in pt-[4rem] pb-20 md:pb-0 md:pt-[4.5rem]">
          <Outlet />
        </main>

        <footer className="hidden md:flex border-t border-slate-100 bg-white py-3 px-6 justify-between items-center text-xs text-slate-500">
          <p>© {APP.year} {APP.name}. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a className="hover:text-blue-700 cursor-pointer">Privacidad</a>
            <a className="hover:text-blue-700 cursor-pointer">Términos</a>
            <a className="hover:text-blue-700 cursor-pointer">Soporte</a>
          </div>
        </footer>
      </div>

      <BottomNav />
    </div>
  )
}