import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'

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
]

const COLOR_BTN = {
  blue:   'bg-blue-600   hover:bg-blue-700   text-white',
  violet: 'bg-violet-600 hover:bg-violet-700 text-white',
  emerald:'bg-emerald-600 hover:bg-emerald-700 text-white',
  amber:  'bg-amber-600  hover:bg-amber-700  text-white',
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

// ── Componente principal ──────────────────────────────────────────────────────

export default function AdminIATraining() {
  const { user } = useAuth()

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
              const activo    = mod.key === m.key
              return (
                <button key={mod.key}
                  onClick={() => { setModuloActivo(mod); setCerebroEditor('gemini') }}
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
          </div>

          {/* ── Asignación de cerebros ── */}
          {!loading && (
            <AsignacionCerebros records={records} onCambiar={handleCambiarCerebroActivo} />
          )}
        </div>

        {/* ── Editor principal ── */}
        <div className="lg:col-span-3 space-y-5">

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
