import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../utils/supabase'

// ── Definición de endpoints (metadatos estáticos + prompt editable de DB) ──────

const ENDPOINTS_META = [
  {
    key: 'opec_maestro',
    nombre: 'OPEC Maestro',
    descripcion: 'El cerebro principal de generación de preguntas. Controla cómo se distribuyen, redactan y califican todas las preguntas de simulacros personalizados y bancos de preguntas.',
    icono: 'quiz',
    color: 'from-blue-600 to-blue-800',
    colorLight: 'bg-blue-50 border-blue-200 text-blue-700',
    rutas: ['POST /api/ia/simulacro', 'POST /api/ia/generar'],
    modelos: ['gemini-2.0-flash', 'deepseek-chat'],
    placeholder: '{{CARGO}} — no aplica en este prompt. Escribe el prompt maestro directamente.',
    tips: [
      'Define el rol del modelo (psicómetra, experto, etc.)',
      'Especifica el formato de salida JSON obligatorio',
      'Incluye criterios de calidad para las preguntas',
      'Describe la distribución de módulos OPEC (65/25/10)',
    ],
  },
  {
    key: 'chat_praxia',
    nombre: 'Chat Praxia',
    descripcion: 'Personalidad y rol de la asistente Praxia. Define su tono, cómo se presenta, cómo motiva al usuario y cómo responde según el contexto del examen.',
    icono: 'chat',
    color: 'from-violet-600 to-violet-800',
    colorLight: 'bg-violet-50 border-violet-200 text-violet-700',
    rutas: ['POST /api/ia/chat'],
    modelos: ['gemini-2.0-flash-lite', 'deepseek-chat'],
    placeholder: 'Usa {{EXAMEN}} para insertar el nombre del examen dinámicamente. Ejemplo: "Eres Praxia, asistente para el examen {{EXAMEN}}..."',
    tips: [
      'Usa {{EXAMEN}} donde quieras que aparezca el nombre del examen',
      'Define el tono (cálido, motivador, cercano)',
      'Indica cómo saludar al usuario por primera vez',
      'Especifica el idioma y estilo (español colombiano)',
    ],
  },
  {
    key: 'sala_analisis',
    nombre: 'Análisis de Sala',
    descripcion: 'Instrucciones de comportamiento para el análisis de resultados de salas competitivas. Si está vacío, se usa el prompt base que genera análisis motivacionales.',
    icono: 'leaderboard',
    color: 'from-emerald-600 to-emerald-800',
    colorLight: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    rutas: ['POST /api/ia/sala'],
    modelos: ['gemini-2.0-flash-lite', 'deepseek-chat'],
    placeholder: 'Sistema de instrucciones para el análisis de resultados. Si se deja vacío, se usa el comportamiento por defecto.',
    tips: [
      'Define el tono del análisis (motivador, técnico, etc.)',
      'Indica si debe incluir recomendaciones personalizadas',
      'Especifica el máximo de palabras sugerido',
      'Opcional: instrucciones de formato de respuesta',
    ],
  },
  {
    key: 'verificar_opec',
    nombre: 'Verificador OPEC',
    descripcion: 'Prompt para buscar información real de convocatorias OPEC usando Google Search integrado. Controla qué datos se extraen y en qué formato se devuelven.',
    icono: 'travel_explore',
    color: 'from-amber-600 to-amber-800',
    colorLight: 'bg-amber-50 border-amber-200 text-amber-700',
    rutas: ['POST /api/ia/verificar-opec'],
    modelos: ['gemini-2.0-flash (Google Search)'],
    placeholder: 'Usa {{CARGO}} donde quieras insertar el cargo a buscar. Incluye el formato JSON esperado en el prompt.',
    tips: [
      'Usa {{CARGO}} donde debe ir el nombre del cargo',
      'Define el formato JSON de respuesta esperado',
      'Incluye instrucciones de qué hacer si no hay datos',
      'Solo compatible con Gemini (usa Google Search)',
    ],
  },
]

