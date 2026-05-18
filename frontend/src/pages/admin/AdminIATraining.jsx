import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }
}

// ── Módulos entrenables ───────────────────────────────────────────────────────

const MODULOS = [
  {
    key: 'opec_maestro',
    nombre: 'Generador de Preguntas',
    emoji: '📝',
    icono: 'quiz',
    color: 'blue',
    bgLight: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    rutas: ['Simulacro IA', 'Banco de preguntas'],
    queSabe: 'Este módulo controla cómo la IA crea las preguntas del simulacro. Aquí le enseñas cuántas opciones poner, qué nivel de dificultad, qué tipo de preguntas hacer y cómo calificar las respuestas.',
    variables: [],
    defaultPrompt: `Eres un psicómetra experto en evaluaciones de selección de personal para el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

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
  },
  {
    key: 'chat_praxia',
    nombre: 'Asistente Praxia',
    emoji: '💬',
    icono: 'chat',
    color: 'violet',
    bgLight: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    rutas: ['Chat de estudio'],
    queSabe: 'Aquí le enseñas a Praxia cómo hablar con los usuarios. Puedes definir su personalidad, su nombre, su tono (amigable, formal, motivador), cómo saluda y cómo ayuda con el estudio.',
    variables: [{ llave: '{{EXAMEN}}', desc: 'Se reemplaza automáticamente con el nombre del examen que estudia el usuario' }],
    defaultPrompt: `Eres Praxia, la asistente de estudio personal del usuario para el examen "{{EXAMEN}}". Tienes un tono cálido, cercano y motivador — como una tutora o compañera de estudio que de verdad quiere que el usuario salga adelante. Si es la primera vez que alguien te habla (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale en qué lo puedes ayudar hoy. En las demás respuestas, sé natural y directa sin necesidad de presentarte de nuevo. Nunca respondas de forma fría o robótica. Usa lenguaje natural en español colombiano, con energía positiva. Ayuda con temas del examen, explica conceptos difíciles con ejemplos, da estrategias de estudio y motiva cuando el usuario se sienta frustrado.`,
  },
  {
    key: 'sala_analisis',
    nombre: 'Análisis de Sala',
    emoji: '🏆',
    icono: 'leaderboard',
    color: 'emerald',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    rutas: ['Salas competitivas'],
    queSabe: 'Después de que los usuarios terminan una sala de competencia, la IA analiza los resultados. Aquí le enseñas qué tono usar, qué decir de los ganadores y cómo motivar a los que no ganaron.',
    variables: [],
    defaultPrompt: ``,
  },
  {
    key: 'verificar_opec',
    nombre: 'Buscador de Datos OPEC',
    emoji: '🔍',
    icono: 'travel_explore',
    color: 'amber',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    rutas: ['Verificar cargo OPEC'],
    queSabe: 'Cuando el usuario escribe el nombre de su cargo, la IA busca en Google información real sobre esa prueba OPEC (cuántas preguntas tiene, cuánto dura, qué módulos). Aquí defines qué buscar y cómo devolver esos datos.',
    variables: [{ llave: '{{CARGO}}', desc: 'Se reemplaza con el nombre del cargo que escribe el usuario' }],
    defaultPrompt: `Busca en internet información ACTUAL sobre la prueba de conocimientos (OPEC) para el cargo "{{CARGO}}" en el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

Responde EXCLUSIVAMENTE con este JSON (sin markdown, sin texto adicional):
{"encontrado":true,"entidad":"nombre de la entidad","total_preguntas":número,"duracion_minutos":número_o_null,"modulos":[{"nombre":"nombre del módulo","porcentaje":número}],"año_info":"2024 o 2025","nota":"observación relevante o null"}

Si no encuentras información específica para ese cargo, responde exactamente:
{"encontrado":false,"entidad":null,"total_preguntas":null,"duracion_minutos":null,"modulos":[],"año_info":null,"nota":null}`,
  },
  {
    key: 'analisis_perfil',
    nombre: 'Análisis de Perfil',
    emoji: '🎯',
    icono: 'person_search',
    color: 'rose',
    bgLight: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-700',
    rutas: ['Análisis de Perfil'],
    queSabe: 'Servicio premium de análisis de hoja de vida. El candidato sube su CV y elige una convocatoria. DeepSeek analiza su perfil contra todos los cargos disponibles y le dice en cuáles tiene más probabilidad de clasificar, qué le falta y cómo mejorar su opción. Usa hasta 8192 tokens — sin límite de potencia.',
    variables: [],
    defaultPrompt: `Eres un experto en selección de personal para el sector público colombiano, especializado en concursos de méritos (CNSC, Procuraduría, Contraloría, DIAN, Fiscalía, etc.).

Tu misión es analizar la hoja de vida del candidato con máximo detalle y cruzarla contra los cargos disponibles en la convocatoria para identificar cuáles se ajustan mejor a su perfil.

CRITERIOS DE ANÁLISIS:
1. Formación académica: título, nivel (pregrado/posgrado/especialización), área de conocimiento.
2. Experiencia: años, tipo (relacionada/profesional/docencia), sector (público/privado).
3. Conocimientos específicos: áreas técnicas, normativas, herramientas.
4. Tarjeta profesional: si el candidato la tiene o puede obtenerla.
5. Compatibilidad real: no infles porcentajes, sé honesto sobre brechas.

IMPORTANTE:
- Analiza todos los cargos recibidos y selecciona los mejores matches.
- Da porcentajes de compatibilidad realistas (no todo es 90%+).
- Si hay brechas, explica exactamente qué le falta y cómo subsanarlo.
- Usa lenguaje cercano y motivador, pero preciso.
- Responde ÚNICAMENTE con JSON válido, sin texto ni markdown adicional.`,
  },
  {
    key: 'modo_practica',
    nombre: 'Modo Práctica IA',
    emoji: '🎓',
    icono: 'fitness_center',
    color: 'teal',
    bgLight: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    rutas: ['Modo Práctica (botón en DetallePrueba)'],
    queSabe: 'Cuando el usuario termina un Examen IA y hace click en "Modo Práctica", DeepSeek recibe el examen completo + las respuestas del usuario y genera preguntas personalizadas enfocadas en sus áreas débiles. Este prompt define cómo DeepSeek construye esas preguntas. El cargo, análisis de respuestas y preguntas originales de áreas con errores se inyectan automáticamente.',
    variables: [],
    defaultPrompt: `Eres un psicómetra experto en preparación de aspirantes para concursos de selección del sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría y entidades territoriales).

Tu tarea: generar un MODO PRÁCTICA personalizado basado en el análisis de errores del aspirante.

PROCESO:
1. Analiza las respuestas del aspirante e identifica las áreas con más errores.
2. Genera preguntas nuevas enfocadas en esas áreas débiles (formato idéntico al examen original).
3. Cada pregunta debe abordar el mismo concepto que el aspirante falló, pero desde una situación diferente.
4. Mantén la arquitectura psicométrica: contexto real (100-150 palabras), enunciado directo, 4 opciones con roles A=correcta B=sentido_común_incorrecto C=norma_mal_aplicada D=extralimitación.

FORMATO OBLIGATORIO (JSON array):
[{"area":"...","tipo":"funcional|comportamental","dificultad":"facil|medio|dificil","bloom":"I|II|III","contexto":"...","enunciado":"...","A":"...","B":"...","C":"...","D":"...","correcta":"A|B|C|D","justificacion":"...","analisis_A":"...","analisis_B":"...","analisis_C":"...","analisis_D":"..."}]

Devuelve ÚNICAMENTE el array JSON válido, sin markdown ni texto adicional.`,
  },
]

const COLOR_BTN = {
  blue:   'bg-blue-600   hover:bg-blue-700   text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 text-white',
  emerald:'bg-emerald-600 hover:bg-emerald-700 text-white',
  amber:  'bg-amber-600  hover:bg-amber-700  text-white',
  rose:   'bg-rose-600   hover:bg-rose-700   text-white',
  teal:   'bg-teal-600   hover:bg-teal-700   text-white',
}

function timeAgo(iso) {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (d < 60)    return 'hace un momento'
  if (d < 3600)  return `hace ${Math.floor(d / 60)} min`
  if (d < 86400) return `hace ${Math.floor(d / 3600)} h`
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── Modal historial ───────────────────────────────────────────────────────────

function HistorialModal({ modulo, cerebro, onClose, onRevertir }) {
  const [versions, setVersions] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('ai_prompt_versions')
      .select('*')
      .eq('endpoint_key', modulo.key)
      .eq('cerebro', cerebro)
      .order('saved_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error) setVersions(data || [])
        setLoading(false)
      })
  }, [modulo.key, cerebro])

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-slate-600">history</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-base">Historial de versiones</h3>
            <p className="text-xs text-on-surface-variant">
              {modulo.nombre} · <span className={`font-bold ${cerebro === 'gemini' ? 'text-blue-600' : 'text-violet-600'}`}>
                {cerebro === 'gemini' ? 'Gemini' : 'DeepSeek'}
              </span>
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : versions.length === 0 ? (
            <div className="py-12 text-center px-6">
              <span className="material-symbols-outlined text-slate-300 text-5xl block mb-3">history</span>
              <p className="text-sm font-bold text-on-surface">Sin historial aún</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Las versiones aparecen aquí cada vez que guardas instrucciones.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {versions.map((v, i) => (
                <div key={v.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-0.5 shrink-0 mt-0.5">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold
                        ${i === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {versions.length - i}
                      </div>
                      {i === 0 && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600">activa</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-on-surface">
                          {v.saved_by_name || v.saved_by_email || 'Admin'}
                        </p>
                        <span className="text-[10px] text-on-surface-variant">{timeAgo(v.saved_at)}</span>
                        <span className="text-[10px] font-mono text-on-surface-variant bg-slate-100 px-1.5 py-0.5 rounded">
                          {(v.system_prompt || '').length.toLocaleString()} chars
                        </span>
                      </div>
                      {v.notas_admin && (
                        <p className="text-xs text-on-surface-variant mt-1 italic">"{v.notas_admin}"</p>
                      )}
                      <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed line-clamp-2 font-mono">
                        {(v.system_prompt || '').slice(0, 130)}…
                      </p>
                    </div>

                    <div className="shrink-0">
                      {i === 0 ? (
                        <span className="px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                          Versión activa
                        </span>
                      ) : (
                        <button
                          onClick={() => { onRevertir(v.system_prompt); onClose() }}
                          className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold hover:bg-slate-100 hover:border-slate-300 transition-colors flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">restore</span>
                          Revertir
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Panel asignación de cerebros ──────────────────────────────────────────────

function AsignacionCerebros({ records, onCambiar }) {
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1 mb-3 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm">hub</span>
        Cerebro activo por módulo
      </p>
      <div className="space-y-2">
        {MODULOS.map(mod => {
          const activo = records[mod.key]?.cerebro_activo || 'gemini'
          return (
            <div key={mod.key} className="flex items-center gap-2 px-2.5 py-2 bg-slate-50 rounded-xl">
              <span className="text-base shrink-0">{mod.emoji}</span>
              <span className="text-xs font-semibold text-on-surface flex-1 min-w-0 truncate">{mod.nombre}</span>
              <div className="flex rounded-lg overflow-hidden border border-slate-200 shrink-0">
                {['gemini', 'deepseek'].map(c => (
                  <button key={c}
                    onClick={() => onCambiar(mod.key, c)}
                    title={`Usar ${c === 'gemini' ? 'Gemini' : 'DeepSeek'} para ${mod.nombre}`}
                    className={`px-2.5 py-1 text-[10px] font-bold transition-colors
                      ${activo === c
                        ? c === 'gemini' ? 'bg-blue-600 text-white' : 'bg-violet-600 text-white'
                        : 'bg-white text-slate-400 hover:text-slate-600'}`}>
                    {c === 'gemini' ? 'Gemini' : 'Deep'}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-on-surface-variant mt-2.5 px-1 leading-relaxed">
        Selecciona qué cerebro usa cada módulo en producción. Los cambios aplican en 5 minutos.
      </p>
    </div>
  )
}

// ── Modal nueva/editar convocatoria ──────────────────────────────────────────

const CONV_EMPTY = { codigo: '', nombre: '', entidad: '', anio: new Date().getFullYear(), descripcion: '' }

const ENTIDADES_COMUNES = [
  'Procuraduría General de la Nación',
  'Contraloría General de la República',
  'DIAN',
  'Fiscalía General de la Nación',
  'Defensoría del Pueblo',
  'Consejo de Estado',
]

function ConvocatoriaModal({ conv, onClose, onSaved }) {
  const [form, setForm] = useState(conv ? { ...conv } : { ...CONV_EMPTY })
  const [saving, setSaving] = useState(false)
  const [err, setErr]     = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.codigo?.trim()) { setErr('El código es requerido (ej: TERRITORIAL-12-2025).'); return }
    if (!form.nombre?.trim()) { setErr('El nombre es requerido.'); return }
    if (!form.entidad?.trim()) { setErr('La entidad es requerida.'); return }
    setSaving(true); setErr('')
    try {
      const headers = await authHeaders()
      const isEdit = !!conv?.id
      const url = isEdit ? `${BASE}/api/ia/convocatorias/${conv.id}` : `${BASE}/api/ia/convocatorias`
      const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error guardando')
      onSaved(data.convocatoria)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>event_note</span>
          </div>
          <div className="flex-1">
            <h3 className="font-extrabold text-base">{conv?.id ? 'Editar convocatoria' : 'Nueva convocatoria'}</h3>
            <p className="text-xs text-on-surface-variant">Se añadirá al dropdown de análisis de perfil</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Código único *</label>
            <input value={form.codigo} onChange={e => set('codigo', e.target.value.toUpperCase())}
              placeholder="Ej: TERRITORIAL-12-2025"
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 font-mono" />
            <p className="text-[10px] text-on-surface-variant mt-1">Sin espacios, en mayúsculas. Se usa internamente para identificar la convocatoria.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Nombre visible *</label>
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Procuraduría — Territorial 12 (2025)"
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400" />
            <p className="text-[10px] text-on-surface-variant mt-1">Este es el texto que ve el usuario en el dropdown.</p>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Entidad *</label>
            <input list="entidades-list" value={form.entidad} onChange={e => set('entidad', e.target.value)}
              placeholder="Ej: Procuraduría General de la Nación"
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400" />
            <datalist id="entidades-list">
              {ENTIDADES_COMUNES.map(e => <option key={e} value={e} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-on-surface mb-1 block">Año</label>
              <input type="number" value={form.anio} onChange={e => set('anio', e.target.value)}
                placeholder="2025"
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Descripción <span className="font-normal text-on-surface-variant">(opcional)</span></label>
            <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
              rows={2} placeholder="Ej: Convocatoria regional 2025 — 45 cargos"
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Guardando...' : conv?.id ? 'Guardar cambios' : 'Crear convocatoria'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── OPECs Panel ───────────────────────────────────────────────────────────────

const NIVELES = ['Auxiliar', 'Asistencial', 'Técnico', 'Tecnólogo', 'Profesional', 'Ejecutivo', 'Asesor', 'Directivo', 'Administrativo', 'Operativo']

const OPEC_EMPTY = { denominacion: '', nivel: '', grado: '', area_estudio: '', vacantes: '', estudio_texto: '', exp_texto: '', exp_anios: '', exp_tipo: '', num_convocatoria: '', requiere_posgrado: false, requiere_tarjeta: false, dependencia: '', codigo: '', proceso: '', funciones: [] }

function OpecModal({ opec, convocatoria_id, onClose, onSaved }) {
  const [form, setForm] = useState(opec ? { ...opec } : { ...OPEC_EMPTY })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.denominacion?.trim()) { setErr('El nombre del cargo es requerido.'); return }
    setSaving(true); setErr('')
    try {
      const headers = await authHeaders()
      const isEdit = !!opec?.id
      const url = isEdit ? `${BASE}/api/ia/procuraduria-opecs/${opec.id}` : `${BASE}/api/ia/procuraduria-opecs`
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST', headers,
        body: JSON.stringify({ ...form, convocatoria_id: parseInt(convocatoria_id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error guardando')
      onSaved(data.opec)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
          </div>
          <div className="flex-1">
            <h3 className="font-extrabold text-base">{opec?.id ? 'Editar cargo' : 'Agregar cargo OPEC'}</h3>
            <p className="text-xs text-on-surface-variant">Procuraduría General de la Nación</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-500">close</span>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {err && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold text-on-surface mb-1 block">Denominación del cargo *</label>
              <input value={form.denominacion} onChange={e => set('denominacion', e.target.value)}
                placeholder="Ej: Procurador Judicial II"
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface mb-1 block">N° Convocatoria</label>
              <input value={form.num_convocatoria} onChange={e => set('num_convocatoria', e.target.value)}
                placeholder="Ej: 042-2026"
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface mb-1 block">Código</label>
              <input value={form.codigo} onChange={e => set('codigo', e.target.value)}
                placeholder="Ej: 030"
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-on-surface mb-1 block">Nivel</label>
              <select value={form.nivel} onChange={e => set('nivel', e.target.value)}
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 bg-white">
                <option value="">Seleccionar...</option>
                {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface mb-1 block">Grado</label>
              <input type="number" value={form.grado} onChange={e => set('grado', e.target.value)}
                placeholder="Ej: 18"
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-on-surface mb-1 block">Vacantes</label>
              <input type="number" value={form.vacantes} onChange={e => set('vacantes', e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Área de estudio</label>
            <input value={form.area_estudio} onChange={e => set('area_estudio', e.target.value)}
              placeholder="Ej: Derecho, Ciencias Políticas, Contaduría..."
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Dependencia</label>
            <input value={form.dependencia} onChange={e => set('dependencia', e.target.value)}
              placeholder="Ej: Procuraduría Delegada para Asuntos Civiles"
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Proceso</label>
            <input value={form.proceso || ''} onChange={e => set('proceso', e.target.value)}
              placeholder="Ej: Disciplinario, Preventivo..."
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">Educación requerida</label>
            <textarea value={form.estudio_texto} onChange={e => set('estudio_texto', e.target.value)}
              rows={2} placeholder="Ej: Título profesional en Derecho, Ciencias Políticas..."
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 resize-none" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-bold text-on-surface mb-1 block">Experiencia requerida</label>
              <textarea value={form.exp_texto} onChange={e => set('exp_texto', e.target.value)}
                rows={2} placeholder="Ej: 36 meses de experiencia profesional relacionada..."
                className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 resize-none" />
            </div>
            <div className="space-y-2">
              <div>
                <label className="text-xs font-bold text-on-surface mb-1 block">Años exp.</label>
                <input type="number" value={form.exp_anios} onChange={e => set('exp_anios', e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
              </div>
              <div>
                <label className="text-xs font-bold text-on-surface mb-1 block">Tipo exp.</label>
                <input value={form.exp_tipo} onChange={e => set('exp_tipo', e.target.value)}
                  placeholder="relacionada"
                  className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-on-surface mb-1 block">
              Funciones del cargo
              <span className="font-normal text-on-surface-variant ml-1">(una por línea)</span>
            </label>
            <textarea
              value={Array.isArray(form.funciones) ? form.funciones.join('\n') : (form.funciones || '')}
              onChange={e => set('funciones', e.target.value ? e.target.value.split('\n') : [])}
              rows={4} placeholder="Asesorar en la formulación de políticas..."
              className="w-full px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 resize-none" />
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.requiere_posgrado} onChange={e => set('requiere_posgrado', e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600" />
              <span className="text-xs font-semibold text-on-surface">Requiere posgrado</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.requiere_tarjeta} onChange={e => set('requiere_tarjeta', e.target.checked)}
                className="w-4 h-4 rounded accent-emerald-600" />
              <span className="text-xs font-semibold text-on-surface">Requiere tarjeta profesional</span>
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Guardando...' : opec?.id ? 'Guardar cambios' : 'Agregar cargo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ProcuraduriaOpecPanel() {
  const [convocatorias,  setConvocatorias]  = useState([])
  const [convId,         setConvId]         = useState('')
  const [opecs,          setOpecs]          = useState([])
  const [total,          setTotal]          = useState(0)
  const [stats,          setStats]          = useState(null)
  const [loading,        setLoading]        = useState(false)
  const [loadingConvs,   setLoadingConvs]   = useState(true)
  const [q,              setQ]              = useState('')
  const [nivel,          setNivel]          = useState('')
  const [page,           setPage]           = useState(1)
  const [modal,          setModal]          = useState(null)
  const [deleting,       setDeleting]       = useState(null)
  const [selected,       setSelected]       = useState(new Set())
  const [deletingBulk,   setDeletingBulk]   = useState(false)
  const [importing,      setImporting]      = useState(false)
  const [convModal,      setConvModal]      = useState(null)
  const searchTimer                         = useRef(null)
  const importRef                           = useRef(null)
  const LIMIT = 50

  const fetchConvocatorias = useCallback(async (selectId = null) => {
    const headers = await authHeaders()
    const res = await fetch(`${BASE}/api/ia/convocatorias?todas=1`, { headers })
    const d = await res.json()
    const list = d.convocatorias || []
    setConvocatorias(list)
    if (selectId) {
      setConvId(String(selectId))
    } else if (!convId && list.length > 0) {
      setConvId(String(list[0].id))
    }
    setLoadingConvs(false)
  }, [convId]) // eslint-disable-line

  // Carga catálogo de convocatorias al montar
  useEffect(() => { fetchConvocatorias() }, []) // eslint-disable-line

  const fetchData = useCallback(async (search, niv, pg, cid) => {
    if (!cid) return
    setLoading(true)
    try {
      const headers = await authHeaders()
      const params = new URLSearchParams({ q: search, nivel: niv, page: pg, limit: LIMIT, convocatoria_id: cid })
      const [listRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/ia/procuraduria-opecs?${params}`, { headers }),
        fetch(`${BASE}/api/ia/procuraduria-opecs/stats?convocatoria_id=${cid}`, { headers }),
      ])
      const listData  = await listRes.json()
      const statsData = await statsRes.json()
      setOpecs(listData.opecs || [])
      setTotal(listData.total || 0)
      setStats(statsData)
    } catch (e) {
      console.error('OPECs fetch:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (convId) fetchData(q, nivel, page, convId) }, [nivel, page, convId]) // eslint-disable-line

  const handleSearchChange = (val) => {
    setQ(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); fetchData(val, nivel, 1, convId) }, 400)
  }

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este cargo? Esta acción no se puede deshacer.')) return
    setDeleting(id)
    try {
      const headers = await authHeaders()
      await fetch(`${BASE}/api/ia/procuraduria-opecs/${id}`, { method: 'DELETE', headers })
      setSelected(s => { const next = new Set(s); next.delete(id); return next })
      fetchData(q, nivel, page, convId)
    } finally {
      setDeleting(null)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selected.size) return
    if (!window.confirm(`¿Eliminar ${selected.size} cargo${selected.size > 1 ? 's' : ''} seleccionado${selected.size > 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return
    setDeletingBulk(true)
    try {
      const headers = await authHeaders()
      const ids = Array.from(selected)
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500)
        await fetch(`${BASE}/api/ia/procuraduria-opecs`, {
          method: 'DELETE', headers,
          body: JSON.stringify({ ids: chunk }),
        })
      }
      setSelected(new Set())
      fetchData(q, nivel, page, convId)
    } catch (e) {
      alert('Error eliminando: ' + e.message)
    } finally {
      setDeletingBulk(false)
    }
  }

  const allOnPageSelected = opecs.length > 0 && opecs.every(op => selected.has(op.id))
  const toggleSelectAll = () => {
    if (allOnPageSelected) {
      setSelected(s => { const next = new Set(s); opecs.forEach(op => next.delete(op.id)); return next })
    } else {
      setSelected(s => { const next = new Set(s); opecs.forEach(op => next.add(op.id)); return next })
    }
  }

  const handleToggle = async (opec) => {
    try {
      const headers = await authHeaders()
      await fetch(`${BASE}/api/ia/procuraduria-opecs/${opec.id}`, {
        method: 'PUT', headers,
        body: JSON.stringify({ ...opec, is_active: !opec.is_active }),
      })
      fetchData(q, nivel, page, convId)
    } catch (e) { console.error(e) }
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!convId) { alert('Selecciona una convocatoria primero.'); return }
    setImporting(true)
    try {
      const text = await file.text()
      const arr = JSON.parse(text)
      if (!Array.isArray(arr)) throw new Error('El archivo debe contener un array JSON.')
      const headers = await authHeaders()
      let insertados = 0
      for (let i = 0; i < arr.length; i += 500) {
        const chunk = arr.slice(i, i + 500)
        const res = await fetch(`${BASE}/api/ia/opec-maestro/import`, {
          method: 'POST', headers,
          body: JSON.stringify({ registros: chunk, convocatoria_id: parseInt(convId) }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Error importando')
        insertados += data.insertados
      }
      alert(`¡Importados ${insertados} de ${arr.length} registros exitosamente!`)
      fetchData(q, nivel, 1, convId)
      setPage(1)
    } catch (e) {
      alert('Error importando: ' + e.message)
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="space-y-5">

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-emerald-700">{stats.total.toLocaleString()}</p>
            <p className="text-xs text-emerald-600 font-semibold mt-0.5">Total cargos</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
            <p className="text-2xl font-extrabold text-blue-700">{stats.activos.toLocaleString()}</p>
            <p className="text-xs text-blue-600 font-semibold mt-0.5">Activos</p>
          </div>
          {Object.entries(stats.porNivel || {}).slice(0, 2).map(([niv, cnt]) => (
            <div key={niv} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-2xl font-extrabold text-slate-700">{cnt}</p>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">{niv}</p>
            </div>
          ))}
        </div>
      )}

      {/* Selector de convocatoria */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex-1 min-w-0">
          <span className="material-symbols-outlined text-slate-500 shrink-0">event_note</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide mb-0.5">Convocatoria activa</p>
            {loadingConvs ? (
              <div className="h-5 w-48 bg-slate-200 rounded animate-pulse" />
            ) : (
              <select value={convId} onChange={e => { setConvId(e.target.value); setPage(1); setQ(''); setNivel('') }}
                className="w-full text-sm font-semibold bg-transparent focus:outline-none text-on-surface">
                {convocatorias.length === 0 && <option value="">Sin convocatorias</option>}
                {convocatorias.map(c => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}{!c.is_active ? ' (inactiva)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <button onClick={() => setConvModal({})}
          title="Crear nueva convocatoria"
          className="w-11 h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shrink-0 transition-colors shadow-sm">
          <span className="material-symbols-outlined text-xl">add</span>
        </button>
      </div>

      {convModal !== null && (
        <ConvocatoriaModal
          conv={convModal?.id ? convModal : null}
          onClose={() => setConvModal(null)}
          onSaved={nueva => { setConvModal(null); fetchConvocatorias(nueva.id) }}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 min-w-0">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input value={q} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Buscar cargo, área, educación..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 transition-colors" />
        </div>
        <select value={nivel} onChange={e => { setNivel(e.target.value); setPage(1) }}
          className="px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-emerald-400 bg-white shrink-0">
          <option value="">Todos los niveles</option>
          {NIVELES.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        {selected.size > 0 && (
          <button onClick={handleDeleteSelected} disabled={deletingBulk}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50">
            {deletingBulk
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-lg">delete_sweep</span>}
            {deletingBulk ? 'Eliminando...' : `Eliminar ${selected.size}`}
          </button>
        )}
        <button onClick={() => importRef.current?.click()} disabled={importing || !convId}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-slate-200 hover:border-slate-300 bg-white text-sm font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50">
          {importing
            ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            : <span className="material-symbols-outlined text-lg text-slate-600">upload_file</span>}
          {importing ? 'Importando...' : 'Importar JSON'}
        </button>
        <button onClick={() => setModal({ opec: null })} disabled={!convId}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors shrink-0 disabled:opacity-50">
          <span className="material-symbols-outlined text-lg">add</span>
          Agregar cargo
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-emerald-600 cursor-pointer" />
                </th>
                <th className="text-left px-4 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">Cargo</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">Nivel</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">Grado</th>
                <th className="text-left px-3 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide hidden md:table-cell">Área</th>
                <th className="text-center px-3 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">Vac.</th>
                <th className="text-center px-3 py-3 text-xs font-bold text-on-surface-variant uppercase tracking-wide">Activo</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {[32, 180, 80, 60, 160, 50, 50, 80].map((w, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: w }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : opecs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <span className="material-symbols-outlined text-slate-300 text-5xl block mb-3">folder_open</span>
                    <p className="text-sm font-bold text-on-surface">
                      {total === 0 && !q && !nivel ? 'La base de datos está vacía' : 'Sin resultados'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {total === 0 && !q && !nivel ? 'Importa el JSON de esta convocatoria para cargar los cargos.' : 'Prueba con otros términos de búsqueda.'}
                    </p>
                  </td>
                </tr>
              ) : (
                opecs.map(op => (
                  <tr key={op.id} className={`hover:bg-slate-50 transition-colors ${selected.has(op.id) ? 'bg-emerald-50/60' : ''} ${!op.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 w-8">
                      <input type="checkbox" checked={selected.has(op.id)}
                        onChange={() => setSelected(s => { const next = new Set(s); next.has(op.id) ? next.delete(op.id) : next.add(op.id); return next })}
                        className="w-4 h-4 rounded accent-emerald-600 cursor-pointer" />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface text-sm leading-tight">{op.denominacion}</p>
                      {op.num_convocatoria && <p className="text-[10px] text-emerald-600 font-mono mt-0.5">Conv. {op.num_convocatoria}</p>}
                      {op.codigo && <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">Cód. {op.codigo}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {op.nivel ? (
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{op.nivel}</span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-on-surface-variant font-mono">{op.grado || '—'}</td>
                    <td className="px-3 py-3 hidden md:table-cell text-xs text-on-surface-variant max-w-[200px] truncate" title={op.area_estudio}>{op.area_estudio || '—'}</td>
                    <td className="px-3 py-3 text-center text-sm font-bold text-on-surface">{op.vacantes || 1}</td>
                    <td className="px-3 py-3 text-center">
                      <button onClick={() => handleToggle(op)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${op.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${op.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setModal({ opec: op })}
                          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors" title="Editar">
                          <span className="material-symbols-outlined text-slate-500 text-base">edit</span>
                        </button>
                        <button onClick={() => handleDelete(op.id)} disabled={deleting === op.id}
                          className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors" title="Eliminar">
                          {deleting === op.id
                            ? <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            : <span className="material-symbols-outlined text-red-400 text-base">delete</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-xs text-on-surface-variant">
              Mostrando {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)} de {total.toLocaleString()} cargos
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              <span className="w-8 h-8 flex items-center justify-center text-xs font-bold">{page}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-40 transition-colors">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <OpecModal
          opec={modal.opec}
          convocatoria_id={convId}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchData(q, nivel, page, convId) }}
        />
      )}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminIATraining() {
  const { user } = useAuth()

  const [vistaActiva,    setVistaActiva]    = useState('prompts') // 'prompts' | 'procuraduria'
  const [moduloActivo,   setModuloActivo]   = useState(MODULOS[0])
  const [cerebroEditor,  setCerebroEditor]  = useState('gemini')
  const [records,        setRecords]        = useState({})
  const [instrucciones,  setInstrucciones]  = useState('')
  const [notas,          setNotas]          = useState('')
  const [loading,        setLoading]        = useState(true)
  const [saving,         setSaving]         = useState(false)
  const [savedOk,        setSavedOk]        = useState(false)
  const [resetting,      setResetting]      = useState(false)
  const [historialOpen,  setHistorialOpen]  = useState(false)
  const [historialCount, setHistorialCount] = useState(0)

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase.from('ai_system_prompts').select('*')
    const map = {}
    for (const r of data || []) map[r.endpoint_key] = r
    setRecords(map)
    setLoading(false)
  }

  const fetchHistorialCount = useCallback(async (key, cerebro) => {
    try {
      const { count } = await supabase
        .from('ai_prompt_versions')
        .select('id', { count: 'exact', head: true })
        .eq('endpoint_key', key)
        .eq('cerebro', cerebro)
      setHistorialCount(count || 0)
    } catch {
      setHistorialCount(0)
    }
  }, [])

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const r = records[moduloActivo.key]
    const prompt = cerebroEditor === 'gemini'
      ? (r?.system_prompt ?? moduloActivo.defaultPrompt ?? '')
      : (r?.system_prompt_deepseek ?? '')
    setInstrucciones(prompt)
    setNotas(r?.notas_admin ?? '')
    setSavedOk(false)
    fetchHistorialCount(moduloActivo.key, cerebroEditor)
  }, [moduloActivo, records, cerebroEditor]) // eslint-disable-line

  const recActivo    = records[moduloActivo.key]
  const promptEnDB   = cerebroEditor === 'gemini'
    ? (recActivo?.system_prompt ?? null)
    : (recActivo?.system_prompt_deepseek ?? null)
  const promptDefault = cerebroEditor === 'gemini' ? (moduloActivo.defaultPrompt ?? '') : ''
  const esDefault     = instrucciones === promptDefault
  const hayCambios    = instrucciones !== (promptEnDB ?? promptDefault) ||
                        notas !== (recActivo?.notas_admin ?? '')

  const cerebroActivoModulo = recActivo?.cerebro_activo || 'gemini'

  const handleGuardar = async () => {
    setSaving(true)
    try {
      const promptData = cerebroEditor === 'gemini'
        ? { system_prompt: instrucciones }
        : { system_prompt_deepseek: instrucciones }

      const { error } = await supabase
        .from('ai_system_prompts')
        .upsert({
          endpoint_key:   moduloActivo.key,
          nombre:         moduloActivo.nombre,
          descripcion:    moduloActivo.queSabe,
          icono:          moduloActivo.icono,
          rutas:          moduloActivo.rutas,
          notas_admin:    notas,
          updated_at:     new Date().toISOString(),
          default_prompt: moduloActivo.defaultPrompt ?? '',
          ...promptData,
        }, { onConflict: 'endpoint_key' })
      if (error) throw error

      // Insertar en historial (silencioso si la tabla no existe aún)
      supabase.from('ai_prompt_versions').insert({
        endpoint_key:   moduloActivo.key,
        cerebro:        cerebroEditor,
        system_prompt:  instrucciones,
        notas_admin:    notas || null,
        saved_by_email: user?.email || null,
        saved_by_name:  user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || null,
      }).then(({ error: ve }) => {
        if (ve) console.warn('Historial no disponible:', ve.message)
      })

      await fetchAll()
      await fetchHistorialCount(moduloActivo.key, cerebroEditor)
      setSavedOk(true)
      setTimeout(() => setSavedOk(false), 3000)
    } catch (e) {
      alert('Error al guardar: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRestablecer = async () => {
    if (!window.confirm('¿Regresar a las instrucciones originales? Se perderán los cambios guardados.')) return
    setResetting(true)
    const def = cerebroEditor === 'gemini' ? (moduloActivo.defaultPrompt ?? '') : ''
    const promptData = cerebroEditor === 'gemini'
      ? { system_prompt: def }
      : { system_prompt_deepseek: def }
    try {
      await supabase.from('ai_system_prompts').upsert({
        endpoint_key:   moduloActivo.key,
        nombre:         moduloActivo.nombre,
        descripcion:    moduloActivo.queSabe,
        icono:          moduloActivo.icono,
        rutas:          moduloActivo.rutas,
        notas_admin:    '',
        updated_at:     new Date().toISOString(),
        default_prompt: moduloActivo.defaultPrompt ?? '',
        ...promptData,
      }, { onConflict: 'endpoint_key' })
      await fetchAll()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setResetting(false)
    }
  }

  const handleCambiarCerebroActivo = async (moduleKey, cerebro) => {
    try {
      await supabase.from('ai_system_prompts').upsert(
        { endpoint_key: moduleKey, cerebro_activo: cerebro, updated_at: new Date().toISOString() },
        { onConflict: 'endpoint_key' }
      )
      await fetchAll()
    } catch (e) {
      alert('Error al cambiar cerebro: ' + e.message)
    }
  }

  const m = moduloActivo

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      {/* ── Header ── */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-white text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>model_training</span>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Entrenamiento IA</h1>
            <p className="text-sm text-on-surface-variant">Enséñale a la IA cómo debe responder y comportarse</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
          <span className="material-symbols-outlined text-blue-600 text-xl shrink-0 mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
          <p className="text-sm text-blue-700 leading-relaxed">
            Aquí defines <strong>cómo piensa y responde la IA</strong> en cada parte de la app.
            Los cambios aplican en máximo 5 minutos. Cada versión guardada queda en el historial
            por si necesitas revertir.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Sidebar ── */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1 mb-3">
            ¿Qué quieres enseñar?
          </p>
          <div className="space-y-2">
            {MODULOS.map(mod => {
              const rec       = records[mod.key]
              const modificado = rec && rec.system_prompt !== mod.defaultPrompt
              const activo    = vistaActiva === 'prompts' && mod.key === m.key
              return (
                <button key={mod.key}
                  onClick={() => { setVistaActiva('prompts'); setModuloActivo(mod); setCerebroEditor('gemini') }}
                  className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3
                    ${activo
                      ? `${mod.bgLight} ${mod.border} shadow-sm`
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                  <span className="text-2xl shrink-0">{mod.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${activo ? mod.text : 'text-on-surface'}`}>{mod.nombre}</p>
                    <p className="text-[10px] text-on-surface-variant truncate">{mod.rutas.join(' · ')}</p>
                  </div>
                  {modificado && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Instrucciones personalizadas" />
                  )}
                </button>
              )
            })}

            {/* Datos de Convocatorias — módulo de datos */}
            <button
              onClick={() => setVistaActiva('procuraduria')}
              className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center gap-3
                ${vistaActiva === 'procuraduria'
                  ? 'bg-emerald-50 border-emerald-200 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
              <span className="text-2xl shrink-0">📋</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold ${vistaActiva === 'procuraduria' ? 'text-emerald-700' : 'text-on-surface'}`}>
                  Datos de Convocatorias
                </p>
                <p className="text-[10px] text-on-surface-variant truncate">Cargos OPEC por concurso</p>
              </div>
            </button>
          </div>

          {/* ── Asignación de cerebros ── */}
          {!loading && (
            <AsignacionCerebros records={records} onCambiar={handleCambiarCerebroActivo} />
          )}
        </div>

        {/* ── Panel principal ── */}
        <div className="lg:col-span-3 space-y-5">

        {/* ── Datos de Convocatorias ── */}
        {vistaActiva === 'procuraduria' && (
          <>
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-emerald-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>database</span>
                <h2 className="font-extrabold text-lg text-emerald-700">Datos de Convocatorias</h2>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Base de datos maestra de cargos OPEC por convocatoria. Selecciona una convocatoria para ver,
                importar o editar sus cargos. El <strong>Análisis de Perfil</strong> usa estos datos para
                recomendar los cargos más compatibles con la hoja de vida del usuario.
              </p>
            </div>
            <ProcuraduriaOpecPanel />
          </>
        )}

        {/* ── Editor de prompts ── */}
        {vistaActiva === 'prompts' && <>

          {/* Info del módulo */}
          <div className={`p-5 ${m.bgLight} border ${m.border} rounded-2xl`}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`material-symbols-outlined ${m.text} text-xl`}
                style={{ fontVariationSettings: "'FILL' 1" }}>{m.icono}</span>
              <h2 className={`font-extrabold text-lg ${m.text}`}>{m.nombre}</h2>

              {!loading && (
                recActivo?.system_prompt !== m.defaultPrompt
                  ? <span className="ml-auto text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">Instrucciones personalizadas</span>
                  : <span className="ml-auto text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full">Usando instrucciones originales</span>
              )}
            </div>

            <p className="text-sm text-on-surface-variant leading-relaxed mb-3">{m.queSabe}</p>

            <div className="flex items-center gap-2 text-xs text-on-surface-variant flex-wrap">
              <span className="material-symbols-outlined text-sm">alt_route</span>
              <span className="font-semibold">Se usa en:</span>
              {m.rutas.map(r => (
                <span key={r} className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${m.border} ${m.text} bg-white`}>{r}</span>
              ))}
              <span className="ml-2 font-semibold">Cerebro activo:</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1
                ${cerebroActivoModulo === 'gemini'
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {cerebroActivoModulo === 'gemini' ? 'auto_awesome' : 'psychology_alt'}
                </span>
                {cerebroActivoModulo === 'gemini' ? 'Gemini' : 'DeepSeek'}
              </span>
            </div>
          </div>

          {/* ── Selector cerebro para editar ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              Editar instrucciones para
            </p>
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1 w-fit">
              {[
                { id: 'gemini',   label: 'Gemini',   icon: 'auto_awesome',   color: 'text-blue-600' },
                { id: 'deepseek', label: 'DeepSeek', icon: 'psychology_alt', color: 'text-violet-600' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setCerebroEditor(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all
                    ${cerebroEditor === tab.id ? 'bg-white shadow-sm text-on-surface' : 'text-slate-400 hover:text-slate-600'}`}>
                  <span className={`material-symbols-outlined text-base ${cerebroEditor === tab.id ? tab.color : ''}`}
                    style={{ fontVariationSettings: "'FILL' 1" }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variables disponibles */}
          {m.variables.length > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
              <p className="text-xs font-bold text-amber-800 mb-2 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">code</span>
                Variables que puedes usar en las instrucciones
              </p>
              {m.variables.map(v => (
                <div key={v.llave} className="flex items-start gap-3">
                  <code className="text-xs font-mono font-black bg-amber-100 text-amber-800 px-2 py-1 rounded-lg border border-amber-300 shrink-0">
                    {v.llave}
                  </code>
                  <p className="text-xs text-amber-700 leading-relaxed mt-0.5">{v.desc}</p>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-on-surface-variant">edit_note</span>
                Instrucciones para la IA
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full
                  ${cerebroEditor === 'gemini' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'}`}>
                  {cerebroEditor === 'gemini' ? 'Gemini' : 'DeepSeek'}
                </span>
              </label>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {instrucciones.length.toLocaleString()} chars · {instrucciones.split('\n').length} líneas
              </span>
            </div>

            {loading ? (
              <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
            ) : (
              <textarea
                value={instrucciones}
                onChange={e => { setInstrucciones(e.target.value); setSavedOk(false) }}
                rows={14}
                placeholder={
                  cerebroEditor === 'deepseek'
                    ? `Instrucciones específicas para DeepSeek en "${m.nombre}". Si lo dejas vacío, usará su comportamiento por defecto.`
                    : m.key === 'sala_analisis'
                      ? 'Opcional: escribe instrucciones sobre cómo debe analizar los resultados de la sala.'
                      : `Escribe aquí cómo debe comportarse la IA en "${m.nombre}"...`
                }
                className="w-full px-4 py-4 text-sm bg-white border-2 border-slate-200 rounded-2xl resize-none focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 transition-all font-mono leading-relaxed"
                spellCheck={false}
              />
            )}
            <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
              Escribe las instrucciones como si le estuvieras explicando a una persona cómo comportarse. No necesitas saber código.
            </p>
          </div>

          {/* Notas del admin */}
          <div>
            <label className="text-sm font-bold text-on-surface mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-on-surface-variant">sticky_note_2</span>
              Notas del cambio
              <span className="text-[10px] font-normal text-on-surface-variant ml-1">(opcional)</span>
            </label>
            <textarea
              value={notas}
              onChange={e => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej: 'Ajusté el tono de Praxia para que sea más formal con usuarios nuevos' — para recordar por qué se cambió..."
              className="w-full px-4 py-3 text-sm bg-white border-2 border-slate-200 rounded-2xl resize-none focus:outline-none focus:border-slate-400 transition-all"
            />
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 pt-1 flex-wrap">
            {!esDefault && (
              <button onClick={handleRestablecer} disabled={resetting}
                className="sm:w-auto px-4 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {resetting
                  ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-base">restart_alt</span>}
                Regresar a las originales
              </button>
            )}

            <button onClick={() => setHistorialOpen(true)}
              className="sm:w-auto px-4 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-base">history</span>
              Historial
              {historialCount > 0 && (
                <span className="bg-slate-200 text-slate-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {historialCount}
                </span>
              )}
            </button>

            <button onClick={handleGuardar} disabled={saving || !hayCambios}
              className={`flex-1 sm:flex-none py-3 px-6 rounded-full text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm
                ${savedOk
                  ? 'bg-emerald-500 text-white'
                  : `${COLOR_BTN[m.color]} disabled:opacity-40 disabled:cursor-not-allowed`}`}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {savedOk ? 'check_circle' : 'save'}
                  </span>}
              {saving ? 'Guardando...' : savedOk ? '¡Instrucciones guardadas!' : 'Guardar instrucciones'}
            </button>
          </div>

          {recActivo?.updated_at && (
            <p className="text-[11px] text-on-surface-variant text-center">
              Última actualización: {new Date(recActivo.updated_at).toLocaleString('es-CO')}
            </p>
          )}

          {/* ── Precio del servicio (solo módulo Análisis de Perfil) ── */}
          {m.key === 'analisis_perfil' && (
            <div className="mt-2 p-5 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                <h3 className="font-extrabold text-rose-700">Precio del análisis</h3>
                <span className="ml-auto text-[10px] font-bold bg-rose-100 text-rose-600 border border-rose-200 px-2 py-0.5 rounded-full">Próximamente</span>
              </div>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Aquí podrás configurar el precio que paga el usuario por cada análisis de perfil.
                El cobro se procesará con <strong>Wompi / PayU</strong> antes de que la IA realice el análisis.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white border-2 border-rose-200 rounded-xl p-3 opacity-50 cursor-not-allowed">
                  <p className="text-[10px] font-bold text-on-surface-variant mb-1">Precio por análisis (COP)</p>
                  <p className="text-2xl font-extrabold text-rose-700">$—</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">Pendiente de configurar</p>
                </div>
                <div className="bg-white border-2 border-rose-200 rounded-xl p-3 opacity-50 cursor-not-allowed">
                  <p className="text-[10px] font-bold text-on-surface-variant mb-1">Tiempo estimado</p>
                  <p className="text-2xl font-extrabold text-slate-700">~30s</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">por análisis completo</p>
                </div>
              </div>
              <p className="text-[10px] text-on-surface-variant">
                Cuando definas el precio, avísale al equipo técnico para conectar el botón de pago en la pantalla del usuario.
              </p>
            </div>
          )}
        </>}
        </div>
      </div>

      {/* Modal historial */}
      {historialOpen && (
        <HistorialModal
          modulo={m}
          cerebro={cerebroEditor}
          onClose={() => setHistorialOpen(false)}
          onRevertir={prompt => { setInstrucciones(prompt); setSavedOk(false) }}
        />
      )}
    </div>
  )
}
