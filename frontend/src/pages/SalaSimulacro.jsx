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
  const [miScore, setMiScore] = useState({ correct: 0, wrong: 0 })
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [chatAbierto, setChatAbierto] = useState(false)
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)

  const intervalRef = useRef(null)
  const timerRef = useRef(90)
  const miScoreRef = useRef({ correct: 0, wrong: 0 })
  const pregActualRef = useRef(0)
  const chatRef = useRef(null)

  useEffect(() => {
    iniciar()
    const sub = supabase.channel(`sala-juego-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.status === 'finished') mostrarResultados()
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => cargarParticipantes())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
          if (!chatAbierto) setMensajesNoLeidos(n => n + 1)
        })
      .subscribe()

    return () => { supabase.removeChannel(sub); clearInterval(intervalRef.current) }
  }, [roomId])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function iniciar() {
    const { data: roomData } = await supabase.from('rooms').select('*').eq('id', roomId).single()
    if (!roomData) return
    setRoom(roomData)

    const { data: qData } = await supabase
      .from('questions').select('id, text, options(id, text, letter, is_correct)')
      .eq('level_id', roomData.level_id).limit(roomData.max_questions)

    if (!qData?.length) return
    const shuffled = [...qData].sort(() => Math.random() - 0.5)
    setPreguntas(shuffled)

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
        // Si no respondió, registrar como incorrecta y avanzar
        if (!seleccion) registrarYAvanzar(null, false)
      }
    }, 1000)
  }

  async function cargarParticipantes() {
    const { data } = await supabase.from('room_participants').select('*').eq('room_id', roomId).order('score', { ascending: false })
    setParticipantes(data || [])
  }

  async function seleccionarOpcion(op) {
    if (seleccion) return
    setSeleccion(op.id)
    const esCorrecta = op.is_correct
    clearInterval(intervalRef.current)
    await registrarYAvanzar(op.id, esCorrecta)
  }

  async function registrarYAvanzar(optionId, esCorrecta) {
    // Registrar respuesta
    await supabase.from('room_answers').insert({
      room_id: roomId,
      participant_id: participantId,
      question_index: pregActualRef.current,
      selected_option_id: optionId,
      is_correct: esCorrecta
    })

    // Actualizar score
    const newCorrect = miScoreRef.current.correct + (esCorrecta ? 1 : 0)
    const newWrong = miScoreRef.current.wrong + (!esCorrecta ? 1 : 0)
    miScoreRef.current = { correct: newCorrect, wrong: newWrong }
    setMiScore({ correct: newCorrect, wrong: newWrong })

    await supabase.from('room_participants').update({
      correct: newCorrect, wrong: newWrong, score: newCorrect
    }).eq('id', participantId)

    // Avanzar a siguiente pregunta independientemente
    setTimeout(() => {
      const siguiente = pregActualRef.current + 1
      pregActualRef.current = siguiente

      if (siguiente >= preguntas.length) {
        // Terminó todas sus preguntas
        mostrarResultados()
        // Si es host, finalizar sala para todos
        if (isHost) supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
      } else {
        setPregActual(siguiente)
        setSeleccion(null)
        iniciarTimer(room?.timer_per_question || 90)
      }
    }, 800) // 800ms para que vea la selección antes de avanzar
  }

  async function enviarMensaje() {
    if (!msgInput.trim()) return
    await supabase.from('room_messages').insert({
      room_id: roomId, participant_id: participantId,
      display_name: displayName, message: msgInput.trim()
    })
    setMsgInput('')
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
            <span className="font-mono font-bold text-sm">{roomId}</span>
          </div>
          <h2 className="text-2xl font-extrabold mb-1">Ranking final</h2>
          {ordenados[0] && (
            <p className="text-sm text-on-surface-variant mb-4">
              🏆 <strong>{ordenados[0].display_name}</strong> ganó con {ordenados[0].correct} aciertos
            </p>
          )}

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

          <div className="space-y-2">
            {ordenados.map((p, idx) => (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl ${p.id === participantId ? 'bg-primary-fixed/30 border border-primary/20' : 'bg-surface-container-low'}`}>
                <span className="font-extrabold text-lg w-6 text-center">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                </span>
                <span className="flex-1 font-semibold text-sm truncate">{p.display_name}</span>
                <span className="font-bold text-secondary text-sm">{p.correct} ✓</span>
                <span className="font-bold text-error text-sm">{p.wrong} ✗</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button onClick={() => navigate('/salas')} className="flex-1 py-3 border border-outline-variant rounded-xl font-bold text-sm">Ir al inicio</button>
          {isHost && (
            <button onClick={async () => { await supabase.from('rooms').delete().eq('id', roomId); navigate('/salas') }}
              className="flex-1 py-3 bg-error text-white rounded-xl font-bold text-sm">
              Cerrar sala
            </button>
          )}
        </div>

        {/* Chat en resultados */}
        <div className="card p-4">
          <p className="font-bold text-sm mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">chat</span>
            Chat de la sala
          </p>
          <div ref={chatRef} className="h-40 overflow-y-auto space-y-2 mb-3">
            {messages.length === 0 && <p className="text-xs text-center text-on-surface-variant">Sin mensajes aún</p>}
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.participant_id === participantId ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] text-on-surface-variant font-bold mb-0.5">{m.display_name}</span>
                <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[80%] ${m.participant_id === participantId ? 'bg-primary text-white' : 'bg-surface-container border border-outline-variant/20'}`}>
                  {m.message}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
              placeholder="Escribe algo..." maxLength={200}
              className="flex-1 px-3 py-2 rounded-full bg-surface-container-low text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            <button onClick={enviarMensaje} className="p-2 bg-primary text-white rounded-full">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
            </button>
          </div>
        </div>

        {/* Chat flotante en resultados */}
        <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
          {chatAbierto && (
            <div className="w-72 bg-white rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden">
              <div className="px-4 py-3 bg-primary text-white flex items-center justify-between">
                <span className="font-bold text-sm">Chat</span>
                <button onClick={() => setChatAbierto(false)}>
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const pregData = preguntas[pregActual]
  const pct = timer / (room?.timer_per_question || 90) * 100

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary bg-primary-fixed px-3 py-1 rounded-full">Sala {roomId}</span>
          {/* Participantes online */}
          <div className="flex -space-x-1">
            {participantes.slice(0, 4).map(p => (
              <div key={p.id} title={p.display_name}
                className="w-6 h-6 rounded-full bg-primary border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                {p.display_name[0].toUpperCase()}
              </div>
            ))}
            {participantes.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-surface-container border-2 border-white flex items-center justify-center text-[10px] font-bold">
                +{participantes.length - 4}
              </div>
            )}
          </div>
        </div>
        <div className={`font-mono font-extrabold text-xl px-3 py-1.5 rounded-full ${timer <= 10 ? 'text-error bg-error-container animate-pulse' : 'text-primary bg-primary-fixed'}`}>
          {formatTimer(timer)}
        </div>
      </div>

      {/* Barra timer */}
      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden mb-4">
        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>

      <p className="text-xs font-bold text-on-surface-variant mb-3">
        Pregunta {pregActual + 1} de {preguntas.length} · {miScore.correct} ✓ {miScore.wrong} ✗
      </p>

      {pregData ? (
        <>
          <h1 className="text-lg font-bold text-on-surface mb-4 leading-snug">{pregData.text}</h1>

          <div className="flex flex-col gap-3 mb-6">
            {pregData.options?.sort((a, b) => (a.letter || '').localeCompare(b.letter || '')).map(op => {
              const seleccionada = seleccion === op.id
              return (
                <button key={op.id} onClick={() => seleccionarOpcion(op)} disabled={!!seleccion}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all w-full
                    ${seleccionada ? 'border-primary bg-primary-fixed/50 scale-[1.01]'
                    : seleccion ? 'border-outline-variant/20 opacity-40'
                    : 'border-outline-variant/30 hover:border-primary/50 active:scale-[0.98]'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                    ${seleccionada ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                    {op.letter}
                  </div>
                  <p className="text-sm font-medium">{op.text}</p>
                </button>
              )
            })}
          </div>

          {seleccion && (
            <p className="text-center text-sm text-on-surface-variant animate-pulse">
              ✓ Respondida · Avanzando...
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Chat flotante */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        {chatAbierto && (
          <div className="w-72 bg-white rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden animate-fade-in">
            <div className="px-4 py-3 bg-primary text-white flex items-center justify-between">
              <span className="font-bold text-sm">Chat de la sala</span>
              <button onClick={() => setChatAbierto(false)}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div ref={chatRef} className="h-48 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {messages.length === 0 && <p className="text-xs text-center text-on-surface-variant mt-4">Sin mensajes aún</p>}
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.participant_id === participantId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-on-surface-variant font-bold mb-0.5">{m.display_name}</span>
                  <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[80%] ${m.participant_id === participantId ? 'bg-primary text-white' : 'bg-white border border-outline-variant/20'}`}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-outline-variant/20 flex gap-2">
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                placeholder="Escribe..." maxLength={200}
                className="flex-1 px-3 py-2 rounded-full bg-surface-container-low text-sm outline-none" />
              <button onClick={enviarMensaje} className="p-2 bg-primary text-white rounded-full">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </div>
          </div>
        )}
        <button onClick={() => { setChatAbierto(v => !v); setMensajesNoLeidos(0) }}
          className="w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center relative">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
          {mensajesNoLeidos > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-error rounded-full text-[10px] font-bold text-white flex items-center justify-center">
              {mensajesNoLeidos > 9 ? '9+' : mensajesNoLeidos}
            </span>
          )}
        </button>
      </div>
    </div>
  )
}