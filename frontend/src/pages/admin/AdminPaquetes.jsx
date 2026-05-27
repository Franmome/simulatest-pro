import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../utils/supabase'

// ─── Catálogo de cerebros IA ──────────────────────────────────────────────────
const CEREBROS = [
  {
    id: 'deepseek-v3',
    nombre: 'DeepSeek V3',
    proveedor: 'DeepSeek',
    modelo: 'deepseek-chat',
    tier: 'económico',
    precioInput: 0.27,
    precioOutput: 1.10,
    contexto: 64000,
    maxOutput: 8192,
    descripcion: 'Excelente relación calidad/precio. Ideal para generación masiva de preguntas y retroalimentación rápida.',
    color: 'blue',
  },
  {
    id: 'gemini-flash-2',
    nombre: 'Gemini 2.0 Flash',
    proveedor: 'Google',
    modelo: 'gemini-2.0-flash',
    tier: 'económico',
    precioInput: 0.10,
    precioOutput: 0.40,
    contexto: 1000000,
    maxOutput: 8192,
    descripcion: 'El más rápido y barato. Contexto de 1M tokens. Perfecto para salas en tiempo real.',
    color: 'green',
  },
  {
    id: 'gemini-flash-15',
    nombre: 'Gemini 1.5 Flash',
    proveedor: 'Google',
    modelo: 'gemini-1.5-flash',
    tier: 'económico',
    precioInput: 0.075,
    precioOutput: 0.30,
    contexto: 1000000,
    maxOutput: 8192,
    descripcion: 'Rápido y muy económico. Contexto 1M tokens. Bueno para Modo Práctica y análisis ligero.',
    color: 'teal',
  },
  {
    id: 'gemini-pro-15',
    nombre: 'Gemini 1.5 Pro',
    proveedor: 'Google',
    modelo: 'gemini-1.5-pro',
    tier: 'avanzado',
    precioInput: 1.25,
    precioOutput: 5.00,
    contexto: 2000000,
    maxOutput: 8192,
    descripcion: 'Contexto de 2M tokens. Análisis profundo de documentos largos. Ideal para Cuaderno IA.',
    color: 'yellow',
  },
  {
    id: 'gpt-4o',
    nombre: 'GPT-4o',
    proveedor: 'OpenAI',
    modelo: 'gpt-4o',
    tier: 'avanzado',
    precioInput: 2.50,
    precioOutput: 10.00,
    contexto: 128000,
    maxOutput: 16384,
    descripcion: 'Multimodal: lee PDFs, imágenes, Word, Excel y YouTube. Motor principal del Cuaderno IA.',
    color: 'emerald',
  },
  {
    id: 'gpt-4o-mini',
    nombre: 'GPT-4.1 mini',
    proveedor: 'OpenAI',
    modelo: 'gpt-4.1-mini',
    tier: 'económico',
    precioInput: 0.40,
    precioOutput: 1.60,
    contexto: 1047576,
    maxOutput: 32768,
    descripcion: 'Versión ligera de OpenAI. Ideal para chats rápidos del Cuaderno y respuestas de práctica.',
    color: 'slate',
  },
]

const HERRAMIENTAS = [
  { id: 'modo_examen', nombre: 'Modo Examen', icon: 'quiz', desc: 'Simulacros cronometrados con retroalimentación IA' },
  { id: 'modo_practica', nombre: 'Modo Práctica', icon: 'school', desc: 'Práctica libre sin presión de tiempo' },
  { id: 'salas', nombre: 'Salas Competitivas', icon: 'groups', desc: 'Competencias multijugador en tiempo real' },
  { id: 'cuaderno', nombre: 'Cuaderno IA', icon: 'auto_stories', desc: 'Asistente IA tipo NotebookLM para estudiar documentos' },
]

const HERRAMIENTAS_DEFAULT = Object.fromEntries(
  HERRAMIENTAS.map(h => [h.id, { activo: false, cerebro: 'deepseek-v3' }])
)

const TIER_COLORS = {
  económico: 'bg-green-100 text-green-700',
  intermedio: 'bg-orange-100 text-orange-700',
  avanzado:   'bg-blue-100 text-blue-700',
  premium:    'bg-violet-100 text-violet-700',
}

// ─── Pequeños helpers visuales ────────────────────────────────────────────────
function Badge({ children, tone = 'default' }) {
  const map = {
    default: 'bg-surface-container text-on-surface-variant',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    primary: 'bg-primary/10 text-primary',
    danger:  'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${map[tone] ?? map.default}`}>
      {children}
    </span>
  )
}

