// src/hooks/useFetch.js
import { useState, useEffect, useRef, useCallback } from 'react'

const TIMEOUT_MS  = 12000  // 12s antes de mostrar error
const MAX_RETRIES = 3      // reintentos automáticos en error de red
const RETRY_DELAY = 2000   // ms entre reintentos

export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const cancelledRef = useRef(false)
  const timeoutRef   = useRef(null)
  const retryCount   = useRef(0)

  const run = useCallback(async (isManualRetry = false) => {
    cancelledRef.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    await new Promise(r => setTimeout(r, 50))

    cancelledRef.current = false
    if (isManualRetry) retryCount.current = 0

    setLoading(true)
    setError(null)

    timeoutRef.current = setTimeout(() => {
      if (cancelledRef.current) return
      cancelledRef.current = true
      setLoading(false)
      setError('La carga tardó demasiado. Verifica tu conexión.')
    }, TIMEOUT_MS)

    try {
      const result = await fetchFn()
      if (cancelledRef.current) return
      clearTimeout(timeoutRef.current)
      setData(result)
      setError(null)
      retryCount.current = 0
    } catch (err) {
      clearTimeout(timeoutRef.current)
      if (cancelledRef.current) return

      const msg = err?.message || ''
      const esRedError = msg.includes('Failed to fetch')
        || msg.includes('NetworkError')
        || msg.includes('network')
        || !navigator.onLine

      if (esRedError && retryCount.current < MAX_RETRIES) {
        retryCount.current += 1
        setTimeout(() => {
          if (!cancelledRef.current) run()
        }, RETRY_DELAY * retryCount.current)
        return
      }

      setError(err.message || 'Error al cargar los datos.')
    } finally {
      if (!cancelledRef.current) setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    cancelledRef.current = false
    run()
    return () => {
      cancelledRef.current = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [run])

  const retry = useCallback(() => run(true), [run])

  return { data, loading, error, retry }
}