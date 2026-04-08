import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../utils/supabase'

function formatTimer(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

export default function SalaSimulacro() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const { state } = useLocation()
  const { participantId, isHost, displayName } = state || {}

  const [room, setRoom] = useState(null)
  const [preguntas, setPreguntas] = useState([])
  const [pregActual, setPregActual] = useState(0)
  const [seleccion, setSeleccion] = useState(null)
  const [timer, setTimer] = useState(90)
  const [participantes, setParticipantes] = useState([])
  const [terminado, setTerminado] = useState(false)
  const [miScore, setMiScore] = useState({ correct: 0, wrong: 0, score: 0 })

  const intervalRef = useRef(null)
  const timerRef = useRef(90)

  useEffect(() => {
    iniciar()
    const sub = supabase.channel(`sala-juego-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.status === 'finished') mostrarResultados()
          if (payload.new.current_question !== pregActual) {
            avanzarPregunta(payload.new.current_question)
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => cargarParticipantes())
      .subscribe()

    return () => { supabase.removeChannel(sub); clearInterval(intervalRef.current) }
  }, [roomId])

  // ✅ FUNCIÓN INICIAR CORREGIDA
  async function iniciar() {
    // 1. Obtener datos de la sala (sin join incorrecto)
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()
    
    if (!roomData) return
    setRoom(roomData)

    // 2. Cargar preguntas del nivel seleccionado
    const { data: qData, error } = await supabase
      .from('questions')
      .select('id, text, options(id, text, letter, is_correct)')
      .eq('level_id', roomData.level_id)
      .limit(roomData.max_questions)

    if (error || !qData?.length) {
      console.error('Error cargando preguntas:', error)
      return
    }

    // 3. Mezclar preguntas
    const shuffled = [...qData].sort(() => Math.random() - 0.5)
    setPreguntas(shuffled)

    // 4. Cargar participantes y luego iniciar timer
    await cargarParticipantes()
    iniciarTimer(roomData.timer_per_question || 90)
  }

  function iniciarTimer(seg) {
    timerRef.current = seg
    setTimer(seg)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      timerRef.current -= 1
      setTimer(timerRef.current)
      if (timerRef.current <= 0) {
        clearInterval(intervalRef.current)
        if (isHost) avanzarDesdeHost()
        else registrarRespuesta(null, false)
      }
    }, 1000)
  }

  async function cargarParticipantes() {
    const { data } = await supabase.from('room_participants').select('*').eq('room_id', roomId).order('score', { ascending: false })
    setParticipantes(data || [])
    const yo = data?.find(p => p.id === participantId)
    if (yo) setMiScore({ correct: yo.correct, wrong: yo.wrong, score: yo.score })
  }

  async function seleccionarOpcion(op) {
    if (seleccion) return
    setSeleccion(op.id)
    const esCorrecta = op.is_correct
    await registrarRespuesta(op.id, esCorrecta)
  }

  async function registrarRespuesta(optionId, esCorrecta) {
    await supabase.from('room_answers').insert({
      room_id: roomId, participant_id: participantId,
      question_index: pregActual, selected_option_id: optionId, is_correct: esCorrecta
    })
    const newCorrect = miScore.correct + (esCorrecta ? 1 : 0)
    const newWrong = miScore.wrong + (!esCorrecta ? 1 : 0)
    await supabase.from('room_participants').update({
      correct: newCorrect, wrong: newWrong, score: newCorrect
    }).eq('id', participantId)
  }

  async function avanzarDesdeHost() {
    const siguiente = pregActual + 1
    if (siguiente >= preguntas.length) {
      await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    } else {
      await supabase.from('rooms').update({ current_question: siguiente }).eq('id', roomId)
    }
  }

  function avanzarPregunta(idx) {
    setPregActual(idx)
    setSeleccion(null)
    iniciarTimer(room?.timer_per_question || 90)
  }

  function mostrarResultados() {
    clearInterval(intervalRef.current)
    setTerminado(true)
    cargarParticipantes()
  }

  if (terminado) {
    const ordenados = [...participantes].sort((a, b) => b.score - a.score)
    const miPosicion = ordenados.findIndex(p => p.id === participantId) + 1
    return (
      <div className="p-4 md:p-8 pb-24 max-w-2xl animate-fade-in">
        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-secondary bg-secondary-container px-3 py-1 rounded-full">Resultados finales</span>
            <span className="font-mono font-bold">{roomId}</span>
          </div>
          <h2 className="text-2xl font-extrabold mb-1">Ranking de la sala</h2>
          {ordenados[0] && (
            <p className="text-sm text-on-surface-variant mb-4">
              Mejor: <strong>{ordenados[0].display_name}</strong> con {ordenados[0].correct}/{preguntas.length} aciertos
            </p>
          )}

          {/* Mi resultado */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-3 text-center">
              <p className="text-2xl font-extrabold text-primary">#{miPosicion}</p>
              <p className="text-xs text-on-surface-variant">Tu posición</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-extrabold text-secondary">{miScore.correct}</p>
              <p className="text-xs text-on-surface-variant">Aciertos</p>
            </div>
            <div className="card p-3 text-center">
              <p className="text-2xl font-extrabold text-error">{miScore.wrong}</p>
              <p className="text-xs text-on-surface-variant">Errores</p>
            </div>
          </div>

          {/* Ranking */}
          <div className="space-y-2">
            {ordenados.map((p, idx) => (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl ${p.id === participantId ? 'bg-primary-fixed/30 border border-primary/20' : 'bg-surface-container-low'}`}>
                <span className="font-extrabold text-lg w-6 text-center">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}</span>
                <span className="flex-1 font-semibold text-sm">{p.display_name}</span>
                <span className="font-bold text-secondary">{p.correct} ✓</span>
                <span className="font-bold text-error">{p.wrong} ✗</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate('/salas')} className="flex-1 py-3 border border-outline-variant rounded-xl font-bold text-sm">Ir al inicio</button>
          {isHost && <button onClick={async () => { await supabase.from('rooms').delete().eq('id', roomId); navigate('/salas') }}
            className="flex-1 py-3 bg-error text-white rounded-xl font-bold text-sm">Cerrar sala</button>}
        </div>
      </div>
    )
  }

  const pregData = preguntas[pregActual]
  const pct = timer / (room?.timer_per_question || 90) * 100

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-primary bg-primary-fixed px-3 py-1 rounded-full">Sala {roomId}</span>
        <div className={`font-mono font-extrabold text-2xl px-4 py-2 rounded-full ${timer <= 10 ? 'text-error bg-error-container animate-pulse' : 'text-primary bg-primary-fixed'}`}>
          {formatTimer(timer)}
        </div>
      </div>

      {/* Barra progreso timer */}
      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden mb-4">
        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="text-xs font-bold text-on-surface-variant mb-4">Pregunta {pregActual + 1} de {preguntas.length}</p>

      {pregData && (
        <>
          <h1 className="text-lg font-bold text-on-surface mb-4 leading-snug">{pregData.text}</h1>

          <div className="flex flex-col gap-3 mb-6">
            {pregData.options?.sort((a, b) => (a.letter || '').localeCompare(b.letter || '')).map(op => {
              const seleccionada = seleccion === op.id
              return (
                <button key={op.id} onClick={() => seleccionarOpcion(op)} disabled={!!seleccion}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all w-full
                    ${seleccionada ? 'border-primary bg-primary-fixed/50 scale-[1.01]' : seleccion ? 'border-outline-variant/20 opacity-50' : 'border-outline-variant/30 hover:border-primary/50 active:scale-[0.98]'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${seleccionada ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                    {op.letter}
                  </div>
                  <p className="text-sm font-medium">{op.text}</p>
                </button>
              )
            })}
          </div>

          {seleccion && !isHost && (
            <p className="text-center text-sm text-on-surface-variant animate-pulse">Esperando siguiente pregunta...</p>
          )}

          {isHost && seleccion && (
            <button onClick={avanzarDesdeHost}
              className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
              Siguiente pregunta →
            </button>
          )}
        </>
      )}

      {/* Mini ranking */}
      <div className="mt-6 card p-4">
        <p className="text-xs font-bold text-on-surface-variant mb-2">Ranking en vivo</p>
        <div className="space-y-1">
          {[...participantes].sort((a, b) => b.score - a.score).slice(0, 5).map((p, idx) => (
            <div key={p.id} className={`flex items-center gap-2 text-sm ${p.id === participantId ? 'font-bold text-primary' : ''}`}>
              <span className="w-4 text-center text-xs">#{idx+1}</span>
              <span className="flex-1 truncate">{p.display_name}</span>
              <span className="font-bold">{p.correct} ✓</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}