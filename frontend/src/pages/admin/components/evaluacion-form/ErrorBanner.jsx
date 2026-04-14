import { TAB_LABEL_MAP } from './lib/constants'

export default function ErrorBanner({ error, onClose, onIrASeccion }) {
  if (!error) return null
  const seccionLabel = TAB_LABEL_MAP[error.seccion] || error.seccion || 'general'
  return (
    <div className="flex items-start gap-3 p-4 bg-error-container rounded-xl border border-error/40 shadow-md">
      <span className="material-symbols-outlined text-on-error-container text-xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
        error
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-on-error-container">{error.message}</p>
        {error.seccion && (
          <button
            type="button"
            onClick={() => onIrASeccion(error.seccion)}
            className="mt-1 text-xs underline text-on-error-container/80 hover:text-on-error-container"
          >
            Ir a la sección: <strong>{seccionLabel}</strong>
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} className="text-on-error-container/70 hover:text-on-error-container flex-shrink-0">
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  )
}
