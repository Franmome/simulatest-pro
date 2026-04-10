// src/hooks/useFetch.js
import { useState, useEffect, useRef, useCallback } from 'react'

export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const runIdRef   = useRef(0)   // ID único por ejecución
  const mountedRef = useRef(true)

  const run = useCallback(async () => {
    if (!mountedRef.current) {
      console.log('[useFetch] run abortado: componente desmontado')
      return
    }

    // Incrementar ID — invalida cualquier ejecución anterior
    const currentId = ++runIdRef.current
    console.log('[useFetch] 🚀 iniciando ejecución ID:', currentId)

    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()
      console.log('[useFetch] ✅ fetch completado, resultado:', result)

      // Solo actualizar si esta ejecución sigue siendo la más reciente
      if (currentId !== runIdRef.current) {
        console.log('[useFetch] ⚠️ resultado descartado, ID viejo:', currentId, 'actual:', runIdRef.current)
        return
      }
      if (!mountedRef.current) {
        console.log('[useFetch] ⚠️ componente desmontado, descartando resultado')
        return
      }

      setData(result)
      setError(null)
      console.log('[useFetch] 📦 datos actualizados correctamente')
    } catch (err) {
      console.error('[useFetch] ❌ ERROR capturado:', err)
      console.error('[useFetch] mensaje:', err?.message)
      console.error('[useFetch] currentId:', currentId, 'runIdRef:', runIdRef.current)
      console.error('[useFetch] mounted:', mountedRef.current)

      if (currentId !== runIdRef.current) {
        console.log('[useFetch] error descartado por ID obsoleto')
        return
      }
      if (!mountedRef.current) {
        console.log('[useFetch] error descartado por componente desmontado')
        return
      }
      setError(err.message || 'Error al cargar los datos.')
      console.log('[useFetch] ⚠️ error seteado en el estado')
    } finally {
      console.log('[useFetch] finally - currentId:', currentId, 'runIdRef:', runIdRef.current, 'mounted:', mountedRef.current)
      if (currentId === runIdRef.current && mountedRef.current) {
        setLoading(false)
        console.log('[useFetch] ✅ loading setteado a false')
      } else {
        console.log('[useFetch] 🚫 finally BLOQUEADO - no se actualizó loading')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    console.log('[useFetch] 🧩 useEffect montando / remontando')
    mountedRef.current = true
    run()
    return () => {
      console.log('[useFetch] 🧹 limpiando (desmontando)')
      mountedRef.current = false
    }
  }, [run])

  // Recargar al volver a la pestaña
  useEffect(() => {
    function onVisible() {
      console.log('[useFetch] 👁️ visibilitychange:', document.visibilityState)
      if (document.visibilityState === 'visible' && mountedRef.current) {
        console.log('[useFetch] 🔄 recargando por visibilidad')
        run()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      console.log('[useFetch] 🧹 removiendo listener visibilitychange')
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [run])

  const retry = useCallback(() => {
    console.log('[useFetch] 🔁 retry manual invocado')
    run()
  }, [run])

  return { data, loading, error, retry }
}