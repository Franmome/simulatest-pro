// SimulacroIA.jsx
// Renderiza un simulacro personal generado por IA (tabla user_simulacros).
// Las preguntas vienen en formato JSON {area,dificultad,enunciado,A,B,C,correcta,explicacion}.

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

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
function parsearPregunta(p, idx) {
  const opciones = ['A', 'B', 'C'].filter(l => p[l]?.trim()).map(l => ({
    letter: l,
    text: p[l].trim(),
    is_correct: l === p.correcta?.toUpperCase(),
  }))
  return { idx, enunciado: p.enunciado, area: p.area || '', dificultad: p.dificultad || 'medio', explicacion: p.explicacion || '', correcta: p.correcta?.toUpperCase(), opciones }
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

function ResultadosIA({ preguntas, seleccion, cargo, onRepetir, onVolver }) {
  const total    = preguntas.length
  const correctas = preguntas.filter((p, i) => seleccion[i] === p.correcta).length
  const score    = total > 0 ? Math.round((correctas / total) * 100) : 0
  const aprueba  = score >= 70
  const [verDetalle, setVerDetalle] = useState(false)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-start py-10 px-4 pb-20">
      <div className="w-full max-w-xl space-y-5">

        {/* Header resultado */}
        <div className={`rounded-3xl p-8 text-white text-center ${aprueba ? 'bg-gradient-to-br from-secondary to-[#1a5c20]' : 'bg-gradient-to-br from-primary to-primary-container'}`}>
          <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-white text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>
              {aprueba ? 'military_tech' : 'auto_awesome'}
            </span>
          </div>
          <p className="text-5xl font-extrabold mb-1">{score}%</p>
          <p className="text-white/80 font-semibold">{aprueba ? '¡Buen resultado!' : 'Sigue practicando'}</p>
          {cargo && <p className="text-white/60 text-sm mt-2">OPEC: {cargo}</p>}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { val: correctas, label: 'Correctas', color: 'text-secondary', bg: 'bg-secondary/10' },
            { val: total - correctas, label: 'Incorrectas', color: 'text-error', bg: 'bg-error/10' },
            { val: total, label: 'Total', color: 'text-primary', bg: 'bg-primary/10' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center`}>
              <p className={`text-3xl font-extrabold ${s.color}`}>{s.val}</p>
              <p className="text-xs text-on-surface-variant font-semibold mt-1">{s.label}</p>
            </div>
          ))}
        </div>

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
            <div className="divide-y divide-slate-100">
              {preguntas.map((p, i) => {
                const resp     = seleccion[i]
                const esCor    = resp === p.correcta
                const sinResp  = !resp
                return (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start gap-3 mb-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${sinResp ? 'bg-slate-200' : esCor ? 'bg-secondary' : 'bg-error'}`}>
                        <span className="material-symbols-outlined text-white text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                          {sinResp ? 'remove' : esCor ? 'check' : 'close'}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{i + 1}. {p.enunciado}</p>
                    </div>
                    <div className="ml-9 space-y-1">
                      {p.opciones.map(op => (
                        <div key={op.letter} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg
                          ${op.is_correct ? 'bg-secondary/10 text-secondary font-bold' : resp === op.letter && !esCor ? 'bg-error/10 text-error' : 'text-on-surface-variant'}`}>
                          <span className="font-bold w-4">{op.letter}.</span>
                          {op.text}
                        </div>
                      ))}
                      {p.explicacion && (
                        <p className="text-xs text-on-surface-variant italic mt-1 pl-1 leading-relaxed">
                          {p.explicacion}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

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
  const navigate    = useNavigate()
  const { id }      = useParams()
  const { user }    = useAuth()

  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [cargo,     setCargo]     = useState('')
  const [pregActual,setPregActual]= useState(0)
  const [seleccion, setSeleccion] = useState({})
  const [marcadas,  setMarcadas]  = useState([])
  const [enviado,          setEnviado]          = useState(false)
  const [segundos,         setSegundos]         = useState(60 * 60)
  const [timerWarn,        setTimerWarn]        = useState(false)
  const [tiempoPorPregunta,setTiempoPorPregunta]= useState(0)  // 0 = timer global
  const [timerExpired,     setTimerExpired]     = useState(false)
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

      const tpp  = data.tiempo_por_pregunta || 0
      tppRef.current = tpp
      setTiempoPorPregunta(tpp)

      const lista = shuffleArray(data.preguntas.map((p, i) => parsearPregunta(p, i)))
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
    setSeleccion(prev => ({ ...prev, [pregActual]: letra }))
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
    registrarTiempoPregActual()
    setPregActual(i)
  }

  function enviar() {
    clearInterval(intervalRef.current)
    registrarTiempoPregActual()
    setEnviado(true)
    guardarRespuestas()
  }

  async function guardarRespuestas() {
    try {
      const tiempoUsado     = tppRef.current > 0
        ? Object.values(tiemposPregRef.current).reduce((a, b) => a + b, 0)
        : TIEMPO_TOTAL - segundos
      const correctasCount  = preguntas.filter((p, i) => seleccion[i] === p.correcta).length

      const rows = preguntas.map((p, i) => ({
        simulacro_id:    parseInt(id),
        user_id:         user.id,
        pregunta_idx:    i,
        area:            p.area || 'General',
        dificultad:      p.dificultad || 'medio',
        enunciado:       p.enunciado,
        opcion_elegida:  seleccion[i] || null,
        opcion_correcta: p.correcta,
        explicacion:     p.explicacion || null,
        es_correcta:     seleccion[i] === p.correcta,
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
    } catch { /* falla silenciosa — no interrumpe resultados */ }
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
      cargo={cargo}
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
          <button onClick={() => { if (window.confirm('¿Abandonar el simulacro?')) { clearInterval(intervalRef.current); navigate(-1) } }}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-on-surface-variant">{pregActual + 1}/{total}</span>
              {cargo && <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full truncate max-w-[150px]">{cargo}</span>}
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
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 pb-32 space-y-5">

        {/* Metadata pregunta */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full
            ${{ facil: 'bg-secondary/10 text-secondary', medio: 'bg-amber-100 text-amber-700', dificil: 'bg-error/10 text-error' }[pActual.dificultad] || 'bg-slate-100 text-slate-500'}`}>
            {pActual.dificultad}
          </span>
          {pActual.area && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">{pActual.area}</span>
          )}
          {marcadas.includes(pregActual) && (
            <span className="text-[10px] font-bold bg-tertiary/10 text-tertiary px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">bookmark</span>Marcada
            </span>
          )}
        </div>

        {/* Enunciado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <p className="text-base font-semibold leading-relaxed">{pActual.enunciado}</p>
        </div>

        {/* Opciones */}
        <div className="space-y-3">
          {pActual.opciones.map(op => {
            const sel = seleccion[pregActual] === op.letter
            return (
              <button key={op.letter} onClick={() => seleccionar(op.letter)}
                className={`w-full text-left p-4 rounded-2xl border-2 transition-all active:scale-[0.99] flex items-center gap-3
                  ${sel
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5'
                  }`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 transition-colors
                  ${sel ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {op.letter}
                </div>
                <span className={`text-sm leading-relaxed ${sel ? 'font-semibold text-primary' : 'text-on-surface'}`}>
                  {op.text}
                </span>
              </button>
            )
          })}
        </div>

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

          {pregActual < preguntas.length - 1 ? (
            <button onClick={() => irA(pregActual + 1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all">
              Siguiente
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          ) : (
            <button onClick={() => { if (window.confirm(`Enviar prueba con ${respondidas}/${total} respondidas?`)) enviar() }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-sm active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm">send</span>
              Finalizar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