function CerebroTag({ cerebroId }) {
  const c = CEREBROS.find(x => x.id === cerebroId)
  if (!c) return null
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${TIER_COLORS[c.tier]}`}>
      {c.nombre}
    </span>
  )
}

// ─── Panel info cerebros ──────────────────────────────────────────────────────
function PanelCerebros({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant/15 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold font-headline text-on-surface">Cerebros IA disponibles</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">Precios en USD por millón de tokens · Actualizado mayo 2025</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {CEREBROS.map(c => (
            <div key={c.id} className="border border-outline-variant/20 rounded-2xl p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold text-sm text-on-surface">{c.nombre}</p>
                  <p className="text-[10px] text-on-surface-variant">{c.proveedor} · <code className="font-mono">{c.modelo}</code></p>
                </div>
                <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${TIER_COLORS[c.tier]}`}>
                  {c.tier}
                </span>
              </div>

              <p className="text-xs text-on-surface-variant leading-relaxed">{c.descripcion}</p>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-surface-container rounded-lg p-2">
                  <p className="text-on-surface-variant font-medium">Entrada</p>
                  <p className="font-bold text-on-surface">${c.precioInput.toFixed(3)}<span className="font-normal">/1M tok</span></p>
                </div>
                <div className="bg-surface-container rounded-lg p-2">
                  <p className="text-on-surface-variant font-medium">Salida</p>
                  <p className="font-bold text-on-surface">${c.precioOutput.toFixed(2)}<span className="font-normal">/1M tok</span></p>
                </div>
                <div className="bg-surface-container rounded-lg p-2">
                  <p className="text-on-surface-variant font-medium">Contexto</p>
                  <p className="font-bold text-on-surface">{(c.contexto / 1000).toFixed(0)}K tok</p>
                </div>
                <div className="bg-surface-container rounded-lg p-2">
                  <p className="text-on-surface-variant font-medium">Max salida</p>
                  <p className="font-bold text-on-surface">{(c.maxOutput / 1000).toFixed(0)}K tok</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Modal crear / editar paquete ─────────────────────────────────────────────
