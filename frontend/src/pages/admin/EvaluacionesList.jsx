import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const POR_PAGINA = 10

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function formatCompact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

function EstadoBadge({ activo }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-[10px] font-bold ${
        activo
          ? 'bg-secondary-container text-on-secondary-container'
          : 'bg-surface-container text-on-surface-variant'
      }`}
    >
      {activo ? 'ACTIVA' : 'BORRADOR'}
    </span>
  )
}

export default function EvaluacionesList() {
  const navigate = useNavigate()

  const [evaluaciones, setEvaluaciones] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [stats, setStats] = useState({
    total: 0,
    activas: 0,
    preguntas: 0,
    niveles: 0,
    materiales: 0,
    profesiones: 0,
  })

  useEffect(() => {
    cargarEvaluaciones()
  }, [pagina, busqueda, filtroEstado])

  useEffect(() => {
    cargarStats()
  }, [])

  async function cargarEvaluaciones() {
    setCargando(true)

    let query = supabase
      .from('evaluations')
      .select(
        `
        id,
        title,
        description,
        is_active,
        created_at,
        categories(name),
        levels(id),
        professions(id)
      `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda.trim()) query = query.ilike('title', `%${busqueda.trim()}%`)
    if (filtroEstado === 'activas') query = query.eq('is_active', true)
    if (filtroEstado === 'borradores') query = query.eq('is_active', false)

    const { data, count } = await query
    setTotal(count || 0)

    if (!data?.length) {
      setEvaluaciones([])
      setCargando(false)
      return
    }

    const conPreguntas = await Promise.all(
      data.map(async ev => {
        const levelIds = ev.levels?.map(l => l.id) || []
        let totalPregs = 0
        let totalMateriales = 0

        if (levelIds.length) {
          const { count: c } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .in('level_id', levelIds)

          totalPregs = c || 0
        }

        const { count: mats } = await supabase
          .from('study_materials')
          .select('*', { count: 'exact', head: true })
          .eq('package_id', ev.id)

        totalMateriales = mats || 0

        return {
          ...ev,
          totalPreguntas: totalPregs,
          totalNiveles: levelIds.length,
          totalProfesiones: ev.professions?.length || 0,
          totalMateriales,
        }
      })
    )

    setEvaluaciones(conPreguntas)
    setCargando(false)
  }

  async function cargarStats() {
    const [
      { count: totalEvals },
      { count: activas },
      { count: preguntas },
      { count: niveles },
      { count: materiales },
      { count: profesiones },
    ] = await Promise.all([
      supabase.from('evaluations').select('*', { count: 'exact', head: true }),
      supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase.from('levels').select('*', { count: 'exact', head: true }),
      supabase.from('study_materials').select('*', { count: 'exact', head: true }),
      supabase.from('professions').select('*', { count: 'exact', head: true }),
    ])

    setStats({
      total: totalEvals || 0,
      activas: activas || 0,
      preguntas: preguntas || 0,
      niveles: niveles || 0,
      materiales: materiales || 0,
      profesiones: profesiones || 0,
    })
  }

  async function toggleEstado(ev) {
    await supabase.from('evaluations').update({ is_active: !ev.is_active }).eq('id', ev.id)
    cargarEvaluaciones()
    cargarStats()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta evaluación y todo su contenido? Esta acción no se puede deshacer.')) return

    await supabase.from('evaluations').delete().eq('id', id)
    cargarEvaluaciones()
    cargarStats()
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Evaluaciones</span>
            </nav>

            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Gestión de Evaluaciones
            </h1>

            <p className="text-on-surface-variant mt-1 text-sm max-w-2xl">
              Crea, edita y organiza los simulacros base, sus niveles, materiales y versiones por profesión.
            </p>
          </div>

          <button
            onClick={() => navigate('/admin/evaluaciones/nueva')}
            className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold shadow-xl shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 active:scale-95 text-sm"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            + Nueva Evaluación
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            {
              label: 'Total evaluaciones',
              val: stats.total,
              icon: 'inventory_2',
              color: 'text-primary',
              bg: 'bg-primary-fixed',
            },
            {
              label: 'Activas',
              val: stats.activas,
              icon: 'check_circle',
              color: 'text-secondary',
              bg: 'bg-secondary-container/40',
            },
            {
              label: 'Preguntas',
              val: stats.preguntas,
              icon: 'quiz',
              color: 'text-tertiary',
              bg: 'bg-tertiary-fixed',
            },
            {
              label: 'Niveles',
              val: stats.niveles,
              icon: 'layers',
              color: 'text-primary',
              bg: 'bg-primary-fixed',
            },
            {
              label: 'Materiales',
              val: stats.materiales,
              icon: 'menu_book',
              color: 'text-indigo-700',
              bg: 'bg-indigo-100',
            },
            {
              label: 'Versiones',
              val: stats.profesiones,
              icon: 'people',
              color: 'text-blue-700',
              bg: 'bg-blue-100',
            },
          ].map(s => (
            <div
              key={s.label}
              className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/15 shadow-sm"
            >
              <div className={`w-9 h-9 rounded-xl ${s.bg} ${s.color} flex items-center justify-center mb-3`}>
                <span
                  className="material-symbols-outlined text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {s.icon}
                </span>
              </div>
              <p className={`text-2xl font-extrabold font-headline ${s.color}`}>
                {formatCompact(s.val)}
              </p>
              <p className="text-xs text-on-surface-variant font-semibold mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabla */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/15">
          {/* Barra superior */}
          <div className="px-6 py-5 border-b border-outline-variant/15 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-lg font-headline">
                {total} evaluación{total !== 1 ? 'es' : ''}
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Catálogo académico base de la plataforma
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => {
                    setBusqueda(e.target.value)
                    setPagina(1)
                  }}
                  placeholder="Buscar evaluaciones..."
                  className="pl-10 pr-4 py-2.5 bg-surface-container border border-outline-variant/20 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-64"
                />
              </div>

              <div className="flex bg-surface-container rounded-full p-1">
                {[
                  { key: 'todos', label: 'Todos' },
                  { key: 'activas', label: 'Activas' },
                  { key: 'borradores', label: 'Borradores' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => {
                      setFiltroEstado(f.key)
                      setPagina(1)
                    }}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      filtroEstado === f.key
                        ? 'bg-primary text-on-primary'
                        : 'text-on-surface-variant'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                  <th className="px-6 py-4">Evaluación</th>
                  <th className="px-6 py-4 text-center">Estado</th>
                  <th className="px-6 py-4 text-center">Niveles</th>
                  <th className="px-6 py-4 text-center">Preguntas</th>
                  <th className="px-6 py-4 text-center">Versiones</th>
                  <th className="px-6 py-4 text-center">Material</th>
                  <th className="px-6 py-4">Creada</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>

              <tbody className="divide-y divide-outline-variant/10">
                {cargando ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-surface-container rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : evaluaciones.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">
                        inventory_2
                      </span>
                      <p className="text-on-surface-variant font-semibold">
                        {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay evaluaciones creadas aún'}
                      </p>
                      {!busqueda && (
                        <button
                          onClick={() => navigate('/admin/evaluaciones/nueva')}
                          className="mt-4 px-6 py-2 text-sm font-bold bg-primary text-on-primary rounded-full"
                        >
                          Crear primera evaluación
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  evaluaciones.map(ev => (
                    <tr key={ev.id} className="group hover:bg-surface-container-low/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span
                              className="material-symbols-outlined text-primary text-lg"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              quiz
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{ev.title}</p>
                            <p className="text-[10px] text-on-surface-variant">
                              {ev.categories?.name || 'Sin categoría'}
                            </p>

                            {ev.description && (
                              <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <EstadoBadge activo={ev.is_active} />
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm">{ev.totalNiveles}</span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`font-bold text-sm ${ev.totalPreguntas === 0 ? 'text-error' : ''}`}>
                          {ev.totalPreguntas}
                        </span>
                        {ev.totalPreguntas === 0 && (
                          <span className="block text-[9px] text-error">Sin preguntas</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm">{ev.totalProfesiones}</span>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className="font-bold text-sm">{ev.totalMateriales}</span>
                      </td>

                      <td className="px-6 py-4">
                        <p className="text-xs text-on-surface-variant">{tiempoRelativo(ev.created_at)}</p>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => navigate(`/admin/evaluaciones/${ev.id}/editar`)}
                            title="Editar"
                            className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>

                          <button
                            onClick={() => toggleEstado(ev)}
                            title={ev.is_active ? 'Desactivar' : 'Activar'}
                            className="p-2 text-on-surface-variant hover:text-secondary rounded-lg hover:bg-surface-container transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">
                              {ev.is_active ? 'toggle_on' : 'toggle_off'}
                            </span>
                          </button>

                          <button
                            onClick={() => eliminar(ev.id)}
                            title="Eliminar"
                            className="p-2 text-on-surface-variant hover:text-error rounded-lg hover:bg-error-container/20 transition-all"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="px-6 py-4 bg-surface-container-low/30 border-t border-outline-variant/10 flex items-center justify-between">
              <p className="text-xs text-on-surface-variant font-medium">
                Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, total)}–
                {Math.min(pagina * POR_PAGINA, total)} de {total}
              </p>

              <div className="flex gap-1">
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>

                {Array.from({ length: Math.min(totalPaginas, 5) }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPagina(p)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                      pagina === p ? 'bg-primary text-on-primary' : 'text-on-surface hover:bg-surface-container'
                    }`}
                  >
                    {p}
                  </button>
                ))}

                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina >= totalPaginas}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => navigate('/admin/evaluaciones/nueva')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <span
          className="material-symbols-outlined text-2xl"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          add
        </span>
      </button>
    </div>
  )
}