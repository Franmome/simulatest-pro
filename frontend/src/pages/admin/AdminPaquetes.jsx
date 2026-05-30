import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../../utils/supabase'

const BASE_URL = (() => {
  const env = import.meta.env.VITE_BACKEND_URL
  if (env && !env.includes('localhost')) return env
  if (!window.location.hostname.includes('localhost')) return window.location.origin
  return 'http://localhost:3000'
})()

// ─── Catálogo de cerebros IA ──────────────────────────────────────────────────
// Precios verificados mayo 2026 · USD por millón de tokens
const CEREBROS = [
  {
    id: 'deepseek-v4-flash',
    nombre: 'DeepSeek V4 Flash',
    proveedor: 'DeepSeek',
    modelo: 'deepseek-v4-flash',
    tier: 'económico',
    precioInput: 0.14,
    precioOutput: 0.28,
    contexto: 1000000,
    maxOutput: 384000,
    descripcion: 'El más barato del mercado. 1M contexto, 384K salida. Ideal para Modo Examen y generación de preguntas. ★ Recomendado para Examen y Práctica.',
  },
  {
    id: 'deepseek-v4-pro',
    nombre: 'DeepSeek V4 Pro',
    proveedor: 'DeepSeek',
    modelo: 'deepseek-v4-pro',
    tier: 'avanzado',
    precioInput: 1.74,
    precioOutput: 3.48,
    contexto: 1000000,
    maxOutput: 384000,
    descripcion: 'Modelo de razonamiento profundo. Para análisis complejos y paquetes de nivel directivo.',
  },
  {
    id: 'gemini-31-flash-lite',
    nombre: 'Gemini 3.1 Flash-Lite',
    proveedor: 'Google',
    modelo: 'gemini-3.1-flash-lite',
    tier: 'económico',
    precioInput: 0.25,
    precioOutput: 1.50,
    contexto: 1000000,
    maxOutput: 8192,
    descripcion: 'Rápido y económico de Google. 1M contexto. ★ Recomendado para Salas Competitivas (tiempo real).',
  },
  {
    id: 'gemini-35-flash',
    nombre: 'Gemini 3.5 Flash',
    proveedor: 'Google',
    modelo: 'gemini-3.5-flash',
    tier: 'avanzado',
    precioInput: 1.50,
    precioOutput: 9.00,
    contexto: 1000000,
    maxOutput: 65536,
    descripcion: 'El más inteligente de Google actualmente. Excelente para análisis de perfil y respuestas complejas.',
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
    descripcion: 'Multimodal: lee PDFs, imágenes, Word, Excel y YouTube. ★ Motor fijo del Cuaderno IA (no cambiar).',
  },
  {
    id: 'gpt-41-mini',
    nombre: 'GPT-4.1 mini',
    proveedor: 'OpenAI',
    modelo: 'gpt-4.1-mini',
    tier: 'económico',
    precioInput: 0.40,
    precioOutput: 1.60,
    contexto: 1047576,
    maxOutput: 32768,
    descripcion: 'Versión ligera de OpenAI. 1M contexto, 32K salida. Para chat rápido del Cuaderno.',
  },
]

const HERRAMIENTAS = [
  { id: 'simulacros', nombre: 'Simulacros + Práctica', icon: 'quiz',        desc: 'Exámenes IA cronometrados y práctica personalizada por áreas débiles' },
  { id: 'cuaderno',   nombre: 'Cuaderno IA',           icon: 'auto_stories', desc: 'Asistente IA tipo NotebookLM para estudiar documentos de la convocatoria' },
  { id: 'salas',      nombre: 'Salas Competitivas',    icon: 'groups',       desc: 'Competencias multijugador en tiempo real' },
]

const DEFAULTS_CEREBRO = {
  simulacros: 'deepseek-v4-flash',
  cuaderno:   'gpt-4o',
  salas:      'gemini-31-flash-lite',
}

