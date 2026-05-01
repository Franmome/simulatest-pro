import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'
import { useFetch } from '../hooks/useFetch'

function getSaludo() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Buenos días'
  if (h >= 12 && h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

const CATEGORIA_ESTILOS = {
  'CNSC':         { gradient: 'from-primary to-primary-container',        icon: 'gavel',        badge: 'bg-primary/10 text-primary'     },
  'ICFES':        { gradient: 'from-tertiary to-tertiary-container',      icon: 'school',       badge: 'bg-tertiary/10 text-tertiary'   },
  'Procuraduría': { gradient: 'from-secondary to-on-secondary-container', icon: 'balance',      badge: 'bg-secondary/10 text-secondary' },
  'Contraloría':  { gradient: 'from-primary to-primary-container',        icon: 'account_balance', badge: 'bg-primary/10 text-primary'  },
  'default':      { gradient: 'from-primary to-primary-container',        icon: 'quiz',         badge: 'bg-primary/10 text-primary'     },
}

function getEstilo(categoria) {
  return CATEGORIA_ESTILOS[categoria] || CATEGORIA_ESTILOS['default']
}

function Skeleton({ className = '' }) {
  return <div className={`bg-surface-container animate-pulse rounded-xl ${className}`} />
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const nombreCompleto = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'estudiante'
  const primerNombre = nombreCompleto.split(' ')[0]
  const iniciales    = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl    = user?.user_metadata?.avatar_url || null

  const [perfil,          setPerfil]          = useState({ role: 'user', level: 'Profesional Universitario' })
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)

  // ── Carga principal con useFetch ────────────────────────────────────────
  const { data, loading: cargando, error, retry } = useFetch(async () => {
    if (!user?.id) return null

    // Perfil
    const { data: perfilData } = await supabase
      .from('users')
      .select('role, level')
      .eq('id', user.id)
      .single()
    if (perfilData) setPerfil(perfilData)

    // Evaluaciones + una sola query para preguntas
    const { data: evals } = await supabase
      .from('evaluations')
      .select('id, title, description, categories(name), levels(id, name)')
      .eq('is_active', true)
      .limit(4)

    const todosLevelIds = (evals || []).flatMap(ev => ev.levels?.map(l => l.id) || [])
    let pregsPorLevel = {}
    if (todosLevelIds.length) {
      const { data: qCounts } = await supabase
        .from('questions').select('level_id').in('level_id', todosLevelIds)
      ;(qCounts || []).forEach(q => {
        pregsPorLevel[q.level_id] = (pregsPorLevel[q.level_id] || 0) + 1
      })
    }

    const evaluaciones = (evals || []).map(ev => ({
      ...ev,
      categoria:  ev.categories?.name || 'General',
      preguntas:  ev.levels?.reduce((sum, l) => sum + (pregsPorLevel[l.id] || 0), 0) || 0,
      niveles:    ev.levels?.length || 0,
    }))

    // Intentos del usuario
    const { data: intentosData } = await supabase
      .from('attempts')
      .select('id, score, status, start_time, end_time, levels(name, time_limit)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(20)
    const intentos = intentosData || []

    // Progreso
    const completados = intentos.filter(a => a.status === 'completed' && a.score != null)
    const pct = completados.length
      ? Math.round(completados.reduce((s, a) => s + a.score, 0) / completados.length)
      : 0

    const inicioSemana = new Date()
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
    inicioSemana.setHours(0, 0, 0, 0)
    const intentosSemana = intentos.filter(a => a.start_time && new Date(a.start_time) >= inicioSemana)
    const segundosSemana = intentosSemana.reduce((sum, a) => {
      if (a.start_time && a.end_time)
        return sum + Math.floor((new Date(a.end_time) - new Date(a.start_time)) / 1000)
      return sum + (a.levels?.time_limit || 0) * 60
    }, 0)
    const horasSemana = Math.round(segundosSemana / 3600 * 10) / 10

    // Plan activo
    const { count: planCount } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())

    return {
      evaluaciones,
      intentos,
      progreso: { pct, horasSemana, metaSemana: 20 },
      tienePlan: (planCount || 0) > 0,
    }
  }, ['dashboard', user?.id])

  const evaluaciones = data?.evaluaciones ?? []
  const intentos     = data?.intentos     ?? []
  const progreso     = data?.progreso     ?? { pct: 0, horasSemana: 0, metaSemana: 20 }
  const tienePlan    = data?.tienePlan    ?? false

  async function guardarPerfil(campo, valor) {
    const nuevo = { ...perfil, [campo]: valor }
    setPerfil(nuevo)
    setGuardandoPerfil(true)
    await supabase.from('users').update({ [campo]: valor }).eq('id', user.id)
    setGuardandoPerfil(false)
  }

  const radio     = 56
  const circunf   = 2 * Math.PI * radio
  const offset    = circunf - (progreso.pct / 100) * circunf
  const pctSemana = Math.min((progreso.horasSemana / progreso.metaSemana) * 100, 100)

  return (
    <div className="flex" style={{ paddingBottom: '3rem' }}>
      <section className="flex-1 p-8 overflow-y-auto">

        {/* Saludo */}
        <div className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-on-background mb-2">
              {getSaludo()}, {primerNombre}! 👋
            </h1>
            <p className="text-on-surface-variant text-lg font-light">
              Hoy es un excelente día para avanzar hacia tu meta profesional.
            </p>
          </div>
          <div className="shrink-0">
            {avatarUrl
              ? <img src={avatarUrl} alt={nombreCompleto}
                     className="w-14 h-14 rounded-full object-cover ring-4 ring-primary/20" />
              : <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center
                                text-on-primary font-bold text-xl ring-4 ring-primary/20">
                  {iniciales}
                </div>
            }
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-error-container text-error rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <p className="text-sm font-semibold flex-1">{error}</p>
            <button onClick={retry} className="text-xs font-bold underline">Reintentar</button>
          </div>
        )}

        {/* Configuración de perfil */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-12">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                Tipo de Candidato
              </span>
              <span className="material-symbols-outlined text-secondary">badge</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['CNSC', 'ICFES', 'Saber Pro', 'Otro'].map(tipo => (
                <button
                  key={tipo}
                  onClick={() => guardarPerfil('role', tipo)}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all
                    ${perfil.role === tipo
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}`}>
                  {tipo}
                </button>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-tertiary">
                Nivel de Aspiración
              </span>
              <span className="material-symbols-outlined text-tertiary">military_tech</span>
            </div>
            <select
              value={perfil.level || 'Profesional Universitario'}
              onChange={e => guardarPerfil('level', e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4
                         text-sm font-semibold outline-none focus:ring-2 focus:ring-tertiary/30">
              <option>Profesional Universitario</option>
              <option>Directivo</option>
              <option>Técnico</option>
              <option>Auxiliar / Asistencial</option>
            </select>
          </div>
        </div>

        {/* Simulacros disponibles */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-on-background">Simulacros disponibles</h3>
            <button onClick={() => navigate('/catalogo')}
                    className="text-primary font-semibold text-sm hover:underline">
              Ver todo →
            </button>
          </div>

          {cargando ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
            </div>
          ) : evaluaciones.length === 0 ? (
            <div className="card p-10 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl opacity-40 mb-3 block">school</span>
              <p className="font-semibold">No hay simulacros disponibles aún</p>
              <p className="text-sm mt-1">El administrador está preparando el contenido</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {evaluaciones.map(ev => {
                const estilo = getEstilo(ev.categoria)
                return (
                  <div key={ev.id}
                       onClick={() => navigate(`/prueba/${ev.id}`)}
                       className="card p-5 cursor-pointer hover:shadow-lg hover:-translate-y-0.5
                                  transition-all group flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-b ${estilo.gradient}
                                     flex items-center justify-center shrink-0`}>
                      <span className="material-symbols-outlined text-white text-xl"
                            style={{ fontVariationSettings: "'FILL' 1" }}>{estilo.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estilo.badge}`}>
                          {ev.categoria}
                        </span>
                      </div>
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {ev.title}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {ev.preguntas} preguntas · {ev.niveles} nivel{ev.niveles !== 1 ? 'es' : ''}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant
                                     group-hover:text-primary transition-colors">
                      chevron_right
                    </span>
                  </div>
                )
              })}

              {!tienePlan && (
                <div onClick={() => navigate('/planes')}
                     className="card p-5 cursor-pointer bg-gradient-to-br from-primary to-primary-container
                                text-white hover:shadow-lg hover:-translate-y-0.5 transition-all
                                flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-xl"
                          style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">Desbloquea todo</p>
                    <p className="text-xs text-primary-fixed-dim">Ver planes disponibles →</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Últimos intentos */}
        {intentos.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-on-background">Últimos simulacros</h3>
              <button onClick={() => navigate('/perfil')}
                      className="text-primary font-semibold text-sm hover:underline">
                Ver historial →
              </button>
            </div>
            <div className="space-y-3">
              {intentos.slice(0, 3).map(intento => (
                <div key={intento.id}
                     className="bg-white p-4 rounded-xl flex items-center gap-4
                                border border-outline-variant/15 hover:shadow-sm transition-shadow">
                  <div className={`p-3 rounded-xl shrink-0
                    ${intento.status === 'completed'
                      ? 'bg-secondary-container text-on-secondary-container'
                      : 'bg-surface-container text-on-surface-variant'}`}>
                    <span className="material-symbols-outlined text-sm">
                      {intento.status === 'completed' ? 'check_circle' : 'pending'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{intento.levels?.name || 'Simulacro'}</p>
                    <p className="text-xs text-on-surface-variant">{tiempoRelativo(intento.start_time)}</p>
                  </div>
                  {intento.status === 'completed' && intento.score != null && (
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-extrabold
                        ${intento.score >= 70 ? 'text-secondary' : 'text-error'}`}>
                        {intento.score}%
                      </p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold">
                        {intento.score >= 70 ? 'Aprobado' : 'No aprobó'}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Sidebar derecho ── */}
      <aside className="hidden xl:flex w-80 shrink-0 flex-col p-8 gap-6 border-l border-outline-variant/15">

        {/* Círculo de progreso */}
        <div className="card p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-4">
            Promedio general
          </p>
          <div className="relative inline-flex items-center justify-center mb-4">
            <svg width="140" height="140" className="-rotate-90">
              <circle cx="70" cy="70" r={radio} fill="none"
                      stroke="var(--color-surface-container-high)" strokeWidth="10" />
              <circle cx="70" cy="70" r={radio} fill="none"
                      stroke="var(--color-primary)" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={circunf}
                      strokeDashoffset={offset}
                      style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div className="absolute text-center">
              <p className="text-3xl font-extrabold text-on-background">{progreso.pct}%</p>
              <p className="text-[10px] text-on-surface-variant font-medium">
                {intentos.filter(a => a.score != null).length > 0 ? 'Promedio' : 'Sin datos'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Meta semanal</span>
              <span className="text-on-background font-bold">
                {progreso.horasSemana}/{progreso.metaSemana} hrs
              </span>
            </div>
            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full transition-all duration-700"
                   style={{ width: `${pctSemana}%` }} />
            </div>
            {intentos.length > 0 && (
              <p className="text-[10px] text-on-surface-variant">
                {intentos.filter(a => a.status === 'completed').length} simulacros completados
              </p>
            )}
          </div>

          <button onClick={() => navigate('/perfil')}
                  className="mt-6 w-full py-3 bg-white border border-outline-variant/30 rounded-xl
                             text-xs font-bold text-primary hover:bg-primary-fixed transition-colors">
            VER HISTORIAL COMPLETO
          </button>
        </div>

        {/* Novedades */}
        <div>
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary">gavel</span>
            Novedades
          </h4>
          <div className="space-y-6">
            <article className="group cursor-pointer">
              <p className="text-[10px] font-bold text-tertiary mb-1">DECRETO 452 - 2024</p>
              <h5 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                Modificación en el régimen de carrera administrativa...
              </h5>
              <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">
                Nuevas directrices para el proceso de selección en entidades territoriales.
              </p>
            </article>
            <article className="group cursor-pointer">
              <p className="text-[10px] font-bold text-tertiary mb-1">CIRCULAR CNSC</p>
              <h5 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                Nuevas fechas para convocatoria Territorial 8...
              </h5>
              <p className="text-xs text-on-surface-variant mt-2 line-clamp-2">
                La CNSC anuncia ajustes en el cronograma de pruebas escritas.
              </p>
            </article>
          </div>
        </div>
      </aside>
    </div>
  )
}