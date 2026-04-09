import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config.js'

function formatTimer(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

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
        <button onClick={onVolver} className="btn-primary px-6 py-2 mt-2">Volver al catálogo</button>
      </div>
    </div>
  )
}

function ModalEnvio({ totalPregs, respondidas, sinResponder, onConfirmar, onCancelar, enviando }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-3xl p-6 w-full max-w-md shadow-2xl border border-outline-variant/20 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary-fixed flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </div>
          <div>
            <h3 className="text-xl font-bold">¿Enviar prueba?</h3>
            <p className="text-sm text-on-surface-variant">Esta acción no se puede deshacer</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-secondary-container/30 rounded-2xl p-3 text-center">
            <p className="text-2xl font-extrabold text-secondary">{respondidas}</p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">Respondidas</p>
          </div>
          <div className={`rounded-2xl p-3 text-center ${sinResponder > 0 ? 'bg-error-container/30' : 'bg-surface-container'}`}>
            <p className={`text-2xl font-extrabold ${sinResponder > 0 ? 'text-error' : 'text-on-surface-variant'}`}>{sinResponder}</p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">Sin responder</p>
          </div>
          <div className="bg-surface-container rounded-2xl p-3 text-center">
            <p className="text-2xl font-extrabold text-on-surface">{totalPregs}</p>
            <p className="text-[10px] font-bold text-on-surface-variant uppercase mt-1">Total</p>
          </div>
        </div>
        {sinResponder > 0 && (
          <div className="bg-error-container/20 border border-error/20 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="material-symbols-outlined text-error text-lg flex-shrink-0">warning</span>
            <p className="text-sm text-error font-medium">Tienes {sinResponder} pregunta{sinResponder > 1 ? 's' : ''} sin responder. Cuentan como incorrectas.</p>
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onCancelar} disabled={enviando}
            className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm hover:bg-surface-container transition-all disabled:opacity-60">
            Revisar
          </button>
          <button onClick={onConfirmar} disabled={enviando}
            className="flex-1 py-3 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {enviando ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enviando...</> : 'Confirmar envío'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MobileMapModal({ preguntas, seleccion, marcadas, pregActual, onClose }) {
  const respondidas = Object.keys(seleccion).length
  const total = preguntas.length
  const pctProgreso = total > 0 ? (respondidas / total) * 100 : 0

  function getMapClass(i) {
    if (i === pregActual) return 'w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center bg-primary text-white'
    if (seleccion[i] && marcadas.includes(i)) return 'w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center bg-tertiary-container text-tertiary border-2 border-secondary'
    if (seleccion[i]) return 'w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center bg-secondary-container text-secondary'
    if (marcadas.includes(i)) return 'w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center bg-tertiary-container text-tertiary'
    return 'w-10 h-10 rounded-xl text-xs font-bold flex items-center justify-center bg-surface-container text-on-surface-variant'
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end md:hidden">
      <div className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex justify-between items-center">
          <h3 className="font-bold text-lg">Mapa de preguntas</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs font-bold">
              <span>{respondidas} respondidas</span>
              <span>{total - respondidas} restantes</span>
            </div>
            <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctProgreso}%` }} />
            </div>
          </div>
          {/* Solo visual, sin onClick */}
          <div className="grid grid-cols-5 gap-2">
            {preguntas.map((_, i) => (
              <div key={i} className={getMapClass(i)}>{i + 1}</div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-200 flex flex-wrap gap-3 text-[10px] font-bold">
            {[
              { color: 'bg-secondary-container', label: 'Respondida' },
              { color: 'bg-primary', label: 'Actual' },
              { color: 'bg-tertiary-container', label: 'Marcada' },
              { color: 'bg-surface-container', label: 'Sin responder' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`w-3 h-3 rounded ${color} inline-block`} />{label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Simulacro() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const modo = searchParams.get('modo') || 'examen' // 'practica' o 'examen'
  const esPractica = modo === 'practica'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [modalEnvio, setModalEnvio] = useState(false)
  const [mapaAbierto, setMapaAbierto] = useState(false)

  const [nivel, setNivel] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [attemptId, setAttemptId] = useState(null)

  const [pregActual, setPregActual] = useState(0)
  const [seleccion, setSeleccion] = useState({})
  const [marcadas, setMarcadas] = useState([])
  const [segundos, setSegundos] = useState(0)
  const [timerPregunta, setTimerPregunta] = useState(90) // para modo práctica
  const [timerWarn, setTimerWarn] = useState(false)
  const [timerCritico, setTimerCritico] = useState(false)

  const intervalRef = useRef(null)
  const seleccionRef = useRef({})
  const preguntasRef = useRef([])
  const attemptIdRef = useRef(null)
  const nivelRef = useRef(null)
  const enviandoRef = useRef(false)

  useEffect(() => { seleccionRef.current = seleccion }, [seleccion])
  useEffect(() => { preguntasRef.current = preguntas }, [preguntas])
  useEffect(() => { attemptIdRef.current = attemptId }, [attemptId])
  useEffect(() => { nivelRef.current = nivel }, [nivel])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (id) iniciarSimulacro()
    return () => clearInterval(intervalRef.current)
  }, [id, user])

  // En modo práctica, resetear timer por pregunta al cambiar
  useEffect(() => {
    if (esPractica) setTimerPregunta(90)
  }, [pregActual])

  async function iniciarSimulacro() {
    setLoading(true)
    setError(null)
    try {
      const { data: lvData, error: lvErr } = await supabase
        .from('levels').select('*, evaluations(id, title, categories(name))').eq('id', id).maybeSingle()
      if (lvErr) throw lvErr

      const { data: qData, error: qErr } = await supabase
        .from('questions').select('id, text, explanation, question_type, options(id, text, letter, is_correct)')
        .eq('level_id', id).order('id')
      if (qErr) throw qErr
      if (!qData?.length) throw new Error('Este nivel aún no tiene preguntas cargadas.')

      const preguntasOrdenadas = qData.map(q => ({
        ...q,
        options: [...(q.options || [])].sort((a, b) => (a.letter || '').localeCompare(b.letter || '')),
      }))

      const { data: attempt, error: attErr } = await supabase
        .from('attempts').insert({ user_id: user.id, level_id: id, start_time: new Date().toISOString(), status: 'in_progress' })
        .select('id').maybeSingle()
      if (attErr) throw attErr

      const tiempoTotal = (lvData.time_limit ?? 60) * 60
      setSegundos(tiempoTotal)

      // Timer total (modo examen) o por pregunta (modo práctica)
      if (!esPractica) {
        intervalRef.current = setInterval(() => {
          setSegundos(s => {
            const nuevo = s - 1
            if (nuevo <= 0) {
              clearInterval(intervalRef.current)
              if (!enviandoRef.current) {
                enviandoRef.current = true
                ejecutarEnvio(attemptIdRef.current, preguntasRef.current, seleccionRef.current, nivelRef.current, true)
              }
              return 0
            }
            if (nuevo <= 60) setTimerCritico(true)
            else if (nuevo <= 300) setTimerWarn(true)
            return nuevo
          })
        }, 1000)
      } else {
        // Modo práctica: timer por pregunta
        intervalRef.current = setInterval(() => {
          setTimerPregunta(t => {
            if (t <= 1) {
              clearInterval(intervalRef.current)
              return 0
            }
            return t - 1
          })
        }, 1000)
      }

      setNivel(lvData)
      setPreguntas(preguntasOrdenadas)
      setAttemptId(attempt.id)
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el simulacro.')
    } finally {
      setLoading(false)
    }
  }

  async function ejecutarEnvio(aId, prList, selMap, nv, forzado = false) {
    if (!aId || !prList?.length) return
    clearInterval(intervalRef.current)
    setEnviando(true)
    enviandoRef.current = true
    setModalEnvio(false)

    try {
      const respuestas = prList.map((preg, idx) => {
        const selectedOptionId = selMap[idx] ?? null
        const opcionCorrecta = preg.options?.find(o => o.is_correct)
        return {
          attempt_id: aId,
          question_id: preg.id,
          selected_option_id: selectedOptionId,
          is_correct: selectedOptionId ? selectedOptionId === opcionCorrecta?.id : false,
        }
      })

      const { error: ansErr } = await supabase.from('answers').insert(respuestas)
      if (ansErr) throw ansErr

      const correctas = respuestas.filter(r => r.is_correct).length
      const score = Math.round((correctas / prList.length) * 100)
      const aprueba = score >= (nv?.passing_score ?? 70)

      await supabase.from('attempts').update({ end_time: new Date().toISOString(), score, status: 'completed' }).eq('id', aId)

      navigate('/resultado-final', {
        state: { attemptId: aId, score, correctas, total: prList.length, aprueba, nivelNombre: nv?.name ?? '', evalTitulo: nv?.evaluations?.title ?? '', forzado },
      })
    } catch (err) {
      setEnviando(false)
      enviandoRef.current = false
    }
  }

  // Bloquea respuesta si ya respondió en modo práctica
  const seleccionarOpcion = useCallback((optionId) => {
    setSeleccion(prev => {
      if (esPractica && prev[pregActual]) return prev // bloqueado
      return { ...prev, [pregActual]: optionId }
    })
  }, [pregActual, esPractica])

  const toggleMarcada = useCallback(() => {
    setMarcadas(prev => prev.includes(pregActual) ? prev.filter(i => i !== pregActual) : [...prev, pregActual])
  }, [pregActual])

  

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen mensaje={error} onVolver={() => navigate('/catalogo')} />

  const pregData = preguntas[pregActual]
  const seleccionActual = seleccion[pregActual]
  const opcionCorrecta = pregData?.options?.find(o => o.is_correct)
  const totalPregs = preguntas.length
  const respondidas = Object.keys(seleccion).length
  const sinResponder = totalPregs - respondidas
  const evalTitulo = nivel?.evaluations?.title ?? ''
  const catNombre = nivel?.evaluations?.categories?.name ?? ''
  const pctProgreso = totalPregs > 0 ? (respondidas / totalPregs) * 100 : 0
  const yaRespondio = !!seleccionActual

  return (
    <div className="flex min-h-screen bg-background">

      {modalEnvio && (
        <ModalEnvio totalPregs={totalPregs} respondidas={respondidas} sinResponder={sinResponder}
          onConfirmar={() => ejecutarEnvio(attemptId, preguntas, seleccion, nivel)}
          onCancelar={() => setModalEnvio(false)} enviando={enviando} />
      )}

      {/* Sidebar desktop — solo visual, sin navegación */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 z-50 bg-slate-50 border-r border-slate-200/50 flex-col p-4 gap-4">
        <div className="px-2">
          <h2 className="text-lg font-extrabold text-blue-800 font-headline">{APP.name}</h2>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-widest">
            {esPractica ? 'Modo Práctica' : 'Modo Examen'}
          </p>
        </div>

        <div className="px-2 space-y-1">
          <div className="flex justify-between text-xs font-bold text-on-surface-variant">
            <span>{respondidas} respondidas</span>
            <span>{sinResponder} restantes</span>
          </div>
          <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${pctProgreso}%` }} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">Mapa de preguntas</h3>
          {/* Solo visual */}
          <div className="grid grid-cols-4 gap-2">
            {preguntas.map((_, i) => {
              let cls = 'w-full aspect-square rounded-lg text-xs font-bold flex items-center justify-center '
              if (i === pregActual) cls += 'bg-primary text-white'
              else if (seleccion[i]) cls += 'bg-secondary-container text-secondary'
              else if (marcadas.includes(i)) cls += 'bg-tertiary-container text-tertiary'
              else cls += 'bg-surface-container text-on-surface-variant'
              return <div key={i} className={cls}>{i + 1}</div>
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex flex-col gap-1.5 text-[10px] font-bold text-on-surface-variant">
          {[
            { color: 'bg-secondary-container', label: 'Respondida' },
            { color: 'bg-primary', label: 'Actual' },
            { color: 'bg-tertiary-container', label: 'Marcada' },
            { color: 'bg-surface-container', label: 'Sin responder' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded ${color} inline-block flex-shrink-0`} />{label}
            </span>
          ))}
        </div>

        <button onClick={() => setModalEnvio(true)} disabled={enviando}
          className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          Enviar prueba
        </button>

        <button onClick={() => navigate('/catalogo')}
          className="w-full py-2 border border-outline-variant rounded-xl text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-all flex items-center justify-center gap-1">
          <span className="material-symbols-outlined text-sm">exit_to_app</span>
          Salir
        </button>
      </aside>

      {/* Botón Ver mapa móvil */}
      <button className="md:hidden fixed bottom-20 left-4 z-40 bg-primary text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-2"
        onClick={() => setMapaAbierto(true)}>
        <span className="material-symbols-outlined text-sm">map</span>
        {Math.round(pctProgreso)}%
      </button>

      {mapaAbierto && (
        <MobileMapModal preguntas={preguntas} seleccion={seleccion} marcadas={marcadas}
          pregActual={pregActual} onClose={() => setMapaAbierto(false)} />
      )}

      {/* Header */}
      <header className="fixed top-0 right-0 left-0 md:left-64 z-40 bg-white/90 backdrop-blur shadow-sm flex items-center justify-between px-3 md:px-6 py-2 md:py-3">
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm font-bold text-blue-700 font-headline leading-tight truncate">{evalTitulo}</span>
          {nivel?.name && <span className="text-[10px] text-on-surface-variant">{nivel.name}</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Timer */}
          <div className={`flex items-center gap-1 font-bold text-sm px-2 py-1 rounded-full shrink-0
            ${timerCritico ? 'text-error bg-error-container animate-pulse' : timerWarn ? 'text-tertiary' : 'text-primary'}`}>
            <span className="material-symbols-outlined text-base">timer</span>
            <span>{esPractica ? formatTimer(timerPregunta) : formatTimer(segundos)}</span>
          </div>

          {/* Badge modo */}
          <span className={`hidden sm:flex text-[10px] font-bold px-2 py-1 rounded-full ${esPractica ? 'bg-secondary-container text-secondary' : 'bg-primary-fixed text-primary'}`}>
            {esPractica ? 'PRÁCTICA' : 'EXAMEN'}
          </span>

          <button onClick={toggleMarcada}
            className={`p-1.5 rounded-full border transition-all ${marcadas.includes(pregActual) ? 'border-tertiary text-tertiary bg-tertiary-fixed' : 'border-outline-variant text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: marcadas.includes(pregActual) ? "'FILL' 1" : "'FILL' 0" }}>flag</span>
          </button>

          <button onClick={() => setModalEnvio(true)} disabled={enviando}
            className="bg-primary text-on-primary px-3 md:px-6 py-2 rounded-full font-bold text-xs md:text-sm shadow active:scale-95 transition-all disabled:opacity-60 flex items-center gap-1">
            {enviando ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Enviar'}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col p-4 md:p-8 gap-6 max-w-4xl w-full animate-fade-in pt-[4.5rem] pb-24 md:pb-8 md:ml-64">

        {/* Info pregunta */}
        <div className="flex items-center gap-2 flex-wrap">
          {catNombre && (
            <span className="bg-primary-fixed text-on-primary-fixed px-3 py-1 rounded-full text-xs font-bold uppercase">{catNombre}</span>
          )}
          <span className="text-on-surface-variant text-sm font-medium">Pregunta {pregActual + 1} de {totalPregs}</span>
          {esPractica && <span className="text-[10px] font-bold text-secondary bg-secondary-container px-2 py-0.5 rounded-full">Con retroalimentación</span>}
          {marcadas.includes(pregActual) && (
            <span className="bg-tertiary-fixed text-tertiary px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>Marcada
            </span>
          )}
        </div>

        <h1 className="text-lg md:text-2xl font-bold text-on-surface leading-snug">{pregData?.text}</h1>

        {/* Opciones */}
        <div className="flex flex-col gap-3">
          {pregData?.options?.map(op => {
            const seleccionada = seleccionActual === op.id
            const esCorrecta = op.is_correct
            const bloqueada = esPractica && yaRespondio

            let cls = 'flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-200 w-full '
            if (bloqueada) {
              if (esCorrecta) cls += 'border-secondary bg-secondary-container/30 scale-[1.01]'
              else if (seleccionada) cls += 'border-error bg-error-container/30'
              else cls += 'border-outline-variant/20 opacity-60'
            } else {
              if (seleccionada) cls += 'border-primary bg-primary-fixed/50 scale-[1.02] shadow-md'
              else cls += 'border-outline-variant/30 hover:border-primary/50 hover:shadow-sm active:scale-[0.98]'
            }

            return (
              <button key={op.id} onClick={() => seleccionarOpcion(op.id)} disabled={bloqueada && !seleccionada && esPractica} className={cls}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all
                  ${bloqueada && esCorrecta ? 'bg-secondary text-white'
                    : bloqueada && seleccionada ? 'bg-error text-white'
                    : seleccionada ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface-variant'}`}>
                  {bloqueada && esCorrecta ? '✓' : bloqueada && seleccionada && !esCorrecta ? '✗' : op.letter ?? '?'}
                </div>
                <p className="text-sm md:text-base font-medium text-on-surface leading-snug flex-1">{op.text}</p>
              </button>
            )
          })}
        </div>

        {/* Retroalimentación — solo modo práctica */}
        {esPractica && yaRespondio && pregData?.explanation && (
          <section className={`rounded-2xl p-4 border-l-4 animate-fade-in ${seleccionActual === opcionCorrecta?.id ? 'bg-secondary-container/20 border-secondary' : 'bg-error-container/20 border-error'}`}>
            <p className={`font-bold text-sm mb-2 ${seleccionActual === opcionCorrecta?.id ? 'text-secondary' : 'text-error'}`}>
              {seleccionActual === opcionCorrecta?.id ? '✅ ¡Respuesta correcta!' : `❌ Correcta: opción ${opcionCorrecta?.letter ?? '—'}`}
            </p>
            <p className="text-on-surface-variant text-sm leading-relaxed">{pregData.explanation}</p>
          </section>
        )}

        {/* Navegación */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <button onClick={() => navigate('/catalogo')}
            className="flex items-center gap-1 px-3 py-2 rounded-full border border-outline-variant text-on-surface-variant text-xs font-bold hover:bg-surface-container transition-all">
            <span className="material-symbols-outlined text-sm">exit_to_app</span>
            Salir
          </button>

          <div className="flex items-center gap-1">
            <button onClick={() => setPregActual(p => Math.max(0, p - 1))} disabled={pregActual === 0}
              className="p-2 rounded-full text-primary hover:bg-primary-fixed transition-colors disabled:opacity-30">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="text-xs font-bold text-on-surface-variant px-2">{pregActual + 1}/{totalPregs}</span>
            <button onClick={() => setPregActual(p => Math.min(totalPregs - 1, p + 1))} disabled={pregActual === totalPregs - 1}
              className="p-2 rounded-full text-primary hover:bg-primary-fixed transition-colors disabled:opacity-30">
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          </div>

          {pregActual === totalPregs - 1 ? (
            <button onClick={() => setModalEnvio(true)} disabled={enviando}
              className="flex items-center gap-1 bg-secondary text-on-secondary px-4 py-2 rounded-full font-bold text-sm active:scale-95 transition-all">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              Finalizar
            </button>
          ) : (
            <button onClick={() => setPregActual(p => p + 1)}
              className="flex items-center gap-1 bg-primary text-on-primary px-4 py-2 rounded-full font-bold text-sm active:scale-95 transition-all">
              Siguiente
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
        </div>
      </main>
    </div>
  )
}