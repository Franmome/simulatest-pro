import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTimer(s) {
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// ── Pantallas auxiliares ──────────────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="flex min-h-screen bg-background items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-on-surface-variant font-medium text-sm">Preparando simulacro...</p>
      </div>
    </div>
  )
}

function ErrorScreen({ mensaje, onVolver }) {
  return (
    <div className="flex min-h-screen bg-background items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center p-8 max-w-sm">
        <span className="material-symbols-outlined text-5xl text-error opacity-50">error</span>
        <p className="font-semibold text-on-surface">{mensaje}</p>
        <button onClick={onVolver} className="btn-primary px-6 py-2 mt-2">
          Volver al catálogo
        </button>
      </div>
    </div>
  )
}

// ── Modal de confirmación de envío ────────────────────────────────────────────
function ModalEnvio({ totalPregs, respondidas, sinResponder, onConfirmar, onCancelar, enviando }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md
                      shadow-2xl border border-outline-variant/20 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>
              send
            </span>
          </div>
          <div>
            <h3 className="text-xl font-bold font-headline">¿Enviar prueba?</h3>
            <p className="text-sm text-on-surface-variant">Esta acción no se puede deshacer</p>
          </div>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-secondary-container/30 rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-secondary">{respondidas}</p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">Respondidas</p>
          </div>
          <div className={`rounded-2xl p-4 text-center
            ${sinResponder > 0 ? 'bg-error-container/30' : 'bg-surface-container'}`}>
            <p className={`text-2xl font-extrabold ${sinResponder > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
              {sinResponder}
            </p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">Sin responder</p>
          </div>
          <div className="bg-surface-container rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-on-surface">{totalPregs}</p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">Total</p>
          </div>
        </div>

        {sinResponder > 0 && (
          <div className="bg-error-container/20 border border-error/20 rounded-xl p-4 mb-6
                          flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0 mt-0.5">
              warning
            </span>
            <p className="text-sm text-error font-medium">
              Tienes {sinResponder} pregunta{sinResponder > 1 ? 's' : ''} sin responder.
              Las preguntas sin respuesta cuentan como incorrectas.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={enviando}
            className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm
                       hover:bg-surface-container transition-all disabled:opacity-60">
            Revisar
          </button>
          <button
            onClick={onConfirmar}
            disabled={enviando}
            className="flex-1 py-3 rounded-full bg-primary text-on-primary font-bold text-sm
                       shadow-lg shadow-primary/20 active:scale-95 transition-all
                       disabled:opacity-60 flex items-center justify-center gap-2">
            {enviando
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
              : 'Confirmar envío'
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal móvil para mapa de preguntas ───────────────────────────────────────
function MobileMapModal({ preguntas, seleccion, marcadas, pregActual, onSelectPregunta, onClose }) {
  const getMapClass = (i) => {
    if (i === pregActual)     return 'q-map-item current'
    if (seleccion[i] && marcadas.includes(i)) return 'q-map-item answered flagged'
    if (seleccion[i])         return 'q-map-item answered'
    if (marcadas.includes(i)) return 'q-map-item flagged'
    return 'q-map-item'
  }

  const respondidas = Object.keys(seleccion).length
  const total = preguntas.length
  const sinResponder = total - respondidas
  const pctProgreso = total > 0 ? (respondidas / total) * 100 : 0

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end md:hidden">
      <div className="bg-white rounded-t-3xl w-full max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">Mapa de preguntas</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          {/* Progreso */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{respondidas} respondidas</span>
              <span>{sinResponder} restantes</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pctProgreso}%` }} />
            </div>
          </div>
          {/* Cuadrícula */}
          <div className="grid grid-cols-5 gap-2">
            {preguntas.map((_, i) => (
              <button
                key={i}
                className={getMapClass(i)}
                onClick={() => {
                  onSelectPregunta(i)
                  onClose()
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
          {/* Leyenda */}
          <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3 text-[10px] font-bold">
            {[
              { color: 'bg-secondary-container', label: 'Respondida' },
              { color: 'bg-primary',             label: 'Actual'     },
              { color: 'bg-tertiary-container',  label: 'Marcada'    },
              { color: 'bg-surface-container-high border border-slate-200', label: 'Sin responder' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`w-3 h-3 rounded ${color} inline-block flex-shrink-0`} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Simulacro() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { user } = useAuth()

  // ── Estado de carga ──
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [modalEnvio, setModalEnvio] = useState(false)
  const [mapaAbierto, setMapaAbierto] = useState(false) // para móvil

  // ── Datos ──
  const [nivel,     setNivel]     = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [attemptId, setAttemptId] = useState(null)

  // ── Estado del simulacro ──
  const [pregActual,  setPregActual]  = useState(0)
  const [seleccion,   setSeleccion]   = useState({})
  const [marcadas,    setMarcadas]    = useState([])
  const [segundos,    setSegundos]    = useState(0)
  const [timerWarn,   setTimerWarn]   = useState(false)
  const [timerCritico, setTimerCritico] = useState(false)

  // Refs para evitar stale closures en el timer
  const intervalRef    = useRef(null)
  const seleccionRef   = useRef({})
  const preguntasRef   = useRef([])
  const attemptIdRef   = useRef(null)
  const nivelRef       = useRef(null)
  const enviandoRef    = useRef(false)

  // Sincronizar refs con estado
  useEffect(() => { seleccionRef.current   = seleccion  }, [seleccion])
  useEffect(() => { preguntasRef.current   = preguntas  }, [preguntas])
  useEffect(() => { attemptIdRef.current   = attemptId  }, [attemptId])
  useEffect(() => { nivelRef.current       = nivel      }, [nivel])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (id) iniciarSimulacro()
    return () => clearInterval(intervalRef.current)
  }, [id, user])

  // ── Inicializar simulacro ─────────────────────────────────────────────────
  async function iniciarSimulacro() {
    setLoading(true)
    setError(null)
    try {
      const { data: lvData, error: lvErr } = await supabase
        .from('levels')
        .select('*, evaluations(id, title, categories(name))')
        .eq('id', id)
        .single()
      if (lvErr) throw lvErr

      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .select('id, text, explanation, question_type, options(id, text, letter, is_correct)')
        .eq('level_id', id)
        .order('id')
      if (qErr) throw qErr

      if (!qData?.length) throw new Error('Este nivel aún no tiene preguntas cargadas.')

      const preguntasOrdenadas = qData.map(q => ({
        ...q,
        options: [...(q.options || [])].sort((a, b) =>
          (a.letter || '').localeCompare(b.letter || '')
        ),
      }))

      const { data: attempt, error: attErr } = await supabase
        .from('attempts')
        .insert({
          user_id:    user.id,
          level_id:   id,
          start_time: new Date().toISOString(),
          status:     'in_progress',
        })
        .select('id')
        .single()
      if (attErr) throw attErr

      const tiempoTotal = (lvData.time_limit ?? 60) * 60
      setSegundos(tiempoTotal)

      intervalRef.current = setInterval(() => {
        setSegundos(s => {
          const nuevo = s - 1
          if (nuevo <= 0) {
            clearInterval(intervalRef.current)
            if (!enviandoRef.current) {
              enviandoRef.current = true
              ejecutarEnvio(
                attemptIdRef.current,
                preguntasRef.current,
                seleccionRef.current,
                nivelRef.current,
                true
              )
            }
            return 0
          }
          if (nuevo <= 60)  setTimerCritico(true)
          else if (nuevo <= 300) setTimerWarn(true)
          return nuevo
        })
      }, 1000)

      setNivel(lvData)
      setPreguntas(preguntasOrdenadas)
      setAttemptId(attempt.id)
    } catch (err) {
      console.error('Error iniciando simulacro:', err)
      setError(err.message || 'No se pudo iniciar el simulacro.')
    } finally {
      setLoading(false)
    }
  }

  // ── Lógica real de envío ──────────────────────────────────────────────────
  async function ejecutarEnvio(aId, prList, selMap, nv, forzado = false) {
    if (!aId || !prList?.length) return
    clearInterval(intervalRef.current)
    setEnviando(true)
    enviandoRef.current = true
    setModalEnvio(false)

    try {
      const respuestas = prList.map((preg, idx) => {
        const selectedOptionId = selMap[idx] ?? null
        const opcionCorrecta   = preg.options?.find(o => o.is_correct)
        return {
          attempt_id:         aId,
          question_id:        preg.id,
          selected_option_id: selectedOptionId,
          is_correct:         selectedOptionId
            ? selectedOptionId === opcionCorrecta?.id
            : false,
        }
      })

      const { error: ansErr } = await supabase
        .from('answers')
        .insert(respuestas)
      if (ansErr) throw ansErr

      const correctas = respuestas.filter(r => r.is_correct).length
      const score     = Math.round((correctas / prList.length) * 100)
      const aprueba   = score >= (nv?.passing_score ?? 70)

      const { error: updErr } = await supabase
        .from('attempts')
        .update({
          end_time: new Date().toISOString(),
          score,
          status: 'completed',
        })
        .eq('id', aId)
      if (updErr) throw updErr

      navigate('/resultado-final', {
        state: {
          attemptId:   aId,
          score,
          correctas,
          total:       prList.length,
          aprueba,
          nivelNombre: nv?.name ?? '',
          evalTitulo:  nv?.evaluations?.title ?? '',
          forzado,
        },
      })
    } catch (err) {
      console.error('Error enviando prueba:', err)
      setEnviando(false)
      enviandoRef.current = false
      setSegundos(s => s)
      intervalRef.current = setInterval(() => {
        setSegundos(s => {
          if (s <= 1) { clearInterval(intervalRef.current); return 0 }
          return s - 1
        })
      }, 1000)
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const seleccionarOpcion = useCallback((optionId) => {
    setSeleccion(prev => ({ ...prev, [pregActual]: optionId }))
  }, [pregActual])

  const toggleMarcada = useCallback(() => {
    setMarcadas(prev =>
      prev.includes(pregActual)
        ? prev.filter(i => i !== pregActual)
        : [...prev, pregActual]
    )
  }, [pregActual])

  function solicitarEnvio() {
    setModalEnvio(true)
  }

  function confirmarEnvio() {
    ejecutarEnvio(attemptId, preguntas, seleccion, nivel)
  }

  // ── Clases mapa de preguntas (para desktop y modal) ──────────────────────
  function getMapClass(i) {
    if (i === pregActual)     return 'q-map-item current'
    if (seleccion[i] && marcadas.includes(i)) return 'q-map-item answered flagged'
    if (seleccion[i])         return 'q-map-item answered'
    if (marcadas.includes(i)) return 'q-map-item flagged'
    return 'q-map-item'
  }

  // ── Renders condicionales ─────────────────────────────────────────────────
  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen mensaje={error} onVolver={() => navigate('/catalogo')} />

  const pregData        = preguntas[pregActual]
  const seleccionActual = seleccion[pregActual]
  const opcionCorrecta  = pregData?.options?.find(o => o.is_correct)
  const totalPregs      = preguntas.length
  const respondidas     = Object.keys(seleccion).length
  const sinResponder    = totalPregs - respondidas
  const catNombre       = nivel?.evaluations?.categories?.name ?? ''
  const evalTitulo      = nivel?.evaluations?.title ?? ''
  const pctProgreso     = totalPregs > 0 ? (respondidas / totalPregs) * 100 : 0

  return (
    <div className="flex min-h-screen bg-background">

      {/* ── Modal de confirmación ── */}
      {modalEnvio && (
        <ModalEnvio
          totalPregs={totalPregs}
          respondidas={respondidas}
          sinResponder={sinResponder}
          onConfirmar={confirmarEnvio}
          onCancelar={() => setModalEnvio(false)}
          enviando={enviando}
        />
      )}

      {/* ── Sidebar mapa (solo desktop) ── */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 z-50 bg-slate-50
                        border-r border-slate-200/50 flex-col p-4 gap-4">
        <div className="px-2">
          <h2 className="text-lg font-extrabold text-blue-800 font-headline">{APP.name}</h2>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">Modo Examen</p>
        </div>

        <div className="px-2 space-y-1">
          <div className="flex justify-between text-xs font-bold text-on-surface-variant">
            <span>{respondidas} respondidas</span>
            <span>{sinResponder} restantes</span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${pctProgreso}%` }}
            />
          </div>
          <p className="text-[10px] text-on-surface-variant font-medium text-right">
            {Math.round(pctProgreso)}% completado
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">
            Mapa de preguntas
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {preguntas.map((_, i) => (
              <div
                key={i}
                className={getMapClass(i)}
                onClick={() => setPregActual(i)}
                title={`Pregunta ${i + 1}${seleccion[i] ? ' — Respondida' : ''}${marcadas.includes(i) ? ' — Marcada' : ''}`}
              >
                {i + 1}
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex flex-col gap-1.5 text-[10px] font-bold text-on-surface-variant">
          {[
            { color: 'bg-secondary-container', label: 'Respondida' },
            { color: 'bg-primary',             label: 'Actual'     },
            { color: 'bg-tertiary-container',  label: 'Marcada'    },
            { color: 'bg-surface-container-high border border-slate-200', label: 'Sin responder' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${color} inline-block flex-shrink-0`} />
              {label}
            </span>
          ))}
        </div>

        <button
          onClick={solicitarEnvio}
          disabled={enviando}
          className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm
                     hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60
                     flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          Enviar prueba
        </button>
      </aside>

      {/* ── Botón flotante "Ver mapa" (solo móvil) ── */}
      <button
        className="md:hidden fixed bottom-20 left-4 z-40 bg-primary text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2"
        onClick={() => setMapaAbierto(true)}
      >
        <span className="material-symbols-outlined text-sm">map</span>
        Ver mapa
      </button>

      {/* ── Modal móvil del mapa ── */}
      {mapaAbierto && (
        <MobileMapModal
          preguntas={preguntas}
          seleccion={seleccion}
          marcadas={marcadas}
          pregActual={pregActual}
          onSelectPregunta={setPregActual}
          onClose={() => setMapaAbierto(false)}
        />
      )}

      {/* ── Header responsivo ── */}
      <header
        className="fixed top-0 right-0 left-0 md:left-64 z-40 glass-effect shadow-sm
                   flex items-center justify-between px-4 md:px-6 py-3"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-blue-700
                             font-headline leading-none truncate max-w-xs">
              {evalTitulo}
            </span>
            {nivel?.name && (
              <span className="text-xs text-on-surface-variant font-medium">{nivel.name}</span>
            )}
          </div>
          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className={`flex items-center gap-2 font-bold transition-colors
            ${timerCritico
              ? 'text-error animate-pulse'
              : timerWarn
              ? 'text-tertiary'
              : 'text-primary'}`}>
            <span className="material-symbols-outlined"
                  style={{ fontVariationSettings: timerCritico ? "'FILL' 1" : "'FILL' 0" }}>
              timer
            </span>
            <span className="font-headline text-xl">{formatTimer(segundos)}</span>
          </div>

          {timerCritico && (
            <span className="text-xs font-bold text-error bg-error-container px-3 py-1 rounded-full
                             hidden sm:flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              ¡Tiempo casi agotado!
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleMarcada}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all
              ${marcadas.includes(pregActual)
                ? 'border-tertiary text-tertiary bg-tertiary-fixed'
                : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'}`}>
            <span className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: marcadas.includes(pregActual) ? "'FILL' 1" : "'FILL' 0" }}>
              flag
            </span>
            <span className="text-sm font-medium hidden sm:block">
              {marcadas.includes(pregActual) ? 'Marcada' : 'Marcar'}
            </span>
          </button>

          <button
            onClick={solicitarEnvio}
            disabled={enviando}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-bold
                       shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all
                       disabled:opacity-60 flex items-center gap-2">
            {enviando
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando...</>
              : 'Enviar Prueba'
            }
          </button>
        </div>
      </header>

      {/* ── Contenido principal ── */}
      <main
        className="flex-1 flex flex-col p-4 md:p-8 gap-8 max-w-4xl w-full animate-fade-in
                   pt-[5rem] md:pt-[5rem] pb-20 md:pb-8 md:ml-64"
      >
        {/* Encabezado pregunta */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            {catNombre && (
              <span className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full
                               text-xs font-bold uppercase tracking-wider">
                {catNombre}
              </span>
            )}
            <span className="text-on-surface-variant text-sm font-medium">
              Pregunta {pregActual + 1} de {totalPregs}
            </span>
            {marcadas.includes(pregActual) && (
              <span className="bg-tertiary-fixed text-tertiary px-3 py-1 rounded-full
                               text-xs font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                Marcada para revisar
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-on-surface leading-snug">
            {pregData?.text}
          </h1>
        </div>

        {/* Opciones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pregData?.options?.map(op => {
            const seleccionada = seleccionActual === op.id
            return (
              <button
                key={op.id}
                onClick={() => seleccionarOpcion(op.id)}
                className={`option-btn text-left transition-all
                  ${seleccionada ? 'selected' : 'hover:border-primary/40 hover:shadow-sm'}`}>
                <div className={`option-letter transition-colors
                  ${seleccionada ? 'bg-primary text-white' : ''}`}>
                  {op.letter ?? '?'}
                </div>
                <p className="text-base font-medium text-on-surface pt-2 leading-snug">
                  {op.text}
                </p>
              </button>
            )
          })}
        </div>

        {/* Retroalimentación */}
        {seleccionActual && pregData?.explanation && (
          <section className="bg-secondary-container/20 rounded-2xl p-6
                              border-l-4 border-secondary animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center
                              text-on-secondary flex-shrink-0">
                <span className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div>
                <h3 className="font-bold text-on-secondary-fixed-variant">Retroalimentación</h3>
                <p className={`text-sm font-bold
                  ${seleccionActual === opcionCorrecta?.id ? 'text-secondary' : 'text-error'}`}>
                  {seleccionActual === opcionCorrecta?.id
                    ? '✅ ¡Respuesta correcta!'
                    : `❌ Correcta: opción ${opcionCorrecta?.letter ?? '—'}`
                  }
                </p>
              </div>
            </div>
            <p className="text-on-surface-variant leading-relaxed text-sm">
              {pregData.explanation}
            </p>
          </section>
        )}

        {/* Navegación */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <button
            onClick={() => setPregActual(p => Math.max(0, p - 1))}
            disabled={pregActual === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-primary font-bold
                       hover:bg-primary-fixed transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined">arrow_back</span>
            Anterior
          </button>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-bold text-on-surface-variant">
              {respondidas} / {totalPregs} respondidas
            </span>
            {marcadas.length > 0 && (
              <span className="text-[10px] text-tertiary font-bold">
                {marcadas.length} marcada{marcadas.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {pregActual < totalPregs - 1 ? (
            <button
              onClick={() => setPregActual(p => p + 1)}
              className="flex items-center gap-2 bg-primary text-on-primary px-8 py-3
                         rounded-full font-bold shadow-xl hover:scale-105 active:scale-95 transition-all">
              Siguiente
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={solicitarEnvio}
              disabled={enviando}
              className="flex items-center gap-2 bg-secondary text-on-secondary px-8 py-3
                         rounded-full font-bold shadow-xl hover:scale-105 active:scale-95
                         transition-all disabled:opacity-60">
              <span className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              Finalizar
            </button>
          )}
        </div>

        {sinResponder > 0 && pregActual === totalPregs - 1 && (
          <div className="bg-surface-container-low rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-on-surface-variant">info</span>
            <p className="text-sm text-on-surface-variant">
              Tienes <span className="font-bold text-on-surface">{sinResponder}</span> pregunta{sinResponder > 1 ? 's' : ''} sin responder.
              Usa el mapa del panel izquierdo para navegar directamente.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}