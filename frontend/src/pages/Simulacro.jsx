import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimer(s) {
  if (s <= 0) return '00:00'
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Pantallas auxiliares ──────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex min-h-screen bg-slate-50 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center">
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-on-surface-variant font-semibold text-sm">Preparando simulacro...</p>
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
        <h2 className="font-extrabold text-xl mb-2">No se pudo iniciar</h2>
        <p className="text-on-surface-variant text-sm mb-6 leading-relaxed">{mensaje}</p>
        <button onClick={onVolver}
          className="w-full py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:bg-primary/90 transition-all">
          Volver
        </button>
      </div>
    </div>
  )
}

// ── Modal confirmación de envío ───────────────────────────────────────────────

function ModalEnvio({ totalPregs, respondidas, sinResponder, onConfirmar, onCancelar, enviando }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-fade-in">
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-primary text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
          </div>
          <h3 className="text-2xl font-extrabold">Enviar prueba</h3>
          <p className="text-sm text-on-surface-variant mt-1">Esta acción no se puede deshacer</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { val: respondidas, label: 'Respondidas', cls: 'bg-secondary-container/30 border-secondary/15 text-secondary' },
            { val: sinResponder, label: 'Sin resp.', cls: sinResponder > 0 ? 'bg-error-container/20 border-error/15 text-error' : 'bg-slate-50 border-slate-200 text-on-surface-variant' },
            { val: totalPregs,  label: 'Total',       cls: 'bg-slate-50 border-slate-200 text-on-surface' },
          ].map(({ val, label, cls }) => (
            <div key={label} className={`rounded-2xl p-4 text-center border ${cls}`}>
              <p className="text-3xl font-extrabold">{val}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider mt-1 text-on-surface-variant">{label}</p>
            </div>
          ))}
        </div>

        {sinResponder > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <span className="material-symbols-outlined text-amber-600 text-lg flex-shrink-0">warning</span>
            <p className="text-sm text-amber-800 font-medium">
              {sinResponder} pregunta{sinResponder > 1 ? 's' : ''} sin responder contar{sinResponder > 1 ? 'án' : 'á'} como incorrecta{sinResponder > 1 ? 's' : ''}.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onCancelar} disabled={enviando}
            className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all disabled:opacity-60">
            Revisar
          </button>
          <button onClick={onConfirmar} disabled={enviando}
            className="flex-1 py-3 rounded-full bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {enviando
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Enviando...</>
              : <><span className="material-symbols-outlined text-sm">send</span>Confirmar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal mapa móvil (con navegación clickeable) ──────────────────────────────

