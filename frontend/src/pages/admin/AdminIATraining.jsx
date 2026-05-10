import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabase'

// ── Módulos entrenables ───────────────────────────────────────────────────────

const MODULOS = [
  {
    key: 'opec_maestro',
    nombre: 'Generador de Preguntas',
    emoji: '📝',
    icono: 'quiz',
    color: 'blue',
    bg: 'bg-blue-600',
    bgLight: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    rutas: ['Simulacro IA', 'Banco de preguntas'],
    cerebros: ['Gemini', 'DeepSeek'],
    queSabe: 'Este módulo controla cómo la IA crea las preguntas del simulacro. Aquí le enseñas cuántas opciones poner, qué nivel de dificultad, qué tipo de preguntas hacer y cómo calificar las respuestas.',
    ejemploUso: 'Cuando un usuario genera un simulacro OPEC, la IA usa estas instrucciones para crear las preguntas.',
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
    bg: 'bg-violet-600',
    bgLight: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    rutas: ['Chat de estudio'],
    cerebros: ['Gemini', 'DeepSeek'],
    queSabe: 'Aquí le enseñas a Praxia cómo hablar con los usuarios. Puedes definir su personalidad, su nombre, su tono (amigable, formal, motivador), cómo saluda y cómo ayuda con el estudio.',
    ejemploUso: 'Cuando el usuario abre el chat de estudio y le habla a Praxia, ella usa estas instrucciones para responder.',
    variables: [{ llave: '{{EXAMEN}}', desc: 'Se reemplaza automáticamente con el nombre del examen que estudia el usuario' }],
    defaultPrompt: `Eres Praxia, la asistente de estudio personal del usuario para el examen "{{EXAMEN}}". Tienes un tono cálido, cercano y motivador — como una tutora o compañera de estudio que de verdad quiere que el usuario salga adelante. Si es la primera vez que alguien te habla (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale en qué lo puedes ayudar hoy. En las demás respuestas, sé natural y directa sin necesidad de presentarte de nuevo. Nunca respondas de forma fría o robótica. Usa lenguaje natural en español colombiano, con energía positiva. Ayuda con temas del examen, explica conceptos difíciles con ejemplos, da estrategias de estudio y motiva cuando el usuario se sienta frustrado.`,
  },
  {
    key: 'sala_analisis',
    nombre: 'Análisis de Sala',
    emoji: '🏆',
    icono: 'leaderboard',
    color: 'emerald',
    bg: 'bg-emerald-600',
    bgLight: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    rutas: ['Salas competitivas'],
    cerebros: ['Gemini', 'DeepSeek'],
    queSabe: 'Después de que los usuarios terminan una sala de competencia, la IA analiza los resultados. Aquí le enseñas qué tono usar, qué decir de los ganadores y cómo motivar a los que no ganaron.',
    ejemploUso: 'Cuando termina una sala de juego, la IA genera un análisis de los resultados con este comportamiento.',
    variables: [],
    defaultPrompt: ``,
  },
  {
    key: 'verificar_opec',
    nombre: 'Buscador de Datos OPEC',
    emoji: '🔍',
    icono: 'travel_explore',
    color: 'amber',
    bg: 'bg-amber-600',
    bgLight: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    rutas: ['Verificar cargo OPEC'],
    cerebros: ['Gemini + Google Search'],
    queSabe: 'Cuando el usuario escribe el nombre de su cargo, la IA busca en Google información real sobre esa prueba OPEC (cuántas preguntas tiene, cuánto dura, qué módulos). Aquí defines qué buscar y cómo devolver esos datos.',
    ejemploUso: 'Cuando el usuario escribe "Profesional Universitario DIAN" y hace clic en Verificar.',
    variables: [{ llave: '{{CARGO}}', desc: 'Se reemplaza con el nombre del cargo que escribe el usuario' }],
    defaultPrompt: `Busca en internet información ACTUAL sobre la prueba de conocimientos (OPEC) para el cargo "{{CARGO}}" en el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

Responde EXCLUSIVAMENTE con este JSON (sin markdown, sin texto adicional):
{"encontrado":true,"entidad":"nombre de la entidad","total_preguntas":número,"duracion_minutos":número_o_null,"modulos":[{"nombre":"nombre del módulo","porcentaje":número}],"año_info":"2024 o 2025","nota":"observación relevante o null"}

Si no encuentras información específica para ese cargo, responde exactamente:
{"encontrado":false,"entidad":null,"total_preguntas":null,"duracion_minutos":null,"modulos":[],"año_info":null,"nota":null}`,
  },
]

const COLOR_BTN = {
  blue:   'bg-blue-600   hover:bg-blue-700   text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 text-white',
  emerald:'bg-emerald-600 hover:bg-emerald-700 text-white',
  amber:  'bg-amber-600  hover:bg-amber-700  text-white',
}

// ── Pantalla principal ────────────────────────────────────────────────────────

