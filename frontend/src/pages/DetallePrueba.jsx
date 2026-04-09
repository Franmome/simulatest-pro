import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const ICONOS_CATEGORIA = {
  'CNSC':          'gavel',
  'ICFES':         'school',
  'Saber Pro':     'history_edu',
  'Procuraduría':  'balance',
  'Contraloría':   'account_balance',
  'Defensoría':    'shield',
}

const COLORES_CATEGORIA = {
  'CNSC':          'from-primary to-primary-container',
  'ICFES':         'from-tertiary to-tertiary-container',
  'Saber Pro':     'from-secondary to-[#217128]',
  'Procuraduría':  'from-[#003d9b] to-[#1b6d24]',
  'Contraloría':   'from-primary to-[#0052cc]',
  'Defensoría':    'from-slate-400 to-slate-500',
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
  const navigate  = useNavigate()
  const { id }    = useParams()
  const { user }  = useAuth()
  const [iniciando, setIniciando] = useState(null)

  // ── Carga principal con useFetch ────────────────────────────────────────
  const { data, loading, error, retry } = useFetch(async () => {
    // Evaluación
    const { data: evalData, error: evalErr } = await supabase
      .from('evaluations')
      .select('*, categories(id, name)')
      .eq('id', id)
      .single()
    if (evalErr) throw new Error(evalErr.message)

    // Niveles
    const { data: levels, error: levErr } = await supabase
      .from('levels')
      .select('id, name, description, time_limit, passing_score, sort_order')
      .eq('evaluation_id', id)
      .order('sort_order', { ascending: true })
    if (levErr) throw new Error(levErr.message)

    const niveles = levels || []

    // Preguntas por nivel — una sola query
    let pregsPorNivel = {}
    let totalPregs = 0
    if (niveles.length) {
      const levelIds = niveles.map(l => l.id)
      const { data: qCounts } = await supabase
        .from('questions').select('level_id').in('level_id', levelIds)
      ;(qCounts || []).forEach(q => {
        pregsPorNivel[q.level_id] = (pregsPorNivel[q.level_id] || 0) + 1
      })
      totalPregs = Object.values(pregsPorNivel).reduce((s, c) => s + c, 0)
    }

    // Intentos del usuario por nivel
    let intentosPorNivel = {}
    if (user?.id && niveles.length) {
      const levelIds = niveles.map(l => l.id)
      const { data: intentosData } = await supabase
        .from('attempts')
        .select('id, level_id, score, status, start_time, end_time')
        .eq('user_id', user.id)
        .in('level_id', levelIds)
        .order('start_time', { ascending: false })
      ;(intentosData || []).forEach(intento => {
        if (!intentosPorNivel[intento.level_id]) intentosPorNivel[intento.level_id] = intento
      })
    }

    // Plan activo
    let tienePlan = false
    if (user?.id) {
      const { count } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
      tienePlan = (count || 0) > 0
    }

    return { ev: evalData, niveles, pregsPorNivel, intentosPorNivel, totalPregs, tienePlan }
  }, [id, user?.id])

  const ev               = data?.ev               ?? null
  const niveles          = data?.niveles           ?? []
  const pregsPorNivel    = data?.pregsPorNivel     ?? {}
  const intentosPorNivel = data?.intentosPorNivel  ?? {}
  const totalPregs       = data?.totalPregs        ?? 0
  const tienePlan        = data?.tienePlan         ?? false

  async function iniciarSimulacro(levelId) {
    if (!user)      { navigate('/login');  return }
    if (!tienePlan) { navigate('/planes'); return }
    const pregs = pregsPorNivel[levelId] || 0
    if (pregs === 0) { alert('Este nivel aún no tiene preguntas disponibles.'); return }
    setIniciando(levelId)
    navigate(`/simulacro/${levelId}`)
  }

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 pb-20 max-w-4xl animate-pulse space-y-6">
        <div className="flex gap-6 items-start">
          <div className="w-20 h-20 rounded-2xl bg-surface-container-high flex-shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-4 bg-surface-container-high rounded w-1/4" />
            <div className="h-7 bg-surface-container-high rounded w-3/4" />
            <div className="h-4 bg-surface-container-high rounded w-full" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-surface-container-high rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-surface-container-high rounded-2xl" />)}
        </div>
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────────────────────
  if (error || !ev) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-64 gap-4">
        <span className="material-symbols-outlined text-5xl text-error opacity-50">error</span>
        <p className="text-on-surface-variant font-semibold">{error || 'Evaluación no encontrada'}</p>
        <div className="flex gap-3">
          <button onClick={retry} className="btn-primary px-6 py-2">Reintentar</button>
          <button onClick={() => navigate('/catalogo')}
                  className="px-6 py-2 rounded-full border border-outline-variant text-sm font-semibold">
            Volver al catálogo
          </button>
        </div>
      </div>
    )
  }

  const catNombre = ev.categories?.name ?? 'General'
  const icono     = ICONOS_CATEGORIA[catNombre] || 'quiz'
  const colorGrad = COLORES_CATEGORIA[catNombre] || 'from-primary to-primary-container'
  const durMax    = niveles.length ? formatTiempo(Math.max(...niveles.map(l => l.time_limit ?? 0))) : '—'
  const aprobMax  = niveles.length ? `${Math.max(...niveles.map(l => l.passing_score ?? 0))}%` : '—'

  const totalIntentos  = Object.values(intentosPorNivel).length
  const nivCompletados = Object.values(intentosPorNivel).filter(a => a.status === 'completed').length
  const mejorScore     = Object.values(intentosPorNivel)
    .filter(a => a.score != null)
    .reduce((max, a) => Math.max(max, a.score), 0)

  return (
    <div className="p-8 pb-20 max-w-4xl animate-fade-in">

      {/* Volver */}
      <button onClick={() => navigate('/catalogo')}
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary
                         text-sm font-semibold mb-8 transition-colors group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">
          arrow_back
        </span>
        Volver al catálogo
      </button>

      {/* Cabecera */}
      <div className="flex items-start gap-6 mb-8">
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-b ${colorGrad}
                         flex items-center justify-center shrink-0 shadow-lg`}>
          <span className="material-symbols-outlined text-white text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>{icono}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase text-secondary
                             bg-secondary-container px-2.5 py-1 rounded-full">
              {catNombre}
            </span>
            {tienePlan ? (
              <span className="text-[10px] font-bold text-secondary flex items-center gap-1
                               bg-secondary-container/30 px-2 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                Incluido en tu plan
              </span>
            ) : user ? (
              <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1
                               bg-surface-container px-2 py-1 rounded-full">
                <span className="material-symbols-outlined text-sm">lock</span>
                Requiere plan
              </span>
            ) : null}
          </div>
          <h1 className="text-3xl font-extrabold text-on-background leading-tight mb-2">{ev.title}</h1>
          <p className="text-on-surface-variant leading-relaxed">
            {ev.description || 'Simulacro oficial con preguntas actualizadas.'}
          </p>
        </div>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { icon: 'quiz',       label: 'Preguntas', value: totalPregs || '—' },
          { icon: 'layers',     label: 'Niveles',   value: niveles.length || '—' },
          { icon: 'schedule',   label: 'Duración',  value: durMax },
          { icon: 'verified',   label: 'Aprobación',value: aprobMax },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <span className="material-symbols-outlined text-primary text-xl mb-1 block"
                  style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            <p className="text-xl font-extrabold text-on-background">{s.value}</p>
            <p className="text-[10px] text-on-surface-variant font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Stats de intentos */}
      {totalIntentos > 0 && (
        <div className="card p-5 mb-8 flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-extrabold text-primary">{totalIntentos}</p>
            <p className="text-xs text-on-surface-variant font-medium">Intentos totales</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold text-secondary">{nivCompletados}</p>
            <p className="text-xs text-on-surface-variant font-medium">Niveles completados</p>
          </div>
          {mejorScore > 0 && (
            <div className="text-center">
              <p className={`text-2xl font-extrabold ${mejorScore >= 70 ? 'text-secondary' : 'text-error'}`}>
                {mejorScore}%
              </p>
              <p className="text-xs text-on-surface-variant font-medium">Mejor score</p>
            </div>
          )}
        </div>
      )}

      {/* Niveles */}
      <h2 className="text-xl font-bold mb-4">Selecciona tu nivel</h2>

      {niveles.length === 0 ? (
        <div className="card p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-40 mb-3 block">layers_clear</span>
          <p className="font-semibold">Aún no hay niveles disponibles</p>
          <p className="text-sm mt-1">El administrador está preparando el contenido</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {niveles.map((nv, idx) => {
            const esPrimero    = idx === 0
            const esUltimo     = idx === niveles.length - 1
            const pregsNivel   = pregsPorNivel[nv.id] || 0
            const intentoNivel = intentosPorNivel[nv.id]
            const completado   = intentoNivel?.status === 'completed'
            const enProgreso   = intentoNivel && !completado
            const sinPregs     = pregsNivel === 0

            return (
              <button
                key={nv.id}
                onClick={() => iniciarSimulacro(nv.id)}
                disabled={iniciando === nv.id || sinPregs}
                className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left
                            transition-all group disabled:opacity-50 disabled:cursor-not-allowed
                  ${esPrimero && !completado
                    ? 'border-primary shadow-md bg-surface-container-lowest'
                    : completado
                    ? 'border-secondary/30 bg-secondary-container/10'
                    : 'border-transparent hover:border-primary hover:shadow-md bg-surface-container-lowest'
                  }`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center
                                 transition-colors flex-shrink-0
                  ${completado ? 'bg-secondary text-white'
                    : esPrimero ? 'bg-primary text-white'
                    : 'bg-surface-container text-on-surface group-hover:bg-primary group-hover:text-white'}`}>
                  <span className="material-symbols-outlined"
                        style={{ fontVariationSettings: completado || esPrimero ? "'FILL' 1" : "'FILL' 0" }}>
                    {completado ? 'check_circle' : enProgreso ? 'pending' : esPrimero ? 'play_circle' : esUltimo ? 'emoji_events' : 'radio_button_unchecked'}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">{nv.name}</p>
                  {nv.description && (
                    <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">{nv.description}</p>
                  )}
                  <p className="text-[10px] text-on-surface-variant mt-0.5">
                    Aprobación: {nv.passing_score ?? 70}%
                  </p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {pregsNivel > 0 && (
                      <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">quiz</span>
                        {pregsNivel} preguntas
                      </span>
                    )}
                    {nv.time_limit > 0 && (
                      <span className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">timer</span>
                        {formatTiempo(nv.time_limit)}
                      </span>
                    )}
                  </div>
                  {intentoNivel && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                        ${completado && intentoNivel.score >= (nv.passing_score || 70)
                          ? 'bg-secondary-container text-on-secondary-container'
                          : 'bg-error-container text-error'}`}>
                        Último: {intentoNivel.score ?? '—'}%
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {tiempoRelativo(intentoNivel.start_time)}
                      </span>
                    </div>
                  )}
                </div>

                {iniciando === nv.id
                  ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  : <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors flex-shrink-0">chevron_right</span>
                }
              </button>
            )
          })}
        </div>
      )}

      {/* CTA principal */}
      {niveles.length > 0 && (
        tienePlan ? (
          <button
            onClick={() => iniciarSimulacro(niveles[0].id)}
            disabled={iniciando !== null || (pregsPorNivel[niveles[0]?.id] || 0) === 0}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-3
                       disabled:opacity-60 disabled:cursor-not-allowed">
            {iniciando
              ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Cargando simulacro...</>
              : <><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>Comenzar desde el nivel 1</>
            }
          </button>
        ) : (
          <div className="bg-gradient-to-r from-primary to-primary-container rounded-2xl p-6
                          flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-white">
              <p className="font-bold text-lg">¿Listo para practicar?</p>
              <p className="text-primary-fixed-dim text-sm mt-1">
                Activa tu plan para acceder a todos los niveles y preguntas
              </p>
            </div>
            <button onClick={() => navigate('/planes')}
                    className="bg-white text-primary font-bold px-6 py-3 rounded-full
                               hover:shadow-lg transition-all active:scale-95 whitespace-nowrap text-sm">
              Ver planes →
            </button>
          </div>
        )
      )}
    </div>
  )
}