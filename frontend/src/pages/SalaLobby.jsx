import { useState, useEffect } from 'react'
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

  useEffect(() => {
    cargarSala()
    cargarParticipantes()

    // Realtime — escuchar nuevos participantes y cambios de sala
    const sub = supabase.channel(`room-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => cargarParticipantes())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new.status === 'active') {
            navigate(`/sala/${roomId}/juego`, { state: { participantId, isHost, displayName } })
          }
        })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [roomId])

  async function cargarSala() {
    const { data } = await supabase.from('rooms').select('*, levels(name, evaluations(title))').eq('id', roomId).single()
    setRoom(data)
  }

  async function cargarParticipantes() {
    const { data } = await supabase.from('room_participants').select('*').eq('room_id', roomId).order('joined_at')
    setParticipants(data || [])
  }

  async function iniciarCompetencia() {
    await supabase.from('rooms').update({ status: 'active' }).eq('id', roomId)
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

  return (
    <div className="p-4 md:p-8 pb-24 max-w-2xl animate-fade-in">

      <div className="card p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-bold text-secondary bg-secondary-container px-3 py-1 rounded-full">Sala activa</span>
          <button onClick={copiarCodigo}
            className="flex items-center gap-2 bg-on-surface text-surface px-4 py-2 rounded-full font-bold text-sm">
            <span className="font-mono tracking-widest text-lg">{roomId}</span>
            <span className="material-symbols-outlined text-sm">{copiado ? 'check' : 'content_copy'}</span>
          </button>
        </div>

        <h2 className="text-2xl font-extrabold mb-1">Lobby</h2>
        <p className="text-on-surface-variant text-sm mb-4">
          {room?.levels?.evaluations?.title} — {room?.levels?.name}
        </p>

        <div className="p-3 bg-primary-fixed/30 rounded-xl text-sm text-primary mb-4">
          Comparte el código <strong>{roomId}</strong> para que otros se unan.
        </div>

        {/* Participantes */}
        <div className="space-y-2">
          {participants.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                  {p.display_name[0].toUpperCase()}
                </div>
                <span className="font-semibold text-sm">{p.display_name}</span>
              </div>
              {p.is_host && <span className="text-[10px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full">Anfitrión</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Config */}
      <div className="card p-4 mb-4 text-sm space-y-1">
        <p className="font-bold mb-2">Configuración de la sala</p>
        <p className="text-on-surface-variant">⏱ Tiempo por pregunta: <strong>{room?.timer_per_question}s</strong></p>
        <p className="text-on-surface-variant">❓ Preguntas: <strong>{room?.max_questions}</strong></p>
        <p className="text-on-surface-variant">👥 Participantes: <strong>{participants.length}</strong></p>
      </div>

      <div className="space-y-3">
        {isHost && (
          <button onClick={iniciarCompetencia}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all flex items-center justify-center gap-2">
            🚀 Iniciar competencia
          </button>
        )}
        {!isHost && (
          <div className="p-4 bg-surface-container-low rounded-xl text-center text-sm text-on-surface-variant">
            Esperando que el anfitrión inicie la competencia...
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mt-2" />
          </div>
        )}
        <button onClick={salirDeSala}
          className="w-full py-3 bg-error text-white rounded-xl font-bold text-sm active:scale-95 transition-all">
          Salir de la sala
        </button>
      </div>
    </div>
  )
}