const HERRAMIENTAS_DEFAULT = {
  ...Object.fromEntries(
    HERRAMIENTAS.map(h => [h.id, { activo: false, cerebro: DEFAULTS_CEREBRO[h.id] ?? 'deepseek-v4-flash', planes: [] }])
  ),
  paquete_completo: { activo: false, planes: [] },
}

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

  function addPlan(herramientaId) {
    setForm(f => {
      const cfg = f.herramientas[herramientaId] ?? { planes: [] }
      return {
        ...f,
        herramientas: {
          ...f.herramientas,
          [herramientaId]: {
            ...cfg,
            planes: [...(cfg.planes || []), { id: Date.now().toString(), label: '1 mes', dias: 30, precio: 0 }],
          },
        },
      }
    })
  }

  function updatePlan(herramientaId, planId, field, value) {
    setForm(f => {
      const cfg = f.herramientas[herramientaId] ?? { planes: [] }
      return {
        ...f,
        herramientas: {
          ...f.herramientas,
          [herramientaId]: {
            ...cfg,
            planes: (cfg.planes || []).map(p => p.id === planId ? { ...p, [field]: value } : p),
          },
        },
      }
    })
  }

  function removePlan(herramientaId, planId) {
    setForm(f => {
      const cfg = f.herramientas[herramientaId] ?? { planes: [] }
      return {
        ...f,
        herramientas: {
          ...f.herramientas,
          [herramientaId]: {
            ...cfg,
            planes: (cfg.planes || []).filter(p => p.id !== planId),
          },
        },
      }
    })
  }

  function togglePaqueteCompleto() {
    setForm(f => {
      const cfg = f.herramientas.paquete_completo ?? { planes: [] }
      return {
        ...f,
        herramientas: {
          ...f.herramientas,
          paquete_completo: { ...cfg, activo: !cfg.activo },
        },
      }
    })
  }

  async function guardar() {
    if (!form.name.trim()) { setError('El nombre es obligatorio'); return }
    setGuardando(true)
    setError('')

    const payload = {
      type:           'paquete',
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

                        {/* Planes de precio */}
                        <div className="pt-2 border-t border-primary/10">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Planes de precio</p>
                            <button
                              onClick={() => addPlan(h.id)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
                            >
                              <span className="material-symbols-outlined text-xs">add</span>
                              Agregar plan
                            </button>
                          </div>
                          {(!config.planes || config.planes.length === 0) ? (
                            <p className="text-[10px] text-on-surface-variant italic py-2">Sin planes definidos. Agrega al menos uno.</p>
                          ) : (
                            <div className="space-y-2">
                              {config.planes.map(plan => (
                                <div key={plan.id} className="flex items-center gap-2 p-2 rounded-xl bg-surface-container border border-outline-variant/20">
                                  <input
                                    value={plan.label}
                                    onChange={e => updatePlan(h.id, plan.id, 'label', e.target.value)}
                                    placeholder="Ej: 1 mes"
                                    className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest text-[11px] outline-none focus:ring-1 focus:ring-primary/30"
                                  />
                                  <div className="flex items-center gap-1 shrink-0">
                                    <input
                                      type="number" min="1"
                                      value={plan.dias}
                                      onChange={e => updatePlan(h.id, plan.id, 'dias', Number(e.target.value))}
                                      className="w-14 px-2 py-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest text-[11px] text-center outline-none focus:ring-1 focus:ring-primary/30"
                                    />
                                    <span className="text-[9px] text-on-surface-variant">días</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[9px] text-on-surface-variant">$</span>
                                    <input
                                      type="number" min="0"
                                      value={plan.precio}
                                      onChange={e => updatePlan(h.id, plan.id, 'precio', Number(e.target.value))}
                                      className="w-20 px-2 py-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest text-[11px] text-center outline-none focus:ring-1 focus:ring-primary/30"
                                    />
                                    <span className="text-[9px] text-on-surface-variant">COP</span>
                                  </div>
                                  <button
                                    onClick={() => removePlan(h.id, plan.id)}
                                    className="p-1 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Paquete Completo */}
            {(() => {
              const pcCfg = form.herramientas.paquete_completo ?? { activo: false, planes: [] }
              const anyActive = HERRAMIENTAS.some(h => form.herramientas[h.id]?.activo)
              if (!anyActive) return null
              return (
                <div className={`border-2 rounded-2xl overflow-hidden transition-all ${pcCfg.activo ? 'border-amber-400/50 bg-amber-50/50' : 'border-dashed border-outline-variant/30'}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`material-symbols-outlined text-xl ${pcCfg.activo ? 'text-amber-600' : 'text-on-surface-variant'}`}
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        workspace_premium
                      </span>
                      <div>
                        <p className="text-sm font-bold text-on-surface">Paquete Completo</p>
                        <p className="text-[10px] text-on-surface-variant">Precio especial por acceso a todas las herramientas activas</p>
                      </div>
                    </div>
                    <button
                      onClick={togglePaqueteCompleto}
                      className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${pcCfg.activo ? 'bg-amber-500' : 'bg-outline-variant'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${pcCfg.activo ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>

                  {pcCfg.activo && (
                    <div className="px-4 pb-4 border-t border-amber-200/50 pt-3 space-y-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Planes del paquete completo</p>
                        <button
                          onClick={() => addPlan('paquete_completo')}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 text-[10px] font-bold hover:bg-amber-200 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xs">add</span>
                          Agregar plan
                        </button>
                      </div>
                      {(!pcCfg.planes || pcCfg.planes.length === 0) ? (
                        <p className="text-[10px] text-on-surface-variant italic py-1">Sin planes definidos.</p>
                      ) : (
                        <div className="space-y-2">
                          {pcCfg.planes.map(plan => (
                            <div key={plan.id} className="flex items-center gap-2 p-2 rounded-xl bg-white border border-amber-200/50">
                              <input
                                value={plan.label}
                                onChange={e => updatePlan('paquete_completo', plan.id, 'label', e.target.value)}
                                placeholder="Ej: 1 mes"
                                className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest text-[11px] outline-none focus:ring-1 focus:ring-amber-400/30"
                              />
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number" min="1"
                                  value={plan.dias}
                                  onChange={e => updatePlan('paquete_completo', plan.id, 'dias', Number(e.target.value))}
                                  className="w-14 px-2 py-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest text-[11px] text-center outline-none focus:ring-1 focus:ring-amber-400/30"
                                />
                                <span className="text-[9px] text-on-surface-variant">días</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-[9px] text-on-surface-variant">$</span>
                                <input
                                  type="number" min="0"
                                  value={plan.precio}
                                  onChange={e => updatePlan('paquete_completo', plan.id, 'precio', Number(e.target.value))}
                                  className="w-20 px-2 py-1 rounded-lg border border-outline-variant/20 bg-surface-container-lowest text-[11px] text-center outline-none focus:ring-1 focus:ring-amber-400/30"
                                />
                                <span className="text-[9px] text-on-surface-variant">COP</span>
                              </div>
                              <button
                                onClick={() => removePlan('paquete_completo', plan.id)}
                                className="p-1 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                              >
                                <span className="material-symbols-outlined text-sm">delete</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })()}
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

// ─── Modal materiales base del cuaderno ──────────────────────────────────────
function ModalMateriales({ paquete, onClose }) {
  const [fuentes, setFuentes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef()

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    const token = await getToken()
    const r = await fetch(`${BASE_URL}/api/cuaderno/admin/${paquete.id}/fuentes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await r.json()
    setFuentes(json.fuentes || [])
    setCargando(false)
  }, [paquete.id])

  useEffect(() => { cargar() }, [cargar])

  async function subirArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true); setError('')
    const token = await getToken()
    const fd = new FormData()
    fd.append('pdf', file)
    const r = await fetch(`${BASE_URL}/api/cuaderno/admin/${paquete.id}/fuentes`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
    })
    const json = await r.json()
    setSubiendo(false)
    if (!r.ok) { setError(json.error || 'Error al subir archivo'); return }
    cargar()
    fileRef.current.value = ''
  }

  async function agregarYoutube() {
    if (!youtubeUrl.trim()) return
    setSubiendo(true); setError('')
    const token = await getToken()
    const r = await fetch(`${BASE_URL}/api/cuaderno/admin/${paquete.id}/fuentes/youtube`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: youtubeUrl }),
    })
    const json = await r.json()
    setSubiendo(false)
    if (!r.ok) { setError(json.error || 'Error al agregar YouTube'); return }
    setYoutubeUrl('')
    cargar()
  }

  async function eliminar(id) {
    const token = await getToken()
    await fetch(`${BASE_URL}/api/cuaderno/admin/${paquete.id}/fuentes/${id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
    })
    cargar()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="border-b border-outline-variant/15 p-5 flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-on-surface">Materiales del Cuaderno</h2>
            <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{paquete.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">

          {/* Info */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <span className="material-symbols-outlined text-amber-500 text-sm shrink-0 mt-0.5">lightbulb</span>
            <p>Los materiales aquí se cargan <strong>una sola vez</strong> y todos los usuarios del paquete los comparten automáticamente en su cuaderno. Ahorra tokens de ingestión por usuario.</p>
          </div>

          {/* Subir archivo */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Subir documento</p>
            <label className={`flex items-center justify-center gap-3 p-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${subiendo ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/30 hover:border-primary/40 hover:bg-primary/3'}`}>
              <span className="material-symbols-outlined text-on-surface-variant text-2xl">upload_file</span>
              <div className="text-sm text-on-surface-variant">
                <p className="font-medium">Haz clic para subir</p>
                <p className="text-[10px]">PDF · Word · Excel · Imágenes — máx 20 MB</p>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" onChange={subirArchivo} disabled={subiendo} />
            </label>
          </div>

          {/* YouTube */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Agregar video de YouTube</p>
            <div className="flex gap-2">
              <input
                value={youtubeUrl}
                onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-3 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-container text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={agregarYoutube}
                disabled={subiendo || !youtubeUrl.trim()}
                className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                {subiendo ? '…' : 'Agregar'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Lista materiales */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Materiales cargados ({fuentes.length})
            </p>
            {cargando ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : fuentes.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-6 italic">Sin materiales todavía</p>
            ) : (
              <div className="space-y-2">
                {fuentes.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container border border-outline-variant/15">
                    <span className="material-symbols-outlined text-primary text-xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {f.tipo === 'youtube' ? 'smart_display' : 'description'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{f.nombre}</p>
                      <p className="text-[10px] text-on-surface-variant">
                        {f.tipo === 'youtube' ? 'Video YouTube' : 'Documento'} · {new Date(f.created_at).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    <button
                      onClick={() => eliminar(f.id)}
                      className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
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
  const [materiales, setMateriales] = useState(null) // paquete para gestionar materiales
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
    const { error } = await supabase.from('packages').delete().eq('id', confirmar.id)
    setEliminando(false)
    if (error) {
      alert(`Error al eliminar: ${error.message}`)
      return
    }
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
                          onClick={() => setMateriales(pkg)}
                          title="Materiales del Cuaderno"
                          className="p-2 rounded-xl text-on-surface-variant hover:bg-violet-50 hover:text-violet-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-xl">auto_stories</span>
                        </button>
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

      {/* Modal materiales cuaderno */}
      {materiales && <ModalMateriales paquete={materiales} onClose={() => setMateriales(null)} />}
    </div>
  )
}
