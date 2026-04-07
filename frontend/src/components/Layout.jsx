import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import BottomNav from './BottomNav.jsx'
import APP from '../utils/app.config.js'

export default function Layout({ title }) {
  const [expanded, setExpanded] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar: oculto en móvil, visible en md+ */}
      <div className="hidden md:block">
        <Sidebar expanded={expanded} setExpanded={setExpanded} />
      </div>

      {/* Overlay móvil con Sidebar */}
      {mobileMenu && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-white h-full shadow-xl">
            <Sidebar expanded={true} setExpanded={() => {}} />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileMenu(false)} />
        </div>
      )}

      {/* Contenedor principal */}
      <div
        className={`
          flex-1 flex flex-col transition-all duration-300
          ${expanded ? 'md:ml-64' : 'md:ml-[4.5rem]'}
        `}
      >
        <Header 
          title={title} 
          expanded={expanded} 
          onMenuClick={() => setMobileMenu(v => !v)} 
        />

        <main className="flex-1 animate-fade-in pt-[4.5rem] pb-20 md:pb-0">
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

      {/* Bottom Nav: solo móvil */}
      <BottomNav />
    </div>
  )
}