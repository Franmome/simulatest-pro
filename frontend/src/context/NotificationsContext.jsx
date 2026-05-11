import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const Ctx = createContext(null)

export function NotificationsProvider({ children }) {
  const [notifs, setNotifs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('praxia_notifs') || '[]') }
    catch { return [] }
  })

  useEffect(() => {
    localStorage.setItem('praxia_notifs', JSON.stringify(notifs.slice(0, 30)))
  }, [notifs])

  const addNotif = useCallback((notif) => {
    const id = Date.now()
    setNotifs(prev => [{ id, ts: new Date().toISOString(), leida: false, ...notif }, ...prev])
    return id
  }, [])

  const updateNotif = useCallback((id, updates) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n))
  }, [])

  const marcarLeidas = useCallback(() => {
    setNotifs(prev => prev.map(n => ({ ...n, leida: true })))
  }, [])

  const eliminar = useCallback((id) => {
    setNotifs(prev => prev.filter(n => n.id !== id))
  }, [])

  const limpiar = useCallback(() => setNotifs([]), [])

  const noLeidas = notifs.filter(n => !n.leida).length

  return (
    <Ctx.Provider value={{ notifs, addNotif, updateNotif, marcarLeidas, eliminar, limpiar, noLeidas }}>
      {children}
    </Ctx.Provider>
  )
}

export const useNotifications = () => useContext(Ctx)
