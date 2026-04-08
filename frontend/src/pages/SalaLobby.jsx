import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function SalaLobby() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const { state } = useLocation()
  const { participantId, isHost, displayName } = state || {}

  const [room, setRoom] = useState(null)
  const [participants, setParticipants] = useState([])
  const [copiado, setCopiado] = useState(false)
  const [countdown, setCountdown] = useState(null)
  const [messages, setMessages] = useState([])
  const [msgInput, setMsgInput] = useState('')
  const [chatAbierto, setChatAbierto] = useState(false)
  const [yo, setYo] = useState(null)
  const [toast, setToast] = useState(null)
  const chatRef = useRef(null)
  const toastTimerRef = useRef(null)

  useEffect(() => {
    cargarSala()
    cargarParticipantes()
    cargarMensajes()

    const sub = supabase.channel(`room-lobby-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => cargarParticipantes())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
          if (!chatAbierto && payload.new.participant_id !== participantId) {
            // Toast con duración de 5 minutos
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
            setToast(`${payload.new.display_name}: ${payload.new.message}`)
            toastTimerRef.current = setTimeout(() => setToast(null), 5 * 60 * 1000)
          }
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.status === 'starting' && !isHost) iniciarCountdown()
          if (payload.new.status === 'active' && !isHost) {
            navigate(`/sala/${roomId}/juego`, { state: { participantId, isHost, displayName } })
          }
        })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [roomId])

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight
  }, [messages])

  async function cargarSala() {
    const { data } = await supabase.from('rooms').select('*, levels(name, evaluations(title))').eq('id', roomId).single()
    setRoom(data)
  }

  async function cargarParticipantes() {
    const { data } = await supabase.from('room_participants').select('*').eq('room_id', roomId).order('joined_at')
    setParticipants(data || [])
    const p = data?.find(p => p.id === participantId)
    if (p) setYo(p)
  }

  async function cargarMensajes() {
    const { data } = await supabase.from('room_messages').select('*').eq('room_id', roomId).order('created_at').limit(50)
    setMessages(data || [])
  }

  async function toggleListo() {
    const nuevoEstado = !yo?.is_ready
    await supabase.from('room_participants').update({ is_ready: nuevoEstado }).eq('id', participantId)
    setYo(prev => ({ ...prev, is_ready: nuevoEstado }))
  }

  async function echarParticipante(pid) {
    await supabase.from('room_participants').delete().eq('id', pid)
  }

  async function iniciarCompetencia() {
    await supabase.from('rooms').update({ status: 'starting' }).eq('id', roomId)
    iniciarCountdown()
  }

  function iniciarCountdown() {
    let c = 5
    setCountdown(c)
    const t = setInterval(() => {
      c -= 1
      setCountdown(c)
      if (c <= 0) {
        clearInterval(t)
        setCountdown(0)
        if (isHost) {
          supabase.from('rooms').update({ status: 'active' }).eq('id', roomId).then(() => {
            navigate(`/sala/${roomId}/juego`, { state: { participantId, isHost, displayName } })
          })
        } else {
          navigate(`/sala/${roomId}/juego`, { state: { participantId, isHost, displayName } })
        }
      }
    }, 1000)
  }

  async function enviarMensaje() {
    if (!msgInput.trim()) return
    await supabase.from('room_messages').insert({
      room_id: roomId, participant_id: participantId,
      display_name: displayName, message: msgInput.trim()
    })
    setMsgInput('')
  }

  async function salirDeSala() {
    await supabase.from('room_participants').delete().eq('id', participantId)
    if (isHost) await supabase.from('rooms').update({ status: 'finished' }).eq('id', roomId)
    navigate('/salas')
  }

  function copiarCodigo() {
    navigator.clipboard.writeText(roomId)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const todosListos = participants.filter(p => !p.is_host).every(p => p.is_ready)
  const noHost = participants.filter(p => !p.is_host)

  // Barra de progreso superior durante countdown (sin pantalla completa)
  const countdownBar = countdown !== null && countdown > 0 && (
    <div className="fixed top-0 left-0 right-0 z-[200]">
      <div className="bg-primary text-white px-6 py-4 shadow-2xl">
        <div className="flex items-center gap-4 max-w-5xl mx-auto">
          <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin shrink-0" />
          <div className="flex-1">
            <p className="font-extrabold text-lg leading-none">¡Iniciando sala!</p>
            <p className="text-white/70 text-sm">Prepárate para competir...</p>
            <div className="w-full h-1.5 bg-white/20 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
            </div>
          </div>
          <div className="text-5xl font-extrabold shrink-0 animate-pulse">{countdown}</div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 pb-24 max-w-5xl animate-fade-in md:flex md:gap-6">
      {countdownBar}

      {/* Contenido izquierdo (flex-1) */}
      <div className="flex-1">
        {/* Header sala */}
        <div className="card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-secondary bg-secondary-container px-3 py-1 rounded-full">
              Lobby • {participants.length} conectado{participants.length !== 1 ? 's' : ''}
            </span>
            <button onClick={copiarCodigo}
              className="flex items-center gap-2 bg-on-surface text-surface px-3 py-2 rounded-full font-bold text-sm">
              <span className="font-mono tracking-widest">{roomId}</span>
              <span className="material-symbols-outlined text-sm">{copiado ? 'check' : 'content_copy'}</span>
            </button>
          </div>

          <h2 className="text-2xl font-extrabold mb-1">Lobby</h2>
          <p className="text-on-surface-variant text-sm mb-4">
            {room?.levels?.evaluations?.title} — {room?.levels?.name}
          </p>

          <div className="p-3 bg-primary-fixed/30 rounded-xl text-sm text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">share</span>
            Comparte el código <strong>{roomId}</strong> con tus compañeros
          </div>

          {/* Participantes */}
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                      {p.display_name[0].toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-secondary rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <span className="font-semibold text-sm">{p.display_name}</span>
                    {p.id === participantId && <span className="text-[10px] text-on-surface-variant ml-1">(tú)</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.is_host
                    ? <span className="text-[10px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Anfitrión</span>
                    : p.is_ready
                    ? <span className="text-[10px] font-bold text-secondary bg-secondary-container px-2 py-0.5 rounded-full flex items-center gap-1">✓ Listo</span>
                    : <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Esperando...</span>
                  }
                  {isHost && !p.is_host && (
                    <button onClick={() => echarParticipante(p.id)}
                      className="p-1 rounded-full hover:bg-error-container text-error transition-colors">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configuración */}
        <div className="card p-4 mb-4 text-sm">
          <p className="font-bold mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-primary">settings</span>
            Configuración
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface-container-low rounded-xl p-2">
              <p className="text-lg font-extrabold text-primary">{room?.max_questions}</p>
              <p className="text-[10px] text-on-surface-variant">Preguntas</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-2">
              <p className="text-lg font-extrabold text-tertiary">{room?.timer_per_question}s</p>
              <p className="text-[10px] text-on-surface-variant">Por pregunta</p>
            </div>
            <div className="bg-surface-container-low rounded-xl p-2">
              <p className="text-lg font-extrabold text-secondary">{participants.length}</p>
              <p className="text-[10px] text-on-surface-variant">Jugadores</p>
            </div>
          </div>
        </div>

        {/* Acciones */}
        <div className="space-y-3 mb-4">
          {isHost ? (
            <>
              {noHost.length > 0 && !todosListos && (
                <div className="p-3 bg-surface-container-low rounded-xl text-xs text-on-surface-variant text-center">
                  Esperando que todos den listo ({noHost.filter(p => p.is_ready).length}/{noHost.length})
                </div>
              )}
              <button onClick={iniciarCompetencia}
                disabled={noHost.length > 0 && !todosListos}
                className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                {noHost.length === 0 ? '🚀 Iniciar solo' : todosListos ? '🚀 ¡Todos listos! Iniciar' : 'Esperando participantes...'}
              </button>
            </>
          ) : (
            <button onClick={toggleListo}
              className={`w-full py-3 rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2
                ${yo?.is_ready ? 'bg-surface-container border-2 border-secondary text-secondary' : 'bg-secondary text-white'}`}>
              {yo?.is_ready
                ? <><span className="material-symbols-outlined text-sm">close</span>Cancelar listo</>
                : <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>¡Estoy listo!</>
              }
            </button>
          )}

          {!isHost && (
            <div className="p-3 bg-surface-container-low rounded-xl text-center text-xs text-on-surface-variant">
              Esperando que el anfitrión inicie...
            </div>
          )}

          <button onClick={salirDeSala}
            className="w-full py-2.5 border border-error text-error rounded-xl font-bold text-sm active:scale-95 transition-all">
            Salir de la sala
          </button>
        </div>
      </div>

      {/* Chat desktop — fijo a la derecha (solo visible en md+) */}
      <div className="hidden md:flex flex-col w-80 shrink-0">
        <div className="card flex flex-col h-[600px]">
          <div className="px-4 py-3 bg-primary text-white rounded-t-2xl flex items-center gap-2">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
            <span className="font-bold text-sm">Chat del lobby</span>
          </div>
          <div ref={chatRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {messages.length === 0 && <p className="text-xs text-center text-on-surface-variant mt-4">Di algo para romper el hielo 👋</p>}
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

      {/* Chat móvil — botón flotante + toast + ventana modal (solo en móvil) */}
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
              <button onClick={() => { setChatAbierto(false); setMensajesNoLeidos(0); setToast(null); clearTimeout(toastTimerRef.current) }}>
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
          onClick={() => {
            setChatAbierto(v => !v)
            setMensajesNoLeidos(0)
            setToast(null)
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
          }}
          className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-primary text-white rounded-full shadow-lg flex items-center justify-center"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
        </button>
      </div>
    </div>
  )
}