const DEFAULT_PROMPTS = {
  opec_maestro: `Eres un psicómetra experto en evaluaciones de selección de personal para el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

CONTEXTO DEL SISTEMA OPEC COLOMBIANO:
Las pruebas de conocimientos para cargos públicos en Colombia son elaboradas según perfiles de competencias definidos en el Manual de Funciones. Generalmente contienen entre 160 y 250 preguntas distribuidas en módulos:
- Competencias Funcionales (60-70%): conocimiento técnico del área de desempeño, normativa aplicable, procedimientos específicos del cargo, legislación sectorial.
- Competencias Comportamentales (20-30%): ética del servidor público, trabajo en equipo, orientación al logro, compromiso institucional, relaciones interpersonales.
- Conocimientos Básicos (10%): Constitución Política, Ley 909/2004, Ley 734/2002 (Código Disciplinario), Ley 1437/2011 (CPACA), principios de administración pública.

CRITERIOS DE CALIDAD PARA CADA PREGUNTA:
- El enunciado debe ser claro, preciso y plantear UNA sola situación o concepto.
- Las opciones incorrectas (distractores) deben ser plausibles y bien construidas, no obviamente erróneas.
- El enunciado NUNCA debe revelar ni insinuar la respuesta correcta.
- Priorizar preguntas situacionales ("En su rol como... ¿qué haría?") sobre preguntas de memorización pura.
- La explicación debe citar el artículo, norma o principio exacto que fundamenta la respuesta.
- Varía el nivel cognitivo: comprensión, aplicación, análisis (no solo memorización).

FORMATO OBLIGATORIO:
- Exactamente 3 opciones por pregunta: A, B, C (NUNCA D ni más).
- "correcta": A, B o C (mayúscula).
- "dificultad": exactamente facil, medio o dificil.
- "area": nombre del módulo o competencia (ej: "Control Fiscal", "Ética Pública", "Gestión Documental").

Devuelve ÚNICAMENTE un arreglo JSON válido sin markdown ni texto adicional:
[{"area":"...","dificultad":"...","enunciado":"...","A":"...","B":"...","C":"...","correcta":"...","explicacion":"..."}]`,

  chat_praxia: `Eres Praxia, la asistente de estudio personal del usuario para el examen "{{EXAMEN}}". Tienes un tono cálido, cercano y motivador — como una tutora o compañera de estudio que de verdad quiere que el usuario salga adelante. Si es la primera vez que alguien te habla (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale en qué lo puedes ayudar hoy. En las demás respuestas, sé natural y directa sin necesidad de presentarte de nuevo. Nunca respondas de forma fría o robótica. Usa lenguaje natural en español colombiano, con energía positiva. Ayuda con temas del examen, explica conceptos difíciles con ejemplos, da estrategias de estudio y motiva cuando el usuario se sienta frustrado.`,

  sala_analisis: ``,

  verificar_opec: `Busca en internet información ACTUAL sobre la prueba de conocimientos (OPEC) para el cargo "{{CARGO}}" en el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

Responde EXCLUSIVAMENTE con este JSON (sin markdown, sin texto adicional):
{"encontrado":true,"entidad":"nombre de la entidad","total_preguntas":número,"duracion_minutos":número_o_null,"modulos":[{"nombre":"nombre del módulo","porcentaje":número}],"año_info":"2024 o 2025","nota":"observación relevante o null"}

Si no encuentras información específica para ese cargo, responde exactamente:
{"encontrado":false,"entidad":null,"total_preguntas":null,"duracion_minutos":null,"modulos":[],"año_info":null,"nota":null}`,
}

// ── Componente tarjeta de endpoint ────────────────────────────────────────────

