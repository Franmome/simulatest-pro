import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
const generarAnalisisPDF = (...args) =>
  import('../utils/generarAnalisisPDF').then(m => m.generarAnalisisPDF(...args))

const BASE = import.meta.env.VITE_API_URL || ''

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
                    {f}
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
function CargoCard({ opec, index }) {
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
        className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold rounded-lg transition-all ${
          tab === id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
        }`}
      >
        <span className="material-symbols-outlined text-sm">{icon}</span>
        <span className="hidden sm:inline">{label}</span>
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
          <p className="text-xs text-on-surface-variant mt-0.5">
            {opec.entidad && <span>{opec.entidad} · </span>}
            Conv. {opec.codigo_opec ?? opec.convocatoria ?? '—'}
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
                        {a}
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
                        {d}
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
                      <span key={j} className="text-xs bg-surface-container text-on-surface px-2 py-0.5 rounded-full">{f}</span>
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
                      <span key={j} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{p}</span>
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
                        {c}
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
  const top = item.analisis?.ranking_opec_recomendadas?.[0] ?? item.analisis?.cargos_recomendados?.[0]
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
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-surface-container hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <span className="material-symbols-outlined text-xs text-on-surface-variant hover:text-red-500" style={{ fontSize: '13px' }}>close</span>
      </button>
    </div>
  )
}

// ── Results: new format ────────────────────────────────────────────────────────
function ResultsNew({ analisis, onReset, navigate, opecsPendientes = [], cargandoMas = false, onVerMas }) {
  const perfil = analisis.perfil_candidato || {}
  const diag = analisis.diagnostico_general || {}
  const top = analisis.opec_mas_recomendada || {}
  const ranking = analisis.ranking_opec_recomendadas || []
  const recomendaciones = analisis.recomendaciones_para_mejorar_hoja_de_vida || {}
  const acciones = analisis.acciones_prioritarias || []
  const descartados = analisis.cargos_descartados_relevantes || []

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={onReset} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1">
          <h2 className="font-bold">Resultado del análisis</h2>
          {diag.nivel_competitividad && (
            <span className="inline-block mt-0.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">{diag.nivel_competitividad}</span>
          )}
        </div>
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
        <div className="card p-5 bg-gradient-to-br from-primary/8 to-secondary/5 border border-primary/15">
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
            <div className="mt-3 space-y-1">
              {perfil.alertas_validacion.map((a, i) => (
                <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1">
                  <span className="material-symbols-outlined text-xs mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  {a}
                </p>
              ))}
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
                      {f}
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
                      {d}
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

      {/* Ranking */}
      {ranking.length > 0 && (
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            Cargos recomendados para ti
          </p>
          <div className="space-y-3">
            {ranking.map((opec, i) => <CargoCard key={i} opec={opec} index={i} />)}
          </div>

          {/* Botón Ver más OPECs */}
          {(opecsPendientes.length > 0 || cargandoMas) && (
            <button
              onClick={onVerMas}
              disabled={cargandoMas}
              className="w-full mt-3 py-3 rounded-xl border-2 border-dashed border-primary/40 text-primary font-bold text-sm hover:bg-primary/5 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cargandoMas ? (
                <>
                  <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Buscando más OPECs compatibles...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">add_circle</span>
                  Ver {Math.min(opecsPendientes.length, 3)} OPECs más ({opecsPendientes.length} pendientes)
                </>
              )}
            </button>
          )}
        </div>
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

      <div className="flex gap-3 pt-1">
        <button onClick={onReset} className="w-full py-3 border border-outline-variant rounded-full font-bold text-sm hover:bg-surface-container transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">person_search</span>
          Analizar otro perfil
        </button>
      </div>
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
      <div className="flex gap-3 pt-1">
        <button
          onClick={() => generarAnalisisPDF(analisis, analisis._convNombre || '')}
          className="flex-1 py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
          Descargar análisis
        </button>
        <button onClick={onReset} className="flex-1 py-3 border border-outline-variant rounded-full font-bold text-sm hover:bg-surface-container transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">person_search</span>
          Nuevo análisis
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function AnalisisPerfil() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef()

  const [convocatorias, setConvocatorias] = useState([])
  const [convId, setConvId] = useState(searchParams.get('conv') || '')
  const [perfilTexto, setPerfilTexto] = useState('')
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [loadStep, setLoadStep] = useState(0)
  const [error, setError] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [opecsPendientes, setOpecsPendientes] = useState([])
  const [cargandoMas, setCargandoMas] = useState(false)
  const [historial, setHistorial] = useState([])
  const [activeHistId, setActiveHistId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)
  const [localAnalisis, setLocalAnalisis] = useState(null)
  const [opecCount,     setOpecCount]     = useState(null)

  useEffect(() => {
    supabase.from('convocatorias').select('id, nombre, entidad').eq('is_active', true).order('nombre')
      .then(({ data }) => setConvocatorias(data || []))
    fetchHistory()
    try {
      const raw = localStorage.getItem('praxia_last_analisis')
      if (raw) setLocalAnalisis(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (!convId) { setOpecCount(null); return }
    supabase
      .from('opec_maestro')
      .select('id', { count: 'exact', head: true })
      .eq('convocatoria_id', parseInt(convId))
      .eq('is_active', true)
      .then(({ count }) => setOpecCount(count ?? 0))
  }, [convId])

  async function fetchHistory() {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BASE}/api/ia/mis-analisis`, { headers })
      const json = await res.json()
      setHistorial(json.analisis || [])
    } catch { /* no crítico */ }
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

  async function analizar() {
    if (!convId) { setError('Selecciona una convocatoria'); return }
    if (!perfilTexto.trim() && files.length === 0) { setError('Escribe tu perfil o adjunta tu hoja de vida'); return }
    setAnalizando(true); setLoadStep(0); setError(null); setAnalisis(null); setActiveHistId(null); setOpecsPendientes([])

    // avanzar pasos ~45s cada uno (análisis tarda 5-10 min)
    const stepTimer = setInterval(() => {
      setLoadStep(s => (s < LOAD_STEPS.length - 1 ? s + 1 : s))
    }, 45000)
    try {
      const headers = await authHeaders()
      const fd = new FormData()
      fd.append('convocatoria_id', convId)
      fd.append('perfil_texto', perfilTexto)
      if (files.length > 0) fd.append('pdf', files[0])
      const res = await fetch(`${BASE}/api/ia/analisis-perfil`, { method: 'POST', headers, body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const convNombre = convocatorias.find(c => String(c.id) === convId)?.nombre || ''
      setAnalisis({ ...json.analisis, _convNombre: convNombre })
      setOpecsPendientes(json.opecs_pendientes || [])
      // guardar localmente como respaldo
      const entry = { analisis: json.analisis, convNombre, ts: Date.now() }
      try { localStorage.setItem('praxia_last_analisis', JSON.stringify(entry)) } catch { /* ignore */ }
      setLocalAnalisis(entry)
      fetchHistory()
    } catch (e) {
      setError(e.message)
    } finally {
      clearInterval(stepTimer)
      setAnalizando(false)
      setLoadStep(0)
    }
  }

  function selectHistItem(item) {
    setAnalisis({ ...item.analisis, _convNombre: item.convocatoria_nombre || '' })
    setActiveHistId(item.id); setOpecsPendientes([]); setShowHistory(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() { setAnalisis(null); setActiveHistId(null); setOpecsPendientes([]) }

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
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const nuevas = json.nuevas_opecs || []
      if (nuevas.length > 0) {
        setAnalisis(prev => ({
          ...prev,
          ranking_opec_recomendadas: [
            ...(prev.ranking_opec_recomendadas || []),
            ...nuevas,
          ].sort((a, b) => (b.afinidad_porcentaje || 0) - (a.afinidad_porcentaje || 0)),
        }))
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
          <button onClick={() => navigate('/material-estudio')} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold font-headline">Análisis de Perfil</h1>
            <p className="text-xs text-on-surface-variant hidden sm:block">El Asistente de Praxia compara tu hoja de vida con los cargos disponibles</p>
          </div>
          {(historial.length > 0 || localAnalisis) && (
            <button
              onClick={() => setShowHistory(s => !s)}
              className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-2 rounded-full"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              {historial.length > 0 ? `${historial.length} guardado${historial.length !== 1 ? 's' : ''}` : 'Último análisis'}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 pb-28">
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">

          {/* Main */}
          <div className="space-y-5 min-w-0">
            {/* Form */}
            {!analisis && (
              <div className="card p-5 space-y-5 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Convocatoria</label>
                  <select
                    value={convId}
                    onChange={e => setConvId(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Selecciona una convocatoria</option>
                    {convocatorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cuéntanos tu perfil</label>
                  <textarea
                    value={perfilTexto}
                    onChange={e => setPerfilTexto(e.target.value)}
                    rows={5}
                    placeholder="Ejemplo: Soy abogado con 4 años de experiencia en contratación estatal. Tengo especialización en derecho administrativo y he trabajado en alcaldías en el área jurídica..."
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Documentos de hoja de vida{' '}
                    <span className="text-on-surface-variant/60 normal-case font-normal">(opcional · PDF, imágenes, Word, TXT)</span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all select-none
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
                  <div className="p-3 bg-error-container text-error rounded-xl text-sm font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {error}
                  </div>
                )}

                {analizando ? (
                  <div className="card p-6 space-y-4 animate-fade-in">
                    {/* Spinner + texto activo */}
                    <div className="flex items-center gap-4 pb-2 border-b border-outline-variant/20">
                      <div className="relative w-12 h-12 flex-shrink-0 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full border-[3px] border-primary/20" />
                        <div className="absolute inset-0 rounded-full border-[3px] border-primary border-t-transparent animate-spin" />
                        <span className="material-symbols-outlined text-xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                          {LOAD_STEPS[loadStep]?.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-on-surface leading-snug">{LOAD_STEPS[loadStep]?.text}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">El Asistente de Praxia está trabajando en tu análisis...</p>
                      </div>
                    </div>

                    {/* Lista de pasos */}
                    <div className="space-y-1">
                      {LOAD_STEPS.map((step, i) => {
                        const done    = i < loadStep
                        const active  = i === loadStep
                        const pending = i > loadStep
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
                            <p className={`text-sm leading-snug transition-all
                              ${done ? 'text-green-700 dark:text-green-400 font-medium' : active ? 'font-bold text-primary' : 'text-on-surface-variant/50'}`}>
                              {step.text}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={analizar}
                    className="btn-primary w-full py-3.5 rounded-full font-bold flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>person_search</span>
                    Analizar mi perfil
                  </button>
                )}
              </div>
            )}

            {/* Results */}
            {analisis && (
              isNewFormat(analisis)
                ? <ResultsNew analisis={analisis} onReset={resetForm} navigate={navigate} opecsPendientes={opecsPendientes} cargandoMas={cargandoMas} onVerMas={verMasOpecs} />
                : <ResultsOld analisis={analisis} onReset={resetForm} navigate={navigate} />
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
    </div>
  )
}
