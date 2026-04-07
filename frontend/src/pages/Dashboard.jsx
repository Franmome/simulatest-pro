import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

// ── Saludo dinámico ────────────────────────────────────────────────────────
function getSaludo() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Buenos días'
  if (h >= 12 && h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

// ── Tiempo relativo ────────────────────────────────────────────────────────
function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

// ── Colores por categoría ──────────────────────────────────────────────────
const CATEGORIA_ESTILOS = {
  'CNSC':        { gradient: 'from-primary to-primary-container',     icon: 'gavel',       badge: 'bg-primary/10 text-primary'    },
  'ICFES':       { gradient: 'from-tertiary to-tertiary-container',   icon: 'school',      badge: 'bg-tertiary/10 text-tertiary'  },
  'Procuraduría':{ gradient: 'from-secondary to-on-secondary-container', icon: 'balance',  badge: 'bg-secondary/10 text-secondary'},
  'Contraloría': { gradient: 'from-primary to-primary-container',     icon: 'account_balance', badge: 'bg-primary/10 text-primary'},
  'default':     { gradient: 'from-primary to-primary-container',     icon: 'quiz',        badge: 'bg-primary/10 text-primary'    },
}

function getEstilo(categoria) {
  return CATEGORIA_ESTILOS[categoria] || CATEGORIA_ESTILOS['default']
}

// ── Skeleton loader ────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`bg-surface-container animate-pulse rounded-xl ${className}`} />
}