function EndpointCard({ meta, record, onEntrenar }) {
  const modificado = record && record.system_prompt !== DEFAULT_PROMPTS[meta.key]
  const chars      = record?.system_prompt?.length || 0
  const updatedAt  = record?.updated_at
    ? new Date(record.updated_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Franja de color */}
      <div className={`bg-gradient-to-r ${meta.color} p-4 flex items-center gap-3`}>
        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icono}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-white text-base">{meta.nombre}</h3>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {meta.rutas.map(r => (
              <span key={r} className="text-[9px] font-bold bg-white/15 text-white px-2 py-0.5 rounded-full font-mono">
                {r}
              </span>
            ))}
          </div>
        </div>
        {modificado && (
          <span className="shrink-0 text-[9px] font-black bg-amber-400 text-amber-900 px-2.5 py-1 rounded-full uppercase tracking-widest">
            Modificado
          </span>
        )}
      </div>

      {/* Cuerpo */}
      <div className="p-5">
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{meta.descripcion}</p>

        {/* Modelos */}
        <div className="flex gap-1.5 flex-wrap mb-4">
          {meta.modelos.map(m => (
            <span key={m} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${meta.colorLight}`}>
              {m}
            </span>
          ))}
        </div>

        {/* Preview del prompt */}
        {record?.system_prompt && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 mb-4 font-mono text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
            {record.system_prompt.slice(0, 120)}{record.system_prompt.length > 120 ? '…' : ''}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center justify-between">
          <div className="flex gap-3 text-[10px] text-on-surface-variant">
            {chars > 0 && <span>{chars.toLocaleString()} chars</span>}
            {updatedAt && <span>· Actualizado {updatedAt}</span>}
          </div>
          <button
            onClick={() => onEntrenar(meta, record)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95
              bg-gradient-to-r ${meta.color} text-white shadow-sm hover:shadow-md`}>
            <span className="material-symbols-outlined text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}>model_training</span>
            Entrenar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel editor ───────────────────────────────────────────────────────────────

function EditorPanel({ meta, record, onClose, onSaved }) {
  const [prompt,    setPrompt]    = useState(record?.system_prompt ?? DEFAULT_PROMPTS[meta.key] ?? '')
  const [notas,     setNotas]     = useState(record?.notas_admin ?? '')
  const [saving,    setSaving]    = useState(false)
  const [resetting, setResetting] = useState(false)
  const [saved,     setSaved]     = useState(false)
  const textareaRef = useRef(null)

  const isDefault  = prompt === (DEFAULT_PROMPTS[meta.key] ?? '')
  const hasChanges = prompt !== (record?.system_prompt ?? DEFAULT_PROMPTS[meta.key] ?? '') ||
                     notas  !== (record?.notas_admin ?? '')
  const lines = prompt.split('\n').length
  const chars = prompt.length

  const handleSave = async () => {
    if (!prompt.trim() && meta.key !== 'sala_analisis') return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ai_system_prompts')
        .upsert({
          endpoint_key:  meta.key,
          nombre:        meta.nombre,
          descripcion:   meta.descripcion,
          icono:         meta.icono,
          rutas:         meta.rutas,
          modelos:       meta.modelos,
          system_prompt: prompt,
          default_prompt: DEFAULT_PROMPTS[meta.key] ?? '',
          notas_admin:   notas,
          updated_at:    new Date().toISOString(),
        }, { onConflict: 'endpoint_key' })

      if (error) throw error
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('¿Restablecer al prompt por defecto? Se perderán los cambios guardados.')) return
    setResetting(true)
    const def = DEFAULT_PROMPTS[meta.key] ?? ''
    try {
      await supabase
        .from('ai_system_prompts')
        .upsert({
          endpoint_key:   meta.key,
          nombre:         meta.nombre,
          descripcion:    meta.descripcion,
          icono:          meta.icono,
          rutas:          meta.rutas,
          modelos:        meta.modelos,
          system_prompt:  def,
          default_prompt: def,
          notas_admin:    '',
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'endpoint_key' })
      setPrompt(def)
      setNotas('')
      onSaved()
    } catch (e) {
      alert('Error al restablecer: ' + e.message)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full md:max-w-5xl md:rounded-3xl flex flex-col shadow-2xl overflow-hidden max-h-screen md:max-h-[92vh]">

        {/* Header */}
        <div className={`bg-gradient-to-r ${meta.color} px-6 py-4 flex items-center gap-4 shrink-0`}>
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icono}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">Entrenamiento IA</p>
            <h2 className="font-extrabold text-white text-lg leading-snug">{meta.nombre}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!isDefault && (
              <button onClick={handleReset} disabled={resetting}
                className="px-3 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition-all disabled:opacity-50 flex items-center gap-1.5">
                {resetting
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-sm">restart_alt</span>}
                Restablecer
              </button>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-all">
              <span className="material-symbols-outlined text-white text-sm">close</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

          {/* Panel info + notas */}
          <div className="lg:w-72 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 overflow-y-auto p-5 space-y-5">

            {/* Rutas */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Rutas que usan este prompt</p>
              <div className="space-y-1">
                {meta.rutas.map(r => (
                  <div key={r} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="material-symbols-outlined text-slate-400 text-sm">api</span>
                    <code className="text-[10px] text-slate-600 font-mono">{r}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Modelos */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Modelos IA</p>
              <div className="space-y-1">
                {meta.modelos.map(m => (
                  <div key={m} className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border ${meta.colorLight} flex items-center gap-1.5`}>
                    <span className="material-symbols-outlined text-sm">memory</span>
                    {m}
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Guía de entrenamiento</p>
              <ul className="space-y-1.5">
                {meta.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-on-surface-variant leading-relaxed">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>

            {/* Placeholder info */}
            {meta.placeholder && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber-700 mb-1">Variables disponibles</p>
                <p className="text-[10px] text-amber-600 leading-relaxed">{meta.placeholder}</p>
              </div>
            )}

            {/* Notas admin */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Notas del administrador</p>
              <textarea
                value={notas}
                onChange={e => setNotas(e.target.value)}
                placeholder="Agrega notas sobre los cambios realizados, razones, versiones..."
                rows={3}
                className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          {/* Editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3 text-[10px] text-on-surface-variant font-mono">
                <span>{chars.toLocaleString()} chars</span>
                <span>·</span>
                <span>{lines} líneas</span>
                {hasChanges && <span className="text-amber-600 font-bold">· Cambios sin guardar</span>}
                {isDefault && <span className="text-emerald-600 font-bold">· Prompt por defecto</span>}
              </div>
              <div className="flex gap-2">
                <button onClick={onClose}
                  className="px-3 py-1 rounded-full border border-slate-300 text-xs font-bold text-on-surface-variant hover:bg-slate-100 transition-all">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving || !hasChanges}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5
                    ${saved ? 'bg-emerald-500 text-white' : `bg-gradient-to-r ${meta.color} text-white shadow-sm`}
                    disabled:opacity-40 disabled:cursor-not-allowed`}>
                  {saving
                    ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}>
                        {saved ? 'check_circle' : 'save'}
                      </span>}
                  {saved ? '¡Guardado!' : 'Guardar'}
                </button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              spellCheck={false}
              placeholder={`Escribe el system prompt para "${meta.nombre}"...`}
              className="flex-1 w-full p-5 font-mono text-xs text-slate-700 bg-slate-900 resize-none focus:outline-none leading-relaxed"
              style={{ color: '#e2e8f0', caretColor: '#60a5fa' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminIATraining() {
  const [records,  setRecords]  = useState({})
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null) // { meta, record }

  const fetchRecords = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ai_system_prompts')
      .select('*')
    const map = {}
    for (const r of data || []) map[r.endpoint_key] = r
    setRecords(map)
    setLoading(false)
  }

  useEffect(() => { fetchRecords() }, [])

  const abrirEditor = (meta, record) => setEditing({ meta, record })
  const cerrarEditor = () => setEditing(null)
  const onSaved = () => { fetchRecords(); }

  const totalModificados = ENDPOINTS_META.filter(m => {
    const r = records[m.key]
    return r && r.system_prompt !== DEFAULT_PROMPTS[m.key]
  }).length

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-8">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>model_training</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Entrenamiento IA</h1>
              <p className="text-xs text-on-surface-variant">Personaliza las instrucciones de cada módulo del sistema</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {totalModificados > 0 && (
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200">
              {totalModificados} módulo{totalModificados > 1 ? 's' : ''} modificado{totalModificados > 1 ? 's' : ''}
            </span>
          )}
          <button onClick={fetchRecords}
            className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-on-surface-variant hover:bg-slate-50 transition-all flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Recargar
          </button>
        </div>
      </div>

      {/* Callout */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
        <span className="material-symbols-outlined text-blue-600 text-xl shrink-0 mt-0.5"
          style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
        <div className="text-sm">
          <p className="font-bold text-blue-800 mb-1">¿Cómo funciona el entrenamiento?</p>
          <p className="text-blue-700 leading-relaxed">
            Cada módulo tiene su propio <strong>system prompt</strong> — las instrucciones que recibe la IA antes de generar cualquier respuesta.
            Edita el prompt de cada módulo para cambiar su comportamiento, personalidad, formato de salida o criterios de calidad.
            Los cambios se aplican inmediatamente (caché de 5 minutos en el servidor).
          </p>
        </div>
      </div>

      {/* Grid de endpoints */}
      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ENDPOINTS_META.map(meta => (
            <EndpointCard
              key={meta.key}
              meta={meta}
              record={records[meta.key]}
              onEntrenar={abrirEditor}
            />
          ))}
        </div>
      )}

      {/* Nota técnica */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
        <p className="text-[11px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Nota técnica</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-on-surface-variant leading-relaxed">
          <p>⚡ Los prompts se cachean en el servidor por <strong>5 minutos</strong>. Los cambios se propagan automáticamente.</p>
          <p>🔄 Para forzar actualización inmediata, reinicia el servidor desde Railway.</p>
          <p>📦 La tabla <code className="bg-slate-200 px-1 rounded font-mono text-[10px]">ai_system_prompts</code> en Supabase almacena todos los prompts.</p>
          <p>🔐 Solo administradores pueden ver y editar esta sección.</p>
        </div>
      </div>

      {/* Panel editor */}
      {editing && (
        <EditorPanel
          meta={editing.meta}
          record={editing.record}
          onClose={cerrarEditor}
          onSaved={onSaved}
        />
      )}
    </div>
  )
}
