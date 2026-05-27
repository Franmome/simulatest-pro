import { createContext, useContext, useState, useCallback } from 'react'

const AnalysisContext = createContext(null)

export function AnalysisProvider({ children }) {
  const [status, setStatus]   = useState('idle')   // 'idle' | 'processing' | 'done' | 'error'
  const [result, setResult]   = useState(null)
  const [jobError, setJobError] = useState(null)

  const runAnalysis = useCallback(async (fetchFn) => {
    setStatus('processing')
    setResult(null)
    setJobError(null)
    try {
      const data = await fetchFn()
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
  }, [])

  return (
    <AnalysisContext.Provider value={{ status, result, jobError, runAnalysis, clearAnalysis }}>
      {children}
    </AnalysisContext.Provider>
  )
}

export function useAnalysis() {
  return useContext(AnalysisContext)
}
