import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

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
  'CNSC':        { gradient: 'from-primary to-primary-container',        icon: 'gavel',           badge: 'bg-primary/10 text-primary'    },
  'ICFES':       { gradient: 'from-tertiary to-tertiary-container',      icon: 'school',          badge: 'bg-tertiary/10 text-tertiary'  },
  'Procuraduría':{ gradient: 'from-secondary to-on-secondary-container', icon: 'balance',         badge: 'bg-secondary/10 text-secondary'},
  'Contraloría': { gradient: 'from-primary to-primary-container',        icon: 'account_balance', badge: 'bg-primary/10 text-primary'    },
  'default':     { gradient: 'from-primary to-primary-container',        icon: 'quiz',            badge: 'bg-primary/10 text-primary'    },
}
function getEstilo(cat) { return CATEGORIA_ESTILOS[cat] || CATEGORIA_ESTILOS['default'] }
function Skeleton({ className = '' }) { return <div className={`bg-surface-container animate-pulse rounded-xl ${className}`} /> }

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const nombreCompleto = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'estudiante'
  const primerNombre = nombreCompleto.split(' ')[0]
  const iniciales    = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl    = user?.user_metadata?.avatar_url || null

  const [perfil,          setPerfil]          = useState({ role: 'user', level: 'Profesional Universitario' })
  const [evaluaciones,    setEvaluaciones]    = useState([])
  const [intentos,        setIntentos]        = useState([])
  const [progreso,        setProgreso]        = useState({ pct: 0, horasSemana: 0, metaSemana: 20 })
  const [tienePlan,       setTienePlan]       = useState(false)
  const [guardandoPerfil, setGuardandoPerfil] = useState(false)
  const [cargando,        setCargando]        = useState(true)

  useEffect(() => { if (user?.id) cargarTodo() }, [user?.id])

  async function cargarTodo() {
    setCargando(true)
    await Promise.all([cargarPerfil(), cargarEvaluaciones(), cargarIntentos(), verificarPlan()])
    setCargando(false)
  }

  async function cargarPerfil() {
    const { data } = await supabase.from('users').select('role, level').eq('id', user.id).single()
    if (data) setPerfil(data)
  }

  async function cargarEvaluaciones() {
    const { data } = await supabase.from('evaluations').select('id, title, description, categories(name), levels(id, name)').eq('is_active', true).limit(4)
    if (!data) return
    const conPreguntas = await Promise.all(data.map(async ev => {
      const levelIds = ev.levels?.map(l => l.id) || []
      let totalPregs = 0
      if (levelIds.length) {
        const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).in('level_id', levelIds)
        totalPregs = count || 0
      }
      return { ...ev, categoria: ev.categories?.name || 'General', preguntas: totalPregs, niveles: ev.levels?.length || 0 }
    }))
    setEvaluaciones(conPreguntas)
  }

  async function cargarIntentos() {
    const { data } = await supabase.from('attempts').select('id, score, status, start_time, end_time, levels(name, time_limit)').eq('user_id', user.id).order('start_time', { ascending: false }).limit(20)
    if (!data) return
    setIntentos(data)
    const completados = data.filter(a => a.status === 'completed' && a.score != null)
    const pct = completados.length ? Math.round(completados.reduce((s, a) => s + a.score, 0) / completados.length) : 0
    const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay()); inicioSemana.setHours(0,0,0,0)
    const seg = data.filter(a => a.start_time && new Date(a.start_time) >= inicioSemana).reduce((sum, a) => {
      if (a.start_time && a.end_time) return sum + Math.floor((new Date(a.end_time) - new Date(a.start_time)) / 1000)
      return sum + (a.levels?.time_limit || 0) * 60
    }, 0)
    setProgreso({ pct, horasSemana: Math.round(seg / 3600 * 10) / 10, metaSemana: 20 })
  }

  async function verificarPlan() {
    const { count } = await supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString())
    setTienePlan((count || 0) > 0)
  }

  async function guardarPerfil(campo, valor) {
    setPerfil(p => ({ ...p, [campo]: valor }))
    setGuardandoPerfil(true)
    await supabase.from('users').update({ [campo]: valor }).eq('id', user.id)
    setGuardandoPerfil(false)
  }

  const radio   = 56
  const circunf = 2 * Math.PI * radio
  const offset  = circunf - (progreso.pct / 100) * circunf
  const pctSem  = Math.min((progreso.horasSemana / progreso.metaSemana) * 100, 100)

  return (
    <div className="p-4 md:p-8 pb-24 animate-fade-in">

      {/* Saludo */}
      <div className="mb-8 flex items-center gap-3">
        {avatarUrl
          ? <img src={avatarUrl} alt={primerNombre} className="w-12 h-12 rounded-2xl object-cover shadow-md shrink-0" />
          : <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white font-extrabold shrink-0">{iniciales}</div>
        }
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-on-background truncate">
            {getSaludo()}, {primerNombre}! 👋
          </h1>
          <p className="text-on-surface-variant text-xs">Hoy es un excelente día para avanzar hacia tu meta profesional.</p>
        </div>
        {guardandoPerfil && <span className="text-xs text-on-surface-variant animate-pulse ml-auto">Guardando...</span>}
      </div>

      {/* Perfil y nivel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Perfil de Usuario</span>
            <span className="material-symbols-outlined text-primary-container text-lg">person_search</span>
          </div>
          <div className="flex gap-2">
            {['Estudiante', 'Trabajador'].map(tipo => (
              <button key={tipo} onClick={() => guardarPerfil('role', tipo.toLowerCase())}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95
                  ${perfil.role === tipo.toLowerCase() || (tipo === 'Estudiante' && perfil.role === 'user')
                    ? 'bg-primary text-white shadow-md' : 'bg-surface-container-high text-on-surface-variant'}`}>
                {tipo}
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-tertiary">Nivel de Aspiración</span>
            <span className="material-symbols-outlined text-tertiary text-lg">military_tech</span>
          </div>
          <select value={perfil.level || 'Profesional Universitario'} onChange={e => guardarPerfil('level', e.target.value)}
            className="w-full bg-surface-container-low border-none rounded-xl py-2.5 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-tertiary/30">
            <option>Profesional Universitario</option>
            <option>Directivo</option>
            <option>Técnico</option>
            <option>Auxiliar / Asistencial</option>
          </select>
        </div>
      </div>

      {/* Progreso */}
      <div className="card p-4 mb-8 flex items-center gap-4">
        <div className="relative inline-flex items-center justify-center shrink-0">
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={radio} fill="transparent" stroke="currentColor" strokeWidth="10" className="text-surface-container-highest" />
            <circle cx="64" cy="64" r={radio} fill="transparent" stroke="currentColor" strokeWidth="10"
              strokeDasharray={circunf} strokeDashoffset={offset} strokeLinecap="round" className="text-secondary transition-all duration-1000" />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-lg font-extrabold">{progreso.pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm mb-2">Tu Progreso</p>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-on-surface-variant">Meta semanal</span>
            <span className="font-bold">{progreso.horasSemana}/{progreso.metaSemana} hrs</span>
          </div>
          <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-secondary rounded-full transition-all duration-700" style={{ width: `${pctSem}%` }} />
          </div>
          <p className="text-[10px] text-on-surface-variant mt-1">
            {intentos.filter(a => a.status === 'completed').length} simulacros completados
          </p>
        </div>
        <button onClick={() => navigate('/perfil')} className="text-xs font-bold text-primary hover:underline shrink-0">Ver →</button>
      </div>

      {/* Simulacros disponibles */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Simulacros disponibles</h3>
          <button onClick={() => navigate('/catalogo')} className="text-primary font-semibold text-sm hover:underline">Ver todo →</button>
        </div>
        {cargando ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-24" />)}</div>
        ) : evaluaciones.length === 0 ? (
          <div className="text-center py-10 bg-surface-container-low rounded-2xl">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2 block">quiz</span>
            <p className="text-on-surface-variant text-sm">No hay simulacros disponibles aún</p>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluaciones.map(ev => {
              const estilo = getEstilo(ev.categoria)
              return (
                <div key={ev.id} onClick={() => navigate(`/prueba/${ev.id}`)}
                  className="card cursor-pointer flex overflow-hidden hover:shadow-md transition-all">
                  <div className={`w-16 bg-gradient-to-b ${estilo.gradient} shrink-0 flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>{estilo.icon}</span>
                  </div>
                  <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
                    <div>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${estilo.badge}`}>{ev.categoria}</span>
                      <h4 className="font-bold text-sm mt-1 leading-tight truncate">{ev.title}</h4>
                      <p className="text-xs text-on-surface-variant">{ev.preguntas > 0 ? `${ev.preguntas} preguntas · ` : ''}{ev.niveles} {ev.niveles === 1 ? 'nivel' : 'niveles'}</p>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {tienePlan
                        ? <span className="text-xs font-bold text-secondary flex items-center gap-1"><span className="material-symbols-outlined text-sm">check_circle</span>Disponible</span>
                        : <span className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-sm">lock</span>Requiere plan</span>
                      }
                      <button onClick={e => { e.stopPropagation(); navigate(`/prueba/${ev.id}`) }}
                        className="bg-primary text-white px-3 py-1.5 rounded-full text-xs font-bold active:scale-90">
                        INICIAR
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {!tienePlan && (
              <div onClick={() => navigate('/planes')}
                className="bg-gradient-to-br from-primary to-primary-container rounded-2xl cursor-pointer p-6 flex items-center gap-4">
                <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                <div className="text-white">
                  <h4 className="font-bold text-sm">Desbloquear todo el catálogo</h4>
                  <p className="text-xs opacity-80">Desde $19.900 COP/mes</p>
                </div>
                <span className="ml-auto bg-white text-primary font-bold px-4 py-2 rounded-full text-xs">Ver →</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Últimos intentos */}
      {intentos.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Últimos simulacros</h3>
            <button onClick={() => navigate('/perfil')} className="text-primary font-semibold text-sm hover:underline">Ver historial →</button>
          </div>
          <div className="space-y-2">
            {intentos.slice(0, 3).map(intento => (
              <div key={intento.id} className="bg-white p-3 rounded-xl flex items-center gap-3 border border-outline-variant/15">
                <div className={`p-2 rounded-xl shrink-0 ${intento.status === 'completed' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined text-sm">{intento.status === 'completed' ? 'check_circle' : 'pending'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{intento.levels?.name || 'Simulacro'}</p>
                  <p className="text-xs text-on-surface-variant">{tiempoRelativo(intento.start_time)}</p>
                </div>
                {intento.status === 'completed' && intento.score != null && (
                  <div className="text-right shrink-0">
                    <p className={`text-base font-extrabold ${intento.score >= 70 ? 'text-secondary' : 'text-error'}`}>{intento.score}%</p>
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold">{intento.score >= 70 ? 'Aprobado' : 'Reprobado'}</p>
                  </div>
                )}
                {intento.status !== 'completed' && (
                  <button onClick={() => navigate(`/simulacro/${intento.id}`)} className="text-xs font-bold text-primary hover:underline shrink-0">Continuar</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximas convocatorias */}
      <div className="mb-8">
        <h3 className="text-lg font-bold mb-4">Próximas convocatorias</h3>
        <div className="space-y-3">
          <div className="bg-white p-3 rounded-xl flex items-center gap-3 border-l-4 border-error shadow-sm">
            <div className="bg-error-container text-error p-2 rounded-xl shrink-0"><span className="material-symbols-outlined text-sm">timer</span></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">Simulacro Nacional CNSC</p>
              <p className="text-xs text-on-surface-variant">Próxima convocatoria disponible</p>
            </div>
            <button onClick={() => navigate('/catalogo')} className="px-3 py-1.5 bg-error text-white text-xs font-bold rounded-full shrink-0">VER</button>
          </div>
          <div className="bg-white p-3 rounded-xl flex items-center gap-3 border-l-4 border-primary shadow-sm">
            <div className="bg-primary-fixed text-primary p-2 rounded-xl shrink-0"><span className="material-symbols-outlined text-sm">event</span></div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm truncate">Prueba Saber Pro 2025</p>
              <p className="text-xs text-on-surface-variant">Sábado, 12 de Octubre</p>
            </div>
            <button className="px-3 py-1.5 border border-primary text-primary text-xs font-bold rounded-full shrink-0">RECORDAR</button>
          </div>
        </div>
      </div>

      {/* Novedades */}
      <div className="mb-8">
        <h4 className="font-bold text-lg mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">gavel</span>Novedades
        </h4>
        <div className="space-y-4">
          <article className="group cursor-pointer p-4 card">
            <p className="text-[10px] font-bold text-tertiary mb-1">DECRETO 452 - 2024</p>
            <h5 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">Modificación en el régimen de carrera administrativa...</h5>
            <p className="text-xs text-on-surface-variant mt-1">Nuevas directrices para el proceso de selección en entidades territoriales.</p>
          </article>
          <article className="group cursor-pointer p-4 card">
            <p className="text-[10px] font-bold text-tertiary mb-1">CIRCULAR CNSC</p>
            <h5 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">Nuevas fechas para convocatoria Territorial 8...</h5>
            <p className="text-xs text-on-surface-variant mt-1">La CNSC anuncia ajustes en el cronograma de pruebas escritas.</p>
          </article>
        </div>
      </div>

      {/* Frase motivacional */}
      <div className="p-5 bg-primary-container rounded-2xl text-white">
        <span className="material-symbols-outlined mb-2 block" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
        <p className="text-sm font-medium italic leading-relaxed">"La preparación es la clave del éxito. Tu esfuerzo de hoy es el cargo de mañana."</p>
      </div>

    </div>
  )
}