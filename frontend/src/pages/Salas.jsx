import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

export default function Salas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('crear') // 'crear' o 'unirse'
  const [niveles, setNiveles] = useState([])
  const [form, setForm] = useState({ level_id: '', timer: 90, max_questions: 20, display_name: '' })
  const [codigo, setCodigo] = useState('')
  const [nombreParticipante, setNombreParticipante] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { cargarNiveles() }, [])

  async function cargarNiveles() {
    const { data } = await supabase
      .from('levels')
      .select('id, name, evaluations(title)')
      .order('id')
    setNiveles(data || [])
  }

  async function crearSala() {
    if (!form.level_id || !form.display_name.trim()) {
      setError('Completa todos los campos'); return
    }
    setLoading(true)
    setError('')
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .insert({ id: code, code, host_id: user.id, level_id: parseInt(form.level_id), timer_per_question: form.timer, max_questions: form.max_questions, status: 'lobby' })
        .select('id').single()
      if (roomErr) throw roomErr

      const { data: part, error: partErr } = await supabase
        .from('room_participants')
        .insert({ room_id: room.id, user_id: user.id, display_name: form.display_name.trim(), is_host: true })
        .select('id').single()
      if (partErr) throw partErr

      navigate(`/sala/${room.id}/lobby`, { state: { participantId: part.id, isHost: true, displayName: form.display_name } })
    } catch (err) {
      setError('Error al crear la sala')
    } finally {
      setLoading(false)
    }
  }

  async function unirseASala() {
    if (!codigo.trim() || !nombreParticipante.trim()) {
      setError('Completa todos los campos'); return
    }
    setLoading(true)
    setError('')
    try {
      const { data: room, error: roomErr } = await supabase
        .from('rooms').select('*').eq('code', codigo.trim().toUpperCase()).single()
      if (roomErr || !room) { setError('Sala no encontrada'); setLoading(false); return }
      if (room.status !== 'lobby') { setError('La sala ya está en curso o finalizada'); setLoading(false); return }

      const { data: part, error: partErr } = await supabase
        .from('room_participants')
        .insert({ room_id: room.id, user_id: user.id, display_name: nombreParticipante.trim(), is_host: false })
        .select('id').single()
      if (partErr) throw partErr

      navigate(`/sala/${room.id}/lobby`, { state: { participantId: part.id, isHost: false, displayName: nombreParticipante } })
    } catch (err) {
      setError('Error al unirse a la sala')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-8 pb-24 max-w-4xl animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-on-background mb-1">Salas de Competencia</h1>
        <p className="text-on-surface-variant text-sm">Crea una sala y comparte el código, o únete a una existente</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {['crear', 'unirse'].map(t => (
          <button key={t} onClick={() => { setTab(t); setError('') }}
            className={`px-6 py-2.5 rounded-full font-bold text-sm transition-all capitalize ${tab === t ? 'bg-primary text-white shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
            {t === 'crear' ? '🏠 Crear sala' : '🚪 Unirse a sala'}
          </button>
        ))}
      </div>

      {error && <p className="text-error text-sm font-bold mb-4 p-3 bg-error-container/30 rounded-xl">{error}</p>}

      {tab === 'crear' ? (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-lg">Configurar sala</h3>

          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant">Tu nombre en la sala</label>
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Ej. Franklin"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant">Nivel / Prueba</label>
            <select value={form.level_id} onChange={e => setForm(f => ({ ...f, level_id: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm">
              <option value="">Selecciona un nivel</option>
              {niveles.map(nv => (
                <option key={nv.id} value={nv.id}>{nv.evaluations?.title} — {nv.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant">Tiempo por pregunta (seg)</label>
              <select value={form.timer} onChange={e => setForm(f => ({ ...f, timer: parseInt(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm">
                <option value={30}>30 seg</option>
                <option value={60}>1 min</option>
                <option value={90}>1:30 min</option>
                <option value={120}>2 min</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant">Número de preguntas</label>
              <select value={form.max_questions} onChange={e => setForm(f => ({ ...f, max_questions: parseInt(e.target.value) }))}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-primary-fixed/30 rounded-xl text-xs text-primary font-medium">
            La sala se crea con un temporizador fijo por pregunta para todos los participantes.
          </div>

          <button onClick={crearSala} disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🚀 Crear sala'}
          </button>
        </div>
      ) : (
        <div className="card p-6 space-y-4">
          <h3 className="font-bold text-lg">Unirse a sala</h3>

          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant">Tu nombre</label>
            <input value={nombreParticipante} onChange={e => setNombreParticipante(e.target.value)}
              placeholder="Ej. Laura"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-on-surface-variant">Código de sala</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej. A7K9Q2" maxLength={6}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono tracking-widest text-center text-lg" />
          </div>

          <button onClick={unirseASala} disabled={loading}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : '🚪 Ingresar'}
          </button>
        </div>
      )}
    </div>
  )
}