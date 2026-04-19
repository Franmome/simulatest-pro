import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { deepseek } from '../../utils/deepseek'

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

const PLANTILLA_JSON = JSON.stringify(
  [
    {
      area: 'Derecho Administrativo',
      dificultad: 'medio',
      enunciado: '¿Cuál entidad ejerce control disciplinario?',
      opciones: { A: 'Contraloría', B: 'Procuraduría', C: 'Defensoría', D: 'Fiscalía' },
      correcta: 'B',
      explicacion: 'La Procuraduría ejerce vigilancia superior de la conducta oficial.',
    },
  ],
  null,
  2
)

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`
}

function tiempoRelativo(fecha) {
  if (!fecha) return 'sin fecha'
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600) return `hace ${Math.max(1, Math.floor(diff / 60))} min`
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
    purple: 'bg-violet-100 text-violet-700',
    orange: 'bg-orange-100 text-orange-700',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${tones[tone] || tones.default}`}>
      {children}
    </span>
  )
}

function getVisiblePages(current, total) {
  if (total <= 1) return [1]
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 3) return [1, 2, 3, 4, 5]
  if (current >= total - 2) return [total - 4, total - 3, total - 2, total - 1, total]
  return [current - 2, current - 1, current, current + 1, current + 2]
}

// ─── Panel DeepSeek embebido ──────────────────────────────────────────────────
function PanelDeepSeek() {
  const [modo, setModo] = useState(null)
  const [enunciado, setEnunciado] = useState('')
  const [opcionElegida, setOpcionElegida] = useState('')
  const [respuestaCorrecta, setRespuestaCorrecta] = useState('')
  const [resultado, setResultado] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)

  async function generarExplicacion() {
    if (!enunciado.trim()) return
    setCargando(true)
    setResultado('')
    setError('')
    try {
      const prompt = `Genera una explicación pedagógica clara y concisa (máx. 3 párrafos) para la siguiente pregunta de examen colombiano:

Enunciado: ${enunciado}
Respuesta correcta: ${respuestaCorrecta || 'No especificada'}

Estructura tu respuesta así:
1. Por qué es correcta la respuesta indicada
2. Base legal o conceptual que la sustenta (artículo, norma, principio)
3. Tip corto para recordarla

Usa español colombiano formal y pedagógico.`

      const respuesta = await deepseek.ask(prompt,
        'Eres un experto en elaboración de contenido pedagógico para exámenes de concurso CNSC, Contraloría y Procuraduría de Colombia.'
      )
      setResultado(respuesta)
    } catch (e) {
      setError(e.message || 'Error al conectar con DeepSeek')
    } finally {
      setCargando(false)
    }
  }

  async function generarFeedbackOpciones() {
    if (!enunciado.trim() || !opcionElegida.trim() || !respuestaCorrecta.trim()) return
    setCargando(true)
    setResultado('')
    setError('')
    try {
      const prompt = `Para la siguiente pregunta de examen, genera un feedback específico para el estudiante que marcó la opción "${opcionElegida}" cuando la correcta es "${respuestaCorrecta}".

Enunciado: ${enunciado}

Estructura el feedback así:
- Si marcó correctamente: refuerzo positivo + resumen del concepto clave
- Si marcó incorrectamente: por qué esa opción es atractiva pero incorrecta, y qué concepto confundió

El tono debe ser motivador y pedagógico, sin ser condescendiente. Máximo 2 párrafos.`

      const respuesta = await deepseek.ask(prompt,
        'Eres un tutor experto en exámenes de concurso colombianos. Generas feedback personalizado por opción marcada.'
      )
      setResultado(respuesta)
    } catch (e) {
      setError(e.message || 'Error al conectar con DeepSeek')
    } finally {
      setCargando(false)
    }
  }

  function copiarResultado() {
    if (!resultado) return
    navigator.clipboard.writeText(resultado)
  }

  function limpiar() {
    setModo(null)
    setEnunciado('')
    setOpcionElegida('')
    setRespuestaCorrecta('')
    setResultado('')
    setError('')
  }

  return (
    <div className="space-y-3 text-xs text-on-surface-variant">
      {!modo && (
        <>
          <div className="p-3 rounded-xl bg-surface-container">
            <p className="font-bold text-on-surface mb-1">Usos recomendados</p>
            <ul className="space-y-1 list-disc pl-4">
              <li>Generar explicaciones de respuestas correctas.</li>
              <li>Proponer retroalimentaciones por opción elegida.</li>
              <li>Ayudar a limpiar preguntas antes de importar.</li>
              <li>Convertir contenido suelto a formato cargable.</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => setModo('explicacion')}
              className="w-full py-2.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center gap-2 hover:bg-primary/15 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Generar explicación con IA
            </button>

            <button
              onClick={() => setModo('feedback')}
              className="w-full py-2.5 rounded-lg border border-outline-variant text-[11px] font-bold text-on-surface-variant flex items-center justify-center gap-2 hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-sm">tips_and_updates</span>
              Sugerir feedback por opción
            </button>
          </div>

          <p className="text-[10px] text-on-surface-variant">
            Conectado a DeepSeek API · Los resultados se pueden copiar para pegar en el editor del paquete.
          </p>
        </>
      )}

      {modo === 'explicacion' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-on-surface text-[11px]">Generar explicación</p>
            <button onClick={limpiar} className="text-[10px] text-on-surface-variant hover:text-error transition-colors">
              ← Volver
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold mb-1 text-on-surface-variant uppercase tracking-wide">
              Enunciado *
            </label>
            <textarea
              ref={textareaRef}
              value={enunciado}
              onChange={e => setEnunciado(e.target.value)}
              placeholder="Pega aquí el enunciado de la pregunta..."
              rows={3}
              className="w-full text-[11px] px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold mb-1 text-on-surface-variant uppercase tracking-wide">
              Respuesta correcta
            </label>
            <input
              value={respuestaCorrecta}
              onChange={e => setRespuestaCorrecta(e.target.value)}
              placeholder="Ej: B — La Contraloría"
              className="w-full text-[11px] px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            onClick={generarExplicacion}
            disabled={cargando || !enunciado.trim()}
            className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Generando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                Generar explicación
              </>
            )}
          </button>

          {error && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-[10px]">
              {error}
            </div>
          )}

          {resultado && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-on-surface text-[10px] uppercase tracking-wide">Resultado DeepSeek</p>
                <button
                  onClick={copiarResultado}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                  Copiar
                </button>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-on-surface leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {resultado}
              </div>
            </div>
          )}
        </div>
      )}

      {modo === 'feedback' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-bold text-on-surface text-[11px]">Feedback por opción</p>
            <button onClick={limpiar} className="text-[10px] text-on-surface-variant hover:text-error transition-colors">
              ← Volver
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold mb-1 text-on-surface-variant uppercase tracking-wide">
              Enunciado *
            </label>
            <textarea
              value={enunciado}
              onChange={e => setEnunciado(e.target.value)}
              placeholder="Pega aquí el enunciado..."
              rows={3}
              className="w-full text-[11px] px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold mb-1 text-on-surface-variant uppercase tracking-wide">
                Opción elegida *
              </label>
              <select
                value={opcionElegida}
                onChange={e => setOpcionElegida(e.target.value)}
                className="w-full text-[11px] px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">—</option>
                {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold mb-1 text-on-surface-variant uppercase tracking-wide">
                Correcta *
              </label>
              <select
                value={respuestaCorrecta}
                onChange={e => setRespuestaCorrecta(e.target.value)}
                className="w-full text-[11px] px-3 py-2 bg-surface-container border border-outline-variant/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">—</option>
                {['A', 'B', 'C', 'D'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={generarFeedbackOpciones}
            disabled={cargando || !enunciado.trim() || !opcionElegida || !respuestaCorrecta}
            className="w-full py-2.5 rounded-lg bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <>
                <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                Generando...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">tips_and_updates</span>
                Generar feedback
              </>
            )}
          </button>

          {error && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/20 text-error text-[10px]">
              {error}
            </div>
          )}

          {resultado && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-bold text-on-surface text-[10px] uppercase tracking-wide">Resultado DeepSeek</p>
                <button
                  onClick={copiarResultado}
                  className="text-[10px] text-primary hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-xs">content_copy</span>
                  Copiar
                </button>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-[11px] text-on-surface leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                {resultado}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminPaquetes() {
  const navigate = useNavigate()

  const [paquetes, setPaquetes] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [stats, setStats] = useState({ preguntas: 0, ventas: 0, activos: 0, materiales: 0 })
  const [actividad, setActividad] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [msgCarga, setMsgCarga] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [tipoArchivo, setTipoArchivo] = useState('')
  const [mostrarGuia, setMostrarGuia] = useState(true)
  const [mostrarDeepSeek, setMostrarDeepSeek] = useState(true)
  const [mostrarFeedback, setMostrarFeedback] = useState(true)
  const [mostrarImportacion, setMostrarImportacion] = useState(true)

  const [statsGlobales, setStatsGlobales] = useState({ publicados: 0, conVariantes: 0, combos: 0 })

  useEffect(() => { cargarPaquetes() }, [pagina, busqueda, filtroEstado])
  useEffect(() => { cargarStats(); cargarActividad(); cargarStatsGlobales() }, [])

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

    const { data, count, error } = await query

    if (error) {
      console.error('Error cargando paquetes:', error)
      setPaquetes([])
      setTotal(0)
      setCargando(false)
      return
    }

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
        }

        // ✅ Contar versiones siempre, independientemente de si tiene evaluaciones
        const { count: versiones } = await supabase
          .from('package_versions')
          .select('*', { count: 'exact', head: true })
          .eq('package_id', pkg.id)

        const totalVersiones = versiones || 0

        const color = COLORES[i % COLORES.length]
        const icono = pkg.package_type === 'combo'
          ? 'inventory_2'
          : ICONOS_POR_TIPO[i % ICONOS_POR_TIPO.length]

        return { ...pkg, ventas: ventas || 0, totalPreguntas, totalNiveles, totalVersiones, color, icono }
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

  async function cargarStatsGlobales() {
    const [
      { count: publicados },
      { count: conVariantes },
      { count: combos },
      { count: totalAll },
    ] = await Promise.all([
      supabase.from('packages').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('packages').select('*', { count: 'exact', head: true }).eq('pricing_mode', 'per_profession'),
      supabase.from('packages').select('*', { count: 'exact', head: true }).eq('package_type', 'combo'),
      supabase.from('packages').select('*', { count: 'exact', head: true }),
    ])

    setStatsGlobales({
      publicados: publicados || 0,
      conVariantes: conVariantes || 0,
      combos: combos || 0,
      total: totalAll || 0,
    })
  }

  async function cargarActividad() {
    const { data, error } = await supabase
      .from('packages')
      .select('name, created_at, is_active, pricing_mode, has_level_selector, package_type')
      .order('created_at', { ascending: false })
      .limit(4)

    if (error) { setActividad([]); return }
    setActividad(data || [])
  }

  async function toggleEstado(pkg) {
    const { error } = await supabase
      .from('packages')
      .update({ is_active: !pkg.is_active })
      .eq('id', pkg.id)

    if (error) { alert('No se pudo actualizar el estado del paquete.'); return }
    cargarPaquetes()
    cargarStats()
    cargarStatsGlobales()
  }

  async function eliminarPaquete(id) {
    if (!confirm('¿Eliminar este paquete? Esta acción no se puede deshacer.')) return
    const { error } = await supabase.from('packages').delete().eq('id', id)
    if (error) { alert('No se pudo eliminar el paquete.'); return }
    cargarPaquetes()
    cargarStats()
    cargarStatsGlobales()
  }

  function descargarPlantillaCSV() {
    const blob = new Blob([PLANTILLA_CSV], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_preguntas_simulatest.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function descargarPlantillaJSON() {
    const blob = new Blob([PLANTILLA_JSON], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_preguntas_simulatest.json'; a.click()
    URL.revokeObjectURL(url)
  }

  function manejarCargaMasiva(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase() || ''
    setTipoArchivo(extension.toUpperCase())
    setSubiendo(true)

    if (extension === 'csv') {
      setMsgCarga('CSV detectado. Ideal para cargas masivas de preguntas. Usa luego el editor del paquete para importarlo en el nivel correcto.')
    } else if (extension === 'json') {
      setMsgCarga('JSON detectado. Útil para estructuras más completas o migraciones preparadas. Revisa el paquete y el nivel antes de importar.')
    } else {
      setMsgCarga('Archivo detectado. Verifica que corresponda al paquete, versión y nivel correctos antes de importarlo.')
    }

    setTimeout(() => setSubiendo(false), 1200)
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)
  const paginasVisibles = getVisiblePages(pagina, totalPaginas)
  const resumenTotal = statsGlobales.total || 1

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 max-w-7xl mx-auto">

        {/* Header */}
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
              Administra paquetes madre, combos, versiones por profesión, materiales y estado de publicación.
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
          {/* Columna principal */}
          <div className="lg:col-span-9 space-y-6">

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">Total Preguntas</p>
                <h4 className="text-2xl font-black font-headline text-blue-800">
                  {stats.preguntas >= 1000 ? `${(stats.preguntas / 1000).toFixed(1)}k` : stats.preguntas}
                </h4>
                <div className="flex items-center gap-1 text-[10px] text-blue-600 mt-2">
                  <span className="material-symbols-outlined text-sm">quiz</span>
                  <span>En el banco</span>
                </div>
              </div>

              <div className="bg-green-50 p-5 rounded-2xl border border-green-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-green-600 mb-1">Ventas Totales</p>
                <h4 className="text-2xl font-black font-headline text-green-800">{stats.ventas.toLocaleString()}</h4>
                <div className="flex items-center gap-1 text-[10px] text-green-600 mt-2">
                  <span className="material-symbols-outlined text-sm">payments</span>
                  <span>Compras registradas</span>
                </div>
              </div>

              <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1">Paquetes Activos</p>
                <h4 className="text-2xl font-black font-headline text-orange-800">{stats.activos}</h4>
                <div className="flex items-center gap-1 text-[10px] text-orange-600 mt-2">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>Disponibles hoy</span>
                </div>
              </div>

              <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100/50">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1">Materiales</p>
                <h4 className="text-2xl font-black font-headline text-indigo-800">{stats.materiales}</h4>
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
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
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
                        onClick={() => { setFiltroEstado(f.key); setPagina(1) }}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          filtroEstado === f.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
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
                      paquetes.map(pkg => {
                        const precioMostrado = pkg.price ?? pkg.base_price ?? 0
                        const esCombo = pkg.package_type === 'combo'
                        const porProfesion = pkg.pricing_mode === 'per_profession'

                        return (
                          <tr key={pkg.id} className="group hover:bg-surface-container-low/50 transition-colors">
                            <td className="px-6 py-5">
                              <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-lg ${pkg.color.bg} ${pkg.color.text} flex items-center justify-center flex-shrink-0`}>
                                  <span className="material-symbols-outlined text-xl">{pkg.icono}</span>
                                </div>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-sm">{pkg.name}</p>
                                    {esCombo ? <Badge tone="purple">Combo</Badge> : <Badge tone="blue">Paquete</Badge>}
                                    {porProfesion ? <Badge tone="primary">Precio por profesión</Badge> : <Badge tone="blue">Precio global</Badge>}
                                    {pkg.has_level_selector && <Badge tone="warning">Selector de nivel</Badge>}
                                  </div>

                                  <p className="text-[10px] text-on-surface-variant mt-1">
                                    ID: {String(pkg.id).slice(0, 8).toUpperCase()}
                                  </p>

                                  {pkg.description && (
                                    <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{pkg.description}</p>
                                  )}

                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {pkg.slug && <Badge>{pkg.slug}</Badge>}
                                    {pkg.is_active ? <Badge tone="success">Publicado</Badge> : <Badge>Borrador</Badge>}
                                  </div>
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
                                <div>
                                  <span className="font-semibold">{esCombo ? 'Combo' : 'Normal'}</span>
                                  <span className="text-on-surface-variant ml-1">tipo comercial</span>
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
                              {formatMoney(precioMostrado)}
                            </td>

                            <td className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={async () => {
                                    // Caso 1: evaluations_ids ya está seteado
                                    const evalId = Array.isArray(pkg.evaluations_ids) && pkg.evaluations_ids.length > 0
                                      ? pkg.evaluations_ids[0]
                                      : null
                                    if (evalId) { navigate(`/admin/evaluaciones/${evalId}/editar`); return }

                                    // Caso 2: buscar evaluación via package_versions → evaluation_versions
                                    const { data: vers } = await supabase
                                      .from('package_versions')
                                      .select('id')
                                      .eq('package_id', pkg.id)
                                    if (vers?.length) {
                                      const versionIds = vers.map(v => v.id)
                                      const { data: evalVers } = await supabase
                                        .from('evaluation_versions')
                                        .select('evaluation_id')
                                        .in('package_version_id', versionIds)
                                        .limit(1)
                                      if (evalVers?.[0]?.evaluation_id) {
                                        navigate(`/admin/evaluaciones/${evalVers[0].evaluation_id}/editar`)
                                        return
                                      }
                                    }

                                    alert('No se encontró la evaluación vinculada a este paquete.')
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
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              <div className="p-6 bg-surface-container-low/50 border-t border-outline-variant/10 flex items-center justify-between gap-4 flex-wrap">
                <p className="text-xs text-on-surface-variant font-medium">
                  Mostrando {Math.min((pagina - 1) * POR_PAGINA + 1, Math.max(total, 1))}–
                  {Math.min(pagina * POR_PAGINA, total)} de {total} paquetes
                </p>

                <div className="flex items-center gap-1">
                  <button onClick={() => setPagina(1)} disabled={pagina === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all">
                    <span className="material-symbols-outlined text-lg">keyboard_double_arrow_left</span>
                  </button>

                  <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all">
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                  </button>

                  {paginasVisibles.map(p => (
                    <button key={p} onClick={() => setPagina(p)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                        pagina === p ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface hover:bg-surface-container'
                      }`}>
                      {p}
                    </button>
                  ))}

                  <button onClick={() => setPagina(p => Math.min(totalPaginas || 1, p + 1))}
                    disabled={pagina === totalPaginas || totalPaginas === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all">
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                  </button>

                  <button onClick={() => setPagina(totalPaginas || 1)}
                    disabled={pagina === totalPaginas || totalPaginas === 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container disabled:opacity-30 transition-all">
                    <span className="material-symbols-outlined text-lg">keyboard_double_arrow_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Columna lateral */}
          <div className="lg:col-span-3 space-y-6">

            {/* Carga masiva */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-outline-variant/15">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary-fixed text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                </div>
                <h3 className="font-bold text-sm">Carga Masiva</h3>
              </div>

              <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
                Zona de preparación. La importación real se hace dentro del editor del paquete, por nivel.
              </p>

              <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                subiendo ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary bg-surface-container-low/50'
              }`}>
                <span className={`material-symbols-outlined text-3xl mb-2 ${subiendo ? 'text-primary animate-bounce' : 'text-on-surface-variant'}`}>
                  cloud_upload
                </span>
                <p className="text-[10px] font-bold text-on-surface-variant uppercase">
                  {subiendo ? 'Procesando...' : 'Arrastra archivos aquí'}
                </p>
                <p className="text-[9px] text-on-surface-variant mt-1">CSV o JSON · máximo 25MB</p>
                <input type="file" accept=".json,.csv" className="hidden" onChange={manejarCargaMasiva} />
              </label>

              <div className="mt-4 space-y-3">
                <button onClick={descargarPlantillaCSV}
                  className="w-full py-2.5 rounded-lg border border-outline-variant text-[10px] font-bold text-on-surface-variant flex items-center justify-center gap-2 hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-sm">description</span>
                  Descargar Plantilla CSV
                </button>
                <button onClick={descargarPlantillaJSON}
                  className="w-full py-2.5 rounded-lg border border-outline-variant text-[10px] font-bold text-on-surface-variant flex items-center justify-center gap-2 hover:bg-surface-container transition-colors">
                  <span className="material-symbols-outlined text-sm">data_object</span>
                  Descargar Plantilla JSON
                </button>
              </div>

              {msgCarga && (
                <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-on-surface-variant">
                  <p className="font-semibold mb-1">{tipoArchivo ? `Archivo ${tipoArchivo} detectado` : 'Archivo detectado'}</p>
                  <p>{msgCarga}</p>
                </div>
              )}
            </div>

            {/* Resumen catálogo */}
            <div className="bg-primary p-6 rounded-2xl shadow-xl shadow-primary/10 text-on-primary relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-sm mb-2">Resumen del Catálogo</h3>

                <div className="space-y-4 mt-4">
                  {[
                    { label: 'PUBLICADOS', value: statsGlobales.publicados },
                    { label: 'POR PROFESIÓN', value: statsGlobales.conVariantes },
                    { label: 'COMBOS', value: statsGlobales.combos },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full" style={{ width: `${resumenTotal ? (value / resumenTotal) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 text-[10px] opacity-90 leading-relaxed">
                  Usa paquetes madre para una convocatoria completa, versiones cuando cambian cargos o precios, y combos para promociones.
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            </div>

            {/* Guía rápida */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/15 overflow-hidden">
              <button onClick={() => setMostrarGuia(v => !v)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Guía rápida</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Flujo recomendado</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">{mostrarGuia ? 'expand_less' : 'expand_more'}</span>
              </button>

              {mostrarGuia && (
                <div className="px-6 pb-6 space-y-3 text-xs text-on-surface-variant">
                  {[
                    'Crea el paquete madre y define si es normal o combo.',
                    'Si aplica, crea versiones por profesión: Técnico, Profesional, Asistencial, etc.',
                    'Define si el precio será global o por profesión.',
                    'Asocia evaluaciones y materiales a la versión exacta que comprará el usuario.',
                    'Publica solo cuando el paquete tenga contenido y revisión básica.',
                  ].map((paso, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="font-bold text-primary">{i + 1}.</span>
                      <span>{paso}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Importación */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/15 overflow-hidden">
              <button onClick={() => setMostrarImportacion(v => !v)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Importación clara</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Qué subir y cuándo usar cada formato</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">{mostrarImportacion ? 'expand_less' : 'expand_more'}</span>
              </button>

              {mostrarImportacion && (
                <div className="px-6 pb-6 space-y-3 text-xs text-on-surface-variant">
                  <div className="p-3 rounded-xl bg-surface-container">
                    <p className="font-bold text-on-surface mb-1">CSV</p>
                    <p>Úsalo para subir muchas preguntas rápido cuando la estructura es simple y repetitiva.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-container">
                    <p className="font-bold text-on-surface mb-1">JSON</p>
                    <p>Úsalo cuando quieras conservar estructura, bloques, metadatos o preparación previa.</p>
                  </div>
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <p className="font-bold text-on-surface mb-1">Regla importante</p>
                    <p>Antes de importar, confirma siempre: paquete correcto, versión correcta y nivel correcto.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback por pregunta */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/15 overflow-hidden">
              <button onClick={() => setMostrarFeedback(v => !v)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Retroalimentación por pregunta</h4>
                  <p className="text-xs text-on-surface-variant mt-1">Tipos de feedback según respuesta</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">{mostrarFeedback ? 'expand_less' : 'expand_more'}</span>
              </button>

              {mostrarFeedback && (
                <div className="px-6 pb-6 space-y-3 text-xs text-on-surface-variant">
                  {[
                    { icon: 'task_alt', text: 'Si responde bien: mostrar refuerzo positivo y resumen corto.' },
                    { icon: 'radio_button_checked', text: 'Si marca A, B, C o D: permitir explicación específica por opción elegida.' },
                    { icon: 'hourglass_disabled', text: 'Si no responde: mostrar feedback distinto para omisión o falta de tiempo.' },
                  ].map(({ icon, text }, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-primary text-base mt-0.5">{icon}</span>
                      <span>{text}</span>
                    </div>
                  ))}
                  <div className="p-3 rounded-xl bg-surface-container">
                    <p className="font-bold text-on-surface mb-1">Meta del admin</p>
                    <p>Que puedas escribir feedback manual o apoyarte en IA sin dañar la lógica del examen.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Asistente IA DeepSeek */}
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/15 overflow-hidden">
              <button onClick={() => setMostrarDeepSeek(v => !v)} className="w-full px-6 py-4 flex items-center justify-between text-left">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Asistente IA · DeepSeek
                    </h4>
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-primary/10 text-primary uppercase">Live</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">Genera explicaciones y feedback real con IA</p>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant">{mostrarDeepSeek ? 'expand_less' : 'expand_more'}</span>
              </button>

              {mostrarDeepSeek && (
                <div className="px-6 pb-6">
                  <PanelDeepSeek />
                </div>
              )}
            </div>

            {/* Actividad reciente */}
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
                            {item.package_type === 'combo' ? 'Combo actualizado' : item.is_active ? 'Paquete activo' : 'Paquete en borrador'}
                          </p>
                          <p className="text-[10px] text-on-surface-variant">
                            {item.name} · {tiempoRelativo(item.created_at)}
                          </p>
                          <p className="text-[10px] text-on-surface-variant mt-1">
                            {item.pricing_mode === 'per_profession' ? 'Precio por profesión' : 'Precio global'}
                            {item.has_level_selector ? ' · selector de nivel' : ''}
                            {item.package_type === 'combo' ? ' · combo' : ''}
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

      {/* FAB */}
      <button
        onClick={() => navigate('/admin/evaluaciones/nueva')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
      </button>
    </div>
  )
}