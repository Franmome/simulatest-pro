import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const ICONOS_POR_TIPO = ['auto_stories', 'badge', 'gavel', 'psychology', 'history_edu', 'military_tech', 'balance', 'school']
const COLORES = [
  { bg: 'bg-blue-100',   text: 'text-blue-700'   },
  { bg: 'bg-green-100',  text: 'text-green-700'  },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-blue-100',   text: 'text-blue-700'   },
]

const POR_PAGINA = 8

export default function AdminPaquetes() {
  const navigate = useNavigate()

  const [paquetes,    setPaquetes]    = useState([])
  const [total,       setTotal]       = useState(0)
  const [pagina,      setPagina]      = useState(1)
  const [cargando,    setCargando]    = useState(true)
  const [busqueda,    setBusqueda]    = useState('')
  const [stats,       setStats]       = useState({ preguntas: 0, ventas: 0, activos: 0 })
  const [actividad,   setActividad]   = useState([])
  const [subiendo,    setSubiendo]    = useState(false)

  useEffect(() => { cargarPaquetes() }, [pagina, busqueda])
  useEffect(() => { cargarStats(); cargarActividad() }, [])

  // ── Paquetes con conteo de ventas y preguntas ───────────────────────────
  async function cargarPaquetes() {
    setCargando(true)

    let query = supabase
      .from('packages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda.trim()) query = query.ilike('name', `%${busqueda}%`)

    const { data, count } = await query
    setTotal(count || 0)

    if (!data) { setCargando(false); return }

    // Conteo de compras por paquete
    const conVentas = await Promise.all(
      data.map(async (pkg) => {
        const { count: ventas } = await supabase
          .from('purchases')
          .select('*', { count: 'exact', head: true })
          .eq('package_id', pkg.id)

        // Conteo de preguntas via evaluaciones → niveles → preguntas
        const { data: evals } = await supabase
          .from('evaluations')
          .select('id')
          .contains('evaluations_ids', [pkg.id]) // si usas array de ids en packages

        let totalPreguntas = 0
        if (evals?.length) {
          const evalIds = evals.map(e => e.id)
          const { data: niveles } = await supabase
            .from('levels')
            .select('id')
            .in('evaluation_id', evalIds)
          if (niveles?.length) {
            const { count: pregs } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .in('level_id', niveles.map(n => n.id))
            totalPreguntas = pregs || 0
          }
        }

        return { ...pkg, ventas: ventas || 0, totalPreguntas }
      })
    )

    setPaquetes(conVentas)
    setCargando(false)
  }

  // ── Stats del panel lateral ─────────────────────────────────────────────
  async function cargarStats() {
    const [{ count: activos }, { count: totalVentas }, { count: totalPregs }] =
      await Promise.all([
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('purchases').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
      ])
    setStats({
      preguntas: totalPregs || 0,
      ventas:    totalVentas || 0,
      activos:   activos || 0,
    })
  }

  // ── Actividad reciente ──────────────────────────────────────────────────
  async function cargarActividad() {
    const { data } = await supabase
      .from('packages')
      .select('name, created_at, is_active')
      .order('created_at', { ascending: false })
      .limit(3)
    setActividad(data || [])
  }

  // ── Togglear activo/inactivo ────────────────────────────────────────────
  async function toggleEstado(pkg) {
    await supabase
      .from('packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id)
    cargarPaquetes()
  }

  // ── Eliminar paquete ────────────────────────────────────────────────────
  async function eliminarPaquete(id) {
    if (!confirm('¿Eliminar este paquete? Esta acción no se puede deshacer.')) return
    await supabase.from('packages').delete().eq('id', id)
    cargarPaquetes()
    cargarStats()
  }

  function tiempoRelativo(fecha) {
    const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
    if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
    return `hace ${Math.floor(diff / 86400)} días`
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── TopBar ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-8 h-16
                         bg-surface-container-lowest/80 backdrop-blur-xl
                         border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2
                             text-on-surface-variant text-lg">search</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container border-none rounded-full
                         text-sm outline-none focus:ring-2 focus:ring-primary/20
                         placeholder:text-on-surface-variant"
              placeholder="Buscar paquetes o exámenes..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          </button>
          <div className="h-8 w-px bg-outline-variant/40 mx-1" />
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center
                          text-on-primary font-bold text-xs">A</div>
        </div>
      </header>

      {/* ── Canvas ── */}
      <div className="p-8 max-w-7xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Gestión de Exámenes</span>
            </nav>
            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Gestión de Paquetes de Pruebas
            </h1>
            <p className="text-on-surface-variant mt-1 max-w-xl text-sm">
              Configure, publique y administre los simulacros para las diferentes convocatorias nacionales.
            </p>
          </div>
          <button
            onClick={() => navigate('/admin/evaluaciones/nueva')}
            className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold shadow-xl
                       shadow-primary/20 hover:-translate-y-0.5 transition-all
                       flex items-center gap-2 active:scale-95 text-sm"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            + Nuevo Paquete
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* ── Tabla principal ── */}
          <div className="lg:col-span-9 space-y-6">

            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
              {/* Cabecera tabla */}
              <div className="p-6 border-b border-outline-variant/15 flex items-center justify-between">
                <h3 className="font-bold text-lg font-headline">Catálogo Vigente</h3>
                <div className="flex gap-2">
                  <button className="p-2 bg-surface-container rounded-lg text-on-surface-variant
                                     hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">filter_list</span>
                  </button>
                  <button className="p-2 bg-surface-container rounded-lg text-on-surface-variant
                                     hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">download</span>
                  </button>
                </div>
              </div>

              {/* Tabla */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-[10px] uppercase tracking-widest
                                   font-bold text-on-surface-variant">
                      <th className="px-6 py-4">Paquete de Prueba</th>
                      <th className="px-6 py-4">Preguntas</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Ventas</th>
                      <th className="px-6 py-4 text-right">Precio</th>
                      <th className="px-6 py-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {cargando ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="px-6 py-5">
                            <div className="h-4 bg-surface-container rounded animate-pulse w-3/4" />
                          </td>
                        </tr>
                      ))
                    ) : paquetes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-on-surface-variant text-sm">
                          {busqueda ? 'Sin resultados para esa búsqueda' : 'No hay paquetes creados aún'}
                        </td>
                      </tr>
                    ) : (
                      paquetes.map((pkg, i) => {
                        const color = COLORES[i % COLORES.length]
                        const icono = ICONOS_POR_TIPO[i % ICONOS_POR_TIPO.length]
                        return (
                          <tr key={pkg.id}
                              className="group hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg ${color.bg} ${color.text}
                                                flex items-center justify-center flex-shrink-0`}>
                                  <span className="material-symbols-outlined text-xl">{icono}</span>
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{pkg.name}</p>
                                  <p className="text-[10px] text-on-surface-variant">
                                    ID: {pkg.id.slice(0, 8).toUpperCase()}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="text-xs">
                                <span className="font-semibold">{pkg.totalPreguntas.toLocaleString()}</span>
                                <span className="text-on-surface-variant ml-1">pregs.</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold
                                ${pkg.is_active
                                  ? 'bg-secondary-container text-on-secondary-container'
                                  : 'bg-surface-container text-on-surface-variant'}`}>
                                {pkg.is_active ? 'ACTIVO' : 'BORRADOR'}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right font-medium text-sm text-on-surface-variant">
                              {pkg.ventas.toLocaleString()}
                            </td>
                            <td className="px-6 py-5 text-right font-bold text-sm">
                              ${pkg.price?.toLocaleString('es-CO')}
                            </td>
                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => navigate(`/admin/evaluaciones/${pkg.id}/editar`)}
                                  className="p-2 text-on-surface-variant hover:text-primary transition-colors"
                                  title="Editar">
                                  <span className="material-symbols-outlined text-xl">edit_document</span>
                                </button>
                                <button
                                  onClick={() => toggleEstado(pkg)}
                                  className="p-2 text-on-surface-variant hover:text-secondary transition-colors"
                                  title={pkg.is_active ? 'Desactivar' : 'Activar'}>
                                  <span className="material-symbols-outlined text-xl">
                                    {pkg.is_active ? 'toggle_on' : 'toggle_off'}
                                  </span>
                                </button>
                                <button
                                  onClick={() => eliminarPaquete(pkg.id)}
                                  className="p-2 text-on-surface-variant hover:text-error transition-colors"
                                  title="Eliminar">
                                  <span className="material-symbols-outlined text-xl">delete</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="p-6 bg-surface-container-low/50 border-t border-outline-variant/10
                              flex items-center justify-between">
                <p className="text-xs text-on-surface-variant font-medium">
                  Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, total)}–
                  {Math.min(pagina * POR_PAGINA, total)} de {total} paquetes
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center
                               text-on-surface-variant hover:bg-surface-container
                               disabled:opacity-30 transition-all">
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>
                  {Array.from({ length: Math.min(totalPaginas, 3) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPagina(p)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center
                                  text-xs font-medium transition-all
                                  ${pagina === p
                                    ? 'bg-primary text-on-primary shadow-md'
                                    : 'text-on-surface hover:bg-surface-container'}`}>
                      {p}
                    </button>
                  ))}
                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                    disabled={pagina === totalPaginas || totalPaginas === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center
                               text-on-surface-variant hover:bg-surface-container
                               disabled:opacity-30 transition-all">
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Stats rápidos ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">
                  Total Preguntas
                </p>
                <h4 className="text-2xl font-black font-headline text-blue-800">
                  {stats.preguntas >= 1000
                    ? `${(stats.preguntas / 1000).toFixed(1)}k`
                    : stats.preguntas}
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-blue-600 mt-2">
                  <span className="material-symbols-outlined text-sm">trending_up</span>
                  <span>En el banco</span>
                </div>
              </div>
              <div className="bg-green-50 p-5 rounded-2xl border border-green-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-1">
                  Ventas Totales
                </p>
                <h4 className="text-2xl font-black font-headline text-green-800">
                  {stats.ventas.toLocaleString()}
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-green-600 mt-2">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  <span>Compras registradas</span>
                </div>
              </div>
              <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1">
                  Paquetes Activos
                </p>
                <h4 className="text-2xl font-black font-headline text-orange-800">
                  {stats.activos}
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-orange-600 mt-2">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>Disponibles hoy</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Sidebar derecho ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Upload */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm
                            border border-outline-variant/15">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary
                                flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                </div>
                <h3 className="font-bold text-sm">Carga Masiva</h3>
              </div>
              <p className="text-xs text-on-surface-variant mb-6 leading-relaxed">
                Sube bancos de preguntas en formato JSON o CSV. El sistema validará la estructura automáticamente.
              </p>
              <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center
                                 justify-center text-center cursor-pointer transition-colors
                                 ${subiendo
                                   ? 'border-primary bg-primary/5'
                                   : 'border-outline-variant hover:border-primary bg-surface-container-low/50'}`}>
                <span className={`material-symbols-outlined text-3xl mb-2
                                  ${subiendo ? 'text-primary animate-bounce' : 'text-on-surface-variant'}`}>
                  cloud_upload
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                  {subiendo ? 'Procesando...' : 'Arrastra archivos aquí'}
                </p>
                <p className="text-[9px] text-on-surface-variant mt-1">Máximo 25MB por carga</p>
                <input type="file" accept=".json,.csv" className="hidden"
                       onChange={() => setSubiendo(true)} />
              </label>
              <div className="mt-4 space-y-3">
                <button className="w-full py-2.5 rounded-lg border border-outline-variant
                                   text-[10px] font-bold text-on-surface-variant
                                   flex items-center justify-center gap-2
                                   hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-sm">description</span>
                  Descargar Plantilla CSV
                </button>
              </div>
            </div>

            {/* Estado del servidor */}
            <div className="bg-primary p-6 rounded-2xl shadow-xl shadow-primary/10
                            text-on-primary relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-sm mb-2">Estado del Servidor</h3>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-secondary-fixed-dim animate-pulse" />
                  <span className="text-[10px] font-medium opacity-90">
                    Sincronización activa: ON
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'USO DE BASE DE DATOS', valor: 68 },
                    { label: 'CONEXIONES ACTIVAS',   valor: 45 },
                  ].map(({ label, valor }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[9px] mb-1 font-bold">
                        <span>{label}</span>
                        <span>{valor}%</span>
                      </div>
                      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full"
                             style={{ width: `${valor}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10
                              rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Actividad reciente */}
            <div className="p-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest
                             text-on-surface-variant mb-4 px-4">
                Actividad Reciente
              </h4>
              <div className="space-y-4">
                {actividad.length === 0 ? (
                  <p className="text-xs text-on-surface-variant px-4">Sin actividad reciente</p>
                ) : (
                  actividad.map((item, i) => {
                    const colores = ['bg-blue-500', 'bg-green-500', 'bg-orange-500']
                    return (
                      <div key={i} className="flex gap-3 px-4">
                        <div className={`w-1.5 h-1.5 rounded-full ${colores[i]} mt-1.5 shrink-0`} />
                        <div>
                          <p className="text-xs font-bold">
                            {item.is_active ? 'Paquete activo' : 'Paquete en borrador'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            {item.name} · {tiempoRelativo(item.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => navigate('/admin/evaluaciones/nueva')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full
                   shadow-2xl flex items-center justify-center hover:scale-110
                   active:scale-95 transition-all z-50">
        <span className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
      </button>
    </div>
  )
}