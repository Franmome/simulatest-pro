// SimulacroIA.jsx
// Renderiza un simulacro personal generado por IA (tabla user_simulacros).
// Las preguntas vienen en formato JSON {area,dificultad,enunciado,A,B,C,correcta,explicacion}.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { analizarResultadoSimulacro } from '../utils/gemini'

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function formatTimer(s) {
  if (s <= 0) return '00:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// Convierte el formato JSON de IA al formato de opciones del renderer
// Soporta preguntas legacy (3 opciones / sin datos técnicos) y Prompt Maestro V5.8+
function parsearPregunta(p, idx) {
  const correcta = (p.correcta || p.respuesta_correcta || '').toUpperCase()
  const getOpt   = l => p[l] || p[l.toLowerCase()] || ''
  const opciones  = ['A', 'B', 'C', 'D'].filter(l => getOpt(l).trim()).map(l => ({
    letter: l,
    text: getOpt(l).trim(),
    is_correct: l === correcta,
  }))
  return {
    idx,
    contexto:              p.contexto || null,
    enunciado:             p.enunciado || p.pregunta || p.question || '',
    area:                  p.area || '',
    tipo:                  p.tipo || 'funcional',
    dificultad:            p.dificultad || 'medio',
    bloom:                 p.bloom || null,
    estado:                p.estado || null,
    justificacion:         p.justificacion || p.justification || p.explicacion || '',
    analisis_distractores: p.analisis_distractores || null,
    filtro_autonomia:      p.filtro_autonomia || null,
    correcta,
    opciones,
  }
}

// ── Pantallas auxiliares ──────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-on-surface-variant font-semibold text-sm">Cargando simulacro IA...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ mensaje, onVolver }) {
  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center p-6">
      <div className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-lg border border-slate-200">
        <div className="w-16 h-16 bg-error-container rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-error text-3xl">error</span>
        </div>
        <h2 className="font-extrabold text-xl mb-2">No se pudo cargar</h2>
        <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">{mensaje}</p>
        <button onClick={onVolver} className="w-full py-3 bg-primary text-on-primary rounded-full font-bold text-sm">Volver</button>
      </div>
    </div>
  )
}

// ── Pantalla de resultados ────────────────────────────────────────────────────

const NIVEL_CONFIG = {
  inicial:     { color: 'bg-rose-100 text-rose-700',      label: 'Nivel Inicial',     icon: 'sentiment_very_dissatisfied' },
  básico:      { color: 'bg-orange-100 text-orange-700',  label: 'Nivel Básico',      icon: 'sentiment_dissatisfied' },
  basico:      { color: 'bg-orange-100 text-orange-700',  label: 'Nivel Básico',      icon: 'sentiment_dissatisfied' },
  intermedio:  { color: 'bg-amber-100 text-amber-700',    label: 'Nivel Intermedio',  icon: 'sentiment_neutral' },
  avanzado:    { color: 'bg-emerald-100 text-emerald-700',label: 'Nivel Avanzado',    icon: 'sentiment_satisfied' },
  experto:     { color: 'bg-green-100 text-green-700',    label: 'Nivel Experto',     icon: 'military_tech' },
}

const DISTRACTOR_DESC = {
  B: 'Sentido común sin procedimiento',
  C: 'Norma o trámite mal aplicado',
  D: 'Extralimitación de funciones',
  A: 'Descartaste la respuesta correcta',
}

// ── Tarjeta de revisión profesional ──────────────────────────────────────────

const DIF_CHIP = {
  facil:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  medio:   'bg-amber-50 text-amber-700 border-amber-200',
  dificil: 'bg-rose-50 text-rose-700 border-rose-200',
}
const TIPO_CHIP = {
  funcional:       'bg-primary/5 text-primary border-primary/20',
  comportamental:  'bg-tertiary/5 text-tertiary border-tertiary/20',
}
const BLOOM_LABEL = { I: 'Bloom I — básico', II: 'Bloom II — aplicación', III: 'Bloom III — análisis' }

