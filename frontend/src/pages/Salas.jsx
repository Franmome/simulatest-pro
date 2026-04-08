import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

export default function Salas() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [tab, setTab] = useState('crear')
  const [niveles, setNiveles] = useState([])
  const [pregsPorNivel, setPregsPorNivel] = useState({})
  const [form, setForm] = useState({
    level_id: '',
    timer: 90,
    max_questions: 20,
    max_questions_custom: '',
    display_name: '',
    orden: 'aleatorio',
    con_retro: false,
  })
  const [codigo, setCodigo] = useState('')
  const [nombreParticipante, setNombreParticipante] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null) // ✅ Estado para vista previa

  useEffect(() => { cargarNiveles() }, [])

  async function cargarNiveles() {
    const { data } = await supabase
      .from('levels')
      .select('id, name, evaluations(title)')
      .order('id')
    setNiveles(data || [])
    if (data?.length) {
      cargarPreguntas(data)
      setForm(f => ({ ...f, level_id: String(data[0].id) }))
    }
  }

  async function cargarPreguntas(levels) {
    const counts = await Promise.all(
      levels.map(lv => supabase.from('questions').select('*', { count: 'exact', head: true }).eq('level_id', lv.id))
    )
    const mapa = {}
    levels.forEach((lv, i) => { mapa[lv.id] = counts[i].count || 0 })
    setPregsPorNivel(mapa)
  }

  const totalPregsNivel = form.level_id ? (pregsPorNivel[parseInt(form.level_id)] || 0) : 0
  const cantidadFinal = form.max_questions_custom !== ''
    ? Math.min(parseInt(form.max_questions_custom) || 1, totalPregsNivel)
    : Math.min(form.max_questions, totalPregsNivel)

  async function crearSala() {
    if (!form.level_id || !form.display_name.trim()) { setError('Completa todos los campos'); return }
    if (cantidadFinal < 1) { setError('Selecciona una cantidad válida de preguntas'); return }
    setLoading(true)
    setError('')
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: room, error: roomErr } = await supabase.from('rooms')
        .insert({ id: code, code, host_id: user.id, level_id: parseInt(form.level_id), timer_per_question: form.timer, max_questions: cantidadFinal, status: 'lobby' })
        .select('id').single()
      if (roomErr) throw roomErr
      const { data: part, error: partErr } = await supabase.from('room_participants')
        .insert({ room_id: room.id, user_id: user.id, display_name: form.display_name.trim(), is_host: true })
        .select('id').single()
      if (partErr) throw partErr
      navigate(`/sala/${room.id}/lobby`, { state: { participantId: part.id, isHost: true, displayName: form.display_name } })
    } catch {
      setError('Error al crear la sala')
    } finally {
      setLoading(false)
    }
  }

  // ✅ Nueva función para buscar sala sin unirse
  async function buscarSala() {
    if (!codigo.trim()) { setError('Ingresa el código'); return }
    setLoading(true)
    setError('')
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*, levels(name, evaluations(title)), room_participants(count)')
      .eq('code', codigo.trim().toUpperCase())
      .single()
    setLoading(false)
    if (error || !room) { setError('Sala no encontrada'); return }
    if (room.status !== 'lobby') { setError('La sala ya está en curso'); return }
    setPreview(room)
  }

  // ✅ Modificamos unirseASala para que use el preview si existe (o haga la búsqueda)
  async function unirseASala(roomData = null) {
    if (!nombreParticipante.trim()) { setError('Ingresa tu nombre'); return }
    setLoading(true)
    setError('')
    try {
      let room = roomData
      if (!room) {
        const { data, error } = await supabase.from('rooms').select('*').eq('code', codigo.trim().toUpperCase()).single()
        if (error || !data) throw new Error('Sala no encontrada')
        room = data
      }
      if (room.status !== 'lobby') { setError('La sala ya está en curso o finalizada'); return }
      const { data: part, error: partErr } = await supabase.from('room_participants')
        .insert({ room_id: room.id, user_id: user.id, display_name: nombreParticipante.trim(), is_host: false })
        .select('id').single()
      if (partErr) throw partErr
      navigate(`/sala/${room.id}/lobby`, { state: { participantId: part.id, isHost: false, displayName: nombreParticipante } })
    } catch {
      setError('Error al unirse a la sala')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"

  return (
    <div className="p-4 md:p-8 pb-24 max-w-3xl animate-fade-in">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-on-background leading-tight">Salas de Competencia</h1>
            <p className="text-on-surface-variant text-xs">Crea una sala o únete con un código</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { key: 'crear',   icon: 'add_circle',    label: 'Crear sala'    },
          { key: 'unirse',  icon: 'login',         label: 'Unirse a sala' },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setError(''); setPreview(null); setCodigo(''); setNombreParticipante('') }}
            className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all border-2
              ${tab === t.key ? 'border-primary bg-primary text-white shadow-md' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50 bg-surface-container-lowest'}`}>
            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-error-container/30 rounded-xl mb-4">
          <span className="material-symbols-outlined text-error text-sm">error</span>
          <p className="text-error text-sm font-bold">{error}</p>
        </div>
      )}

      {tab === 'crear' ? (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
            <h3 className="font-extrabold text-lg">Configurar sala</h3>
          </div>

          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">person</span>Tu nombre en la sala
            </label>
            <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Ej. Juan" className={inputCls} />
          </div>

          {/* Nivel */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">quiz</span>Nivel / Prueba
            </label>
            <select value={form.level_id} onChange={e => setForm(f => ({ ...f, level_id: e.target.value, max_questions_custom: '' }))}
              className={inputCls}>
              <option value="">Selecciona un nivel</option>
              {niveles.map(nv => (
                <option key={nv.id} value={nv.id}>
                  {nv.evaluations?.title} — {nv.name} ({pregsPorNivel[nv.id] || 0} preguntas)
                </option>
              ))}
            </select>
            {form.level_id && totalPregsNivel > 0 && (
              <p className="text-xs text-on-surface-variant flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">check_circle</span>
                {totalPregsNivel} preguntas disponibles en este nivel
              </p>
            )}
          </div>

          {/* Preguntas */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">format_list_numbered</span>Número de preguntas
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {[10, 20, 30, 50].filter(n => n <= totalPregsNivel || totalPregsNivel === 0).map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, max_questions: n, max_questions_custom: '' }))}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                    ${form.max_questions === n && form.max_questions_custom === '' ? 'border-primary bg-primary text-white' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                  {n}
                </button>
              ))}
              {totalPregsNivel > 0 && (
                <button onClick={() => setForm(f => ({ ...f, max_questions: totalPregsNivel, max_questions_custom: String(totalPregsNivel) }))}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                    ${form.max_questions_custom === String(totalPregsNivel) ? 'border-primary bg-primary text-white' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                  Todas ({totalPregsNivel})
                </button>
              )}
            </div>
            <input
              type="number" min={1} max={totalPregsNivel || 999}
              value={form.max_questions_custom}
              onChange={e => setForm(f => ({ ...f, max_questions_custom: e.target.value }))}
              placeholder={`Personalizado (máx. ${totalPregsNivel || '—'})`}
              className={inputCls} />
          </div>

          {/* Tiempo por pregunta */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">timer</span>Tiempo por pregunta
            </label>
            <div className="flex flex-wrap gap-2">
              {[{ v: 30, l: '30s' }, { v: 60, l: '1 min' }, { v: 90, l: '1:30' }, { v: 120, l: '2 min' }, { v: 180, l: '3 min' }].map(o => (
                <button key={o.v} onClick={() => setForm(f => ({ ...f, timer: o.v }))}
                  className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                    ${form.timer === o.v ? 'border-primary bg-primary text-white' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Orden */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">shuffle</span>Orden de preguntas
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: 'aleatorio', l: '🔀 Aleatorio' }, { v: 'original', l: '📋 Original' }].map(o => (
                <button key={o.v} onClick={() => setForm(f => ({ ...f, orden: o.v }))}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all
                    ${form.orden === o.v ? 'border-primary bg-primary text-white' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Resumen */}
          <div className="bg-surface-container-low rounded-2xl p-4 space-y-1.5 text-sm border border-outline-variant/20">
            <p className="font-bold text-xs uppercase tracking-wider text-on-surface-variant mb-2">Resumen de la sala</p>
            <p className="flex justify-between"><span className="text-on-surface-variant">Preguntas</span><span className="font-bold">{cantidadFinal || '—'}</span></p>
            <p className="flex justify-between"><span className="text-on-surface-variant">Tiempo por pregunta</span><span className="font-bold">{form.timer}s</span></p>
            <p className="flex justify-between"><span className="text-on-surface-variant">Orden</span><span className="font-bold capitalize">{form.orden}</span></p>
            <p className="flex justify-between"><span className="text-on-surface-variant">Tiempo total estimado</span><span className="font-bold">{Math.ceil(cantidadFinal * form.timer / 60)} min</span></p>
          </div>

          <button onClick={crearSala} disabled={loading}
            className="w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>Crear sala</>
            }
          </button>
        </div>
      ) : (
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>meeting_room</span>
            <h3 className="font-extrabold text-lg">Unirse a sala</h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">person</span>Tu nombre
            </label>
            <input value={nombreParticipante} onChange={e => setNombreParticipante(e.target.value)}
              placeholder="Ej. Laura" className={inputCls} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">tag</span>Código de sala
            </label>
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())}
              placeholder="Ej. A7K9Q2" maxLength={6}
              className={`${inputCls} font-mono tracking-[0.3em] text-center text-xl`} />
            <p className="text-xs text-on-surface-variant text-center">El anfitrión te comparte el código de 6 caracteres</p>
          </div>

          {/* ✅ Preview y botones condicionales */}
          {!preview ? (
            <button onClick={buscarSala} disabled={loading}
              className="w-full py-3.5 bg-surface-container text-on-surface rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm">
              <span className="material-symbols-outlined text-sm">search</span>Buscar sala
            </button>
          ) : (
            <div className="card p-4 space-y-3 border-2 border-primary/20 bg-primary-fixed/10">
              <p className="font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">check_circle</span>Sala encontrada
              </p>
              <p className="text-sm font-semibold">{preview.levels?.evaluations?.title}</p>
              <p className="text-sm text-on-surface-variant">
                {preview.levels?.name} · {preview.timer_per_question}s por pregunta · {preview.max_questions} preguntas
              </p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setPreview(null)} className="flex-1 py-2.5 border border-outline-variant rounded-xl font-bold text-sm">Volver</button>
                <button onClick={() => unirseASala(preview)} disabled={loading}
                  className="flex-1 py-2.5 bg-primary text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <>🚪 Ingresar</>
                  }
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}