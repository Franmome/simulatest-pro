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
  const [esperandoOtros, setEsperandoOtros] = useState(false)

  // Estados para revancha
  const [revanchaPropia, setRevanchaPropia] = useState(false)
  const [revanchaContrario, setRevanchaContrario] = useState(false)
  const [nombreContrario, setNombreContrario] = useState('')

  // Estados de chat solo para resultados
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [chatAbierto, setChatAbierto] = useState(false)
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0)
  const [toast, setToast] = useState(null)
  const chatRef = useRef(null)

  const intervalRef = useRef(null)
  const timerRef = useRef(90)
  const miScoreRef = useRef({ correct: 0, wrong: 0 })
  const pregActualRef = useRef(0)

  // Cargar mensajes solo al montar (para resultados)
  useEffect(() => {
    if (terminado) {
      cargarMensajes()
    }
  }, [terminado])

  useEffect(() => {
    iniciar()
    const sub = supabase.channel(`sala-juego-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.status === 'finished') {
            if (esperandoOtros) setEsperandoOtros(false)
            mostrarResultados()
          }
          // Detectar revancha en resultados
          if (terminado && payload.new.rematch_requested_by && payload.new.rematch_requested_by !== participantId) {
            setRevanchaContrario(true)
            if (revanchaPropia) crearSalaRevancha()
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => cargarParticipantes())
      .subscribe()

    return () => { supabase.removeChannel(sub); clearInterval(intervalRef.current) }
  }, [roomId, esperandoOtros, terminado, revanchaPropia])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function cargarMensajes() {
    const { data } = await supabase
      .from('room_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at')
      .limit(50)
    setMessages(data || [])
  }

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
        if (!seleccion) registrarRespuestaSinAvanzar(null, false)
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
    await registrarRespuestaSinAvanzar(op.id, esCorrecta)
  }

  // Registra la respuesta pero NO avanza automáticamente
  async function registrarRespuestaSinAvanzar(optionId, esCorrecta) {
    await supabase.from('room_answers').insert({
      room_id: roomId,
      participant_id: participantId,
      question_index: pregActualRef.current,
      selected_option_id: optionId,
      is_correct: esCorrecta
    })

    const newCorrect = miScoreRef.current.correct + (esCorrecta ? 1 : 0)
    const newWrong = miScoreRef.current.wrong + (!esCorrecta ? 1 : 0)
    miScoreRef.current = { correct: newCorrect, wrong: newWrong }
    setMiScore({ correct: newCorrect, wrong: newWrong })

    await supabase.from('room_participants').update({
      correct: newCorrect, wrong: newWrong, score: newCorrect
    }).eq('id', participantId)
  }

  // Avance manual (siguiente o finalizar)
  async function avanzarManual() {
    const siguiente = pregActualRef.current + 1
    pregActualRef.current = siguiente

    if (siguiente >= preguntas.length) {
      // Terminó todas sus preguntas
      if (isHost) {
        // El host verifica si todos terminaron y finaliza la sala
        const { data: allParticipants } = await supabase
          .from('room_participants')
          .select('correct, wrong')
          .eq('room_id', roomId)
        const todosTerminaron = allParticipants.every(p => (p.correct + p.wrong) === preguntas.length)
        if (todosTerminaron) {
          await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
        } else {
          // El host también espera a los demás
          setEsperandoOtros(true)
        }
      } else {
        setEsperandoOtros(true)
      }
    } else {
      setPregActual(siguiente)
      setSeleccion(null)
      iniciarTimer(room?.timer_per_question || 90)
    }
  }

  // Función para finalizar desde esperandoOtros (cuando llega status finished)
  function mostrarResultados() {
    clearInterval(intervalRef.current)
    setTerminado(true)
    setEsperandoOtros(false)
    cargarParticipantes()
    cargarMensajes()
  }

  // ──────────────────────────────────────────────────────────────
  // Pantalla de espera (cuando termina antes que otros)
  // ──────────────────────────────────────────────────────────────
  if (esperandoOtros) {
    const otros = participantes.filter(p => p.id !== participantId)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <h2 className="text-2xl font-extrabold text-center">¡Terminaste!</h2>
        <p className="text-on-surface-variant text-center">Esperando a los demás jugadores...</p>
        {otros.map(p => {
          const respondidas = p.correct + p.wrong
          const progreso = (respondidas / preguntas.length) * 100
          return (
            <div key={p.id} className="card p-4 w-full max-w-sm text-center">
              <p className="font-bold">{p.display_name}</p>
              <p className="text-sm text-on-surface-variant">{respondidas} de {preguntas.length} respondidas</p>
              <div className="w-full h-2 bg-surface-container-high rounded-full mt-2">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ──────────────────────────────────────────────────────────────
  // Pantalla de resultados (con chat integrado y revancha)
  // ──────────────────────────────────────────────────────────────
  if (terminado) {
    const ordenados = [...participantes].sort((a, b) => b.score - a.score)
    const miPosicion = ordenados.findIndex(p => p.id === participantId) + 1
    const contrincante = participantes.find(p => p.id !== participantId) // para revancha

    async function pedirRevancha() {
      setRevanchaPropia(true)
      await supabase.from('rooms').update({ rematch_requested_by: participantId }).eq('id', roomId)
      if (revanchaContrario) crearSalaRevancha()
    }

    async function crearSalaRevancha() {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: newRoom } = await supabase.from('rooms')
        .insert({
          id: code, code, host_id: room.host_id, level_id: room.level_id,
          timer_per_question: room.timer_per_question, max_questions: room.max_questions, status: 'lobby'
        })
        .select('id').single()
      const { data: part } = await supabase.from('room_participants')
        .insert({ room_id: newRoom.id, user_id: participantId, display_name: displayName, is_host: isHost })
        .select('id').single()
      navigate(`/sala/${newRoom.id}/lobby`, { state: { participantId: part.id, isHost, displayName } })
    }

    return (
      <div className="p-4 md:p-8 pb-24 max-w-5xl animate-fade-in md:flex md:gap-6">

        {/* Columna izquierda: ranking y acciones */}
        <div className="flex-1">
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

          {/* Botones: Revancha e Ir al inicio */}
          <div className="flex flex-col gap-3">
            {contrincante && (
              <button
                onClick={pedirRevancha}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-all
                  ${revanchaContrario ? 'animate-bounce bg-secondary text-white' : 'bg-primary text-white'}`}
              >
                {revanchaContrario
                  ? `⚔️ ¡${contrincante.display_name} quiere revancha! ¡Acepta!`
                  : revanchaPropia ? '⏳ Esperando respuesta...' : '🔄 Revancha'}
              </button>
            )}
            <button onClick={() => navigate('/salas')} className="w-full py-3 border border-outline-variant rounded-xl font-bold text-sm">
              Ir al inicio
            </button>
            {isHost && (
              <button
                onClick={async () => { await supabase.from('rooms').delete().eq('id', roomId); navigate('/salas') }}
                className="w-full py-3 bg-error text-white rounded-xl font-bold text-sm">
                Cerrar sala
              </button>
            )}
          </div>
        </div>

        {/* Chat desktop — fijo a la derecha */}
        <div className="hidden md:flex flex-col w-80 shrink-0">
          <div className="card flex flex-col h-[500px]">
            <div className="px-4 py-3 bg-primary text-white rounded-t-2xl flex items-center gap-2">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
              <span className="font-bold text-sm">Chat de la sala</span>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {messages.length === 0 && <p className="text-xs text-center text-on-surface-variant mt-4">Sin mensajes aún</p>}
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.participant_id === participantId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-on-surface-variant font-bold mb-0.5">{m.display_name}</span>
                  <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%] ${m.participant_id === participantId ? 'bg-primary text-white' : 'bg-white border border-outline-variant/20'}`}>
                    {m.message}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-2 border-t border-outline-variant/20 flex gap-2">
              <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && enviarMensaje()}
                placeholder="Escribe..." maxLength={200}
                className="flex-1 px-3 py-2 rounded-full bg-surface-container-low text-sm outline-none focus:ring-2 focus:ring-primary/20" />
              <button onClick={enviarMensaje} className="p-2 bg-primary text-white rounded-full">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chat móvil — botón flotante + toast */}
        <div className="md:hidden">
          {toast && (
            <div className="fixed top-4 left-4 right-4 z-[300] bg-on-surface text-surface px-4 py-3 rounded-2xl shadow-xl animate-fade-in flex items-center gap-3">
              <span className="material-symbols-outlined text-sm shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
              <p className="text-sm font-medium truncate">{toast}</p>
            </div>
          )}
          {chatAbierto && (
            <div className="fixed bottom-20 right-4 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 bg-primary text-white flex items-center justify-between">
                <span className="font-bold text-sm">Chat</span>
                <button onClick={() => setChatAbierto(false)}>
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="h-48 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.participant_id === participantId ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-on-surface-variant font-bold mb-0.5">{m.display_name}</span>
                    <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[80%] ${m.participant_id === participantId ? 'bg-primary text-white' : 'bg-white border border-outline-variant/20'}`}>
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t flex gap-2">
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
          <button
            onClick={() => { setChatAbierto(v => !v); setMensajesNoLeidos(0); }}
            className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center"
          >
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

  // ──────────────────────────────────────────────────────────────
  // Pantalla de juego (sin chat)
  // ──────────────────────────────────────────────────────────────
  const pregData = preguntas[pregActual]
  const pct = timer / (room?.timer_per_question || 90) * 100

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary bg-primary-fixed px-3 py-1 rounded-full">Sala {roomId}</span>
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

          {/* Botón Siguiente / Finalizar en lugar de avance automático */}
          {seleccion && (
            <button onClick={avanzarManual}
              className="w-full py-3 bg-primary text-white rounded-2xl font-bold text-sm active:scale-95 transition-all mt-2">
              {pregActual === preguntas.length - 1 ? '🏁 Finalizar prueba' : 'Siguiente →'}
            </button>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )

  // Función auxiliar para enviar mensaje (definida arriba)
  async function enviarMensaje() {
    if (!msgInput.trim()) return
    await supabase.from('room_messages').insert({
      room_id: roomId, participant_id: participantId,
      display_name: displayName, message: msgInput.trim()
    })
    setMsgInput('')
    if (!chatAbierto) setMensajesNoLeidos(0)
  }
}