export default function Dashboard() {
  const navigate  = useNavigate()
  const { user }  = useAuth()

  // ── Datos del usuario ──────────────────────────────────────────────────
  const nombreCompleto = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'estudiante'
  const primerNombre = nombreCompleto.split(' ')[0]
  const iniciales    = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl    = user?.user_metadata?.avatar_url || null

  // ── Estado ─────────────────────────────────────────────────────────────
  const [perfil,         setPerfil]         = useState({ role: 'user', level: 'Profesional Universitario' })
  const [evaluaciones,   setEvaluaciones]   = useState([])
  const [intentos,       setIntentos]       = useState([])
  const [progreso,       setProgreso]       = useState({ pct: 0, horasSemana: 0, metaSemana: 20 })
  const [tienePlan,      setTienePlan]      = useState(false)
  const [guardandoPerfil,setGuardandoPerfil]= useState(false)
  const [cargando,       setCargando]       = useState(true)

  useEffect(() => {
    if (user?.id) {
      cargarTodo()
    }
  }, [user?.id])

  async function cargarTodo() {
    setCargando(true)
    await Promise.all([
      cargarPerfil(),
      cargarEvaluaciones(),
      cargarIntentos(),
      verificarPlan(),
    ])
    setCargando(false)
  }

  // ── Perfil del usuario desde tabla users ──────────────────────────────
  async function cargarPerfil() {
    const { data } = await supabase
      .from('users')
      .select('role, level')
      .eq('id', user.id)
      .single()
    if (data) setPerfil(data)
  }

  // ── Evaluaciones activas con categoría y conteo de preguntas ──────────
  async function cargarEvaluaciones() {
    const { data } = await supabase
      .from('evaluations')
      .select(`
        id, title, description,
        categories(name),
        levels(id, name)
      `)
      .eq('is_active', true)
      .limit(4)

    if (!data) return

    // Contar preguntas por evaluación
    const conPreguntas = await Promise.all(
      data.map(async (ev) => {
        const levelIds = ev.levels?.map(l => l.id) || []
        let totalPregs = 0
        if (levelIds.length) {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .in('level_id', levelIds)
          totalPregs = count || 0
        }
        return {
          ...ev,
          categoria:  ev.categories?.name || 'General',
          preguntas:  totalPregs,
          niveles:    ev.levels?.length || 0,
        }
      })
    )
    setEvaluaciones(conPreguntas)
  }

  // ── Intentos del usuario + progreso ───────────────────────────────────
  async function cargarIntentos() {
    const { data } = await supabase
      .from('attempts')
      .select('id, score, status, start_time, end_time, levels(name, time_limit)')
      .eq('user_id', user.id)
      .order('start_time', { ascending: false })
      .limit(20)

    if (!data) return
    setIntentos(data)

    // Progreso general — promedio de scores completados
    const completados = data.filter(a => a.status === 'completed' && a.score != null)
    const pct = completados.length
      ? Math.round(completados.reduce((s, a) => s + a.score, 0) / completados.length)
      : 0

    // Horas estudiadas esta semana
    const inicioSemana = new Date()
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay())
    inicioSemana.setHours(0, 0, 0, 0)

    const intentosSemana = data.filter(a =>
      a.start_time && new Date(a.start_time) >= inicioSemana
    )
    const segundosSemana = intentosSemana.reduce((sum, a) => {
      if (a.start_time && a.end_time) {
        return sum + Math.floor((new Date(a.end_time) - new Date(a.start_time)) / 1000)
      }
      return sum + (a.levels?.time_limit || 0) * 60
    }, 0)
    const horasSemana = Math.round(segundosSemana / 3600 * 10) / 10

    setProgreso({ pct, horasSemana, metaSemana: 20 })
  }

  // ── Verificar si tiene plan activo ────────────────────────────────────
  async function verificarPlan() {
    const { count } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
    setTienePlan((count || 0) > 0)
  }

  // ── Guardar perfil (tipo usuario y nivel) ─────────────────────────────
  async function guardarPerfil(campo, valor) {
    const nuevo = { ...perfil, [campo]: valor }
    setPerfil(nuevo)
    setGuardandoPerfil(true)
    await supabase.from('users').update({ [campo]: valor }).eq('id', user.id)
    setGuardandoPerfil(false)
  }

  // ── Circumferencia del círculo de progreso ────────────────────────────
  const radio      = 56
  const circunf    = 2 * Math.PI * radio   // ≈ 351.8
  const offset     = circunf - (progreso.pct / 100) * circunf
  const pctSemana  = Math.min((progreso.horasSemana / progreso.metaSemana) * 100, 100)

  // ── Render ─────────────────────────────────────────────────────────────
  return (
   <div className="flex flex-col md:flex-row" style={{ paddingBottom: '3rem' }}>

      {/* ── Contenido principal ── */}
      {/* ✅ Cambio 1: padding responsivo: px-4 md:px-8 en lugar de p-8 fijo */}
      <section className="flex-1 p-4 md:p-8 overflow-y-auto">

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
            {avatarUrl ? (
              <img src={avatarUrl} alt={primerNombre}
                   className="w-14 h-14 rounded-2xl object-cover shadow-md" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container
                              flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                {iniciales}
              </div>
            )}
          </div>
        </div>

        {/* Info usuario */}
        <div className="mb-8 p-4 bg-surface-container-low rounded-2xl flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt={primerNombre}
                 className="w-10 h-10 rounded-xl object-cover shadow-sm" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center
                            text-white font-bold text-sm">
              {iniciales}
            </div>
          )}
          <div>
            <p className="font-bold text-on-surface text-sm">{nombreCompleto}</p>
            <p className="text-xs text-on-surface-variant">{user?.email}</p>
          </div>
          {guardandoPerfil && (
            <span className="ml-2 text-xs text-on-surface-variant animate-pulse">Guardando...</span>
          )}
          <button onClick={() => navigate('/perfil')}
                  className="ml-auto text-xs font-bold text-primary hover:underline">
            Ver perfil →
          </button>
        </div>

        {/* Perfil y nivel — guarda en Supabase */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Perfil de Usuario
              </span>
              <span className="material-symbols-outlined text-primary-container">person_search</span>
            </div>
            <div className="flex gap-3">
              {['Estudiante', 'Trabajador'].map(tipo => (
                <button
                  key={tipo}
                  onClick={() => guardarPerfil('role', tipo.toLowerCase())}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all active:scale-95
                    ${perfil.role === tipo.toLowerCase() || (tipo === 'Estudiante' && perfil.role === 'user')
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
            <div className="text-center py-12 bg-surface-container-low rounded-2xl">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">
                quiz
              </span>
              <p className="text-on-surface-variant font-medium">
                No hay simulacros disponibles aún
              </p>
              <p className="text-xs text-on-surface-variant mt-1">
                El administrador pronto publicará contenido
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {evaluaciones.map(ev => {
                const estilo = getEstilo(ev.categoria)
                return (
                  <div
                    key={ev.id}
                    onClick={() => navigate(`/prueba/${ev.id}`)}
                    className="card cursor-pointer flex group overflow-hidden
                               hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    <div className={`w-28 bg-gradient-to-b ${estilo.gradient} shrink-0
                                    flex items-center justify-center`}>
                      <span className="material-symbols-outlined text-white text-4xl"
                            style={{ fontVariationSettings: "'FILL' 1" }}>
                        {estilo.icon}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col justify-between flex-1">
                      <div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${estilo.badge}`}>
                          {ev.categoria}
                        </span>
                        <h4 className="font-bold text-base mt-2 group-hover:text-primary transition-colors leading-tight">
                          {ev.title}
                        </h4>
                        <p className="text-xs text-on-surface-variant mt-1">
                          {ev.preguntas > 0 ? `${ev.preguntas} preguntas · ` : ''}
                          {ev.niveles} {ev.niveles === 1 ? 'nivel' : 'niveles'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        {tienePlan ? (
                          <span className="text-xs font-bold text-secondary flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Disponible
                          </span>
                        ) : (
                          <span className="text-xs text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm">lock</span>
                            Requiere plan
                          </span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); navigate(`/prueba/${ev.id}`) }}
                          className="bg-primary-container text-white px-4 py-2 rounded-full
                                     text-xs font-bold hover:bg-primary transition-colors active:scale-90">
                          INICIAR
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* CTA planes si no tiene plan */}
              {!tienePlan && (
                <div
                  onClick={() => navigate('/planes')}
                  className="bg-gradient-to-br from-primary to-primary-container rounded-2xl
                             cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all
                             flex items-center justify-center p-8 group">
                  <div className="text-center text-white">
                    <span className="material-symbols-outlined text-5xl mb-3 block"
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                      workspace_premium
                    </span>
                    <h4 className="font-bold text-lg">Desbloquear todo el catálogo</h4>
                    <p className="text-primary-fixed-dim text-sm mt-1">Desde $19.900 COP/mes</p>
                    <span className="mt-4 inline-block bg-white text-primary font-bold
                                     px-6 py-2 rounded-full text-sm group-hover:shadow-md transition-shadow">
                      Ver planes →
                    </span>
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
                    <p className="font-bold text-sm truncate">
                      {intento.levels?.name || 'Simulacro'}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {tiempoRelativo(intento.start_time)}
                    </p>
                  </div>
                  {intento.status === 'completed' && intento.score != null && (
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-extrabold
                        ${intento.score >= 70 ? 'text-secondary' : 'text-error'}`}>
                        {intento.score}%
                      </p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold">
                        {intento.score >= 70 ? 'Aprobado' : 'Reprobado'}
                      </p>
                    </div>
                  )}
                  {intento.status !== 'completed' && (
                    <button
                      onClick={() => navigate(`/simulacro/${intento.id}`)}
                      className="text-xs font-bold text-primary hover:underline shrink-0">
                      Continuar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Próximas convocatorias — estáticas por ahora, se actualizarán en Fase 2 */}
        <div>
          <h3 className="text-2xl font-bold text-on-background mb-6">Próximas convocatorias</h3>
          <div className="space-y-4">
            {/* ✅ Cambio 3: gap responsivo en el contenedor de cada convocatoria */}
            <div className="bg-white p-4 rounded-xl flex items-center justify-between
                            border-l-4 border-error shadow-sm hover:translate-x-1 transition-transform">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="bg-error-container text-error p-3 rounded-xl">
                  <span className="material-symbols-outlined">timer</span>
                </div>
                <div>
                  <p className="font-bold text-on-background">Simulacro Nacional CNSC</p>
                  <p className="text-xs text-on-surface-variant">Próxima convocatoria disponible</p>
                </div>
              </div>
              {/* ✅ Cambio 2: botón VER con padding responsivo y shrink-0 */}
              <button
                onClick={() => navigate('/catalogo')}
                className="px-3 md:px-6 py-2 bg-error text-white text-xs font-bold rounded-full
                           hover:shadow-lg transition-shadow shrink-0">
                VER
              </button>
            </div>
            <div className="bg-white p-4 rounded-xl flex items-center justify-between
                            border-l-4 border-primary shadow-sm hover:translate-x-1 transition-transform">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="bg-primary-fixed text-primary p-3 rounded-xl">
                  <span className="material-symbols-outlined">event</span>
                </div>
                <div>
                  <p className="font-bold text-on-background">Prueba Saber Pro 2025</p>
                  <p className="text-xs text-on-surface-variant">Sábado, 12 de Octubre</p>
                </div>
              </div>
              <button className="px-6 py-2 border border-primary text-primary text-xs font-bold
                                 rounded-full hover:bg-primary-fixed transition-colors">
                RECORDAR
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Sidebar derecho ── */}
      <aside className="w-full md:w-80 md:shrink-0">

        {/* Progreso real */}
        <div className="bg-surface-container-low rounded-3xl p-6 text-center">
          <h4 className="font-bold text-lg mb-6">Tu Progreso</h4>

          {cargando ? (
            <Skeleton className="w-32 h-32 rounded-full mx-auto mb-6" />
          ) : (
            <div className="relative inline-flex items-center justify-center mb-6">
              <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r={radio} fill="transparent"
                        stroke="currentColor" strokeWidth="8"
                        className="text-surface-container-highest" />
                <circle cx="64" cy="64" r={radio} fill="transparent"
                        stroke="currentColor" strokeWidth="8"
                        strokeDasharray={circunf}
                        strokeDashoffset={offset}
                        strokeLinecap="round"
                        className="text-secondary transition-all duration-1000" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-on-background">
                  {progreso.pct}%
                </span>
                <span className="text-[10px] text-slate-500 font-bold uppercase">
                  {intentos.filter(a => a.status === 'completed').length > 0
                    ? 'Promedio' : 'Sin datos'}
                </span>
              </div>
            </div>
          )}

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

          <button
            onClick={() => navigate('/perfil')}
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

        {/* Frase motivacional */}
        <div className="mt-auto p-5 bg-primary-container rounded-2xl text-white">
          <span className="material-symbols-outlined mb-3 block"
                style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
          <p className="text-sm font-medium italic leading-relaxed">
            "La preparación es la clave del éxito. Tu esfuerzo de hoy es el cargo de mañana."
          </p>
        </div>
      </aside>
    </div>
  )
}