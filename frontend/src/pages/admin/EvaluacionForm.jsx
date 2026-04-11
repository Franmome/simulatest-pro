import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────────────────────
function InputField({ label, required, hint, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
        {hint && <span className="text-[10px] text-on-surface-variant italic">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Card({ children, className = '' }) {
  return (
    <div className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/15 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

function HelpBox({ title, items, tone = 'primary' }) {
  const toneCls = tone === 'secondary'
    ? 'bg-secondary-container/20 border-secondary/20 text-secondary'
    : 'bg-primary/5 border-primary/10 text-primary'

  return (
    <div className={`p-4 rounded-xl border ${toneCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-sm">info</span>
        <p className="text-xs font-bold uppercase tracking-widest">{title}</p>
      </div>
      <ul className="space-y-1.5 text-xs text-on-surface-variant">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-bold text-primary">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const INPUT_CLS = `w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30
  rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20
  focus:border-primary/40 transition-all placeholder:text-on-surface-variant/50`

const LETRAS = ['A', 'B', 'C', 'D']

const CSV_COLUMNS = [
  'area',
  'dificultad',
  'enunciado',
  'A',
  'B',
  'C',
  'D',
  'correcta',
  'explicacion',
]

const PROMPT_IA_CSV = `Convierte este material en preguntas para un archivo CSV con esta estructura exacta:
area,dificultad,enunciado,A,B,C,D,correcta,explicacion

Reglas:
- "correcta" solo puede ser A, B, C o D
- no cambies el orden de las columnas
- no agregues columnas extra
- cada fila debe representar una sola pregunta
- "dificultad" debe ser: facil, medio o dificil
- "explicacion" debe ser breve, clara y útil para retroalimentación
- devuelve únicamente el CSV limpio, sin markdown, sin comentarios y sin explicación adicional

Si el material corresponde a una profesión específica, adapta las respuestas correctas a esa profesión.`

function preguntaVacia() {
  return {
    _id: Math.random().toString(36).slice(2),
    text: '',
    explanation: '',
    difficulty: 'medio',
    area: '',
    options: LETRAS.map(letter => ({
      letter,
      text: '',
      is_correct: false,
    })),
  }
}

function iconoMaterial(type) {
  return {
    pdf: 'picture_as_pdf',
    video: 'play_circle',
    link: 'link',
    doc: 'description',
  }[type] || 'attachment'
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

// ─────────────────────────────────────────────────────────────────────────────
// PreguntaCard
// ─────────────────────────────────────────────────────────────────────────────
function PreguntaCard({ preg, idx, onChange, onDelete, expandido, onToggle }) {
  const tieneCorrecta = preg.options.some(o => o.is_correct)

  function setOpcion(i, field, value) {
    const opts = [...preg.options]

    if (field === 'is_correct') {
      opts.forEach((o, j) => {
        opts[j] = { ...o, is_correct: j === i }
      })
    } else {
      opts[i] = { ...opts[i], [field]: value }
    }

    onChange({ ...preg, options: opts })
  }

  return (
    <div className={`rounded-xl border transition-all ${tieneCorrecta ? 'border-outline-variant/20' : 'border-error/30 bg-error-container/5'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tieneCorrecta ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`}>
          {idx + 1}
        </span>

        <p className="flex-1 text-sm font-medium truncate text-on-surface">
          {preg.text || <span className="text-on-surface-variant italic">Pregunta sin enunciado</span>}
        </p>

        <div className="flex items-center gap-2">
          {!tieneCorrecta && (
            <span className="text-[10px] font-bold text-error bg-error-container px-2 py-0.5 rounded-full">
              Sin respuesta correcta
            </span>
          )}
          <span className="material-symbols-outlined text-on-surface-variant text-lg">
            {expandido ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-4">
          <InputField label="Enunciado" required>
            <textarea
              rows={3}
              value={preg.text}
              onChange={e => onChange({ ...preg, text: e.target.value })}
              placeholder="Escribe la pregunta aquí..."
              className={`${INPUT_CLS} resize-none`}
            />
          </InputField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label="Área temática">
              <input
                type="text"
                value={preg.area}
                onChange={e => onChange({ ...preg, area: e.target.value })}
                placeholder="ej: Derecho Fiscal"
                className={INPUT_CLS}
              />
            </InputField>

            <InputField label="Dificultad">
              <select
                value={preg.difficulty}
                onChange={e => onChange({ ...preg, difficulty: e.target.value })}
                className={INPUT_CLS}
              >
                <option value="facil">Fácil</option>
                <option value="medio">Medio</option>
                <option value="dificil">Difícil</option>
              </select>
            </InputField>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Opciones — marca la correcta
            </p>

            {preg.options.map((op, i) => (
              <div key={op.letter} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpcion(i, 'is_correct', true)}
                  className={`w-8 h-8 rounded-full flex-shrink-0 font-bold text-sm transition-all ${
                    op.is_correct
                      ? 'bg-secondary text-on-secondary shadow-md'
                      : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container'
                  }`}
                >
                  {op.letter}
                </button>

                <input
                  type="text"
                  value={op.text}
                  onChange={e => setOpcion(i, 'text', e.target.value)}
                  placeholder={`Opción ${op.letter}`}
                  className={`${INPUT_CLS} flex-1 ${op.is_correct ? 'border-secondary/40 ring-1 ring-secondary/20' : ''}`}
                />

                {op.is_correct && (
                  <span
                    className="material-symbols-outlined text-secondary text-lg flex-shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    check_circle
                  </span>
                )}
              </div>
            ))}
          </div>

          <InputField label="Explicación (retroalimentación)">
            <textarea
              rows={2}
              value={preg.explanation}
              onChange={e => onChange({ ...preg, explanation: e.target.value })}
              placeholder="Explica por qué la respuesta es correcta..."
              className={`${INPUT_CLS} resize-none`}
            />
          </InputField>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs font-bold text-error hover:bg-error-container/30 px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Eliminar pregunta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// NivelCard
// ─────────────────────────────────────────────────────────────────────────────
function NivelCard({ nivel, idx, onChange, onDelete, preguntasCount }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
          {idx + 1}
        </div>
        <h4 className="font-bold text-sm flex-1">{nivel.name || `Nivel ${idx + 1}`}</h4>
        <span className="text-xs text-on-surface-variant">
          {preguntasCount} pregunta{preguntasCount !== 1 ? 's' : ''}
        </span>
        {idx > 0 && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField label="Nombre del nivel" required>
          <input
            type="text"
            value={nivel.name}
            onChange={e => onChange({ ...nivel, name: e.target.value })}
            placeholder="ej: Profesional Universitario"
            className={INPUT_CLS}
          />
        </InputField>

        <InputField label="Descripción">
          <input
            type="text"
            value={nivel.description}
            onChange={e => onChange({ ...nivel, description: e.target.value })}
            placeholder="Descripción breve"
            className={INPUT_CLS}
          />
        </InputField>

        <InputField label="Tiempo límite (minutos)" required>
          <input
            type="number"
            min={10}
            max={360}
            value={nivel.time_limit}
            onChange={e => onChange({ ...nivel, time_limit: Number(e.target.value) })}
            className={INPUT_CLS}
          />
        </InputField>

        <InputField label="Puntaje de aprobación (%)">
          <input
            type="number"
            min={50}
            max={100}
            value={nivel.passing_score}
            onChange={e => onChange({ ...nivel, passing_score: Number(e.target.value) })}
            className={INPUT_CLS}
          />
        </InputField>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
export default function EvaluacionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const csvRef = useRef(null)
  const isEdit = Boolean(id)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    is_active: true,
  })

  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)
  const [exito, setExito] = useState(false)
  const [tab, setTab] = useState('general')
  const [modoVersiones, setModoVersiones] = useState('avanzado')

  // Niveles y preguntas
  const [niveles, setNiveles] = useState([
    { _id: 'n1', name: '', description: '', time_limit: 90, passing_score: 70, sort_order: 1 },
  ])
  const [nivelActivo, setNivelActivo] = useState('n1')
  const [preguntas, setPreguntas] = useState({ n1: [preguntaVacia()] })
  const [pregExpandida, setPregExpandida] = useState(null)

  // Profesiones
  const [profesiones, setProfesiones] = useState([])

  // Materiales
  const [materiales, setMateriales] = useState([])
  const [nuevoMat, setNuevoMat] = useState({
    title: '',
    type: 'pdf',
    url: '',
    folder: 'General',
    description: '',
    is_shared: true,
  })
  const [guardandoMat, setGuardandoMat] = useState(false)

  // CSV
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importOk, setImportOk] = useState(null)

  useEffect(() => {
    cargarCategorias()
    if (isEdit) {
      cargarEvaluacion()
      cargarProfesiones()
      cargarMateriales()
    }
  }, [id])

  async function cargarCategorias() {
    const { data } = await supabase.from('categories').select('id, name').order('name')
    setCategorias(data || [])
  }

  async function cargarEvaluacion() {
    const { data: ev } = await supabase
      .from('evaluations')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (ev) {
      setForm({
        title: ev.title,
        description: ev.description || '',
        category_id: ev.category_id || '',
        is_active: ev.is_active,
      })
    }

    const { data: lvs } = await supabase
      .from('levels')
      .select('*')
      .eq('evaluation_id', id)
      .order('sort_order')

    if (lvs?.length) {
      const nivelesConId = lvs.map(l => ({ ...l, _id: l.id }))
      setNiveles(nivelesConId)
      setNivelActivo(nivelesConId[0]._id)

      const pregsPorNivel = {}

      await Promise.all(
        nivelesConId.map(async nv => {
          const { data: qs } = await supabase
            .from('questions')
            .select('*, options(*)')
            .eq('level_id', nv.id)
            .order('id')

          pregsPorNivel[nv._id] =
            qs?.map(q => ({
              ...q,
              _id: q.id,
              options: LETRAS.map(letter => {
                const op = q.options?.find(o => o.letter === letter)
                return op
                  ? { ...op }
                  : { letter, text: '', is_correct: false }
              }),
            })) || [preguntaVacia()]
        })
      )

      setPreguntas(pregsPorNivel)
    }
  }

  async function cargarProfesiones() {
    const { data } = await supabase
      .from('professions')
      .select('*')
      .eq('evaluation_id', id)
      .order('created_at')

    setProfesiones(data || [])
  }

  async function cargarMateriales() {
    const { data } = await supabase
      .from('study_materials')
      .select('*')
      .eq('package_id', id)
      .order('folder')
      .order('sort_order')

    setMateriales(data || [])
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Profesiones
  // ───────────────────────────────────────────────────────────────────────────
  async function agregarProfesion() {
    const { data } = await supabase
      .from('professions')
      .insert({
        evaluation_id: parseInt(id, 10),
        name: 'Nueva versión',
        price: 0,
        is_active: true,
        is_combo: false,
      })
      .select()
      .single()

    if (data) setProfesiones(prev => [...prev, data])
  }

  async function actualizarProfesion(profId, campo, valor) {
    setProfesiones(prev => prev.map(p => (p.id === profId ? { ...p, [campo]: valor } : p)))
    await supabase.from('professions').update({ [campo]: valor }).eq('id', profId)
  }

  async function eliminarProfesion(profId) {
    if (!confirm('¿Eliminar esta versión?')) return
    await supabase.from('professions').delete().eq('id', profId)
    setProfesiones(prev => prev.filter(p => p.id !== profId))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Materiales
  // ───────────────────────────────────────────────────────────────────────────
  async function agregarMaterial() {
    if (!nuevoMat.title.trim() || !nuevoMat.url.trim()) return

    setGuardandoMat(true)

    const payload = {
      package_id: parseInt(id, 10),
      title: nuevoMat.title,
      type: nuevoMat.type,
      url: nuevoMat.url,
      folder: nuevoMat.folder || 'General',
      description: nuevoMat.description,
      sort_order: materiales.length,
      is_active: true,
      is_shared: nuevoMat.is_shared,
    }

    const { data, error: saveError } = await supabase
      .from('study_materials')
      .insert(payload)
      .select()
      .single()

    setGuardandoMat(false)

    if (!saveError && data) {
      setMateriales(prev => [...prev, data])
      setNuevoMat({
        title: '',
        type: 'pdf',
        url: '',
        folder: 'General',
        description: '',
        is_shared: true,
      })
    }
  }

  async function eliminarMaterial(matId) {
    await supabase.from('study_materials').delete().eq('id', matId)
    setMateriales(prev => prev.filter(m => m.id !== matId))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Niveles
  // ───────────────────────────────────────────────────────────────────────────
  function agregarNivel() {
    const _id = Math.random().toString(36).slice(2)
    setNiveles(prev => [
      ...prev,
      {
        _id,
        name: '',
        description: '',
        time_limit: 90,
        passing_score: 70,
        sort_order: prev.length + 1,
      },
    ])
    setPreguntas(prev => ({ ...prev, [_id]: [preguntaVacia()] }))
    setNivelActivo(_id)
    setTab('niveles')
  }

  function actualizarNivel(_id, datos) {
    setNiveles(prev => prev.map(n => (n._id === _id ? { ...n, ...datos } : n)))
  }

  function eliminarNivel(_id) {
    if (niveles.length === 1) return
    setNiveles(prev => prev.filter(n => n._id !== _id))
    setPreguntas(prev => {
      const copy = { ...prev }
      delete copy[_id]
      return copy
    })
    const siguiente = niveles.find(n => n._id !== _id)?._id
    if (siguiente) setNivelActivo(siguiente)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Preguntas
  // ───────────────────────────────────────────────────────────────────────────
  function agregarPregunta() {
    const nueva = preguntaVacia()
    setPreguntas(prev => ({
      ...prev,
      [nivelActivo]: [...(prev[nivelActivo] || []), nueva],
    }))
    setPregExpandida(nueva._id)
  }

  function actualizarPregunta(nId, pregId, datos) {
    setPreguntas(prev => ({
      ...prev,
      [nId]: prev[nId].map(p => (p._id === pregId ? { ...p, ...datos } : p)),
    }))
  }

  function eliminarPregunta(nId, pregId) {
    setPreguntas(prev => ({
      ...prev,
      [nId]: prev[nId].filter(p => p._id !== pregId),
    }))
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CSV
  // ───────────────────────────────────────────────────────────────────────────
  function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      const next = line[i + 1]

      if (char === '"' && inQuotes && next === '"') {
        current += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }

    result.push(current)
    return result.map(v => v.trim())
  }

  function importarCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportando(true)
    setImportError(null)
    setImportOk(null)

    const reader = new FileReader()

    reader.onload = event => {
      try {
        const raw = String(event.target?.result || '')
          .replace(/\r/g, '')
          .split('\n')
          .filter(Boolean)

        if (raw.length < 2) throw new Error('El archivo CSV no tiene suficientes filas.')

        const header = parseCSVLine(raw[0]).map(h => h.toLowerCase())
        const reqs = ['enunciado', 'a', 'b', 'c', 'd', 'correcta']
        const missing = reqs.filter(r => !header.includes(r))

        if (missing.length) {
          throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}`)
        }

        const nuevas = raw.slice(1).map((line, i) => {
          const cols = parseCSVLine(line)
          const get = key => cols[header.indexOf(key)] || ''
          const correcta = get('correcta').toUpperCase()

          if (!LETRAS.includes(correcta)) {
            throw new Error(`Fila ${i + 2}: "correcta" debe ser A, B, C o D`)
          }

          return {
            _id: Math.random().toString(36).slice(2),
            text: get('enunciado'),
            explanation: get('explicacion'),
            difficulty: get('dificultad') || 'medio',
            area: get('area'),
            options: LETRAS.map(letter => ({
              letter,
              text: get(letter.toLowerCase()),
              is_correct: letter === correcta,
            })),
          }
        })

        setPreguntas(prev => ({
          ...prev,
          [nivelActivo]: [...(prev[nivelActivo] || []), ...nuevas],
        }))

        setImportOk(`✅ ${nuevas.length} preguntas importadas correctamente al nivel activo.`)
        if (csvRef.current) csvRef.current.value = ''
      } catch (err) {
        setImportError(err.message || 'No se pudo procesar el CSV.')
      } finally {
        setImportando(false)
      }
    }

    reader.readAsText(file, 'utf-8')
  }

  function descargarPlantilla() {
    const filas = [
      CSV_COLUMNS.join(','),
      'Derecho Fiscal,medio,"¿Cuál es el órgano de control fiscal en Colombia?","Procuraduría","Contraloría","Fiscalía","Defensoría",B,"La Contraloría ejerce vigilancia fiscal según el Art. 267."',
      'Control Interno,facil,"¿Qué significa MIPG?","Modelo Integrado de Planeación y Gestión","Manual Interno de Procesos Generales","Mecanismo Institucional de Planeación General","Modelo Integral de Procesos de Gobierno",A,"MIPG significa Modelo Integrado de Planeación y Gestión."',
      'Ofimática,medio,"¿Qué atajo permite guardar un documento en Word?","Ctrl+P","Ctrl+S","Ctrl+N","Alt+G",B,"Ctrl+S es el atajo estándar para guardar documentos."',
    ]

    const csv = filas.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_preguntas_simulatest.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copiarPromptIA() {
    try {
      await navigator.clipboard.writeText(PROMPT_IA_CSV)
      setImportOk('✅ Prompt copiado al portapapeles.')
      setTimeout(() => setImportOk(null), 2000)
    } catch {
      setImportError('No se pudo copiar el prompt automáticamente.')
    }
  }

  async function copiarInstruccionesExcel() {
    const texto = `Instrucciones para preparar el archivo:
1. Abrir Excel o Google Sheets
2. Crear columnas con este orden exacto:
${CSV_COLUMNS.join(',')}
3. Una fila = una pregunta
4. En la columna "correcta" usar solo A, B, C o D
5. Guardar como CSV UTF-8`

    try {
      await navigator.clipboard.writeText(texto)
      setImportOk('✅ Instrucciones para Excel/Sheets copiadas.')
      setTimeout(() => setImportOk(null), 2000)
    } catch {
      setImportError('No se pudo copiar las instrucciones.')
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Save
  // ───────────────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    setError(null)

    try {
      if (!form.title.trim()) throw new Error('El título es obligatorio.')
      if (niveles.some(n => !n.name.trim())) throw new Error('Todos los niveles deben tener nombre.')

      let evalId = id

      if (isEdit) {
        const { error: e1 } = await supabase
          .from('evaluations')
          .update({
            title: form.title,
            description: form.description,
            category_id: form.category_id || null,
            is_active: form.is_active,
          })
          .eq('id', id)

        if (e1) throw e1
      } else {
        const { data: ev, error: e1 } = await supabase
          .from('evaluations')
          .insert({
            title: form.title,
            description: form.description,
            category_id: form.category_id || null,
            is_active: form.is_active,
          })
          .select('id')
          .single()

        if (e1) throw e1
        evalId = ev.id
      }

      // Guardar niveles y preguntas
      for (const [idx, nv] of niveles.entries()) {
        let levelId = typeof nv._id === 'number' ? nv._id : null

        if (isEdit && levelId) {
          const { error: e2 } = await supabase
            .from('levels')
            .update({
              name: nv.name,
              description: nv.description,
              time_limit: nv.time_limit,
              passing_score: nv.passing_score,
              sort_order: idx + 1,
            })
            .eq('id', levelId)

          if (e2) throw e2
        } else {
          const { data: lv, error: e2 } = await supabase
            .from('levels')
            .insert({
              evaluation_id: evalId,
              name: nv.name,
              description: nv.description,
              time_limit: nv.time_limit,
              passing_score: nv.passing_score,
              sort_order: idx + 1,
            })
            .select('id')
            .single()

          if (e2) throw e2
          levelId = lv.id
        }

        const pregsDelNivel = preguntas[nv._id] || []

        for (const preg of pregsDelNivel) {
          const pregExiste = typeof preg._id === 'number'
          let qId = preg._id

          if (isEdit && pregExiste) {
            const { error: e3 } = await supabase
              .from('questions')
              .update({
                text: preg.text,
                explanation: preg.explanation,
                difficulty: preg.difficulty,
                area: preg.area,
              })
              .eq('id', qId)

            if (e3) throw e3

            for (const op of preg.options) {
              if (op.id) {
                const { error: e4 } = await supabase
                  .from('options')
                  .update({
                    text: op.text,
                    is_correct: op.is_correct,
                  })
                  .eq('id', op.id)

                if (e4) throw e4
              }
            }
          } else {
            const { data: q, error: e3 } = await supabase
              .from('questions')
              .insert({
                level_id: levelId,
                text: preg.text,
                explanation: preg.explanation,
                question_type: 'multiple',
                difficulty: preg.difficulty,
                area: preg.area,
              })
              .select('id')
              .single()

            if (e3) throw e3
            qId = q.id

            const { error: e4 } = await supabase
              .from('options')
              .insert(
                preg.options.map(op => ({
                  question_id: qId,
                  text: op.text,
                  letter: op.letter,
                  is_correct: op.is_correct,
                }))
              )

            if (e4) throw e4
          }
        }
      }

      if (form.is_active) {
        const { data: pkgExistente } = await supabase
          .from('packages')
          .select('id')
          .contains('evaluations_ids', [parseInt(evalId, 10)])
          .maybeSingle()

        const activasNoCombo = profesiones.filter(p => p.is_active && !p.is_combo)
        const precioBase = activasNoCombo.length
          ? Math.min(...activasNoCombo.map(p => Number(p.price) || 0))
          : 0

        const payloadPackage = {
          name: form.title,
          description: form.description,
          price: precioBase,
          type: 'standard',
          duration_days: 365,
          is_active: true,
          evaluations_ids: [parseInt(evalId, 10)],
          pricing_mode: modoVersiones === 'simple' ? 'global' : 'per_profession',
          content_mode: 'shared',
          has_study_material: true,
          has_practice_mode: true,
          has_exam_mode: true,
          has_online_room: true,
          has_level_selector: profesiones.filter(p => p.is_active).length > 1,
        }

        if (pkgExistente) {
          const { error: e5 } = await supabase
            .from('packages')
            .update(payloadPackage)
            .eq('id', pkgExistente.id)

          if (e5) throw e5

          await supabase
            .from('professions')
            .update({ package_id: pkgExistente.id })
            .eq('evaluation_id', evalId)
        } else {
          const { data: newPkg, error: e5 } = await supabase
            .from('packages')
            .insert(payloadPackage)
            .select('id')
            .single()

          if (e5) throw e5

          if (newPkg) {
            await supabase
              .from('professions')
              .update({ package_id: newPkg.id })
              .eq('evaluation_id', evalId)
          }
        }
      }

      setExito(true)
      setTimeout(() => navigate('/admin/evaluaciones'), 1200)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al guardar.')
    } finally {
      setGuardando(false)
    }
  }

  const pregActivas = preguntas[nivelActivo] || []
  const totalPregs = Object.values(preguntas).reduce((sum, arr) => sum + arr.length, 0)
  const carpetas = [...new Set(materiales.map(m => m.folder))]
  const versionesActivas = profesiones.filter(p => p.is_active)
  const precioMinimo = versionesActivas.length
    ? Math.min(...versionesActivas.map(p => Number(p.price) || 0))
    : 0

  const infoPorTab = useMemo(() => ({
    general: {
      title: 'Cómo funciona esta sección',
      items: [
        'Aquí defines la información general del paquete que se publica en la plataforma.',
        'Si activas “Publicar paquete”, aparecerá disponible para compra.',
        'La descripción debe explicar qué incluye: simulacros, módulos, videos y material.',
      ],
    },
    profesiones: {
      title: 'Cómo funcionan las versiones',
      items: [
        'Usa una versión por profesión, cargo o perfil.',
        'Cada versión puede tener su propio precio.',
        'Cada versión puede apuntar a un nivel distinto de preguntas.',
        'Puedes crear un combo para vender acceso total.',
      ],
    },
    niveles: {
      title: 'Cómo funcionan los niveles',
      items: [
        'Cada nivel es un banco de preguntas específico.',
        'Si la prueba cambia según el cargo, crea niveles separados.',
        'El nivel luego se asigna a una versión/profesión.',
      ],
    },
    preguntas: {
      title: 'Cómo funcionan las preguntas',
      items: [
        'Cada pregunta debe tener una sola respuesta correcta.',
        'La explicación sirve como retroalimentación temporal.',
        'Puedes escribir preguntas manualmente o importarlas por CSV.',
      ],
    },
    material: {
      title: 'Cómo funciona el material',
      items: [
        'Puedes agregar PDFs, videos, documentos o enlaces.',
        'Organiza el contenido por carpetas para que el usuario lo entienda mejor.',
        'El switch “material compartido” deja el recurso visible para todas las versiones.',
      ],
    },
    importar: {
      title: 'Cómo importar desde CSV',
      items: [
        'Crea primero los niveles.',
        'Selecciona el nivel activo antes de subir el archivo.',
        'Usa la plantilla oficial para evitar errores de estructura.',
        'Si una misma pregunta cambia según la profesión, importa un CSV distinto por nivel.',
      ],
    },
  }), [])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 h-16 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/evaluaciones')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Volver
          </button>

          <div className="h-5 w-px bg-outline-variant/30" />

          <h1 className="font-headline font-extrabold text-lg text-primary">
            {isEdit ? 'Editar Paquete' : 'Nuevo Paquete'}
          </h1>

          <div className="hidden md:flex items-center gap-3 ml-4">
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
              {niveles.length} nivel{niveles.length !== 1 ? 'es' : ''}
            </span>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
              {totalPregs} pregunta{totalPregs !== 1 ? 's' : ''}
            </span>
            {materiales.length > 0 && (
              <span className="text-xs font-bold text-secondary bg-secondary-container/30 px-3 py-1 rounded-full">
                {materiales.length} material{materiales.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/admin/evaluaciones')}
            className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="eval-form"
            disabled={guardando || exito}
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60"
          >
            {guardando && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}

            {exito ? (
              <>
                <span className="material-symbols-outlined text-sm">check</span>
                ¡Publicado!
              </>
            ) : guardando ? 'Guardando...' : isEdit ? 'Actualizar paquete' : 'Publicar paquete'}
          </button>
        </div>
      </header>

      <form id="eval-form" onSubmit={handleSubmit}>
        <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            <div className="flex flex-col gap-1">
              {[
                { key: 'general', icon: 'inventory_2', label: 'Info del Paquete' },
                { key: 'profesiones', icon: 'people', label: 'Versiones y Precios' },
                { key: 'niveles', icon: 'layers', label: 'Niveles' },
                { key: 'preguntas', icon: 'quiz', label: 'Preguntas' },
                { key: 'material', icon: 'menu_book', label: 'Material de Estudio' },
                { key: 'importar', icon: 'upload_file', label: 'Importar CSV' },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${
                    tab === t.key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{t.icon}</span>
                  {t.label}

                  {t.key === 'preguntas' && totalPregs > 0 && (
                    <span className="ml-auto text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full">
                      {totalPregs}
                    </span>
                  )}

                  {t.key === 'material' && materiales.length > 0 && (
                    <span className="ml-auto text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full">
                      {materiales.length}
                    </span>
                  )}

                  {t.key === 'profesiones' && profesiones.length > 0 && (
                    <span className="ml-auto text-[10px] bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full">
                      {profesiones.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <HelpBox
              title={infoPorTab[tab]?.title || 'Ayuda'}
              items={infoPorTab[tab]?.items || []}
            />

            {(tab === 'preguntas' || tab === 'importar') && niveles.length > 1 && (
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-3">
                  Nivel activo
                </p>
                <div className="space-y-1">
                  {niveles.map(nv => (
                    <button
                      key={nv._id}
                      type="button"
                      onClick={() => setNivelActivo(nv._id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        nivelActivo === nv._id ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container'
                      }`}
                    >
                      {nv.name || 'Sin nombre'}
                      <span className="ml-2 text-[10px] opacity-70">
                        {(preguntas[nv._id] || []).length} pregs.
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                Resumen rápido
              </p>
              <div className="space-y-2 text-xs text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Versiones activas</span>
                  <span className="font-bold text-on-surface">{versionesActivas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Precio base</span>
                  <span className="font-bold text-on-surface">${precioMinimo.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Materiales</span>
                  <span className="font-bold text-on-surface">{materiales.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Último estado</span>
                  <span className={`font-bold ${form.is_active ? 'text-secondary' : 'text-tertiary'}`}>
                    {form.is_active ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
              </div>
            </Card>

            {error && (
              <div className="p-4 bg-error-container rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-on-error-container text-lg flex-shrink-0">
                  error
                </span>
                <p className="text-sm text-on-error-container font-medium">{error}</p>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* GENERAL */}
            {tab === 'general' && (
              <Card className="p-6 space-y-5">
                <h3 className="font-bold text-lg font-headline">Información del Paquete</h3>

                <InputField label="Nombre del paquete" required>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="ej: Contraloría General de la República"
                    className={INPUT_CLS}
                    required
                  />
                </InputField>

                <InputField label="Descripción" hint="Qué incluye este paquete">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe qué cubre este paquete, áreas temáticas, cantidad de preguntas..."
                    className={`${INPUT_CLS} resize-none`}
                  />
                </InputField>

                <InputField label="Categoría">
                  <select
                    value={form.category_id}
                    onChange={e => setForm({ ...form, category_id: e.target.value })}
                    className={INPUT_CLS}
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </InputField>

                <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                  <div>
                    <p className="text-sm font-bold">Publicar paquete</p>
                    <p className="text-xs text-on-surface-variant">
                      Visible en planes y disponible para compra
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${form.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>

                {form.is_active && (
                  <HelpBox
                    title="Publicación activa"
                    tone="secondary"
                    items={[
                      'Al guardar, este paquete aparecerá automáticamente en la página de planes.',
                      'El precio base se calculará con las versiones activas.',
                      'Si hay varias versiones activas, el usuario podrá elegir la suya.',
                    ]}
                  />
                )}
              </Card>
            )}

            {/* PROFESIONES */}
            {tab === 'profesiones' && (
              <Card className="p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg font-headline">Versiones y Precios</h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {!id
                        ? 'Guarda el paquete primero para agregar versiones.'
                        : 'Cada versión puede representar una profesión, cargo o acceso especial.'}
                    </p>
                  </div>

                  {id && (
                    <button
                      type="button"
                      onClick={agregarProfesion}
                      className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      + Versión
                    </button>
                  )}
                </div>

                <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/15 space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold">Modo de configuración</p>
                      <p className="text-xs text-on-surface-variant">
                        Usa simple si todo tendrá el mismo acceso. Usa avanzado si habrá versiones por cargo o profesión.
                      </p>
                    </div>
                    <div className="flex bg-surface-container-high rounded-full p-1">
                      <button
                        type="button"
                        onClick={() => setModoVersiones('simple')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          modoVersiones === 'simple' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                        }`}
                      >
                        Simple
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoVersiones('avanzado')}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                          modoVersiones === 'avanzado' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                        }`}
                      >
                        Avanzado
                      </button>
                    </div>
                  </div>
                </div>

                {!id && (
                  <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
                    <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">lock</span>
                    <p className="text-sm font-semibold">Guarda o publica el paquete primero</p>
                    <p className="text-xs mt-1">Luego podrás agregar las versiones por profesión</p>
                  </div>
                )}

                {id && profesiones.length === 0 && (
                  <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
                    <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">people</span>
                    <p className="text-sm font-semibold">Sin versiones creadas</p>
                    <p className="text-xs mt-1">Agrega la primera versión usando el botón de arriba</p>
                  </div>
                )}

                {id && profesiones.map((prof, idx) => (
                  <div
                    key={prof.id}
                    className={`rounded-2xl border-2 p-5 space-y-4 ${
                      prof.is_combo
                        ? 'border-tertiary/30 bg-tertiary-container/10'
                        : 'border-outline-variant/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          prof.is_combo ? 'bg-tertiary text-on-tertiary' : 'bg-primary/10 text-primary'
                        }`}>
                          {prof.is_combo ? '★' : idx + 1}
                        </div>

                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          prof.is_combo
                            ? 'bg-tertiary/20 text-tertiary'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}>
                          {prof.is_combo ? 'COMBO — Acceso total' : 'Versión individual'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <button
                            type="button"
                            onClick={() => actualizarProfesion(prof.id, 'is_combo', !prof.is_combo)}
                            className={`w-8 h-4 rounded-full relative transition-all ${prof.is_combo ? 'bg-tertiary' : 'bg-outline-variant'}`}
                          >
                            <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${prof.is_combo ? 'right-0.5' : 'left-0.5'}`} />
                          </button>
                          <span className="text-[10px] font-semibold text-on-surface-variant">Combo</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => eliminarProfesion(prof.id)}
                          className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          {prof.is_combo ? 'Nombre del combo' : 'Profesión / Cargo'}
                        </label>
                        <input
                          type="text"
                          value={prof.name}
                          onChange={e => actualizarProfesion(prof.id, 'name', e.target.value)}
                          placeholder={prof.is_combo ? 'ej: Acceso Completo' : 'ej: Profesional Universitario'}
                          className={INPUT_CLS}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          Precio (COP)
                        </label>
                        <input
                          type="number"
                          value={prof.price}
                          onChange={e => actualizarProfesion(prof.id, 'price', parseInt(e.target.value || '0', 10))}
                          placeholder="50000"
                          className={INPUT_CLS}
                        />
                      </div>
                    </div>

                    {!prof.is_combo && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                          Nivel de preguntas asignado
                        </label>
                        <select
                          value={prof.level_id || ''}
                          onChange={e => actualizarProfesion(
                            prof.id,
                            'level_id',
                            e.target.value ? parseInt(e.target.value, 10) : null
                          )}
                          className={INPUT_CLS}
                        >
                          <option value="">— Sin asignar —</option>
                          {niveles
                            .filter(n => typeof n._id === 'number')
                            .map(nv => (
                              <option key={nv._id} value={nv._id}>
                                {nv.name || `Nivel ${nv._id}`}
                              </option>
                            ))}
                        </select>
                        <p className="text-[10px] text-on-surface-variant">
                          El usuario que compre esta versión verá las preguntas de este nivel.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                      <div className="text-sm font-extrabold text-primary">
                        ${Number(prof.price || 0).toLocaleString('es-CO')} COP
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <button
                          type="button"
                          onClick={() => actualizarProfesion(prof.id, 'is_active', !prof.is_active)}
                          className={`w-10 h-5 rounded-full relative transition-all ${prof.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${prof.is_active ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                        <span className="text-xs font-semibold text-on-surface-variant">
                          {prof.is_active ? 'Visible' : 'Oculta'}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* NIVELES */}
            {tab === 'niveles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg font-headline">Niveles de preguntas</h3>
                  <button
                    type="button"
                    onClick={agregarNivel}
                    className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Agregar nivel
                  </button>
                </div>

                <div className="p-3 bg-surface-container rounded-xl text-xs text-on-surface-variant">
                  💡 Crea un nivel por cada profesión o cargo. Las preguntas pueden ser las mismas, pero con respuestas correctas diferentes según la profesión.
                </div>

                {niveles.map((nv, i) => (
                  <NivelCard
                    key={nv._id}
                    nivel={nv}
                    idx={i}
                    onChange={datos => actualizarNivel(nv._id, datos)}
                    onDelete={() => eliminarNivel(nv._id)}
                    preguntasCount={(preguntas[nv._id] || []).length}
                  />
                ))}
              </div>
            )}

            {/* PREGUNTAS */}
            {tab === 'preguntas' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg font-headline">
                      Preguntas — {niveles.find(n => n._id === nivelActivo)?.name || 'Nivel'}
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {pregActivas.length} pregunta{pregActivas.length !== 1 ? 's' : ''} en este nivel
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={agregarPregunta}
                    className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Agregar pregunta
                  </button>
                </div>

                {pregActivas.length === 0 ? (
                  <Card className="p-10 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">quiz</span>
                    <p className="font-semibold text-sm">Sin preguntas en este nivel</p>
                    <p className="text-xs mt-1">Agrégalas manualmente o importa desde CSV</p>
                  </Card>
                ) : (
                  pregActivas.map((preg, i) => (
                    <PreguntaCard
                      key={preg._id}
                      preg={preg}
                      idx={i}
                      expandido={pregExpandida === preg._id}
                      onToggle={() => setPregExpandida(pregExpandida === preg._id ? null : preg._id)}
                      onChange={datos => actualizarPregunta(nivelActivo, preg._id, datos)}
                      onDelete={() => eliminarPregunta(nivelActivo, preg._id)}
                    />
                  ))
                )}
              </div>
            )}

            {/* MATERIAL */}
            {tab === 'material' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-bold text-lg font-headline">Material de Estudio</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {!id
                      ? 'Guarda el paquete primero para agregar material.'
                      : 'Agrega PDFs, videos y links organizados por carpetas.'}
                  </p>
                </div>

                {!id ? (
                  <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
                    <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">lock</span>
                    <p className="text-sm font-semibold">Guarda el paquete primero</p>
                  </div>
                ) : (
                  <>
                    <Card className="p-5 space-y-4">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-lg">add_circle</span>
                        Agregar nuevo recurso
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InputField label="Título" required>
                          <input
                            type="text"
                            value={nuevoMat.title}
                            onChange={e => setNuevoMat(m => ({ ...m, title: e.target.value }))}
                            placeholder="ej: Guía de Control Fiscal"
                            className={INPUT_CLS}
                          />
                        </InputField>

                        <InputField label="Tipo">
                          <select
                            value={nuevoMat.type}
                            onChange={e => setNuevoMat(m => ({ ...m, type: e.target.value }))}
                            className={INPUT_CLS}
                          >
                            <option value="pdf">📄 PDF</option>
                            <option value="video">🎥 Video (YouTube)</option>
                            <option value="link">🔗 Link externo</option>
                            <option value="doc">📝 Documento</option>
                          </select>
                        </InputField>

                        <InputField label="Carpeta" hint="Para organizar el material">
                          <input
                            type="text"
                            value={nuevoMat.folder}
                            onChange={e => setNuevoMat(m => ({ ...m, folder: e.target.value }))}
                            placeholder="ej: Módulo 1, Videos, Guías..."
                            className={INPUT_CLS}
                            list="carpetas-existentes"
                          />
                          <datalist id="carpetas-existentes">
                            {carpetas.map(c => <option key={c} value={c} />)}
                          </datalist>
                        </InputField>

                        <InputField label="URL / Link" required>
                          <input
                            type="url"
                            value={nuevoMat.url}
                            onChange={e => setNuevoMat(m => ({ ...m, url: e.target.value }))}
                            placeholder="https://..."
                            className={INPUT_CLS}
                          />
                        </InputField>
                      </div>

                      <InputField label="Descripción" hint="Opcional">
                        <input
                          type="text"
                          value={nuevoMat.description}
                          onChange={e => setNuevoMat(m => ({ ...m, description: e.target.value }))}
                          placeholder="Breve descripción del contenido..."
                          className={INPUT_CLS}
                        />
                      </InputField>

                      <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                        <div>
                          <p className="text-sm font-bold">Material compartido</p>
                          <p className="text-xs text-on-surface-variant">
                            Si está activo, este material será visible para todas las versiones del paquete.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNuevoMat(m => ({ ...m, is_shared: !m.is_shared }))}
                          className={`w-12 h-6 rounded-full transition-all relative ${nuevoMat.is_shared ? 'bg-secondary' : 'bg-outline-variant'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nuevoMat.is_shared ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={agregarMaterial}
                        disabled={guardandoMat || !nuevoMat.title.trim() || !nuevoMat.url.trim()}
                        className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-secondary/90 transition-all flex items-center justify-center gap-2"
                      >
                        {guardandoMat
                          ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <span className="material-symbols-outlined text-sm">add</span>}
                        {guardandoMat ? 'Guardando...' : 'Agregar recurso'}
                      </button>
                    </Card>

                    {materiales.length === 0 ? (
                      <div className="p-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">
                        <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">folder_open</span>
                        <p className="font-semibold text-sm">Sin material agregado</p>
                        <p className="text-xs mt-1">Usa el formulario de arriba para agregar recursos</p>
                      </div>
                    ) : (
                      carpetas.map(carpeta => (
                        <div key={carpeta}>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                              folder
                            </span>
                            <h4 className="font-extrabold text-sm uppercase tracking-widest text-primary">
                              {carpeta}
                            </h4>
                            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                              {materiales.filter(m => m.folder === carpeta).length}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {materiales
                              .filter(m => m.folder === carpeta)
                              .map(m => (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15"
                                >
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    m.type === 'pdf'
                                      ? 'bg-red-50 text-red-500'
                                      : m.type === 'video'
                                      ? 'bg-blue-50 text-blue-600'
                                      : m.type === 'link'
                                      ? 'bg-primary/10 text-primary'
                                      : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    <span
                                      className="material-symbols-outlined text-xl"
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      {iconoMaterial(m.type)}
                                    </span>
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm truncate">{m.title}</p>
                                      {m.is_shared && (
                                        <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">
                                          Compartido
                                        </span>
                                      )}
                                    </div>
                                    {m.description && (
                                      <p className="text-xs text-on-surface-variant truncate">{m.description}</p>
                                    )}
                                    <a
                                      href={m.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[10px] text-primary hover:underline truncate block"
                                    >
                                      {m.url}
                                    </a>
                                    {m.created_at && (
                                      <p className="text-[10px] text-on-surface-variant mt-1">
                                        Agregado {tiempoRelativo(m.created_at)}
                                      </p>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => eliminarMaterial(m.id)}
                                    className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors flex-shrink-0"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}
              </div>
            )}

            {/* IMPORTAR */}
            {tab === 'importar' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-lg font-headline mb-1">Importar preguntas desde CSV</h3>
                  <p className="text-sm text-on-surface-variant">
                    Nivel activo:{' '}
                    <span className="font-bold text-primary">
                      {niveles.find(n => n._id === nivelActivo)?.name || 'sin nombre'}
                    </span>
                  </p>
                </div>

                <div className="bg-surface-container rounded-xl p-5 space-y-4">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">
                    Flujo recomendado
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-surface-container-high rounded-xl">
                      <p className="text-xs font-bold text-primary mb-2">1. Crea los niveles</p>
                      <p className="text-xs text-on-surface-variant">
                        Crea un nivel por profesión o cargo antes de importar preguntas.
                      </p>
                    </div>

                    <div className="p-4 bg-surface-container-high rounded-xl">
                      <p className="text-xs font-bold text-primary mb-2">2. Selecciona el nivel activo</p>
                      <p className="text-xs text-on-surface-variant">
                        El CSV que subas se agregará al nivel activo actual.
                      </p>
                    </div>

                    <div className="p-4 bg-surface-container-high rounded-xl">
                      <p className="text-xs font-bold text-primary mb-2">3. Descarga la plantilla</p>
                      <p className="text-xs text-on-surface-variant">
                        Usa siempre la misma estructura para evitar errores al importar.
                      </p>
                    </div>

                    <div className="p-4 bg-surface-container-high rounded-xl">
                      <p className="text-xs font-bold text-primary mb-2">4. Si usas IA, pásale el prompt</p>
                      <p className="text-xs text-on-surface-variant">
                        Puedes convertir PDFs o bases manuales a CSV más rápido usando el prompt de abajo.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container rounded-xl p-4 overflow-x-auto">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Columnas obligatorias
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {CSV_COLUMNS.map(col => (
                      <span
                        key={col}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                          ['enunciado', 'A', 'B', 'C', 'D', 'correcta'].includes(col)
                            ? 'bg-primary-fixed text-primary'
                            : 'bg-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-surface-container rounded-xl p-4 overflow-x-auto">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Ejemplo de fila válida
                  </p>
                  <code className="text-[11px] text-primary whitespace-nowrap">
                    Derecho Fiscal,medio,¿Cuál es el órgano de control fiscal en Colombia?,Procuraduría,Contraloría,Fiscalía,Defensoría,B,La Contraloría ejerce vigilancia fiscal según el Art. 267.
                  </code>
                </div>

                <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">
                      Prompt para IA
                    </p>
                    <button
                      type="button"
                      onClick={copiarPromptIA}
                      className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold"
                    >
                      Copiar prompt
                    </button>
                  </div>

                  <textarea
                    readOnly
                    value={PROMPT_IA_CSV}
                    rows={10}
                    className={`${INPUT_CLS} resize-none text-[11px]`}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copiarInstruccionesExcel}
                    className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors"
                  >
                    Copiar instrucciones para Excel / Sheets
                  </button>

                  <button
                    type="button"
                    onClick={descargarPlantilla}
                    className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors"
                  >
                    Descargar plantilla CSV
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                    importando ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary bg-surface-container-low/50'
                  }`}>
                    <span className={`material-symbols-outlined text-3xl mb-2 ${
                      importando ? 'text-primary animate-bounce' : 'text-on-surface-variant'
                    }`}>
                      cloud_upload
                    </span>
                    <p className="text-sm font-bold">
                      {importando ? 'Importando...' : 'Haz clic o arrastra tu CSV'}
                    </p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      El archivo se agregará al nivel activo
                    </p>
                    <input
                      ref={csvRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={importarCSV}
                    />
                  </label>

                  <div className="border rounded-xl p-6 flex flex-col justify-center gap-2 border-outline-variant bg-surface-container-low/40">
                    <p className="text-sm font-bold">Recomendación práctica</p>
                    <p className="text-xs text-on-surface-variant">
                      Si tu primo tiene PDFs o módulos largos, puede usar el prompt del panel para pedirle a la IA que convierta todo al formato exacto del CSV.
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Luego solo pega el resultado en Excel, guarda como CSV UTF-8 y lo sube aquí.
                    </p>
                  </div>
                </div>

                {importError && (
                  <div className="p-4 bg-error-container rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-on-error-container text-lg">error</span>
                    <p className="text-sm text-on-error-container font-medium">{importError}</p>
                  </div>
                )}

                {importOk && (
                  <div className="p-4 bg-secondary-container/30 rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
                    <p className="text-sm text-secondary font-medium">{importOk}</p>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}