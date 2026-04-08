import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const ICONOS_CATEGORIA = {
  'CNSC':          'gavel',
  'ICFES':         'school',
  'Saber Pro':     'history_edu',
  'Procuraduría':  'balance',
  'Contraloría':   'account_balance',
  'Defensoría':    'shield',
}

const COLORES_CATEGORIA = {
  'CNSC':         'from-primary to-primary-container',
  'ICFES':        'from-tertiary to-tertiary-container',
  'Saber Pro':    'from-secondary to-[#217128]',
  'Procuraduría': 'from-[#003d9b] to-[#1b6d24]',
  'Contraloría':  'from-primary to-[#0052cc]',
  'Defensoría':   'from-slate-400 to-slate-500',
}

function formatTiempo(minutos) {
  if (!minutos) return '—'
  if (minutos >= 60) return `${Math.floor(minutos / 60)}h ${minutos % 60 > 0 ? `${minutos % 60}m` : ''}`.trim()
  return `${minutos}m`
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`
  return new Date(fecha).toLocaleDateString('es-CO')
}

export default function DetallePrueba() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { user } = useAuth()

  const [ev,               setEv]               = useState(null)
  const [niveles,          setNiveles]          = useState([])
  const [pregsPorNivel,    setPregsPorNivel]    = useState({})
  const [intentosPorNivel, setIntentosPorNivel] = useState({})
  const [totalPregs,       setTotalPregs]       = useState(0)
  const [tienePlan,        setTienePlan]        = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [iniciando,        setIniciando]        = useState(null)
  const [nivelSeleccionado, setNivelSeleccionado] = useState(null)
  const [modalModo,        setModalModo]        = useState(null)
  const [modalConfirm,     setModalConfirm]     = useState(false)
  const [configPractica,   setConfigPractica]   = useState({ orden: 'original', cantidad: 20 })

  useEffect(() => { if (id) cargarEvaluacion() }, [id])
  useEffect(() => { if (user?.id) verificarPlan() }, [user?.id])

  async function cargarEvaluacion() {
    setLoading(true)
    setError(null)
    try {
      const { data: evalData, error: evalErr } = await supabase
        .from('evaluations').select('*, categories(id, name)').eq('id', id).single()
      if (evalErr) throw evalErr

      const { data: levels, error: levErr } = await supabase
        .from('levels').select('id, name, description, time_limit, passing_score, sort_order')
        .eq('evaluation_id', id).order('sort_order', { ascending: true })
      if (levErr) throw levErr

      setEv(evalData)
      setNiveles(levels || [])
      if (levels?.length) {
        setNivelSeleccionado(levels[0])
        await Promise.all([
          cargarPreguntasPorNivel(levels),
          user?.id ? cargarIntentosPorNivel(levels) : Promise.resolve(),
        ])
      }
    } catch {
      setError('No se pudo cargar la evaluación.')
    } finally {
      setLoading(false)
    }
  }

  async function cargarPreguntasPorNivel(levels) {
    const counts = await Promise.all(
      levels.map(lv => supabase.from('questions').select('*', { count: 'exact', head: true }).eq('level_id', lv.id))
    )
    const mapa = {}
    let total = 0
    levels.forEach((lv, i) => { mapa[lv.id] = counts[i].count || 0; total += counts[i].count || 0 })
    setPregsPorNivel(mapa)
    setTotalPregs(total)
  }

  async function cargarIntentosPorNivel(levels) {
    if (!user?.id) return
    const { data } = await supabase.from('attempts')
      .select('id, level_id, score, status, start_time')
      .eq('user_id', user.id).in('level_id', levels.map(l => l.id))
      .order('start_time', { ascending: false })
    if (!data) return
    const mapa = {}
    data.forEach(i => { if (!mapa[i.level_id]) mapa[i.level_id] = i })
    setIntentosPorNivel(mapa)
  }

  async function verificarPlan() {
    const { count } = await supabase.from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString())
    setTienePlan((count || 0) > 0)
  }

  function abrirModal(modo) {
    if (!user) { navigate('/login'); return }
    if (!tienePlan) { navigate('/planes'); return }
    if (!nivelSeleccionado) return
    if (pregsNivel === 0) { alert('Este nivel aún no tiene preguntas.'); return }
    setModalModo(modo)
  }

  function confirmarInicio() {
    setModalConfirm(false)
    setModalModo(null)
    setIniciando(modalModo)
    const params = new URLSearchParams({ modo: modalModo })
    if (modalModo === 'practica') {
      params.set('orden', configPractica.orden)
      params.set('cantidad', configPractica.cantidad)
    }
    navigate(`/simulacro/${nivelSeleccionado.id}?${params.toString()}`)
  }

  function irASala() {
    if (!user) { navigate('/login'); return }
    if (!tienePlan) { navigate('/planes'); return }
    navigate('/salas')
  }

  if (loading) return (
    <div className="p-6 pb-20 max-w-4xl animate-pulse space-y-6">
      <div className="h-48 bg-surface-container-high rounded-3xl" />
      <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-surface-container-high rounded-xl" />)}</div>
      <div className="h-32 bg-surface-container-high rounded-2xl" />
    </div>
  )

  if (error || !ev) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-64 gap-4">
      <span className="material-symbols-outlined text-5xl text-error opacity-50">error</span>
      <p className="text-on-surface-variant font-semibold">{error || 'Evaluación no encontrada'}</p>
      <button onClick={() => navigate('/catalogo')} className="btn-primary px-6 py-2">Volver al catálogo</button>
    </div>
  )

  const catNombre      = ev.categories?.name ?? 'General'
  const icono          = ICONOS_CATEGORIA[catNombre] || 'quiz'
  const colorGrad      = COLORES_CATEGORIA[catNombre] || 'from-primary to-primary-container'
  const durMax         = niveles.length ? formatTiempo(Math.max(...niveles.map(l => l.time_limit ?? 0))) : '—'
  const aprobMax       = niveles.length ? `${Math.max(...niveles.map(l => l.passing_score ?? 0))}%` : '—'
  const totalIntentos  = Object.values(intentosPorNivel).length
  const nivCompletados = Object.values(intentosPorNivel).filter(a => a.status === 'completed').length
  const mejorScore     = Object.values(intentosPorNivel).filter(a => a.score != null).reduce((max, a) => Math.max(max, a.score), 0)
  const pregsNivel     = nivelSeleccionado ? (pregsPorNivel[nivelSeleccionado.id] || 0) : 0
  const intentoActual  = nivelSeleccionado ? intentosPorNivel[nivelSeleccionado.id] : null

  return (
    <div className="p-4 md:p-8 pb-24 max-w-4xl animate-fade-in">

      {/* Volver */}
      <button onClick={() => navigate('/catalogo')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm font-semibold mb-6 transition-colors group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Volver al catálogo
      </button>

      {/* Hero */}
      <div className={`bg-gradient-to-br ${colorGrad} rounded-3xl p-6 md:p-8 text-white mb-6 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-10 -translate-x-10" />
        <div className="relative z-10">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>{icono}</span>
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 bg-white/10 px-2 py-0.5 rounded-full">{catNombre}</span>
              <h1 className="text-xl md:text-3xl font-extrabold leading-tight mt-1">{ev.title}</h1>
            </div>
            {tienePlan && (
              <span className="shrink-0 flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                Activo
              </span>
            )}
          </div>
          <p className="text-white/80 text-sm leading-relaxed line-clamp-2">
            {ev.description || 'Simulacro oficial con preguntas actualizadas para esta convocatoria.'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { val: totalPregs || '—', label: 'Preguntas',  icon: 'quiz',     color: 'text-primary'       },
          { val: durMax,            label: 'Duración',   icon: 'timer',    color: 'text-tertiary'      },
          { val: niveles.length,    label: 'Niveles',    icon: 'layers',   color: 'text-secondary'     },
          { val: aprobMax,          label: 'Aprobación', icon: 'verified', color: 'text-on-background' },
        ].map(s => (
          <div key={s.label} className="card p-3 text-center">
            <span className={`material-symbols-outlined text-xl ${s.color} mb-0.5 block`}>{s.icon}</span>
            <span className={`text-lg font-extrabold block ${s.color}`}>{s.val}</span>
            <p className="text-[10px] text-on-surface-variant font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Historial */}
      {user && totalIntentos > 0 && (
        <div className="bg-surface-container-low rounded-2xl p-4 mb-6 border border-outline-variant/15">
          <p className="font-bold text-sm mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">history</span>
            Tu historial
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-xl font-extrabold text-primary">{totalIntentos}</p><p className="text-xs text-on-surface-variant">Intentos</p></div>
            <div><p className="text-xl font-extrabold text-secondary">{nivCompletados}</p><p className="text-xs text-on-surface-variant">Completados</p></div>
            <div>
              <p className={`text-xl font-extrabold ${mejorScore >= 70 ? 'text-secondary' : 'text-error'}`}>{mejorScore}%</p>
              <p className="text-xs text-on-surface-variant">Mejor score</p>
            </div>
          </div>
        </div>
      )}

      {/* Selector nivel */}
      {niveles.length > 1 && (
        <div className="mb-6">
          <p className="text-sm font-bold text-on-surface-variant mb-3">Selecciona el nivel</p>
          <div className="flex flex-wrap gap-2">
            {niveles.map(nv => {
              const sel = nivelSeleccionado?.id === nv.id
              const completado = intentosPorNivel[nv.id]?.status === 'completed'
              return (
                <button key={nv.id} onClick={() => setNivelSeleccionado(nv)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border-2
                    ${sel ? 'border-primary bg-primary text-white shadow-md' : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/50'}`}>
                  {completado && <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                  {nv.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Info nivel */}
      {nivelSeleccionado && (
        <div className="card p-5 mb-6">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-extrabold text-lg">{nivelSeleccionado.name}</h3>
              {nivelSeleccionado.description && <p className="text-on-surface-variant text-sm mt-0.5">{nivelSeleccionado.description}</p>}
            </div>
            {intentoActual && (
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ml-2
                ${intentoActual.score >= (nivelSeleccionado.passing_score || 70) ? 'bg-secondary-container text-secondary' : 'bg-error-container text-error'}`}>
                Último: {intentoActual.score ?? '—'}% · {tiempoRelativo(intentoActual.start_time)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-on-surface-variant">
            {pregsNivel > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">quiz</span>{pregsNivel} preguntas</span>}
            {nivelSeleccionado.time_limit > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">timer</span>{formatTiempo(nivelSeleccionado.time_limit)}</span>}
            {nivelSeleccionado.passing_score > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm">verified</span>Aprobación {nivelSeleccionado.passing_score}%</span>}
          </div>
        </div>
      )}

      {/* Modos */}
      {tienePlan ? (
        <div className="space-y-3">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">Selecciona tu modo</p>

          <button onClick={() => abrirModal('practica')} disabled={!!iniciando || pregsNivel === 0}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-secondary/30 bg-secondary-container/10 hover:border-secondary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50 text-left group">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-secondary">Modo Práctica</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Retroalimentación inmediata · Aprende a tu ritmo</p>
            </div>
            <span className="material-symbols-outlined text-secondary shrink-0">arrow_forward</span>
          </button>

          <button onClick={() => abrirModal('examen')} disabled={!!iniciando || pregsNivel === 0}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-primary/30 bg-primary-fixed/10 hover:border-primary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50 text-left group">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-primary">Modo Examen</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Sin ayudas · Condiciones reales · Timer total</p>
            </div>
            <span className="material-symbols-outlined text-primary shrink-0">arrow_forward</span>
          </button>

          <button onClick={irASala} disabled={!!iniciando}
            className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-tertiary/30 bg-tertiary-container/10 hover:border-tertiary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50 text-left group">
            <div className="w-12 h-12 rounded-xl bg-tertiary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-tertiary">Sala en línea</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Compite con otros · Código de sala · Ranking en vivo</p>
            </div>
            <span className="material-symbols-outlined text-tertiary shrink-0">arrow_forward</span>
          </button>

          {pregsNivel === 0 && <p className="text-xs text-on-surface-variant text-center pt-2">⚠️ Este nivel aún no tiene preguntas disponibles</p>}
        </div>
      ) : (
        <div className={`bg-gradient-to-r ${colorGrad} rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4`}>
          <div className="text-white">
            <p className="font-bold text-lg">¿Listo para practicar?</p>
            <p className="text-white/70 text-sm mt-1">Adquiere el paquete para acceder a todos los modos</p>
          </div>
          <button onClick={() => navigate('/planes')}
            className="bg-white text-primary font-bold px-6 py-3 rounded-full hover:shadow-lg transition-all active:scale-95 whitespace-nowrap text-sm shrink-0">
            Ver planes →
          </button>
        </div>
      )}

      {/* ── Modal Práctica ── */}
      {modalModo === 'practica' && !modalConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
              <div>
                <h3 className="font-extrabold text-lg">Modo Práctica</h3>
                <p className="text-xs text-on-surface-variant">Configura tu sesión</p>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Cantidad de preguntas</label>
                <select value={configPractica.cantidad}
                  onChange={e => setConfigPractica(c => ({ ...c, cantidad: parseInt(e.target.value) }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-secondary text-sm font-semibold">
                  {[10, 20, 30, 50, pregsNivel]
                    .filter((v, i, a) => v > 0 && v <= pregsNivel && a.indexOf(v) === i)
                    .sort((a, b) => a - b)
                    .map(n => (
                      <option key={n} value={n}>{n === pregsNivel ? `Todas (${n})` : n} preguntas</option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant">Orden</label>
                <div className="grid grid-cols-2 gap-2">
                  {[{ val: 'aleatorio', label: '🔀 Aleatorio' }, { val: 'original', label: '📋 Original' }].map(o => (
                    <button key={o.val} onClick={() => setConfigPractica(c => ({ ...c, orden: o.val }))}
                      className={`py-3 rounded-xl font-bold text-sm transition-all border-2
                        ${configPractica.orden === o.val ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-outline-variant/30 text-on-surface-variant'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-secondary-container/20 rounded-2xl p-4 mb-5 space-y-1.5 text-sm">
              <p className="flex justify-between"><span className="text-on-surface-variant">Preguntas</span><span className="font-bold">{configPractica.cantidad}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Orden</span><span className="font-bold capitalize">{configPractica.orden}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Retroalimentación</span><span className="font-bold text-secondary">✓ Incluida</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Timer</span><span className="font-bold">Por pregunta (1:30)</span></p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalModo(null)} className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm">Cancelar</button>
              <button onClick={() => setModalConfirm(true)} className="flex-1 py-3 rounded-full bg-secondary text-white font-bold text-sm active:scale-95 transition-all">Continuar →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Examen ── */}
      {modalModo === 'examen' && !modalConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
              </div>
              <div>
                <h3 className="font-extrabold text-lg">Modo Examen</h3>
                <p className="text-xs text-on-surface-variant">Condiciones reales de prueba</p>
              </div>
            </div>

            <div className="bg-primary-fixed/20 rounded-2xl p-4 mb-4 space-y-1.5 text-sm">
              <p className="flex justify-between"><span className="text-on-surface-variant">Preguntas</span><span className="font-bold">{pregsNivel}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Duración total</span><span className="font-bold">{formatTiempo(nivelSeleccionado?.time_limit)}</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Puntaje de aprobación</span><span className="font-bold">{nivelSeleccionado?.passing_score ?? 70}%</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Retroalimentación</span><span className="font-bold text-error">✗ No disponible</span></p>
              <p className="flex justify-between"><span className="text-on-surface-variant">Cambiar respuesta</span><span className="font-bold text-error">✗ No permitido</span></p>
            </div>

            <div className="bg-error-container/20 rounded-xl p-3 mb-5 flex items-start gap-2">
              <span className="material-symbols-outlined text-error text-sm shrink-0 mt-0.5">warning</span>
              <p className="text-xs text-error font-medium">Una vez iniciado no podrás ver las respuestas correctas hasta terminar.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalModo(null)} className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm">Cancelar</button>
              <button onClick={() => setModalConfirm(true)} className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-all">Iniciar examen →</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Confirmación final ── */}
      {modalConfirm && (
        <div className="fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 animate-fade-in text-center">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${modalModo === 'practica' ? 'bg-secondary' : 'bg-primary'}`}>
              <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {modalModo === 'practica' ? 'school' : 'timer'}
              </span>
            </div>
            <h3 className="font-extrabold text-xl mb-2">¿Listo para empezar?</h3>
            <p className="text-on-surface-variant text-sm mb-6">
              {modalModo === 'practica'
                ? `${configPractica.cantidad} preguntas en orden ${configPractica.orden} con retroalimentación`
                : `${pregsNivel} preguntas · ${formatTiempo(nivelSeleccionado?.time_limit)} · Sin ayudas`
              }
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setModalConfirm(false) }}
                className="flex-1 py-3 rounded-full border border-outline-variant font-bold text-sm">
                Volver
              </button>
              <button onClick={confirmarInicio}
                className={`flex-1 py-3 rounded-full font-bold text-sm text-white active:scale-95 transition-all ${modalModo === 'practica' ? 'bg-secondary' : 'bg-primary'}`}>
                🚀 ¡Empezar!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}