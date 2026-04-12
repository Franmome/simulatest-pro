// frontend/src/pages/admin/EvaluacionForm.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// ============================================================================
// COMPONENTES AUXILIARES
// ============================================================================

/** Sistema de Toast con cola para evitar solapamientos */
const ToastContext = React.createContext(null)

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((tipo, mensaje, duracion = 5000) => {
    const id = Date.now() + Math.random().toString(36)
    setToasts(prev => [...prev, { id, tipo, mensaje }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, duracion)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-20 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem tipo={toast.tipo} mensaje={toast.mensaje} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ tipo, mensaje, onClose }) {
  const bg = {
    error: 'bg-error-container border-error text-on-error-container',
    warning: 'bg-tertiary-container border-tertiary text-on-tertiary-container',
    success: 'bg-secondary-container border-secondary text-on-secondary-container',
    info: 'bg-primary-container border-primary text-on-primary-container',
  }[tipo] || 'bg-surface-container border-outline text-on-surface'

  const icono = {
    error: 'error',
    warning: 'warning',
    success: 'check_circle',
    info: 'info',
  }[tipo] || 'info'

  return (
    <div className={`p-4 rounded-xl border shadow-lg flex items-start gap-3 animate-fade-in-up ${bg}`}>
      <span className="material-symbols-outlined">{icono}</span>
      <p className="text-sm flex-1">{mensaje}</p>
      {onClose && (
        <button onClick={onClose} className="text-current opacity-70 hover:opacity-100">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      )}
    </div>
  )
}

const useToast = () => {
  const context = React.useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context.addToast
}

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

function ChecklistPublicacion({ form, versiones, niveles, preguntas, materiales, modoGuiado }) {
  const versionesActivas = versiones.filter(v => v.is_active)
  const tieneNombre = Boolean(form.title?.trim())
  const tieneVersionesActivas = versionesActivas.length > 0
  const todasVersionesConPrecio = versionesActivas.every(v => v.price && v.price > 0)
  const todasVersionesConNivel = versionesActivas.every(v => v.level_id)
  const nivelesConPreguntasValidas = niveles.every(nv => {
    const pregs = preguntas[nv._id] || []
    return pregs.length > 0 && pregs.some(p => p.text?.trim())
  })
  const tieneMateriales = materiales.length > 0
  const categoriaAsignada = Boolean(form.category_id)

  const items = [
    { label: modoGuiado ? 'Nombre del plan' : 'Nombre del paquete', ok: tieneNombre },
    { label: modoGuiado ? 'Al menos un plan activo' : 'Al menos una versión activa', ok: tieneVersionesActivas },
    { label: modoGuiado ? 'Precio válido en todos los planes' : 'Precio válido en todas las versiones', ok: todasVersionesConPrecio },
    { label: modoGuiado ? 'Banco de preguntas asignado a cada plan' : 'Nivel asignado a cada versión activa', ok: todasVersionesConNivel },
    { label: 'Preguntas válidas en todos los bancos', ok: nivelesConPreguntasValidas },
    { label: modoGuiado ? 'Recursos de apoyo (opcional)' : 'Material de estudio (opcional)', ok: tieneMateriales, optional: true },
    { label: 'Categoría asignada (recomendado)', ok: categoriaAsignada, optional: true },
  ]

  const completados = items.filter(i => i.ok).length
  const total = items.length

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm">✅ Checklist para publicar</h4>
        <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
          {completados}/{total}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className={`material-symbols-outlined text-base ${item.ok ? 'text-secondary' : 'text-error'}`}>
              {item.ok ? 'check_circle' : 'cancel'}
            </span>
            <span className={item.ok ? 'text-on-surface' : 'text-on-surface-variant'}>
              {item.label}
              {item.optional && <span className="text-[10px] ml-1 text-on-surface-variant">(opcional)</span>}
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

// ============================================================================
// CONSTANTES Y HELPERS
// ============================================================================
const INPUT_CLS = `w-full px-4 py-2.5 bg-surface-container border border-outline-variant/30
  rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20
  focus:border-primary/40 transition-all placeholder:text-on-surface-variant/50`

const LETRAS = ['A', 'B', 'C', 'D']
const CSV_COLUMNS = ['area', 'dificultad', 'enunciado', 'A', 'B', 'C', 'D', 'correcta', 'explicacion']

const PROMPT_IA_CSV = `Convierte este material en preguntas para un archivo CSV con esta estructura exacta:
area,dificultad,enunciado,A,B,C,D,correcta,explicacion

Reglas:
- "correcta" solo puede ser A, B, C o D
- no cambies el orden de las columnas
- no agregues columnas extra
- cada fila debe representar una sola pregunta
- "dificultad" debe ser: facil, medio o dificil
- "explicacion" debe ser breve, clara y útil para retroalimentación
- devuelve únicamente el CSV limpio, sin markdown, sin comentarios y sin explicación adicional`

function preguntaVacia() {
  return {
    _id: Math.random().toString(36).slice(2),
    text: '',
    explanation: '',
    difficulty: 'medio',
    area: '',
    options: LETRAS.map(letter => ({ letter, text: '', is_correct: false })),
  }
}

function iconoMaterial(type) {
  return { pdf: 'picture_as_pdf', video: 'play_circle', link: 'link', doc: 'description' }[type] || 'attachment'
}

// ============================================================================
// COMPONENTES INTERNOS (PreguntaCard, NivelCard)
// ============================================================================
function PreguntaCard({ preg, idx, onChange, onDelete, expandido, onToggle, modoGuiado }) {
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
    <div className={`rounded-xl border transition-all ${tieneCorrecta ? 'border-outline-variant/20' : 'border-error/30 bg-error-container/5'}`}>
      <button type="button" onClick={onToggle} className="w-full flex items-center gap-3 p-4 text-left">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${tieneCorrecta ? 'bg-secondary text-on-secondary' : 'bg-error text-on-error'}`}>
          {idx + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-on-surface">
            {preg.text || <span className="text-on-surface-variant italic">Pregunta sin enunciado</span>}
          </p>
          {preg.area && (
            <p className="text-[10px] text-on-surface-variant truncate">
              {modoGuiado ? 'Módulo' : 'Área'}: {preg.area}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!tieneCorrecta && (
            <span className="text-[10px] font-bold text-error bg-error-container px-2 py-0.5 rounded-full">Sin correcta</span>
          )}
          <span className="material-symbols-outlined text-on-surface-variant text-lg">
            {expandido ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      {expandido && (
        <div className="px-4 pb-4 space-y-4 border-t border-outline-variant/10 pt-4">
          <InputField label="Enunciado" required>
            <textarea rows={3} value={preg.text} onChange={e => onChange({ ...preg, text: e.target.value })}
              placeholder="Escribe la pregunta aquí..." className={`${INPUT_CLS} resize-none`} />
          </InputField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InputField label={modoGuiado ? "Módulo / área" : "Área temática"}>
              <input type="text" value={preg.area} onChange={e => onChange({ ...preg, area: e.target.value })}
                placeholder={modoGuiado ? "ej: Derecho Fiscal" : "ej: Derecho Fiscal"} className={INPUT_CLS} />
            </InputField>
            <InputField label="Dificultad">
              <select value={preg.difficulty} onChange={e => onChange({ ...preg, difficulty: e.target.value })} className={INPUT_CLS}>
                <option value="facil">Fácil</option>
                <option value="medio">Medio</option>
                <option value="dificil">Difícil</option>
              </select>
            </InputField>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Opciones — marca la correcta</p>
            {preg.options.map((op, i) => (
              <div key={op.letter} className="flex items-center gap-3">
                <button type="button" onClick={() => setOpcion(i, 'is_correct', true)}
                  className={`w-8 h-8 rounded-full flex-shrink-0 font-bold text-sm transition-all ${op.is_correct ? 'bg-secondary text-on-secondary shadow-md' : 'bg-surface-container text-on-surface-variant hover:bg-secondary-container'}`}>
                  {op.letter}
                </button>
                <input type="text" value={op.text} onChange={e => setOpcion(i, 'text', e.target.value)}
                  placeholder={`Opción ${op.letter}`}
                  className={`${INPUT_CLS} flex-1 ${op.is_correct ? 'border-secondary/40 ring-1 ring-secondary/20' : ''}`} />
                {op.is_correct && (
                  <span className="material-symbols-outlined text-secondary text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
              </div>
            ))}
          </div>

          <InputField label="Explicación (retroalimentación)">
            <textarea rows={2} value={preg.explanation} onChange={e => onChange({ ...preg, explanation: e.target.value })}
              placeholder="Explica por qué la respuesta es correcta..." className={`${INPUT_CLS} resize-none`} />
          </InputField>

          <div className="flex justify-end">
            <button type="button" onClick={onDelete}
              className="flex items-center gap-1.5 text-xs font-bold text-error hover:bg-error-container/30 px-3 py-1.5 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-sm">delete</span>
              Eliminar pregunta
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function NivelCard({ nivel, idx, onChange, onDelete, preguntasCount, onDuplicate, modoGuiado }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{idx + 1}</div>
        <h4 className="font-bold text-sm flex-1">{nivel.name || (modoGuiado ? `Banco ${idx + 1}` : `Nivel ${idx + 1}`)}</h4>
        <span className="text-xs text-on-surface-variant">{preguntasCount} pregunta{preguntasCount !== 1 ? 's' : ''}</span>
        {idx > 0 && (
          <button type="button" onClick={onDelete} className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
        <button type="button" onClick={onDuplicate} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Duplicar">
          <span className="material-symbols-outlined text-sm">content_copy</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InputField label={modoGuiado ? "Nombre del banco" : "Nombre del nivel"} required>
          <input type="text" value={nivel.name} onChange={e => onChange({ ...nivel, name: e.target.value })}
            placeholder={modoGuiado ? "ej: Banco principal" : "ej: Profesional Universitario"} className={INPUT_CLS} />
        </InputField>
        <InputField label="Descripción">
          <input type="text" value={nivel.description} onChange={e => onChange({ ...nivel, description: e.target.value })}
            placeholder="Descripción breve" className={INPUT_CLS} />
        </InputField>
        <InputField label="Tiempo límite (minutos)" required>
          <input type="number" min={10} max={360} value={nivel.time_limit}
            onChange={e => onChange({ ...nivel, time_limit: Number(e.target.value) })} className={INPUT_CLS} />
        </InputField>
        <InputField label="Puntaje de aprobación (%)">
          <input type="number" min={50} max={100} value={nivel.passing_score}
            onChange={e => onChange({ ...nivel, passing_score: Number(e.target.value) })} className={INPUT_CLS} />
        </InputField>
      </div>
    </Card>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function EvaluacionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const csvRef = useRef(null)
  const addToast = useToast()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ title: '', description: '', category_id: '', is_active: true })
  const [categorias, setCategorias] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [guardadoStage, setGuardadoStage] = useState('')

  const [errorBloque, setErrorBloque] = useState(null)
  const [exitoMsg, setExitoMsg] = useState(null)

  const [tab, setTab] = useState('general')
  const [modoVersiones, setModoVersiones] = useState('avanzado')
  const [modoGuiado, setModoGuiado] = useState(false)

  const [niveles, setNiveles] = useState([
    { _id: 'n1', name: '', description: '', time_limit: 90, passing_score: 70, sort_order: 1 },
  ])
  const [nivelActivo, setNivelActivo] = useState('n1')
  const [preguntas, setPreguntas] = useState({ n1: [preguntaVacia()] })
  const [pregExpandida, setPregExpandida] = useState(null)

  const [versiones, setVersiones] = useState([])
  const [levelsList, setLevelsList] = useState([])
  const [materiales, setMateriales] = useState([])
  const [nuevoMat, setNuevoMat] = useState({
    title: '',
    type: 'pdf',
    source_type: 'upload',
    file: null,
    url: '',
    folder: 'General',
    description: '',
    is_shared: true,
    uploading: false,
    uploadProgress: 0
  })
  const [guardandoMat, setGuardandoMat] = useState(false)
  const [profesiones, setProfesiones] = useState([])

  const [showProfModal, setShowProfModal] = useState(false)
  const [nuevaProfesion, setNuevaProfesion] = useState('')

  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importOk, setImportOk] = useState(null)

  const [warnings, setWarnings] = useState([])

  // ==========================================================================
  // HELPERS (package_id, etc.)
  // ==========================================================================
  const obtenerPackageIdDeEvaluacion = useCallback(async () => {
    if (!id) return null
    const { data: evalVers } = await supabase
      .from('evaluation_versions')
      .select('package_version_id')
      .eq('evaluation_id', parseInt(id, 10))

    if (!evalVers?.length) return null

    const versionIds = evalVers.map(ev => ev.package_version_id)
    const { data: versionesData } = await supabase
      .from('package_versions')
      .select('package_id')
      .in('id', versionIds)

    return versionesData?.[0]?.package_id || null
  }, [id])

  // ==========================================================================
  // CARGAS INICIALES
  // ==========================================================================
  useEffect(() => {
    cargarCategorias()
    cargarProfesiones()
    cargarLevels()
    if (isEdit) {
      cargarEvaluacion()
      cargarVersiones()
      cargarMateriales()
    }
  }, [id])

  async function cargarCategorias() {
    const { data } = await supabase.from('categories').select('id, name').order('name')
    setCategorias(data || [])
  }

  async function cargarProfesiones() {
    const { data, error } = await supabase.from('professions').select('id, name').order('name')
    if (error) {
      addToast('error', 'Error al cargar profesiones: ' + error.message)
      return
    }
    setProfesiones(data || [])
  }

  async function cargarLevels() {
    const { data, error } = await supabase.from('levels').select('id, name').order('id')
    if (error) {
      addToast('error', 'Error al cargar niveles: ' + error.message)
      return
    }
    setLevelsList(data || [])
  }

  async function cargarEvaluacion() {
    const { data: ev, error } = await supabase.from('evaluations').select('*').eq('id', id).maybeSingle()
    if (error) {
      addToast('error', 'Error al cargar evaluación: ' + error.message)
      return
    }
    if (ev) setForm({ title: ev.title, description: ev.description || '', category_id: ev.category_id || '', is_active: ev.is_active })

    const { data: lvs, error: lvError } = await supabase.from('levels').select('*').eq('evaluation_id', id).order('sort_order')
    if (lvError) {
      addToast('error', 'Error al cargar niveles: ' + lvError.message)
      return
    }
    if (lvs?.length) {
      const nivelesConId = lvs.map(l => ({ ...l, _id: l.id }))
      setNiveles(nivelesConId)
      setNivelActivo(nivelesConId[0]._id)

      const pregsPorNivel = {}
      await Promise.all(nivelesConId.map(async nv => {
        const { data: qs } = await supabase.from('questions').select('*, options(*)').eq('level_id', nv.id).order('id')
        pregsPorNivel[nv._id] = qs?.map(q => ({
          ...q, _id: q.id,
          options: LETRAS.map(letter => {
            const op = q.options?.find(o => o.letter === letter)
            return op ? { ...op } : { letter, text: '', is_correct: false }
          }),
        })) || [preguntaVacia()]
      }))
      setPreguntas(pregsPorNivel)
    }
  }

  async function cargarVersiones() {
    const packageId = await obtenerPackageIdDeEvaluacion()
    if (!packageId) { setVersiones([]); return }

    const { data: vers, error } = await supabase
      .from('package_versions')
      .select('*')
      .eq('package_id', packageId)
      .order('sort_order', { ascending: true })

    if (error) {
      addToast('error', 'Error al cargar versiones: ' + error.message)
      return
    }
    if (!vers?.length) { setVersiones([]); return }

    const versionIds = vers.map(v => v.id)
    const { data: pvLevels } = await supabase
      .from('package_version_levels')
      .select('package_version_id, level_id')
      .in('package_version_id', versionIds)

    const levelMap = {}
    pvLevels?.forEach(row => { levelMap[row.package_version_id] = row.level_id })

    setVersiones(vers.map(v => ({ ...v, level_id: levelMap[v.id] || null })))
  }

  async function cargarMateriales() {
    const packageId = await obtenerPackageIdDeEvaluacion()
    if (!packageId) { setMateriales([]); return }

    const { data, error } = await supabase.from('study_materials').select('*').eq('package_id', packageId).order('folder').order('sort_order')
    if (error) {
      addToast('error', 'Error al cargar materiales: ' + error.message)
      return
    }
    setMateriales(data || [])
  }

  // ==========================================================================
  // PROFESIONES INLINE
  // ==========================================================================
  async function agregarProfesion() {
    const nombre = nuevaProfesion.trim()
    if (!nombre) {
      addToast('warning', 'Escribe un nombre para la profesión')
      return
    }
    const { data, error } = await supabase.from('professions').insert({ name: nombre }).select().single()
    if (error) {
      addToast('error', 'Error al crear profesión: ' + error.message)
      return
    }
    setProfesiones(prev => [...prev, data])
    setNuevaProfesion('')
    setShowProfModal(false)
    addToast('success', 'Profesión agregada correctamente')
  }

  // ==========================================================================
  // VERSIONES
  // ==========================================================================
  async function agregarVersion() {
    const packageId = await obtenerPackageIdDeEvaluacion()
    if (!packageId) {
      addToast('warning', 'Primero guarda o publica el paquete para poder agregar versiones.')
      return
    }

    const { data, error } = await supabase
      .from('package_versions')
      .insert({ package_id: packageId, profession_id: null, display_name: 'Nueva versión', price: 0, is_active: true, sort_order: versiones.length })
      .select().single()

    if (error) {
      addToast('error', 'No se pudo agregar la versión: ' + error.message)
      return
    }
    if (data) setVersiones(prev => [...prev, { ...data, level_id: null }])
  }

  async function duplicarVersion(version) {
    const packageId = await obtenerPackageIdDeEvaluacion()
    if (!packageId) return

    const nueva = {
      ...version,
      id: undefined,
      display_name: `${version.display_name} (copia)`,
      sort_order: versiones.length,
    }
    const { data, error } = await supabase
      .from('package_versions')
      .insert({
        package_id: packageId,
        display_name: nueva.display_name,
        price: nueva.price,
        is_active: nueva.is_active,
        profession_id: nueva.profession_id,
        sort_order: nueva.sort_order
      })
      .select().single()

    if (error) {
      addToast('error', 'No se pudo duplicar la versión: ' + error.message)
      return
    }
    if (data) {
      setVersiones(prev => [...prev, { ...data, level_id: version.level_id }])
      if (version.level_id) {
        await supabase.from('package_version_levels').insert({ package_version_id: data.id, level_id: version.level_id })
      }
      addToast('success', 'Versión duplicada')
    }
  }

  async function actualizarVersion(versionId, campo, valor) {
    setVersiones(prev => prev.map(v => (v.id === versionId ? { ...v, [campo]: valor } : v)))
    await supabase.from('package_versions').update({ [campo]: valor }).eq('id', versionId)
  }

  async function handleProfessionChange(versionId, professionId) {
    const profesion = profesiones.find(p => p.id === parseInt(professionId))
    const versionActual = versiones.find(v => v.id === versionId)

    const debeAutocompletar = !versionActual?.display_name?.trim()
      || versionActual.display_name === 'Nueva versión'

    const nuevoDisplayName = debeAutocompletar && profesion
      ? profesion.name
      : versionActual?.display_name || ''

    setVersiones(prev => prev.map(v =>
      v.id === versionId
        ? { ...v, profession_id: professionId ? parseInt(professionId) : null, display_name: nuevoDisplayName }
        : v
    ))

    await supabase.from('package_versions').update({
      profession_id: professionId ? parseInt(professionId) : null,
      display_name: nuevoDisplayName,
    }).eq('id', versionId)
  }

  async function handleLevelChange(versionId, levelId) {
    setVersiones(prev => prev.map(v =>
      v.id === versionId ? { ...v, level_id: levelId ? parseInt(levelId) : null } : v
    ))
  }

  async function eliminarVersion(versionId) {
    if (!confirm('¿Eliminar esta versión?')) return
    await supabase.from('package_version_levels').delete().eq('package_version_id', versionId)
    await supabase.from('package_versions').delete().eq('id', versionId)
    setVersiones(prev => prev.filter(v => v.id !== versionId))
    addToast('info', 'Versión eliminada')
  }

  // ==========================================================================
  // MATERIAL DE ESTUDIO
  // ==========================================================================
  async function agregarMaterial() {
    if (!nuevoMat.title.trim()) {
      addToast('warning', 'El título es obligatorio')
      return
    }
    if (nuevoMat.source_type === 'link' && !nuevoMat.url.trim()) {
      addToast('warning', 'La URL es obligatoria')
      return
    }
    if (nuevoMat.source_type === 'upload' && !nuevoMat.file) {
      addToast('warning', 'Selecciona un archivo')
      return
    }

    const packageId = await obtenerPackageIdDeEvaluacion()
    if (!packageId) {
      addToast('warning', 'Primero guarda el paquete para poder agregar materiales.')
      return
    }

    setGuardandoMat(true)
    setNuevoMat(m => ({ ...m, uploading: true, uploadProgress: 0 }))

    try {
      // Verificar existencia del bucket (sin listBuckets si no hay permisos)
      let bucketExiste = true
      try {
        const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
        if (!bucketError && !buckets?.find(b => b.name === 'materials')) {
          bucketExiste = false
        }
      } catch (listError) {
        // Si falla por permisos, asumimos que el bucket existe e intentamos subir igual
        console.warn('No se pudo listar buckets, posible falta de permisos. Continuando...')
      }

      if (!bucketExiste) {
        throw new Error('El bucket "materials" no existe en Supabase Storage. Créalo en la consola.')
      }

      let finalUrl = ''
      let storagePath = ''
      let fileSize = 0
      let mimeType = ''

      if (nuevoMat.source_type === 'upload' && nuevoMat.file) {
        const file = nuevoMat.file
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        storagePath = `study_materials/${packageId}/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('materials')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(storagePath)
        finalUrl = publicUrl
        fileSize = file.size
        mimeType = file.type
      } else {
        finalUrl = nuevoMat.url
        storagePath = null
      }

      const payload = {
        package_id: packageId,
        title: nuevoMat.title,
        type: nuevoMat.type,
        source_type: nuevoMat.source_type,
        url: finalUrl,
        storage_path: storagePath,
        mime_type: mimeType,
        file_size: fileSize,
        folder: nuevoMat.folder || 'General',
        description: nuevoMat.description,
        sort_order: materiales.length,
        is_active: true,
        is_shared: nuevoMat.is_shared
      }

      const { data: material, error: insertError } = await supabase
        .from('study_materials')
        .insert(payload)
        .select()
        .single()

      if (insertError) throw insertError

      const versionesActivas = versiones.filter(v => v.is_active)
      if (versionesActivas.length > 0) {
        const relaciones = versionesActivas.map(v => ({
          study_material_id: material.id,
          package_version_id: v.id
        }))
        const { error: relError } = await supabase.from('study_material_versions').insert(relaciones)
        if (relError) console.error('Error al vincular material con versiones:', relError)
      }

      setMateriales(prev => [...prev, material])
      setNuevoMat({
        title: '', type: 'pdf', source_type: 'upload', file: null, url: '',
        folder: 'General', description: '', is_shared: true, uploading: false, uploadProgress: 0
      })
      addToast('success', 'Material agregado correctamente')
    } catch (err) {
      console.error(err)
      addToast('error', 'Error al subir material: ' + (err.message || 'Error desconocido'))
    } finally {
      setGuardandoMat(false)
      setNuevoMat(m => ({ ...m, uploading: false }))
    }
  }

  async function eliminarMaterial(matId) {
    const material = materiales.find(m => m.id === matId)
    if (material?.storage_path) {
      const { error } = await supabase.storage.from('materials').remove([material.storage_path])
      if (error) addToast('warning', 'No se pudo eliminar el archivo del storage')
    }
    await supabase.from('study_material_versions').delete().eq('study_material_id', matId)
    await supabase.from('study_materials').delete().eq('id', matId)
    setMateriales(prev => prev.filter(m => m.id !== matId))
    addToast('info', 'Material eliminado')
  }

  async function sincronizarMaterialesConVersiones(packageId, versionesActivasIds) {
    if (!packageId || !versionesActivasIds.length) return

    const { data: mats } = await supabase.from('study_materials').select('id').eq('package_id', packageId)
    if (!mats?.length) return

    const matIds = mats.map(m => m.id)

    const { data: relacionesActuales } = await supabase
      .from('study_material_versions')
      .select('study_material_id, package_version_id')
      .in('study_material_id', matIds)

    const existentes = new Set((relacionesActuales || []).map(r => `${r.study_material_id}:${r.package_version_id}`))

    const nuevas = []
    for (const matId of matIds) {
      for (const versionId of versionesActivasIds) {
        const key = `${matId}:${versionId}`
        if (!existentes.has(key)) {
          nuevas.push({ study_material_id: matId, package_version_id: versionId })
        }
      }
    }

    const versionesActivasSet = new Set(versionesActivasIds.map(String))
    const eliminar = (relacionesActuales || []).filter(r => !versionesActivasSet.has(String(r.package_version_id)))

    for (const r of eliminar) {
      await supabase.from('study_material_versions')
        .delete()
        .eq('study_material_id', r.study_material_id)
        .eq('package_version_id', r.package_version_id)
    }

    if (nuevas.length) {
      await supabase.from('study_material_versions').insert(nuevas)
    }
  }

  async function sincronizarNivelesVersiones(versionesFrescas) {
    if (!versionesFrescas.length) return

    const versionIds = versionesFrescas.map(v => v.id)

    const levelMapEstado = {}
    versiones.forEach(v => { if (v.id && v.level_id) levelMapEstado[v.id] = v.level_id })

    await supabase.from('package_version_levels').delete().in('package_version_id', versionIds)

    const nuevasRelaciones = versionesFrescas
      .filter(v => levelMapEstado[v.id])
      .map(v => ({ package_version_id: v.id, level_id: levelMapEstado[v.id] }))

    if (nuevasRelaciones.length) {
      const { error } = await supabase.from('package_version_levels').insert(nuevasRelaciones)
      if (error) throw new Error(`Error vinculando niveles a versiones: ${error.message}`)
    }
  }

  // ==========================================================================
  // NIVELES
  // ==========================================================================
  function agregarNivel() {
    const _id = Math.random().toString(36).slice(2)
    setNiveles(prev => [...prev, { _id, name: '', description: '', time_limit: 90, passing_score: 70, sort_order: prev.length + 1 }])
    setPreguntas(prev => ({ ...prev, [_id]: [preguntaVacia()] }))
    setNivelActivo(_id)
    setTab('niveles')
  }

  function duplicarNivel(nivelOriginal) {
    const _id = Math.random().toString(36).slice(2)
    const copia = { ...nivelOriginal, _id, name: `${nivelOriginal.name} (copia)`, sort_order: niveles.length + 1 }
    setNiveles(prev => [...prev, copia])
    const pregsOriginales = preguntas[nivelOriginal._id] || []
    const pregsCopiadas = pregsOriginales.map(p => ({ ...p, _id: Math.random().toString(36).slice(2) }))
    setPreguntas(prev => ({ ...prev, [_id]: pregsCopiadas }))
    addToast('success', 'Nivel duplicado con sus preguntas')
  }

  function actualizarNivel(_id, datos) {
    setNiveles(prev => prev.map(n => (n._id === _id ? { ...n, ...datos } : n)))
  }

  function eliminarNivel(_id) {
    if (niveles.length === 1) return
    setNiveles(prev => prev.filter(n => n._id !== _id))
    setPreguntas(prev => { const copy = { ...prev }; delete copy[_id]; return copy })
    const siguiente = niveles.find(n => n._id !== _id)?._id
    if (siguiente) setNivelActivo(siguiente)
  }

  // ==========================================================================
  // PREGUNTAS
  // ==========================================================================
  function agregarPregunta() {
    const nueva = preguntaVacia()
    setPreguntas(prev => ({ ...prev, [nivelActivo]: [...(prev[nivelActivo] || []), nueva] }))
    setPregExpandida(nueva._id)
  }

  function actualizarPregunta(nId, pregId, datos) {
    setPreguntas(prev => ({ ...prev, [nId]: prev[nId].map(p => (p._id === pregId ? { ...p, ...datos } : p)) }))
  }

  function eliminarPregunta(nId, pregId) {
    setPreguntas(prev => ({ ...prev, [nId]: prev[nId].filter(p => p._id !== pregId) }))
  }

  // ==========================================================================
  // CSV
  // ==========================================================================
  function parseCSVLine(line) {
    const result = []; let current = ''; let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]; const next = line[i + 1]
      if (char === '"' && inQuotes && next === '"') { current += '"'; i++ }
      else if (char === '"') { inQuotes = !inQuotes }
      else if (char === ',' && !inQuotes) { result.push(current); current = '' }
      else { current += char }
    }
    result.push(current)
    return result.map(v => v.trim())
  }

  function importarCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setImportError(null); setImportOk(null)

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const raw = String(event.target?.result || '').replace(/\r/g, '').split('\n').filter(Boolean)
        if (raw.length < 2) throw new Error('El archivo CSV no tiene suficientes filas.')

        const header = parseCSVLine(raw[0]).map(h => h.toLowerCase())
        const reqs = ['enunciado', 'a', 'b', 'c', 'd', 'correcta']
        const missing = reqs.filter(r => !header.includes(r))
        if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}`)

        const nuevas = raw.slice(1).map((line, i) => {
          const cols = parseCSVLine(line)
          const get = key => cols[header.indexOf(key)] || ''
          const correcta = get('correcta').toUpperCase()
          if (!LETRAS.includes(correcta)) throw new Error(`Fila ${i + 2}: "correcta" debe ser A, B, C o D`)
          return {
            _id: Math.random().toString(36).slice(2),
            text: get('enunciado'), explanation: get('explicacion'),
            difficulty: get('dificultad') || 'medio', area: get('area'),
            options: LETRAS.map(letter => ({ letter, text: get(letter.toLowerCase()), is_correct: letter === correcta })),
          }
        })

        setPreguntas(prev => ({ ...prev, [nivelActivo]: [...(prev[nivelActivo] || []), ...nuevas] }))
        setImportOk(`✅ ${nuevas.length} preguntas importadas correctamente al nivel activo.`)
        if (csvRef.current) csvRef.current.value = ''
        addToast('success', `Importadas ${nuevas.length} preguntas`)
      } catch (err) {
        setImportError(err.message || 'No se pudo procesar el CSV.')
        addToast('error', 'Error al importar CSV: ' + err.message)
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
    ]
    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'plantilla_preguntas_simulatest.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  async function copiarPromptIA() {
    try { await navigator.clipboard.writeText(PROMPT_IA_CSV); setImportOk('✅ Prompt copiado.'); setTimeout(() => setImportOk(null), 2000) }
    catch { setImportError('No se pudo copiar el prompt.') }
  }

  async function copiarInstruccionesExcel() {
    const texto = `Instrucciones para preparar el archivo:\n1. Abrir Excel o Google Sheets\n2. Crear columnas: ${CSV_COLUMNS.join(',')}\n3. Una fila = una pregunta\n4. En "correcta" usar solo A, B, C o D\n5. Guardar como CSV UTF-8`
    try { await navigator.clipboard.writeText(texto); setImportOk('✅ Instrucciones copiadas.'); setTimeout(() => setImportOk(null), 2000) }
    catch { setImportError('No se pudo copiar.') }
  }

  // ==========================================================================
  // VALIDACIONES Y WARNINGS
  // ==========================================================================
  const calcularWarnings = useCallback(() => {
    const warns = []

    const versionesActivas = versiones.filter(v => v.is_active)
    const nombres = versionesActivas.map(v => v.display_name?.trim().toLowerCase()).filter(Boolean)
    const duplicados = nombres.filter((n, i) => nombres.indexOf(n) !== i)
    if (duplicados.length) {
      warns.push(`Hay versiones activas con el mismo nombre: "${duplicados[0]}". Cada versión debe tener un nombre único.`)
    }

    const levelIdsUsados = new Set(versiones.map(v => v.level_id).filter(Boolean).map(String))
    const nivelesConId = niveles.filter(n => typeof n._id === 'number')
    const nivelesNoUsados = nivelesConId.filter(n => !levelIdsUsados.has(String(n._id)))
    if (nivelesNoUsados.length) {
      warns.push(`${nivelesNoUsados.length} nivel(es) no están asignados a ninguna versión: ${nivelesNoUsados.map(n => n.name || 'sin nombre').join(', ')}.`)
    }

    const nivelesIds = new Set(niveles.map(n => String(n._id)))
    const versionesConLevelRoto = versionesActivas.filter(v => v.level_id && !nivelesIds.has(String(v.level_id)))
    if (versionesConLevelRoto.length) {
      warns.push(`Hay versiones con un nivel asignado que ya no existe: ${versionesConLevelRoto.map(v => v.display_name).join(', ')}.`)
    }

    setWarnings(warns)
    return warns
  }, [versiones, niveles])

  useEffect(() => { calcularWarnings() }, [versiones, niveles])

  function validarAntesDeGuardar() {
    if (!form.title.trim()) {
      throw Object.assign(new Error('El nombre del paquete es obligatorio.'), { seccion: 'general' })
    }

    if (niveles.some(n => !n.name.trim())) {
      throw Object.assign(new Error('Todos los niveles deben tener nombre.'), { seccion: 'niveles' })
    }

    const versionesActivas = versiones.filter(v => v.is_active)
    if (!versionesActivas.length) {
      throw Object.assign(new Error('Debes tener al menos una versión activa.'), { seccion: 'profesiones' })
    }

    for (const v of versionesActivas) {
      if (!v.display_name?.trim()) {
        throw Object.assign(new Error('Todas las versiones activas deben tener nombre.'), { seccion: 'profesiones' })
      }
      if (!v.price || v.price <= 0) {
        throw Object.assign(new Error(`La versión "${v.display_name}" debe tener un precio válido.`), { seccion: 'profesiones' })
      }
      if (!v.level_id) {
        throw Object.assign(
          new Error(`La versión "${v.display_name}" no tiene un nivel de preguntas asignado. Asígnalo en la pestaña Versiones y Precios.`),
          { seccion: 'profesiones' }
        )
      }
    }

    for (const nv of niveles) {
      const pregs = preguntas[nv._id] || []
      if (pregs.length === 0 || pregs.every(p => !p.text?.trim())) {
        throw Object.assign(new Error(`El nivel "${nv.name || 'sin nombre'}" no tiene preguntas válidas.`), { seccion: 'preguntas' })
      }
    }
  }

  // ==========================================================================
  // GUARDADO PRINCIPAL
  // ==========================================================================
  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorBloque(null)
    setExitoMsg(null)
    setGuardadoStage('Preparando...')

    try {
      if (form.is_active) {
        validarAntesDeGuardar()
      } else {
        if (!form.title.trim()) {
          throw Object.assign(new Error('El nombre del paquete es obligatorio incluso para guardar borrador.'), { seccion: 'general' })
        }
      }

      let evalId = id

      // 1. Evaluación
      setGuardadoStage('Guardando información del paquete...')
      try {
        if (isEdit) {
          const { error: e1 } = await supabase.from('evaluations').update({
            title: form.title, description: form.description,
            category_id: form.category_id || null, is_active: form.is_active,
          }).eq('id', id)
          if (e1) throw e1
        } else {
          const { data: ev, error: e1 } = await supabase.from('evaluations').insert({
            title: form.title, description: form.description,
            category_id: form.category_id || null, is_active: form.is_active,
          }).select('id').single()
          if (e1) throw e1
          evalId = ev.id
        }
      } catch (err) {
        throw Object.assign(new Error(`Error guardando evaluación: ${err.message}`), { seccion: 'general' })
      }

      // 2. Niveles y preguntas
      setGuardadoStage('Guardando niveles y preguntas...')
      const { data: nivelesExistentesDB, error: errNivelesDB } = await supabase
        .from('levels').select('id').eq('evaluation_id', evalId)
      if (errNivelesDB) throw Object.assign(new Error(`Error cargando niveles: ${errNivelesDB.message}`), { seccion: 'niveles' })

      const nuevosNivelesIds = []

      for (const [idx, nv] of niveles.entries()) {
        let levelId = typeof nv._id === 'number' ? nv._id : null

        try {
          if (isEdit && levelId) {
            const { error: e2 } = await supabase.from('levels').update({
              name: nv.name, description: nv.description,
              time_limit: nv.time_limit, passing_score: nv.passing_score, sort_order: idx + 1,
            }).eq('id', levelId)
            if (e2) throw e2
            nuevosNivelesIds.push(levelId)
          } else {
            const { data: lv, error: e2 } = await supabase.from('levels').insert({
              evaluation_id: evalId, name: nv.name, description: nv.description,
              time_limit: nv.time_limit, passing_score: nv.passing_score, sort_order: idx + 1,
            }).select('id').single()
            if (e2) throw e2
            levelId = lv.id
            nuevosNivelesIds.push(levelId)
          }
        } catch (err) {
          throw Object.assign(new Error(`Error guardando nivel "${nv.name}": ${err.message}`), { seccion: 'niveles' })
        }

        const pregsDelNivel = preguntas[nv._id] || []
        const { data: preguntasExistentesDB, error: errPregDB } = await supabase
          .from('questions').select('id').eq('level_id', levelId)
        if (errPregDB) throw Object.assign(new Error(`Error cargando preguntas del nivel "${nv.name}": ${errPregDB.message}`), { seccion: 'preguntas' })

        const nuevasPregIds = []

        for (const preg of pregsDelNivel) {
          const pregExiste = typeof preg._id === 'number'
          let qId = preg._id

          try {
            if (isEdit && pregExiste) {
              const { error: e3 } = await supabase.from('questions').update({
                text: preg.text, explanation: preg.explanation, difficulty: preg.difficulty, area: preg.area,
              }).eq('id', qId)
              if (e3) throw e3

              const { data: optsExistentesDB } = await supabase.from('options').select('id, letter').eq('question_id', qId)
              const idsOptsExistentes = new Set(optsExistentesDB?.map(o => o.id) || [])
              const nuevasOpts = preg.options.filter(op => !op.id)
              const optsActualizar = preg.options.filter(op => op.id && idsOptsExistentes.has(op.id))
              const optsEliminar = optsExistentesDB?.filter(op => !preg.options.some(po => po.id === op.id)) || []

              for (const op of optsEliminar) { await supabase.from('options').delete().eq('id', op.id) }
              for (const op of optsActualizar) { await supabase.from('options').update({ text: op.text, is_correct: op.is_correct }).eq('id', op.id) }
              if (nuevasOpts.length) {
                await supabase.from('options').insert(nuevasOpts.map(op => ({ question_id: qId, text: op.text, letter: op.letter, is_correct: op.is_correct })))
              }
              nuevasPregIds.push(qId)
            } else {
              const { data: q, error: e3 } = await supabase.from('questions').insert({
                level_id: levelId, text: preg.text, explanation: preg.explanation,
                question_type: 'multiple', difficulty: preg.difficulty, area: preg.area,
              }).select('id').single()
              if (e3) throw e3
              qId = q.id

              const { error: e4 } = await supabase.from('options').insert(
                preg.options.map(op => ({ question_id: qId, text: op.text, letter: op.letter, is_correct: op.is_correct }))
              )
              if (e4) throw e4
              nuevasPregIds.push(qId)
            }
          } catch (err) {
            throw Object.assign(new Error(`Error guardando preguntas del nivel "${nv.name}": ${err.message}`), { seccion: 'preguntas' })
          }
        }

        for (const p of preguntasExistentesDB) {
          if (!nuevasPregIds.includes(p.id)) {
            await supabase.from('options').delete().eq('question_id', p.id)
            await supabase.from('questions').delete().eq('id', p.id)
          }
        }
      }

      for (const lv of nivelesExistentesDB) {
        if (!nuevosNivelesIds.includes(lv.id)) {
          const { data: pregNivel } = await supabase.from('questions').select('id').eq('level_id', lv.id)
          for (const preg of pregNivel || []) {
            await supabase.from('options').delete().eq('question_id', preg.id)
            await supabase.from('questions').delete().eq('id', preg.id)
          }
          await supabase.from('levels').delete().eq('id', lv.id)
        }
      }

      // 3. Paquete y versiones (solo si se publica)
      if (form.is_active) {
        setGuardadoStage('Configurando paquete y versiones...')
        let packageId = await obtenerPackageIdDeEvaluacion()

        const versionesActivas = versiones.filter(v => v.is_active)
        const precioBase = versionesActivas.length
          ? Math.min(...versionesActivas.map(v => Number(v.price) || 0))
          : 0

        const payloadPackage = {
          name: form.title, description: form.description, base_price: precioBase,
          package_type: 'normal', duration_days: 365, is_active: true,
          pricing_mode: modoVersiones === 'simple' ? 'global' : 'per_profession',
          content_mode: 'shared', has_study_material: true, has_practice_mode: true,
          has_exam_mode: true, has_online_room: true,
          has_level_selector: versionesActivas.length > 1,
        }

        try {
          if (packageId) {
            const { error: e5 } = await supabase.from('packages').update(payloadPackage).eq('id', packageId)
            if (e5) throw e5
          } else {
            const { data: newPkg, error: e5 } = await supabase.from('packages').insert(payloadPackage).select('id').single()
            if (e5) throw e5
            packageId = newPkg.id
          }
        } catch (err) {
          throw Object.assign(new Error(`Error guardando el paquete: ${err.message}`), { seccion: 'general' })
        }

        try {
          const { data: versionesEnBD } = await supabase.from('package_versions').select('id').eq('package_id', packageId)
          const idsEnBD = new Set(versionesEnBD.map(v => v.id))
          const idsEnEstado = new Set(versiones.filter(v => v.id).map(v => v.id))

          for (const v of versionesEnBD) {
            if (!idsEnEstado.has(v.id)) await supabase.from('package_versions').delete().eq('id', v.id)
          }

          for (let i = 0; i < versiones.length; i++) {
            const v = versiones[i]
            const versionData = {
              package_id: packageId, display_name: v.display_name, price: v.price,
              is_active: v.is_active, sort_order: i, profession_id: v.profession_id || null,
            }
            if (v.id && idsEnBD.has(v.id)) {
              await supabase.from('package_versions').update(versionData).eq('id', v.id)
            } else {
              const { data: nueva, error: insErr } = await supabase.from('package_versions').insert(versionData).select('id').single()
              if (insErr) throw insErr
              if (nueva) v.id = nueva.id
            }
          }
        } catch (err) {
          throw Object.assign(new Error(`Error sincronizando versiones: ${err.message}`), { seccion: 'profesiones' })
        }

        setGuardadoStage('Vinculando evaluación con versiones...')
        const { data: versionesFrescas, error: fetchErr } = await supabase
          .from('package_versions').select('id, is_active').eq('package_id', packageId)
        if (fetchErr) throw Object.assign(new Error(`Error obteniendo versiones frescas: ${fetchErr.message}`), { seccion: 'profesiones' })

        try {
          await supabase.from('evaluation_versions').delete().eq('evaluation_id', evalId)
          const nuevasRelaciones = versionesFrescas.filter(v => v.is_active).map(v => ({ evaluation_id: evalId, package_version_id: v.id }))
          if (nuevasRelaciones.length) {
            const { error: relErr } = await supabase.from('evaluation_versions').insert(nuevasRelaciones)
            if (relErr) throw relErr
          }
        } catch (err) {
          throw Object.assign(new Error(`Error vinculando evaluación con versiones: ${err.message}`), { seccion: 'profesiones' })
        }

        setGuardadoStage('Sincronizando materiales...')
        try {
          const versionesActivasIds = versionesFrescas.filter(v => v.is_active).map(v => v.id)
          if (versionesActivasIds.length) await sincronizarMaterialesConVersiones(packageId, versionesActivasIds)
        } catch (err) {
          throw Object.assign(new Error(`Error vinculando materiales: ${err.message}`), { seccion: 'material' })
        }

        setGuardadoStage('Vinculando niveles a versiones...')
        try {
          await sincronizarNivelesVersiones(versionesFrescas)
        } catch (err) {
          throw Object.assign(new Error(`Error vinculando niveles a versiones: ${err.message}`), { seccion: 'profesiones' })
        }

        const { data: versionesFinales } = await supabase
          .from('package_versions').select('*').eq('package_id', packageId).order('sort_order', { ascending: true })

        if (versionesFinales) {
          const allVersionIds = versionesFinales.map(v => v.id)
          const { data: pvLevels } = await supabase.from('package_version_levels').select('package_version_id, level_id').in('package_version_id', allVersionIds)
          const levelMap = {}
          pvLevels?.forEach(row => { levelMap[row.package_version_id] = row.level_id })
          setVersiones(versionesFinales.map(v => ({ ...v, level_id: levelMap[v.id] || null })))
        }
      }

      setExitoMsg(form.is_active ? 'publicado' : 'borrador')
      setGuardadoStage('¡Completado!')
      addToast('success', form.is_active ? '¡Paquete publicado correctamente!' : 'Borrador guardado')
      setTimeout(() => navigate('/admin/evaluaciones'), 1500)

    } catch (err) {
      console.error(err)
      const mensaje = err.message || 'Error al guardar'
      setErrorBloque({ seccion: err.seccion || 'general', message: mensaje })
      addToast('error', mensaje)
      const tabMap = { general: 'general', niveles: 'niveles', preguntas: 'preguntas', profesiones: 'profesiones', material: 'material' }
      if (err.seccion && tabMap[err.seccion]) setTab(tabMap[err.seccion])
      setGuardadoStage('')
    } finally {
      setGuardando(false)
    }
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  const pregActivas = preguntas[nivelActivo] || []
  const totalPregs = Object.values(preguntas).reduce((sum, arr) => sum + arr.length, 0)
  const carpetas = [...new Set(materiales.map(m => m.folder))]
  const versionesActivas = versiones.filter(v => v.is_active)
  const precioMinimo = versionesActivas.length ? Math.min(...versionesActivas.map(v => Number(v.price) || 0)) : 0

  const esModoSimple = modoVersiones === 'simple'

  const labels = useMemo(() => {
    if (!modoGuiado) {
      return {
        versiones: 'Versiones y Precios',
        profesion: 'Profesión / Cargo',
        nivel: 'Nivel de preguntas',
        material: 'Material de Estudio',
        version: 'Versión',
        nivelActivo: 'Nivel activo',
        banco: 'Banco de preguntas',
        planes: 'Planes de acceso',
        recursos: 'Recursos de apoyo',
        modulos: 'Módulos / Áreas',
      }
    }
    return {
      versiones: 'Planes de acceso',
      profesion: 'Cargo o perfil',
      nivel: 'Banco de preguntas',
      material: 'Recursos de apoyo',
      version: 'Plan',
      nivelActivo: 'Banco activo',
      banco: 'Banco de preguntas',
      planes: 'Planes de acceso',
      recursos: 'Recursos de apoyo',
      modulos: 'Módulos',
    }
  }, [modoGuiado])

  // Agrupación de preguntas por módulo (área) para vista opcional
  const preguntasPorModulo = useMemo(() => {
    const modulos = {}
    Object.entries(preguntas).forEach(([nivelId, pregs]) => {
      pregs.forEach(preg => {
        const modulo = preg.area?.trim() || 'Sin módulo'
        if (!modulos[modulo]) modulos[modulo] = []
        modulos[modulo].push({ ...preg, nivelId })
      })
    })
    return modulos
  }, [preguntas])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 flex items-center justify-between px-8 h-16 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-sm">
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('/admin/evaluaciones')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container transition-colors text-sm font-medium">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              Volver
            </button>
            <div className="h-5 w-px bg-outline-variant/30" />
            <h1 className="font-headline font-extrabold text-lg text-primary">
              {isEdit ? 'Editar Paquete' : 'Nuevo Paquete'}
            </h1>
            <div className="hidden md:flex items-center gap-3 ml-4">
              <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                {niveles.length} {modoGuiado ? 'banco' : 'nivel'}{niveles.length !== 1 ? 's' : ''}
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
            <button type="button" onClick={() => navigate('/admin/evaluaciones')}
              className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors">
              Cancelar
            </button>
            <button type="submit" form="eval-form" disabled={guardando || Boolean(exitoMsg)}
              className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60">
              {guardando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {exitoMsg === 'publicado' ? (
                <><span className="material-symbols-outlined text-sm">check</span>¡Publicado!</>
              ) : exitoMsg === 'borrador' ? (
                <><span className="material-symbols-outlined text-sm">draft</span>Borrador guardado</>
              ) : guardando ? guardadoStage || 'Guardando...' : isEdit ? 'Actualizar paquete' : 'Publicar paquete'}
            </button>
          </div>
        </header>

        <form id="eval-form" onSubmit={handleSubmit}>
          <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Sidebar */}
            <div className="space-y-6">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">Modo guiado</span>
                  <button
                    type="button"
                    onClick={() => setModoGuiado(!modoGuiado)}
                    className={`w-12 h-6 rounded-full transition-all relative ${modoGuiado ? 'bg-secondary' : 'bg-outline-variant'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${modoGuiado ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant mt-2">
                  {modoGuiado ? 'Textos más sencillos y ayuda contextual.' : 'Terminología técnica original.'}
                </p>
              </Card>

              <div className="flex flex-col gap-1">
                {[
                  { key: 'general', icon: 'inventory_2', label: 'Info del Paquete' },
                  { key: 'profesiones', icon: 'people', label: labels.versiones },
                  { key: 'niveles', icon: 'layers', label: modoGuiado ? 'Bancos de preguntas' : 'Niveles' },
                  { key: 'preguntas', icon: 'quiz', label: 'Preguntas' },
                  { key: 'material', icon: 'menu_book', label: labels.material },
                  { key: 'importar', icon: 'upload_file', label: 'Importar CSV' },
                ].map(t => (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left ${tab === t.key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                    <span className="material-symbols-outlined text-lg">{t.icon}</span>
                    {t.label}
                    {t.key === 'preguntas' && totalPregs > 0 && (
                      <span className="ml-auto text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full">{totalPregs}</span>
                    )}
                    {t.key === 'material' && materiales.length > 0 && (
                      <span className="ml-auto text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full">{materiales.length}</span>
                    )}
                    {t.key === 'profesiones' && versiones.length > 0 && (
                      <span className="ml-auto text-[10px] bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full">{versiones.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <ChecklistPublicacion
                form={form}
                versiones={versiones}
                niveles={niveles}
                preguntas={preguntas}
                materiales={materiales}
                modoGuiado={modoGuiado}
              />

              {(tab === 'preguntas' || tab === 'importar') && niveles.length > 0 && (
                <Card className="p-4 border-2 border-primary/20">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">ads_click</span>
                    {labels.nivelActivo}
                  </p>
                  <p className="text-xs text-on-surface-variant mb-3">
                    El {modoGuiado ? 'banco activo' : 'nivel activo'} define dónde se agregan preguntas o se importa CSV.
                  </p>
                  <div className="space-y-1">
                    {niveles.map(nv => (
                      <button key={nv._id} type="button" onClick={() => setNivelActivo(nv._id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${nivelActivo === nv._id ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                        {nv.name || (modoGuiado ? 'Banco sin nombre' : 'Sin nombre')}
                        <span className="ml-2 text-[10px] opacity-70">({(preguntas[nv._id] || []).length} pregs.)</span>
                      </button>
                    ))}
                  </div>
                </Card>
              )}

              {/* Resumen rápido */}
              <Card className="p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Resumen rápido</p>
                <div className="space-y-2 text-xs text-on-surface-variant">
                  <div className="flex justify-between"><span>{modoGuiado ? 'Planes activos' : 'Versiones activas'}</span><span className="font-bold text-on-surface">{versionesActivas.length}</span></div>
                  <div className="flex justify-between"><span>Precio base</span><span className="font-bold text-on-surface">${precioMinimo.toLocaleString('es-CO')}</span></div>
                  <div className="flex justify-between"><span>Materiales</span><span className="font-bold text-on-surface">{materiales.length}</span></div>
                  <div className="flex justify-between">
                    <span>Estado</span>
                    <span className={`font-bold ${form.is_active ? 'text-secondary' : 'text-tertiary'}`}>
                      {form.is_active ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Contenido principal */}
            <div className="lg:col-span-2 space-y-6">
              {/* GENERAL */}
              {tab === 'general' && (
                <Card className="p-6 space-y-5">
                  <h3 className="font-bold text-lg font-headline">Información del Paquete</h3>
                  <InputField label="Nombre del paquete" required>
                    <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                      placeholder="ej: Contraloría General de la República" className={INPUT_CLS} required />
                  </InputField>
                  <InputField label="Descripción" hint="Qué incluye este paquete">
                    <textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe qué cubre este paquete, áreas temáticas, cantidad de preguntas..." className={`${INPUT_CLS} resize-none`} />
                  </InputField>
                  <InputField label="Categoría">
                    <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className={INPUT_CLS}>
                      <option value="">Sin categoría</option>
                      {categorias.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </InputField>
                  <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                    <div>
                      <p className="text-sm font-bold">Publicar paquete</p>
                      <p className="text-xs text-on-surface-variant">Visible en planes y disponible para compra</p>
                    </div>
                    <button type="button" onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`w-12 h-6 rounded-full transition-all relative ${form.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </Card>
              )}

              {/* VERSIONES */}
              {tab === 'profesiones' && (
                <Card className="p-6 space-y-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-lg font-headline">{labels.versiones}</h3>
                      <p className="text-xs text-on-surface-variant mt-1">
                        {!id ? 'Guarda el paquete primero para agregar versiones.' : 'Cada versión puede representar una profesión, cargo o acceso especial.'}
                      </p>
                    </div>
                    {id && (
                      <button type="button" onClick={agregarVersion}
                        className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all">
                        <span className="material-symbols-outlined text-sm">add</span>
                        + {modoGuiado ? 'Plan' : 'Versión'}
                      </button>
                    )}
                  </div>

                  <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/15 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold">Modo de configuración</p>
                        <p className="text-xs text-on-surface-variant">
                          {esModoSimple
                            ? 'Simple: un solo precio global para todo el paquete.'
                            : 'Avanzado: múltiples versiones con precios independientes por profesión o cargo.'}
                        </p>
                      </div>
                      <div className="flex bg-surface-container-high rounded-full p-1">
                        {['simple', 'avanzado'].map(modo => (
                          <button key={modo} type="button" onClick={() => setModoVersiones(modo)}
                            className={`px-4 py-2 rounded-full text-xs font-bold transition-all capitalize ${modoVersiones === modo ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
                            {modo}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setShowProfModal(true)}
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Agregar profesión
                    </button>
                  </div>

                  {id && versiones.map((version, idx) => {
                    const esVersionExtraEnSimple = esModoSimple && idx > 0
                    if (esVersionExtraEnSimple) return null

                    return (
                      <div key={version.id} className={`rounded-2xl border-2 p-5 space-y-4 ${!version.is_active ? 'border-outline-variant/10 opacity-60' : version.level_id ? 'border-secondary/20' : 'border-orange-200'}`}>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-primary/10 text-primary">{idx + 1}</div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                              {esModoSimple ? (modoGuiado ? 'Plan único' : 'Versión única') : (modoGuiado ? 'Plan' : 'Versión')}
                            </span>
                          </div>
                          <div className="flex gap-1">
                            <button type="button" onClick={() => duplicarVersion(version)}
                              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Duplicar">
                              <span className="material-symbols-outlined text-sm">content_copy</span>
                            </button>
                            <button type="button" onClick={() => eliminarVersion(version.id)}
                              className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors">
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                              {esModoSimple ? 'Nombre' : labels.profesion}
                            </label>
                            <input type="text" value={version.display_name}
                              onChange={e => actualizarVersion(version.id, 'display_name', e.target.value)}
                              placeholder={esModoSimple ? 'ej: Acceso Completo' : 'ej: Profesional Universitario'}
                              className={INPUT_CLS} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Precio (COP)</label>
                            <input type="number" value={version.price}
                              onChange={e => actualizarVersion(version.id, 'price', parseInt(e.target.value || '0', 10))}
                              placeholder="50000" className={INPUT_CLS} />
                          </div>
                        </div>

                        {!esModoSimple && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                              Profesión asociada (opcional)
                            </label>
                            <select value={version.profession_id || ''} onChange={e => handleProfessionChange(version.id, e.target.value)} className={INPUT_CLS}>
                              <option value="">— Ninguna —</option>
                              {profesiones.map(prof => <option key={prof.id} value={prof.id}>{prof.name}</option>)}
                            </select>
                          </div>
                        )}

                        <div className="space-y-1">
                          <label className={`text-[10px] font-bold uppercase tracking-widest ${version.is_active && !version.level_id ? 'text-orange-600' : 'text-on-surface-variant'}`}>
                            {labels.nivel} {version.is_active ? '*' : ''}
                          </label>
                          <select value={version.level_id || ''} onChange={e => handleLevelChange(version.id, e.target.value)}
                            className={`${INPUT_CLS} ${version.is_active && !version.level_id ? 'border-orange-300 ring-1 ring-orange-200' : ''}`}>
                            <option value="">— Seleccionar —</option>
                            {levelsList.map(level => <option key={level.id} value={level.id}>{level.name}</option>)}
                          </select>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                          <div className="text-sm font-extrabold text-primary">
                            ${Number(version.price || 0).toLocaleString('es-CO')} COP
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <button type="button"
                              onClick={() => actualizarVersion(version.id, 'is_active', !version.is_active)}
                              className={`w-10 h-5 rounded-full relative transition-all ${version.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}>
                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${version.is_active ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                            <span className="text-xs font-semibold text-on-surface-variant">
                              {version.is_active ? 'Visible' : 'Oculta'}
                            </span>
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </Card>
              )}

              {/* NIVELES */}
              {tab === 'niveles' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg font-headline">{modoGuiado ? 'Bancos de preguntas' : 'Niveles de preguntas'}</h3>
                    <button type="button" onClick={agregarNivel}
                      className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>
                      {modoGuiado ? 'Agregar banco' : 'Agregar nivel'}
                    </button>
                  </div>

                  <div className="p-3 bg-surface-container rounded-xl text-xs text-on-surface-variant">
                    💡 <strong>¿Cuándo crear {modoGuiado ? 'bancos' : 'niveles'}?</strong> Si todos los usuarios ven las mismas preguntas, usa un solo {modoGuiado ? 'banco' : 'nivel'}. Si cada profesión o cargo tiene preguntas distintas, crea un {modoGuiado ? 'banco' : 'nivel'} por cada uno. Luego asigna cada {modoGuiado ? 'banco' : 'nivel'} a su {modoGuiado ? 'plan' : 'versión'} en la pestaña <strong>{labels.versiones}</strong>.
                  </div>

                  {niveles.map((nv, i) => (
                    <NivelCard key={nv._id} nivel={nv} idx={i}
                      onChange={datos => actualizarNivel(nv._id, datos)}
                      onDelete={() => eliminarNivel(nv._id)}
                      onDuplicate={() => duplicarNivel(nv)}
                      preguntasCount={(preguntas[nv._id] || []).length}
                      modoGuiado={modoGuiado} />
                  ))}
                </div>
              )}

              {/* PREGUNTAS */}
              {tab === 'preguntas' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg font-headline">
                        Preguntas — {niveles.find(n => n._id === nivelActivo)?.name || (modoGuiado ? 'Banco' : 'Nivel')}
                      </h3>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {pregActivas.length} pregunta{pregActivas.length !== 1 ? 's' : ''} en este {modoGuiado ? 'banco' : 'nivel'}
                      </p>
                    </div>
                    <button type="button" onClick={agregarPregunta}
                      className="flex items-center gap-1.5 bg-primary text-on-primary px-4 py-2 rounded-full text-xs font-bold hover:bg-primary/90 transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>
                      Agregar pregunta
                    </button>
                  </div>

                  {/* Vista de módulos */}
                  <details className="bg-surface-container-lowest rounded-xl border border-outline-variant/15">
                    <summary className="p-4 font-bold text-sm cursor-pointer">
                      {modoGuiado ? 'Ver por módulos' : 'Ver por áreas temáticas'}
                    </summary>
                    <div className="p-4 border-t border-outline-variant/15 space-y-3">
                      {Object.keys(preguntasPorModulo).length === 0 ? (
                        <p className="text-xs text-on-surface-variant">No hay preguntas aún.</p>
                      ) : (
                        Object.entries(preguntasPorModulo).map(([modulo, pregs]) => (
                          <div key={modulo}>
                            <p className="text-sm font-bold mb-1">{modulo} ({pregs.length})</p>
                            <ul className="text-xs space-y-1 list-disc list-inside">
                              {pregs.slice(0, 5).map(p => (
                                <li key={p._id} className="truncate">{p.text || 'Sin enunciado'}</li>
                              ))}
                              {pregs.length > 5 && <li className="text-on-surface-variant">...y {pregs.length - 5} más</li>}
                            </ul>
                          </div>
                        ))
                      )}
                    </div>
                  </details>

                  {pregActivas.length === 0 ? (
                    <Card className="p-10 text-center text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">quiz</span>
                      <p className="font-semibold text-sm">Sin preguntas en este {modoGuiado ? 'banco' : 'nivel'}</p>
                      <p className="text-xs mt-1">Agrégalas manualmente o importa desde CSV</p>
                    </Card>
                  ) : (
                    pregActivas.map((preg, i) => (
                      <PreguntaCard key={preg._id} preg={preg} idx={i}
                        expandido={pregExpandida === preg._id}
                        onToggle={() => setPregExpandida(pregExpandida === preg._id ? null : preg._id)}
                        onChange={datos => actualizarPregunta(nivelActivo, preg._id, datos)}
                        onDelete={() => eliminarPregunta(nivelActivo, preg._id)}
                        modoGuiado={modoGuiado} />
                    ))
                  )}
                </div>
              )}

              {/* MATERIAL */}
              {tab === 'material' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="font-bold text-lg font-headline">{labels.material}</h3>
                    <p className="text-xs text-on-surface-variant mt-1">
                      {!id ? 'Guarda el paquete primero para agregar material.' : 'Sube archivos (PDF, Word, videos) o agrega enlaces. El material se asigna a todas las versiones activas.'}
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

                        <div className="space-y-3">
                          <div className="flex gap-2 p-1 bg-surface-container rounded-full">
                            <button
                              type="button"
                              onClick={() => setNuevoMat(m => ({ ...m, source_type: 'upload', url: '', file: null }))}
                              className={`flex-1 py-2 rounded-full text-xs font-bold transition ${
                                nuevoMat.source_type === 'upload' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                              }`}
                            >
                              Subir archivo
                            </button>
                            <button
                              type="button"
                              onClick={() => setNuevoMat(m => ({ ...m, source_type: 'link', file: null }))}
                              className={`flex-1 py-2 rounded-full text-xs font-bold transition ${
                                nuevoMat.source_type === 'link' ? 'bg-primary text-on-primary' : 'text-on-surface-variant'
                              }`}
                            >
                              Pegar enlace
                            </button>
                          </div>

                          {nuevoMat.source_type === 'upload' ? (
                            <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 text-center">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.mp4,.mov,.jpg,.png"
                                onChange={e => setNuevoMat(m => ({ ...m, file: e.target.files[0] }))}
                                className="hidden"
                                id="file-upload"
                              />
                              <label htmlFor="file-upload" className="cursor-pointer">
                                <span className="material-symbols-outlined text-3xl text-primary mb-2">upload_file</span>
                                <p className="text-sm font-bold">
                                  {nuevoMat.file ? nuevoMat.file.name : 'Seleccionar archivo'}
                                </p>
                                <p className="text-xs text-on-surface-variant">PDF, Word, videos (máx. 50MB)</p>
                              </label>
                              {nuevoMat.uploading && (
                                <div className="mt-3 w-full bg-surface-container-high rounded-full h-2">
                                  <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${nuevoMat.uploadProgress}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <InputField label="URL / Link" required>
                              <input
                                type="url"
                                value={nuevoMat.url}
                                onChange={e => setNuevoMat(m => ({ ...m, url: e.target.value }))}
                                placeholder="https://..."
                                className={INPUT_CLS}
                              />
                            </InputField>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InputField label="Título" required>
                              <input type="text" value={nuevoMat.title} onChange={e => setNuevoMat(m => ({ ...m, title: e.target.value }))}
                                placeholder="ej: Guía de Control Fiscal" className={INPUT_CLS} />
                            </InputField>
                            <InputField label="Tipo">
                              <select value={nuevoMat.type} onChange={e => setNuevoMat(m => ({ ...m, type: e.target.value }))} className={INPUT_CLS}>
                                <option value="pdf">📄 PDF</option>
                                <option value="video">🎥 Video</option>
                                <option value="link">🔗 Link externo</option>
                                <option value="doc">📝 Documento</option>
                              </select>
                            </InputField>
                            <InputField label="Carpeta" hint="Para organizar">
                              <input type="text" value={nuevoMat.folder} onChange={e => setNuevoMat(m => ({ ...m, folder: e.target.value }))}
                                placeholder="ej: Módulo 1, Videos..." className={INPUT_CLS} list="carpetas-existentes" />
                              <datalist id="carpetas-existentes">{carpetas.map(c => <option key={c} value={c} />)}</datalist>
                            </InputField>
                          </div>

                          <InputField label="Descripción" hint="Opcional">
                            <input type="text" value={nuevoMat.description} onChange={e => setNuevoMat(m => ({ ...m, description: e.target.value }))}
                              placeholder="Breve descripción del contenido..." className={INPUT_CLS} />
                          </InputField>

                          <div className="flex items-center justify-between p-4 bg-surface-container rounded-xl">
                            <div>
                              <p className="text-sm font-bold">Material compartido</p>
                              <p className="text-xs text-on-surface-variant">Visible para todas las versiones activas del paquete.</p>
                            </div>
                            <button type="button" onClick={() => setNuevoMat(m => ({ ...m, is_shared: !m.is_shared }))}
                              className={`w-12 h-6 rounded-full transition-all relative ${nuevoMat.is_shared ? 'bg-secondary' : 'bg-outline-variant'}`}>
                              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${nuevoMat.is_shared ? 'right-0.5' : 'left-0.5'}`} />
                            </button>
                          </div>

                          <button type="button" onClick={agregarMaterial}
                            disabled={guardandoMat || !nuevoMat.title.trim() || (nuevoMat.source_type === 'link' && !nuevoMat.url.trim()) || (nuevoMat.source_type === 'upload' && !nuevoMat.file)}
                            className="w-full py-3 bg-secondary text-on-secondary rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-secondary/90 transition-all flex items-center justify-center gap-2">
                            {guardandoMat ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">add</span>}
                            {guardandoMat ? 'Guardando...' : 'Agregar recurso'}
                          </button>
                        </div>
                      </Card>

                      {materiales.length === 0 ? (
                        <div className="p-10 text-center text-on-surface-variant bg-surface-container rounded-2xl">
                          <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">folder_open</span>
                          <p className="font-semibold text-sm">Sin material agregado</p>
                        </div>
                      ) : (
                        carpetas.map(carpeta => (
                          <div key={carpeta}>
                            <div className="flex items-center gap-2 mb-3">
                              <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>folder</span>
                              <h4 className="font-extrabold text-sm uppercase tracking-widest text-primary">{carpeta}</h4>
                              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                                {materiales.filter(m => m.folder === carpeta).length}
                              </span>
                            </div>

                            <div className="space-y-2">
                              {materiales.filter(m => m.folder === carpeta).map(m => (
                                <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/15">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.type === 'pdf' ? 'bg-red-50 text-red-500' : m.type === 'video' ? 'bg-blue-50 text-blue-600' : m.type === 'link' ? 'bg-primary/10 text-primary' : 'bg-amber-50 text-amber-600'}`}>
                                    <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{iconoMaterial(m.type)}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm truncate">{m.title}</p>
                                      {m.is_shared && <span className="text-[10px] bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-bold">Compartido</span>}
                                      {m.source_type === 'upload' && <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">Archivo</span>}
                                    </div>
                                    {m.description && <p className="text-xs text-on-surface-variant truncate">{m.description}</p>}
                                    <div className="flex items-center gap-2 mt-1">
                                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline truncate">
                                        {m.source_type === 'upload' ? 'Descargar archivo' : 'Abrir enlace'}
                                      </a>
                                      {m.file_size && <span className="text-[10px] text-on-surface-variant">{(m.file_size / 1024 / 1024).toFixed(1)} MB</span>}
                                    </div>
                                  </div>
                                  <button type="button" onClick={() => eliminarMaterial(m.id)}
                                    className="p-1.5 text-error hover:bg-error-container/30 rounded-lg transition-colors flex-shrink-0">
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
                      {modoGuiado ? 'Banco activo' : 'Nivel activo'}: <span className="font-bold text-primary">{niveles.find(n => n._id === nivelActivo)?.name || 'sin nombre'}</span>
                    </p>
                  </div>

                  <div className="bg-surface-container rounded-xl p-5 space-y-4">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant">Flujo recomendado</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { n: 1, title: `Crea los ${modoGuiado ? 'bancos' : 'niveles'}`, desc: `Crea un ${modoGuiado ? 'banco' : 'nivel'} por profesión o cargo antes de importar preguntas.` },
                        { n: 2, title: `Selecciona el ${modoGuiado ? 'banco' : 'nivel'} activo`, desc: 'El CSV que subas se agregará al activo actual.' },
                        { n: 3, title: 'Descarga la plantilla', desc: 'Usa siempre la misma estructura para evitar errores al importar.' },
                        { n: 4, title: 'Si usas IA, pásale el prompt', desc: 'Convierte PDFs o bases manuales a CSV usando el prompt de abajo.' },
                      ].map(({ n, title, desc }) => (
                        <div key={n} className="p-4 bg-surface-container-high rounded-xl">
                          <p className="text-xs font-bold text-primary mb-2">{n}. {title}</p>
                          <p className="text-xs text-on-surface-variant">{desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-surface-container rounded-xl p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Columnas obligatorias</p>
                    <div className="flex flex-wrap gap-2">
                      {CSV_COLUMNS.map(col => (
                        <span key={col} className={`px-2 py-1 rounded-lg text-[10px] font-bold ${['enunciado', 'A', 'B', 'C', 'D', 'correcta'].includes(col) ? 'bg-primary-fixed text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-primary/5 rounded-xl border border-primary/10 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-primary uppercase tracking-widest">Prompt para IA</p>
                      <button type="button" onClick={copiarPromptIA} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[10px] font-bold">
                        Copiar prompt
                      </button>
                    </div>
                    <textarea readOnly value={PROMPT_IA_CSV} rows={10} className={`${INPUT_CLS} resize-none text-[11px]`} />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={copiarInstruccionesExcel}
                      className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors">
                      Copiar instrucciones para Excel / Sheets
                    </button>
                    <button type="button" onClick={descargarPlantilla}
                      className="px-3 py-2 rounded-lg border border-outline-variant text-xs font-bold hover:bg-surface-container transition-colors">
                      Descargar plantilla CSV
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${importando ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-primary bg-surface-container-low/50'}`}>
                      <span className={`material-symbols-outlined text-3xl mb-2 ${importando ? 'text-primary animate-bounce' : 'text-on-surface-variant'}`}>cloud_upload</span>
                      <p className="text-sm font-bold">{importando ? 'Importando...' : 'Haz clic o arrastra tu CSV'}</p>
                      <p className="text-xs text-on-surface-variant mt-1">El archivo se agregará al {modoGuiado ? 'banco' : 'nivel'} activo</p>
                      <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={importarCSV} />
                    </label>

                    <div className="border rounded-xl p-6 flex flex-col justify-center gap-2 border-outline-variant bg-surface-container-low/40">
                      <p className="text-sm font-bold">Recomendación práctica</p>
                      <p className="text-xs text-on-surface-variant">
                        Si tienes PDFs o módulos largos, usa el prompt del panel para que la IA convierta todo al formato exacto del CSV. Luego pega el resultado en Excel, guarda como CSV UTF-8 y sube aquí.
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

        {/* Modal agregar profesión */}
        {showProfModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowProfModal(false)}>
            <div className="bg-surface rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold mb-4">Nueva profesión</h3>
              <input
                type="text"
                value={nuevaProfesion}
                onChange={e => setNuevaProfesion(e.target.value)}
                placeholder="Ej: Abogado"
                className={INPUT_CLS}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowProfModal(false)} className="px-4 py-2 text-sm">Cancelar</button>
                <button type="button" onClick={agregarProfesion} className="px-4 py-2 bg-primary text-on-primary rounded-full text-sm">Agregar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  )
}