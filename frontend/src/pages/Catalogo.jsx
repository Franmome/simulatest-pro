import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

const BADGE_CATEGORIA = {
  'CNSC':         'bg-primary/10 text-primary',
  'ICFES':        'bg-tertiary/10 text-tertiary',
  'Saber Pro':    'bg-secondary/10 text-secondary',
  'Procuraduría': 'bg-primary/10 text-primary',
  'Contraloría':  'bg-primary/10 text-primary',
  'Defensoría':   'bg-slate-100 text-slate-600',
}

function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-3 bg-surface-container-high" />
      <div className="p-6 space-y-3">
        <div className="h-4 bg-surface-container-high rounded w-1/3" />
        <div className="h-5 bg-surface-container-high rounded w-3/4" />
        <div className="h-4 bg-surface-container-high rounded w-full" />
        <div className="h-4 bg-surface-container-high rounded w-2/3" />
        <div className="flex justify-between mt-6">
          <div className="h-4 bg-surface-container-high rounded w-1/3" />
          <div className="h-8 bg-surface-container-high rounded-full w-24" />
        </div>
      </div>
    </div>
  )
}

export default function Catalogo() {
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const [filtro,   setFiltro]   = useState('Todos')
  const [busqueda, setBusqueda] = useState('')
  const [tienePlan, setTienePlan] = useState(false)

  // ── Carga principal con useFetch ────────────────────────────────────────
  const { data, loading, error, retry } = useFetch(async () => {
    const [{ data: cats, error: errCats }, { data: evals, error: errEvals }] =
      await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase
          .from('evaluations')
          .select(`
            id, title, description, is_active,
            categories(id, name),
            levels(id, time_limit, passing_score)
          `)
          .eq('is_active', true)
          .order('title'),
      ])

    if (errCats)  throw new Error(errCats.message)
    if (errEvals) throw new Error(errEvals.message)

    // Una sola query para contar todas las preguntas
    const todosLevelIds = (evals || []).flatMap(ev => ev.levels?.map(l => l.id) || [])
    let pregsPorLevel = {}

    if (todosLevelIds.length) {
      const { data: qCounts } = await supabase
        .from('questions')
        .select('level_id')
        .in('level_id', todosLevelIds)
      ;(qCounts || []).forEach(q => {
        pregsPorLevel[q.level_id] = (pregsPorLevel[q.level_id] || 0) + 1
      })
    }

    const conPreguntas = (evals || []).map(ev => ({
      ...ev,
      totalPreguntas: ev.levels?.reduce((sum, l) => sum + (pregsPorLevel[l.id] || 0), 0) || 0,
    }))

    return { categorias: cats || [], evaluaciones: conPreguntas }
  })

  const categorias   = data?.categorias   ?? []
  const evaluaciones = data?.evaluaciones ?? []

  // ── Verificar plan activo ───────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .then(({ count }) => setTienePlan((count || 0) > 0))
  }, [user?.id])

  // ── Filtrado + búsqueda ─────────────────────────────────────────────────
  const lista = evaluaciones
    .filter(e => filtro === 'Todos' || e.categories?.name === filtro)
    .filter(e => !busqueda.trim() ||
      e.title.toLowerCase().includes(busqueda.toLowerCase()) ||
      e.description?.toLowerCase().includes(busqueda.toLowerCase())
    )

  const categoriasBtns = ['Todos', ...categorias.map(c => c.name)]
  const iconoCat = n => ICONOS_CATEGORIA[n]  || 'quiz'
  const colorCat = n => COLORES_CATEGORIA[n] || 'from-slate-400 to-slate-500'
  const badgeCat = n => BADGE_CATEGORIA[n]   || 'bg-primary/10 text-primary'

  function duracionMax(ev) {
    if (!ev.levels?.length) return null
    const max = Math.max(...ev.levels.map(l => l.time_limit ?? 0))
    if (!max) return null
    return max >= 60
      ? `${Math.floor(max / 60)}h ${max % 60 > 0 ? `${max % 60}m` : ''}`.trim()
      : `${max}m`
  }

  return (
    <div className="p-8 pb-20 animate-fade-in">

      {/* ── Encabezado ── */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-on-background tracking-tight mb-1">
          Catálogo de Simulacros
        </h1>
        <p className="text-on-surface-variant">
          Prepárate con los mejores simulacros para convocatorias nacionales
        </p>
      </div>

      {/* ── Búsqueda + filtros ── */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2
                           text-on-surface-variant text-lg">search</span>
          <input
            className="w-full bg-surface-container-low border-none rounded-full
                       pl-10 pr-4 py-2.5 text-sm outline-none
                       focus:ring-2 focus:ring-primary/20
                       placeholder:text-on-surface-variant"
            placeholder="Buscar simulacro..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-on-surface-variant hover:text-on-surface">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {categoriasBtns.map(c => (
            <button
              key={c}
              onClick={() => setFiltro(c)}
              className={`px-4 py-2 font-semibold text-sm rounded-full transition-all
                ${filtro === c
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary'
                }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Contador */}
      {!loading && !error && (
        <p className="text-xs text-on-surface-variant mb-6 font-medium">
          {lista.length === 0
            ? 'Sin resultados'
            : `${lista.length} simulacro${lista.length !== 1 ? 's' : ''} encontrado${lista.length !== 1 ? 's' : ''}`
          }
          {busqueda && <span className="text-primary font-bold"> para "{busqueda}"</span>}
        </p>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 p-4 bg-error-container text-error rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-semibold flex-1">{error}</p>
          <button
            onClick={retry}
            className="text-xs font-bold underline hover:opacity-70 transition-opacity">
            Reintentar
          </button>
        </div>
      )}

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && lista.length === 0 && !error && (
          <div className="col-span-full flex flex-col items-center justify-center py-20
                          text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-40">search_off</span>
            <p className="font-semibold">
              {busqueda
                ? `Sin resultados para "${busqueda}"`
                : 'No hay evaluaciones en esta categoría'}
            </p>
            <button
              onClick={() => { setFiltro('Todos'); setBusqueda('') }}
              className="mt-3 text-primary text-sm font-bold hover:underline">
              Ver todas
            </button>
          </div>
        )}

        {!loading && lista.map(ev => {
          const catNombre = ev.categories?.name ?? 'General'
          const niveles   = ev.levels?.length ?? 0
          const dur       = duracionMax(ev)

          return (
            <div
              key={ev.id}
              onClick={() => navigate(`/prueba/${ev.id}`)}
              className="card overflow-hidden cursor-pointer group
                         hover:shadow-xl hover:-translate-y-1 transition-all duration-200">

              <div className={`h-1.5 bg-gradient-to-r ${colorCat(catNombre)}`} />

              <div className="p-6">
                <div className="flex items-start justify-between mb-4 gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full
                                      ${badgeCat(catNombre)}`}>
                      {catNombre}
                    </span>
                    {niveles > 0 && (
                      <span className="text-[10px] font-bold text-on-surface-variant
                                       bg-surface-container px-2 py-1 rounded-full">
                        {niveles} nivel{niveles !== 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-xl flex-shrink-0"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                    {iconoCat(catNombre)}
                  </span>
                </div>

                <h3 className="font-bold text-base text-on-surface mb-2 leading-snug
                               group-hover:text-primary transition-colors">
                  {ev.title}
                </h3>

                {ev.description && (
                  <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">
                    {ev.description}
                  </p>
                )}

                <div className="flex items-center gap-3 text-[10px] text-on-surface-variant mb-4">
                  {ev.totalPreguntas > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">quiz</span>
                      {ev.totalPreguntas} preguntas
                    </span>
                  )}
                  {dur && (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {dur}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4
                                border-t border-outline-variant/15">
                  <span className="text-[10px] text-on-surface-variant font-medium">
                    {user
                      ? (tienePlan ? '✓ Incluido en tu plan' : 'Requiere plan activo')
                      : 'Inicia sesión para practicar'}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/prueba/${ev.id}`) }}
                    className="bg-primary text-white px-4 py-2 rounded-full text-xs font-bold
                               group-hover:shadow-md group-hover:shadow-primary/20 transition-all
                               active:scale-95">
                    Ver detalle →
                  </button>
                </div>
              </div>
            </div>
          )
        })}

        {/* CTA premium */}
        {!loading && (
          <div
            onClick={() => navigate('/planes')}
            className="bg-gradient-to-br from-primary to-primary-container rounded-2xl
                       cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all
                       flex items-center justify-center p-8 min-h-[200px]">
            <div className="text-center text-white">
              <span className="material-symbols-outlined text-4xl mb-3 block"
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                workspace_premium
              </span>
              <h3 className="font-bold text-lg">Más simulacros</h3>
              <p className="text-primary-fixed-dim text-sm mt-1 mb-4">Con plan Premium</p>
              <span className="inline-block bg-white text-primary font-bold
                               px-6 py-2 rounded-full text-sm hover:shadow-md transition-shadow">
                Ver planes →
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}