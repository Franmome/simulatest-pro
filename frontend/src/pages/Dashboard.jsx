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
  'CNSC':         { gradient: 'from-primary to-primary-container',        icon: 'gavel',           badge: 'bg-primary/10 text-primary'      },
  'ICFES':        { gradient: 'from-tertiary to-tertiary-container',      icon: 'school',          badge: 'bg-tertiary/10 text-tertiary'    },
  'Procuraduría': { gradient: 'from-secondary to-on-secondary-container', icon: 'balance',         badge: 'bg-secondary/10 text-secondary'  },
  'Contraloría':  { gradient: 'from-primary to-primary-container',        icon: 'account_balance', badge: 'bg-primary/10 text-primary'      },
  'default':      { gradient: 'from-primary to-primary-container',        icon: 'quiz',            badge: 'bg-primary/10 text-primary'      },
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

  const [filtroCategoria, setFiltroCategoria] = useState('Todos')

  const { data, loading: cargando, error, retry } = useFetch(async () => {
    if (!user?.id) return null

    const { data: evals } = await supabase
      .from('evaluations')
      .select('id, title, description, categories(name), levels(id, name)')
      .eq('is_active', true)
      .limit(8)

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
      categoria: ev.categories?.name || 'General',
      preguntas: ev.levels?.reduce((sum, l) => sum + (pregsPorLevel[l.id] || 0), 0) || 0,
      niveles:   ev.levels?.length || 0,
    }))

    const { data: intentosData } = await supabase
      .from('attempts')
      .select('id, score, status, start_time, end_time, levels(name, time_limit)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(20)
    const intentos = intentosData || []

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

  const categorias = ['Todos', ...new Set(evaluaciones.map(e => e.categoria))]
  const evalsFiltradas = filtroCategoria === 'Todos'
    ? evaluaciones
    : evaluaciones.filter(e => e.categoria === filtroCategoria)

  const radio   = 56
  const circunf = 2 * Math.PI * radio
  const offset  = circunf - (progreso.pct / 100) * circunf
  const pctSem  = Math.min((progreso.horasSemana / progreso.metaSemana) * 100, 100)
  const simsCom = intentos.filter(a => a.status === 'completed').length

  return (
    <div className="flex" style={{ paddingBottom: '3rem' }}>
      <section className="flex-1 p-8 overflow-y-auto">

        {/* ── Saludo ── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-on-background mb-1">
              {getSaludo()}, {primerNombre}! 👋
            </h1>
            <p className="text-on-surface-variant text-sm">
              Continúa preparándote para tu oposición
            </p>
          </div>
          <div className="shrink-0">
            {avatarUrl
              ? <img src={avatarUrl} alt={nombreCompleto}
                     className="w-12 h-12 rounded-full object-cover ring-4 ring-primary/20" />
              : <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center
                                text-on-primary font-bold text-lg ring-4 ring-primary/20">
                  {iniciales}
                </div>
            }
          </div>
        </div>

        {/* ── Stats rápidas ── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
            </div>
            <div>
              <p className="text-xl font-extrabold text-on-background leading-none">{progreso.pct}%</p>
              <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Promedio</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-secondary text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            </div>
            <div>
              <p className="text-xl font-extrabold text-on-background leading-none">{simsCom}</p>
              <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Completados</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-tertiary/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-tertiary text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}>schedule</span>
            </div>
            <div>
              <p className="text-xl font-extrabold text-on-background leading-none">{progreso.horasSemana}h</p>
              <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">Esta semana</p>
            </div>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 p-4 bg-error-container text-error rounded-xl flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <p className="text-sm font-semibold flex-1">{error}</p>
            <button onClick={retry} className="text-xs font-bold underline">Reintentar</button>
          </div>
        )}

        {/* ── Banner sin plan ── */}
        {!tienePlan && !cargando && (
          <div onClick={() => navigate('/planes')}
               className="mb-8 cursor-pointer rounded-2xl p-5 flex items-center gap-4
                          bg-gradient-to-r from-primary to-primary-container text-white
                          hover:shadow-lg hover:-translate-y-0.5 transition-all">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            </div>
            <div className="flex-1">
              <p className="font-bold">Desbloquea todos los simulacros</p>
              <p className="text-xs text-white/70 mt-0.5">Accede al catálogo completo con un plan Praxia</p>
            </div>
            <span className="material-symbols-outlined text-white/60">chevron_right</span>
          </div>
        )}

        {/* ── Simulacros disponibles ── */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-on-background">Simulacros disponibles</h3>
            <button onClick={() => navigate('/catalogo')}
                    className="text-primary font-semibold text-sm hover:underline">
              Ver todo →
            </button>
          </div>

          {/* Chips de filtro */}
          {!cargando && categorias.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-5">
              {categorias.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFiltroCategoria(cat)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all
                    ${filtroCategoria === cat
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {cargando ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : evalsFiltradas.length === 0 ? (
            <div className="card p-10 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl opacity-40 mb-3 block">search_off</span>
              <p className="font-semibold">Sin simulacros en esta categoría</p>
              <button onClick={() => setFiltroCategoria('Todos')}
                      className="mt-3 text-xs text-primary font-bold hover:underline">
                Ver todos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {evalsFiltradas.map(ev => {
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${estilo.badge}`}>
                        {ev.categoria}
                      </span>
                      <p className="font-bold text-sm truncate mt-1 group-hover:text-primary transition-colors">
                        {ev.title}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        {ev.preguntas} preguntas · {ev.niveles} nivel{ev.niveles !== 1 ? 'es' : ''}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant
                                     group-hover:text-primary transition-colors shrink-0">
                      chevron_right
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Últimos simulacros ── */}
        {intentos.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-on-background">Últimos simulacros</h3>
              <button onClick={() => navigate('/perfil')}
                      className="text-primary font-semibold text-sm hover:underline">
                Ver historial →
              </button>
            </div>
            <div className="space-y-2">
              {intentos.slice(0, 3).map(intento => (
                <div key={intento.id}
                     className="card p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
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
      <aside className="hidden xl:flex w-72 shrink-0 flex-col p-6 gap-6 border-l border-outline-variant/15">

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

          <div className="space-y-3 mb-5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500 font-medium">Meta semanal</span>
              <span className="text-on-background font-bold">
                {progreso.horasSemana}/{progreso.metaSemana} hrs
              </span>
            </div>
            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full transition-all duration-700"
                   style={{ width: `${pctSem}%` }} />
            </div>
            {simsCom > 0 && (
              <p className="text-[10px] text-on-surface-variant">
                {simsCom} simulacro{simsCom !== 1 ? 's' : ''} completado{simsCom !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <button onClick={() => navigate('/perfil')}
                  className="w-full py-2.5 bg-surface-container border border-outline-variant/30 rounded-xl
                             text-xs font-bold text-primary hover:bg-primary-fixed transition-colors">
            Ver historial completo
          </button>
        </div>

        {/* Novedades */}
        <div>
          <h4 className="font-bold text-base mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-lg">gavel</span>
            Novedades
          </h4>
          <div className="space-y-5">
            <article className="group cursor-pointer">
              <p className="text-[10px] font-bold text-tertiary mb-1">DECRETO 452 · 2024</p>
              <h5 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                Modificación en el régimen de carrera administrativa
              </h5>
              <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                Nuevas directrices para el proceso de selección en entidades territoriales.
              </p>
            </article>
            <article className="group cursor-pointer">
              <p className="text-[10px] font-bold text-tertiary mb-1">CIRCULAR CNSC</p>
              <h5 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">
                Nuevas fechas para convocatoria Territorial 8
              </h5>
              <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                La CNSC anuncia ajustes en el cronograma de pruebas escritas.
              </p>
            </article>
          </div>
        </div>

      </aside>
    </div>
  )
}
