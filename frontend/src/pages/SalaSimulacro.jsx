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

  const [room,            setRoom]            = useState(null)
  const [preguntas,       setPreguntas]       = useState([])
  const [pregActual,      setPregActual]      = useState(0)
  const [seleccion,       setSeleccion]       = useState(null)
  const [respondida,      setRespondida]      = useState(false)
  const [timer,           setTimer]           = useState(90)
  const [participantes,   setParticipantes]   = useState([])
  const [terminado,       setTerminado]       = useState(false)
  const [esperandoOtros,  setEsperandoOtros]  = useState(false)
  const [miScore,         setMiScore]         = useState({ correct: 0, wrong: 0 })
  const [revanchaPropia,  setRevanchaPropia]  = useState(false)
  const [revanchaContrario, setRevanchaContrario] = useState(false)
  const [jugadoresRevancha, setJugadoresRevancha] = useState([])
  const [messages,        setMessages]        = useState([])
  const [msgInput,        setMsgInput]        = useState('')
  const [chatAbierto,     setChatAbierto]     = useState(false)
  const [mensajesNoLeidos,setMensajesNoLeidos]= useState(0)
  const [toast,           setToast]           = useState(null)
  const [analisisIA,      setAnalisisIA]      = useState(null)
  const [loadingIA,       setLoadingIA]       = useState(false)

  const chatRef        = useRef(null)
  const toastTimerRef  = useRef(null)
  const intervalRef    = useRef(null)
  const timerRef       = useRef(90)
  const miScoreRef     = useRef({ correct: 0, wrong: 0 })
  const pregActualRef  = useRef(0)
  const preguntasRef   = useRef([])
  const roomRef        = useRef(null)
  const terminadoRef   = useRef(false)

  useEffect(() => {
    iniciar()
    const sub = supabase.channel(`sala-juego-${roomId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.status === 'finished' && !terminadoRef.current) {
            mostrarResultados()
          }
          if (payload.new.rematch_requested_by && payload.new.rematch_requested_by !== participantId) {
            setRevanchaContrario(true)
            setJugadoresRevancha(prev =>
              prev.includes(payload.new.rematch_requested_by) ? prev : [...prev, payload.new.rematch_requested_by]
            )
          }
          if (payload.new.rematch_room_id) {
            navigate(`/sala/${payload.new.rematch_room_id}/lobby`, {
              state: { participantId, isHost: false, displayName }
            })
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => cargarParticipantes())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (terminadoRef.current) {
            setMessages(prev => [...prev, payload.new])
            if (!chatAbierto && payload.new.participant_id !== participantId) {
              setMensajesNoLeidos(n => n + 1)
              setToast(`${payload.new.display_name}: ${payload.new.message}`)
              if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
              toastTimerRef.current = setTimeout(() => setToast(null), 5 * 60 * 1000)
            }
          }
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
    roomRef.current = roomData

    const { data: qData } = await supabase
      .from('questions').select('id, text, options(id, text, letter, is_correct)')
      .eq('level_id', roomData.level_id).limit(roomData.max_questions)
    if (!qData?.length) return

    const shuffled = [...qData].sort(() => Math.random() - 0.5)
    setPreguntas(shuffled)
    preguntasRef.current = shuffled

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
        avanzarManual(true)
      }
    }, 1000)
  }

  async function cargarParticipantes() {
    const { data } = await supabase.from('room_participants').select('*')
      .eq('room_id', roomId).order('score', { ascending: false })
    setParticipantes(data || [])
  }

  async function seleccionarOpcion(op) {
    if (seleccion || respondida) return
    setSeleccion(op.id)
    setRespondida(true)
    clearInterval(intervalRef.current)

    const esCorrecta = op.is_correct
    await supabase.from('room_answers').insert({
      room_id: roomId, participant_id: participantId,
      question_index: pregActualRef.current,
      selected_option_id: op.id, is_correct: esCorrecta
    })

    const newCorrect = miScoreRef.current.correct + (esCorrecta ? 1 : 0)
    const newWrong   = miScoreRef.current.wrong   + (!esCorrecta ? 1 : 0)
    miScoreRef.current = { correct: newCorrect, wrong: newWrong }
    setMiScore({ correct: newCorrect, wrong: newWrong })

    await supabase.from('room_participants').update({
      correct: newCorrect, wrong: newWrong, score: newCorrect
    }).eq('id', participantId)
  }

  async function avanzarManual(porTiempo = false) {
    if (porTiempo && !respondida) {
      await supabase.from('room_answers').insert({
        room_id: roomId, participant_id: participantId,
        question_index: pregActualRef.current,
        selected_option_id: null, is_correct: false
      })
      const newWrong = miScoreRef.current.wrong + 1
      miScoreRef.current.wrong = newWrong
      setMiScore(prev => ({ ...prev, wrong: newWrong }))
      await supabase.from('room_participants').update({ wrong: newWrong }).eq('id', participantId)
    }

    const siguiente = pregActualRef.current + 1
    pregActualRef.current = siguiente

    if (siguiente >= preguntasRef.current.length) {
      setEsperandoOtros(true)
      if (isHost) {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
      }
    } else {
      setPregActual(siguiente)
      setSeleccion(null)
      setRespondida(false)
      iniciarTimer(roomRef.current?.timer_per_question || 90)
    }
  }

  function mostrarResultados() {
    clearInterval(intervalRef.current)
    terminadoRef.current = true
    setEsperandoOtros(false)
    setTerminado(true)
    cargarParticipantes()
    cargarMensajes()
  }

  async function cargarMensajes() {
    const { data } = await supabase.from('room_messages').select('*')
      .eq('room_id', roomId).order('created_at').limit(50)
    setMessages(data || [])
  }

  async function enviarMensaje() {
    if (!msgInput.trim()) return
    await supabase.from('room_messages').insert({
      room_id: roomId, participant_id: participantId,
      display_name: displayName, message: msgInput.trim()
    })
    setMsgInput('')
  }

  async function pedirRevancha() {
    if (revanchaPropia) return
    setRevanchaPropia(true)
    const nuevos = [...jugadoresRevancha, participantId]
    setJugadoresRevancha(nuevos)
    await supabase.from('rooms').update({ rematch_requested_by: participantId }).eq('id', roomId)

    if (revanchaContrario && isHost) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: newRoom } = await supabase.from('rooms').insert({
        id: code, code,
        host_id: roomRef.current.host_id,
        level_id: roomRef.current.level_id,
        timer_per_question: roomRef.current.timer_per_question,
        max_questions: roomRef.current.max_questions,
        status: 'lobby'
      }).select('id').single()

      const { data: part } = await supabase.from('room_participants').insert({
        room_id: newRoom.id, user_id: participantId,
        display_name: displayName, is_host: true
      }).select('id').single()

      await supabase.from('rooms').update({ rematch_room_id: newRoom.id }).eq('id', roomId)
      navigate(`/sala/${newRoom.id}/lobby`, { state: { participantId: part.id, isHost: true, displayName } })
    }
  }

  async function generarAnalisisIA() {
    setLoadingIA(true)
    try {
      const ordenados = [...participantes].sort((a, b) => b.score - a.score)
      const total = preguntasRef.current.length

      const prompt = `Eres un tutor educativo analizando los resultados de una sala de competencia de simulacros del estado colombiano.

Participantes:
${ordenados.map((p, i) => `${i+1}. ${p.display_name}: ${p.correct} aciertos, ${p.wrong} errores de ${total} preguntas (${Math.round(p.correct/total*100)}%)`).join('\n')}

Genera un análisis breve y motivador que incluya:
1. Quién tuvo mejor desempeño y por qué
2. Puntos de mejora para cada participante
3. Recomendaciones de estudio específicas
4. Un mensaje motivacional final

Sé concreto, amigable y en español colombiano. Máximo 200 palabras.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await response.json()
      setAnalisisIA(data.content?.[0]?.text || 'No se pudo generar el análisis.')
    } catch {
      setAnalisisIA('Error al generar el análisis. Intenta de nuevo.')
    } finally {
      setLoadingIA(false)
    }
  }

  // ── PANTALLA ESPERA ──────────────────────────────────────────
  if (esperandoOtros) {
    const otros = participantes.filter(p => p.id !== participantId)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-6 bg-background">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <h2 className="text-2xl font-extrabold text-center">¡Terminaste!</h2>
        <p className="text-on-surface-variant text-center text-sm">Esperando a los demás jugadores...</p>
        <div className="w-full max-w-sm space-y-3">
          {otros.map(p => {
            const respondidas = (p.correct || 0) + (p.wrong || 0)
            const total = preguntasRef.current.length
            return (
              <div key={p.id} className="card p-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-bold text-sm">{p.display_name}</p>
                  <p className="text-xs text-on-surface-variant">{respondidas} de {total}</p>
                </div>
                <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (respondidas / total) * 100 : 0}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── PANTALLA RESULTADOS ──────────────────────────────────────
  if (terminado) {
    const ordenados  = [...participantes].sort((a, b) => b.score - a.score)
    const miPosicion = ordenados.findIndex(p => p.id === participantId) + 1
    const total      = preguntasRef.current.length

    return (
      <div className="p-4 md:p-8 pb-24 max-w-5xl animate-fade-in md:flex md:gap-6">

        {/* Columna izquierda */}
        <div className="flex-1 space-y-4">

          {/* Ranking */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-secondary bg-secondary-container px-3 py-1 rounded-full">
                Resultados finales
              </span>
              <span className="font-mono font-bold text-sm text-on-surface-variant">{roomId}</span>
            </div>
            <h2 className="text-2xl font-extrabold mb-1">Ranking final</h2>
            {ordenados[0] && (
              <p className="text-sm text-on-surface-variant mb-4">
                🏆 <strong>{ordenados[0].display_name}</strong> ganó con {ordenados[0].correct} de {total} aciertos
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
                <div key={p.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all
                    ${p.id === participantId ? 'bg-primary-fixed/30 border-2 border-primary/20' : 'bg-surface-container-low'}`}>
                  <span className="font-extrabold text-xl w-8 text-center shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx+1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{p.display_name}</p>
                    <div className="w-full h-1 bg-surface-container-high rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full"
                        style={{ width: `${total > 0 ? (p.correct / total) * 100 : 0}%` }} />
                    </div>
                  </div>
                  <span className="font-bold text-secondary text-sm shrink-0">{p.correct} ✓</span>
                  <span className="font-bold text-error text-sm shrink-0">{p.wrong} ✗</span>
                </div>
              ))}
            </div>
          </div>

          {/* Análisis IA */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-tertiary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div>
                <p className="font-extrabold text-sm">Análisis de la sala</p>
                <p className="text-xs text-on-surface-variant">Powered by Claude AI</p>
              </div>
            </div>

            {!analisisIA && !loadingIA && (
              <button onClick={generarAnalisisIA}
                className="w-full py-3 bg-tertiary text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                Generar análisis con IA
              </button>
            )}

            {loadingIA && (
              <div className="flex items-center justify-center gap-3 py-6">
                <div className="w-5 h-5 border-2 border-tertiary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-on-surface-variant">Analizando resultados...</p>
              </div>
            )}

            {analisisIA && (
              <div className="bg-tertiary-container/20 rounded-xl p-4 text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
                {analisisIA}
              </div>
            )}
          </div>

          {/* Revancha */}
          <div className="space-y-2">
            <button onClick={pedirRevancha} disabled={revanchaPropia}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2
                ${revanchaContrario && !revanchaPropia ? 'bg-secondary text-white animate-bounce'
                : revanchaPropia ? 'bg-surface-container text-on-surface-variant'
                : 'bg-primary text-white active:scale-95'}`}>
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                {revanchaPropia ? 'hourglass_empty' : 'replay'}
              </span>
              {revanchaPropia ? 'Esperando revancha...' : revanchaContrario ? '⚔️ ¡Acepta la revancha!' : 'Revancha'}
            </button>

            {jugadoresRevancha.length > 0 && (
              <div className="bg-secondary-container/30 border border-secondary/20 rounded-xl p-3 animate-fade-in">
                <p className="text-xs font-bold text-secondary mb-2">Quieren revancha:</p>
                <div className="flex flex-wrap gap-2">
                  {participantes.filter(p => jugadoresRevancha.includes(p.id)).map(p => (
                    <span key={p.id} className="text-xs bg-secondary text-white px-2 py-0.5 rounded-full font-bold">
                      {p.display_name}
                    </span>
                  ))}
                </div>
                {jugadoresRevancha.length < participantes.length && (
                  <p className="text-[10px] text-on-surface-variant mt-1.5">
                    Esperando a: {participantes.filter(p => !jugadoresRevancha.includes(p.id)).map(p => p.display_name).join(', ')}
                  </p>
                )}
              </div>
            )}

            <button onClick={() => navigate('/salas')}
              className="w-full py-3 border border-outline-variant rounded-xl font-bold text-sm active:scale-95 transition-all">
              Ir a salas
            </button>
          </div>
        </div>

        {/* Chat desktop */}
        <div className="hidden md:flex flex-col w-80 shrink-0">
          <div className="card flex flex-col h-full min-h-[500px]">
            <div className="px-4 py-3 bg-primary text-white rounded-t-2xl flex items-center gap-2">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
              <span className="font-bold text-sm">Chat de la sala</span>
            </div>
            <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
              {messages.length === 0 && (
                <p className="text-xs text-center text-on-surface-variant mt-4">Sin mensajes aún</p>
              )}
              {messages.map(m => (
                <div key={m.id} className={`flex flex-col ${m.participant_id === participantId ? 'items-end' : 'items-start'}`}>
                  <span className="text-[10px] text-on-surface-variant font-bold mb-0.5">{m.display_name}</span>
                  <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[85%]
                    ${m.participant_id === participantId ? 'bg-primary text-white' : 'bg-white border border-outline-variant/20'}`}>
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

        {/* Chat móvil */}
        <div className="md:hidden">
          {toast && (
            <div className="fixed top-4 left-4 right-4 z-[300] bg-on-surface text-surface px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-sm shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
              <p className="text-sm font-medium truncate flex-1">{toast}</p>
              <button onClick={() => setToast(null)}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          )}
          {chatAbierto && (
            <div className="fixed bottom-20 right-4 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden animate-fade-in">
              <div className="px-4 py-3 bg-primary text-white flex items-center justify-between">
                <span className="font-bold text-sm">Chat</span>
                <button onClick={() => { setChatAbierto(false); setMensajesNoLeidos(0); setToast(null) }}>
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="h-48 overflow-y-auto p-3 space-y-2 bg-slate-50">
                {messages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.participant_id === participantId ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-on-surface-variant font-bold mb-0.5">{m.display_name}</span>
                    <div className={`px-3 py-1.5 rounded-2xl text-sm max-w-[80%]
                      ${m.participant_id === participantId ? 'bg-primary text-white' : 'bg-white border border-outline-variant/20'}`}>
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
            onClick={() => { setChatAbierto(v => !v); if (!chatAbierto) { setMensajesNoLeidos(0); setToast(null); clearTimeout(toastTimerRef.current) } }}
            className={`fixed bottom-20 right-4 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-lg items-center justify-center ${chatAbierto ? 'hidden' : 'flex'}`}>
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

  // ── PANTALLA JUEGO ───────────────────────────────────────────
  const pregData = preguntas[pregActual]
  const pct      = timer / (roomRef.current?.timer_per_question || 90) * 100

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 pb-24 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary bg-primary-fixed px-3 py-1 rounded-full">Sala {roomId}</span>
          <div className="flex -space-x-1">
            {participantes.slice(0, 4).map(p => (
              <div key={p.id} title={p.display_name}
                className="w-7 h-7 rounded-full bg-primary border-2 border-white flex items-center justify-center text-white text-[10px] font-bold">
                {p.display_name[0].toUpperCase()}
              </div>
            ))}
            {participantes.length > 4 && (
              <div className="w-7 h-7 rounded-full bg-surface-container border-2 border-white flex items-center justify-center text-[10px] font-bold">
                +{participantes.length - 4}
              </div>
            )}
          </div>
        </div>
        <div className={`font-mono font-extrabold text-xl px-3 py-1.5 rounded-full transition-colors
          ${timer <= 10 ? 'text-error bg-error-container animate-pulse' : 'text-primary bg-primary-fixed'}`}>
          {formatTimer(timer)}
        </div>
      </div>

      {/* Barra timer */}
      <div className="w-full h-2 bg-surface-container-high rounded-full overflow-hidden mb-1">
        <div className={`h-full rounded-full transition-all duration-1000 ${timer <= 10 ? 'bg-error' : 'bg-primary'}`}
          style={{ width: `${pct}%` }} />
      </div>

      <p className="text-xs font-bold text-on-surface-variant mb-4">
        Pregunta {pregActual + 1} de {preguntas.length} · {miScore.correct} ✓ {miScore.wrong} ✗
      </p>

      {pregData ? (
        <>
          <div className="card p-5 mb-4">
            <p className="text-base font-bold text-on-surface leading-relaxed">{pregData.text}</p>
          </div>

          <div className="flex flex-col gap-3 mb-4">
            {pregData.options?.sort((a, b) => (a.letter || '').localeCompare(b.letter || '')).map(op => {
              const seleccionada = seleccion === op.id
              return (
                <button key={op.id} onClick={() => seleccionarOpcion(op)} disabled={respondida}
                  className={`flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all w-full
                    ${seleccionada
                      ? 'border-primary bg-primary-fixed/50 scale-[1.01] shadow-md'
                      : respondida
                      ? 'border-outline-variant/20 opacity-40 cursor-not-allowed'
                      : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-low active:scale-[0.98]'}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 transition-colors
                    ${seleccionada ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant'}`}>
                    {op.letter}
                  </div>
                  <p className="text-sm font-medium flex-1">{op.text}</p>
                </button>
              )
            })}
          </div>

          {respondida && (
            <button onClick={() => avanzarManual(false)}
              className="w-full py-4 bg-primary text-white rounded-2xl font-extrabold text-sm active:scale-95 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                {pregActual === preguntas.length - 1 ? 'flag' : 'arrow_forward'}
              </span>
              {pregActual === preguntas.length - 1 ? '🏁 Finalizar prueba' : 'Siguiente →'}
            </button>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-on-surface-variant">Cargando preguntas...</p>
        </div>
      )}
    </div>
  )
}