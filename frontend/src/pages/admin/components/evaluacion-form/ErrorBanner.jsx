// ErrorBanner.jsx
// Banner de error persistente que aparece en la parte superior del formulario
// cuando falla cualquier etapa del guardado.
//
// Muestra:
//   1. Título corto (qué falló)
//   2. Mensaje humano (qué significa para el admin)
//   3. Acción sugerida (cómo corregirlo)
//   4. Detalle técnico expandible (código Supabase, tabla, operación)
//   5. Botón "Ir a la sección" para navegar al tab con el problema
//   6. Botón cerrar

import { useState } from 'react'
import { TAB_LABEL_MAP } from './lib/constants'

export default function ErrorBanner({ error, onClose, onIrASeccion }) {
  // Controla si el panel de detalles técnicos está visible
  const [tecnicoExpanded, setTecnicoExpanded] = useState(false)

  if (!error) return null

  // Nombre legible de la sección/pestaña donde ocurrió el error
  const seccionLabel = TAB_LABEL_MAP[error.seccion] || error.seccion || 'general'

  // El banner soporta dos formas de error:
  //   - Errores enriquecidos: tienen mensajeHumano, accionSugerida, technical
  //   - Errores simples (legado): solo tienen message
  const mensajeHumano = error.mensajeHumano || null
  const accionSugerida = error.accionSugerida || null
  const technical = error.technical || null

  return (
    <div className="rounded-xl border border-error/40 bg-error-container shadow-md overflow-hidden">
      {/* ── Cabecera principal ─────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4">
        {/* Ícono de error */}
        <span
          className="material-symbols-outlined text-on-error-container text-xl flex-shrink-0 mt-0.5"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          error
        </span>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Título corto: qué etapa falló */}
          <p className="text-sm font-bold text-on-error-container leading-tight">
            {error.message}
          </p>

          {/* Mensaje humano: qué significa el error */}
          {mensajeHumano && (
            <p className="text-xs text-on-error-container/90">
              {mensajeHumano}
            </p>
          )}

          {/* Acción sugerida: qué puede hacer el admin */}
          {accionSugerida && (
            <p className="text-xs text-on-error-container/80 italic">
              💡 {accionSugerida}
            </p>
          )}

          {/* Fila de acciones: ir a sección + toggle detalles */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            {/* Navegar al tab con el problema */}
            {error.seccion && (
              <button
                type="button"
                onClick={() => onIrASeccion(error.seccion)}
                className="flex items-center gap-1 text-xs underline text-on-error-container/80 hover:text-on-error-container font-semibold"
              >
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                Ir a: <strong>{seccionLabel}</strong>
              </button>
            )}

            {/* Toggle detalles técnicos (solo si hay info técnica) */}
            {technical && (
              <button
                type="button"
                onClick={() => setTecnicoExpanded(v => !v)}
                className="flex items-center gap-1 text-[10px] text-on-error-container/60 hover:text-on-error-container/80 transition-colors"
              >
                <span className="material-symbols-outlined text-xs">
                  {tecnicoExpanded ? 'expand_less' : 'expand_more'}
                </span>
                {tecnicoExpanded ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
              </button>
            )}
          </div>
        </div>

        {/* Botón cerrar */}
        <button
          type="button"
          onClick={onClose}
          className="text-on-error-container/70 hover:text-on-error-container flex-shrink-0 p-1 rounded-lg hover:bg-error/10 transition-colors"
          title="Cerrar error"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* ── Panel técnico expandible ───────────────────────────────────── */}
      {tecnicoExpanded && technical && (
        <div className="px-4 pb-4 border-t border-error/20">
          <div className="mt-3 p-3 bg-error/10 rounded-lg">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-error-container/70 mb-1">
              Detalle técnico (para diagnóstico)
            </p>
            {/* Dividimos por ' | ' para mostrar cada dato en su propia línea */}
            {technical.split(' | ').map((parte, i) => (
              <p key={i} className="text-[11px] text-on-error-container/80 font-mono leading-relaxed">
                {parte}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