function MobileMapModal({ preguntas, seleccion, marcadas, pregActual, onClose, onIr }) {
  const respondidas = Object.keys(seleccion).length
  const total       = preguntas.length
  const pct         = total > 0 ? Math.round((respondidas / total) * 100) : 0

  function getCls(i) {
    const base = 'w-10 h-10 rounded-xl text-[11px] font-bold flex items-center justify-center transition-all active:scale-95 '
    if (i === pregActual)                      return base + 'bg-primary text-white shadow-md scale-105'
    if (seleccion[i] && marcadas.includes(i))  return base + 'bg-secondary-container text-secondary ring-2 ring-tertiary/50'
    if (seleccion[i])                          return base + 'bg-secondary-container text-secondary'
    if (marcadas.includes(i))                  return base + 'bg-tertiary-container text-tertiary'
    return base + 'bg-slate-100 text-slate-500 hover:bg-slate-200'
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 flex items-end md:hidden backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-h-[82vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <div>
            <h3 className="font-extrabold text-lg">Mapa de preguntas</h3>
            <p className="text-xs text-on-surface-variant">{respondidas}/{total} respondidas · {pct}%</p>
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-6 gap-2">
            {preguntas.map((_, i) => (
              <button key={i} className={getCls(i)}
                onClick={() => { onIr(i); onClose() }}>
                {i + 1}
              </button>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-semibold text-on-surface-variant">
            {[
              { color: 'bg-primary',              label: 'Actual' },
              { color: 'bg-secondary-container',  label: 'Respondida' },
              { color: 'bg-tertiary-container',   label: 'Marcada' },
              { color: 'bg-slate-100 border border-slate-200', label: 'Sin responder' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-lg ${color} inline-block flex-shrink-0`} />
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
  const navigate        = useNavigate()
  const { id }          = useParams()
  const [searchParams]  = useSearchParams()
  const { user }        = useAuth()

  // Config desde URL (enviada por DetallePrueba)
  const modo        = searchParams.get('modo')    || 'examen'
  const esPractica  = modo === 'practica'
  const ordenParam  = searchParams.get('orden')   || 'aleatorio'
  const cantParam   = parseInt(searchParams.get('cantidad') || '0', 10)
  const conRetro    = searchParams.get('retro')   !== '0'
  const timerParam  = parseInt(searchParams.get('timer') || '90', 10)

  // Estado UI
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [enviando,     setEnviando]     = useState(false)
  const [modalEnvio,   setModalEnvio]   = useState(false)
  const [mapaAbierto,  setMapaAbierto]  = useState(false)

  // Estado del simulacro
  const [nivel,        setNivel]        = useState(null)
  const [preguntas,    setPreguntas]    = useState([])
  const [attemptId,    setAttemptId]    = useState(null)
  const [pregActual,   setPregActual]   = useState(0)
  const [seleccion,    setSeleccion]    = useState({})
  const [marcadas,     setMarcadas]     = useState([])

  // Timers
  const [segundos,      setSegundos]      = useState(0)      // examen: countdown total
  const [timerPregunta, setTimerPregunta] = useState(timerParam) // práctica: por pregunta
  const [timerWarn,     setTimerWarn]     = useState(false)
  const [timerCritico,  setTimerCritico]  = useState(false)
  const [tiempoAgotado, setTiempoAgotado] = useState(false)

  // Refs para closures async
  const intervalRef   = useRef(null)
  const seleccionRef  = useRef({})
  const preguntasRef  = useRef([])
  const attemptIdRef  = useRef(null)
  const nivelRef      = useRef(null)
  const enviandoRef   = useRef(false)

  useEffect(() => { seleccionRef.current  = seleccion },  [seleccion])
  useEffect(() => { preguntasRef.current  = preguntas },  [preguntas])
  useEffect(() => { attemptIdRef.current  = attemptId },  [attemptId])
  useEffect(() => { nivelRef.current      = nivel },      [nivel])

  // Arranque
  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (id) iniciarSimulacro()
    return () => clearInterval(intervalRef.current)
  }, [id, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Timer por pregunta (modo práctica) ───────────────────────────────────
  // Se reinicia limpiamente cada vez que cambia pregActual o se cargan preguntas.
  // Si la pregunta ya fue respondida, no arranca el timer.
  useEffect(() => {
    if (!esPractica || timerParam === 0 || !preguntas.length) return

    clearInterval(intervalRef.current)

    if (seleccionRef.current[pregActual]) return // ya respondida, sin timer

    setTimerPregunta(timerParam)
    setTiempoAgotado(false)

    intervalRef.current = setInterval(() => {
      setTimerPregunta(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current)
          setTiempoAgotado(true)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [pregActual, esPractica, timerParam, preguntas.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Carga e inicio ────────────────────────────────────────────────────────

  async function iniciarSimulacro() {
    setLoading(true)
    setError(null)
    try {
      const { data: lvData, error: lvErr } = await supabase
        .from('levels')
        .select('*, evaluations(id, title, categories(name))')
        .eq('id', id)
        .maybeSingle()
      if (lvErr) throw lvErr

      const { data: qData, error: qErr } = await supabase
        .from('questions')
        .select('id, text, explanation, question_type, options(id, text, letter, is_correct)')
        .eq('level_id', id)
        .order('id')
      if (qErr) throw qErr
      if (!qData?.length) throw new Error('Este nivel aún no tiene preguntas cargadas.')

      let lista = qData.map(q => ({
        ...q,
        options: [...(q.options || [])]
          .filter(o => o.text?.trim())
          .sort((a, b) => (a.letter || '').localeCompare(b.letter || '')),
      }))

      // Aplicar orden
      if (ordenParam === 'aleatorio') lista = shuffleArray(lista)

      // Aplicar cantidad
      if (cantParam > 0 && cantParam < lista.length) lista = lista.slice(0, cantParam)

      const { data: attempt, error: attErr } = await supabase
        .from('attempts')
        .insert({ user_id: user.id, level_id: id, start_time: new Date().toISOString(), status: 'in_progress' })
        .select('id')
        .maybeSingle()
      if (attErr) throw attErr

      // Timer total solo en modo examen
      if (!esPractica) {
        const tiempoTotal = (lvData.time_limit ?? 60) * 60
        setSegundos(tiempoTotal)
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
            if (nuevo <= 60)  setTimerCritico(true)
            else if (nuevo <= 300) setTimerWarn(true)
            return nuevo
          })
        }, 1000)
      }

      setNivel(lvData)
      setPreguntas(lista)
      setAttemptId(attempt.id)
    } catch (err) {
      setError(err.message || 'No se pudo iniciar el simulacro.')
    } finally {
      setLoading(false)
    }
  }

  // ── Envío de respuestas ───────────────────────────────────────────────────

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
          is_correct:         selectedOptionId ? selectedOptionId === opcionCorrecta?.id : false,
        }
      })

      const { error: ansErr } = await supabase.from('answers').insert(respuestas)
      if (ansErr) throw ansErr

      const correctas = respuestas.filter(r => r.is_correct).length
      const score     = Math.round((correctas / prList.length) * 100)
      const aprueba   = score >= (nv?.passing_score ?? 70)

      await supabase.from('attempts')
        .update({ end_time: new Date().toISOString(), score, status: 'completed' })
        .eq('id', aId)

      navigate('/resultado-final', {
        state: {
          attemptId: aId, score, correctas,
          total: prList.length, aprueba,
          nivelNombre:  nv?.name ?? '',
          evalTitulo:   nv?.evaluations?.title ?? '',
          levelId:      id,
          passingScore: nv?.passing_score ?? 70,
          forzado,
        },
      })
    } catch (err) {
      setEnviando(false)
      enviandoRef.current = false
    }
  }

  // ── Interacciones ─────────────────────────────────────────────────────────

  const seleccionarOpcion = useCallback((optionId) => {
    setSeleccion(prev => {
      if (esPractica && prev[pregActual]) return prev // ya bloqueada
      const nuevo = { ...prev, [pregActual]: optionId }
      seleccionRef.current = nuevo
      return nuevo
    })
    // Detener timer de práctica al responder
    if (esPractica) clearInterval(intervalRef.current)
  }, [pregActual, esPractica])

  const toggleMarcada = useCallback(() => {
    setMarcadas(prev =>
      prev.includes(pregActual)
        ? prev.filter(i => i !== pregActual)
        : [...prev, pregActual]
    )
  }, [pregActual])

  const irAPregunta = useCallback((idx) => setPregActual(idx), [])

  // ── Guards de render ──────────────────────────────────────────────────────

  if (loading) return <LoadingScreen />
  if (error)   return <ErrorScreen mensaje={error} onVolver={() => navigate(-1)} />

  // ── Valores derivados ─────────────────────────────────────────────────────

  const pregData        = preguntas[pregActual]
  const seleccionActual = seleccion[pregActual]
  const opcionCorrecta  = pregData?.options?.find(o => o.is_correct)
  const totalPregs      = preguntas.length
  const respondidas     = Object.keys(seleccion).length
  const sinResponder    = totalPregs - respondidas
  const pctProgreso     = totalPregs > 0 ? (respondidas / totalPregs) * 100 : 0
  const yaRespondio     = !!seleccionActual
  const bloqueada       = esPractica && yaRespondio
  const mostrarRetro    = esPractica && conRetro && yaRespondio
  const evalTitulo      = nivel?.evaluations?.title ?? ''
  const nivelNombre     = nivel?.name ?? ''

  // Colores del timer
  let timerColor = 'text-on-surface-variant'
  let timerBg    = 'bg-slate-100'
  let timerPulse = false
  if (!esPractica) {
    if (timerCritico)      { timerColor = 'text-error'; timerBg = 'bg-error-container'; timerPulse = true }
    else if (timerWarn)    { timerColor = 'text-amber-600'; timerBg = 'bg-amber-50' }
    else                   { timerColor = 'text-primary'; timerBg = 'bg-primary/10' }
  } else if (timerParam > 0) {
    const pct = timerPregunta / timerParam
    if (pct <= 0.2)        { timerColor = 'text-error'; timerBg = 'bg-error-container'; timerPulse = true }
    else if (pct <= 0.4)   { timerColor = 'text-amber-600'; timerBg = 'bg-amber-50' }
    else                   { timerColor = 'text-primary'; timerBg = 'bg-primary/10' }
  }

  const timerDisplay = esPractica
    ? (timerParam > 0 ? formatTimer(timerPregunta) : null)
    : formatTimer(segundos)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* Modales */}
      {modalEnvio && (
        <ModalEnvio
          totalPregs={totalPregs} respondidas={respondidas} sinResponder={sinResponder}
          onConfirmar={() => ejecutarEnvio(attemptId, preguntas, seleccion, nivel)}
          onCancelar={() => setModalEnvio(false)} enviando={enviando}
        />
      )}
      {mapaAbierto && (
        <MobileMapModal
          preguntas={preguntas} seleccion={seleccion} marcadas={marcadas}
          pregActual={pregActual} onClose={() => setMapaAbierto(false)} onIr={irAPregunta}
        />
      )}

      {/* ─── SIDEBAR DESKTOP ─────────────────────────────────────────────── */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-72 z-50 bg-white border-r border-slate-200 flex-col shadow-sm">

        {/* Branding */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-extrabold text-primary font-headline text-base">{APP.name}</span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${esPractica ? 'bg-secondary-container text-secondary' : 'bg-primary/10 text-primary'}`}>
              {esPractica ? 'PRÁCTICA' : 'EXAMEN'}
            </span>
          </div>
          <p className="text-sm font-semibold text-on-surface truncate">{evalTitulo}</p>
          {nivelNombre && <p className="text-xs text-on-surface-variant/70 mt-0.5">{nivelNombre}</p>}
        </div>

        {/* Progreso */}
        <div className="px-5 py-3 border-b border-slate-100">
          <div className="flex justify-between text-xs font-bold text-on-surface-variant mb-1.5">
            <span>{respondidas} de {totalPregs}</span>
            <span>{Math.round(pctProgreso)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${pctProgreso}%` }} />
          </div>
        </div>

        {/* Mapa de preguntas CLICKEABLE */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">
            Navegar preguntas
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {preguntas.map((_, i) => {
              let cls = 'w-full aspect-square rounded-xl text-[11px] font-bold flex items-center justify-center transition-all hover:scale-105 active:scale-95 '
              if (i === pregActual)
                cls += 'bg-primary text-white shadow-md'
              else if (seleccion[i] && marcadas.includes(i))
                cls += 'bg-secondary-container text-secondary ring-2 ring-tertiary/40'
              else if (seleccion[i])
                cls += 'bg-secondary-container text-secondary'
              else if (marcadas.includes(i))
                cls += 'bg-tertiary-container text-tertiary'
              else
                cls += 'bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer'
              return (
                <button key={i} className={cls}
                  onClick={() => irAPregunta(i)}
                  title={`Ir a pregunta ${i + 1}`}>
                  {i + 1}
                </button>
              )
            })}
          </div>

          {/* Leyenda */}
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
            {[
              { color: 'bg-primary',              label: 'Actual' },
              { color: 'bg-secondary-container',  label: 'Respondida' },
              { color: 'bg-tertiary-container',   label: 'Marcada' },
              { color: 'bg-slate-100 border border-slate-200', label: 'Sin responder' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-2 text-[10px] font-semibold text-on-surface-variant">
                <span className={`w-3.5 h-3.5 rounded-md ${color} inline-block flex-shrink-0`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Acciones */}
        <div className="px-5 py-4 border-t border-slate-100 space-y-2">
          <button onClick={() => setModalEnvio(true)} disabled={enviando}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            Enviar prueba
          </button>
          <button onClick={() => navigate(-1)}
            className="w-full py-2 text-xs font-bold text-on-surface-variant hover:bg-slate-50 rounded-xl transition-all flex items-center justify-center gap-1.5">
            <span className="material-symbols-outlined text-sm">exit_to_app</span>
            Salir del simulacro
          </button>
        </div>
      </aside>

      {/* ─── HEADER ──────────────────────────────────────────────────────── */}
      <header className="fixed top-0 right-0 left-0 lg:left-72 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 gap-3">

          {/* Izquierda: botón mapa (móvil) + info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-xs font-bold text-on-surface-variant transition-all"
              onClick={() => setMapaAbierto(true)}>
              <span className="material-symbols-outlined text-sm">grid_view</span>
              {Math.round(pctProgreso)}%
            </button>
            <div className="hidden md:block min-w-0">
              <p className="font-bold text-sm text-on-surface truncate leading-tight">{evalTitulo}</p>
              {nivelNombre && (
                <p className="text-xs text-on-surface-variant">
                  {nivelNombre} · <span className="font-semibold">Pregunta {pregActual + 1} de {totalPregs}</span>
                </p>
              )}
            </div>
            <span className="md:hidden text-xs font-bold text-on-surface-variant">
              {pregActual + 1} / {totalPregs}
            </span>
          </div>

          {/* Derecha: timer + marcar + enviar */}
          <div className="flex items-center gap-2 shrink-0">
            {timerDisplay && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm transition-all tabular-nums ${timerBg} ${timerColor} ${timerPulse ? 'animate-pulse' : ''}`}>
                <span className="material-symbols-outlined text-base">timer</span>
                {timerDisplay}
              </div>
            )}

            <button onClick={toggleMarcada}
              className={`p-2 rounded-full border-2 transition-all ${marcadas.includes(pregActual) ? 'border-tertiary text-tertiary bg-tertiary-container' : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}
              title="Marcar para revisar">
              <span className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: marcadas.includes(pregActual) ? "'FILL' 1" : "'FILL' 0" }}>
                flag
              </span>
            </button>

            <button onClick={() => setModalEnvio(true)} disabled={enviando}
              className="lg:hidden bg-primary text-on-primary px-4 py-2 rounded-full font-bold text-xs shadow active:scale-95 transition-all disabled:opacity-60">
              Enviar
            </button>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="h-0.5 bg-slate-100">
          <div className="h-full bg-primary transition-all duration-500"
            style={{ width: `${pctProgreso}%` }} />
        </div>
      </header>

      {/* ─── CONTENIDO PRINCIPAL ─────────────────────────────────────────── */}
      <main className="flex-1 lg:ml-72 pt-[3.75rem] pb-28 lg:pb-12">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 md:py-8">

          {/* Badges de estado */}
          <div className="flex items-center gap-2 mb-5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="material-symbols-outlined text-sm">quiz</span>
              Pregunta {pregActual + 1} de {totalPregs}
            </span>
            {marcadas.includes(pregActual) && (
              <span className="inline-flex items-center gap-1 bg-tertiary-container text-tertiary text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}>flag</span>
                Marcada
              </span>
            )}
            {esPractica && tiempoAgotado && !yaRespondio && (
              <span className="inline-flex items-center gap-1 bg-error-container text-error text-xs font-bold px-3 py-1.5 rounded-full">
                <span className="material-symbols-outlined text-sm">timer_off</span>
                Tiempo agotado
              </span>
            )}
            {mostrarRetro && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full ${seleccionActual === opcionCorrecta?.id ? 'bg-secondary-container text-secondary' : 'bg-error-container text-error'}`}>
                {seleccionActual === opcionCorrecta?.id ? '✅ Correcta' : '❌ Incorrecta'}
              </span>
            )}
          </div>

          {/* Tarjeta de la pregunta */}
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 mb-5">
            <p className="text-lg md:text-xl font-semibold text-on-surface leading-relaxed">
              {pregData?.text}
            </p>
          </div>

          {/* Opciones */}
          <div className="space-y-3 mb-5">
            {pregData?.options?.map(op => {
              const seleccionada = seleccionActual === op.id
              const esCorrecta   = op.is_correct
              const disabled     = bloqueada

              let cls       = 'flex items-center gap-4 p-4 md:p-5 rounded-2xl border-2 text-left transition-all duration-200 w-full group '
              let circleCls = 'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-all '

              if (bloqueada) {
                if (esCorrecta) {
                  cls       += 'border-secondary bg-secondary-container/15 cursor-default'
                  circleCls += 'bg-secondary text-white'
                } else if (seleccionada) {
                  cls       += 'border-error bg-error-container/10 cursor-default'
                  circleCls += 'bg-error text-white'
                } else {
                  cls       += 'border-slate-100 bg-slate-50/80 opacity-40 cursor-default'
                  circleCls += 'bg-slate-200 text-slate-400'
                }
              } else if (seleccionada) {
                cls       += 'border-primary bg-primary/5 shadow-sm'
                circleCls += 'bg-primary text-white shadow-md'
              } else {
                cls       += 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-[0.99] cursor-pointer'
                circleCls += 'bg-slate-100 text-slate-500 group-hover:bg-primary/10 group-hover:text-primary'
              }

              return (
                <button key={op.id}
                  onClick={() => !disabled && seleccionarOpcion(op.id)}
                  disabled={disabled && !seleccionada}
                  className={cls}
                >
                  <div className={circleCls}>
                    {bloqueada && esCorrecta
                      ? <span className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                      : bloqueada && seleccionada && !esCorrecta
                      ? <span className="material-symbols-outlined text-base"
                          style={{ fontVariationSettings: "'FILL' 1" }}>close</span>
                      : (op.letter ?? '?')}
                  </div>
                  <p className="text-sm md:text-base font-medium text-on-surface leading-snug flex-1">
                    {op.text}
                  </p>
                  {bloqueada && esCorrecta && (
                    <span className="material-symbols-outlined text-secondary flex-shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Retroalimentación modo práctica */}
          {mostrarRetro && pregData?.explanation && (
            <div className={`rounded-2xl p-5 border-l-4 mb-5 animate-fade-in ${seleccionActual === opcionCorrecta?.id ? 'bg-secondary-container/15 border-secondary' : 'bg-error-container/10 border-error'}`}>
              <p className={`font-bold text-sm mb-2 flex items-center gap-1.5 ${seleccionActual === opcionCorrecta?.id ? 'text-secondary' : 'text-error'}`}>
                <span className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: "'FILL' 1" }}>
                  {seleccionActual === opcionCorrecta?.id ? 'lightbulb' : 'school'}
                </span>
                {seleccionActual === opcionCorrecta?.id
                  ? 'Respuesta correcta'
                  : `Respuesta correcta: opción ${opcionCorrecta?.letter ?? '—'}`}
              </p>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                {pregData.explanation}
              </p>
            </div>
          )}

          {/* Navegación inferior */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              onClick={() => setPregActual(p => Math.max(0, p - 1))}
              disabled={pregActual === 0}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-2 border-slate-200 font-bold text-sm text-on-surface-variant hover:border-slate-300 hover:bg-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Anterior
            </button>

            {/* Indicador de punto */}
            <div className="flex items-center gap-1.5">
              {Array.from({ length: Math.min(totalPregs, 7) }, (_, i) => {
                const idx = totalPregs <= 7 ? i : Math.round(i * (totalPregs - 1) / 6)
                const esActual = totalPregs <= 7 ? idx === pregActual : Math.abs(idx - pregActual) < totalPregs / 7
                return (
                  <div key={i}
                    className={`rounded-full transition-all ${esActual ? 'w-5 h-2 bg-primary' : 'w-2 h-2 bg-slate-300'}`}
                  />
                )
              })}
            </div>

            {pregActual === totalPregs - 1 ? (
              <button
                onClick={() => setModalEnvio(true)}
                disabled={enviando}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-sm active:scale-95 transition-all shadow-md disabled:opacity-60"
              >
                Finalizar
                <span className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            ) : (
              <button
                onClick={() => setPregActual(p => p + 1)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm active:scale-95 transition-all shadow-md"
              >
                Siguiente
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