export default function AdminIATraining() {
  const [moduloActivo, setModuloActivo] = useState(MODULOS[0])
  const [records,      setRecords]      = useState({})
  const [instrucciones,setInstrucciones]= useState('')
  const [notas,        setNotas]        = useState('')
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [savedOk,      setSavedOk]      = useState(false)
  const [resetting,    setResetting]    = useState(false)

  const fetchAll = async () => {
    setLoading(true)
    const { data } = await supabase.from('ai_system_prompts').select('*')
    const map = {}
    for (const r of data || []) map[r.endpoint_key] = r
    setRecords(map)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  useEffect(() => {
    const r = records[moduloActivo.key]
    setInstrucciones(r?.system_prompt ?? moduloActivo.defaultPrompt ?? '')
    setNotas(r?.notas_admin ?? '')
    setSavedOk(false)
  }, [moduloActivo, records])

  const guardadoEnDB    = records[moduloActivo.key]?.system_prompt ?? null
  const esDefault       = instrucciones === moduloActivo.defaultPrompt
  const hayCambios      = instrucciones !== (guardadoEnDB ?? moduloActivo.defaultPrompt) ||
                          notas         !== (records[moduloActivo.key]?.notas_admin ?? '')

  const handleGuardar = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('ai_system_prompts')
        .upsert({
          endpoint_key:   moduloActivo.key,
          nombre:         moduloActivo.nombre,
          descripcion:    moduloActivo.queSabe,
          icono:          moduloActivo.icono,
          rutas:          moduloActivo.rutas,
          modelos:        moduloActivo.cerebros,
          system_prompt:  instrucciones,
          default_prompt: moduloActivo.defaultPrompt ?? '',
          notas_admin:    notas,
          updated_at:     new Date().toISOString(),
        }, { onConflict: 'endpoint_key' })
      if (error) throw error
      await fetchAll()
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
    const def = moduloActivo.defaultPrompt ?? ''
    try {
      await supabase.from('ai_system_prompts').upsert({
        endpoint_key:   moduloActivo.key,
        nombre:         moduloActivo.nombre,
        descripcion:    moduloActivo.queSabe,
        icono:          moduloActivo.icono,
        rutas:          moduloActivo.rutas,
        modelos:        moduloActivo.cerebros,
        system_prompt:  def,
        default_prompt: def,
        notas_admin:    '',
        updated_at:     new Date().toISOString(),
      }, { onConflict: 'endpoint_key' })
      await fetchAll()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setResetting(false)
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
            Aquí defines <strong>cómo piensa y responde la IA</strong> en cada parte de la app. Escribe instrucciones en español normal, como si le estuvieras explicando a una persona. Los cambios se aplican en máximo 5 minutos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Selector de módulo ── */}
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant px-1 mb-3">
            ¿Qué quieres enseñar?
          </p>
          {MODULOS.map(mod => {
            const rec = records[mod.key]
            const modificado = rec && rec.system_prompt !== mod.defaultPrompt
            const activo = mod.key === m.key
            return (
              <button key={mod.key} onClick={() => setModuloActivo(mod)}
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
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Modificado" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Editor principal ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Info del módulo */}
          <div className={`p-5 ${m.bgLight} border ${m.border} rounded-2xl`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`material-symbols-outlined ${m.text} text-xl`}
                style={{ fontVariationSettings: "'FILL' 1" }}>{m.icono}</span>
              <h2 className={`font-extrabold text-lg ${m.text}`}>{m.nombre}</h2>
              {/* Estado */}
              {loading
                ? null
                : records[m.key] && records[m.key].system_prompt !== m.defaultPrompt
                  ? <span className="ml-auto text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full">Instrucciones personalizadas</span>
                  : <span className="ml-auto text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full">Usando instrucciones originales</span>}
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed mb-3">{m.queSabe}</p>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">alt_route</span>
              <span className="font-semibold">Se usa en:</span>
              {m.rutas.map(r => (
                <span key={r} className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${m.border} ${m.text} bg-white`}>{r}</span>
              ))}
              <span className="ml-2 font-semibold">Cerebro:</span>
              {m.cerebros.map(c => (
                <span key={c} className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">{c}</span>
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

          {/* Área de instrucciones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-on-surface-variant">edit_note</span>
                Instrucciones para la IA
              </label>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {instrucciones.length.toLocaleString()} caracteres · {instrucciones.split('\n').length} líneas
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
                  m.key === 'sala_analisis'
                    ? 'Opcional: escribe instrucciones sobre cómo debe analizar los resultados de la sala. Si lo dejas vacío, la IA usará su comportamiento por defecto.'
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
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            {!esDefault && (
              <button onClick={handleRestablecer} disabled={resetting}
                className="sm:w-auto px-4 py-2.5 rounded-full border-2 border-slate-200 text-sm font-bold text-on-surface-variant hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {resetting
                  ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-base">restart_alt</span>}
                Regresar a las originales
              </button>
            )}

            <button onClick={handleGuardar} disabled={saving || !hayCambios}
              className={`flex-1 sm:flex-none py-3 px-6 rounded-full text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm
                ${savedOk
                  ? 'bg-emerald-500 text-white'
                  : `${COLOR_BTN[m.color]} disabled:opacity-40 disabled:cursor-not-allowed`}`}>
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}>
                    {savedOk ? 'check_circle' : 'save'}
                  </span>}
              {saving ? 'Guardando...' : savedOk ? '¡Instrucciones guardadas!' : 'Guardar instrucciones'}
            </button>
          </div>

          {/* Fecha última actualización */}
          {records[m.key]?.updated_at && (
            <p className="text-[11px] text-on-surface-variant text-center">
              Última actualización: {new Date(records[m.key].updated_at).toLocaleString('es-CO')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
