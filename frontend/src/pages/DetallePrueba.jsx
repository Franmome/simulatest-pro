import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { useFetch } from '../hooks/useFetch'
import IAPraxia, { ModelSelector } from '../components/IAPraxia'
import { generarSimulacroPersonal, verificarOpec, generarModoPractica } from '../utils/gemini'

const toStr = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return v.texto || v.text || v.descripcion || v.nombre || v.name || JSON.stringify(v)
  return String(v)
}

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

// ── Tab Simulacros IA ─────────────────────────────────────────────────────────

const LABEL_DIF = { mixta: 'Mixta', facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' }
const TIPS_CARGA = [
  { icon: 'library_books', texto: 'Cada pregunta cita el artículo o norma exacta que respalda la respuesta correcta.' },
  { icon: 'account_balance', texto: 'Las preguntas siguen el Manual de Funciones real del cargo en el sector público colombiano.' },
  { icon: 'groups', texto: 'El 65% de las preguntas son funcionales, enfocadas en el área técnica específica del cargo.' },
  { icon: 'verified', texto: 'Los distractores se construyen igual que en el examen real: plausibles, nunca obviamente erróneos.' },
  { icon: 'psychology', texto: 'Praxia aplica criterios psicométricos certificados para que cada pregunta sea clara y sin ambigüedades.' },
]
const MODULOS_OPEC = [
  { label: 'Funcionales',      pct: 70 },
  { label: 'Comportamentales', pct: 30 },
]

function TabSimulacrosIA({ evaluacionId, userId, recargar, generandoEnFondo = false, progFondo = 0, msgFondo = '', cargoFondo = '', onGenerarPractica, generandoPractica = false, errorPractica = '' }) {
  const navigate = useNavigate()
  const [sims,             setSims]             = useState([])
  const [loading,          setLoading]          = useState(true)
  const [simToStart,       setSimToStart]       = useState(null)
  const [showPersonalizar, setShowPersonalizar] = useState(false)
  const [preStartConfig,   setPreStartConfig]   = useState({ cantidad: 0, tiempo: 0 })
  const [ultimoAnalisis,   setUltimoAnalisis]   = useState(null)

  useEffect(() => {
    if (!userId || !evaluacionId) { setLoading(false); return }
    setLoading(true)
    supabase.from('user_simulacros')
      .select('id, cargo, cantidad_preguntas, dificultad_config, score_pct, completado, created_at, tiempo_por_pregunta')
      .eq('evaluacion_id', evaluacionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setSims(data || [])
        setLoading(false)
        const ultimoCompletado = (data || []).find(s => s.completado && s.dificultad_config !== 'practica')
        if (ultimoCompletado) {
          supabase.from('user_simulacro_analisis')
            .select('id, cargo, score_pct, score_correctas, score_total, analisis, created_at, simulacro_id')
            .eq('simulacro_id', ultimoCompletado.id)
            .eq('user_id', userId)
            .maybeSingle()
            .then(({ data: an }) => setUltimoAnalisis(an || null))
        } else {
          setUltimoAnalisis(null)
        }
      })
  }, [evaluacionId, userId, recargar])

  const abrirPreStart = useCallback((s) => {
    setSimToStart(s)
    setShowPersonalizar(false)
    setPreStartConfig({ cantidad: s.cantidad_preguntas || 0, tiempo: s.tiempo_por_pregunta || 0 })
  }, [])

  const borrar = useCallback(async (e, simId) => {
    e.stopPropagation()
    if (!window.confirm('¿Borrar esta prueba Praxia? No se puede deshacer.')) return
    await supabase.from('user_simulacros').delete().eq('id', simId)
    setSims(prev => prev.filter(s => s.id !== simId))
  }, [])

  const iniciar = () => {
    navigate(`/simulacro-ia/${simToStart.id}`, { state: { preStartConfig } })
    setSimToStart(null)
  }

  if (loading) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!sims.length && !generandoEnFondo) return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <span className="material-symbols-outlined text-slate-300 text-5xl"
        style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
      <p className="font-bold text-sm text-on-surface">Sin pruebas Praxia aún</p>
      <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">
        Usa el botón "Prueba personalizada Praxia" para crear tu primera prueba adaptada a tu cargo OPEC.
      </p>
    </div>
  )

  const total = simToStart?.cantidad_preguntas || 0
  const cuartos = total > 0
    ? [...new Set([Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total])].filter(n => n > 0)
    : []

  return (
    <>
      {/* ── Tarjeta generación en curso ── */}
      {generandoEnFondo && (
        <div className="relative mb-3 rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 shadow-lg">
          {/* Barra de progreso superior */}
          <div className="h-1 bg-white/10 w-full">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${progFondo}%` }}
            />
          </div>

          <div className="flex items-center gap-4 px-4 py-3.5">
            {/* Ícono animado */}
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-emerald-400 text-xl"
                style={{ fontVariationSettings: "'FILL' 1", animation: 'spin 2s linear infinite' }}
              >auto_awesome</span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white truncate">
                {cargoFondo || 'Praxia generando tu prueba…'}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-white/60 truncate max-w-[80%]">
                  {msgFondo || 'Procesando…'}
                </p>
                <span className="text-[11px] font-extrabold text-emerald-400 tabular-nums shrink-0 ml-2">
                  {progFondo}%
                </span>
              </div>
            </div>
          </div>

          {/* Shimmer animado de fondo */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
              animation: 'shimmer 2s infinite',
              backgroundSize: '200% 100%',
            }}
          />
        </div>
      )}

      {/* ── Tarjeta última prueba con análisis IA ── */}
      {ultimoAnalisis && (() => {
        const an = ultimoAnalisis.analisis || {}
        const ok = ultimoAnalisis.score_pct >= 70
        return (
          <div className="mb-4 rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
            {/* Barra de color superior */}
            <div className={`h-1 w-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />

            <div className="p-4">
              {/* Fila superior: cargo + score + fecha */}
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
                  <span className={`text-2xl font-extrabold tabular-nums leading-none ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                    {Math.round(ultimoAnalisis.score_pct)}
                    <span className="text-xs font-bold">%</span>
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-sm truncate leading-tight">{ultimoAnalisis.cargo || 'Prueba Praxia'}</p>
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    {ultimoAnalisis.score_correctas}/{ultimoAnalisis.score_total} correctas
                    {an.nivel_preparacion && (
                      <span className="ml-2 font-bold text-primary">{toStr(an.nivel_preparacion)}</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] text-on-surface-variant shrink-0">{tiempoRelativo(ultimoAnalisis.created_at)}</span>
              </div>

              {/* Patrón de error */}
              {an.patron_error && (
                <div className="mt-3 flex items-start gap-2">
                  <span className="material-symbols-outlined text-amber-500 text-base shrink-0 mt-0.5"
                    style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                  <p className="text-[11px] text-on-surface leading-relaxed line-clamp-2">{toStr(an.patron_error)}</p>
                </div>
              )}

              {/* Áreas a mejorar */}
              {an.areas_mejora?.length > 0 && (
                <div className="mt-2.5">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-on-surface-variant mb-1.5">Enfocarte en</p>
                  <div className="flex flex-wrap gap-1">
                    {an.areas_mejora.slice(0, 3).map((a, i) => (
                      <span key={i} className="text-[10px] bg-red-50 border border-red-100 text-red-600 font-semibold px-2.5 py-0.5 rounded-full">
                        {toStr(a)}
                      </span>
                    ))}
                    {an.areas_mejora.length > 3 && (
                      <span className="text-[10px] text-on-surface-variant font-semibold px-1 py-0.5">
                        +{an.areas_mejora.length - 3} más
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Fortalezas */}
              {an.fortalezas?.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {an.fortalezas.slice(0, 2).map((f, i) => (
                      <span key={i} className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full">
                        {toStr(f)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones */}
              <div className="mt-3 flex gap-2">
                {onGenerarPractica && (
                  <button
                    onClick={onGenerarPractica}
                    disabled={generandoPractica}
                    className="flex-1 py-2.5 bg-secondary text-white rounded-xl text-xs font-bold hover:bg-secondary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    {generandoPractica ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Generando...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
                        Generar Práctica
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => enviarAnalisisCuaderno(ultimoAnalisis)}
                  className="px-3 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-bold hover:bg-violet-700 transition-colors flex items-center gap-1 active:scale-95"
                  title="Enviar análisis al Cuaderno IA"
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                  Cuaderno
                </button>
                <button
                  onClick={() => navigate('/registros')}
                  className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-on-surface-variant hover:border-primary hover:text-primary transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">history_edu</span>
                  Ver todo
                </button>
              </div>
              {errorPractica && (
                <p className="text-[10px] text-red-600 font-semibold mt-1.5 text-center">{errorPractica}</p>
              )}
            </div>
          </div>
        )
      })()}

      <div className="space-y-3">
        {sims.map(s => (
          <div key={s.id}
            className="group relative flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 hover:bg-white transition-all duration-300 cursor-pointer"
            onClick={() => abrirPreStart(s)}>

            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-white text-lg"
                style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                {s.cargo || 'Prueba Praxia'}
              </p>
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span className="text-[10px] font-semibold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-full">
                  {s.cantidad_preguntas || '—'} pregs
                </span>
                <span className="text-[10px] font-semibold bg-slate-200/70 text-slate-600 px-2 py-0.5 rounded-full">
                  {LABEL_DIF[s.dificultad_config] || 'Mixta'}
                </span>
                {s.completado && s.score_pct !== null && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.score_pct >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    {Math.round(s.score_pct)}%
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <button
                onClick={e => borrar(e, s.id)}
                title="Borrar simulacro"
                className="w-7 h-7 rounded-xl bg-rose-50 hover:bg-rose-100 flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined text-rose-400" style={{ fontSize: '16px' }}>delete</span>
              </button>
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                ${s.completado
                  ? 'bg-slate-200 text-slate-700 group-hover:bg-primary group-hover:text-white'
                  : 'bg-primary text-white group-hover:bg-primary/90'}`}>
                {s.completado ? 'Repetir' : 'Iniciar'}
              </span>
              <span className="text-[9px] text-on-surface-variant">{tiempoRelativo(s.created_at)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal pre-inicio ── */}
      {simToStart && (
        <div className="fixed inset-0 z-[200] bg-black/65 flex items-end md:items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setSimToStart(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in"
            onClick={e => e.stopPropagation()}>

            {/* Cabecera oscura */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-widest opacity-50 mb-0.5">Prueba Praxia · OPEC</p>
                  <h3 className="font-extrabold text-base leading-snug">{simToStart.cargo || 'Prueba Praxia'}</h3>
                </div>
                <button onClick={() => setSimToStart(null)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors shrink-0">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { val: preStartConfig.cantidad || simToStart.cantidad_preguntas || '—', sub: 'Preguntas' },
                  { val: LABEL_DIF[simToStart.dificultad_config] || 'Mixta', sub: 'Dificultad' },
                  { val: preStartConfig.tiempo === 0 ? '∞' : `${preStartConfig.tiempo}s`, sub: 'Por preg.' },
                ].map(s => (
                  <div key={s.sub} className="bg-white/10 rounded-xl p-3 text-center">
                    <p className="font-black text-lg leading-none mb-1">{s.val}</p>
                    <p className="text-[9px] opacity-50 uppercase tracking-widest">{s.sub}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-1.5 flex-wrap">
                {MODULOS_OPEC.map(m => (
                  <span key={m.label} className="bg-white/10 text-white/70 text-[9px] font-bold px-2 py-0.5 rounded-full">
                    {m.label} {m.pct}%
                  </span>
                ))}
              </div>

              {simToStart.completado && simToStart.score_pct !== null && (
                <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
                  <span className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {simToStart.score_pct >= 70 ? 'emoji_events' : 'replay'}
                  </span>
                  <span className="text-xs font-bold">Último: {Math.round(simToStart.score_pct)}%</span>
                  <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${simToStart.score_pct >= 70 ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'}`}>
                    {simToStart.score_pct >= 70 ? 'Aprobado' : 'No aprobado'}
                  </span>
                </div>
              )}
            </div>

            {/* Cuerpo */}
            <div className="p-5">
              <button onClick={() => setShowPersonalizar(v => !v)}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl border-2 border-slate-200 hover:border-primary/40 hover:bg-primary/5 transition-all mb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-primary"
                    style={{ fontVariationSettings: showPersonalizar ? "'FILL' 1" : "'FILL' 0" }}>tune</span>
                  <span className="text-xs font-bold text-on-surface">Personalizar esta sesión</span>
                </div>
                <span className={`text-[10px] font-bold ${showPersonalizar ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {showPersonalizar ? 'Activo ✓' : 'Opcional →'}
                </span>
              </button>

              {showPersonalizar && (
                <div className="mb-4 space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  {cuartos.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Preguntas a responder</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {cuartos.map(n => (
                          <button key={n} onClick={() => setPreStartConfig(c => ({ ...c, cantidad: n }))}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                              ${preStartConfig.cantidad === n ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-on-surface-variant hover:border-slate-500 bg-white'}`}>
                            {n}{n === total ? ' · todas' : ''}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Tiempo por pregunta</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {[{ v: 0, l: 'Sin límite' }, { v: 60, l: '1 min' }, { v: 90, l: '90 s' }, { v: 120, l: '2 min' }].map(t => (
                        <button key={t.v} onClick={() => setPreStartConfig(c => ({ ...c, tiempo: t.v }))}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                            ${preStartConfig.tiempo === t.v ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-300 text-on-surface-variant hover:border-slate-500 bg-white'}`}>
                          {t.l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setSimToStart(null)}
                  className="flex-1 py-3.5 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all text-on-surface-variant">
                  Cancelar
                </button>
                <button onClick={iniciar}
                  className="flex-[2] py-3.5 rounded-full bg-gradient-to-r from-primary via-primary to-tertiary text-white font-bold text-sm active:scale-95 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg group">
                  <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform duration-300"
                    style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                  Iniciar prueba
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Tab Material ──────────────────────────────────────────────────────────────

function TabMaterial({ packageId, tienePlan, evaluacionId, userId, convocatoriaId, convocatoriaNombre }) {
  const navigate = useNavigate()

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

  return (
    <div className="space-y-6">

      {/* ── Herramientas IA del paquete ── */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          Asistente Praxia
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Cuaderno Praxia */}
          <button
            onClick={() => navigate(`/cuaderno/${packageId}`)}
            className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white text-left hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-300 group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="material-symbols-outlined text-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
              <p className="font-bold text-sm">Cuaderno Praxia</p>
              <span className="material-symbols-outlined text-white/40 group-hover:text-white group-hover:translate-x-1 text-base ml-auto transition-all duration-300">arrow_forward</span>
            </div>
            <p className="text-white/70 text-xs group-hover:text-white/90 transition-colors duration-300">Chatea con Praxia · Guarda tus notas personales</p>
          </button>

          {/* Análisis de perfil vs convocatoria */}
          {convocatoriaId ? (
            <button
              onClick={() => navigate(`/analisis-perfil?conv=${convocatoriaId}`)}
              className="bg-primary/5 border-2 border-primary/20 hover:border-primary hover:bg-primary/10 rounded-xl p-4 text-left transition-all group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
                <p className="font-bold text-sm text-primary">Mi perfil vs cargos</p>
                <span className="material-symbols-outlined text-primary/40 group-hover:text-primary text-base ml-auto transition-colors">arrow_forward</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Praxia analiza qué cargos de {convocatoriaNombre || 'la convocatoria'} van con tu perfil
              </p>
            </button>
          ) : (
            <div className="bg-surface-container-high rounded-xl p-4 opacity-40 cursor-not-allowed select-none">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="material-symbols-outlined text-on-surface-variant text-lg">manage_accounts</span>
                <p className="font-bold text-sm text-on-surface-variant">Análisis de perfil</p>
              </div>
              <p className="text-xs text-on-surface-variant">Disponible en paquetes con convocatoria vinculada.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Archivos y recursos ── */}
      {loading && (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map(i => <div key={i} className="h-16 bg-surface-container-high rounded-2xl" />)}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="material-symbols-outlined text-error text-4xl">error</span>
          <p className="text-sm text-on-surface-variant">{error}</p>
          <button onClick={retry} className="text-primary text-sm font-bold underline">Reintentar</button>
        </div>
      )}

      {!loading && !error && materiales.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-center border-t border-slate-100 pt-6">
          <span className="material-symbols-outlined text-on-surface-variant text-4xl opacity-40">folder_open</span>
          <p className="font-semibold mt-2 text-sm">Sin archivos aún</p>
          <p className="text-on-surface-variant text-xs mt-1">El equipo está preparando el contenido. Pronto estará disponible.</p>
        </div>
      )}

      {!loading && !error && Object.keys(carpetas).length > 0 && (
        <div className="border-t border-slate-100 pt-5 space-y-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">folder</span>
            Archivos y recursos
          </p>
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
                    onClick={() => {
                      if (userId) supabase.from('user_material_views').insert({
                        user_id: userId, evaluacion_id: evaluacionId || null,
                        material_id: m.id, material_nombre: m.title, material_tipo: m.type || 'link',
                      }).then(() => {}).catch(() => {})
                    }}
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
      )}
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
  const { id: evalId, pkgId } = useParams()
  // pkgId = ruta /paquete/:pkgId (nuevo modelo, packageId como cabeza)
  // evalId = ruta /prueba/:id (legado)
  const id = pkgId || evalId
  const isPackageMode = !!pkgId
  const { user } = useAuth()
  const { addNotif, updateNotif } = useNotifications()

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
  const [modalIA,        setModalIA]        = useState(false)
  const [cargo,          setCargo]          = useState('')
  const [pdfIA,          setPdfIA]          = useState(null)
  const [generandoIA,    setGenerandoIA]    = useState(false)
  const [errorIA,        setErrorIA]        = useState(null)
  const [modeloIA,       setModeloIA]       = useState('gemini')
  const [configIA,       setConfigIA]       = useState({ cantidad: 160, tiempo: 0, dificultad: 'mixta' })
  const [simulacroCreado,setSimulacroCreado]= useState(null)
  const [loadingMsg,        setLoadingMsg]        = useState('')
  const [loadingProgress,   setLoadingProgress]   = useState(0)
  const [recargarSims,      setRecargarSims]      = useState(0)
  const [verificacion,      setVerificacion]      = useState(null)
  const [verificando,       setVerificando]       = useState(false)
  const [generandoEnFondo,  setGenerandoEnFondo]  = useState(false)
  const cargoFondoRef      = useRef('')
  const segundoPlanoNotifIdRef = useRef(null)

  // ── Modo Examen IA ──────────────────────────────────────────────────────────
  const [modalExamenIA,    setModalExamenIA]    = useState(false)
  const [simsExamen,       setSimsExamen]       = useState([])
  const [simSelExamen,     setSimSelExamen]     = useState(null)
  const [loadingSimsEx,    setLoadingSimsEx]    = useState(false)

  // ── Modo Práctica IA ────────────────────────────────────────────────────────
  const [modalCuaderno,     setModalCuaderno]     = useState(null) // null | { paquetes, enviando, enviado, analisis }
  const [practicaLista,     setPracticaLista]     = useState(null)
  const [generandoPractica, setGenerandoPractica] = useState(false)
  const [errorPractica,     setErrorPractica]     = useState('')
  const [showPracticaModal, setShowPracticaModal] = useState(false)
  const [practicaPreflight, setPracticaPreflight] = useState(null)
  const [loadingPreflight,  setLoadingPreflight]  = useState(false)
  const [practicaStep,      setPracticaStep]      = useState(0)
  const [practicaGenerada,  setPracticaGenerada]  = useState(null)   // { simulacro_id, total, areas_cubiertas }
  const [practicaCantidad,  setPracticaCantidad]  = useState(0)
  const [practicaTiempo,    setPracticaTiempo]    = useState(90)

  const PRACTICA_STEPS = [
    { icon: 'psychology',    text: 'Leyendo tu último simulacro…' },
    { icon: 'analytics',     text: 'Identificando tus áreas más débiles…' },
    { icon: 'build',         text: 'Armando los lotes de preguntas…' },
    { icon: 'auto_awesome',  text: 'Generando preguntas personalizadas…' },
    { icon: 'auto_awesome',  text: 'Generando más preguntas…' },
    { icon: 'fact_check',    text: 'Validando calidad de los ítems…' },
    { icon: 'save',          text: 'Guardando tu práctica…' },
  ]

  useEffect(() => {
    if (!generandoPractica) { setPracticaStep(0); return }
    const iv = setInterval(() => setPracticaStep(s => Math.min(s + 1, PRACTICA_STEPS.length - 1)), 3500)
    return () => clearInterval(iv)
  }, [generandoPractica]) // eslint-disable-line

  // Carga la práctica pre-generada (si existe) cuando vuelven a esta página
  useEffect(() => {
    if (!user?.id || !id) return
    supabase
      .from('user_simulacros')
      .select('id, cargo, cantidad_preguntas, created_at, simulacro_origen_id')
      .eq('evaluacion_id', parseInt(id))
      .eq('user_id', user.id)
      .eq('dificultad_config', 'practica')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setPracticaLista(data || null))
  }, [user?.id, id, recargarSims]) // eslint-disable-line

  useEffect(() => {
    if (!generandoIA) { setLoadingMsg(''); setLoadingProgress(0); return }

    const n          = configIA.cantidad
    const batches    = Math.ceil(n / 20)
    const waves      = Math.ceil(batches / 3)
    const expectedMs = (waves * 14 + 3) * 1000

    const funcBatches = Math.ceil(Math.round(n * 0.70) / 20)
    const funcWaves   = Math.ceil(funcBatches / 3)
    const stages = [
      'Verificando tu saldo y perfil…',
      ...Array.from({ length: funcWaves }, (_, i) =>
        `Generando preguntas funcionales — bloque ${i + 1}/${funcWaves}…`),
      'Generando preguntas comportamentales (Decreto 815)…',
      'Verificando calidad psicométrica de los ítems…',
      '¡Casi listo…',
    ]

    const startTime = Date.now()
    setLoadingMsg(stages[0])
    setLoadingProgress(3)

    const iv = setInterval(() => {
      const elapsed = Date.now() - startTime
      const pct = Math.min(95, Math.round((elapsed / expectedMs) * 91 + 4))
      setLoadingProgress(pct)
      const idx = Math.min(stages.length - 1, Math.floor((elapsed / expectedMs) * stages.length))
      setLoadingMsg(stages[idx])
    }, 250)

    return () => clearInterval(iv)
  }, [generandoIA]) // eslint-disable-line

  async function lanzarSimulacroIA() {
    if (!cargo.trim()) { setErrorIA('Escribe el nombre del OPEC o cargo.'); return }
    segundoPlanoNotifIdRef.current = null
    setGenerandoIA(true)
    setErrorIA(null)
    try {
      const { simulacro_id, total, proveedor_real } = await generarSimulacroPersonal({
        evaluacion_id:       id,
        cargo:               cargo.trim(),
        pdf:                 pdfIA || undefined,
        modelo:              modeloIA,
        cantidad:            configIA.cantidad,
        tiempo_por_pregunta: configIA.tiempo,
        dificultad_config:   configIA.dificultad,
      })
      if (proveedor_real && proveedor_real !== modeloIA) {
        const nombres = { deepseek: 'DeepSeek', gemini: 'Gemini' }
        addNotif({
          tipo:   'info',
          titulo: `${nombres[modeloIA] || modeloIA} no disponible`,
          cuerpo: `Se usó ${nombres[proveedor_real] || proveedor_real} automáticamente. Tu prueba quedó lista.`,
          icon:   'swap_horiz',
        })
      }
      setLoadingProgress(100)
      setRecargarSims(v => v + 1)
      if (segundoPlanoNotifIdRef.current) {
        updateNotif(segundoPlanoNotifIdRef.current, {
          tipo:  'completado',
          titulo: '¡Prueba lista!',
          cuerpo: cargo.trim(),
          icon:  'task_alt',
          leida: false,
          simulacro_id,
        })
        segundoPlanoNotifIdRef.current = null
      } else {
        setSimulacroCreado({
          simulacro_id,
          cargo:     cargo.trim(),
          cantidad:  total || configIA.cantidad,
          dificultad:configIA.dificultad,
          tiempo:    configIA.tiempo,
        })
      }
    } catch (e) {
      if (segundoPlanoNotifIdRef.current) {
        updateNotif(segundoPlanoNotifIdRef.current, {
          tipo:  'error',
          titulo: 'Error al generar prueba',
          cuerpo: e.message,
          icon:  'error',
          leida: false,
        })
        segundoPlanoNotifIdRef.current = null
      } else {
        setErrorIA(e.message)
      }
    } finally {
      setGenerandoIA(false)
      setGenerandoEnFondo(false)
    }
  }

  function ejecutarEnSegundoPlano() {
    const notifId = addNotif({
      tipo:   'generando',
      titulo: 'Praxia generando tu prueba…',
      cuerpo: `${cargo} · ${configIA.cantidad} preguntas`,
      icon:   'auto_awesome',
    })
    segundoPlanoNotifIdRef.current = notifId
    cargoFondoRef.current = cargo
    setGenerandoEnFondo(true)
    setModalIA(false)
  }

  async function buscarDatosOpec() {
    if (!cargo.trim() || verificando) return
    setVerificando(true)
    setVerificacion(null)
    try {
      const v = await verificarOpec({ cargo: cargo.trim() })
      setVerificacion(v)
      if (v?.total_preguntas) {
        setConfigIA(c => ({ ...c, cantidad: Math.min(v.total_preguntas, 250) }))
      }
    } catch { setVerificacion(null) }
    finally { setVerificando(false) }
  }

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const { data, loading, error, retry } = useFetch(async () => {
    const idNum = parseInt(id, 10)

    // ── Modo Paquete (cabeza) ────────────────────────────────────────────────
    if (isPackageMode) {
      const { data: pkgData, error: pkgErr } = await supabase
        .from('packages')
        .select('*')
        .eq('id', idNum).maybeSingle()
      if (pkgErr) throw new Error(`Error BD: ${pkgErr.message} (id=${idNum})`)
      if (!pkgData) throw new Error(`Paquete ${idNum} no existe o sin acceso`)

      // Construir "ev" virtual desde el paquete
      const evalData = {
        id:          pkgData.id,
        title:       pkgData.name || 'Paquete',
        description: pkgData.description || '',
        categories:  { id: null, name: 'General' },
      }

      let tienePlan = false, packageId = idNum, hasAiChat = pkgData.has_ai_chat ?? false
      let versionNombre = null, packageNombre = pkgData.name || null
      let packageExpiry = null, convocatoriaId = pkgData.convocatoria_id ?? null, convocatoriaNombre = null
      const iaStats = { total: 0, completados: 0, avgScore: null, bestScore: null, herramientas: [] }

      // Herramientas activas
      if (pkgData.herramientas) {
        const tools = Object.entries(pkgData.herramientas)
          .filter(([k, v]) => k !== 'paquete_completo' && v?.activo)
          .map(([k]) => k)
        iaStats.herramientas = tools
      }

      if (user?.id) {
        const esAdmin = user.role === 'admin'
        if (esAdmin) {
          tienePlan = true
          hasAiChat = true
        } else {
          // Verificar acceso: user_tool_purchases
          const { data: toolPur } = await supabase
            .from('user_tool_purchases')
            .select('end_date')
            .eq('user_id', user.id)
            .eq('package_id', idNum)
            .gte('end_date', new Date().toISOString())
            .order('end_date', { ascending: false })
            .limit(1).maybeSingle()
          if (toolPur) { tienePlan = true; packageExpiry = toolPur.end_date }

          // Fallback: purchases
          if (!tienePlan) {
            const { data: compra } = await supabase
              .from('purchases').select('end_date')
              .eq('user_id', user.id).eq('status', 'active').eq('package_id', idNum)
              .gte('end_date', new Date().toISOString())
              .order('end_date', { ascending: false }).limit(1).maybeSingle()
            if (compra) { tienePlan = true; packageExpiry = compra.end_date }
          }
        }

        // IA stats: simulacros del usuario para este paquete (evaluacion_id = packageId)
        const { data: simsIA } = await supabase
          .from('user_simulacros')
          .select('score_pct, completado, dificultad_config')
          .eq('evaluacion_id', idNum)
          .eq('user_id', user.id)
          .neq('dificultad_config', 'practica')
        if (simsIA?.length) {
          iaStats.total = simsIA.length
          const done = simsIA.filter(s => s.completado && s.score_pct !== null)
          iaStats.completados = done.length
          if (done.length) {
            const scores = done.map(s => s.score_pct)
            iaStats.avgScore  = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            iaStats.bestScore = Math.round(Math.max(...scores))
          }
        }
      }

      // Ranking global del paquete
      const { data: rankingRaw } = await supabase
        .from('user_simulacros').select('cargo, score_pct, user_id')
        .eq('evaluacion_id', idNum).eq('completado', true)
        .not('score_pct', 'is', null)
        .order('score_pct', { ascending: false }).limit(8)
      const ranking = (rankingRaw || []).map(r => ({ ...r, users: { full_name: 'Candidato' } }))

      return {
        ev: evalData, niveles: [], pregsPorNivel: {}, intentosPorNivel: {}, totalPregs: 0,
        tienePlan, packageId, hasAiChat, versionNombre, ranking,
        convocatoriaId, convocatoriaNombre, packageNombre, packageExpiry, iaStats,
      }
    }

    // ── Modo Evaluación (legado) ─────────────────────────────────────────────
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

    let tienePlan = false, packageId = null, hasAiChat = false, versionNombre = null
    let convocatoriaId = null, convocatoriaNombre = null, packageNombre = null, packageExpiry = null
    const iaStats = { total: 0, completados: 0, avgScore: null, bestScore: null, herramientas: [] }
    if (user?.id) {
      const esAdmin = user.role === 'admin'
      let evalPackageIds = []
      const [{ data: evalVers }, { data: pkgDirect }] = await Promise.all([
        supabase.from('evaluation_versions').select('package_version_id').eq('evaluation_id', idNum),
        supabase.from('packages').select('id').contains('evaluations_ids', [idNum]),
      ])
      if (evalVers?.length) {
        const versionIds = evalVers.map(v => v.package_version_id).filter(Boolean)
        if (versionIds.length) {
          const { data: versData } = await supabase
            .from('package_versions').select('package_id').in('id', versionIds)
          evalPackageIds = versData?.map(v => v.package_id).filter(Boolean) || []
        }
      }
      if (pkgDirect?.length) {
        evalPackageIds = [...new Set([...evalPackageIds, ...pkgDirect.map(p => p.id)])]
      }

      if (esAdmin) {
        tienePlan = true; hasAiChat = true; packageId = evalPackageIds[0] ?? null
      } else if (evalPackageIds.length) {
        const { data: toolPur } = await supabase
          .from('user_tool_purchases').select('package_id, end_date')
          .eq('user_id', user.id).eq('herramienta_id', 'simulacros')
          .in('package_id', evalPackageIds).gte('end_date', new Date().toISOString())
          .order('end_date', { ascending: false }).limit(1).maybeSingle()
        if (toolPur) { tienePlan = true; packageId = toolPur.package_id; packageExpiry = toolPur.end_date }

        if (!tienePlan) {
          const { data: compra } = await supabase
            .from('purchases').select('package_id, package_version_id, end_date')
            .eq('user_id', user.id).eq('status', 'active')
            .gte('end_date', new Date().toISOString())
            .in('package_id', evalPackageIds)
            .order('end_date', { ascending: false }).limit(1).maybeSingle()
          if (compra) {
            tienePlan = true; packageId = compra.package_id; packageExpiry = compra.end_date
            if (compra.package_version_id) {
              const { data: ver } = await supabase
                .from('package_versions').select('display_name')
                .eq('id', compra.package_version_id).maybeSingle()
              versionNombre = ver?.display_name ?? null
            }
          }
        }
      }

      if (packageId) {
        const { data: pkg } = await supabase
          .from('packages').select('has_ai_chat, convocatoria_id, name, herramientas')
          .eq('id', packageId).maybeSingle()
        if (!esAdmin) hasAiChat = pkg?.has_ai_chat ?? false
        convocatoriaId = pkg?.convocatoria_id ?? null
        packageNombre  = pkg?.name || null
        if (pkg?.herramientas) {
          const tools = Object.entries(pkg.herramientas)
            .filter(([k, v]) => k !== 'paquete_completo' && v?.activo).map(([k]) => k)
          if (tools.length) iaStats.herramientas = tools
        }
      }

      const { data: simsIA } = await supabase
        .from('user_simulacros').select('score_pct, completado, dificultad_config')
        .eq('evaluacion_id', idNum).eq('user_id', user.id).neq('dificultad_config', 'practica')
      if (simsIA?.length) {
        iaStats.total = simsIA.length
        const done = simsIA.filter(s => s.completado && s.score_pct !== null)
        iaStats.completados = done.length
        if (done.length) {
          const scores = done.map(s => s.score_pct)
          iaStats.avgScore  = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          iaStats.bestScore = Math.round(Math.max(...scores))
        }
      }
    }

    const { data: rankingRaw } = await supabase
      .from('user_simulacros').select('cargo, score_pct, completado, user_id')
      .eq('evaluacion_id', idNum).eq('completado', true)
      .not('score_pct', 'is', null).order('score_pct', { ascending: false }).limit(8)
    const ranking = (rankingRaw || []).map(r => ({ ...r, users: { full_name: 'Candidato' } }))

    return { ev: evalData, niveles, pregsPorNivel, intentosPorNivel, totalPregs, tienePlan, packageId, hasAiChat, versionNombre, ranking, convocatoriaId, convocatoriaNombre, packageNombre, packageExpiry, iaStats }
  }, ['detalle-prueba', id, user?.id])

  // ── Derivados ───────────────────────────────────────────────────────────────

  const ev               = data?.ev ?? null
  const niveles          = data?.niveles ?? []
  const pregsPorNivel    = data?.pregsPorNivel ?? {}
  const intentosPorNivel = data?.intentosPorNivel ?? {}
  const totalPregs       = data?.totalPregs ?? 0
  const tienePlan          = data?.tienePlan ?? false
  const packageId          = data?.packageId ?? null
  const hasAiChat          = data?.hasAiChat ?? false
  const versionNombre      = data?.versionNombre ?? null
  const ranking            = data?.ranking ?? []
  const convocatoriaId     = data?.convocatoriaId ?? null
  const convocatoriaNombre = data?.convocatoriaNombre ?? null
  const packageNombre      = data?.packageNombre ?? null
  const packageExpiry      = data?.packageExpiry ?? null
  const iaStats            = data?.iaStats ?? { total: 0, completados: 0, avgScore: null, bestScore: null, herramientas: [] }
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
    navigate('/salas')
  }

  async function abrirModalExamenIA() {
    if (!user) { navigate('/login'); return }
    setLoadingSimsEx(true)
    setModalExamenIA(true)
    try {
      const { data } = await supabase
        .from('user_simulacros')
        .select('id, cargo, cantidad_preguntas, dificultad_config, score_pct, score_correctas, score_total, completado, created_at, tiempo_por_pregunta')
        .eq('evaluacion_id', parseInt(id))
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15)
      const lista = (data || []).filter(s => s.dificultad_config !== 'practica')
      setSimsExamen(lista)
      if (lista.length) setSimSelExamen(lista[0].id)
    } catch { setSimsExamen([]) }
    setLoadingSimsEx(false)
  }

  async function abrirModoPracticaIA() {
    if (!user) { navigate('/login'); return }
    setErrorPractica('')

    // Si ya hay práctica pre-generada, ir directo
    if (practicaLista) {
      navigate(`/simulacro-ia/${practicaLista.id}?modo=practica`)
      return
    }

    // Cargar preflight data y mostrar modal
    setLoadingPreflight(true)
    setShowPracticaModal(true)
    try {
      const { data: simData } = await supabase
        .from('user_simulacros')
        .select('id, cargo, score_pct, score_correctas, score_total, cantidad_preguntas')
        .eq('evaluacion_id', parseInt(id))
        .eq('user_id', user.id)
        .not('score_pct', 'is', null)
        .neq('dificultad_config', 'practica')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!simData) {
        setErrorPractica('Completa tu Prueba Praxia para desbloquear la práctica personalizada.')
        setShowPracticaModal(false)
        setLoadingPreflight(false)
        return
      }

      const [{ data: analisisData }, { data: answersData }] = await Promise.all([
        supabase
          .from('user_simulacro_analisis')
          .select('analisis, score_pct')
          .eq('simulacro_id', simData.id)
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_simulacro_answers')
          .select('area, es_correcta')
          .eq('simulacro_id', simData.id)
          .eq('user_id', user.id),
      ])

      const byArea = {}
      ;(answersData || []).forEach(r => {
        const a = r.area || 'General'
        if (!byArea[a]) byArea[a] = { total: 0, correctas: 0 }
        byArea[a].total++
        if (r.es_correcta) byArea[a].correctas++
      })
      const areas = Object.entries(byArea)
        .sort((a, b) => (a[1].correctas / a[1].total) - (b[1].correctas / b[1].total))
        .map(([nombre, d]) => ({ nombre, ...d, pct: Math.round((d.correctas / d.total) * 100) }))

      setPracticaPreflight({
        simulacroId:  simData.id,
        cargo:        simData.cargo,
        score_pct:    simData.score_pct,
        totalPregs:   simData.cantidad_preguntas || simData.score_total,
        hasAnalisis:  !!analisisData,
        analisisData: analisisData?.analisis || null,
        answersCount: (answersData || []).length,
        areas,
      })
    } finally {
      setLoadingPreflight(false)
    }
  }

  async function enviarAnalisisCuaderno(ultimoAn) {
    const an = ultimoAn?.analisis || {}
    const { data: compras } = await supabase
      .from('purchases')
      .select('package_id, packages(id, name, herramientas)')
      .eq('user_id', user.id)
      .in('status', ['active', 'manual'])

    const paquetes = (compras || [])
      .map(c => c.packages)
      .filter(p => p?.herramientas?.cuaderno?.activo)

    setModalCuaderno({ paquetes, enviando: false, enviado: false, analisis: ultimoAn })
  }

  async function confirmarEnvioCuaderno(packageId) {
    if (!modalCuaderno?.analisis) return
    setModalCuaderno(m => ({ ...m, enviando: true }))
    const an = modalCuaderno.analisis.analisis || {}
    const fecha = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

    const lineas = [
      `RESULTADO DE PRUEBA IA - Praxia · ${fecha}`,
      `Cargo: ${modalCuaderno.analisis.cargo || 'Prueba'}`,
      `Score: ${Math.round(modalCuaderno.analisis.score_pct || 0)}% | ${modalCuaderno.analisis.score_correctas || 0}/${modalCuaderno.analisis.score_total || 0} correctas`,
      an.nivel_preparacion ? `Nivel de preparación: ${an.nivel_preparacion}` : '',
      '',
    ]
    if (an.patron_error) { lineas.push('PATRÓN DE ERROR:', an.patron_error, '') }
    if (an.areas_mejora?.length) {
      lineas.push('ÁREAS A REFORZAR (prioridad de estudio):')
      an.areas_mejora.forEach(a => lineas.push(`  • ${a}`))
      lineas.push('')
    }
    if (an.fortalezas?.length) {
      lineas.push('FORTALEZAS:')
      an.fortalezas.forEach(f => lineas.push(`  • ${f}`))
      lineas.push('')
    }
    lineas.push('Usa este análisis para orientar tus sesiones de estudio. El tutor del cuaderno ya sabe en qué enfocarse.')

    const texto = lineas.filter(l => l !== undefined).join('\n')
    const nombre = `Análisis de prueba · ${fecha}`
    await supabase.from('user_cuaderno_fuentes').insert({ user_id: user.id, package_id: packageId, nombre, texto })
    setModalCuaderno(m => ({ ...m, enviando: false, enviado: true }))
  }

  async function confirmarGenerarPractica() {
    if (!practicaPreflight) return
    setGenerandoPractica(true)
    setErrorPractica('')
    try {
      const result = await generarModoPractica({ simulacro_id: practicaPreflight.simulacroId, evaluacion_id: parseInt(id) })
      setPracticaGenerada(result)
      setPracticaCantidad(result.total)
      setPracticaTiempo(90)
    } catch (e) {
      setErrorPractica(e.message)
    } finally {
      setGenerandoPractica(false)
    }
  }

  function iniciarPractica() {
    if (!practicaGenerada) return
    setShowPracticaModal(false)
    setPracticaGenerada(null)
    navigate(`/simulacro-ia/${practicaGenerada.simulacro_id}?modo=practica`, {
      state: { preStartConfig: { cantidad: practicaCantidad, tiempo: practicaTiempo } }
    })
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
      <>
        {/* Práctica IA */}
          <button onClick={abrirModoPracticaIA} disabled={generandoPractica}
            className={`w-full group text-left p-4 rounded-2xl border-2 transition-all duration-300
              ${practicaLista
                ? 'border-secondary bg-secondary/5 hover:shadow-xl hover:shadow-secondary/20 hover:-translate-y-1'
                : 'border-secondary/20 bg-white hover:border-secondary hover:shadow-xl hover:shadow-secondary/20 hover:-translate-y-1'}
              active:scale-[0.99] disabled:opacity-50`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:rotate-6
                ${practicaLista ? 'bg-secondary' : 'bg-secondary/70'}`}>
                {generandoPractica
                  ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {practicaLista ? 'fitness_center' : 'school'}
                    </span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-secondary text-sm">Modo Práctica</p>
                <p className="text-xs text-on-surface-variant">
                  {generandoPractica
                    ? 'Praxia preparando tu práctica...'
                    : practicaLista
                      ? `${practicaLista.cantidad_preguntas} pregs. · Áreas débiles · Lista`
                      : 'Praxia adapta a tus errores · Auto al terminar examen'}
                </p>
              </div>
              {!generandoPractica && <span className="material-symbols-outlined text-secondary/40 group-hover:text-secondary group-hover:translate-x-1 transition-all duration-300">arrow_forward</span>}
            </div>
            {errorPractica && <p className="text-[10px] text-red-600 font-semibold mt-1">{errorPractica}</p>}
            {practicaLista && !errorPractica && (
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-white">Lista</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Retroalimentación</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Personalizada</span>
              </div>
            )}
            {!practicaLista && !generandoPractica && !errorPractica && (
              <div className="flex gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Auto-generada</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">Retroalimentación</span>
              </div>
            )}
          </button>

          {/* Examen IA */}
          <button onClick={abrirModalExamenIA}
            className="w-full group text-left p-4 rounded-2xl border-2 border-primary/20 bg-white hover:border-primary hover:shadow-xl hover:shadow-primary/20 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <span className="material-symbols-outlined text-white text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-primary text-sm">Modo Examen</p>
                <p className="text-xs text-on-surface-variant">Sin ayudas · Condiciones reales</p>
              </div>
              <span className="material-symbols-outlined text-primary/40 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300">arrow_forward</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Prueba Praxia</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Sin retro</span>
            </div>
          </button>

          {/* Sala en línea */}
          <button onClick={irASala}
            className="w-full group text-left p-4 rounded-2xl border-2 border-tertiary/20 bg-white hover:border-tertiary hover:shadow-xl hover:shadow-tertiary/20 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-tertiary flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <span className="material-symbols-outlined text-white text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
              </div>
              <div className="flex-1">
                <p className="font-extrabold text-tertiary text-sm">Sala en línea</p>
                <p className="text-xs text-on-surface-variant">Compite · Código de sala · Ranking en vivo</p>
              </div>
              <span className="material-symbols-outlined text-tertiary/40 group-hover:text-tertiary group-hover:translate-x-1 transition-all duration-300">arrow_forward</span>
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
              className="w-full group text-left p-4 rounded-2xl border-2 border-slate-700/20 bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-900/40 hover:-translate-y-1 active:scale-[0.99] transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                  <span className="material-symbols-outlined text-white text-xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <div className="flex-1">
                  <p className="font-extrabold text-white text-sm">Prueba personalizada Praxia</p>
                  <p className="text-white/60 text-xs group-hover:text-white/80 transition-colors duration-300">
                    {iaStats.total > 0
                      ? `${iaStats.total} prueba${iaStats.total !== 1 ? 's' : ''} creada${iaStats.total !== 1 ? 's' : ''} · ${iaStats.bestScore != null ? `${iaStats.bestScore}% mejor score` : 'sin completar aún'}`
                      : '160-200 preguntas · Juicio situado · 4 opciones psicométricas'}
                  </p>
                </div>
                <span className="material-symbols-outlined text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all duration-300">arrow_forward</span>
              </div>
            </button>
          )}
      </>
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

          {/* Hero — Dashboard del paquete */}
          <div className={`bg-gradient-to-br ${colorGrad} rounded-3xl p-6 md:p-8 text-white relative overflow-hidden shadow-xl shadow-primary/20 hover:shadow-2xl hover:shadow-primary/30 transition-shadow duration-500`}>
            <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-14 -translate-x-14 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-white text-3xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>{icono}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Badges de estado */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest bg-white/15 text-white/90 px-3 py-0.5 rounded-full">
                      {catNombre}
                    </span>
                    {tienePlan && (
                      <span className="flex items-center gap-1 bg-emerald-400/25 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                        Activo
                      </span>
                    )}
                    {tienePlan && packageExpiry && (
                      <span className="flex items-center gap-1 bg-white/10 text-white/80 text-[10px] font-bold px-3 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-sm">event</span>
                        Vence {new Date(packageExpiry).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {tienePlan && versionNombre && (
                      <span className="flex items-center gap-1 bg-white/15 text-white/90 text-[10px] font-bold px-3 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-sm">badge</span>
                        {versionNombre}
                      </span>
                    )}
                  </div>

                  {/* Título del paquete */}
                  <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">
                    {packageNombre || ev.title}
                  </h1>
                  {packageNombre && packageNombre !== ev.title && (
                    <p className="text-white/60 text-xs mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">quiz</span>
                      {ev.title}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-white/75 text-sm leading-relaxed line-clamp-2">
                {ev.description || 'Simulacro oficial con preguntas actualizadas y diseñado para prepararte en condiciones reales.'}
              </p>

              {/* Herramientas incluidas en el paquete */}
              {iaStats.herramientas?.length > 0 && (() => {
                const MAP = {
                  simulacros: { icon: 'auto_awesome', label: 'Pruebas Praxia' },
                  cuaderno:   { icon: 'auto_stories',  label: 'Cuaderno IA' },
                  salas:      { icon: 'groups',         label: 'Salas' },
                }
                return (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {iaStats.herramientas.map(h => {
                      const m = MAP[h] || { icon: 'star', label: h }
                      return (
                        <span key={h} className="flex items-center gap-1.5 bg-white/15 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>
                          {m.label}
                        </span>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3">
            {(hasAiChat ? [
              { val: iaStats.total  || '0',                                     label: 'Pruebas Praxia', icon: 'auto_awesome', color: 'text-primary',   bg: 'bg-primary/10' },
              { val: iaStats.completados || '0',                                label: 'Completadas',    icon: 'task_alt',     color: 'text-tertiary',  bg: 'bg-tertiary/10' },
              { val: iaStats.bestScore != null ? `${iaStats.bestScore}%` : '—', label: 'Mejor score',   icon: 'emoji_events', color: 'text-secondary', bg: 'bg-secondary/10' },
              { val: iaStats.avgScore  != null ? `${iaStats.avgScore}%`  : '—', label: 'Promedio',      icon: 'analytics',    color: 'text-on-surface',bg: 'bg-surface-container' },
            ] : [
              { val: totalPregs || '—', label: 'Preguntas', icon: 'quiz',    color: 'text-primary',   bg: 'bg-primary/10' },
              { val: durMax,            label: 'Duración',  icon: 'timer',   color: 'text-tertiary',  bg: 'bg-tertiary/10' },
              { val: niveles.length,    label: 'Niveles',   icon: 'layers',  color: 'text-secondary', bg: 'bg-secondary/10' },
              { val: aprobMax,          label: 'Aprobación',icon: 'verified',color: 'text-on-surface',bg: 'bg-surface-container' },
            ]).map(s => (
              <div key={s.label} className="bg-white rounded-2xl p-4 text-center border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-default group">
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform duration-300`}>
                  <span className={`material-symbols-outlined text-lg ${s.color}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                </div>
                <span className={`text-xl font-extrabold block tabular-nums ${s.color}`}>{s.val}</span>
                <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Historial — solo para paquetes tradicionales */}
          {user && !hasAiChat && totalIntentos > 0 && (
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

          {/* Simulacros */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm min-h-32">
            <div className="space-y-5">

                {/* ── Simulacros IA personalizados ── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      Pruebas Praxia personalizadas
                    </p>
                    <button onClick={() => navigate('/registros')}
                      className="flex items-center gap-1 text-[10px] font-bold text-primary hover:text-primary/80 transition-colors">
                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>history_edu</span>
                      Registros
                    </button>
                  </div>
                  <TabSimulacrosIA
                    evaluacionId={id}
                    userId={user?.id}
                    recargar={recargarSims}
                    generandoEnFondo={generandoEnFondo}
                    progFondo={loadingProgress}
                    msgFondo={loadingMsg}
                    cargoFondo={cargoFondoRef.current}
                    onGenerarPractica={abrirModoPracticaIA}
                    generandoPractica={generandoPractica}
                    errorPractica={errorPractica}
                  />
                </div>

                {/* ── Modos de práctica ── */}
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-4">
                    Modos de práctica
                  </p>
                  <div className="lg:hidden">
                    <ModeCards />
                  </div>
                  <div className="hidden lg:flex items-center gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                    <span className="material-symbols-outlined text-primary text-xl">arrow_circle_right</span>
                    <p className="text-sm text-primary font-semibold">
                      Selecciona un modo en el panel derecho para comenzar tu práctica.
                    </p>
                  </div>
                </div>

            </div>
          </div>

          {/* ── Herramientas mobile (sidebar visible solo en desktop) ── */}
          <div className="lg:hidden space-y-3">

            {/* Chat Praxia */}
            <IAPraxia evaluacionNombre={ev?.title} tienePlan={tienePlan && hasAiChat} />

            {/* Cuaderno Praxia */}
            {packageId && (
              <button
                onClick={() => navigate(`/cuaderno/${packageId}`)}
                className="w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white text-left hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300"
                    style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                  <p className="font-bold text-sm">Cuaderno Praxia</p>
                  <span className="material-symbols-outlined text-white/40 group-hover:text-white group-hover:translate-x-1 text-base ml-auto transition-all duration-300">arrow_forward</span>
                </div>
                <p className="text-white/70 text-xs group-hover:text-white/90 transition-colors duration-300">Chatea con Praxia · Notas · Artefactos</p>
              </button>
            )}

            {/* Análisis de perfil (si tiene convocatoria vinculada) */}
            {convocatoriaId && (
              <button
                onClick={() => navigate(`/analisis-perfil?conv=${convocatoriaId}`)}
                className="w-full bg-primary/5 border-2 border-primary/20 hover:border-primary hover:bg-primary/10 rounded-2xl p-4 text-left transition-all duration-300 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-primary text-lg group-hover:scale-110 transition-transform duration-300"
                    style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
                  <p className="font-bold text-sm text-primary">Mi perfil vs cargos</p>
                  <span className="material-symbols-outlined text-primary/40 group-hover:text-primary group-hover:translate-x-1 text-base ml-auto transition-all duration-300">arrow_forward</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  Praxia analiza qué cargos de {convocatoriaNombre || 'la convocatoria'} van con tu perfil
                </p>
              </button>
            )}

            {/* Stats nivel activo */}
            {nivelActual && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">Nivel activo</p>
                <p className="font-extrabold text-base mb-3">{nivelActual.name}</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Preguntas', val: pregsNivel || '—', color: 'text-primary', bg: 'bg-primary/10' },
                    { label: 'Duración',  val: formatTiempo(nivelActual.time_limit), color: 'text-tertiary', bg: 'bg-tertiary/10' },
                    { label: 'Aprobación', val: `${nivelActual.passing_score ?? 70}%`, color: 'text-secondary', bg: 'bg-secondary/10' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-2.5 ${s.bg}`}>
                      <p className={`font-extrabold text-lg ${s.color}`}>{s.val}</p>
                      <p className="text-[10px] text-on-surface-variant font-semibold mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ranking */}
            {ranking.length > 0 && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                  Mejores resultados
                </p>
                <div className="space-y-2">
                  {ranking.slice(0, 5).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] flex-shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-100 text-slate-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-surface-container text-on-surface-variant'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{r.users?.full_name?.split(' ')[0] || 'Candidato'}</p>
                        <p className="text-on-surface-variant truncate text-[10px]">{r.cargo}</p>
                      </div>
                      <span className={`font-extrabold flex-shrink-0 ${r.score_pct >= 70 ? 'text-secondary' : 'text-error'}`}>
                        {r.score_pct}%
                      </span>
                    </div>
                  ))}
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

            {/* Cuaderno Praxia */}
            {packageId && (
              <button
                onClick={() => navigate(`/cuaderno/${packageId}`)}
                className="w-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-4 text-white text-left hover:from-slate-700 hover:to-slate-800 hover:shadow-xl hover:shadow-slate-900/30 hover:-translate-y-0.5 transition-all duration-300 group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-lg group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                  <p className="font-bold text-sm">Cuaderno Praxia</p>
                  <span className="material-symbols-outlined text-white/40 group-hover:text-white group-hover:translate-x-1 text-base ml-auto transition-all duration-300">arrow_forward</span>
                </div>
                <p className="text-white/70 text-xs group-hover:text-white/90 transition-colors duration-300">Chatea con Praxia · Notas · Artefactos</p>
              </button>
            )}

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

            {/* Ranking IA */}
            {ranking.length > 0 && (
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                  Mejores resultados
                </p>
                <div className="space-y-2">
                  {ranking.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center font-extrabold text-[10px] flex-shrink-0 ${
                        i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-slate-100 text-slate-500' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-surface-container text-on-surface-variant'
                      }`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{r.users?.full_name?.split(' ')[0] || 'Usuario'}</p>
                        <p className="text-on-surface-variant truncate text-[10px]">{r.cargo}</p>
                      </div>
                      <span className={`font-extrabold flex-shrink-0 ${r.score_pct >= 70 ? 'text-secondary' : 'text-error'}`}>
                        {r.score_pct}%
                      </span>
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
                className="flex-1 py-3 rounded-full bg-gradient-to-r from-secondary to-secondary/80 text-white font-bold text-sm active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-secondary/30 transition-all duration-300">
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
                className="flex-1 py-3 rounded-full bg-gradient-to-r from-primary to-primary/80 text-white font-bold text-sm active:scale-95 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300">
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
                className={`flex-1 py-3 rounded-full font-bold text-sm text-white active:scale-95 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 group ${modalModo === 'practica' ? 'bg-gradient-to-r from-secondary to-secondary/80 hover:shadow-secondary/40' : 'bg-gradient-to-r from-primary via-primary to-tertiary hover:shadow-primary/40'}`}>
                <span className="material-symbols-outlined text-sm group-hover:translate-y-[-2px] group-hover:rotate-12 transition-transform duration-300"
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
          onClick={() => { if (!generandoIA) { setModalIA(false); setVerificacion(null); setSimulacroCreado(null) } }}>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 animate-fade-in shadow-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

            {/* ── Pantalla éxito ── */}
            {simulacroCreado ? (
              <div className="flex flex-col gap-0 overflow-hidden rounded-2xl -mx-0">
                {/* Cabecera éxito */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 text-white text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-3">
                    <span className="material-symbols-outlined text-white text-3xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                  </div>
                  <p className="font-black text-2xl mb-1">¡Prueba lista!</p>
                  <p className="text-white/70 text-sm font-semibold truncate">{simulacroCreado.cargo}</p>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {[
                      { val: simulacroCreado.cantidad, sub: 'Preguntas' },
                      { val: { mixta: 'Mixta', facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' }[simulacroCreado.dificultad] || 'Mixta', sub: 'Dificultad' },
                      { val: simulacroCreado.tiempo === 0 ? '∞' : `${simulacroCreado.tiempo}s`, sub: 'Por preg.' },
                    ].map(s => (
                      <div key={s.sub} className="bg-white/10 rounded-xl p-3">
                        <p className="font-black text-xl leading-none">{s.val}</p>
                        <p className="text-[9px] opacity-50 uppercase tracking-widest mt-1">{s.sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Módulos OPEC */}
                  <div className="mt-3 flex gap-1.5 flex-wrap justify-center">
                    {MODULOS_OPEC.map(m => {
                      const n = Math.round(simulacroCreado.cantidad * m.pct / 100)
                      return (
                        <span key={m.label} className="bg-white/10 text-white/70 text-[9px] font-bold px-2.5 py-1 rounded-full">
                          {m.label} · {n} pregs
                        </span>
                      )
                    })}
                  </div>
                </div>

                {/* Acciones */}
                <div className="p-5 flex gap-3">
                  <button onClick={() => { setModalIA(false); setSimulacroCreado(null) }}
                    className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all text-on-surface-variant">
                    Ver simulacros
                  </button>
                  <button onClick={() => navigate(`/simulacro-ia/${simulacroCreado.simulacro_id}`)}
                    className="flex-[2] py-3 rounded-full bg-gradient-to-r from-primary via-primary to-tertiary text-white font-bold text-sm active:scale-95 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/40 transition-all duration-300 flex items-center justify-center gap-2 shadow-lg group">
                    <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform duration-300" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    Iniciar ahora
                  </button>
                </div>
              </div>

            ) : generandoIA ? (() => {
                const n  = configIA.cantidad
                const f  = Math.round(n * 0.70)
                const c  = n - f
                const segs = Math.round((Math.ceil(Math.ceil(n / 20) / 3) * 14 + 3))
                const milestones = [
                  { pct: 3,  label: 'Verificando créditos y perfil' },
                  { pct: 15, label: `${f} preguntas funcionales (casuística real de cargo)` },
                  { pct: 82, label: `${c} preguntas comportamentales (Decreto 815/2018)` },
                  { pct: 93, label: 'Revisando calidad psicométrica y coherencia' },
                ]
                const tip = TIPS_CARGA[Math.floor((loadingProgress / 100) * TIPS_CARGA.length) % TIPS_CARGA.length]
                return (
                  <div className="flex flex-col overflow-hidden rounded-2xl">
                    {/* Header oscuro */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 px-5 py-5 text-white rounded-t-2xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative shrink-0">
                          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-2xl animate-pulse"
                              style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                          </div>
                          <div className="absolute -inset-1 rounded-[14px] border border-white/20 animate-ping opacity-60" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-extrabold text-base">Praxia está generando tu prueba</p>
                          <p className="text-white/50 text-[11px] truncate mt-0.5">{cargo}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-white/50 font-semibold">
                          <span className="truncate max-w-[75%]">{loadingMsg || 'Iniciando…'}</span>
                          <span className="tabular-nums shrink-0 ml-2">{loadingProgress}%</span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${loadingProgress}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Milestones */}
                    <div className="px-5 pt-4 pb-3 space-y-3">
                      {milestones.map((m, i) => {
                        const done   = loadingProgress > m.pct + 8
                        const active = !done && loadingProgress >= m.pct - 3
                        return (
                          <div key={i} className={`flex items-center gap-3 transition-all duration-500 ${done || active ? 'opacity-100' : 'opacity-25'}`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300
                              ${done ? 'bg-emerald-500' : active ? 'bg-primary' : 'bg-slate-200'}`}>
                              {done
                                ? <span className="material-symbols-outlined text-white" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>check</span>
                                : active
                                ? <div className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : null}
                            </div>
                            <span className={`text-xs flex-1 transition-colors duration-300 ${done ? 'text-emerald-700 font-semibold' : active ? 'text-on-surface font-bold' : 'text-on-surface-variant'}`}>
                              {m.label}
                            </span>
                            {done && <span className="text-[10px] text-emerald-500 font-bold">✓</span>}
                          </div>
                        )
                      })}
                    </div>

                    {/* Tip rotativo */}
                    <div className="mx-5 mb-4 p-3 bg-primary/5 border border-primary/15 rounded-xl flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-sm shrink-0 mt-0.5"
                        style={{ fontVariationSettings: "'FILL' 1" }}>{tip.icon}</span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{tip.texto}</p>
                    </div>

                    <div className="px-5 pb-3">
                      <button onClick={ejecutarEnSegundoPlano}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-colors">
                        <span className="material-symbols-outlined text-sm">notifications</span>
                        Ejecutar en segundo plano
                      </button>
                    </div>
                    <p className="text-center text-[10px] text-on-surface-variant/40 pb-4 px-5">
                      {n} preguntas en paralelo · ~{segs}s estimados
                    </p>
                  </div>
                )
              })() : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-white text-2xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xl">Prueba con Praxia</h3>
                    <p className="text-xs text-on-surface-variant">Generado por Praxia · usa tus créditos</p>
                  </div>
                </div>

                {/* Campo cargo */}
                <div className="mb-4">
                  <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
                    Nombre del OPEC / Cargo
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text" value={cargo}
                      onChange={e => { setCargo(e.target.value); setErrorIA(null); setVerificacion(null) }}
                      onKeyDown={e => e.key === 'Enter' && lanzarSimulacroIA()}
                      placeholder="ej: Profesional Universitario Grado 11 DIAN"
                      className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                      autoFocus
                    />
                    <button type="button" onClick={buscarDatosOpec}
                      disabled={!cargo.trim() || verificando}
                      title="Verificar datos reales en Google"
                      className="shrink-0 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all disabled:opacity-40 flex items-center gap-1.5 text-xs font-bold">
                      {verificando
                        ? <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        : <span className="material-symbols-outlined text-sm">travel_explore</span>}
                      {!verificando && <span className="hidden sm:inline">Verificar</span>}
                    </button>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1.5">
                    Escribe el cargo exacto y usa <strong>Verificar</strong> para cruzar con datos reales de la convocatoria.
                  </p>
                </div>

                {/* Panel verificación Google */}
                {verificacion && (
                  <div className={`mb-4 rounded-xl border overflow-hidden text-xs ${verificacion.encontrado ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    {verificacion.encontrado ? (
                      <>
                        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                          <span className="material-symbols-outlined text-blue-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>travel_explore</span>
                          <span className="font-bold text-blue-800">Datos verificados en Google</span>
                          {verificacion.año_info && <span className="ml-auto text-blue-500 font-semibold">{toStr(verificacion.año_info)}</span>}
                        </div>
                        <div className="px-3 pb-3 space-y-1.5">
                          {verificacion.entidad && (
                            <p className="text-blue-700"><span className="font-bold">Entidad:</span> {toStr(verificacion.entidad)}</p>
                          )}
                          {verificacion.total_preguntas && (
                            <p className="text-blue-700"><span className="font-bold">Preguntas reales:</span> ~{verificacion.total_preguntas}</p>
                          )}
                          {verificacion.duracion_minutos && (
                            <p className="text-blue-700"><span className="font-bold">Duración:</span> {verificacion.duracion_minutos} min</p>
                          )}
                          {verificacion.modulos?.length > 0 && (
                            <div>
                              <p className="font-bold text-blue-700 mb-1">Módulos:</p>
                              <div className="flex flex-wrap gap-1">
                                {verificacion.modulos.map((m, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full font-semibold">
                                    {toStr(m.nombre)} {m.porcentaje}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {verificacion.nota && (
                            <p className="text-blue-600 italic">{toStr(verificacion.nota)}</p>
                          )}
                          {verificacion.total_preguntas && (
                            <div className="mt-2 flex items-start gap-1.5 bg-blue-50 border border-blue-200 rounded-lg p-2">
                              <span className="material-symbols-outlined text-blue-600 text-sm shrink-0 mt-0.5">auto_awesome</span>
                              <p className="text-blue-800 leading-relaxed">
                                Praxia generará <strong>~{verificacion.total_preguntas} preguntas</strong> siguiendo la estructura real de esta OPEC.
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 p-3 text-slate-500">
                        <span className="material-symbols-outlined text-sm">info</span>
                        No encontramos datos específicos para este cargo. La prueba se generará con el prompt maestro OPEC.
                      </div>
                    )}
                  </div>
                )}

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
                    ${pdfIA ? 'border-primary/40 bg-primary/5' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}>
                    <span className="material-symbols-outlined text-xl text-on-surface-variant"
                      style={{ fontVariationSettings: pdfIA ? "'FILL' 1" : "'FILL' 0" }}>
                      {pdfIA ? 'picture_as_pdf' : 'upload_file'}
                    </span>
                    <span className="text-sm text-on-surface-variant truncate flex-1">
                      {pdfIA ? pdfIA.name : 'Subir PDF (temario, normas, convocatoria…)'}
                    </span>
                    {pdfIA && (
                      <button type="button" onClick={e => { e.preventDefault(); setPdfIA(null) }}
                        className="text-error text-xs font-bold shrink-0">Quitar</button>
                    )}
                    <input type="file" accept=".pdf" className="hidden"
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
                  <button onClick={() => { setModalIA(false); setVerificacion(null) }}
                    className="flex-1 py-3 rounded-full border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-all">
                    Cancelar
                  </button>
                  <button onClick={lanzarSimulacroIA} disabled={!cargo.trim()}
                    className="flex-1 py-3 rounded-full bg-gradient-to-r from-primary via-primary to-tertiary text-white font-bold text-sm active:scale-95 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/40 transition-all duration-300 disabled:opacity-40 flex items-center justify-center gap-2 group">
                    <span className="material-symbols-outlined text-sm group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    Generar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Preflight Modo Práctica IA ── */}
      {showPracticaModal && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => { if (!generandoPractica) { setShowPracticaModal(false); setPracticaGenerada(null) } }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-secondary text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-on-surface text-base">Modo Práctica Personalizada</p>
                <p className="text-xs text-on-surface-variant">Praxia usará este contexto para adaptar tu práctica</p>
              </div>
              {!generandoPractica && (
                <button onClick={() => setShowPracticaModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors shrink-0">
                  <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
                </button>
              )}
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-3 overflow-y-auto max-h-[60vh]">
              {generandoPractica ? (
                <div className="flex flex-col items-center justify-center py-10 gap-5">
                  {/* Ícono animado */}
                  <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-4 border-secondary/20" />
                    <div className="absolute inset-0 rounded-full border-4 border-secondary border-t-transparent animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="material-symbols-outlined text-secondary text-2xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {PRACTICA_STEPS[practicaStep]?.icon}
                      </span>
                    </div>
                  </div>
                  {/* Texto del paso actual */}
                  <div className="text-center space-y-1">
                    <p className="font-bold text-sm text-on-surface">{PRACTICA_STEPS[practicaStep]?.text}</p>
                    <p className="text-xs text-on-surface-variant">Esto puede tardar unos segundos…</p>
                  </div>
                  {/* Barra de progreso */}
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all duration-[3500ms] ease-linear"
                      style={{ width: `${((practicaStep + 1) / PRACTICA_STEPS.length) * 100}%` }}
                    />
                  </div>
                  {/* Pasos como dots */}
                  <div className="flex gap-2">
                    {PRACTICA_STEPS.map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i <= practicaStep ? 'bg-secondary' : 'bg-slate-200'}`} />
                    ))}
                  </div>
                </div>
              ) : practicaGenerada ? (
                /* ── Pantalla de configuración post-generación ── */
                <div className="space-y-4">
                  {/* Resumen generado */}
                  <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/15 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div>
                      <p className="font-extrabold text-secondary text-sm">¡Práctica lista!</p>
                      <p className="text-xs text-on-surface-variant">{practicaGenerada.total} preguntas generadas</p>
                    </div>
                  </div>

                  {/* Áreas cubiertas */}
                  {practicaGenerada.areas_cubiertas?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Áreas cubiertas</p>
                      <div className="flex flex-wrap gap-1.5">
                        {practicaGenerada.areas_cubiertas.map((a, i) => (
                          <span key={i} className="text-[10px] bg-secondary/10 text-secondary font-bold px-2.5 py-1 rounded-full">{toStr(a)}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cuántas preguntas */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-on-surface">Preguntas a hacer</p>
                      <span className="text-sm font-extrabold text-secondary">{practicaCantidad}</span>
                    </div>
                    <input type="range" min={5} max={practicaGenerada.total} step={1}
                      value={practicaCantidad}
                      onChange={e => setPracticaCantidad(Number(e.target.value))}
                      className="w-full accent-secondary h-2 rounded-full" />
                    <div className="flex justify-between text-[9px] text-on-surface-variant mt-1">
                      <span>5</span><span>{practicaGenerada.total} (todas)</span>
                    </div>
                  </div>

                  {/* Tiempo por pregunta */}
                  <div>
                    <p className="text-xs font-bold text-on-surface mb-2">Tiempo por pregunta</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Sin límite', val: 0 },
                        { label: '30 seg',     val: 30 },
                        { label: '45 seg',     val: 45 },
                        { label: '60 seg',     val: 60 },
                        { label: '90 seg',     val: 90 },
                        { label: '2 min',      val: 120 },
                      ].map(op => (
                        <button key={op.val}
                          onClick={() => setPracticaTiempo(op.val)}
                          className={`py-2 rounded-xl text-xs font-bold border-2 transition-all ${practicaTiempo === op.val ? 'border-secondary bg-secondary/10 text-secondary' : 'border-slate-200 text-on-surface-variant hover:border-secondary/40'}`}>
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : loadingPreflight ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="w-8 h-8 border-[3px] border-secondary border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-on-surface-variant font-semibold">Leyendo tus datos…</p>
                </div>
              ) : practicaPreflight ? (
                <>
                  {/* Ítem 1: Última prueba */}
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="material-symbols-outlined text-emerald-600 text-base"
                        style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-emerald-700 uppercase tracking-widest mb-0.5">Última prueba completada</p>
                      <p className="text-sm font-bold text-on-surface truncate">{practicaPreflight.cargo}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${practicaPreflight.score_pct >= 70 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {Math.round(practicaPreflight.score_pct)}%
                        </span>
                        {practicaPreflight.totalPregs > 0 && (
                          <span className="text-[10px] text-on-surface-variant">{practicaPreflight.totalPregs} preguntas</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ítem 2: Análisis IA */}
                  <div className={`flex items-start gap-3 rounded-2xl p-3 border ${practicaPreflight.hasAnalisis ? 'bg-primary/5 border-primary/15' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${practicaPreflight.hasAnalisis ? 'bg-primary/10' : 'bg-slate-200'}`}>
                      <span className={`material-symbols-outlined text-base ${practicaPreflight.hasAnalisis ? 'text-primary' : 'text-slate-400'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {practicaPreflight.hasAnalisis ? 'psychology' : 'psychology'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className={`text-xs font-extrabold uppercase tracking-widest ${practicaPreflight.hasAnalisis ? 'text-primary' : 'text-slate-400'}`}>
                          Análisis IA
                        </p>
                        {!practicaPreflight.hasAnalisis && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">Sin análisis</span>
                        )}
                      </div>
                      {practicaPreflight.hasAnalisis && practicaPreflight.analisisData ? (() => {
                        const an = practicaPreflight.analisisData
                        return (
                          <>
                            {an.nivel_preparacion && (
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full inline-block mb-1">
                                {toStr(an.nivel_preparacion)}
                              </span>
                            )}
                            {an.patron_error && (
                              <p className="text-[11px] text-on-surface leading-relaxed line-clamp-2">{toStr(an.patron_error)}</p>
                            )}
                            {an.areas_mejora?.length > 0 && (
                              <p className="text-[10px] text-on-surface-variant mt-1">
                                {an.areas_mejora.length} áreas a reforzar detectadas
                              </p>
                            )}
                          </>
                        )
                      })() : (
                        <p className="text-[11px] text-on-surface-variant">Se usarán las respuestas para detectar áreas débiles</p>
                      )}
                    </div>
                  </div>

                  {/* Ítem 3: Respuestas detalladas */}
                  <div className={`flex items-start gap-3 rounded-2xl p-3 border ${practicaPreflight.answersCount > 0 ? 'bg-secondary/5 border-secondary/15' : 'bg-slate-50 border-slate-200'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${practicaPreflight.answersCount > 0 ? 'bg-secondary/10' : 'bg-slate-200'}`}>
                      <span className={`material-symbols-outlined text-base ${practicaPreflight.answersCount > 0 ? 'text-secondary' : 'text-slate-400'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-extrabold uppercase tracking-widest mb-0.5 ${practicaPreflight.answersCount > 0 ? 'text-secondary' : 'text-slate-400'}`}>
                        Respuestas detalladas
                      </p>
                      {practicaPreflight.answersCount > 0 ? (
                        <>
                          <p className="text-[11px] text-on-surface">{practicaPreflight.answersCount} respuestas · {practicaPreflight.areas.length} áreas</p>
                          {practicaPreflight.areas.slice(0, 3).map((a, i) => (
                            <div key={i} className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${a.pct >= 70 ? 'bg-emerald-400' : a.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                  style={{ width: `${a.pct}%` }} />
                              </div>
                              <span className="text-[9px] text-on-surface-variant w-20 truncate">{a.nombre}</span>
                              <span className={`text-[9px] font-bold w-7 text-right ${a.pct >= 70 ? 'text-emerald-600' : a.pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>{a.pct}%</span>
                            </div>
                          ))}
                          {practicaPreflight.areas.length > 3 && (
                            <p className="text-[9px] text-on-surface-variant mt-1">+{practicaPreflight.areas.length - 3} áreas más</p>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] text-on-surface-variant">Sin respuestas guardadas — se usarán las preguntas del simulacro</p>
                      )}
                    </div>
                  </div>

                  {errorPractica && (
                    <p className="text-xs text-red-600 font-semibold text-center">{errorPractica}</p>
                  )}

                  <p className="text-[10px] text-on-surface-variant text-center leading-relaxed">
                    Praxia generará preguntas nuevas enfocadas en tus áreas más débiles, respetando el estilo y nivel de la prueba original.
                  </p>
                </>
              ) : null}
            </div>

            {/* Footer */}
            {!loadingPreflight && !generandoPractica && (practicaPreflight || practicaGenerada) && (
              <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
                <button onClick={() => { setShowPracticaModal(false); setPracticaGenerada(null) }}
                  className="flex-1 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-all">
                  {practicaGenerada ? 'Cancelar' : 'Cancelar'}
                </button>
                {practicaGenerada ? (
                  <button onClick={iniciarPractica}
                    className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-secondary to-secondary/80 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-secondary/30">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                    Iniciar práctica
                  </button>
                ) : (
                <button onClick={confirmarGenerarPractica}
                  className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-secondary to-secondary/80 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-secondary/30">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
                  Generar práctica
                </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Modal Modo Examen IA ── */}
      {modalExamenIA && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setModalExamenIA(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-base">Modo Examen</h3>
                <p className="text-xs text-on-surface-variant">Selecciona tu Prueba Praxia para correr</p>
              </div>
              <button onClick={() => setModalExamenIA(false)} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-slate-500">close</span>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 py-4">
              {loadingSimsEx ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : simsExamen.length === 0 ? (
                <div className="text-center py-10">
                  <span className="material-symbols-outlined text-slate-300 text-5xl block mb-2" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  <p className="font-bold text-sm text-on-surface">Sin pruebas disponibles</p>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto leading-relaxed">Genera una Prueba Praxia primero usando el botón "Prueba personalizada Praxia" de abajo.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {simsExamen.map(s => {
                    const sel = simSelExamen === s.id
                    const LABEL_DIF_EX = { mixta: 'Mixta', facil: 'Facil', medio: 'Medio', dificil: 'Dificil' }
                    const tiempoTotal = s.tiempo_por_pregunta > 0
                      ? Math.round(s.cantidad_preguntas * s.tiempo_por_pregunta / 60) + ' min'
                      : '60 min'
                    return (
                    <button key={s.id} onClick={() => setSimSelExamen(s.id)}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${sel ? 'border-primary bg-primary/5 shadow-md' : 'border-slate-200 bg-white hover:border-primary/30 hover:bg-slate-50'}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${sel ? 'bg-primary' : 'bg-slate-100'}`}>
                          {sel
                            ? <span className="material-symbols-outlined text-white text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                            : <span className="material-symbols-outlined text-slate-400 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-extrabold text-sm leading-tight ${sel ? 'text-primary' : 'text-on-surface'}`}>{s.cargo}</p>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">{tiempoRelativo(s.created_at)}</p>
                        </div>
                        {s.completado && (
                          <div className={`text-right shrink-0 ${(s.score_pct ?? 0) >= 70 ? 'text-secondary' : 'text-error'}`}>
                            <p className="font-extrabold text-lg leading-none">{s.score_pct ?? 0}%</p>
                            <p className="text-[9px] font-bold opacity-70">{s.score_correctas ?? 0}/{s.score_total ?? s.cantidad_preguntas}</p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { icon: 'quiz',    val: s.cantidad_preguntas + '',                      label: 'Preguntas' },
                          { icon: 'timer',   val: tiempoTotal,                                    label: 'Duracion' },
                          { icon: 'tune',    val: LABEL_DIF_EX[s.dificultad_config] || 'Mixta',   label: 'Dificultad' },
                          { icon: s.completado ? 'task_alt' : 'pending', val: s.completado ? 'Hecha' : 'Pendiente', label: 'Estado', err: !s.completado },
                        ].map(st => (
                          <div key={st.label} className={`rounded-xl p-2 text-center ${sel ? 'bg-primary/10' : 'bg-slate-50'}`}>
                            <span className={`material-symbols-outlined text-sm block mb-0.5 ${sel ? 'text-primary' : st.err ? 'text-amber-500' : 'text-slate-400'}`}
                              style={{ fontVariationSettings: "'FILL' 1" }}>{st.icon}</span>
                            <p className={`text-[10px] font-extrabold ${sel ? 'text-primary' : 'text-on-surface'}`}>{st.val}</p>
                            <p className="text-[8px] text-on-surface-variant uppercase tracking-wide">{st.label}</p>
                          </div>
                        ))}
                      </div>
                    </button>
                  )})}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
              <button onClick={() => setModalExamenIA(false)}
                className="flex-1 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-all">
                Cancelar
              </button>
              <button
                onClick={() => { navigate(`/simulacro-ia/${simSelExamen}?modo=examen`); setModalExamenIA(false) }}
                disabled={!simSelExamen}
                className="flex-1 py-2.5 rounded-full bg-gradient-to-r from-primary via-primary to-tertiary text-white text-sm font-bold disabled:opacity-40 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                Empezar examen
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal enviar análisis al cuaderno */}
      {modalCuaderno && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !modalCuaderno.enviando && setModalCuaderno(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            {modalCuaderno.enviado ? (
              <div className="text-center py-4 space-y-3">
                <span className="material-symbols-outlined text-4xl text-violet-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="font-bold text-slate-800">¡Enviado al Cuaderno!</p>
                <p className="text-xs text-slate-500">El tutor IA ya sabe en qué áreas enfocarse contigo.</p>
                <button onClick={() => setModalCuaderno(null)} className="w-full py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold">Cerrar</button>
              </div>
            ) : (
              <>
                <div>
                  <h3 className="font-bold text-slate-800">Enviar análisis al Cuaderno IA</h3>
                  <p className="text-xs text-slate-500 mt-1">Las áreas débiles y recomendaciones se guardarán como contexto de estudio en el cuaderno.</p>
                </div>
                {modalCuaderno.paquetes.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">No tienes paquetes activos con el Cuaderno IA habilitado.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selecciona el cuaderno</p>
                    {modalCuaderno.paquetes.map(p => (
                      <button
                        key={p.id}
                        onClick={() => confirmarEnvioCuaderno(p.id)}
                        disabled={modalCuaderno.enviando}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50 transition-all text-left disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-violet-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                        <span className="text-sm font-medium text-slate-800">{p.name}</span>
                        {modalCuaderno.enviando && <span className="ml-auto text-[10px] text-slate-400">Enviando…</span>}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setModalCuaderno(null)} className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
              </>
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
