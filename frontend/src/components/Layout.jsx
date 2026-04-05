import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import Header from './Header.jsx'
import APP from '../utils/app.config.js'

export default function Layout({ title, headerChildren }) {
  const [expanded, setExpanded] = useState(false)
  const sideW = expanded ? '16rem' : '4.5rem'

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar expanded={expanded} setExpanded={setExpanded} />

      <div
        className="flex-1 flex flex-col transition-all duration-300"
        style={{ marginLeft: sideW }}
      >
        <Header title={title} sideW={sideW}>{headerChildren}</Header>

        <main className="flex-1 animate-fade-in" style={{ paddingTop: '4.5rem' }}>
          <Outlet />
        </main>

        <footer
          className="border-t border-slate-100 bg-white py-3 px-6 flex justify-between items-center text-xs text-slate-500"
        >
          <p>© {APP.year} {APP.name}. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            <a className="hover:text-blue-700 cursor-pointer">Privacidad</a>
            <a className="hover:text-blue-700 cursor-pointer">Términos</a>
            <a className="hover:text-blue-700 cursor-pointer">Soporte</a>
          </div>
        </footer>
      </div>
    </div>
  )
}