function ModalPaquete({ paquete, convocatorias, onClose, onSaved }) {
  const esNuevo = !paquete?.id

  const [form, setForm] = useState({
    name:          paquete?.name          ?? '',
    description:   paquete?.description   ?? '',
    price:         paquete?.price         ?? 0,
    duracion_dias: paquete?.duracion_dias ?? 30,
    convocatoria_id: paquete?.convocatoria_id ?? '',
    is_active:     paquete?.is_active     ?? false,
    herramientas:  { ...HERRAMIENTAS_DEFAULT, ...(paquete?.herramientas ?? {}) },
  })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function toggleHerramienta(id) {
    setForm(f => ({
      ...f,
      herramientas: {
        ...f.herramientas,
        [id]: { ...f.herramientas[id], activo: !f.herramientas[id]?.activo },
      },
    }))
  }

  function setCerebro(herramientaId, cerebroId) {
    setForm(f => ({
      ...f,
      herramientas: {
        ...f.herramientas,
        [herramientaId]: { ...f.herramientas[herramientaId], cerebro: cerebroId },
      },
    }))
  }

  async function guardar() {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')

    const payload = {
      name:           form.name.trim(),
      description:    form.description.trim(),
      price:          Number(form.price) || 0,
      duracion_dias:  Number(form.duracion_dias) || 30,
      convocatoria_id: form.convocatoria_id || null,
      is_active:      form.is_active,
      herramientas:   form.herramientas,
    }

    let err
    if (esNuevo) {
      ;({ error: err } = await supabase.from('packages').insert([payload]))
    } else {
      ;({ error: err } = await supabase.from('packages').update(payload).eq('id', paquete.id))
    }

    setGuardando(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant/15 p-6 flex items-center justify-between">
          <h2 className="text-lg font-extrabold font-headline text-on-surface">
            {esNuevo ? 'Nuevo paquete' : `Editar: ${paquete.name}`}
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* Info básica */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Información básica</h3>

            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Nombre del paquete *</label>
              <input
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Ej: Paquete Profesional CNSC 2025"
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Descripción</label>
              <textarea
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder="Describe brevemente qué incluye este paquete..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1 block">Precio (COP)</label>
                <input
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={e => setField('price', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant mb-1 block">Duración (días)</label>
                <input
                  type="number"
                  min="1"
                  value={form.duracion_dias}
                  onChange={e => setField('duracion_dias', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Convocatoria vinculada (opcional)</label>
              <select
                value={form.convocatoria_id}
                onChange={e => setField('convocatoria_id', e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">— Sin convocatoria específica —</option>
                {convocatorias.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 bg-surface-container">
              <div>
                <p className="text-sm font-bold text-on-surface">Publicado</p>
                <p className="text-xs text-on-surface-variant">Los usuarios pueden ver y comprar este paquete</p>
              </div>
              <button
                onClick={() => setField('is_active', !form.is_active)}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.is_active ? 'bg-primary' : 'bg-outline-variant'}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.is_active ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </section>

          {/* Herramientas */}
          <section className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Herramientas incluidas</h3>
            <p className="text-xs text-on-surface-variant -mt-2">Activa cada herramienta y asigna el cerebro IA que usará.</p>

            <div className="space-y-3">
              {HERRAMIENTAS.map(h => {
                const config = form.herramientas[h.id] ?? { activo: false, cerebro: 'deepseek-v3' }
                const cerebroSel = CEREBROS.find(c => c.id === config.cerebro) ?? CEREBROS[0]

                return (
                  <div
                    key={h.id}
                    className={`border rounded-2xl overflow-hidden transition-all ${config.activo ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/20 bg-surface-container'}`}
                  >
                    {/* Tool header row */}
                    <div className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`material-symbols-outlined text-xl ${config.activo ? 'text-primary' : 'text-on-surface-variant'}`}
                          style={{ fontVariationSettings: config.activo ? "'FILL' 1" : "'FILL' 0" }}
                        >
                          {h.icon}
                        </span>
                        <div>
                          <p className="text-sm font-bold text-on-surface">{h.nombre}</p>
                          <p className="text-[10px] text-on-surface-variant">{h.desc}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleHerramienta(h.id)}
                        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${config.activo ? 'bg-primary' : 'bg-outline-variant'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${config.activo ? 'left-6' : 'left-1'}`} />
                      </button>
                    </div>

                    {/* Cerebro selector (only when active) */}
                    {config.activo && (
                      <div className="px-4 pb-4 space-y-2 border-t border-primary/10 pt-3">
                        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Cerebro IA para esta herramienta</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {CEREBROS.map(c => (
                            <button
                              key={c.id}
                              onClick={() => setCerebro(h.id, c.id)}
                              className={`text-left p-2.5 rounded-xl border text-xs transition-all ${
                                config.cerebro === c.id
                                  ? 'border-primary bg-primary/10 text-on-surface'
                                  : 'border-outline-variant/20 hover:border-primary/30 text-on-surface-variant'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="font-bold text-[11px]">{c.nombre}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${TIER_COLORS[c.tier]}`}>{c.tier}</span>
                              </div>
                              <span className="text-[9px] text-on-surface-variant">
                                ${c.precioInput}/1M in · ${c.precioOutput}/1M out · ctx {(c.contexto / 1000).toFixed(0)}K
                              </span>
                            </button>
                          ))}
                        </div>
                        {/* Selected summary */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                          <span className="material-symbols-outlined text-primary text-sm">check_circle</span>
                          <span className="text-[10px] text-primary font-medium">
                            Seleccionado: <strong>{cerebroSel.nombre}</strong> · {cerebroSel.proveedor} · ${cerebroSel.precioInput}/1M in
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {guardando ? 'Guardando…' : esNuevo ? 'Crear paquete' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminPaquetes() {
  const [paquetes, setPaquetes] = useState([])
  const [convocatorias, setConvocatorias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(null)          // null | {} (nuevo) | {id,...} (editar)
  const [confirmar, setConfirmar] = useState(null)  // paquete a eliminar
  const [panelCerebros, setPanelCerebros] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  const cargarPaquetes = useCallback(async () => {
    setCargando(true)
    let q = supabase
      .from('packages')
      .select('id, name, description, price, is_active, herramientas, convocatoria_id, duracion_dias, created_at')
      .order('created_at', { ascending: false })

    if (busqueda.trim()) q = q.ilike('name', `%${busqueda.trim()}%`)

    const { data, error } = await q
    if (!error) setPaquetes(data || [])
    setCargando(false)
  }, [busqueda])

  useEffect(() => { cargarPaquetes() }, [cargarPaquetes])

  useEffect(() => {
    supabase
      .from('convocatorias')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setConvocatorias(data || []))
  }, [])

  async function toggleActivo(pkg) {
    await supabase.from('packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id)
    cargarPaquetes()
  }

  async function eliminar() {
    if (!confirmar) return
    setEliminando(true)
    await supabase.from('packages').delete().eq('id', confirmar.id)
    setEliminando(false)
    setConfirmar(null)
    cargarPaquetes()
  }

  const stats = {
    total: paquetes.length,
    activos: paquetes.filter(p => p.is_active).length,
    herramientasActivas: paquetes.reduce((acc, p) => {
      const h = p.herramientas || {}
      return acc + Object.values(h).filter(v => v?.activo).length
    }, 0),
  }

  const paquetesFiltrados = paquetes.filter(p =>
    !busqueda.trim() || p.name?.toLowerCase().includes(busqueda.toLowerCase())
  )

  function herramientasActivas(pkg) {
    if (!pkg.herramientas) return []
    return HERRAMIENTAS.filter(h => pkg.herramientas[h.id]?.activo)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Paquetes</span>
            </nav>
            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Gestión de Paquetes
            </h1>
            <p className="text-on-surface-variant mt-1 text-sm">
              Cada paquete es un contenedor de herramientas IA. El usuario trae su OPEC; nosotros ponemos la infraestructura.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setPanelCerebros(true)}
              className="px-4 py-2.5 rounded-full border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">psychology</span>
              Ver cerebros IA
            </button>
            <button
              onClick={() => setModal({})}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Nuevo paquete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 border border-blue-100/50 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-1">Total</p>
            <p className="text-2xl font-black text-blue-800">{stats.total}</p>
            <p className="text-[10px] text-blue-600 mt-1">paquetes registrados</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100/50 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Publicados</p>
            <p className="text-2xl font-black text-emerald-800">{stats.activos}</p>
            <p className="text-[10px] text-emerald-600 mt-1">disponibles para compra</p>
          </div>
          <div className="bg-violet-50 border border-violet-100/50 rounded-2xl p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-1">Herramientas activas</p>
            <p className="text-2xl font-black text-violet-800">{stats.herramientasActivas}</p>
            <p className="text-[10px] text-violet-600 mt-1">en todos los paquetes</p>
          </div>
        </div>

        {/* Buscador */}
        <div className="relative mb-6">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar paquetes por nombre…"
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-outline-variant/20 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Lista de paquetes */}
        {cargando ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : paquetesFiltrados.length === 0 ? (
          <div className="text-center py-24 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-4 block opacity-30">inventory_2</span>
            <p className="font-bold">{busqueda ? 'Sin resultados' : 'Sin paquetes todavía'}</p>
            <p className="text-sm mt-1">{busqueda ? 'Intenta otra búsqueda' : 'Crea el primer paquete con el botón de arriba'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paquetesFiltrados.map(pkg => {
              const activas = herramientasActivas(pkg)
              const precio = Number(pkg.price || 0).toLocaleString('es-CO')
              const convNombre = convocatorias.find(c => c.id === pkg.convocatoria_id)?.nombre

              return (
                <div
                  key={pkg.id}
                  className="bg-surface-container-lowest border border-outline-variant/15 rounded-2xl p-5 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-on-surface">{pkg.name}</h3>
                        <Badge tone={pkg.is_active ? 'success' : 'default'}>
                          {pkg.is_active ? 'Publicado' : 'Borrador'}
                        </Badge>
                        {convNombre && (
                          <Badge tone="primary">{convNombre}</Badge>
                        )}
                      </div>

                      {pkg.description && (
                        <p className="text-xs text-on-surface-variant mb-3 line-clamp-1">{pkg.description}</p>
                      )}

                      {/* Herramientas activas */}
                      <div className="flex flex-wrap gap-2">
                        {activas.length === 0 ? (
                          <span className="text-[10px] text-on-surface-variant italic">Sin herramientas activas</span>
                        ) : activas.map(h => {
                          const config = pkg.herramientas?.[h.id]
                          const cerebro = CEREBROS.find(c => c.id === config?.cerebro)
                          return (
                            <div key={h.id} className="flex items-center gap-1.5 bg-surface-container rounded-xl px-2.5 py-1">
                              <span
                                className="material-symbols-outlined text-primary text-xs"
                                style={{ fontVariationSettings: "'FILL' 1" }}
                              >
                                {h.icon}
                              </span>
                              <span className="text-[10px] font-medium text-on-surface">{h.nombre}</span>
                              {cerebro && <CerebroTag cerebroId={cerebro.id} />}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Precio + acciones */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-lg font-black text-on-surface">${precio}</p>
                        <p className="text-[10px] text-on-surface-variant">{pkg.duracion_dias ?? 30} días</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActivo(pkg)}
                          title={pkg.is_active ? 'Desactivar' : 'Publicar'}
                          className={`p-2 rounded-xl transition-colors ${pkg.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-on-surface-variant hover:bg-surface-container'}`}
                        >
                          <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {pkg.is_active ? 'toggle_on' : 'toggle_off'}
                          </span>
                        </button>
                        <button
                          onClick={() => setModal(pkg)}
                          title="Editar"
                          className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmar(pkg)}
                          title="Eliminar"
                          className="p-2 rounded-xl text-on-surface-variant hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal crear/editar */}
      {modal !== null && (
        <ModalPaquete
          paquete={Object.keys(modal).length ? modal : null}
          convocatorias={convocatorias}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargarPaquetes() }}
        />
      )}

      {/* Confirm eliminar */}
      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <p className="font-bold text-on-surface mb-1">¿Eliminar paquete?</p>
            <p className="text-sm text-on-surface-variant mb-6">
              Se eliminará <strong>{confirmar.name}</strong>. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmar(null)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={eliminar}
                disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {eliminando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel cerebros */}
      {panelCerebros && <PanelCerebros onClose={() => setPanelCerebros(false)} />}
    </div>
  )
}
