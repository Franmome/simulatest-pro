import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

export default function Salas() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Auto display name from auth — no need to ask
  const displayName = user?.user_metadata?.full_name
    || user?.email?.split('@')[0]
    || 'Jugador'

  const [tab, setTab] = useState('crear')
  const [niveles, setNiveles] = useState([])
  const [pregsPorNivel, setPregsPorNivel] = useState({})
  const [form, setForm] = useState({
    level_id: '',
    timer: 90,
    max_questions: 20,
    max_questions_custom: '',
    orden: 'aleatorio',
  })
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(null)

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

  const selectedLevel = niveles.find(n => String(n.id) === form.level_id)
  const totalPregsNivel = form.level_id ? (pregsPorNivel[parseInt(form.level_id)] || 0) : 0
  const cantidadFinal = form.max_questions_custom !== ''
    ? Math.min(parseInt(form.max_questions_custom) || 1, totalPregsNivel)
    : Math.min(form.max_questions, totalPregsNivel)

  async function crearSala() {
    if (!form.level_id) { setError('Selecciona un nivel'); return }
    if (cantidadFinal < 1) { setError('Selecciona una cantidad válida de preguntas'); return }
    setLoading(true)
    setError('')
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()
      const { data: room, error: roomErr } = await supabase.from('rooms')
        .insert({ id: code, code, host_id: user.id, level_id: parseInt(form.level_id), timer_per_question: form.timer, max_questions: cantidadFinal, status: 'lobby' })
        .select('id').maybeSingle()
      if (roomErr) throw roomErr
      const { data: part, error: partErr } = await supabase.from('room_participants')
        .insert({ room_id: room.id, user_id: user.id, display_name: displayName, is_host: true })
        .select('id').maybeSingle()
      if (partErr) throw partErr
      navigate(`/sala/${room.id}/lobby`, { state: { participantId: part.id, isHost: true, displayName } })
    } catch {
      setError('Error al crear la sala. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function buscarSala() {
    if (!codigo.trim()) { setError('Ingresa el código'); return }
    setLoading(true)
    setError('')
    const { data: room, error: fetchErr } = await supabase
      .from('rooms')
      .select('*, levels(name, evaluations(title)), room_participants(count)')
      .eq('code', codigo.trim().toUpperCase())
      .maybeSingle()
    setLoading(false)
    if (fetchErr || !room) { setError('Sala no encontrada. Verifica el código.'); return }
    if (room.status !== 'lobby') { setError('La sala ya está en curso o finalizó.'); return }
    setPreview(room)
  }

  async function unirseASala(roomData = null) {
    setLoading(true)
    setError('')
    try {
      let room = roomData
      if (!room) {
        const { data, error: fetchErr } = await supabase.from('rooms').select('*').eq('code', codigo.trim().toUpperCase()).maybeSingle()
        if (fetchErr || !data) throw new Error('Sala no encontrada')
        room = data
      }
      if (room.status !== 'lobby') { setError('La sala ya está en curso o finalizada'); return }
      const { data: part, error: partErr } = await supabase.from('room_participants')
        .insert({ room_id: room.id, user_id: user.id, display_name: displayName, is_host: false })
        .select('id').maybeSingle()
      if (partErr) throw partErr
      navigate(`/sala/${room.id}/lobby`, { state: { participantId: part.id, isHost: false, displayName } })
    } catch {
      setError('Error al unirse. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-medium"

  return (
    <div className="p-4 md:p-8 pb-24 max-w-6xl animate-fade-in">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-on-background leading-tight">Salas de Competencia</h1>
            <p className="text-on-surface-variant text-xs">Compite en tiempo real contra otros usuarios</p>
          </div>
        </div>
      </div>

      {/* Desktop 2-col layout */}
      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start">

        {/* Left: Tabs + form */}
        <div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { key: 'crear',  icon: 'add_circle', label: 'Crear sala'    },
              { key: 'unirse', icon: 'login',      label: 'Unirse a sala' },
            ].map(t => (
              <button key={t.key}
                onClick={() => { setTab(t.key); setError(''); setPreview(null); setCodigo('') }}
                className={`flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm transition-all border-2
                  ${tab === t.key
                    ? 'border-primary bg-primary text-white shadow-md'
                    : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50 bg-surface-container-lowest'}`}>
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-error-container/30 rounded-xl mb-4 border border-error/20">
              <span className="material-symbols-outlined text-error text-sm">error</span>
              <p className="text-error text-sm font-bold">{error}</p>
            </div>
          )}

          {tab === 'crear' ? (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>tune</span>
                <h3 className="font-extrabold text-lg">Configurar sala</h3>
              </div>

              {/* Anfitrión — auto del auth */}
              <div className="flex items-center gap-3 p-3 bg-primary-fixed/20 rounded-xl border border-primary/10">
                <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {displayName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{displayName}</p>
                  <p className="text-[10px] text-on-surface-variant">Anfitrión de la sala</p>
                </div>
                <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>

              {/* Nivel */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">quiz</span>Nivel / Prueba
                </label>
                <select value={form.level_id}
                  onChange={e => setForm(f => ({ ...f, level_id: e.target.value, max_questions_custom: '' }))}
                  className={inputCls}>
                  <option value="">Selecciona un nivel...</option>
                  {niveles.map(nv => (
                    <option key={nv.id} value={nv.id}>
                      {nv.evaluations?.title} — {nv.name} ({pregsPorNivel[nv.id] || 0} preguntas)
                    </option>
                  ))}
                </select>
                {form.level_id && totalPregsNivel > 0 && (
                  <p className="text-xs text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
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
                    <button key={n}
                      onClick={() => setForm(f => ({ ...f, max_questions: n, max_questions_custom: '' }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                        ${form.max_questions === n && form.max_questions_custom === ''
                          ? 'border-primary bg-primary text-white'
                          : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                      {n}
                    </button>
                  ))}
                  {totalPregsNivel > 0 && (
                    <button
                      onClick={() => setForm(f => ({ ...f, max_questions: totalPregsNivel, max_questions_custom: String(totalPregsNivel) }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                        ${form.max_questions_custom === String(totalPregsNivel)
                          ? 'border-primary bg-primary text-white'
                          : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
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

              {/* Tiempo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">timer</span>Tiempo por pregunta
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 30, l: '30s' },
                    { v: 60, l: '1 min' },
                    { v: 90, l: '1:30' },
                    { v: 120, l: '2 min' },
                    { v: 180, l: '3 min' },
                  ].map(o => (
                    <button key={o.v} onClick={() => setForm(f => ({ ...f, timer: o.v }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all
                        ${form.timer === o.v
                          ? 'border-primary bg-primary text-white'
                          : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
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
                  {[
                    { v: 'aleatorio', l: '🔀 Aleatorio' },
                    { v: 'original',  l: '📋 Original'  },
                  ].map(o => (
                    <button key={o.v} onClick={() => setForm(f => ({ ...f, orden: o.v }))}
                      className={`py-2.5 rounded-xl text-sm font-bold border-2 transition-all
                        ${form.orden === o.v
                          ? 'border-primary bg-primary text-white'
                          : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
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
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>meeting_room</span>
                <h3 className="font-extrabold text-lg">Unirse a sala</h3>
              </div>

              {/* Participante — auto del auth */}
              <div className="flex items-center gap-3 p-3 bg-secondary-container/30 rounded-xl border border-secondary/10">
                <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {displayName[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{displayName}</p>
                  <p className="text-[10px] text-on-surface-variant">Participante</p>
                </div>
                <span className="material-symbols-outlined text-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">tag</span>Código de sala
                </label>
                <input value={codigo}
                  onChange={e => { setCodigo(e.target.value.toUpperCase()); setPreview(null); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && buscarSala()}
                  placeholder="Ej. A7K9Q2" maxLength={6}
                  className={`${inputCls} font-mono tracking-[0.3em] text-center text-xl uppercase`} />
                <p className="text-xs text-on-surface-variant text-center">Código de 6 caracteres que te da el anfitrión</p>
              </div>

              {!preview ? (
                <button onClick={buscarSala} disabled={loading || !codigo.trim()}
                  className="w-full py-3.5 bg-surface-container text-on-surface rounded-2xl font-bold text-sm active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm border border-outline-variant/20">
                  {loading
                    ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    : <><span className="material-symbols-outlined text-sm">search</span>Buscar sala</>
                  }
                </button>
              ) : (
                <div className="rounded-2xl border-2 border-primary/20 bg-primary-fixed/10 p-4 space-y-3 animate-fade-in">
                  <p className="font-bold text-primary flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    ¡Sala encontrada!
                  </p>
                  <div>
                    <p className="text-sm font-semibold">{preview.levels?.evaluations?.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{preview.levels?.name}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Preguntas', value: preview.max_questions, color: 'text-primary' },
                      { label: 'Por pregunta', value: `${preview.timer_per_question}s`, color: 'text-tertiary' },
                      { label: 'Jugadores', value: preview.room_participants?.[0]?.count || 0, color: 'text-secondary' },
                    ].map(stat => (
                      <div key={stat.label} className="bg-white/60 rounded-xl p-2">
                        <p className={`font-extrabold text-base ${stat.color}`}>{stat.value}</p>
                        <p className="text-[10px] text-on-surface-variant">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => { setPreview(null); setCodigo('') }}
                      className="flex-1 py-2.5 border border-outline-variant rounded-xl font-bold text-sm">
                      Volver
                    </button>
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

        {/* Right panel — desktop only */}
        <div className="hidden md:flex flex-col gap-4">
          {tab === 'crear' ? (
            <>
              {/* Live preview */}
              <div className="card p-5">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">preview</span>Vista previa
                </p>

                {form.level_id && selectedLevel ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-4 border border-primary/10">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>quiz</span>
                        <p className="font-extrabold text-primary text-sm leading-snug">{selectedLevel?.evaluations?.title}</p>
                      </div>
                      <p className="text-xs text-on-surface-variant ml-6">{selectedLevel?.name}</p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Preguntas', value: cantidadFinal || '—', color: 'text-primary' },
                        { label: 'Por preg.', value: `${form.timer}s`,    color: 'text-tertiary' },
                        { label: 'Estimado', value: `${Math.ceil((cantidadFinal || 0) * form.timer / 60)}m`, color: 'text-secondary' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-surface-container-low rounded-xl p-3">
                          <p className={`text-2xl font-extrabold ${stat.color}`}>{stat.value}</p>
                          <p className="text-[10px] text-on-surface-variant">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-surface-container-low rounded-xl">
                      <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {displayName[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{displayName}</p>
                        <p className="text-[10px] text-on-surface-variant">Anfitrión</p>
                      </div>
                      <span className="text-[10px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-full shrink-0">Tú</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2">
                      <span className="material-symbols-outlined text-sm">shuffle</span>
                      Orden: <span className="font-bold capitalize ml-0.5">{form.orden}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 text-on-surface-variant">
                    <span className="material-symbols-outlined text-5xl mb-3 block opacity-20">quiz</span>
                    <p className="text-sm">Selecciona un nivel para ver la vista previa de tu sala</p>
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="card p-5">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">info</span>¿Cómo funciona?
                </p>
                <div className="space-y-3">
                  {[
                    { icon: 'rocket_launch', cls: 'text-primary bg-primary-fixed/50',        text: 'Crea la sala y comparte el código con tus compañeros' },
                    { icon: 'groups',        cls: 'text-secondary bg-secondary-container/50', text: 'Todos entran al lobby y confirman que están listos' },
                    { icon: 'timer',         cls: 'text-tertiary bg-tertiary-container/30',   text: 'Cada pregunta tiene tiempo límite — ¡responde rápido!' },
                    { icon: 'emoji_events',  cls: 'text-amber-600 bg-amber-50',               text: 'Al final se muestra el ranking y puedes pedir revancha' },
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${tip.cls}`}>
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{tip.icon}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed pt-0.5">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Tab unirse — right panel */
            <div className="card p-5">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">help</span>¿Dónde está el código?
              </p>
              <div className="space-y-4">
                <div className="bg-surface-container-low rounded-2xl p-4 text-center">
                  <div className="inline-flex items-center gap-1.5 bg-on-surface text-surface px-4 py-2 rounded-full font-mono font-bold tracking-widest text-sm mb-3">
                    A7K9Q2
                  </div>
                  <p className="text-xs text-on-surface-variant">El anfitrión ve este código en el lobby y te lo comparte</p>
                </div>
                <div className="space-y-3">
                  {[
                    { icon: 'share',          text: 'El anfitrión crea la sala y copia el código de 6 letras' },
                    { icon: 'keyboard',       text: 'Ingresas el código aquí y buscas la sala' },
                    { icon: 'check_circle',   text: 'Confirmas los datos y entras al lobby' },
                    { icon: 'sports_esports', text: '¡Compites en tiempo real contra todos!' },
                  ].map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>{tip.icon}</span>
                      <p className="text-xs text-on-surface-variant">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
