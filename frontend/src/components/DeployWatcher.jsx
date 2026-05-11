// DeployWatcher.jsx
// Detecta cuando Railway sube una nueva versión y avisa a todos los usuarios activos.
// Muestra un modal con cuenta regresiva y luego cierra sesión + recarga.

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'
const POLL_INTERVAL  = 60_000  // chequear cada 60s
const COUNTDOWN_SECS = 300     // 5 minutos para que el usuario termine lo que está haciendo

export default function DeployWatcher() {
  const { user, logout } = useAuth()
  const initialVersion   = useRef(null)
  const [updateReady, setUpdateReady] = useState(false)
  const [seconds,     setSeconds]     = useState(COUNTDOWN_SECS)

  // Polling de versión
  useEffect(() => {
    if (!user) return  // solo para usuarios autenticados

    let cancelled = false

    async function fetchVersion() {
      try {
        const res  = await fetch(`${BASE}/api/version`, { cache: 'no-store' })
        if (!res.ok) return
        const { version } = await res.json()
        if (!version || cancelled) return

        if (initialVersion.current === null) {
          initialVersion.current = version
        } else if (version !== initialVersion.current && !updateReady) {
          setUpdateReady(true)
        }
      } catch {
        // red no disponible — ignorar silenciosamente
      }
    }

    fetchVersion()
    const iv = setInterval(fetchVersion, POLL_INTERVAL)
    return () => { cancelled = true; clearInterval(iv) }
  }, [user]) // eslint-disable-line

  // Cuenta regresiva cuando hay update
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
    try { await logout() } catch { /* no bloquear si falla */ }
    window.location.reload()
  }

  if (!updateReady) return null

  const mins = String(Math.floor(seconds / 60)).padStart(2, '0')
  const secs = String(seconds % 60).padStart(2, '0')
  const pct  = Math.round(((COUNTDOWN_SECS - seconds) / COUNTDOWN_SECS) * 100)

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Barra de progreso */}
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
