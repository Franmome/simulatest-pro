import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'
import IAPraxia, { ModelSelector } from '../components/IAPraxia'
import { generarSimulacroPersonal } from '../utils/gemini'

// ── Constantes visuales ───────────────────────────────────────────────────────

const ICONOS = {
  'CNSC': 'gavel', 'ICFES': 'school', 'Saber Pro': 'history_edu',
  'Procuraduría': 'balance', 'Contraloría': 'account_balance',
  'Defensoría': 'shield', 'DIAN': 'receipt_long', 'TyT': 'engineering',
}
const GRADIENTES = {
  'CNSC':        'from-primary to-primary-container',
  'ICFES':       'from-tertiary to-tertiary-container',
  'Saber Pro':   'from-secondary to-[#217128]',
  'Procuraduría':'from-[#003d9b] to-[#1b6d24]',
  'Contraloría': 'from-primary to-[#0052cc]',
  'Defensoría':  'from-slate-500 to-slate-600',
  'DIAN':        'from-[#b45309] to-[#92400e]',
  'TyT':         'from-[#6d28d9] to-[#4c1d95]',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTiempo(m) {
  if (!m) return '—'
  if (m >= 60) return `${Math.floor(m / 60)}h${m % 60 > 0 ? ` ${m % 60}m` : ''}`.trim()
  return `${m}m`
}
function tiempoRelativo(fecha) {
  const d = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (d < 3600)   return `hace ${Math.floor(d / 60)} min`
  if (d < 86400)  return `hace ${Math.floor(d / 3600)} h`
  if (d < 604800) return `hace ${Math.floor(d / 86400)} días`
  return new Date(fecha).toLocaleDateString('es-CO')
}
function iconoMaterial(t) {
  return { pdf: 'picture_as_pdf', video: 'play_circle', link: 'link', doc: 'description' }[t] || 'attachment'
}
function colorMaterial(t) {
  return { pdf: 'text-red-500 bg-red-50', video: 'text-blue-600 bg-blue-50', link: 'text-primary bg-primary/10', doc: 'text-amber-600 bg-amber-50' }[t] || 'text-on-surface-variant bg-surface-container'
}

// ── Tab Material ──────────────────────────────────────────────────────────────

function TabMaterial({ packageId, tienePlan }) {
  const { data, loading, error, retry } = useFetch(async () => {
    if (!packageId) return []
    const { data, error } = await supabase
      .from('study_materials').select('*')
      .eq('package_id', packageId).eq('is_active', true)
      .order('folder').order('sort_order')
    if (error) throw new Error(error.message)
    return data || []
  }, ['detalle-material', packageId])

  const materiales = data || []
  const carpetas = materiales.reduce((a, m) => {
    if (!a[m.folder]) a[m.folder] = []
    a[m.folder].push(m)
    return a
  }, {})

  if (!tienePlan) return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
      </div>
      <h3 className="font-extrabold text-xl mb-2">Contenido exclusivo</h3>
      <p className="text-on-surface-variant text-sm max-w-xs leading-relaxed">
        Adquiere el paquete para acceder a todo el material de estudio incluido.
      </p>
    </div>
  )

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-container-high rounded-2xl" />)}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12">
      <span className="material-symbols-outlined text-error text-4xl">error</span>
      <p className="text-sm text-on-surface-variant">{error}</p>
      <button onClick={retry} className="text-primary text-sm font-bold underline">Reintentar</button>
    </div>
  )

  if (materiales.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 rounded-3xl bg-surface-container-high flex items-center justify-center mb-4">
        <span className="material-symbols-outlined text-on-surface-variant text-4xl">folder_open</span>
      </div>
      <h3 className="font-bold text-xl mb-1">Sin material aún</h3>
      <p className="text-on-surface-variant text-sm">El equipo está preparando el contenido. Pronto estará disponible.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {Object.entries(carpetas).map(([carpeta, items]) => (
        <div key={carpeta}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary text-lg"
              style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
            <h3 className="font-extrabold text-sm uppercase tracking-widest text-primary">{carpeta}</h3>
            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{items.length}</span>
          </div>
          <div className="space-y-2">
            {items.map(m => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-200 hover:border-primary/30 hover:shadow-md transition-all group">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorMaterial(m.type)}`}>
                  <span className="material-symbols-outlined text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>{iconoMaterial(m.type)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">{m.title}</p>
                  {m.description && <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{m.description}</p>}
                </div>
                <span className="material-symbols-outlined text-slate-400 group-hover:text-primary transition-colors flex-shrink-0">open_in_new</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Segmented control reutilizable ────────────────────────────────────────────

function Segmented({ options, value, onChange, color = 'primary' }) {
  const activeMap = {
    primary:   'bg-white text-primary shadow-sm',
    secondary: 'bg-white text-secondary shadow-sm',
  }
  return (
    <div className="flex bg-slate-100 p-1 rounded-xl">
      {options.map(op => (
        <button key={String(op.v)} type="button"
          onClick={() => onChange(op.v)}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1.5
            ${value === op.v ? activeMap[color] : 'text-slate-500 hover:text-slate-700'}`}>
          {op.icon && <span className="material-symbols-outlined text-base">{op.icon}</span>}
          {op.l}
        </button>
      ))}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DetallePrueba() {
  const navigate = useNavigate()
  const { id }   = useParams()
  const { user } = useAuth()

  const [tabActiva,         setTabActiva]         = useState('simulacro')
  const [nivelSeleccionado, setNivelSeleccionado] = useState(null)
  const [modalModo,         setModalModo]         = useState(null)
  const [modalConfirm,      setModalConfirm]      = useState(false)

  const [configPractica, setConfigPractica] = useState({
    orden: 'aleatorio', cantidad: 20, cantidad_custom: '',
    tipo_cantidad: 'preset', con_retro: true, timer_pregunta: 90,
  })
  const [configExamen, setConfigExamen] = useState({
    cantidad: 0, cantidad_custom: '', tipo_cantidad: 'all',
  })

  // ── IA Simulacro ────────────────────────────────────────────────────────────
  const [modalIA,      setModalIA]      = useState(false)
  const [cargo,        setCargo]        = useState('')
  const [pdfIA,        setPdfIA]        = useState(null)
  const [generandoIA,  setGenerandoIA]  = useState(false)
  const [errorIA,      setErrorIA]      = useState(null)
  const [modeloIA,     setModeloIA]     = useState('gemini')

  async function lanzarSimulacroIA() {
    if (!cargo.trim()) { setErrorIA('Escribe el nombre del OPEC o cargo.'); return }
    setGenerandoIA(true)
    setErrorIA(null)
    try {
      const { simulacro_id } = await generarSimulacroPersonal({
        evaluacion_id: id,
        cargo: cargo.trim(),
        pdf: pdfIA || undefined,
        modelo: modeloIA,
      })
      setModalIA(false)
      navigate(`/simulacro-ia/${simulacro_id}`)
    } catch (e) {
      setErrorIA(e.message)
    } finally {
      setGenerandoIA(false)
    }
  }

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const { data, loading, error, retry } = useFetch(async () => {
    const { data: evalData, error: evalErr } = await supabase
      .from('evaluations').select('*, categories(id, name)').eq('id', id).maybeSingle()
    if (evalErr) throw new Error(evalErr.message)
    if (!evalData) throw new Error('Evaluación no encontrada')

    const { data: levels, error: levErr } = await supabase
      .from('levels').select('id, name, description, time_limit, passing_score, sort_order')
      .eq('evaluation_id', id).order('sort_order', { ascending: true })
    if (levErr) throw new Error(levErr.message)

    const niveles = levels || []
    let pregsPorNivel = {}, totalPregs = 0
    if (niveles.length) {
      const { data: qCounts } = await supabase
        .from('questions').select('level_id').in('level_id', niveles.map(l => l.id))
      ;(qCounts || []).forEach(q => { pregsPorNivel[q.level_id] = (pregsPorNivel[q.level_id] || 0) + 1 })
      totalPregs = Object.values(pregsPorNivel).reduce((s, c) => s + c, 0)
    }

    let intentosPorNivel = {}
    if (user?.id && niveles.length) {
      const { data: intentosData } = await supabase
        .from('attempts').select('id, level_id, score, status, start_time')
        .eq('user_id', user.id).in('level_id', niveles.map(l => l.id))
        .order('start_time', { ascending: false })
      ;(intentosData || []).forEach(i => { if (!intentosPorNivel[i.level_id]) intentosPorNivel[i.level_id] = i })
    }

    let tienePlan = false, packageId = null, hasAiChat = false
    if (user?.id) {
      const { data: compra } = await supabase
        .from('purchases').select('package_id').eq('user_id', user.id)
        .eq('status', 'active').gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: false }).limit(1).maybeSingle()
      if (compra) {
        tienePlan = true
        packageId = compra.package_id
        const { data: pkg } = await supabase
          .from('packages').select('has_ai_chat').eq('id', packageId).maybeSingle()
        hasAiChat = pkg?.has_ai_chat ?? false
      }
    }

    return { ev: evalData, niveles, pregsPorNivel, intentosPorNivel, totalPregs, tienePlan, packageId, hasAiChat }
  }, ['detalle-prueba', id, user?.id])

  // ── Derivados ───────────────────────────────────────────────────────────────

  const ev               = data?.ev ?? null
  const niveles          = data?.niveles ?? []
  const pregsPorNivel    = data?.pregsPorNivel ?? {}
  const intentosPorNivel = data?.intentosPorNivel ?? {}
  const totalPregs       = data?.totalPregs ?? 0
  const tienePlan        = data?.tienePlan ?? false
  const packageId        = data?.packageId ?? null
  const hasAiChat        = data?.hasAiChat ?? false
  const nivelActual      = nivelSeleccionado ?? (niveles.length ? niveles[0] : null)
  const pregsNivel       = nivelActual ? (pregsPorNivel[nivelActual.id] || 0) : 0
  const intentoActual    = nivelActual ? intentosPorNivel[nivelActual.id] : null
  const totalIntentos    = Object.values(intentosPorNivel).length
  const nivCompletados   = Object.values(intentosPorNivel).filter(a => a.status === 'completed').length
  const mejorScore       = Object.values(intentosPorNivel).filter(a => a.score != null).reduce((max, a) => Math.max(max, a.score), 0)

  const cantPractica = configPractica.tipo_cantidad === 'all'
    ? pregsNivel
    : configPractica.tipo_cantidad === 'custom'
    ? Math.min(parseInt(configPractica.cantidad_custom) || 0, pregsNivel)
    : Math.min(configPractica.cantidad, pregsNivel)

  const cantExamen = configExamen.tipo_cantidad === 'all'
    ? pregsNivel
    : configExamen.tipo_cantidad === 'custom'
    ? Math.min(parseInt(configExamen.cantidad_custom) || 0, pregsNivel)
    : (configExamen.cantidad || pregsNivel)

  // ── Acciones ────────────────────────────────────────────────────────────────

  function abrirModal(modo) {
    if (!user) { navigate('/login'); return }
    if (!tienePlan) { navigate('/planes'); return }
    if (!nivelActual) return
    if (pregsNivel === 0) { alert('Este nivel aún no tiene preguntas.'); return }
    if (modo === 'examen') setConfigExamen(c => ({ ...c, cantidad: pregsNivel, cantidad_custom: '', tipo_cantidad: 'all' }))
    if (modo === 'practica') setConfigPractica(c => ({ ...c, cantidad: Math.min(20, pregsNivel), cantidad_custom: '', tipo_cantidad: 'preset' }))
    setModalModo(modo)
  }

  function confirmarInicio() {
    setModalConfirm(false); setModalModo(null)
    const p = new URLSearchParams({ modo: modalModo })
    if (modalModo === 'practica') {
      p.set('orden', configPractica.orden)
      p.set('cantidad', Math.min(cantPractica, pregsNivel))
      p.set('retro', configPractica.con_retro ? '1' : '0')
      p.set('timer', configPractica.timer_pregunta)
    } else {
      p.set('cantidad', Math.min(cantExamen, pregsNivel))
    }
    navigate(`/simulacro/${nivelActual.id}?${p.toString()}`)
  }

  function irASala() {
    if (!user) { navigate('/login'); return }
    if (!tienePlan) { navigate('/planes'); return }
    navigate('/salas')
  }

  // ── Loading / Error ─────────────────────────────────────────────────────────

  if (loading) return (
    <div className="p-6 pb-20 max-w-7xl mx-auto animate-pulse space-y-5">
      <div className="h-48 bg-surface-container-high rounded-3xl" />
      <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-surface-container-high rounded-xl" />)}</div>
      <div className="h-32 bg-surface-container-high rounded-2xl" />
    </div>
  )

  if (error || !ev) return (
    <div className="p-8 flex flex-col items-center justify-center min-h-64 gap-4">
      <span className="material-symbols-outlined text-5xl text-error opacity-50">error</span>
      <p className="text-on-surface-variant font-semibold">{error || 'Evaluación no encontrada'}</p>
      <div className="flex gap-3">
        <button onClick={retry} className="btn-primary px-6 py-2">Reintentar</button>
        <button onClick={() => navigate('/catalogo')} className="px-6 py-2 rounded-full border border-outline-variant text-sm font-semibold">Volver</button>
      </div>
    </div>
  )

  const catNombre  = ev.categories?.name ?? 'General'
  const icono      = ICONOS[catNombre] || 'quiz'
  const colorGrad  = GRADIENTES[catNombre] || 'from-primary to-primary-container'
  const durMax     = niveles.length ? formatTiempo(Math.max(...niveles.map(l => l.time_limit ?? 0))) : '—'
  const aprobMax   = niveles.length ? `${Math.max(...niveles.map(l => l.passing_score ?? 0))}%` : '—'

  // ── Cards de modo (compartidas desktop sidebar + mobile) ─────────────────────

  const ModeCards = () => (
    <div className="space-y-3">
      {tienePlan ? (
        <>
          {/* Práctica */}
          <button onClick={() => abrirModal('practica')} disabled={pregsNivel === 0}
            className="w-full group text-left p-4 rounded-2xl border-2 border-secondary/20 bg-white hover:border-secondary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-white text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-secondary text-sm">Modo Práctica</p>
                <p className="text-xs text-on-surface-variant">Con retro · Timer config. · Flexible</p>
              </div>
              <span className="material-symbols-outlined text-secondary/40 group-hover:text-secondary transition-colors">arrow_forward</span>
            </div>
            {pregsNivel > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Hasta {pregsNivel} pregs.</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Retroalimentación</span>
              </div>
            )}
          </button>

          {/* Examen */}
          <button onClick={() => abrirModal('examen')} disabled={pregsNivel === 0}
            className="w-full group text-left p-4 rounded-2xl border-2 border-primary/20 bg-white hover:border-primary hover:shadow-md active:scale-[0.99] transition-all disabled:opacity-50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-white text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-primary text-sm">Modo Examen</p>
                <p className="text-xs text-on-surface-variant">Sin ayudas · Condiciones reales</p>
              </div>
              <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors">arrow_forward</span>
            </div>
            {pregsNivel > 0 && nivelActual && (
              <div className="flex gap-1.5 flex-wrap">
                {nivelActual.time_limit > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{formatTiempo(nivelActual.time_limit)}</span>}
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Aprobación {nivelActual.passing_score ?? 70}%</span>
              </div>
            )}
          </button>

          {/* Sala en línea */}
          <button onClick={irASala}
            className="w-full group text-left p-4 rounded-2xl border-2 border-tertiary/20 bg-white hover:border-tertiary hover:shadow-md active:scale-[0.99] transition-all">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-white text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-tertiary text-sm">Sala en línea</p>
                <p className="text-xs text-on-surface-variant">Compite · Código de sala · Ranking en vivo</p>
              </div>
              <span className="material-symbols-outlined text-tertiary/40 group-hover:text-tertiary transition-colors">arrow_forward</span>
            </div>
          </button>

          {pregsNivel === 0 && (
            <p className="text-xs text-on-surface-variant text-center pt-1 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              Este nivel aún no tiene preguntas
            </p>
          )}

          {/* Simulacro IA */}
          {hasAiChat && (
            <button onClick={() => { if (!user) { navigate('/login'); return } setModalIA(true) }}
              className="w-full group text-left p-4 rounded-2xl border-2 border-slate-700/20 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 active:scale-[0.99] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-white text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-white text-sm">Simulacro personalizado IA</p>
                  <p className="text-white/60 text-xs">Generado para tu OPEC · Praxia IA</p>
                </div>
                <span className="material-symbols-outlined text-white/40 group-hover:text-white transition-colors">arrow_forward</span>
              </div>
            </button>
          )}
        </>
      ) : (
        <div className={`bg-gradient-to-br ${colorGrad} rounded-2xl p-6 text-center`}>
          <span className="material-symbols-outlined text-white/70 text-4xl mb-3 block"
            style={{ fontVariationSettings: "'FILL' 1" }}>lock_open</span>
          <p className="font-extrabold text-white text-lg mb-1">¿Listo para prepararte?</p>
          <p className="text-white/70 text-sm mb-4">Adquiere el paquete para acceder a todos los modos de práctica</p>
          <button onClick={() => navigate('/planes')}
            className="w-full py-3 bg-white text-primary font-extrabold rounded-full hover:shadow-lg transition-all active:scale-95 text-sm">
            Ver planes y precios →
          </button>
        </div>
      )}
    </div>
  )

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 pb-28 animate-fade-in">
      {/* Volver */}
      <button onClick={() => navigate('/catalogo')}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm font-semibold mb-5 transition-colors group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Volver al catálogo
      </button>

      {/* ── GRID PRINCIPAL ─────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-3 lg:gap-8 lg:items-start">

        {/* ═══════════════════ COLUMNA PRINCIPAL ═══════════════════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Hero */}
          <div className={`bg-gradient-to-br ${colorGrad} rounded-3xl p-6 md:p-8 text-white relative overflow-hidden`}>
            <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-14 -translate-x-14 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white text-3xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>{icono}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/15 text-white/90 px-3 py-0.5 rounded-full">
                      {catNombre}
                    </span>
                    {tienePlan && (
                      <span className="flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        Activo
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl md:text-3xl font-extrabold leading-tight">{ev.title}</h1>
                </div>
              </div>
              <p className="text-white/75 text-sm leading-relaxed line-clamp-2">
                {ev.description || 'Simulacro oficial con preguntas actualizadas y diseñado para prepararte en condiciones reales.'}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { val: totalPregs || '—', label: 'Preguntas', icon: 'quiz',         color: 'text-primary',   bg: 'bg-primary/10' },
              { val: durMax,            label: 'Duración',  icon: 'timer',         color: 'text-tertiary',  bg: 'bg-tertiary/10' },
              { val: niveles.length,    label: 'Niveles',   icon: 'layers',        color: 'text-secondary', bg: 'bg-secondary/10' },
              { val: aprobMax,          label: 'Aprobación',icon: 'verified',      color: 'text-on-surface',bg: 'bg-surface-container' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 text-center border border-slate-200 shadow-sm">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2`}>
                  <span className={`material-symbols-outlined text-lg ${s.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                </div>
                <span className={`text-xl font-extrabold block ${s.color}`}>{s.val}</span>
                <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Historial */}
          {user && totalIntentos > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="font-bold text-sm mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">history</span>
                Tu historial
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { val: totalIntentos,  label: 'Intentos',    color: 'text-primary' },
                  { val: nivCompletados, label: 'Completados', color: 'text-secondary' },
                  { val: `${mejorScore}%`, label: 'Mejor score', color: mejorScore >= 70 ? 'text-secondary' : 'text-error' },
                ].map(s => (
                  <div key={s.label}>
                    <p className={`text-2xl font-extrabold ${s.color}`}>{s.val}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selector de nivel */}
          {niveles.length > 1 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-sm font-bold text-on-surface-variant mb-3">Selecciona el nivel</p>
              <div className="flex flex-wrap gap-2">
                {niveles.map(nv => {
                  const sel        = nivelActual?.id === nv.id
                  const completado = intentosPorNivel[nv.id]?.status === 'completed'
                  return (
                    <button key={nv.id} onClick={() => setNivelSeleccionado(nv)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all border-2 ${sel ? 'border-primary bg-primary text-white shadow-md' : 'border-slate-200 text-on-surface-variant hover:border-primary/50 bg-white'}`}>
                      {completado && (
                        <span className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      )}
                      {nv.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Info del nivel seleccionado */}
          {nivelActual && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-start justify-between mb-3 gap-3">
                <div>
                  <h3 className="font-extrabold text-lg">{nivelActual.name}</h3>
                  {nivelActual.description && (
                    <p className="text-on-surface-variant text-sm mt-0.5 leading-relaxed">{nivelActual.description}</p>
                  )}
                </div>
                {intentoActual && (
                  <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full shrink-0 ${intentoActual.score >= (nivelActual.passing_score || 70) ? 'bg-secondary-container text-secondary' : 'bg-error-container text-error'}`}>
                    Último: {intentoActual.score ?? '—'}% · {tiempoRelativo(intentoActual.start_time)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs font-semibold text-on-surface-variant pt-3 border-t border-slate-100">
                {pregsNivel > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">quiz</span>
                    {pregsNivel} preguntas
                  </span>
                )}
                {nivelActual.time_limit > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-tertiary">timer</span>
                    {formatTiempo(nivelActual.time_limit)}
                  </span>
                )}
                {nivelActual.passing_score > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-secondary">verified</span>
                    Aprobación {nivelActual.passing_score}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
            {[
              { key: 'simulacro', icon: 'quiz',      label: 'Simulacros' },
              { key: 'material',  icon: 'menu_book', label: 'Material de Estudio' },
            ].map(t => (
              <button key={t.key} onClick={() => setTabActiva(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all
                  ${tabActiva === t.key ? 'bg-white shadow-sm text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
                <span className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: tabActiva === t.key ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Contenido del tab */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm min-h-32">
            {tabActiva === 'material' ? (
              <TabMaterial packageId={packageId} tienePlan={tienePlan} />
            ) : (
              <div>
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                  Selecciona tu modo de práctica
                </p>
                {/* Modo cards en MOBILE (ocultas en desktop donde van al sidebar) */}
                <div className="lg:hidden">
                  <ModeCards />
                </div>
                {/* En desktop, el sidebar tiene los mode cards. Aquí mostramos un recordatorio */}
                <div className="hidden lg:flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <span className="material-symbols-outlined text-primary text-xl">arrow_circle_right</span>
                  <p className="text-sm text-primary font-semibold">
                    Selecciona un modo en el panel derecho para comenzar tu práctica.
                  </p>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ═══════════════════ SIDEBAR DESKTOP ═══════════════════ */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-4">

            {/* Modo de práctica */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
              <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                Selecciona tu modo
              </p>
              <ModeCards />
            </div>

            {/* IA Praxia */}
            <IAPraxia
              evaluacionNombre={ev?.title}
              tienePlan={tienePlan && hasAiChat}
            />

            {/* Estadísticas rápidas del nivel */}
            {nivelActual && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
                  Nivel activo
                </p>
                <p className="font-extrabold text-base mb-3">{nivelActual.name}</p>
                <div className="space-y-2.5">
                  {[
                    { label: 'Preguntas', val: pregsNivel || '—', icon: 'quiz',     color: 'text-primary' },
                    { label: 'Duración',  val: formatTiempo(nivelActual.time_limit), icon: 'timer',    color: 'text-tertiary' },
                    { label: 'Aprobación',val: `${nivelActual.passing_score ?? 70}%`, icon: 'verified', color: 'text-secondary' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                        <span className={`material-symbols-outlined text-sm ${s.color}`}>{s.icon}</span>
                        {s.label}
                      </span>
                      <span className={`text-xs font-bold ${s.color}`}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>{/* /grid */}

      {/* ── MODALES ──────────────────────────────────────────────────────────── */}

      {/* Modal Práctica */}
      {modalModo === 'practica' && !modalConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 animate-fade-in max-h-[92vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              </div>
              <div>
                <h3 className="font-extrabold text-xl">Modo Práctica</h3>
                <p className="text-xs text-on-surface-variant">Configura tu sesión de estudio</p>
              </div>
            </div>

            <div className="space-y-5 mb-6">

              {/* Cantidad */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">format_list_numbered</span>
                  Cantidad de preguntas
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[10, 20, 30, 50].filter(n => n <= pregsNivel).map(n => (
                    <button key={n} type="button"
                      onClick={() => setConfigPractica(c => ({ ...c, cantidad: n, cantidad_custom: '', tipo_cantidad: 'preset' }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configPractica.tipo_cantidad === 'preset' && configPractica.cantidad === n ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-slate-200 text-on-surface-variant hover:border-secondary/50'}`}>
                      {n}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => setConfigPractica(c => ({ ...c, tipo_cantidad: 'all', cantidad_custom: '' }))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configPractica.tipo_cantidad === 'all' ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-slate-200 text-on-surface-variant hover:border-secondary/50'}`}>
                    Todas ({pregsNivel})
                  </button>
                </div>
                <input type="number" min={1} max={pregsNivel}
                  value={configPractica.cantidad_custom}
                  onChange={e => setConfigPractica(c => ({ ...c, cantidad_custom: e.target.value, tipo_cantidad: 'custom' }))}
                  placeholder={`Personalizado (máx. ${pregsNivel})`}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 text-sm font-medium focus:outline-none transition-all ${configPractica.tipo_cantidad === 'custom' ? 'border-secondary ring-2 ring-secondary/20' : 'border-slate-200 focus:border-secondary'}`} />
              </div>

              {/* Orden */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">shuffle</span>
                  Orden
                </label>
                <Segmented color="secondary"
                  options={[{ v: 'aleatorio', l: 'Aleatorio', icon: 'shuffle' }, { v: 'original', l: 'Original', icon: 'format_list_numbered' }]}
                  value={configPractica.orden}
                  onChange={v => setConfigPractica(c => ({ ...c, orden: v }))} />
              </div>

              {/* Timer */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">timer</span>
                  Tiempo por pregunta
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { v: 0, l: 'Sin límite' },
                    { v: 60, l: '1 min' },
                    { v: 90, l: '1:30' },
                    { v: 120, l: '2 min' },
                    { v: 180, l: '3 min' },
                  ].map(o => (
                    <button key={o.v} type="button"
                      onClick={() => setConfigPractica(c => ({ ...c, timer_pregunta: o.v }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configPractica.timer_pregunta === o.v ? 'border-secondary bg-secondary-container/30 text-secondary' : 'border-slate-200 text-on-surface-variant hover:border-secondary/50'}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Retroalimentación */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  Retroalimentación
                </label>
                <Segmented color="secondary"
                  options={[{ v: true, l: 'Con retro', icon: 'check_circle' }, { v: false, l: 'Sin retro', icon: 'cancel' }]}
                  value={configPractica.con_retro}
                  onChange={v => setConfigPractica(c => ({ ...c, con_retro: v }))} />
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-secondary-container/20 border border-secondary/15 rounded-2xl p-4 mb-5">
              <p className="text-xs font-bold uppercase tracking-widest text-secondary mb-3">Resumen de tu sesión</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  { l: 'Preguntas', v: cantPractica || '—' },
                  { l: 'Orden', v: configPractica.orden === 'aleatorio' ? 'Aleatorio' : 'Original' },
                  { l: 'Timer', v: configPractica.timer_pregunta === 0 ? 'Sin límite' : `${configPractica.timer_pregunta}s / preg.` },
                  { l: 'Retro', v: configPractica.con_retro ? '✔ Incluida' : '✖ Sin retro' },
                  { l: 'Tiempo estimado', v: configPractica.timer_pregunta === 0 ? 'Libre' : cantPractica ? `~${Math.ceil(cantPractica * configPractica.timer_pregunta / 60)} min` : '—' },
                ].map(r => (
                  <div key={r.l} className="flex justify-between col-span-1 md:col-span-1">
                    <span className="text-on-surface-variant text-xs">{r.l}</span>
                    <span className="font-bold text-xs text-on-surface">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalModo(null)}
                className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all">
                Cancelar
              </button>
              <button onClick={() => setModalConfirm(true)}
                className="flex-1 py-3 rounded-full bg-secondary text-white font-bold text-sm active:scale-95 transition-all">
                Continuar →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Examen */}
      {modalModo === 'examen' && !modalConfirm && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 animate-fade-in max-h-[92vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
              </div>
              <div>
                <h3 className="font-extrabold text-xl">Modo Examen</h3>
                <p className="text-xs text-on-surface-variant">Condiciones reales de evaluación</p>
              </div>
            </div>

            <div className="space-y-5 mb-6">
              {/* Cantidad */}
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">format_list_numbered</span>
                  Cantidad de preguntas
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[50, 100, 150, 200].filter(n => n <= pregsNivel).map(n => (
                    <button key={n} type="button"
                      onClick={() => setConfigExamen(c => ({ ...c, cantidad: n, cantidad_custom: '', tipo_cantidad: 'preset' }))}
                      className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configExamen.tipo_cantidad === 'preset' && configExamen.cantidad === n ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-on-surface-variant hover:border-primary/50'}`}>
                      {n}
                    </button>
                  ))}
                  <button type="button"
                    onClick={() => setConfigExamen(c => ({ ...c, tipo_cantidad: 'all', cantidad_custom: '' }))}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${configExamen.tipo_cantidad === 'all' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-on-surface-variant hover:border-primary/50'}`}>
                    Completo ({pregsNivel})
                  </button>
                </div>
                <input type="number" min={1} max={pregsNivel}
                  value={configExamen.cantidad_custom}
                  onChange={e => setConfigExamen(c => ({ ...c, cantidad_custom: e.target.value, tipo_cantidad: 'custom' }))}
                  placeholder={`Personalizado (máx. ${pregsNivel})`}
                  className={`w-full px-4 py-2.5 rounded-xl bg-slate-50 border-2 text-sm font-medium focus:outline-none transition-all ${configExamen.tipo_cantidad === 'custom' ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 focus:border-primary'}`} />
              </div>
            </div>

            {/* Condiciones */}
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Condiciones del examen</p>
              <div className="space-y-2 text-sm">
                {[
                  { l: 'Preguntas', v: cantExamen || '—', ok: true },
                  { l: 'Duración total', v: formatTiempo(nivelActual?.time_limit), ok: true },
                  { l: 'Aprobación', v: `${nivelActual?.passing_score ?? 70}%`, ok: true },
                  { l: 'Retroalimentación', v: 'No disponible', ok: false },
                  { l: 'Cambiar respuesta', v: 'No permitido', ok: false },
                ].map(r => (
                  <div key={r.l} className="flex justify-between">
                    <span className="text-on-surface-variant text-xs">{r.l}</span>
                    <span className={`font-bold text-xs ${r.ok ? 'text-on-surface' : 'text-error'}`}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-600 text-sm shrink-0 mt-0.5">warning</span>
              <p className="text-xs text-amber-800 font-medium">
                Una vez iniciado no podrás ver las respuestas correctas hasta terminar.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalModo(null)}
                className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all">
                Cancelar
              </button>
              <button onClick={() => setModalConfirm(true)}
                className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-all">
                Iniciar examen →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación final */}
      {modalConfirm && (
        <div className="fixed inset-0 z-[110] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm p-7 animate-fade-in text-center shadow-2xl">
            <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${modalModo === 'practica' ? 'bg-secondary' : 'bg-primary'}`}>
              <span className="material-symbols-outlined text-white text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>
                {modalModo === 'practica' ? 'school' : 'timer'}
              </span>
            </div>
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full mb-3 ${modalModo === 'practica' ? 'bg-secondary-container text-secondary' : 'bg-primary-container text-primary'}`}>
              {modalModo === 'practica' ? 'Modo Práctica' : 'Modo Examen'}
            </span>
            <h3 className="font-extrabold text-2xl mb-1">¿Listo?</h3>
            <p className="text-on-surface-variant text-sm mb-5 font-semibold">{nivelActual?.name}</p>

            <div className={`rounded-2xl p-4 mb-6 text-left space-y-2.5 border ${modalModo === 'practica' ? 'bg-secondary-container/15 border-secondary/20' : 'bg-primary-container/15 border-primary/20'}`}>
              {modalModo === 'practica' ? (
                <>
                  <Row l="Preguntas" v={cantPractica} />
                  <Row l="Orden" v={configPractica.orden === 'aleatorio' ? 'Aleatorio' : 'Original'} />
                  <Row l="Retro" v={configPractica.con_retro ? '✔ Incluida' : '✖ Sin retro'} />
                  <Row l="Timer" v={configPractica.timer_pregunta === 0 ? 'Sin límite' : `${configPractica.timer_pregunta}s / preg.`} />
                </>
              ) : (
                <>
                  <Row l="Preguntas" v={cantExamen} />
                  <Row l="Duración" v={formatTiempo(nivelActual?.time_limit)} />
                  <Row l="Aprobación" v={`${nivelActual?.passing_score ?? 70}%`} />
                  <Row l="Retroalimentación" v="✖ No disponible" />
                </>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalConfirm(false)}
                className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all">
                Volver
              </button>
              <button onClick={confirmarInicio}
                className={`flex-1 py-3 rounded-full font-bold text-sm text-white active:scale-95 transition-all flex items-center justify-center gap-2 ${modalModo === 'practica' ? 'bg-secondary' : 'bg-primary'}`}>
                <span className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                ¡Empezar!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Simulacro IA ──────────────────────────────────────────────── */}
      {modalIA && (
        <div className="fixed inset-0 z-[120] bg-black/70 flex items-end md:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => { if (!generandoIA) setModalIA(false) }}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div>
                <h3 className="font-extrabold text-xl">Simulacro IA</h3>
                <p className="text-xs text-on-surface-variant">Generado por Praxia · máx. 3 por día</p>
              </div>
            </div>

            {/* Campo cargo */}
            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                Nombre del OPEC / Cargo
              </label>
              <input
                type="text"
                value={cargo}
                onChange={e => { setCargo(e.target.value); setErrorIA(null) }}
                onKeyDown={e => e.key === 'Enter' && lanzarSimulacroIA()}
                placeholder="ej: Profesional Universitario Grado 11 DIAN"
                disabled={generandoIA}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
                autoFocus
              />
              <p className="text-[10px] text-on-surface-variant mt-1.5">
                Escribe el cargo exacto de la convocatoria para mejores resultados.
              </p>
            </div>

            {/* Selector modelo */}
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <ModelSelector value={modeloIA} onChange={setModeloIA} />
            </div>

            {/* PDF opcional */}
            <div className="mb-5">
              <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                Material de estudio (opcional)
              </label>
              <label className={`flex items-center gap-3 p-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                ${pdfIA ? 'border-primary/40 bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-slate-50'} ${generandoIA ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <span className="material-symbols-outlined text-xl text-on-surface-variant"
                  style={{ fontVariationSettings: pdfIA ? "'FILL' 1" : "'FILL' 0" }}>
                  {pdfIA ? 'picture_as_pdf' : 'upload_file'}
                </span>
                <span className="text-sm text-on-surface-variant truncate flex-1">
                  {pdfIA ? pdfIA.name : 'Subir PDF (temario, normas, convocatoria…)'}
                </span>
                {pdfIA && (
                  <button type="button" onClick={e => { e.preventDefault(); setPdfIA(null) }}
                    className="text-error text-xs font-bold shrink-0">
                    Quitar
                  </button>
                )}
                <input type="file" accept=".pdf" className="hidden" disabled={generandoIA}
                  onChange={e => setPdfIA(e.target.files?.[0] || null)} />
              </label>
            </div>

            {/* Error */}
            {errorIA && (
              <div className="flex items-center gap-2 text-error text-xs bg-error-container/30 px-3 py-2 rounded-xl mb-4">
                <span className="material-symbols-outlined text-sm">error</span>
                {errorIA}
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-3">
              <button onClick={() => setModalIA(false)} disabled={generandoIA}
                className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all disabled:opacity-40">
                Cancelar
              </button>
              <button onClick={lanzarSimulacroIA} disabled={generandoIA || !cargo.trim()}
                className="flex-1 py-3 rounded-full bg-slate-900 text-white font-bold text-sm active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                {generandoIA ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generando…</>
                ) : (
                  <><span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>Generar</>
                )}
              </button>
            </div>

            {generandoIA && (
              <p className="text-center text-xs text-on-surface-variant mt-3 animate-pulse">
                Praxia está generando tu simulacro personalizado…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Helper fila de resumen
function Row({ l, v }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-on-surface-variant">{l}</span>
      <span className="font-bold text-on-surface">{v}</span>
    </div>
  )
}
