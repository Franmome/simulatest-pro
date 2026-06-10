import React, { Component, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAnalysis } from '../context/AnalysisContext'
const generarAnalisisPDF = async (...args) => {
  try {
    const m = await import('../utils/generarAnalisisPDF')
    m.generarAnalisisPDF(...args)
  } catch {
    // chunk puede tener hash viejo en caché — recargar resuelve
    alert('Error al cargar el generador de PDF. Recarga la página (Ctrl+Shift+R) e intenta de nuevo.')
  }
}

const BASE = import.meta.env.VITE_API_URL || ''

// Convierte cualquier valor a string legible — evita React error #31 cuando
// la IA devuelve un objeto donde se espera un string
function safeStr(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const s = v.detalle || v.descripcion || v.accion || v.texto || v.value || v.denominacion || v.nombre || v.tipo || JSON.stringify(v)
    return typeof s === 'string' ? s : JSON.stringify(v)
  }
  return String(v)
}

// Captura errores de render en componentes hijos sin crashear toda la página
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  render() {
    if (this.state.err) return this.props.fallback ?? null
    return this.props.children
  }
}

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token}` }
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt'
const ACCEPTED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'txt']

function pctStyle(pct) {
  if (pct >= 80) return { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' }
  if (pct >= 65) return { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' }
  return { bar: 'bg-red-400', badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' }
}

function riesgoStyle(nivel) {
  if (nivel === 'bajo') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
  if (nivel === 'medio') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
}

function cumpleIcon(estado) {
  if (!estado) return 'help'
  const e = estado.toLowerCase()
  if (e === 'cumple') return 'check_circle'
  if (e.includes('parcial') || e.includes('validacion') || e.includes('validación')) return 'warning'
  if (e === 'no aplica' || e === 'n/a') return 'remove_circle'
  return 'cancel'
}

function cumpleColor(estado) {
  if (!estado) return 'text-on-surface-variant'
  const e = estado.toLowerCase()
  if (e === 'cumple') return 'text-green-600 dark:text-green-400'
  if (e.includes('parcial') || e.includes('validacion') || e.includes('validación')) return 'text-amber-600 dark:text-amber-400'
  if (e === 'no aplica' || e === 'n/a') return 'text-on-surface-variant'
  return 'text-red-500 dark:text-red-400'
}

function isNewFormat(analisis) {
  return !!(analisis?.ranking_opec_recomendadas || analisis?.perfil_candidato || analisis?.diagnostico_general)
}

// ── Old format (backward compat) ───────────────────────────────────────────────
function CargoCardOld({ cargo, index }) {
  const [open, setOpen] = useState(index < 2)
  const s = pctStyle(cargo.compatibilidad)
  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full p-4 flex items-center gap-3 hover:bg-surface-container-low/50 transition-colors text-left">
        <span className="text-2xl select-none flex-shrink-0">{MEDALS[index] ?? '•'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">{cargo.nombre_cargo}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Conv. {cargo.num_convocatoria ?? '—'} · {cargo.nivel ?? ''}{cargo.grado ? ` · Grado ${cargo.grado}` : ''}{cargo.vacantes ? ` · ${cargo.vacantes} vacante${cargo.vacantes !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${s.badge}`}>{cargo.compatibilidad}%</span>
          <span className="material-symbols-outlined text-on-surface-variant text-sm">{open ? 'expand_less' : 'expand_more'}</span>
        </div>
      </button>
      <div className="px-4 pb-2">
        <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${cargo.compatibilidad}%` }} />
        </div>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 animate-fade-in">
          {cargo.fortalezas?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-600 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                Fortalezas
              </p>
              <ul className="space-y-1">
                {cargo.fortalezas.map((f, j) => (
                  <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-green-500 text-sm mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {safeStr(f)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cargo.brechas?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">priority_high</span>
                Puntos a fortalecer
              </p>
              <ul className="space-y-1">
                {cargo.brechas.map((b, j) => (
                  <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 flex-shrink-0">arrow_forward</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cargo.recomendacion && (
            <div className="bg-primary/5 rounded-xl p-3">
              <p className="text-xs font-bold text-primary mb-1">Cómo prepararte</p>
              <p className="text-xs text-on-surface leading-relaxed">{cargo.recomendacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── New format OPEC card ───────────────────────────────────────────────────────
function CargoCard({ opec, index, plataformaUrl, plataformaNombre }) {
  const [open, setOpen] = useState(index === 0)
  const [tab, setTab] = useState('guia')
  const s = pctStyle(opec.afinidad_porcentaje)
  const puntaje = opec.puntaje_detallado || {}
  const guia = opec.guia_para_el_usuario || {}
  const riesgo = opec.riesgo_documental || {}
  const cumplimiento = opec.cumplimiento || {}

  const CRITERIOS = [
    { key: 'formacion_academica', label: 'Formación', max: 30 },
    { key: 'experiencia_requerida', label: 'Experiencia', max: 30 },
    { key: 'coincidencia_funcional', label: 'Funciones', max: 25 },
    { key: 'conocimientos_competencias', label: 'Conocimientos', max: 10 },
    { key: 'coherencia_requisitos_adicionales', label: 'Coherencia', max: 5 },
  ]

  const CUMPLIMIENTO_LABELS = {
    formacion: 'Formación', experiencia: 'Experiencia', funciones: 'Funciones',
    conocimientos: 'Conocimientos', tarjeta_profesional: 'Tarjeta', posgrado: 'Posgrado',
  }

  function TabBtn({ id, label, icon }) {
    return (
      <button
        onClick={() => setTab(id)}
        className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold rounded-lg transition-all min-h-[44px] ${
          tab === id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-sm">{icon}</span>
        <span className="text-[10px] sm:text-xs leading-tight">{label}</span>
      </button>
    )
  }

  const decisionColor = (() => {
    const d = (guia.decision_recomendada || '').toLowerCase()
    if (d.includes('no recomendable') || d.includes('no se recomienda')) return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700'
    if (d.includes('validacion') || d.includes('validación') || d.includes('con validacion')) return 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700'
    return 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700'
  })()

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 flex items-center gap-3 hover:bg-surface-container-low/50 transition-colors text-left"
      >
        <span className="text-2xl select-none flex-shrink-0">{MEDALS[index] ?? '•'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">{opec.denominacion}</p>
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
            {opec.entidad && <span>{opec.entidad} · </span>}
            {opec.numero_opec ? `OPEC ${opec.numero_opec}` : `Conv. ${opec.codigo_opec ?? opec.convocatoria ?? '—'}`}
            {opec.nivel ? ` · ${opec.nivel}` : ''}
            {opec.grado ? ` grado ${opec.grado}` : ''}
            {opec.vacantes ? ` · ${opec.vacantes} vac.` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${s.badge}`}>
            {opec.afinidad_porcentaje}%
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-sm">
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${opec.afinidad_porcentaje}%` }} />
        </div>
      </div>

      {/* Cumplimiento pills (always visible) */}
      {Object.keys(cumplimiento).some(k => cumplimiento[k]) && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {Object.entries(cumplimiento).map(([k, v]) => {
            if (!v) return null
            return (
              <span key={k} className={`flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full bg-surface-container ${cumpleColor(v)}`}>
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>{cumpleIcon(v)}</span>
                {CUMPLIMIENTO_LABELS[k] ?? k}
              </span>
            )
          })}
        </div>
      )}

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 animate-fade-in border-t border-outline-variant/20">

          {/* Meta info row */}
          <div className="flex flex-wrap gap-2">
            {opec.salario && (
              <div className="flex items-center gap-1.5 bg-surface-container rounded-lg px-2.5 py-1.5">
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                <span className="text-xs font-semibold text-on-surface">{opec.salario}</span>
              </div>
            )}
            {opec.proceso && (
              <div className="flex items-center gap-1.5 bg-surface-container rounded-lg px-2.5 py-1.5">
                <span className="material-symbols-outlined text-sm text-on-surface-variant">account_tree</span>
                <span className="text-xs text-on-surface">{opec.proceso}</span>
              </div>
            )}
            {opec.clasificacion_afinidad && (
              <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg ${s.badge}`}>
                {opec.clasificacion_afinidad}
              </span>
            )}
          </div>

          {/* Identificación y dónde aplicar */}
          {(opec.numero_opec || opec.num_convocatoria || opec.dependencia || opec.ubicaciones_norm?.length > 0) && (
            <div className="bg-surface-container rounded-xl p-3 space-y-2.5">
              <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                Cómo identificar y aplicar a este cargo
              </p>
              <div className="grid grid-cols-2 gap-2">
                {opec.numero_opec && (
                  <div className="bg-primary/8 rounded-lg p-2">
                    <p className="text-[10px] text-on-surface-variant">N° OPEC</p>
                    <p className="text-xs font-extrabold text-primary">{opec.numero_opec}</p>
                  </div>
                )}
                {(opec.num_convocatoria || opec.codigo_opec) && (
                  <div className="bg-surface-container-low rounded-lg p-2">
                    <p className="text-[10px] text-on-surface-variant">N° Convocatoria</p>
                    <p className="text-xs font-bold text-on-surface">{opec.num_convocatoria || opec.codigo_opec}</p>
                  </div>
                )}
              </div>
              {opec.dependencia && (
                <div>
                  <p className="text-[10px] text-on-surface-variant">Dependencia</p>
                  <p className="text-xs text-on-surface leading-snug">{opec.dependencia}</p>
                </div>
              )}
              {opec.ubicaciones_norm?.length > 0 && (
                <div>
                  <p className="text-[10px] text-on-surface-variant mb-1">Ciudades con vacantes</p>
                  <div className="flex flex-wrap gap-1">
                    {opec.ubicaciones_norm.slice(0, 15).map((u, i) => (
                      <span key={i} className="text-[10px] bg-surface-container-low text-on-surface px-2 py-0.5 rounded-full border border-outline-variant/30">
                        {u.ciudad}{u.vacantes ? ` · ${u.vacantes}` : ''}
                      </span>
                    ))}
                    {opec.ubicaciones_norm.length > 15 && (
                      <span className="text-[10px] text-on-surface-variant italic px-1">+{opec.ubicaciones_norm.length - 15} más</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t border-outline-variant/20">
                <a
                  href="https://simo-opec.cnsc.gov.co/"
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                  Buscar en SIMO
                </a>
                {plataformaUrl && (
                  <a
                    href={plataformaUrl}
                    target="_blank" rel="noopener noreferrer"
                    title={plataformaNombre || 'Plataforma de inscripción'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">how_to_reg</span>
                    Inscribirse
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-surface-container-low rounded-xl p-1">
            <TabBtn id="guia" label="Guía" icon="tips_and_updates" />
            <TabBtn id="analisis" label="Análisis" icon="analytics" />
            <TabBtn id="riesgo" label="Riesgo" icon="shield" />
          </div>

          {/* Tab: Guía */}
          {tab === 'guia' && (
            <div className="space-y-3">
              {guia.mensaje_claro && (
                <div className={`p-3 rounded-xl text-xs leading-relaxed border ${decisionColor}`}>
                  {guia.decision_recomendada && (
                    <span className="font-extrabold block mb-1 uppercase text-[10px] tracking-wider">{guia.decision_recomendada}</span>
                  )}
                  {guia.mensaje_claro}
                </div>
              )}

              {guia.acciones_antes_de_postularse?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                    Acciones antes de postularte
                  </p>
                  <ol className="space-y-1">
                    {guia.acciones_antes_de_postularse.map((a, j) => (
                      <li key={j} className="text-xs text-on-surface flex items-start gap-2 bg-surface-container rounded-lg p-2">
                        <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
                        {safeStr(a)}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {guia.documentos_prioritarios?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">folder_open</span>
                    Documentos prioritarios
                  </p>
                  <ul className="space-y-1">
                    {guia.documentos_prioritarios.map((d, j) => (
                      <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                        {safeStr(d)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {guia.funciones_que_debe_evidenciar?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">work</span>
                    Funciones que debes evidenciar
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {guia.funciones_que_debe_evidenciar.map((f, j) => (
                      <span key={j} className="text-xs bg-surface-container text-on-surface px-2 py-0.5 rounded-full">{safeStr(f)}</span>
                    ))}
                  </div>
                </div>
              )}

              {guia.palabras_clave_sugeridas?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">label</span>
                    Palabras clave para tu hoja de vida
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {guia.palabras_clave_sugeridas.map((p, j) => (
                      <span key={j} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{safeStr(p)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Análisis técnico */}
          {tab === 'analisis' && (
            <div className="space-y-3">
              {CRITERIOS.some(c => puntaje[c.key]) && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-2">Puntaje por criterio</p>
                  <div className="space-y-2">
                    {CRITERIOS.map(({ key, label, max }) => {
                      const item = puntaje[key]
                      if (!item) return null
                      const pct = Math.round((item.puntaje / max) * 100)
                      const barColor = pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400'
                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs text-on-surface">{label}</span>
                            <span className="text-xs font-bold text-on-surface">{item.puntaje}/{max}</span>
                          </div>
                          <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                          </div>
                          {item.justificacion && (
                            <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">{item.justificacion}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {opec.coincidencias_principales?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-green-600 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    Coincidencias principales
                  </p>
                  <ul className="space-y-1">
                    {opec.coincidencias_principales.map((c, j) => (
                      <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-green-500 text-xs mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {opec.brechas_concretas?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-600 mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">priority_high</span>
                    Brechas identificadas
                  </p>
                  <ul className="space-y-1">
                    {opec.brechas_concretas.map((b, j) => (
                      <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-amber-500 text-xs mt-0.5 flex-shrink-0">arrow_forward</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {opec.justificacion && (
                <div className="bg-surface-container rounded-xl p-3">
                  <p className="text-xs font-bold text-on-surface-variant mb-1">Justificación del puntaje</p>
                  <p className="text-xs text-on-surface leading-relaxed">{opec.justificacion}</p>
                </div>
              )}
            </div>
          )}

          {/* Tab: Riesgo */}
          {tab === 'riesgo' && (
            <div className="space-y-3">
              {riesgo.nivel && (
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider ${riesgoStyle(riesgo.nivel)}`}>
                    Riesgo {riesgo.nivel}
                  </span>
                </div>
              )}

              {riesgo.causas?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-1.5">Causas del riesgo</p>
                  <ul className="space-y-1">
                    {riesgo.causas.map((c, j) => (
                      <li key={j} className="text-xs text-on-surface flex items-start gap-1.5 bg-surface-container rounded-lg p-2">
                        <span className="material-symbols-outlined text-amber-500 text-xs mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {opec.riesgo_no_cumplimiento && (
                <div className="bg-surface-container rounded-xl p-3">
                  <p className="text-xs font-bold text-on-surface-variant mb-1">Riesgo de no cumplimiento</p>
                  <p className="text-xs text-on-surface leading-relaxed">{opec.riesgo_no_cumplimiento}</p>
                </div>
              )}

              {guia.que_debe_corregir_en_hoja_de_vida?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-on-surface-variant mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">edit_document</span>
                    Qué corregir en tu hoja de vida
                  </p>
                  <ul className="space-y-1">
                    {guia.que_debe_corregir_en_hoja_de_vida.map((c, j) => (
                      <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                        <span className="material-symbols-outlined text-primary text-xs mt-0.5 flex-shrink-0">edit</span>
                        {safeStr(c)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tarjeta de ruta estratégica ────────────────────────────────────────────────
const RUTAS_CFG = {
  ruta_principal:  { label: 'Ruta Principal',  subtitle: 'Tu mejor apuesta',       icon: 'workspace_premium', color: 'primary',  bgFrom: 'from-primary/10',    bgTo: 'to-primary/5',    border: 'border-primary/30',    badge: 'bg-primary text-on-primary',      iconBg: 'bg-primary/15 text-primary' },
  ruta_segura:     { label: 'Ruta Segura',     subtitle: 'Menor competencia',      icon: 'shield',            color: 'green',    bgFrom: 'from-green-500/10',  bgTo: 'to-green-500/5',  border: 'border-green-500/30',  badge: 'bg-green-600 text-white',         iconBg: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
  ruta_estrategica:{ label: 'Ruta Estratégica',subtitle: 'Mejor retorno',          icon: 'trending_up',       color: 'blue',     bgFrom: 'from-blue-500/10',   bgTo: 'to-blue-500/5',   border: 'border-blue-500/30',   badge: 'bg-blue-600 text-white',          iconBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
  ruta_ambiciosa:  { label: 'Ruta Ambiciosa',  subtitle: 'Tu techo competitivo',   icon: 'rocket_launch',     color: 'purple',   bgFrom: 'from-purple-500/10', bgTo: 'to-purple-500/5', border: 'border-purple-500/30', badge: 'bg-purple-600 text-white',        iconBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400' },
}

const PIN_UI = {
  comprar_con_verificacion: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: 'check_circle', dot: 'bg-green-500' },
  verificar:                { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: 'warning',      dot: 'bg-amber-500' },
  no_comprar:               { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400',   icon: 'cancel',        dot: 'bg-red-500'   },
}

const VRM_PILL = {
  'viable':                  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  'viable con verificacion': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  'no viable':               { bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-700 dark:text-red-400'     },
}
const VA_PILL = {
  'potencial bajo':  { bg: 'bg-surface-container', text: 'text-on-surface-variant' },
  'potencial medio': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  'potencial alto':  { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
}
const HAB_PILL = {
  'no aplica': { bg: 'bg-surface-container', text: 'text-on-surface-variant' },
  'verificar': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400' },
  'cumple':    { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
}

function RutaCard({ rutaKey, ruta, plataformaUrl, plataformaNombre }) {
  const [open, setOpen] = useState(rutaKey === 'ruta_principal')
  const cfg = RUTAS_CFG[rutaKey] || RUTAS_CFG.ruta_principal
  const s = pctStyle(ruta.afinidad_porcentaje)

  // Soporte para ambos formatos (nuevo: decision_pin / viejo: riesgo_nivel)
  const pinKey  = ruta.decision_pin || (ruta.riesgo_nivel === 'bajo' ? 'comprar_con_verificacion' : ruta.riesgo_nivel === 'alto' ? 'no_comprar' : 'verificar')
  const pinUi   = PIN_UI[pinKey] || PIN_UI.verificar
  const pinText = ruta.decision_pin_texto || (pinKey === 'comprar_con_verificacion' ? 'Comprar con verificación' : pinKey === 'no_comprar' ? 'No comprar ahora' : 'Verificar antes de comprar')

  // Campos con fallback old → new
  const porQueText    = ruta.por_que_conviene || ruta.por_que_esta_ruta || ''
  const accionesItems = ruta.antes_de_pagar?.length > 0 ? ruta.antes_de_pagar : (ruta.acciones_clave || [])
  const decSugerida   = ruta.decision_sugerida || ruta.justificacion || ''
  const puntoCrit     = ruta.punto_critico || ruta.riesgo_explica || ''

  return (
    <div className={`card overflow-hidden border-2 ${cfg.border} bg-gradient-to-br ${cfg.bgFrom} ${cfg.bgTo}`}>
      {/* Header ruta */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          <span className="ml-1.5 text-[10px] text-on-surface-variant">{cfg.subtitle}</span>
        </div>
        {/* Decisión PIN badge prominente */}
        <span className={`flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${pinUi.bg} ${pinUi.text} flex-shrink-0`}>
          <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>{pinUi.icon}</span>
          <span className="hidden sm:inline">{pinText}</span>
          <span className="sm:hidden">{pinKey === 'comprar_con_verificacion' ? 'Comprar' : pinKey === 'no_comprar' ? 'No comprar' : 'Verificar'}</span>
        </span>
      </div>

      {/* Cargo header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">{ruta.denominacion}</p>
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">
            {ruta.entidad && <span>{ruta.entidad} · </span>}
            {ruta.numero_opec ? `OPEC ${ruta.numero_opec}` : ruta.codigo_opec ? `Cod. ${ruta.codigo_opec}` : ''}
            {ruta.nivel ? ` · ${ruta.nivel}` : ''}
            {ruta.grado ? ` G${ruta.grado}` : ''}
            {ruta.vacantes ? ` · ${ruta.vacantes} vac.` : ''}
            {ruta.ciudad ? ` · ${ruta.ciudad}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${s.badge}`}>
            {ruta.afinidad_porcentaje}%
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-sm">
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {/* Bar */}
      <div className="px-4 pb-2">
        <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${ruta.afinidad_porcentaje}%` }} />
        </div>
      </div>

      {/* Expanded */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-outline-variant/20 pt-3">

          {/* Decisión PIN expandida */}
          <div className={`p-3 rounded-xl border ${cfg.border} ${pinUi.bg}`}>
            <p className={`text-xs font-extrabold mb-0.5 flex items-center gap-1 ${pinUi.text}`}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{pinUi.icon}</span>
              Decisión PIN: {pinText}
            </p>
            {(ruta.motivo_claro || porQueText) && (
              <p className="text-xs text-on-surface mt-1">{ruta.motivo_claro || porQueText}</p>
            )}
          </div>

          {/* Meta: salario + datos clave */}
          <div className="flex flex-wrap gap-2">
            {ruta.salario && (
              <div className="flex items-center gap-1.5 bg-surface-container rounded-lg px-2.5 py-1.5">
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                <span className="text-xs font-semibold">{ruta.salario}</span>
              </div>
            )}
            {ruta.ciudad && (
              <div className="flex items-center gap-1 bg-surface-container rounded-lg px-2 py-1.5">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">location_on</span>
                <span className="text-xs text-on-surface">{ruta.ciudad}</span>
              </div>
            )}
          </div>

          {/* VRM / VA / Habilitación — status row */}
          {(ruta.vrm || ruta.va || ruta.habilitacion || ruta.cumplimiento) && (
            <div className="grid grid-cols-3 gap-1.5">
              {(() => {
                const vrmE = ruta.vrm || (ruta.cumplimiento?.experiencia === 'cumple' ? 'viable' : 'viable con verificacion')
                const vaE  = ruta.va  || 'potencial medio'
                const habE = ruta.habilitacion || (ruta.cumplimiento?.tarjeta_profesional === 'no aplica' ? 'no aplica' : 'verificar')
                const vp = VRM_PILL[vrmE] || VRM_PILL['viable con verificacion']
                const ap = VA_PILL[vaE]   || VA_PILL['potencial medio']
                const hp = HAB_PILL[habE] || HAB_PILL['no aplica']
                return (
                  <>
                    <div className={`rounded-lg p-2 ${vp.bg}`}>
                      <p className={`text-[9px] font-extrabold uppercase tracking-wider ${vp.text}`}>VRM</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${vp.text}`}>{vrmE}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${ap.bg}`}>
                      <p className={`text-[9px] font-extrabold uppercase tracking-wider ${ap.text}`}>VA</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${ap.text}`}>{vaE}</p>
                    </div>
                    <div className={`rounded-lg p-2 ${hp.bg}`}>
                      <p className={`text-[9px] font-extrabold uppercase tracking-wider ${hp.text}`}>Habilitación</p>
                      <p className={`text-[10px] font-bold mt-0.5 ${hp.text}`}>{habE}</p>
                    </div>
                  </>
                )
              })()}
            </div>
          )}

          {/* Punto crítico */}
          {puntoCrit && (
            <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/40 rounded-xl p-3">
              <span className="material-symbols-outlined text-amber-600 text-sm flex-shrink-0 mt-0.5">warning</span>
              <div>
                <p className="text-[10px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Punto crítico</p>
                <p className="text-xs text-on-surface mt-0.5">{puntoCrit}</p>
              </div>
            </div>
          )}

          {/* Antes de pagar / acciones clave */}
          {accionesItems.length > 0 && (
            <div>
              <p className="text-xs font-bold text-primary mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                Antes de pagar el PIN
              </p>
              <ol className="space-y-1">
                {accionesItems.map((a, j) => (
                  <li key={j} className="text-xs text-on-surface flex items-start gap-2 bg-surface-container rounded-lg p-2">
                    <span className="w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
                    {safeStr(a)}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Decisión sugerida */}
          {decSugerida && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200/60 dark:border-green-700/40 rounded-xl p-3">
              <p className="text-[10px] font-extrabold text-green-700 dark:text-green-400 uppercase tracking-wider mb-0.5">Decisión sugerida</p>
              <p className="text-xs text-on-surface leading-relaxed">{decSugerida}</p>
            </div>
          )}

          {/* Identificación + dónde aplicar */}
          {(ruta.numero_opec || ruta.num_convocatoria || ruta.ubicaciones_norm?.length > 0) && (
            <div className="bg-surface-container rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
                Cómo identificar y aplicar
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ruta.numero_opec && (
                  <div className="bg-primary/8 rounded-lg p-2">
                    <p className="text-[10px] text-on-surface-variant">N° OPEC</p>
                    <p className="text-xs font-extrabold text-primary">{ruta.numero_opec}</p>
                  </div>
                )}
                {(ruta.num_convocatoria || ruta.codigo_opec) && (
                  <div className="bg-surface-container-low rounded-lg p-2">
                    <p className="text-[10px] text-on-surface-variant">N° Convocatoria</p>
                    <p className="text-xs font-bold">{ruta.num_convocatoria || ruta.codigo_opec}</p>
                  </div>
                )}
              </div>
              {ruta.dependencia && (
                <div>
                  <p className="text-[10px] text-on-surface-variant">Dependencia</p>
                  <p className="text-xs text-on-surface">{ruta.dependencia}</p>
                </div>
              )}
              {ruta.ubicaciones_norm?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {ruta.ubicaciones_norm.slice(0, 12).map((u, i) => (
                    <span key={i} className="text-[10px] bg-surface-container-low text-on-surface px-2 py-0.5 rounded-full border border-outline-variant/30">
                      {u.ciudad}{u.vacantes ? ` · ${u.vacantes}` : ''}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t border-outline-variant/20">
                <a
                  href="https://simo-opec.cnsc.gov.co/"
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-primary/90 transition-all"
                >
                  <span className="material-symbols-outlined text-sm">search</span>
                  Buscar en SIMO
                </a>
                {plataformaUrl && (
                  <a
                    href={plataformaUrl}
                    target="_blank" rel="noopener noreferrer"
                    title={plataformaNombre || 'Plataforma de inscripción'}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">how_to_reg</span>
                    Inscribirse
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Recomendaciones HV accordion ──────────────────────────────────────────────
function RecomendacionesHV({ recomendaciones }) {
  const [open, setOpen] = useState(false)
  const SECTIONS = [
    { key: 'perfil_profesional', label: 'Perfil profesional', icon: 'person' },
    { key: 'experiencia_laboral', label: 'Experiencia laboral', icon: 'work' },
    { key: 'funciones', label: 'Funciones', icon: 'task' },
    { key: 'certificaciones', label: 'Certificaciones', icon: 'verified' },
    { key: 'soportes_documentales', label: 'Soportes documentales', icon: 'folder' },
    { key: 'palabras_clave', label: 'Palabras clave', icon: 'label' },
    { key: 'preparacion_para_pruebas', label: 'Preparación para pruebas', icon: 'school' },
  ].filter(s => recomendaciones[s.key]?.length > 0)

  if (!SECTIONS.length) return null

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full p-4 flex items-center gap-2 hover:bg-surface-container-low/50 transition-colors text-left">
        <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
        <p className="font-bold text-sm flex-1">Cómo mejorar tu hoja de vida</p>
        <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{SECTIONS.length} secciones</span>
        <span className="material-symbols-outlined text-on-surface-variant text-sm">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/20 pt-3">
          {SECTIONS.map(({ key, label, icon }) => (
            <div key={key}>
              <p className="text-xs font-bold text-on-surface-variant mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">{icon}</span>
                {label}
              </p>
              <ul className="space-y-1">
                {recomendaciones[key].map((r, i) => (
                  <li key={i} className="text-xs text-on-surface flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-primary text-xs mt-0.5 flex-shrink-0">arrow_right</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── History sidebar card ───────────────────────────────────────────────────────
function HistoryCard({ item, onSelect, onDelete, active }) {
  const rutaPrincipal = item.analisis?.rutas?.ruta_principal
  const top = rutaPrincipal ?? item.analisis?.ranking_opec_recomendadas?.[0] ?? item.analisis?.cargos_recomendados?.[0]
  const pct = top?.afinidad_porcentaje ?? top?.compatibilidad ?? 0
  const nombre = top?.denominacion ?? top?.nombre_cargo ?? ''
  const date = new Date(item.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  const s = pct ? pctStyle(pct) : null

  return (
    <div className={`relative rounded-xl border transition-all group
      ${active ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface-container-low hover:border-primary/40 hover:bg-primary/5'}`}
    >
      <button onClick={() => onSelect(item)} className="w-full text-left p-3">
        <p className="text-xs font-bold text-on-surface line-clamp-2 leading-snug pr-5">{item.convocatoria_nombre ?? 'Convocatoria'}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">{date}</p>
        {nombre && (
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-sm select-none">🥇</span>
            <p className="text-xs font-semibold text-on-surface truncate flex-1">{nombre}</p>
            {s && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.badge}`}>{pct}%</span>}
          </div>
        )}
      </button>
      <button
        onClick={e => { e.stopPropagation(); onDelete(item.id) }}
        title="Eliminar este análisis"
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-surface-container hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center transition-all sm:opacity-0 sm:group-hover:opacity-100"
      >
        <span className="material-symbols-outlined text-on-surface-variant hover:text-red-500" style={{ fontSize: '13px' }}>close</span>
      </button>
    </div>
  )
}

// ── Results: new format ────────────────────────────────────────────────────────
function ResultsNew({ analisis, onReset, navigate, opecsPendientes = [], cargandoMas = false, onVerMas, plataformaUrl, plataformaNombre, onGuardar, guardando = false, guardadoOk = false }) {
  const perfil = analisis.perfil_candidato || {}
  const diag = analisis.diagnostico_general || {}
  const top = analisis.opec_mas_recomendada || {}
  const ranking = (analisis.ranking_opec_recomendadas || []).filter(o => (o.afinidad_porcentaje || 0) > 0)
  const recomendaciones = analisis.recomendaciones_para_mejorar_hoja_de_vida || {}
  const acciones = analisis.acciones_prioritarias || []
  const descartados = analisis.cargos_descartados_relevantes || []

  return (
    <div className="space-y-4 sm:space-y-5 animate-fade-in">
      <div className="flex items-center gap-2 sm:gap-3">
        <button onClick={onReset} className="p-2 hover:bg-surface-container rounded-lg transition-colors flex-shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm sm:text-base truncate">Resultado del análisis</h2>
          {diag.nivel_competitividad && (
            <span className="inline-block mt-0.5 text-[10px] sm:text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{diag.nivel_competitividad}</span>
          )}
        </div>
        <button
          onClick={() => generarAnalisisPDF(analisis, analisis._convNombre || '')}
          className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2 bg-primary text-on-primary rounded-full text-xs font-bold hover:bg-primary/90 transition-all flex-shrink-0 min-h-[36px]"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
          <span className="hidden sm:inline">Descargar</span>
        </button>
      </div>

      {/* Estado de análisis */}
      {analisis.observacion_general && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <p className="leading-relaxed">{analisis.observacion_general}</p>
        </div>
      )}

      {/* Perfil extraído */}
      {(perfil.profesion_principal || diag.resumen) && (
        <div className="card p-4 sm:p-5 bg-gradient-to-br from-primary/8 to-secondary/5 border border-primary/15">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
            Tu perfil profesional
          </p>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {perfil.profesion_principal && (
              <div className="bg-white/40 dark:bg-surface/30 rounded-lg p-2">
                <p className="text-[10px] text-on-surface-variant">Profesión</p>
                <p className="text-xs font-bold text-on-surface leading-snug">{perfil.profesion_principal}</p>
              </div>
            )}
            {perfil.nivel_formacion && (
              <div className="bg-white/40 dark:bg-surface/30 rounded-lg p-2">
                <p className="text-[10px] text-on-surface-variant">Nivel</p>
                <p className="text-xs font-bold text-on-surface leading-snug">{perfil.nivel_formacion}</p>
              </div>
            )}
            {perfil.experiencia_total_estimada_meses > 0 && (
              <div className="bg-white/40 dark:bg-surface/30 rounded-lg p-2">
                <p className="text-[10px] text-on-surface-variant">Experiencia total</p>
                <p className="text-xs font-bold text-on-surface">
                  {perfil.experiencia_total_estimada_meses >= 12
                    ? `${Math.floor(perfil.experiencia_total_estimada_meses / 12)}a${perfil.experiencia_total_estimada_meses % 12 ? ` ${perfil.experiencia_total_estimada_meses % 12}m` : ''}`
                    : `${perfil.experiencia_total_estimada_meses} meses`}
                </p>
              </div>
            )}
            {perfil.tarjeta_profesional?.estado && (
              <div className="bg-white/40 dark:bg-surface/30 rounded-lg p-2">
                <p className="text-[10px] text-on-surface-variant">Tarjeta prof.</p>
                <p className="text-xs font-bold text-on-surface leading-snug">{perfil.tarjeta_profesional.estado}</p>
              </div>
            )}
          </div>
          {diag.resumen && <p className="text-xs text-on-surface leading-relaxed">{diag.resumen}</p>}
          {perfil.alertas_validacion?.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {perfil.alertas_validacion.map((a, i) => {
                const tipo       = typeof a === 'object' ? (a.tipo        || '') : ''
                const detalle    = typeof a === 'object' ? (a.detalle     || '') : safeStr(a)
                const criticidad = typeof a === 'object' ? (a.criticidad  || '') : ''
                const isAlta     = criticidad.toLowerCase().includes('alta')
                const isMedia    = criticidad.toLowerCase().includes('media')
                return (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                    ${isAlta  ? 'bg-red-50    dark:bg-red-950/30   text-red-700    dark:text-red-400'
                    : isMedia ? 'bg-amber-50  dark:bg-amber-950/30 text-amber-700  dark:text-amber-400'
                    :            'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400'}`}>
                    <span className="material-symbols-outlined text-xs mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isAlta ? 'error' : 'warning'}
                    </span>
                    <div className="flex-1 min-w-0">
                      {tipo && <span className="font-bold mr-1">{tipo}:</span>}
                      <span>{detalle || safeStr(a)}</span>
                      {criticidad && <span className="ml-1 opacity-60 font-medium">({criticidad})</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Diagnóstico */}
      {(diag.fortalezas_principales?.length > 0 || diag.debilidades_principales?.length > 0) && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>assessment</span>
            Diagnóstico general
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {diag.fortalezas_principales?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-600 mb-1.5">Fortalezas</p>
                <ul className="space-y-1">
                  {diag.fortalezas_principales.map((f, i) => (
                    <li key={i} className="text-xs text-on-surface flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-green-500 text-xs mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      {safeStr(f)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {diag.debilidades_principales?.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 mb-1.5">Áreas de mejora</p>
                <ul className="space-y-1">
                  {diag.debilidades_principales.map((d, i) => (
                    <li key={i} className="text-xs text-on-surface flex items-start gap-1.5">
                      <span className="material-symbols-outlined text-amber-500 text-xs mt-0.5 flex-shrink-0">arrow_forward</span>
                      {safeStr(d)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top OPEC */}
      {top.denominacion && (
        <div className="card p-4 border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            La opción más recomendada para ti
          </p>
          <p className="font-bold text-sm text-on-surface">{top.denominacion}</p>
          {top.entidad && <p className="text-xs text-on-surface-variant mt-0.5">{top.entidad}</p>}
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${pctStyle(top.afinidad_porcentaje).badge}`}>
              {top.afinidad_porcentaje}% afinidad
            </span>
          </div>
          {top.razon_principal && <p className="text-xs text-on-surface mt-2 leading-relaxed">{top.razon_principal}</p>}
          {top.ventaja_frente_a_las_otras && (
            <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{top.ventaja_frente_a_las_otras}</p>
          )}
          {top.accion_prioritaria_antes_de_postularse && (
            <div className="mt-2 bg-primary/10 rounded-lg p-2">
              <p className="text-xs font-bold text-primary mb-0.5">Acción prioritaria</p>
              <p className="text-xs text-on-surface">{top.accion_prioritaria_antes_de_postularse}</p>
            </div>
          )}
        </div>
      )}

      {/* 4 Rutas estratégicas (nuevo motor) */}
      {analisis.rutas && Object.keys(analisis.rutas).length > 0 && (
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>route</span>
            Tus 4 rutas estratégicas
          </p>
          <div className="space-y-3">
            {['ruta_principal', 'ruta_segura', 'ruta_estrategica', 'ruta_ambiciosa'].map(key => {
              const ruta = analisis.rutas[key]
              if (!ruta?.denominacion) return null
              return <RutaCard key={key} rutaKey={key} ruta={ruta} plataformaUrl={plataformaUrl} plataformaNombre={plataformaNombre} />
            })}
          </div>
        </div>
      )}

      {/* OPECs: fallback (sin rutas) o adicionales exploradas (con rutas) */}
      {ranking.length > 0 && (
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            {analisis.rutas ? 'OPECs adicionales exploradas' : 'Cargos recomendados para ti'}
          </p>
          <div className="space-y-3">
            {ranking.map((opec, i) => <CargoCard key={opec.id ?? opec.numero_opec ?? i} opec={opec} index={i} plataformaUrl={plataformaUrl} plataformaNombre={plataformaNombre} />)}
          </div>
        </div>
      )}

      {/* Botón Ver más OPECs */}
      {(opecsPendientes.length > 0 || cargandoMas) && (
        <button
          onClick={onVerMas}
          disabled={cargandoMas}
          className="w-full py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-bold text-sm hover:bg-primary/5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {cargandoMas ? (
            <>
              <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              Buscando más OPECs compatibles...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span className="sm:hidden">Explorar más OPECs{opecsPendientes.length > 0 ? ` (${opecsPendientes.length})` : ''}</span>
              <span className="hidden sm:inline">Explorar {Math.min(opecsPendientes.length, 3)} OPECs más ({opecsPendientes.length} pendientes)</span>
            </>
          )}
        </button>
      )}

      {/* Acciones prioritarias */}
      {acciones.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
            Acciones prioritarias
          </p>
          <div className="space-y-2">
            {acciones.map((a, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-surface-container rounded-xl">
                <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-xs font-extrabold flex items-center justify-center flex-shrink-0">
                  {a.prioridad ?? i + 1}
                </span>
                <div>
                  <p className="text-xs font-bold text-on-surface">{a.accion}</p>
                  {a.motivo && <p className="text-xs text-on-surface-variant mt-0.5">{a.motivo}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendaciones HV */}
      <RecomendacionesHV recomendaciones={recomendaciones} />

      {/* Descartados */}
      {descartados.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">cancel</span>
            Cargos evaluados pero descartados
          </p>
          <div className="space-y-2">
            {descartados.map((d, i) => (
              <div key={i} className="flex items-start gap-2 p-2 bg-surface-container rounded-lg">
                <span className="material-symbols-outlined text-red-400 text-sm mt-0.5 flex-shrink-0">cancel</span>
                <div>
                  <p className="text-xs font-bold text-on-surface">{d.denominacion}</p>
                  <p className="text-xs text-on-surface-variant">{d.entidad} · Conv. {d.codigo_opec}</p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{d.motivo_descarte}: {d.brecha_principal}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guardar análisis completo */}
      {onGuardar && (
        <div className="card p-4 border-2 border-dashed border-primary/30 bg-primary/5 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>cloud_done</span>
            <p className="text-sm font-bold text-on-surface">
              {guardadoOk ? 'Análisis guardado con todo el contenido' : 'Guarda tu análisis completo'}
            </p>
          </div>
          {!guardadoOk && (
            <p className="text-xs text-on-surface-variant">
              Incluye las rutas estratégicas y todas las OPECs que hayas explorado en esta sesión.
            </p>
          )}
          <button
            onClick={onGuardar}
            disabled={guardando || guardadoOk}
            className={`w-full py-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm
              ${guardadoOk
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default'
                : 'bg-primary text-on-primary hover:bg-primary/90 active:scale-95 disabled:opacity-60'
              }`}
          >
            {guardando ? (
              <><div className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />Guardando...</>
            ) : guardadoOk ? (
              <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Guardado</>
            ) : (
              <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>Guardar análisis completo</>
            )}
          </button>
        </div>
      )}

      <button onClick={onReset} className="w-full py-3 border border-outline-variant rounded-full font-bold text-sm hover:bg-surface-container transition-all flex items-center justify-center gap-2 mt-1">
        <span className="material-symbols-outlined text-sm">person_search</span>
        Analizar otro perfil
      </button>
    </div>
  )
}

// ── Results: old format ────────────────────────────────────────────────────────
function ResultsOld({ analisis, onReset, navigate }) {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onReset} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="font-bold">Resultado del análisis</h2>
          {analisis.nivel_perfil && (
            <span className="inline-block mt-0.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Perfil: {analisis.nivel_perfil}</span>
          )}
        </div>
      </div>
      <div className="card p-5 bg-gradient-to-br from-primary/8 to-secondary/5 border border-primary/15">
        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
          Tu perfil profesional
        </p>
        <p className="text-sm text-on-surface leading-relaxed">{analisis.resumen_perfil}</p>
      </div>
      {(analisis.cargos_recomendados || []).length > 0 && (
        <div className="space-y-3">
          {analisis.cargos_recomendados.map((c, i) => <CargoCardOld key={i} cargo={c} index={i} />)}
        </div>
      )}
      {analisis.recomendacion_general && (
        <div className="card p-5 border border-secondary/20">
          <p className="text-xs font-bold text-secondary mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
            Recomendación del Asistente de Praxia
          </p>
          <p className="text-sm text-on-surface leading-relaxed">{analisis.recomendacion_general}</p>
        </div>
      )}
    </div>
  )
}

// ── Tooltip helper (portal — escapa overflow:hidden de cualquier contenedor) ──
function Tip({ text }) {
  const btnRef = useRef()
  const [pos, setPos] = useState(null)

  const show = () => {
    if (!btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 6, left: Math.min(r.left, window.innerWidth - 240) })
  }
  const hide = () => setPos(null)

  return (
    <span className="inline-flex items-center ml-1 cursor-help" onMouseEnter={show} onMouseLeave={hide}>
      <span ref={btnRef} className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center hover:bg-primary/20 hover:text-primary transition-colors select-none">?</span>
      {pos && createPortal(
        <span
          className="fixed z-[9999] w-56 bg-slate-800 text-white text-[11px] rounded-xl px-3 py-2 leading-relaxed shadow-xl pointer-events-none whitespace-normal font-normal"
          style={{ top: pos.top, left: pos.left }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AnalisisPerfil() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef()

  const [convocatorias, setConvocatorias] = useState([])
  const [convId, setConvId] = useState(searchParams.get('conv') || '')
  const [ciudadesDisp, setCiudadesDisp] = useState([])
  const [ciudadFiltro, setCiudadFiltro] = useState('')
  const [ciudadesLoading, setCiudadesLoading] = useState(false)
  const [pocasOpecLocal, setPocasOpecLocal] = useState(false)
  const [perfilTexto, setPerfilTexto] = useState('')
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [error, setError] = useState(null)
  const [showWompiBanner, setShowWompiBanner] = useState(
    !!(searchParams.get('id') && searchParams.get('env'))
  )
  const [analisis, setAnalisis] = useState(null)
  const [analisisId, setAnalisisId] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [opecsPendientes, setOpecsPendientes] = useState([])
  const [cargandoMas, setCargandoMas] = useState(false)
  const [historial, setHistorial] = useState([])
  const [activeHistId, setActiveHistId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [localAnalisis, setLocalAnalisis] = useState(null)
  const [opecCount, setOpecCount] = useState(null)
  const [plataformaUrl, setPlataformaUrl] = useState(null)
  const [plataformaNombre, setPlataformaNombre] = useState(null)
  const [simoConfirmado, setSimoConfirmado] = useState(false)
  const [showPrefs, setShowPrefs] = useState(false)
  const modeloAnalisis = 'gemini'
  const [showManual, setShowManual] = useState(false)
  const [showTicketConfirm, setShowTicketConfirm] = useState(false)
  const [ticketBalance, setTicketBalance] = useState(null)
  const [comprando, setComprando] = useState(false)
  const comprandoRef   = useRef(false)
  const analizandoRef  = useRef(false)
  const [ticketPrice, setTicketPrice]       = useState(2000)
  const [ticketCantidad, setTicketCantidad] = useState(1)
  const [preferencias, setPreferencias] = useState({
    objetivo_principal: 'estabilidad',
    acepta_nivel_inferior: 'true',
    disponibilidad_geografica: 'cualquier_ciudad',
    nivel_riesgo_aceptado: 'medio',
  })

  const { status: jobStatus, result: jobResult, jobError, runAnalysis, clearAnalysis,
          etapa: jobEtapa, mensajeEtapa, setMensajeEtapa, pctEtapa, setPctEtapa } = useAnalysis()

  // Si el usuario llega desde un redirect de Wompi (?id=...&env=...) refrescar tickets
  // cada 5 s hasta 5 intentos para capturar el webhook que puede demorar un poco
  useEffect(() => {
    if (!searchParams.get('id') || !searchParams.get('env')) return
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      fetchTickets()
      if (attempts >= 5) clearInterval(poll)
    }, 5000)
    return () => clearInterval(poll)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-ocultar el banner de Wompi 6 s después de que se confirman los tickets
  useEffect(() => {
    if (!showWompiBanner || ticketBalance === null || ticketBalance === 0) return
    const t = setTimeout(() => setShowWompiBanner(false), 6000)
    return () => clearTimeout(t)
  }, [showWompiBanner, ticketBalance])

  // Cuando el análisis termina (aunque el usuario haya navegado fuera y vuelto)
  useEffect(() => {
    if (jobStatus === 'done' && jobResult) {
      const json = jobResult
      setAnalisis({ ...json.analisis, _convNombre: json._convNombre || '' })
      setOpecsPendientes(json.opecs_pendientes || [])
      if (json.analisis_id) { setAnalisisId(json.analisis_id); setActiveHistId(json.analisis_id) }
      // El backend ya guardó el análisis automáticamente → marcar como guardado
      setGuardadoOk(true)
      if (json.pocas_opec_local) setPocasOpecLocal(true)
      if (json.plataforma_url) { setPlataformaUrl(json.plataforma_url); setPlataformaNombre(json.plataforma_nombre || null) }
      const entry = { analisis: json.analisis, convNombre: json._convNombre || '', ts: Date.now() }
      try { localStorage.setItem('praxia_last_analisis', JSON.stringify(entry)) } catch {}
      setLocalAnalisis(entry)
      fetchHistory()
      fetchTickets()   // actualizar saldo tras consumir ticket
      clearAnalysis()
    } else if (jobStatus === 'error' && jobError) {
      const raw = jobError || ''
      const esRed = raw.toLowerCase().includes('failed to fetch')
        || raw.toLowerCase().includes('networkerror')
        || raw.toLowerCase().includes('load failed')
        || raw.toLowerCase().includes('fetch failed')
      const friendly = esRed
        ? 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo en un momento.'
        : raw
      setError(friendly)
      fetchTickets()   // refrescar saldo (puede haber cambiado)
      clearAnalysis()
    }
  }, [jobStatus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar spinner con el estado del job
  useEffect(() => {
    if (jobStatus === 'processing') setAnalizando(true)
  }, [jobStatus])

  // Advertir si el usuario cierra/recarga la pestaña con análisis activo
  useEffect(() => {
    if (!analisis) return
    const handler = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [analisis])

  useEffect(() => {
    supabase.from('convocatorias').select('id, nombre, entidad, departamento, ciudad, plataforma_nombre, plataforma_url').eq('is_active', true).order('nombre')
      .then(({ data }) => setConvocatorias(data || []))
    fetchHistory()
    fetchTickets()
    fetchTicketPrice()
    try {
      const raw = localStorage.getItem('praxia_last_analisis')
      if (raw) setLocalAnalisis(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!convId) { setOpecCount(null); setCiudadesDisp([]); setCiudadFiltro(''); setCiudadesLoading(false); return }
    // conteo total
    supabase
      .from('opec_maestro')
      .select('id', { count: 'exact', head: true })
      .eq('convocatoria_id', parseInt(convId))
      .eq('is_active', true)
      .then(({ count }) => setOpecCount(count ?? 0))
    // ciudades disponibles desde OPECs — mostrar sección inmediatamente
    setCiudadFiltro('')
    setCiudadesDisp([])
    setCiudadesLoading(true)
    authHeaders().then(headers =>
      fetch(`${BASE}/api/ia/convocatorias/${convId}/ciudades`, { headers })
        .then(r => r.json())
        .then(json => { setCiudadesDisp(json.ciudades || []); setCiudadesLoading(false) })
        .catch(() => { setCiudadesDisp([]); setCiudadesLoading(false) })
    )
  }, [convId])

  async function fetchHistory() {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BASE}/api/ia/mis-analisis`, { headers })
      const json = await res.json()
      setHistorial(json.analisis || [])
    } catch { /* no crítico */ }
  }

  async function fetchTickets() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/tickets/balance`, { headers: h })
      if (r.ok) { const d = await r.json(); setTicketBalance(d.balance ?? 0) }
    } catch { setTicketBalance(0) }
  }

  async function fetchTicketPrice() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/tickets/precio`, { headers: h })
      if (r.ok) {
        const d = await r.json()
        setTicketPrice(d.precio_cop || 2000)
        setTicketCantidad(Math.max(1, d.cantidad_tickets || 1))
      }
    } catch { /* usa defaults */ }
  }

  async function comprarTickets() {
    if (comprandoRef.current) return   // bloqueo inmediato, no espera re-render
    comprandoRef.current = true
    setComprando(true)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/tickets/checkout`, { method: 'POST', headers: h })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Error generando checkout') }
      const { url } = await r.json()
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (e) {
      alert(e.message || 'No se pudo abrir el pago. Intenta de nuevo.')
    } finally {
      comprandoRef.current = false
      setComprando(false)
    }
  }

  function solicitarAnalisis() {
    if (analizandoRef.current || analizando) return
    if (!convId) { setError('Selecciona una convocatoria'); return }
    if (files.length === 0) { setError('Adjunta tu hoja de vida (PDF, imagen o Word) para continuar'); return }
    if (ticketBalance !== null && ticketBalance < 1) {
      setError('No tienes tickets disponibles. Compra un ticket para continuar.')
      return
    }
    setError(null)
    setShowTicketConfirm(true)
  }

  async function deleteAnalisis(id) {
    try {
      const headers = await authHeaders()
      await fetch(`${BASE}/api/ia/mis-analisis/${id}`, { method: 'DELETE', headers })
      setHistorial(prev => prev.filter(h => h.id !== id))
      if (activeHistId === id) { setAnalisis(null); setActiveHistId(null) }
    } catch { /* no crítico */ }
  }

  function addFiles(fileList) {
    const valid = Array.from(fileList).filter(f => ACCEPTED_EXTS.includes(f.name.split('.').pop().toLowerCase()))
    setFiles(prev => [...prev, ...valid])
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const convNombreActual = convocatorias.find(c => String(c.id) === convId)?.nombre || 'la convocatoria'
  const opecCountLabel   = opecCount != null ? opecCount.toLocaleString('es-CO') : '...'

  const LOAD_STEPS = [
    { icon: 'description',       text: 'Leyendo hoja de vida...' },
    { icon: 'person_search',     text: 'Extrayendo perfil profesional...' },
    { icon: 'event_note',        text: `Consultando ${convNombreActual}...` },
    { icon: 'manage_search',     text: `Analizando compatibilidad con ${opecCountLabel} OPECs...` },
    { icon: 'workspace_premium', text: 'Identificando mejores oportunidades...' },
    { icon: 'task_alt',          text: 'Armando resultado...' },
  ]

  async function reportarError({ tipo = 'otro', error_msg = '', etapa = null } = {}) {
    try {
      const headers = await authHeaders()
      const file    = files[0]
      await fetch(`${BASE}/api/reportes/error`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          analisis_id:    analisisId || null,
          convocatoria_id: convId   || null,
          file_name:      file?.name || null,
          file_size_mb:   file ? +(file.size / (1024 * 1024)).toFixed(2) : null,
          error_msg,
          etapa,
          user_agent: navigator.userAgent,
        }),
      })
      alert('¡Gracias! Tu reporte fue enviado. Lo revisaremos pronto.')
    } catch { /* no crítico */ }
  }

  // Mapeo: etapa SSE → índice en LOAD_STEPS
  const etapaToStep = { 1: 0, 2: 1, 3: 3, 4: 4, 5: 5 }

  async function analizar() {
    if (analizandoRef.current) return
    if (!convId) { setError('Selecciona una convocatoria'); return }
    if (files.length === 0) { setError('Adjunta tu hoja de vida (PDF, imagen o Word) para continuar'); return }
    analizandoRef.current = true
    setAnalizando(true); setLoadStep(0); setError(null); setAnalisis(null); setActiveHistId(null); setAnalisisId(null)
    setOpecsPendientes([]); setPocasOpecLocal(false); setPlataformaUrl(null); setPlataformaNombre(null); setGuardadoOk(false)

    const convNombre = convocatorias.find(c => String(c.id) === convId)?.nombre || ''
    const jobId      = crypto.randomUUID()

    // ── Conectar SSE para progreso en tiempo real ────────────────────────────
    let evtSource = null
    try {
      evtSource = new EventSource(`${BASE}/api/ia/analisis-perfil/progreso/${jobId}`)
      evtSource.addEventListener('progreso', (e) => {
        try {
          const data = JSON.parse(e.data)
          const step = etapaToStep[data.etapa]
          if (step !== undefined) setLoadStep(step)
          if (data.msg) setMensajeEtapa(data.msg)
          if (data.pct !== undefined) setPctEtapa(data.pct)
        } catch { /* no crítico */ }
      })
      evtSource.addEventListener('listo', () => evtSource?.close())
      evtSource.addEventListener('error', (e) => {
        if (e.data) {
          try { const d = JSON.parse(e.data); if (d.mensaje) setError(d.mensaje) } catch { /* */ }
        }
        evtSource?.close()
      })
    } catch { /* EventSource no disponible: el timer de fallback sigue andando */ }

    // Timer de fallback (avanza un paso si SSE no conectó o tarda más de lo esperado)
    const stepTimer = setInterval(() => {
      setLoadStep(s => (s < LOAD_STEPS.length - 1 ? s + 1 : s))
    }, 40_000)

    await runAnalysis(async () => {
      const headers = await authHeaders()
      const fd = new FormData()
      fd.append('convocatoria_id', convId)
      fd.append('perfil_texto', perfilTexto)
      fd.append('jobId', jobId)
      if (ciudadFiltro) fd.append('ciudad_filtro', ciudadFiltro)
      fd.append('preferencias', JSON.stringify(preferencias))
      fd.append('modelo', modeloAnalisis)
      if (files.length > 0) fd.append('pdf', files[0])
      const res  = await fetch(`${BASE}/api/ia/analisis-perfil`, { method: 'POST', headers, body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      return { ...json, _convNombre: convNombre }
    })

    clearInterval(stepTimer)
    evtSource?.close()
    analizandoRef.current = false
    setAnalizando(false)
    setLoadStep(0)
    setMensajeEtapa('')
    setPctEtapa(0)
  }

  function selectHistItem(item) {
    setAnalisis({ ...item.analisis, _convNombre: item.convocatoria_nombre || '' })
    setActiveHistId(item.id); setAnalisisId(item.id); setOpecsPendientes([]); setGuardadoOk(false); setShowHistory(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() { setAnalisis(null); setActiveHistId(null); setAnalisisId(null); setOpecsPendientes([]) }

  async function persistirAnalisis(analisisActualizado) {
    if (!analisisId) return
    try {
      const headers = await authHeaders()
      await fetch(`${BASE}/api/ia/mis-analisis/${analisisId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ analisis: analisisActualizado }),
      })
    } catch { /* no crítico */ }
  }

  async function guardarAnalisis() {
    if (!analisis || !analisisId || guardando) return
    setGuardando(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BASE}/api/ia/mis-analisis/${analisisId}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ analisis }),
      })
      if (res.ok) { setGuardadoOk(true); fetchHistory() }
    } catch { /* silencioso */ }
    finally { setGuardando(false) }
  }

  async function verMasOpecs() {
    if (!opecsPendientes.length || cargandoMas) return
    setCargandoMas(true)
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BASE}/api/ia/mas-opecs`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          convocatoria_id: convId,
          opecs_pendientes_ids: opecsPendientes,
          perfil_candidato: analisis?.perfil_candidato || null,
          ciudad_filtro: ciudadFiltro || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const nuevas = (json.nuevas_opecs || []).filter(o => (o.afinidad_porcentaje || 0) > 0)
      if (nuevas.length > 0) {
        setAnalisis(prev => {
          const actualizado = {
            ...prev,
            ranking_opec_recomendadas: [
              ...(prev.ranking_opec_recomendadas || []),
              ...nuevas,
            ].sort((a, b) => (b.afinidad_porcentaje || 0) - (a.afinidad_porcentaje || 0)),
          }
          persistirAnalisis(actualizado)
          return actualizado
        })
      }
      setOpecsPendientes(json.opecs_pendientes || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setCargandoMas(false)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-outline-variant/20 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold font-headline">Análisis de Perfil</h1>
            <p className="text-xs text-on-surface-variant hidden sm:block">El Asistente de Praxia compara tu hoja de vida con los cargos disponibles</p>
          </div>
          <button
            onClick={() => setShowManual(true)}
            className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-full transition-all flex-shrink-0"
          >
            <span className="material-symbols-outlined text-sm">help_outline</span>
            <span className="hidden sm:inline">¿Cómo funciona?</span>
            <span className="sm:hidden">?</span>
          </button>
          {(historial.length > 0 || localAnalisis) && (
            <button
              onClick={() => setShowHistory(s => !s)}
              className="lg:hidden flex items-center gap-1 text-xs font-bold text-primary bg-primary/10 px-2.5 py-1.5 rounded-full flex-shrink-0"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              {historial.length > 0
                ? <><span>{historial.length}</span><span className="hidden sm:inline"> guardado{historial.length !== 1 ? 's' : ''}</span></>
                : <span className="hidden sm:inline">Último</span>}
            </button>
          )}
        </div>
      </div>

      {/* Banner pago Wompi — dos estados: verificando / exitoso */}
      {showWompiBanner && (
        <div className="max-w-7xl mx-auto px-4 pt-3">
          {ticketBalance !== null && ticketBalance > 0 ? (
            /* ── Estado exitoso ─────────────────────────────────────── */
            <div className="relative overflow-hidden flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg shadow-green-500/25 animate-fade-in">
              {/* Fondo decorativo */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-10">
                <span className="material-symbols-outlined text-[80px]" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-base leading-tight">¡Pago exitoso! Tu ticket está listo</p>
                <p className="text-sm opacity-90 mt-0.5">
                  Tienes <strong>{ticketBalance}</strong> ticket{ticketBalance !== 1 ? 's' : ''} disponible{ticketBalance !== 1 ? 's' : ''} — ya puedes analizar tu perfil
                </p>
              </div>
              <span className="material-symbols-outlined text-3xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <button
                onClick={() => setShowWompiBanner(false)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          ) : (
            /* ── Estado verificando ─────────────────────────────────── */
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-green-50 border border-green-200 animate-fade-in">
              <span className="material-symbols-outlined text-green-600 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-green-800">Verificando tu pago con Wompi...</p>
                <p className="text-xs text-green-600 mt-0.5">El saldo se actualiza automáticamente en unos segundos.</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 pb-28">
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">

          {/* Main */}
          <div className="space-y-5 min-w-0">
            {/* Form */}
            {!analisis && (
              <div className="card p-4 sm:p-5 space-y-4 sm:space-y-5 animate-fade-in">

                {/* 1. Convocatoria */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center">Convocatoria<Tip text="Selecciona el concurso público al que quieres aplicar. Praxia buscará los cargos disponibles dentro de esa convocatoria y los comparará con tu perfil." /></label>
                  <select
                    value={convId}
                    onChange={e => setConvId(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Selecciona una convocatoria</option>
                    {convocatorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>

                {/* 2. Filtro de ciudad — aparece inmediatamente al seleccionar convocatoria */}
                {convId && (ciudadesLoading || ciudadesDisp.length > 0) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        ¿Dónde quieres aplicar?<Tip text="Filtra los cargos por ciudad. Si seleccionas una ciudad, solo verás OPECs con vacantes en ese lugar. Deja en 'Todo Colombia' para ver todas las oportunidades." />
                      </label>
                      {ciudadFiltro && (
                        <button onClick={() => setCiudadFiltro('')} className="text-[10px] text-primary font-bold flex items-center gap-0.5 hover:underline">
                          <span className="material-symbols-outlined text-xs">close</span>
                          Ver todo Colombia
                        </button>
                      )}
                    </div>
                    {ciudadesLoading ? (
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant p-3 bg-surface-container-low rounded-xl">
                        <span className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                        Cargando ciudades disponibles...
                      </div>
                    ) : (
                      <select
                        value={ciudadFiltro}
                        onChange={e => setCiudadFiltro(e.target.value)}
                        className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Todo Colombia ({opecCount ?? '...'} OPECs)</option>
                        {ciudadesDisp.map(c => (
                          <option key={c.ciudad} value={c.ciudad}>
                            {c.ciudad} — {c.opecs} OPEC{c.opecs !== 1 ? 's' : ''} · {c.vacantes} vacante{c.vacantes !== 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {ciudadFiltro && (() => {
                      const info = ciudadesDisp.find(c => c.ciudad === ciudadFiltro)
                      return info ? (
                        <p className="text-[11px] text-primary font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>adjust</span>
                          {info.opecs} cargo{info.opecs !== 1 ? 's' : ''} con vacantes en {ciudadFiltro} · {info.vacantes} vacante{info.vacantes !== 1 ? 's' : ''}
                        </p>
                      ) : null
                    })()}
                  </div>
                )}

                {/* SIMO */}
                <label className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all select-none
                  ${simoConfirmado
                    ? 'border-green-500/50 bg-green-50 dark:bg-green-900/20'
                    : 'border-outline-variant/40 hover:border-primary/40 hover:bg-primary/5'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all
                    ${simoConfirmado ? 'bg-green-500' : 'bg-surface-container'}`}>
                    <span className="material-symbols-outlined text-lg text-white" style={{ fontVariationSettings: simoConfirmado ? "'FILL' 1" : "'FILL' 0" }}>
                      {simoConfirmado ? 'verified' : 'fact_check'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold leading-tight ${simoConfirmado ? 'text-green-700 dark:text-green-400' : 'text-on-surface'}`}>
                      {simoConfirmado ? 'HV verificada en SIMO ✓' : 'Verificar HV en SIMO'}
                    </p>
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      Confirma que tus datos están registrados en SIMO-OPEC ·{' '}
                      <a href="https://simo-opec.cnsc.gov.co/" target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="text-primary font-semibold hover:underline">Abrir SIMO</a>
                    </p>
                  </div>
                  <input type="checkbox" checked={simoConfirmado} onChange={e => setSimoConfirmado(e.target.checked)} className="hidden" />
                </label>

                {/* Preferencias estratégicas — siempre visible */}
                <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/10">
                    <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
                    <p className="text-xs font-extrabold text-primary uppercase tracking-wider">Preferencias estratégicas</p>
                    <span className="ml-auto text-[10px] text-on-surface-variant/60">Personaliza tus 4 rutas</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center">Objetivo principal<Tip text="Define qué priorizas en tu carrera. Praxia ajustará las 4 rutas estratégicas según este objetivo: estabilidad (cargos seguros), crecimiento (progresión de carrera), salario máximo (grados altos) o primer empleo público (cargos accesibles)." /></label>
                      </div>
                      <select value={preferencias.objetivo_principal}
                        onChange={e => setPreferencias(p => ({ ...p, objetivo_principal: e.target.value }))}
                        className="w-full bg-surface rounded-xl py-2.5 px-3 text-sm font-medium border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                        <option value="estabilidad">🏛️ Estabilidad laboral</option>
                        <option value="crecimiento">📈 Crecimiento de carrera</option>
                        <option value="salario_maximo">💰 Maximizar salario</option>
                        <option value="primer_empleo_publico">🎯 Primer empleo público</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center">Disponibilidad<Tip text="¿Estás dispuesto a moverte de ciudad o departamento? Si seleccionas 'Solo mi ciudad', las rutas se enfocarán en cargos locales. 'Todo Colombia' maximiza las oportunidades." /></label>
                      </div>
                      <select value={preferencias.disponibilidad_geografica}
                        onChange={e => setPreferencias(p => ({ ...p, disponibilidad_geografica: e.target.value }))}
                        className="w-full bg-surface rounded-xl py-2.5 px-3 text-sm font-medium border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                        <option value="cualquier_ciudad">🇨🇴 Todo Colombia</option>
                        <option value="solo_ciudad_seleccionada">📍 Solo mi ciudad</option>
                        <option value="mismo_departamento">🗺️ Mi departamento</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center">Tolerancia al riesgo<Tip text="Define qué tan ambicioso quieres ser. 'Baja' solo muestra cargos donde cumples todos los requisitos. 'Alta' incluye cargos donde hay brechas pero tienes potencial de clasificar si te preparas bien." /></label>
                      </div>
                      <select value={preferencias.nivel_riesgo_aceptado}
                        onChange={e => setPreferencias(p => ({ ...p, nivel_riesgo_aceptado: e.target.value }))}
                        className="w-full bg-surface rounded-xl py-2.5 px-3 text-sm font-medium border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                        <option value="bajo">🟢 Baja — solo lo que cumple todo</option>
                        <option value="medio">🟡 Media — acepto algunas brechas</option>
                        <option value="alto">🔴 Alta — ruta ambiciosa al máximo</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>stairs</span>
                        <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider flex items-center">Nivel de cargo<Tip text="¿Aceptas cargos de un grado o nivel inferior al tuyo? 'Incluir todos los niveles' amplía las opciones. 'Solo mi nivel o superior' filtra solo cargos acordes a tu formación actual." /></label>
                      </div>
                      <select value={preferencias.acepta_nivel_inferior}
                        onChange={e => setPreferencias(p => ({ ...p, acepta_nivel_inferior: e.target.value }))}
                        className="w-full bg-surface rounded-xl py-2.5 px-3 text-sm font-medium border border-outline-variant/30 outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
                        <option value="true">✅ Incluir todos los niveles</option>
                        <option value="false">⬆️ Solo mi nivel o superior</option>
                      </select>
                    </div>

                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
                    Hoja de vida
                    <span className="text-on-surface-variant/60 normal-case font-normal">— PDF, imagen, Word o TXT</span>
                    <Tip text="Adjunta tu hoja de vida. Praxia la lee automáticamente y extrae tu perfil: formación, experiencia, funciones y competencias. Acepta PDF, imágenes (JPG/PNG), Word (.doc/.docx) y TXT. Puedes subir hasta 20 MB." />
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-4 sm:p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all select-none
                      ${dragging ? 'border-primary bg-primary/8 scale-[1.01]' : 'border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container-low'}`}
                  >
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
                    <p className="text-sm font-semibold text-on-surface">{dragging ? 'Suelta aquí' : 'Arrastra o haz clic para adjuntar'}</p>
                    <p className="text-xs text-on-surface-variant text-center">PDF · Imágenes (JPG, PNG) · Word · TXT · sin límite de tamaño</p>
                    <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={e => addFiles(e.target.files)} />
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-surface-container rounded-lg">
                          <span className="material-symbols-outlined text-primary text-sm flex-shrink-0">description</span>
                          <span className="text-xs text-on-surface flex-1 truncate">{f.name}</span>
                          <span className="text-xs text-on-surface-variant flex-shrink-0">
                            {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`}
                          </span>
                          <button onClick={e => { e.stopPropagation(); removeFile(i) }} className="text-on-surface-variant hover:text-error transition-colors flex-shrink-0">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-error-container text-error rounded-xl text-sm flex items-start gap-2">
                    <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">error</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-snug">{error}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {(error.includes('conectar') || error.includes('conexión') || error.includes('Intenta de nuevo') || error.includes('intenta de nuevo')) && (
                          <button
                            onClick={() => { setError(null); solicitarAnalisis() }}
                            className="text-xs font-bold underline hover:no-underline"
                          >
                            Reintentar
                          </button>
                        )}
                        <button
                          onClick={() => reportarError({ tipo: 'analisis', error_msg: error })}
                          className="text-xs font-semibold opacity-70 hover:opacity-100 flex items-center gap-1 underline hover:no-underline"
                        >
                          <span className="material-symbols-outlined text-xs">flag</span>
                          Reportar problema
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {analizando ? (
                  <div className="card p-4 sm:p-6 space-y-4 animate-fade-in">
                    {/* Header: spinner + título activo */}
                    <div className="flex items-center gap-4 pb-3 border-b border-outline-variant/20">
                      <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
                        <span className="material-symbols-outlined text-xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {LOAD_STEPS[loadStep]?.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-on-surface leading-snug line-clamp-2">
                          {mensajeEtapa || LOAD_STEPS[loadStep]?.text}
                        </p>
                        <p className="text-xs text-on-surface-variant mt-0.5 hidden sm:block">El Asistente de Praxia está trabajando en tu análisis...</p>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    {pctEtapa > 0 && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-on-surface-variant">
                          <span>Procesando...</span>
                          <span className="font-bold text-primary">{pctEtapa}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${pctEtapa}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Lista de pasos */}
                    <div className="space-y-1">
                      {LOAD_STEPS.map((step, i) => {
                        const done   = i < loadStep
                        const active = i === loadStep
                        return (
                          <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-500
                            ${active ? 'bg-primary/8' : done ? 'bg-green-50 dark:bg-green-900/10' : ''}`}>
                            {done ? (
                              <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                              </span>
                            ) : active ? (
                              <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                              </span>
                            ) : (
                              <span className="w-5 h-5 rounded-full border-2 border-outline-variant/40 flex items-center justify-center flex-shrink-0">
                                <span className="text-[9px] font-bold text-on-surface-variant">{i + 1}</span>
                              </span>
                            )}
                            <p className={`text-xs sm:text-sm leading-snug transition-all line-clamp-2
                              ${done ? 'text-green-700 dark:text-green-400 font-medium' : active ? 'font-bold text-primary' : 'text-on-surface-variant/50'}`}>
                              {active && mensajeEtapa ? mensajeEtapa : step.text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!simoConfirmado && (
                      <button
                        type="button"
                        onClick={() => setSimoConfirmado(true)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all text-left"
                      >
                        <span className="material-symbols-outlined text-amber-500 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-snug flex-1">
                          Verifica tu HV en SIMO antes de analizar para mayor precisión — toca aquí para confirmar
                        </p>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-200 dark:bg-amber-800 px-2 py-1 rounded-lg whitespace-nowrap flex-shrink-0">Confirmar</span>
                      </button>
                    )}
                    {/* Saldo de tickets */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                      <span className="material-symbols-outlined text-primary text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Tickets de análisis</p>
                        <p className="text-sm font-extrabold text-primary leading-tight flex items-center gap-1 flex-wrap">
                          {ticketBalance === null ? '...' : ticketBalance} ticket{ticketBalance !== 1 ? 's' : ''} disponibles
                          <Tip text="Cada análisis de perfil cuesta 1 ticket. Los tickets se compran por separado con Wompi. Un ticket te da acceso a 1 análisis completo con 4 rutas estratégicas personalizadas." />
                          <button
                            onClick={fetchTickets}
                            title="Actualizar saldo"
                            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                          >
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '13px' }}>refresh</span>
                          </button>
                        </p>
                      </div>
                      <button
                        onClick={comprarTickets}
                        disabled={comprando}
                        className="text-xs font-bold text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-full transition-all disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                      >
                        {comprando ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
                        {ticketCantidad > 1 ? `Comprar ${ticketCantidad} tickets` : 'Comprar'} — ${ticketPrice.toLocaleString('es-CO')}
                      </button>
                    </div>

                    <button
                      onClick={solicitarAnalisis}
                      className="w-full py-4 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-primary/20
                        bg-gradient-to-r from-primary to-primary/80 text-on-primary hover:from-primary/90 hover:to-primary active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_search</span>
                      Analizar mi perfil
                      <span className="material-symbols-outlined text-base opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Banner: pocas OPECs locales → sugerir Todo Colombia */}
            {analisis && pocasOpecLocal && ciudadFiltro && (
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 animate-fade-in">
                <span className="material-symbols-outlined text-amber-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>travel_explore</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-amber-800">Pocos cargos en {ciudadFiltro}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">El análisis se hizo con todos los cargos disponibles. Para ver más oportunidades, analiza sin filtro de ciudad.</p>
                </div>
                <button
                  onClick={() => { setCiudadFiltro(''); resetForm() }}
                  className="text-[11px] font-bold text-amber-700 bg-amber-200 hover:bg-amber-300 px-2.5 py-1.5 rounded-full flex-shrink-0 transition-all whitespace-nowrap"
                >
                  Ver Todo Colombia
                </button>
              </div>
            )}

            {/* Results */}
            {analisis && (
              <ErrorBoundary fallback={
                <div className="card p-6 text-center space-y-4 animate-fade-in">
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-40">broken_image</span>
                  <p className="font-bold text-on-surface">No se pudo mostrar este análisis</p>
                  <p className="text-xs text-on-surface-variant">El análisis tiene un formato incompatible con esta versión. Genera uno nuevo para ver los resultados actualizados.</p>
                  <button onClick={resetForm} className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-all">
                    <span className="material-symbols-outlined text-sm">arrow_back</span>Volver al formulario
                  </button>
                </div>
              }>
                {isNewFormat(analisis)
                  ? <ResultsNew analisis={analisis} onReset={resetForm} navigate={navigate} opecsPendientes={opecsPendientes} cargandoMas={cargandoMas} onVerMas={verMasOpecs} plataformaUrl={plataformaUrl} plataformaNombre={plataformaNombre} onGuardar={guardarAnalisis} guardando={guardando} guardadoOk={guardadoOk} />
                  : <ResultsOld analisis={analisis} onReset={resetForm} navigate={navigate} />}
              </ErrorBoundary>
            )}
          </div>

          {/* Sidebar */}
          <aside className={`mt-5 lg:mt-0 ${showHistory ? 'block' : 'hidden'} lg:block`}>
            <div className="lg:sticky lg:top-[65px] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">history</span>
                  Mis análisis guardados
                </p>
                {historial.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{historial.length}</span>
                )}
              </div>
              {historial.length === 0 && !localAnalisis ? (
                <div className="text-center py-10 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30">folder_open</span>
                  <p className="text-xs mt-2 opacity-60">Aún no tienes análisis guardados</p>
                  <p className="text-xs opacity-40">Cada análisis se guarda automáticamente</p>
                </div>
              ) : historial.length > 0 ? (
                <div className="space-y-2">
                  {historial.map(item => (
                    <HistoryCard key={item.id} item={item} active={activeHistId === item.id} onSelect={selectHistItem} onDelete={deleteAnalisis} />
                  ))}
                </div>
              ) : localAnalisis ? (
                <div className="space-y-2">
                  <button
                    onClick={() => { setAnalisis(localAnalisis.analisis); setActiveHistId('local'); setShowHistory(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${activeHistId === 'local' ? 'border-primary/40 bg-primary/8' : 'border-outline-variant/30 hover:border-primary/20 hover:bg-surface-container-low'}`}
                  >
                    <div className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-sm mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-on-surface truncate">{localAnalisis.convNombre || 'Último análisis'}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          {new Date(localAnalisis.ts).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                          solo en este dispositivo
                        </span>
                      </div>
                    </div>
                  </button>
                  <p className="text-[10px] text-on-surface-variant/60 px-1 leading-relaxed">
                    Para guardar permanentemente, pide al admin que ejecute la migración SQL en Supabase.
                  </p>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>

      {/* ── Modal: Confirmación de ticket ── */}
      {showTicketConfirm && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowTicketConfirm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-fade-in shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
              </div>
              <h3 className="font-extrabold text-lg text-on-surface">¿Iniciar análisis?</h3>
              <p className="text-sm text-on-surface-variant mt-1">Esta acción consumirá <strong>1 ticket</strong> de análisis de perfil</p>
              {ticketCantidad > 1 && (
                <p className="text-xs text-primary font-semibold mt-1">💡 Recuerda que comprando obtienes {ticketCantidad} tickets</p>
              )}
            </div>
            <div className="flex items-center gap-3 p-3.5 bg-primary/5 rounded-xl mb-5 border border-primary/15">
              <span className="material-symbols-outlined text-primary text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">Tu saldo actual</p>
                <p className="text-sm font-extrabold text-primary">
                  {ticketBalance === null ? '...' : ticketBalance} ticket{ticketBalance !== 1 ? 's' : ''} disponibles
                </p>
              </div>
              {ticketBalance === 0 && (
                <button onClick={() => { setShowTicketConfirm(false); comprarTickets() }}
                  className="text-[11px] font-bold text-white bg-primary px-3 py-1.5 rounded-full">
                  Comprar
                </button>
              )}
            </div>
            {ticketBalance === 0 && (
              <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                No tienes tickets disponibles. Compra 1 ticket por <strong>${ticketPrice.toLocaleString('es-CO')} COP</strong> con Wompi para continuar.
              </p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowTicketConfirm(false)}
                className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-sm font-bold hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => { setShowTicketConfirm(false); analizar() }}
                disabled={ticketBalance === 0}
                className="flex-[2] py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white text-sm font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>person_search</span>
                Analizar — 1 ticket
                {ticketCantidad > 1 && <span className="text-xs opacity-70 font-normal">({ticketCantidad} disponibles)</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Manual / ¿Cómo funciona? ── */}
      {showManual && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-4" onClick={() => setShowManual(false)}>
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-fade-in shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl p-5 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-emerald-700 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>help</span>
              </div>
              <div>
                <h3 className="font-extrabold text-on-surface">¿Cómo funciona el Análisis de Perfil?</h3>
                <p className="text-xs text-on-surface-variant">Manual completo de la herramienta Praxia</p>
              </div>
              <button onClick={() => setShowManual(false)}
                className="ml-auto w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors flex-shrink-0">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Resumen general */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-sm font-bold text-emerald-800 mb-1">¿Qué es el Análisis de Perfil?</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Es una herramienta de Inteligencia Artificial que compara tu hoja de vida con todos los cargos disponibles en una convocatoria del sector público colombiano.
                  Como resultado obtienes <strong>4 rutas estratégicas personalizadas</strong> con los cargos donde tienes más probabilidad de clasificar.
                </p>
              </div>

              {[
                {
                  icon: 'event_note', color: 'text-blue-600 bg-blue-50',
                  title: 'Convocatoria',
                  body: 'Selecciona el concurso público al que quieres aplicar (CNSC, DIAN, Procuraduría, etc.). Praxia buscará todos los OPECs activos de esa convocatoria y los comparará uno a uno con tu perfil. Puedes filtrar por ciudad si solo te interesan cargos en un lugar específico.',
                },
                {
                  icon: 'fact_check', color: 'text-green-600 bg-green-50',
                  title: 'Verificación SIMO',
                  body: 'SIMO-OPEC es el sistema oficial del CNSC donde debes registrar tu hoja de vida para aplicar a concursos. Confirmar que tu HV está registrada en SIMO mejora la precisión del análisis, ya que el sistema considera si tu información está alineada con los requisitos legales del proceso.',
                },
                {
                  icon: 'tune', color: 'text-purple-600 bg-purple-50',
                  title: 'Preferencias estratégicas',
                  body: 'Personaliza cómo Praxia construye tus 4 rutas. Puedes elegir tu objetivo (estabilidad, crecimiento, salario máximo o primer empleo público), tu tolerancia al riesgo (cargos donde cumples todo vs. cargos ambiciosos con brechas), tu disponibilidad geográfica y si aceptas cargos de menor nivel.',
                },
                {
                  icon: 'upload_file', color: 'text-orange-600 bg-orange-50',
                  title: 'Hoja de vida (HV)',
                  body: 'Adjunta tu hoja de vida en cualquier formato: PDF, imágenes (JPG/PNG), Word (.doc/.docx) o TXT. Praxia lee automáticamente el documento con Inteligencia Artificial y extrae tu perfil completo: títulos académicos, experiencia laboral, funciones, competencias y más. Entre más completa y actualizada esté tu HV, mejor será el análisis.',
                },
                {
                  icon: 'confirmation_number', color: 'text-primary bg-primary/10',
                  title: 'Sistema de tickets',
                  body: 'Cada análisis de perfil cuesta 1 ticket. Los tickets se compran individualmente con Wompi (pasarela de pago segura de Colombia) a $2.000 COP por análisis. Los tickets no vencen — los puedes usar cuando quieras. Puedes ver tu saldo en la parte de abajo del formulario.',
                },
                {
                  icon: 'route', color: 'text-teal-600 bg-teal-50',
                  title: 'Las 4 rutas estratégicas',
                  body: '• Ruta principal: el cargo con mayor compatibilidad global con tu perfil.\n• Ruta segura: el cargo donde tienes mayor probabilidad de clasificar en la fase escrita.\n• Ruta estratégica: la mejor relación entre esfuerzo de preparación y retorno (salario/estabilidad).\n• Ruta ambiciosa: el cargo de mayor aspiración donde tienes potencial aunque haya brechas.',
                },
                {
                  icon: 'manage_search', color: 'text-rose-600 bg-rose-50',
                  title: 'Ver más OPECs',
                  body: 'Después del análisis puedes explorar más cargos más allá de los 4 principales. Praxia tiene en cola todos los OPECs compatibles con tu perfil, ordenados por afinidad. Puedes cargarlos en bloques para encontrar más oportunidades.',
                },
                {
                  icon: 'history', color: 'text-slate-600 bg-slate-50',
                  title: 'Historial de análisis',
                  body: 'Todos tus análisis quedan guardados automáticamente. Puedes acceder a ellos desde el panel derecho (o el ícono de historial en móvil) para comparar resultados entre diferentes convocatorias o fechas.',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <div className={`w-9 h-9 rounded-xl ${item.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-on-surface mb-1">{item.title}</p>
                    <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-line">{item.body}</p>
                  </div>
                </div>
              ))}

              <div className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-xs text-on-surface-variant">¿Tienes dudas? Escríbele a <strong>Praxia</strong> desde el chat en el panel lateral.</p>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
