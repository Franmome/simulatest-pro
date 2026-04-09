import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'
import { useFetch } from '../hooks/useFetch'

export default function Perfil() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // ── Carga principal con useFetch ────────────────────────────────────────
  const { data, loading: cargando, error, retry } = useFetch(async () => {
    if (!user?.id) return null

    const [perfilRes, compraRes, intentosRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('purchases')
        .select('*, packages(name, type)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase.from('attempts')
        .select('*, levels(name, evaluation_id, evaluations(title))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const perfil   = perfilRes.data  || null
    const plan     = compraRes.data  || null
    const intentos = intentosRes.data || []

    let stats = { total: 0, aprobados: 0, promedio: 0, horas: 0 }
    if (intentos.length > 0) {
      const total     = intentos.length
      const aprobados = intentos.filter(i => i.status === 'passed').length
      const promedio  = Math.round(intentos.reduce((acc, i) => acc + (i.score || 0), 0) / total)
      const tiempoMs  = intentos.reduce((acc, i) => {
        if (i.start_time && i.end_time)
          return acc + (new Date(i.end_time) - new Date(i.start_time))
        return acc
      }, 0)
      const horas = Math.round(tiempoMs / 1000 / 60 / 60)
      stats = { total, aprobados, promedio, horas }
    }

    return { perfil, plan, stats, historial: intentos.slice(0, 5) }
  }, [user?.id])

  const perfil   = data?.perfil   ?? null
  const plan     = data?.plan     ?? null
  const stats    = data?.stats    ?? { total: 0, aprobados: 0, promedio: 0, horas: 0 }
  const historial = data?.historial ?? []

  const nombreCompleto = perfil?.full_name
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Usuario'

  const iniciales = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl = user?.user_metadata?.avatar_url || null

  const fechaRelativa = (fecha) => {
    if (!fecha) return ''
    const dias = Math.floor((Date.now() - new Date(fecha)) / 86400000)
    if (dias === 0) return 'Hoy'
    if (dias === 1) return 'Ayer'
    if (dias < 7)  return `Hace ${dias} días`
    if (dias < 30) return `Hace ${Math.floor(dias / 7)} semanas`
    return `Hace ${Math.floor(dias / 30)} meses`
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="p-8 max-w-4xl">
        <div className="flex flex-col gap-6 animate-pulse">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-2xl bg-surface-container-high" />
            <div className="space-y-2">
              <div className="h-6 w-48 bg-surface-container-high rounded-xl" />
              <div className="h-4 w-36 bg-surface-container-high rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-surface-container-high rounded-2xl" />)}
          </div>
          <div className="h-48 bg-surface-container-high rounded-2xl" />
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-64 gap-4">
        <span className="material-symbols-outlined text-5xl text-error opacity-50">error</span>
        <p className="text-on-surface-variant font-semibold">{error}</p>
        <button onClick={retry} className="btn-primary px-6 py-2">Reintentar</button>
      </div>
    )
  }

  return (
    <div className="p-8 pb-20 max-w-4xl animate-fade-in">

      {/* Info del usuario */}
      <div className="flex items-center gap-6 mb-10">
        {avatarUrl
          ? <img src={avatarUrl} alt={nombreCompleto} className="w-20 h-20 rounded-2xl object-cover shadow-lg" />
          : <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white text-3xl font-extrabold shadow-lg font-headline">
              {iniciales}
            </div>
        }
        <div>
          <h1 className="text-3xl font-extrabold text-on-background">{nombreCompleto}</h1>
          <p className="text-on-surface-variant">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="bg-secondary-container text-on-secondary-container text-xs font-bold px-3 py-1 rounded-full">
              {plan ? plan.packages?.name : 'Sin plan activo'}
            </span>
            <span className="bg-primary-fixed text-primary text-xs font-bold px-3 py-1 rounded-full capitalize">
              {perfil?.role || 'Estudiante'}
            </span>
          </div>
        </div>
        <button className="ml-auto border border-outline-variant text-on-surface-variant font-semibold px-5 py-2 rounded-full hover:bg-surface-container transition-colors text-sm">
          Editar perfil
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { val: stats.total,                             label: 'Simulacros hechos', color: 'text-primary'    },
          { val: stats.total > 0 ? `${stats.promedio}%` : '—', label: 'Promedio general', color: 'text-secondary'  },
          { val: stats.horas > 0 ? `${stats.horas}h` : '0h',   label: 'Tiempo estudiado', color: 'text-tertiary'   },
          { val: `🏆 ${stats.aprobados}`,                  label: 'Aprobados',        color: 'text-on-background'},
        ].map(s => (
          <div key={s.label} className="card p-5 text-center">
            <span className={`text-3xl font-extrabold ${s.color}`}>{s.val}</span>
            <p className="text-xs text-on-surface-variant mt-1 font-semibold">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Historial */}
      <div className="card p-6 mb-8">
        <h3 className="font-bold text-lg mb-5">Historial de simulacros</h3>

        {historial.length === 0 ? (
          <div className="text-center py-10">
            <span className="material-symbols-outlined text-5xl text-outline mb-3 block">assignment</span>
            <p className="text-on-surface-variant font-medium">Aún no has hecho ningún simulacro</p>
            <button onClick={() => navigate('/catalogo')}
                    className="mt-4 text-primary font-bold text-sm hover:underline">
              Ver catálogo →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {historial.map((intento) => {
              const aprobado = intento.status === 'passed'
              const titulo   = intento.levels?.evaluations?.title || 'Simulacro'
              const nivel    = intento.levels?.name || ''
              const score    = intento.score ?? 0
              return (
                <div key={intento.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center
                      ${aprobado ? 'bg-primary-fixed text-primary' : 'bg-error-container text-error'}`}>
                      <span className="material-symbols-outlined text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}>
                        {aprobado ? 'verified' : 'cancel'}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-sm">{titulo} – {nivel}</p>
                      <p className="text-xs text-on-surface-variant">{fechaRelativa(intento.created_at)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-extrabold ${aprobado ? 'text-secondary' : 'text-error'}`}>
                      {score}%
                    </span>
                    <p className={`text-[10px] font-bold uppercase ${aprobado ? 'text-secondary' : 'text-error'}`}>
                      {aprobado ? 'Aprobado' : 'No aprobado'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <button onClick={() => navigate('/catalogo')} className="btn-primary w-full py-4">
        📚 Seguir practicando
      </button>
    </div>
  )
}