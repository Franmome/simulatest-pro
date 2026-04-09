import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function InputField({ label, required, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
        {label}{required && <span className="text-error ml-1">*</span>}
      </label>
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

const INPUT_CLS = `w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30
  rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20
  focus:border-primary/40 transition-all placeholder:text-on-surface-variant/50`

const LETRAS = ['A', 'B', 'C', 'D']

function preguntaVacia() {
  return {
    _id:        Math.random().toString(36).slice(2),
    text:       '',
    explanation:'',
    difficulty: 'medio',
    area:       '',
    options: LETRAS.map(l => ({ letter: l, text: '', is_correct: false })),
  }
}

// ─── Componente pregunta individual ──────────────────────────────────────────

function PreguntaCard({ preg, idx, onChange, onDelete, expandido, onToggle }) {
  const tieneCorrecta = preg.options.some(o => o.is_correct)

  function setOpcion(i, field, value) {
    const opts = [...preg.options]
    if (field === 'is_correct') {
      opts.forEach((o, j) => { opts[j] = { ...o, is_correct: j === i } })
    } else {
      opts[i] = { ...opts[i], [field]: value }
    }
    onChange({ ...preg, options: opts })
  }

  return (
    <div className={`rounded-xl border transition-all ${
      tieneCorrecta ? 'border-outline-variant/20' : 'border-error/30 bg-error-container/5'
    }`}>
      {/* Header de la pregunta */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
          ${tieneCorrecta ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`}>
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

      {/* Cuerpo expandible */}
      {expandido && (
        <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-4">
          {/* Enunciado */}
          <InputField label="Enunciado">
            <textarea
              rows={3}
              value={preg.text}
              onChange={e => onChange({ ...preg, text: e.target.value })}
              placeholder="Escribe la pregunta aquí..."
              className={`${INPUT_CLS} resize-none`}
            />
          </InputField>

          {/* Área y dificultad */}
          <div className="grid grid-cols-2 gap-3">
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

          {/* Opciones */}
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Opciones — marca la correcta
            </p>
            {preg.options.map((op, i) => (
              <div key={op.letter} className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpcion(i, 'is_correct', true)}
                  className={`w-8 h-8 rounded-full flex-shrink-0 font-bold text-sm transition-all
                    ${op.is_correct
                      ? 'bg-secondary text-on-secondary shadow-md'
                      : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container'}`}
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
                  <span className="material-symbols-outlined text-secondary text-lg flex-shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
              </div>
            ))}
          </div>

          {/* Explicación */}
          <InputField label="Explicación (retroalimentación)">
            <textarea
              rows={2}
              value={preg.explanation}
              onChange={e => onChange({ ...preg, explanation: e.target.value })}
              placeholder="Explica por qué la respuesta es correcta..."
              className={`${INPUT_CLS} resize-none`}
            />
          </InputField>

          {/* Eliminar */}
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

// ─── Componente nivel individual ──────────────────────────────────────────────

function NivelCard({ nivel, idx, onChange, onDelete, preguntasCount }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
          {idx + 1}
        </div>
        <h4 className="font-bold text-sm flex-1">
          {nivel.name || `Nivel ${idx + 1}`}
        </h4>
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
            placeholder="Descripción breve del nivel"
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

// ─── Formulario principal ─────────────────────────────────────────────────────

export default function EvaluacionForm() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const csvRef       = useRef(null)
  const isEdit       = Boolean(id)

  // ── Datos generales ──
  const [form, setForm] = useState({
    title: '', description: '', category_id: '', is_active: true,
  })
  const [categorias,  setCategorias]  = useState([])
  const [guardando,   setGuardando]   = useState(false)
  const [error,       setError]       = useState(null)
  const [exito,       setExito]       = useState(false)
  const [tab,         setTab]         = useState('general') // general | niveles | preguntas | importar | profesiones

  // ── Niveles ──
  const [niveles, setNiveles] = useState([{
    _id: 'n1', name: '', description: '', time_limit: 90, passing_score: 70, sort_order: 1,
  }])
  const [nivelActivo, setNivelActivo] = useState('n1')

  // ── Preguntas (por nivel) ──
  const [preguntas, setPreguntas] = useState({ n1: [preguntaVacia()] })
  const [pregExpandida, setPregExpandida] = useState(null)

  // ── Importación CSV ──
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState(null)

  // ── Profesiones ──
  const [profesiones, setProfesiones] = useState([])
  const [loadingProfs, setLoadingProfs] = useState(false)

  useEffect(() => {
    cargarCategorias()
    if (isEdit) {
      cargarEvaluacion()
      cargarProfesiones()
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
    if (ev) setForm({ title: ev.title, description: ev.description || '', category_id: ev.category_id || '', is_active: ev.is_active })

    const { data: lvs } = await supabase
      .from('levels')
      .select('*')
      .eq('evaluation_id', id)
      .order('sort_order')

    if (lvs?.length) {
      const nivelesConId = lvs.map(l => ({ ...l, _id: l.id }))
      setNiveles(nivelesConId)
      setNivelActivo(nivelesConId[0]._id)

      // Cargar preguntas por nivel
      const pregsPorNivel = {}
      await Promise.all(nivelesConId.map(async nv => {
        const { data: qs } = await supabase
          .from('questions')
          .select('*, options(*)')
          .eq('level_id', nv.id)
          .order('id')

        pregsPorNivel[nv._id] = qs?.map(q => ({
          ...q,
          _id: q.id,
          options: LETRAS.map(l => {
            const op = q.options?.find(o => o.letter === l)
            return op ? { ...op } : { letter: l, text: '', is_correct: false }
          }),
        })) || [preguntaVacia()]
      }))
      setPreguntas(pregsPorNivel)
    }
  }

  // ─── Profesiones ──────────────────────────────────────────────────────────
  async function cargarProfesiones() {
    if (!id) return
    const { data } = await supabase
      .from('professions')
      .select('*')
      .eq('evaluation_id', id)
      .order('created_at')
    setProfesiones(data || [])
  }

  async function agregarProfesion() {
    if (!id) return
    const { data } = await supabase
      .from('professions')
      .insert({ evaluation_id: parseInt(id), name: 'Nueva profesión', price: 0, is_active: true })
      .select().single()
    if (data) setProfesiones(prev => [...prev, data])
  }

  async function actualizarProfesion(profId, campo, valor) {
    setProfesiones(prev => prev.map(p => p.id === profId ? { ...p, [campo]: valor } : p))
    await supabase.from('professions').update({ [campo]: valor }).eq('id', profId)
  }

  async function eliminarProfesion(profId) {
    if (!confirm('¿Eliminar esta profesión?')) return
    await supabase.from('professions').delete().eq('id', profId)
    setProfesiones(prev => prev.filter(p => p.id !== profId))
  }

  // ─── Gestión de niveles ───────────────────────────────────────────────────

  function agregarNivel() {
    const _id = Math.random().toString(36).slice(2)
    const nuevo = { _id, name: '', description: '', time_limit: 90, passing_score: 70, sort_order: niveles.length + 1 }
    setNiveles(prev => [...prev, nuevo])
    setPreguntas(prev => ({ ...prev, [_id]: [preguntaVacia()] }))
    setNivelActivo(_id)
    setTab('niveles')
  }

  function actualizarNivel(_id, datos) {
    setNiveles(prev => prev.map(n => n._id === _id ? { ...n, ...datos } : n))
  }

  function eliminarNivel(_id) {
    if (niveles.length === 1) return
    setNiveles(prev => prev.filter(n => n._id !== _id))
    setPreguntas(prev => { const copia = { ...prev }; delete copia[_id]; return copia })
    setNivelActivo(niveles.find(n => n._id !== _id)?._id)
  }

  // ─── Gestión de preguntas ─────────────────────────────────────────────────

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
      [nId]: prev[nId].map(p => p._id === pregId ? { ...p, ...datos } : p),
    }))
  }

  function eliminarPregunta(nId, pregId) {
    setPreguntas(prev => ({
      ...prev,
      [nId]: prev[nId].filter(p => p._id !== pregId),
    }))
  }

  // ─── Importación CSV ──────────────────────────────────────────────────────
  // Formato: area,dificultad,enunciado,A,B,C,D,correcta,explicacion

  function importarCSV(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportando(true)
    setImportError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const lines  = ev.target.result.split('\n').filter(Boolean)
        const header = lines[0].split(',').map(h => h.trim().toLowerCase())
        const reqs   = ['enunciado', 'a', 'b', 'c', 'd', 'correcta']
        const missing = reqs.filter(r => !header.includes(r))
        if (missing.length) throw new Error(`Faltan columnas: ${missing.join(', ')}`)

        const nuevas = lines.slice(1).map((line, i) => {
          const cols  = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
          const get   = (key) => cols[header.indexOf(key)] || ''
          const correctaLetra = get('correcta').toUpperCase()

          if (!correctaLetra || !LETRAS.includes(correctaLetra)) {
            throw new Error(`Fila ${i + 2}: la columna "correcta" debe ser A, B, C o D`)
          }

          return {
            _id:        Math.random().toString(36).slice(2),
            text:       get('enunciado'),
            explanation:get('explicacion'),
            difficulty: get('dificultad') || 'medio',
            area:       get('area'),
            options: LETRAS.map(l => ({
              letter:     l,
              text:       get(l.toLowerCase()),
              is_correct: l === correctaLetra,
            })),
          }
        })

        setPreguntas(prev => ({
          ...prev,
          [nivelActivo]: [...(prev[nivelActivo] || []), ...nuevas],
        }))
        setImportando(false)
        if (csvRef.current) csvRef.current.value = ''
      } catch (err) {
        setImportError(err.message)
        setImportando(false)
      }
    }
    reader.readAsText(file)
  }

  function descargarPlantilla() {
    const csv = 'area,dificultad,enunciado,A,B,C,D,correcta,explicacion\n' +
      'Derecho Fiscal,medio,¿Cuál es el órgano de control fiscal en Colombia?,Procuraduría,Contraloría,Fiscalía,Defensoría,B,La Contraloría ejerce vigilancia fiscal según el Art. 267.\n'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'plantilla_preguntas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Guardar todo ─────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    setError(null)

    try {
      // 1. Validar
      if (!form.title.trim()) throw new Error('El título es obligatorio')
      if (niveles.some(n => !n.name.trim())) throw new Error('Todos los niveles deben tener nombre')

      // 2. Guardar evaluación
      let evalId = id
      if (isEdit) {
        const { error: e1 } = await supabase.from('evaluations').update({
          title:       form.title,
          description: form.description,
          category_id: form.category_id || null,
          is_active:   form.is_active,
        }).eq('id', id)
        if (e1) throw e1
      } else {
        const { data: ev, error: e1 } = await supabase.from('evaluations').insert({
          title:       form.title,
          description: form.description,
          category_id: form.category_id || null,
          is_active:   form.is_active,
        }).select('id').single()
        if (e1) throw e1
        evalId = ev.id
      }

      // 3. Guardar niveles y sus preguntas
      for (const [idx, nv] of niveles.entries()) {
        let levelId = typeof nv._id === 'string' && nv._id.length > 10 ? nv._id : null

        if (isEdit && levelId) {
          // Actualizar nivel existente
          await supabase.from('levels').update({
            name:          nv.name,
            description:   nv.description,
            time_limit:    nv.time_limit,
            passing_score: nv.passing_score,
            sort_order:    idx + 1,
          }).eq('id', levelId)
        } else {
          // Crear nivel nuevo
          const { data: lv, error: e2 } = await supabase.from('levels').insert({
            evaluation_id: evalId,
            name:          nv.name,
            description:   nv.description,
            time_limit:    nv.time_limit,
            passing_score: nv.passing_score,
            sort_order:    idx + 1,
          }).select('id').single()
          if (e2) throw e2
          levelId = lv.id
        }

        // 4. Guardar preguntas del nivel
        const pregsDelNivel = preguntas[nv._id] || []
        for (const preg of pregsDelNivel) {
          const pregExiste = isEdit && typeof preg._id === 'string' && preg._id.length > 10

          let qId = preg._id
          if (pregExiste) {
            await supabase.from('questions').update({
              text:        preg.text,
              explanation: preg.explanation,
              difficulty:  preg.difficulty,
              area:        preg.area,
            }).eq('id', qId)
            // Actualizar opciones
            for (const op of preg.options) {
              if (op.id) {
                await supabase.from('options').update({
                  text:       op.text,
                  is_correct: op.is_correct,
                }).eq('id', op.id)
              }
            }
          } else {
            const { data: q, error: e3 } = await supabase.from('questions').insert({
              level_id:    levelId,
              text:        preg.text,
              explanation: preg.explanation,
              question_type: 'multiple',
              difficulty:  preg.difficulty,
              area:        preg.area,
            }).select('id').single()
            if (e3) throw e3
            qId = q.id

            // Insertar opciones
            const { error: e4 } = await supabase.from('options').insert(
              preg.options.map(op => ({
                question_id: qId,
                text:        op.text,
                letter:      op.letter,
                is_correct:  op.is_correct,
              }))
            )
            if (e4) throw e4
          }
        }
      }

      // 5. Guardar profesiones (si estamos editando, se guardan por separado, pero el insert/update ya se hizo en tiempo real)
      // Las profesiones ya se crean/actualizan/eliminan en tiempo real, no es necesario guardarlas aquí.

      setExito(true)
      setTimeout(() => navigate('/admin/evaluaciones'), 1200)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Error al guardar. Revisa los campos.')
    } finally {
      setGuardando(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const pregActivas = preguntas[nivelActivo] || []
  const totalPregs  = Object.values(preguntas).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="min-h-screen bg-background">

      {/* ── TopBar ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-8 h-16
                         bg-surface-container-lowest/80 backdrop-blur-xl
                         border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate('/admin/evaluaciones')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant
                       hover:bg-surface-container transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Volver
          </button>
          <div className="h-5 w-px bg-outline-variant/30" />
          <h1 className="font-headline font-extrabold text-lg text-primary">
            {isEdit ? 'Editar Evaluación' : 'Nueva Evaluación'}
          </h1>
          <div className="hidden md:flex items-center gap-3 ml-4">
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
              {niveles.length} nivel{niveles.length !== 1 ? 'es' : ''}
            </span>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
              {totalPregs} pregunta{totalPregs !== 1 ? 's' : ''}
            </span>
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
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full
                       font-bold text-sm shadow-lg hover:-translate-y-0.5 active:scale-95
                       transition-all disabled:opacity-60"
          >
            {guardando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {exito
              ? <><span className="material-symbols-outlined text-sm">check</span>¡Guardado!</>
              : guardando ? 'Guardando...' : isEdit ? 'Actualizar' : 'Publicar evaluación'
            }
          </button>
        </div>
      </header>

      <form id="eval-form" onSubmit={handleSubmit}>
        <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Columna izquierda — sidebar de configuración ── */}
          <div className="space-y-6">

            {/* Tabs de sección */}
            <div className="flex flex-col gap-1">
              {[
                { key: 'general',   icon: 'info',      label: 'General'   },
                { key: 'niveles',   icon: 'layers',    label: 'Niveles'   },
                { key: 'preguntas', icon: 'quiz',      label: 'Preguntas' },
                { key: 'importar',  icon: 'upload_file', label: 'Importar CSV' },
                { key: 'profesiones', icon: 'people', label: 'Profesiones' }, // ✅ nuevo
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left
                    ${tab === t.key
                      ? 'bg-primary/10 text-primary'
                      : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <span className="material-symbols-outlined text-lg">{t.icon}</span>
                  {t.label}
                  {t.key === 'preguntas' && totalPregs > 0 && (
                    <span className="ml-auto text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full">
                      {totalPregs}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Selector de nivel activo (visible en preguntas) */}
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
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${nivelActivo === nv._id
                          ? 'bg-primary text-on-primary'
                          : 'text-on-surface-variant hover:bg-surface-container'}`}
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

            {/* Error global */}
            {error && (
              <div className="p-4 bg-error-container rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-on-error-container text-lg flex-shrink-0">error</span>
                <p className="text-sm text-on-error-container font-medium">{error}</p>
              </div>
            )}
          </div>

          {/* ── Columna principal ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* ═══ TAB GENERAL ═══ */}
            {tab === 'general' && (
              <Card className="p-6 space-y-5">
                <h3 className="font-bold text-lg font-headline">Información general</h3>

                <InputField label="Título de la evaluación" required>
                  <input
                    type="text"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="ej: Contraloría General de la República"
                    className={INPUT_CLS}
                    required
                  />
                </InputField>

                <InputField label="Descripción">
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Describe qué cubre esta evaluación..."
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
                    <p className="text-sm font-bold">Publicar evaluación</p>
                    <p className="text-xs text-on-surface-variant">Visible para los usuarios del catálogo</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`w-12 h-6 rounded-full transition-all relative ${form.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all
                      ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
              </Card>
            )}

            {/* ═══ TAB NIVELES ═══ */}
            {tab === 'niveles' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg font-headline">Niveles de la evaluación</h3>
                  <button
                    type="button"
                    onClick={agregarNivel}
                    className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    Agregar nivel
                  </button>
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

            {/* ═══ TAB PREGUNTAS ═══ */}
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
                    <p className="text-xs mt-1">Agrégalas manualmente o importa un CSV</p>
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

            {/* ═══ TAB IMPORTAR ═══ */}
            {tab === 'importar' && (
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="font-bold text-lg font-headline mb-1">Importar preguntas desde CSV</h3>
                  <p className="text-sm text-on-surface-variant">
                    Sube un archivo CSV con el formato correcto. Las preguntas se agregarán al nivel activo:
                    <span className="font-bold text-primary ml-1">
                      {niveles.find(n => n._id === nivelActivo)?.name || 'sin nombre'}
                    </span>
                  </p>
                </div>

                {/* Formato requerido */}
                <div className="bg-surface-container rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Columnas requeridas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['area','dificultad','enunciado','A','B','C','D','correcta','explicacion'].map(col => (
                      <span key={col} className={`px-2 py-1 rounded-lg text-xs font-bold
                        ${['enunciado','A','B','C','D','correcta'].includes(col)
                          ? 'bg-primary-fixed text-primary'
                          : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {col}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-2">
                    En azul las obligatorias. "correcta" debe ser A, B, C o D.
                  </p>
                </div>

                {/* Ejemplo */}
                <div className="bg-surface-container rounded-xl p-4 overflow-x-auto">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    Ejemplo de fila
                  </p>
                  <code className="text-[11px] text-primary whitespace-nowrap">
                    Derecho Fiscal,medio,¿Cuál es el órgano de control fiscal?,Procuraduría,Contraloría,Fiscalía,Defensoría,B,La Contraloría...
                  </code>
                </div>

                {/* Error de importación */}
                {importError && (
                  <div className="p-4 bg-error-container rounded-xl flex items-start gap-3">
                    <span className="material-symbols-outlined text-on-error-container text-lg flex-shrink-0">error</span>
                    <p className="text-sm text-on-error-container font-medium">{importError}</p>
                  </div>
                )}

                {/* Upload */}
                <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center
                                   justify-center text-center cursor-pointer transition-colors
                                   ${importando
                                     ? 'border-primary bg-primary/5'
                                     : 'border-outline-variant hover:border-primary bg-surface-container-low/50'}`}>
                  <span className={`material-symbols-outlined text-4xl mb-3
                    ${importando ? 'text-primary animate-bounce' : 'text-on-surface-variant'}`}>
                    cloud_upload
                  </span>
                  <p className="font-bold text-sm">
                    {importando ? 'Procesando...' : 'Haz clic o arrastra tu CSV aquí'}
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">Solo archivos .csv</p>
                  <input
                    ref={csvRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={importarCSV}
                  />
                </label>

                <button
                  type="button"
                  onClick={descargarPlantilla}
                  className="w-full flex items-center justify-center gap-2 py-3 border border-outline-variant
                             rounded-xl text-sm font-bold text-on-surface-variant
                             hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">download</span>
                  Descargar plantilla CSV de ejemplo
                </button>
              </Card>
            )}

            {/* ═══ TAB PROFESIONES ═══ */}
            {tab === 'profesiones' && (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg font-headline">Profesiones y Precios</h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {!id ? 'Primero publica la evaluación para agregar profesiones.' : 'Define las profesiones disponibles y su precio.'}
                    </p>
                  </div>
                  {id && (
                    <button type="button" onClick={agregarProfesion}
                      className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Agregar profesión
                    </button>
                  )}
                </div>

                {!id && (
                  <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
                    <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">lock</span>
                    <p className="text-sm font-semibold">Publica la evaluación primero</p>
                  </div>
                )}

                {id && profesiones.length === 0 && (
                  <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
                    <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">people</span>
                    <p className="text-sm font-semibold">Sin profesiones creadas</p>
                  </div>
                )}

                {id && profesiones.map(prof => (
                  <div key={prof.id} className="bg-surface-container rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                        <input
                          type="text"
                          value={prof.name}
                          onChange={e => actualizarProfesion(prof.id, 'name', e.target.value)}
                          className={INPUT_CLS}
                          placeholder="ej: Profesional Universitario"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Precio (COP)</label>
                        <input
                          type="number"
                          value={prof.price}
                          onChange={e => actualizarProfesion(prof.id, 'price', parseInt(e.target.value))}
                          className={INPUT_CLS}
                          placeholder="25000"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <button
                          type="button"
                          onClick={() => actualizarProfesion(prof.id, 'is_active', !prof.is_active)}
                          className={`w-10 h-5 rounded-full relative transition-all ${prof.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${prof.is_active ? 'right-0.5' : 'left-0.5'}`} />
                        </button>
                        <span className="text-xs font-semibold text-on-surface-variant">
                          {prof.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => eliminarProfesion(prof.id)}
                        className="flex items-center gap-1 text-xs font-bold text-error hover:bg-error-container/30 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}