function TarjetaRevisionIA({ p, idx, resp, esCor, sinResp }) {
  const [abierto, setAbierto] = useState(!esCor)

  const borderColor = sinResp ? 'border-l-slate-300' : esCor ? 'border-l-secondary' : 'border-l-error'
  const headerBg    = sinResp ? 'bg-slate-50' : esCor ? 'bg-secondary/5' : 'bg-error/5'
  const iconBg      = sinResp ? 'bg-slate-300' : esCor ? 'bg-secondary' : 'bg-error'
  const iconName    = sinResp ? 'remove' : esCor ? 'check' : 'close'

  return (
    <div className={`border-l-4 ${borderColor} rounded-r-2xl overflow-hidden bg-white shadow-sm`}>

      {/* Header — siempre visible */}
      <button onClick={() => setAbierto(a => !a)} className="w-full text-left">
        <div className={`${headerBg} px-5 py-4 flex items-start gap-3 transition-colors hover:brightness-95`}>
          <div className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
            <span className="material-symbols-outlined text-white text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}>{iconName}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1 mb-1.5">
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${DIF_CHIP[p.dificultad] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {p.dificultad}
              </span>
              <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${TIPO_CHIP[p.tipo] || 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {p.tipo}
              </span>
              {p.bloom && (
                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                  {BLOOM_LABEL[p.bloom] || `Bloom ${p.bloom}`}
                </span>
              )}
              {p.area && (
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full max-w-[140px] truncate">
                  {p.area}
                </span>
              )}
            </div>
            {p.contexto && (
              <p className="text-xs text-on-surface-variant leading-relaxed mb-1.5 line-clamp-2">{p.contexto}</p>
            )}
            <p className="text-sm font-semibold text-on-surface leading-snug">
              <span className="text-on-surface-variant mr-1">{idx + 1}.</span>{p.enunciado}
            </p>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant text-lg shrink-0 mt-1 transition-transform duration-200"
            style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
        </div>
      </button>

      {/* Detalle desplegable */}
      {abierto && (
        <div className="px-5 pb-5 pt-4 border-t border-slate-100 space-y-3">

          {/* Contexto completo */}
          {p.contexto && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">description</span>
                Caso
              </p>
              <p className="text-sm text-on-surface leading-relaxed">{p.contexto}</p>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Pregunta</p>
                <p className="text-sm font-bold text-on-surface">{p.enunciado}</p>
              </div>
            </div>
          )}

          {/* Opciones con análisis de distractor */}
          <div className="space-y-2">
            {p.opciones.map(op => {
              const esCorrecta = op.is_correct
              const esElegida  = resp === op.letter && !esCor
              const analisis   = p[`analisis_${op.letter}`] || p.analisis_distractores?.[op.letter]

              return (
                <div key={op.letter} className={`rounded-xl border overflow-hidden transition-all ${
                  esCorrecta ? 'border-secondary/40 bg-secondary/5'
                  : esElegida  ? 'border-error/30 bg-error/5'
                  : 'border-slate-100 bg-slate-50/80'
                }`}>
                  <div className="flex items-start gap-3 px-3 py-2.5">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-extrabold mt-0.5 ${
                      esCorrecta ? 'bg-secondary text-white'
                      : esElegida  ? 'bg-error text-white'
                      : 'bg-slate-200 text-slate-500'
                    }`}>{op.letter}</div>
                    <p className={`text-sm flex-1 leading-snug ${
                      esCorrecta ? 'text-secondary font-semibold'
                      : esElegida  ? 'text-error'
                      : 'text-on-surface-variant'
                    }`}>{op.text}</p>
                    {esCorrecta && (
                      <span className="material-symbols-outlined text-secondary text-base shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                    {esElegida && (
                      <span className="material-symbols-outlined text-error text-base shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                    )}
                  </div>
                  {analisis && (
                    <p className={`px-3 pb-2.5 pl-11 text-[11px] leading-relaxed italic border-t ${
                      esCorrecta ? 'text-secondary/70 border-secondary/10'
                      : esElegida  ? 'text-error/70 border-error/10'
                      : 'text-slate-400 border-slate-100'
                    }`}>{analisis}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Fundamento técnico */}
          {p.justificacion && (
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
                Fundamento técnico
              </p>
              <p className="text-sm text-on-surface leading-relaxed">{p.justificacion}</p>
            </div>
          )}

          {/* Filtro de autonomía */}
          {p.filtro_autonomia && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">manage_accounts</span>
                Filtro de autonomía
              </p>
              <p className="text-xs text-amber-800 leading-relaxed">{p.filtro_autonomia}</p>
            </div>
          )}

          {/* Fallback explicacion legacy */}
          {!p.justificacion && !p.analisis_distractores && p.justificacion === '' && (
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
              <p className="text-xs text-on-surface-variant leading-relaxed">{p.justificacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultadosIA({ preguntas, seleccion, tiempos, cargo, modelo, simulacroId, onRepetir, onVolver, esPractica }) {
  const total     = preguntas.length
  const correctas = preguntas.filter((p, i) => seleccion[i] === p.correcta).length
  const score     = total > 0 ? Math.round((correctas / total) * 100) : 0
  const aprueba   = score >= 70

  const [verDetalle, setVerDetalle] = useState(false)
  const [analisis,   setAnalisis]   = useState(null)
  const [cargandoIA, setCargandoIA] = useState(!esPractica)
  const [errorIA,    setErrorIA]    = useState(null)

  useEffect(() => {
    if (esPractica) return  // práctica tiene retro por pregunta — no lanzar análisis global
    const pregParaAnalisis = preguntas.map((p, i) => ({
      area:           p.area || 'General',
      tipo:           p.tipo || 'funcional',
      dificultad:     p.dificultad || 'medio',
      opcion_elegida: seleccion[i] || null,
      opcion_correcta:p.correcta,
      es_correcta:    seleccion[i] === p.correcta,
      tiempo_segundos:tiempos?.[i] || null,
    }))

    const modo = modoExamen ? 'examen' : 'simulacro_ia'
    analizarResultadoSimulacro({ cargo, preguntas: pregParaAnalisis, modelo: modelo || 'gemini', simulacro_id: simulacroId, modo })
      .then(a => setAnalisis(a))
      .catch(e => setErrorIA(e.message))
      .finally(() => setCargandoIA(false))
  }, []) // eslint-disable-line

  const nivel = analisis?.nivel_preparacion?.toLowerCase()
  const nivelCfg = NIVEL_CONFIG[nivel] || NIVEL_CONFIG['intermedio']

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-10 px-4 pb-24">
      <div className="w-full max-w-xl space-y-5">

        {/* Header resultado */}
        <div className={`rounded-3xl p-8 text-white text-center ${aprueba ? 'bg-gradient-to-br from-secondary to-[#1a5c20]' : 'bg-gradient-to-br from-primary to-primary-container'}`}>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-white text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              {esPractica ? 'fitness_center' : aprueba ? 'military_tech' : 'auto_awesome'}
            </span>
          </div>
          <p className="text-5xl font-extrabold mb-1">{score}%</p>
          <p className="text-white/80 font-semibold">
            {esPractica ? 'Sesión de práctica completada' : aprueba ? '¡Buen resultado!' : 'Sigue practicando'}
          </p>
          {cargo && <p className="text-white/60 text-sm mt-2">{esPractica ? 'Área: ' : 'OPEC: '}{cargo}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: correctas,       label: 'Correctas',  color: 'text-secondary', bg: 'bg-secondary/10' },
            { val: total-correctas, label: 'Incorrectas',color: 'text-error',     bg: 'bg-error/10' },
            { val: total,           label: 'Total',       color: 'text-primary',  bg: 'bg-primary/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <p className={`text-3xl font-extrabold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-on-surface-variant font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Análisis IA ── */}
        {!esPractica && cargandoIA ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div>
              <p className="font-bold text-sm">Analizando tu desempeño...</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Praxia está generando tu retroalimentación personalizada</p>
            </div>
          </div>
        ) : !esPractica && errorIA ? null
        : analisis ? (
          <div className="space-y-4">

            {/* Nivel de preparación */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${nivelCfg.color}`}>
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{nivelCfg.icon}</span>
                  {nivelCfg.label}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface">{analisis.resumen}</p>
            </div>

            {/* Fortalezas y áreas de mejora */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-emerald-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                  <p className="font-bold text-emerald-800 text-sm">Fortalezas</p>
                </div>
                <ul className="space-y-1.5">
                  {(analisis.fortalezas || []).map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-emerald-800">
                      <span className="material-symbols-outlined text-emerald-500 text-sm shrink-0 mt-0.5">check_circle</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-amber-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                  <p className="font-bold text-amber-800 text-sm">A mejorar</p>
                </div>
                <ul className="space-y-1.5">
                  {(analisis.areas_mejora || []).map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-amber-800">
                      <span className="material-symbols-outlined text-amber-500 text-sm shrink-0 mt-0.5">warning</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Patrón de error */}
            {analisis.patron_error && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-rose-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>pattern</span>
                  <p className="font-bold text-rose-800 text-sm">Patrón de error detectado</p>
                </div>
                <p className="text-xs text-rose-800 leading-relaxed mb-2">{analisis.patron_error}</p>
                {analisis.tipo_distractor_frecuente && analisis.tipo_distractor_frecuente !== 'A' && (
                  <div className="bg-rose-100 rounded-xl px-3 py-2 flex items-start gap-2">
                    <span className="font-extrabold text-rose-700 text-sm shrink-0">Opción {analisis.tipo_distractor_frecuente}</span>
                    <span className="text-xs text-rose-700">{DISTRACTOR_DESC[analisis.tipo_distractor_frecuente] || ''} — {analisis.significado_distractor || ''}</span>
                  </div>
                )}
              </div>
            )}

            {/* Recomendaciones */}
            {(analisis.recomendaciones || []).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                  <p className="font-bold text-sm">Plan de estudio recomendado</p>
                </div>
                <ol className="space-y-2">
                  {analisis.recomendaciones.map((r, i) => (
                    <li key={i} className="flex items-start gap-3 text-xs text-on-surface-variant">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-extrabold text-[10px] flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                      {r}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Temas críticos */}
            {(analisis.temas_criticos || []).length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-slate-500 text-lg">bookmark</span>
                  <p className="font-bold text-sm text-slate-700">Temas que debes reforzar</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {analisis.temas_criticos.map((t, i) => (
                    <span key={i} className="bg-white border border-slate-200 rounded-full px-3 py-1 text-xs font-semibold text-slate-700">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Tiempo */}
            {analisis.analisis_tiempo && analisis.analisis_tiempo !== 'No medido' && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-blue-600 text-lg">timer</span>
                  <p className="font-bold text-blue-800 text-sm">Gestión del tiempo</p>
                </div>
                <p className="text-xs text-blue-800 leading-relaxed">{analisis.analisis_tiempo}</p>
              </div>
            )}

            {/* Mensaje motivacional */}
            {analisis.mensaje_motivacional && (
              <div className={`rounded-2xl p-5 text-white text-center ${aprueba ? 'bg-gradient-to-br from-secondary to-[#1a5c20]' : 'bg-gradient-to-br from-primary to-primary-container'}`}>
                <span className="material-symbols-outlined text-white/70 text-3xl mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                <p className="text-sm font-medium leading-relaxed italic">"{analisis.mensaje_motivacional}"</p>
                <p className="text-white/50 text-xs mt-2">— Praxia</p>
              </div>
            )}

          </div>
        ) : null}

        {/* Detalle de preguntas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setVerDetalle(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 font-bold text-sm hover:bg-slate-50 transition-colors">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">fact_check</span>
              Revisar respuestas
            </span>
            <span className="material-symbols-outlined text-on-surface-variant">
              {verDetalle ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {verDetalle && (
            <div className="p-4 space-y-3">
              {preguntas.map((p, i) => {
                const resp    = seleccion[i]
                const esCor   = resp === p.correcta
                const sinResp = !resp
                return (
                  <TarjetaRevisionIA
                    key={i}
                    p={p}
                    idx={i}
                    resp={resp}
                    esCor={esCor}
                    sinResp={sinResp}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Nota sobre práctica IA — solo en simulacros normales */}
        {!esPractica && (
          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-center">
            <p className="font-bold text-primary mb-1">
              <span className="material-symbols-outlined text-base align-middle mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              ¿Quieres practicar tus áreas débiles?
            </p>
            <p className="text-on-surface-variant text-xs">Vuelve a la evaluación y usa el botón <strong>"Simulacro personalizado IA"</strong> para generar una práctica dirigida a tus puntos débiles.</p>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-3">
          <button onClick={onVolver}
            className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all">
            Volver
          </button>
          <button onClick={onRepetir}
            className="flex-1 py-3 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">replay</span>
            Repetir
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function SimulacroIA() {
  const navigate      = useNavigate()
  const { id }        = useParams()
  const location      = useLocation()
  const [searchParams] = useSearchParams()
  const modoExamen    = searchParams.get('modo') === 'examen'
  const modoPractica  = searchParams.get('modo') === 'practica'
  const { user }      = useAuth()

  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [preguntas,     setPreguntas]     = useState([])
  const [cargo,         setCargo]         = useState('')
  const [evaluacionId,  setEvaluacionId]  = useState(null)
  const [pregActual,    setPregActual]    = useState(0)
  const [seleccion,     setSeleccion]     = useState({})
  const [marcadas,      setMarcadas]      = useState([])
  const [retroVisible,  setRetroVisible]  = useState(false)

  const [enviado,          setEnviado]          = useState(false)
  const [segundos,         setSegundos]         = useState(60 * 60)
  const [timerWarn,        setTimerWarn]        = useState(false)
  const [tiempoPorPregunta,setTiempoPorPregunta]= useState(0)  // 0 = timer global
  const [timerExpired,     setTimerExpired]     = useState(false)
  const [visible,          setVisible]          = useState(true)   // animación entre preguntas
  const [showModal,        setShowModal]        = useState(false)  // modal finalizar
  const intervalRef         = useRef(null)
  const tiempoInicioPregRef = useRef(null)
  const tiemposPregRef      = useRef({})
  const tppRef              = useRef(0)  // ref para leer tpp dentro de callbacks

  const TIEMPO_TOTAL = 60 * 60

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    cargar()
    return () => clearInterval(intervalRef.current)
  }, [id, user]) // eslint-disable-line

  async function cargar() {
    try {
      const { data, error: err } = await supabase
        .from('user_simulacros')
        .select('preguntas, cargo, evaluacion_id, tiempo_por_pregunta')
        .eq('id', id)
        .eq('user_id', user.id)
        .maybeSingle()

      if (err) throw new Error(err.message)
      if (!data) throw new Error('Simulacro no encontrado o no te pertenece.')
      if (!data.preguntas?.length) throw new Error('Este simulacro no tiene preguntas.')

      setEvaluacionId(data.evaluacion_id || null)

      const preStart = location.state?.preStartConfig
      const tpp = (preStart?.tiempo > 0) ? preStart.tiempo : (data.tiempo_por_pregunta || 0)
      tppRef.current = tpp
      setTiempoPorPregunta(tpp)

      let lista = modoExamen
        ? data.preguntas.map((p, i) => parsearPregunta(p, i))   // examen: orden original
        : shuffleArray(data.preguntas.map((p, i) => parsearPregunta(p, i)))
      if (preStart?.cantidad > 0 && preStart.cantidad < lista.length) {
        lista = lista.slice(0, preStart.cantidad)
      }
      setPreguntas(lista)
      setCargo(data.cargo || '')
      tiempoInicioPregRef.current = Date.now()
      tiemposPregRef.current = {}
      // Timer global solo si no hay límite por pregunta
      if (tpp === 0) arrancarTimer()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function arrancarTimer() {
    // Solo modo global (sin límite por pregunta)
    clearInterval(intervalRef.current)
    setSegundos(TIEMPO_TOTAL)
    setTimerWarn(false)
    intervalRef.current = setInterval(() => {
      setSegundos(s => {
        const n = s - 1
        if (n <= 300) setTimerWarn(true)
        if (n <= 0) { clearInterval(intervalRef.current); setEnviado(true); return 0 }
        return n
      })
    }, 1000)
  }

  // Timer por pregunta: se reinicia cada vez que cambia la pregunta activa
  useEffect(() => {
    if (enviado || tppRef.current === 0 || preguntas.length === 0) return
    clearInterval(intervalRef.current)
    setTimerWarn(false)
    setSegundos(tppRef.current)
    tiempoInicioPregRef.current = Date.now()
    intervalRef.current = setInterval(() => {
      setSegundos(s => {
        const n = s - 1
        if (n <= 10) setTimerWarn(true)
        if (n <= 0) { clearInterval(intervalRef.current); setTimerExpired(true); return 0 }
        return n
      })
    }, 1000)
  }, [pregActual, tiempoPorPregunta, enviado, preguntas.length]) // eslint-disable-line

  // Cuando se agota el tiempo de una pregunta: avanzar o terminar
  useEffect(() => {
    if (!timerExpired) return
    setTimerExpired(false)
    registrarTiempoPregActual()
    const siguiente = pregActual + 1
    if (siguiente >= preguntas.length) {
      setEnviado(true)
      guardarRespuestas()
    } else {
      setPregActual(siguiente)
    }
  }, [timerExpired]) // eslint-disable-line

  function seleccionar(letra) {
    if (enviado) return
    if (seleccion[pregActual]) return   // respuesta fija — no se cambia
    registrarTiempoPregActual()
    setSeleccion(prev => ({ ...prev, [pregActual]: letra }))
    if (modoPractica) {
      setRetroVisible(true)  // modo práctica: mostrar retro antes de avanzar
    } else {
      if (pregActual < preguntas.length - 1) {
        setTimeout(() => irA(pregActual + 1), 550)
      }
    }
  }

  function continuarPractica() {
    setRetroVisible(false)
    if (pregActual < preguntas.length - 1) {
      irA(pregActual + 1)
    }
  }

  function toggleMarca() {
    setMarcadas(prev =>
      prev.includes(pregActual)
        ? prev.filter(i => i !== pregActual)
        : [...prev, pregActual]
    )
  }

  function registrarTiempoPregActual() {
    if (tiempoInicioPregRef.current === null) return
    const elapsed = Math.round((Date.now() - tiempoInicioPregRef.current) / 1000)
    tiemposPregRef.current[pregActual] = (tiemposPregRef.current[pregActual] || 0) + elapsed
    tiempoInicioPregRef.current = Date.now()
  }

  function irA(i) {
    if (i < 0 || i >= preguntas.length) return
    setRetroVisible(false)
    registrarTiempoPregActual()
    setVisible(false)
    setTimeout(() => { setPregActual(i); setVisible(true) }, 160)
  }

  function enviar() {
    clearInterval(intervalRef.current)
    registrarTiempoPregActual()
    setEnviado(true)
    setShowModal(false)
    guardarRespuestas()
  }

  async function guardarRespuestas(selOverride) {
    const sel = selOverride ?? seleccion
    try {
      const tiempoUsado    = tppRef.current > 0
        ? Object.values(tiemposPregRef.current).reduce((a, b) => a + b, 0)
        : TIEMPO_TOTAL - segundos
      const correctasCount = preguntas.filter((p, i) => sel[i] === p.correcta).length

      const rows = preguntas.map((p, i) => ({
        simulacro_id:    parseInt(id),
        user_id:         user.id,
        pregunta_idx:    i,
        area:            p.area || 'General',
        dificultad:      p.dificultad || 'medio',
        enunciado:       p.enunciado,
        opcion_elegida:  sel[i] || null,
        opcion_correcta: p.correcta,
        explicacion:     p.explicacion || null,
        es_correcta:     sel[i] === p.correcta,
        tiempo_segundos: tiemposPregRef.current[i] || null,
      }))

      await supabase.from('user_simulacro_answers').insert(rows)

      await supabase.rpc('completar_simulacro', {
        p_simulacro_id:    parseInt(id),
        p_user_id:         user.id,
        p_correctas:       correctasCount,
        p_total:           preguntas.length,
        p_tiempo_segundos: tiempoUsado,
      })


    } catch { /* falla silenciosa */ }
  }

  // ── DEV ONLY: rellenar al azar y enviar (para QA rápido) ─────────────────────
  function devResponderAlAzar() {
    if (!window.confirm('[DEV] ¿Rellenar todas al azar y enviar?')) return
    const nuevaSel = {}
    preguntas.forEach((p, i) => {
      const letras = p.opciones.map(op => op.letter)
      nuevaSel[i] = letras[Math.floor(Math.random() * letras.length)]
    })
    setSeleccion(nuevaSel)
    clearInterval(intervalRef.current)
    registrarTiempoPregActual()
    setEnviado(true)
    setShowModal(false)
    guardarRespuestas(nuevaSel)
  }

  function repetir() {
    clearInterval(intervalRef.current)
    tiempoInicioPregRef.current = Date.now()
    tiemposPregRef.current = {}
    setSeleccion({})
    setMarcadas([])
    setTimerWarn(false)
    setTimerExpired(false)
    setPreguntas(prev => shuffleArray([...prev]))
    setPregActual(0)
    setEnviado(false)
    if (tppRef.current === 0) arrancarTimer()
    // Per-question mode: useEffect se encarga al cambiar pregActual/enviado
  }

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen mensaje={error} onVolver={() => navigate(-1)} />

  if (enviado) return (
    <ResultadosIA
      preguntas={preguntas}
      seleccion={seleccion}
      tiempos={tiemposPregRef.current}
      cargo={cargo}
      modelo="gemini"
      simulacroId={id}
      esPractica={modoPractica}
      onRepetir={repetir}
      onVolver={() => navigate(-1)}
    />
  )

  const pActual    = preguntas[pregActual]
  const respondidas = Object.keys(seleccion).length
  const total       = preguntas.length
  const pct         = total > 0 ? Math.round((respondidas / total) * 100) : 0

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">

      {/* ── Header ── */}
      <div className={`sticky top-0 z-50 border-b border-slate-200 shadow-sm transition-colors ${timerWarn ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => { clearInterval(intervalRef.current); navigate(-1) }}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-on-surface-variant">{pregActual + 1}/{total}</span>
              {modoExamen && <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">Modo Examen</span>}
              {modoPractica && <span className="text-[10px] bg-secondary/10 text-secondary font-bold px-2 py-0.5 rounded-full">Modo Práctica</span>}
              {cargo && <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full truncate max-w-[120px]">{cargo}</span>}
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className={`flex items-center gap-1 font-mono font-bold text-sm px-3 py-1.5 rounded-full flex-shrink-0 ${timerWarn ? 'bg-red-100 text-red-600 animate-pulse' : tiempoPorPregunta > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-on-surface'}`}>
            <span className="material-symbols-outlined text-sm">{tiempoPorPregunta > 0 ? 'hourglass_bottom' : 'timer'}</span>
            {formatTimer(segundos)}
            {tiempoPorPregunta > 0 && <span className="text-[9px] font-bold opacity-60 ml-0.5">/ preg</span>}
          </div>
        </div>
      </div>

      {/* ── Cuerpo ── */}
      <div className={`flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32 space-y-5 transition-all duration-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>

        {/* Metadata pregunta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full
            ${{ facil: 'bg-secondary/10 text-secondary', medio: 'bg-amber-100 text-amber-700', dificil: 'bg-error/10 text-error' }[pActual.dificultad] || 'bg-slate-100 text-slate-500'}`}>
            {pActual.dificultad}
          </span>
          {pActual.tipo && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${pActual.tipo === 'comportamental' ? 'bg-violet-100 text-violet-700' : 'bg-primary/10 text-primary'}`}>
              {pActual.tipo}
            </span>
          )}
          {pActual.area && !pActual.tipo && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{pActual.area}</span>
          )}
          {marcadas.includes(pregActual) && (
            <span className="text-[10px] font-bold bg-tertiary/10 text-tertiary px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">bookmark</span>Marcada
            </span>
          )}
        </div>

        {/* Caso + enunciado */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {pActual.contexto && (
            <div className="px-5 pt-5 pb-4 border-b border-slate-100">
              <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">description</span>
                Caso
              </p>
              <p className="text-sm text-on-surface leading-relaxed">{pActual.contexto}</p>
            </div>
          )}
          <div className={pActual.contexto ? 'px-5 py-4 bg-primary/5' : 'p-5'}>
            {pActual.contexto && (
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Pregunta</p>
            )}
            <p className="text-base font-bold leading-snug text-on-surface">{pActual.enunciado}</p>
          </div>
        </div>

        {/* Opciones */}
        {(() => {
          const respondida    = !!seleccion[pregActual]
          const respuestaUser = seleccion[pregActual]
          const correcta      = pActual.correcta
          return (
            <div className="space-y-3">
              {pActual.opciones.map(op => {
                const sel      = respuestaUser === op.letter
                const esCorr   = op.letter === correcta
                const esErrSel = retroVisible && sel && !esCorr
                const esCorrectaRetro = retroVisible && esCorr

                let btnClass = 'border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99]'
                if (retroVisible) {
                  if (esCorrectaRetro) btnClass = 'border-secondary bg-secondary/10 shadow-md'
                  else if (esErrSel)   btnClass = 'border-error bg-error/10 shadow-md'
                  else                  btnClass = 'border-slate-100 bg-white opacity-40 cursor-default'
                } else if (sel) {
                  btnClass = 'border-primary bg-primary/5 shadow-md'
                } else if (respondida) {
                  btnClass = 'border-slate-100 bg-white opacity-40 cursor-default'
                }

                let iconBg = sel ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                if (retroVisible) {
                  if (esCorrectaRetro) iconBg = 'bg-secondary text-white'
                  else if (esErrSel)   iconBg = 'bg-error text-white'
                  else                  iconBg = 'bg-slate-100 text-slate-400'
                }

                const icon = retroVisible
                  ? esCorrectaRetro ? 'check' : esErrSel ? 'close' : op.letter
                  : sel ? 'check' : op.letter

                return (
                  <button key={op.letter}
                    onClick={() => !retroVisible && seleccionar(op.letter)}
                    disabled={retroVisible && !esCorrectaRetro && !esErrSel}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${btnClass}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 transition-colors ${iconBg}`}>
                      {(retroVisible || sel) && icon !== op.letter
                        ? <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        : op.letter}
                    </div>
                    <span className={`text-sm leading-relaxed ${
                      retroVisible && esCorrectaRetro ? 'font-bold text-secondary'
                      : retroVisible && esErrSel      ? 'font-bold text-error'
                      : sel                            ? 'font-semibold text-primary'
                      : 'text-on-surface'
                    }`}>
                      {op.text}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Retroalimentación modo práctica */}
        {modoPractica && retroVisible && seleccion[pregActual] && (
          <div className={`rounded-2xl border-2 overflow-hidden ${seleccion[pregActual] === pActual.correcta ? 'border-secondary/40 bg-secondary/5' : 'border-error/30 bg-error/5'}`}>
            <div className="px-4 py-3 flex items-center gap-3 border-b border-inherit">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${seleccion[pregActual] === pActual.correcta ? 'bg-secondary' : 'bg-error'}`}>
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {seleccion[pregActual] === pActual.correcta ? 'check' : 'close'}
                </span>
              </div>
              <div>
                <p className={`font-extrabold text-sm ${seleccion[pregActual] === pActual.correcta ? 'text-secondary' : 'text-error'}`}>
                  {seleccion[pregActual] === pActual.correcta ? '¡Correcto!' : `Incorrecto — La respuesta era ${pActual.correcta}`}
                </p>
              </div>
            </div>
            {pActual.justificacion && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1.5">Retroalimentación Praxia</p>
                <p className="text-sm text-on-surface leading-relaxed">{pActual.justificacion}</p>
              </div>
            )}
            <div className="px-4 pb-4">
              <button onClick={continuarPractica}
                className="w-full py-2.5 rounded-full bg-secondary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-secondary/90 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                {pregActual < preguntas.length - 1 ? 'Siguiente pregunta' : 'Ver resultados'}
              </button>
            </div>
          </div>
        )}

        {/* Mapa de preguntas */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
            Mapa · {respondidas}/{total} respondidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {preguntas.map((_, i) => (
              <button key={i} onClick={() => irA(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-95
                  ${i === pregActual          ? 'bg-primary text-white shadow-md scale-105'
                  : seleccion[i] && marcadas.includes(i) ? 'bg-secondary-container text-secondary ring-2 ring-tertiary/50'
                  : seleccion[i]             ? 'bg-secondary-container text-secondary'
                  : marcadas.includes(i)     ? 'bg-tertiary-container text-tertiary'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modal finalizar ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-secondary text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </div>
            <h3 className="font-extrabold text-lg text-center mb-1">¿Finalizar prueba?</h3>
            <p className="text-center text-on-surface-variant text-sm mb-1">
              Respondiste <span className="font-bold text-on-surface">{respondidas}/{total}</span> preguntas
            </p>
            {total - respondidas > 0 && (
              <p className="text-center text-amber-600 text-xs font-semibold">
                {total - respondidas} pregunta{total - respondidas > 1 ? 's' : ''} sin responder
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all">
                Seguir
              </button>
              <button onClick={enviar}
                className="flex-1 py-3 rounded-full bg-secondary text-on-secondary font-bold text-sm active:scale-95 transition-all">
                Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Botón DEV (temporal QA) ── */}
      <button onClick={devResponderAlAzar}
        className="fixed bottom-20 right-4 z-40 bg-rose-500 text-white text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-lg opacity-70 hover:opacity-100 transition-opacity">
        DEV
      </button>

      {/* ── Footer navegación ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => irA(pregActual - 1)} disabled={pregActual === 0}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center disabled:opacity-30 hover:bg-slate-200 transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>

          <button onClick={toggleMarca}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
              ${marcadas.includes(pregActual) ? 'bg-tertiary/10 text-tertiary' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>
            <span className="material-symbols-outlined text-xl"
              style={{ fontVariationSettings: marcadas.includes(pregActual) ? "'FILL' 1" : "'FILL' 0" }}>
              bookmark
            </span>
          </button>

          <div className="flex-1" />

          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-sm active:scale-95 transition-all">
            <span className="material-symbols-outlined text-sm">send</span>
            Finalizar
          </button>
        </div>
      </div>
    </div>
  )
}
