// DeployWatcher.jsx
// Detecta cuando Railway sube una nueva versión y avisa a todos los usuarios activos.
// Chequea cada 30s + al volver el foco a la pestaña. Muestra modal con cuenta regresiva.

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

// Si VITE_BACKEND_URL no está seteado en Railway, usa la misma origin del frontend
// (funciona cuando Express sirve el build de Vite en el mismo servicio)
function resolveBase() {
  const env = import.meta.env.VITE_BACKEND_URL
  if (env && !env.includes('localhost')) return env
  if (!window.location.hostname.includes('localhost')) return window.location.origin
  return 'http://localhost:3000'
}
const BASE = resolveBase()
const POLL_INTERVAL  = 30_000   // chequear cada 30s
const COUNTDOWN_SECS = 300      // 5 minutos para que el usuario termine

export default function DeployWatcher() {
  const { user, logout } = useAuth()
  const initialVersion = useRef(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [seconds,     setSeconds]     = useState(COUNTDOWN_SECS)

  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function fetchVersion() {
      if (cancelled) return
      try {
        const res = await fetch(`${BASE}/api/version`, { cache: 'no-store' })
        if (!res.ok || cancelled) return
        const { version } = await res.json()
        if (!version || cancelled) return

        if (initialVersion.current === null) {
          initialVersion.current = version
          console.log('[DeployWatcher] versión inicial:', version.slice(0, 16))
        } else if (version !== initialVersion.current) {
          console.log('[DeployWatcher] nueva versión detectada:', version.slice(0, 16))
          setUpdateReady(true)
        }
      } catch {
        // red no disponible — ignorar
      }
    }

    // Chequeo inicial
    fetchVersion()

    // Polling periódico
    const iv = setInterval(fetchVersion, POLL_INTERVAL)

    // Chequeo inmediato al volver el foco a la pestaña
    function onFocus() { fetchVersion() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') fetchVersion()
    })

    return () => {
      cancelled = true
      clearInterval(iv)
      window.removeEventListener('focus', onFocus)
    }
  }, [user]) // eslint-disable-line

  // Cuenta regresiva
  useEffect(() => {
    if (!updateReady) return
    const iv = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) { clearInterval(iv); handleActualizar(); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [updateReady]) // eslint-disable-line

  async function handleActualizar() {
    try { await logout() } catch { /* no bloquear */ }
    window.location.reload()
  }

  if (!updateReady) return null

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  const pct  = Math.round(((COUNTDOWN_SECS - seconds) / COUNTDOWN_SECS) * 100)

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-container transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="p-7 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>system_update</span>
          </div>

          <h3 className="font-extrabold text-xl mb-1">Nueva versión disponible</h3>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
            SimulaTest Pro acaba de actualizarse. Por favor recarga la página para continuar.
            Tu sesión se cerrará automáticamente.
          </p>

          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="material-symbols-outlined text-on-surface-variant">timer</span>
            <span className="font-mono font-extrabold text-2xl text-on-surface">
              {mins}:{secs}
            </span>
          </div>

          <button
            onClick={handleActualizar}
            className="w-full py-3.5 bg-primary text-on-primary rounded-full font-extrabold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg">
            <span className="material-symbols-outlined text-base"
              style={{ fontVariationSettings: "'FILL' 1" }}>refresh</span>
            Actualizar ahora
          </button>

          <p className="text-[10px] text-on-surface-variant mt-3">
            La página se recargará automáticamente cuando llegue el contador a cero.
          </p>
        </div>
      </div>
    </div>
  )
}
