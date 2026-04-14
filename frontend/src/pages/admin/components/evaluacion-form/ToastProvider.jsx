import { useState, useCallback, createContext, useContext } from 'react'

const ToastContext = createContext(null)

function ToastItem({ tipo, mensaje, onClose }) {
  const bg = {
    error: 'bg-error-container border-error text-on-error-container',
    warning: 'bg-tertiary-container border-tertiary text-on-tertiary-container',
    success: 'bg-secondary-container border-secondary text-on-secondary-container',
    info: 'bg-primary-container border-primary text-on-primary-container',
  }[tipo] || 'bg-surface-container border-outline text-on-surface'

  const icono = {
    error: 'error', warning: 'warning', success: 'check_circle', info: 'info',
  }[tipo] || 'info'

  return (
    <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 animate-fade-in-up ${bg}`}>
      <span className="material-symbols-outlined">{icono}</span>
      <p className="text-sm flex-1">{mensaje}</p>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-70 hover:opacity-100">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
  )
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((tipo, mensaje, duracion = 5000) => {
    const id = Date.now() + Math.random().toString(36)
    setToasts(prev => [...prev, { id, tipo, mensaje }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duracion)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem tipo={toast.tipo} mensaje={toast.mensaje} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context.addToast
}
