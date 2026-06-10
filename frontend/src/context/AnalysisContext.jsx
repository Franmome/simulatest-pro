import { createContext, useContext, useState, useCallback } from 'react'

const AnalysisContext = createContext(null)

export function AnalysisProvider({ children }) {
  const [status,      setStatus]      = useState('idle')  // 'idle' | 'processing' | 'done' | 'error'
  const [result,      setResult]      = useState(null)
  const [jobError,    setJobError]    = useState(null)
  const [etapa,       setEtapa]       = useState(0)       // 0-5 — etapa actual del análisis
  const [mensajeEtapa, setMensajeEtapa] = useState('')    // texto descriptivo de la etapa
  const [pctEtapa,    setPctEtapa]    = useState(0)       // porcentaje 0-100

  const runAnalysis = useCallback(async (fetchFn) => {
    setStatus('processing')
    setResult(null)
    setJobError(null)
    setEtapa(0)
    setMensajeEtapa('')
    setPctEtapa(0)
    try {
      const data = await fetchFn()
      setEtapa(5)
      setPctEtapa(100)
      setResult(data)
      setStatus('done')
    } catch (e) {
      setJobError(e.message)
      setStatus('error')
    }
  }, [])

  const clearAnalysis = useCallback(() => {
    setStatus('idle')
    setResult(null)
    setJobError(null)
    setEtapa(0)
    setMensajeEtapa('')
    setPctEtapa(0)
  }, [])

  return (
    <AnalysisContext.Provider value={{
      status, result, jobError,
      etapa, mensajeEtapa, pctEtapa,
      setEtapa, setMensajeEtapa, setPctEtapa,
      runAnalysis, clearAnalysis,
    }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  return useContext(AnalysisContext)
}
