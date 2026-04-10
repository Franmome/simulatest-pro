// src/hooks/useFetch.js
import { useState, useEffect, useRef, useCallback } from 'react'

export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const runIdRef   = useRef(0)   // ID único por ejecución
  const mountedRef = useRef(true)

  const run = useCallback(async () => {
    if (!mountedRef.current) return

    // Incrementar ID — invalida cualquier ejecución anterior
    const currentId = ++runIdRef.current

    setLoading(true)
    setError(null)

    try {
      const result = await fetchFn()

      // Solo actualizar si esta ejecución sigue siendo la más reciente
      if (currentId !== runIdRef.current) return
      if (!mountedRef.current) return

      setData(result)
      setError(null)
    } catch (err) {
      if (currentId !== runIdRef.current) return
      if (!mountedRef.current) return
      setError(err.message || 'Error al cargar los datos.')
    } finally {
      if (currentId === runIdRef.current && mountedRef.current) {
        setLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    run()
    return () => {
      mountedRef.current = false
    }
  }, [run])

  // Recargar al volver a la pestaña
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && mountedRef.current) {
        run()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [run])

  const retry = useCallback(() => run(), [run])

  return { data, loading, error, retry }
}