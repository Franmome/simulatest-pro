// src/hooks/useFetch.js
// Hook centralizado para todas las cargas de datos de la app.
// Maneja: loading, error, timeout, cancelación y reintentos automáticos.
//
// Uso básico:
//   const { data, loading, error, retry } = useFetch(async () => {
//     const { data, error } = await supabase.from('...').select('*')
//     if (error) throw error
//     return data
//   })

import { useState, useEffect, useRef, useCallback } from 'react'

const TIMEOUT_MS    = 12000   // 12s antes de mostrar error de timeout
const MAX_RETRIES   = 2       // reintentos automáticos en error de red
const RETRY_DELAY   = 1500    // ms entre reintentos automáticos

export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // Refs para control interno (no causan re-renders)
  const abortRef   = useRef(null)   // AbortController activo
  const timeoutRef = useRef(null)   // timeout de rescate
  const mountedRef = useRef(true)   // ¿el componente sigue montado?
  const retryCount = useRef(0)      // contador de reintentos automáticos

  const run = useCallback(async (isManualRetry = false) => {
    // Cancelar operación anterior si existía
    if (abortRef.current) abortRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    // Crear nuevo controlador para esta ejecución
    const controller = new AbortController()
    abortRef.current = controller

    if (!mountedRef.current) return

    setLoading(true)
    setError(null)
    if (isManualRetry) retryCount.current = 0  // reset al reintentar manualmente

    // Timeout de rescate
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      controller.abort()
      setLoading(false)
      setError('La carga tardó demasiado. Verifica tu conexión.')
    }, TIMEOUT_MS)

    try {
      const result = await fetchFn(controller.signal)

      // Si fue abortado, ignorar resultado
      if (controller.signal.aborted) return

      clearTimeout(timeoutRef.current)
      if (!mountedRef.current) return

      setData(result)
      setError(null)
      retryCount.current = 0
    } catch (err) {
      clearTimeout(timeoutRef.current)
      if (!mountedRef.current) return
      if (controller.signal.aborted) return  // cancelado intencionalmente, no es error

      // Reintento automático en errores de red (no en errores de datos)
      const esErrorDeRed = !err.message || err.message.includes('fetch') || err.message.includes('network')
      if (esErrorDeRed && retryCount.current < MAX_RETRIES) {
        retryCount.current += 1
        setTimeout(() => {
          if (mountedRef.current) run()
        }, RETRY_DELAY * retryCount.current)
        return
      }

      setError(err.message || 'Ocurrió un error al cargar los datos.')
    } finally {
      if (!controller.signal.aborted && mountedRef.current) {
        setLoading(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  // Correr al montar y cuando cambien las deps
  useEffect(() => {
    mountedRef.current = true
    run()

    return () => {
      // Limpieza al desmontar: cancelar todo
      mountedRef.current = false
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [run])

  // retry() es lo que se pasa al botón "Reintentar" — siempre funciona
  const retry = useCallback(() => run(true), [run])

  return { data, loading, error, retry }
}