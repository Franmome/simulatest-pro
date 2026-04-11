import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const ICONOS_POR_TIPO = ['auto_stories', 'badge', 'gavel', 'psychology', 'history_edu', 'military_tech', 'balance', 'school']
const COLORES = [
  { bg: 'bg-blue-100', text: 'text-blue-700' },
  { bg: 'bg-green-100', text: 'text-green-700' },
  { bg: 'bg-orange-100', text: 'text-orange-700' },
  { bg: 'bg-indigo-100', text: 'text-indigo-700' },
]

const POR_PAGINA = 8

const PLANTILLA_CSV = [
  'area,dificultad,enunciado,A,B,C,D,correcta,explicacion',
  'Derecho Fiscal,medio,"¿Cuál es el órgano de control fiscal en Colombia?","Procuraduría","Contraloría","Fiscalía","Defensoría",B,"La Contraloría ejerce vigilancia fiscal según el Art. 267."',
  'Ofimática,facil,"¿Qué atajo permite guardar un documento?","Ctrl+P","Ctrl+S","Ctrl+N","Alt+G",B,"Ctrl+S es el atajo estándar para guardar documentos."',
].join('\n')

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-surface-container text-on-surface-variant',
    success: 'bg-secondary-container text-on-secondary-container',
    warning: 'bg-tertiary-container/20 text-tertiary',
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-100 text-blue-700',
  }

  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${tones[tone] || tones.default}`}>
      {children}
    </span>
  )
}

export default function AdminPaquetes() {
  const navigate = useNavigate()

  const [paquetes, setPaquetes] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [stats, setStats] = useState({
    preguntas: 0,
    ventas: 0,
    activos: 0,
    materiales: 0,
  })
  const [actividad, setActividad] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [msgCarga, setMsgCarga] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    cargarPaquetes()
  }, [pagina, busqueda, filtroEstado])

  useEffect(() => {
    cargarStats()
    cargarActividad()
  }, [])

  async function cargarPaquetes() {
    setCargando(true)

    let query = supabase
      .from('packages')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda.trim()) query = query.ilike('name', `%${busqueda.trim()}%`)
    if (filtroEstado === 'activos') query = query.eq('is_active', true)
    if (filtroEstado === 'borradores') query = query.eq('is_active', false)

    const { data, count } = await query
    setTotal(count || 0)

    if (!data?.length) {
      setPaquetes([])
      setCargando(false)
      return
    }

    const conMetricas = await Promise.all(
      data.map(async (pkg, i) => {
        const { count: ventas } = await supabase
          .from('purchases')
          .select('*', { count: 'exact', head: true })
          .eq('package_id', pkg.id)

        const evalIds = Array.isArray(pkg.evaluations_ids) ? pkg.evaluations_ids : []
        let totalPreguntas = 0
        let totalNiveles = 0
        let totalVersiones = 0

        if (evalIds.length) {
          const { data: niveles } = await supabase
            .from('levels')
            .select('id, evaluation_id')
            .in('evaluation_id', evalIds)

          totalNiveles = niveles?.length || 0

          if (niveles?.length) {
            const levelIds = niveles.map(n => n.id)
            const { count: pregs } = await supabase
              .from('questions')
              .select('*', { count: 'exact', head: true })
              .in('level_id', levelIds)

            totalPreguntas = pregs || 0
          }

          const { count: versiones } = await supabase
            .from('professions')
            .select('*', { count: 'exact', head: true })
            .in('evaluation_id', evalIds)

          totalVersiones = versiones || 0
        }

        const color = COLORES[i % COLORES.length]
        const icono = ICONOS_POR_TIPO[i % ICONOS_POR_TIPO.length]

        return {
          ...pkg,
          ventas: ventas || 0,
          totalPreguntas,
          totalNiveles,
          totalVersiones,
          color,
          icono,
        }
      })
    )

    setPaquetes(conMetricas)
    setCargando(false)
  }

  async function cargarStats() {
    const [
      { count: activos },
      { count: totalVentas },
      { count: totalPregs },
      { count: totalMateriales },
    ] = await Promise.all([
      supabase.from('packages').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('purchases').select('*', { count: 'exact', head: true }),
      supabase.from('questions').select('*', { count: 'exact', head: true }),
      supabase.from('study_materials').select('*', { count: 'exact', head: true }),
    ])

    setStats({
      preguntas: totalPregs || 0,
      ventas: totalVentas || 0,
      activos: activos || 0,
      materiales: totalMateriales || 0,
    })
  }

  async function cargarActividad() {
    const { data } = await supabase
      .from('packages')
      .select('name, created_at, is_active, pricing_mode, has_level_selector')
      .order('created_at', { ascending: false })
      .limit(4)

    setActividad(data || [])
  }

  async function toggleEstado(pkg) {
    await supabase
      .from('packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id)

    cargarPaquetes()
    cargarStats()
  }

  async function eliminarPaquete(id) {
    if (!confirm('¿Eliminar este paquete? Esta acción no se puede deshacer.')) return
    await supabase.from('packages').delete().eq('id', id)
    cargarPaquetes()
    cargarStats()
  }

  function descargarPlantillaCSV() {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_preguntas_simulatest.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  function manejarCargaMasiva(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setSubiendo(true)
    setMsgCarga('Archivo detectado. Usa el formulario del paquete para importarlo en el nivel correcto.')

    setTimeout(() => {
      setSubiendo(false)
    }, 1200)
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)

  const resumen = useMemo(() => {
    const publicados = paquetes.filter(p => p.is_active).length
    const conVariantes = paquetes.filter(p => p.pricing_mode === 'per_profession').length
    return { publicados, conVariantes }
  }, [paquetes])

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Gestión de Paquetes</span>
            </nav>

            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Gestión de Paquetes de Pruebas
            </h1>

            <p className="text-on-surface-variant mt-1 max-w-2xl text-sm">
              Administra paquetes madre, evaluaciones, versiones por profesión, materiales y estado de publicación.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/admin/evaluaciones/nueva')}
              className="bg-primary text-on-primary px-6 py-3 rounded-full font-bold shadow-xl shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2 active:scale-95 text-sm"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              + Nuevo Paquete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Principal */}
          <div className="lg:col-span-9 space-y-6">
            {/* Hero stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">
                  Total Preguntas
                </p>
                <h4 className="text-2xl font-black font-headline text-blue-800">
                  {stats.preguntas >= 1000 ? `${(stats.preguntas / 1000).toFixed(1)}k` : stats.preguntas}
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-blue-600 mt-2">
                  <span className="material-symbols-outlined text-sm">quiz</span>
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

              <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">
                  Materiales
                </p>
                <h4 className="text-2xl font-black font-headline text-indigo-800">
                  {stats.materiales}
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-indigo-600 mt-2">
                  <span className="material-symbols-outlined text-sm">menu_book</span>
                  <span>Recursos cargados</span>
                </div>
              </div>
            </div>

            {/* Tabla */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden border border-outline-variant/15">
              <div className="p-6 border-b border-outline-variant/15 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-lg font-headline">Catálogo Vigente</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {total} paquete{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
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
                      placeholder="Buscar paquetes..."
                      className="pl-10 pr-4 py-2.5 bg-surface-container border border-outline-variant/20 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 w-full sm:w-64"
                    />
                  </div>

                  <div className="flex bg-surface-container rounded-full p-1">
                    {[
                      { key: 'todos', label: 'Todos' },
                      { key: 'activos', label: 'Activos' },
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
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">
                      <th className="px-6 py-4">Paquete</th>
                      <th className="px-6 py-4">Estructura</th>
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
                      paquetes.map(pkg => (
                        <tr key={pkg.id} className="group hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-6 py-5">
                            <div className="flex items-start gap-3">
                              <div className={`w-10 h-10 rounded-lg ${pkg.color.bg} ${pkg.color.text} flex items-center justify-center flex-shrink-0`}>
                                <span className="material-symbols-outlined text-xl">{pkg.icono}</span>
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-sm">{pkg.name}</p>
                                  {pkg.pricing_mode === 'per_profession' ? (
                                    <Badge tone="primary">Precio por profesión</Badge>
                                  ) : (
                                    <Badge tone="blue">Precio global</Badge>
                                  )}
                                  {pkg.has_level_selector && <Badge tone="warning">Selector de nivel</Badge>}
                                </div>

                                <p className="text-[10px] text-on-surface-variant mt-1">
                                  ID: {String(pkg.id).slice(0, 8).toUpperCase()}
                                </p>

                                {pkg.description && (
                                  <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">
                                    {pkg.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5">
                            <div className="space-y-1 text-xs">
                              <div>
                                <span className="font-semibold">{pkg.totalPreguntas.toLocaleString()}</span>
                                <span className="text-on-surface-variant ml-1">pregs.</span>
                              </div>
                              <div>
                                <span className="font-semibold">{pkg.totalNiveles}</span>
                                <span className="text-on-surface-variant ml-1">niveles</span>
                              </div>
                              <div>
                                <span className="font-semibold">{pkg.totalVersiones}</span>
                                <span className="text-on-surface-variant ml-1">versiones</span>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              pkg.is_active
                                ? 'bg-secondary-container text-on-secondary-container'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}>
                              {pkg.is_active ? 'ACTIVO' : 'BORRADOR'}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-right font-medium text-sm text-on-surface-variant">
                            {pkg.ventas.toLocaleString()}
                          </td>

                          <td className="px-6 py-5 text-right font-bold text-sm">
                            {formatMoney(pkg.price)}
                          </td>

                          <td className="px-6 py-5 text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  const evalId = Array.isArray(pkg.evaluations_ids) ? pkg.evaluations_ids[0] : null
                                  if (!evalId) {
                                    alert('Este paquete no tiene evaluación asociada todavía.')
                                    return
                                  }
                                  navigate(`/admin/evaluaciones/${evalId}/editar`)
                                }}
                                className="p-2 text-on-surface-variant hover:text-primary transition-colors"
                                title="Editar"
                              >
                                <span className="material-symbols-outlined text-xl">edit_document</span>
                              </button>

                              <button
                                onClick={() => toggleEstado(pkg)}
                                className="p-2 text-on-surface-variant hover:text-secondary transition-colors"
                                title={pkg.is_active ? 'Desactivar' : 'Activar'}
                              >
                                <span className="material-symbols-outlined text-xl">
                                  {pkg.is_active ? 'toggle_on' : 'toggle_off'}
                                </span>
                              </button>

                              <button
                                onClick={() => eliminarPaquete(pkg.id)}
                                className="p-2 text-on-surface-variant hover:text-error transition-colors"
                                title="Eliminar"
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

              <div className="p-6 bg-surface-container-low/50 border-t border-outline-variant/10 flex items-center justify-between">
                <p className="text-xs text-on-surface-variant font-medium">
                  Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, Math.max(total, 1))}–
                  {Math.min(pagina * POR_PAGINA, total)} de {total} paquetes
                </p>

                <div className="flex gap-1">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>

                  {Array.from({ length: Math.min(totalPaginas, 3) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPagina(p)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                        pagina === p
                          ? 'bg-primary text-on-primary shadow-md'
                          : 'text-on-surface hover:bg-surface-container'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas || 1, p + 1))}
                    disabled={pagina === totalPaginas || totalPaginas === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all"
                  >
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar derecho */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/15">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                </div>
                <h3 className="font-bold text-sm">Carga Masiva</h3>
              </div>

              <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                Usa esta zona para preparar cargas rápidas. La importación real de preguntas se hace dentro del editor del paquete, por nivel.
              </p>

              <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                subiendo
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant hover:border-primary bg-surface-container-low/50'
              }`}>
                <span className={`material-symbols-outlined text-3xl mb-2 ${
                  subiendo ? 'text-primary animate-bounce' : 'text-on-surface-variant'
                }`}>
                  cloud_upload
                </span>

                <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                  {subiendo ? 'Procesando...' : 'Arrastra archivos aquí'}
                </p>

                <p className="text-[9px] text-on-surface-variant mt-1">
                  CSV o JSON · máximo 25MB
                </p>

                <input
                  type="file"
                  accept=".json,.csv"
                  className="hidden"
                  onChange={manejarCargaMasiva}
                />
              </label>

              <div className="mt-4 space-y-3">
                <button
                  onClick={descargarPlantillaCSV}
                  className="w-full py-2.5 rounded-lg border border-outline-variant text-[10px] font-bold text-on-surface-variant flex items-center justify-center gap-2 hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">description</span>
                  Descargar Plantilla CSV
                </button>
              </div>

              {msgCarga && (
                <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-on-surface-variant">
                  {msgCarga}
                </div>
              )}
            </div>

            <div className="bg-primary p-6 rounded-2xl shadow-xl shadow-primary/10 text-on-primary relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-sm mb-2">Resumen del Catálogo</h3>

                <div className="space-y-4 mt-4">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span>PUBLICADOS</span>
                      <span>{resumen.publicados}</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{
                          width: `${total ? (resumen.publicados / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold mb-1">
                      <span>POR PROFESIÓN</span>
                      <span>{resumen.conVariantes}</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{
                          width: `${total ? (resumen.conVariantes / total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 text-[10px] opacity-90 leading-relaxed">
                  Usa paquetes madre para una convocatoria completa y versiones cuando cambian precios, cargos o respuestas correctas.
                </div>
              </div>

              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/15">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4">
                Guía rápida
              </h4>

              <div className="space-y-3 text-xs text-on-surface-variant">
                <div className="flex gap-2">
                  <span className="font-bold text-primary">1.</span>
                  <span>Crea la evaluación base del paquete.</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary">2.</span>
                  <span>Agrega niveles si cambian preguntas o respuestas por cargo.</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary">3.</span>
                  <span>Crea versiones y asigna precio por profesión si hace falta.</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-primary">4.</span>
                  <span>Sube material de estudio y luego publica el paquete.</span>
                </div>
              </div>
            </div>

            <div className="p-2">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-4 px-4">
                Actividad Reciente
              </h4>

              <div className="space-y-4">
                {actividad.length === 0 ? (
                  <p className="text-xs text-on-surface-variant px-4">Sin actividad reciente</p>
                ) : (
                  actividad.map((item, i) => {
                    const colores = ['bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-indigo-500']
                    return (
                      <div key={i} className="flex gap-3 px-4">
                        <div className={`w-1.5 h-1.5 rounded-full ${colores[i % colores.length]} mt-1.5 shrink-0`} />
                        <div>
                          <p className="text-xs font-bold">
                            {item.is_active ? 'Paquete activo' : 'Paquete en borrador'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            {item.name} · {tiempoRelativo(item.created_at)}
                          </p>
                          <p className="text-[10px] text-on-surface-variant mt-1">
                            {item.pricing_mode === 'per_profession' ? 'Precio por profesión' : 'Precio global'}
                            {item.has_level_selector ? ' · selector de nivel' : ''}
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

      <button
        onClick={() => navigate('/admin/evaluaciones/nueva')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          bolt
        </span>
      </button>
    </div>
  )
}