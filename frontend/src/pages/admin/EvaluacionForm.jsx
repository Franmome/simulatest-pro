// frontend/src/pages/admin/EvaluacionForm.jsx
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// — Sistema Toast
import ToastProvider, { useToast } from './components/evaluacion-form/ToastProvider'

// — UI primitivos
import Card from './components/evaluacion-form/Card'
import ErrorBanner from './components/evaluacion-form/ErrorBanner'
import ChecklistPublicacion from './components/evaluacion-form/ChecklistPublicacion'

// — Secciones de tabs
import GeneralSection from './components/evaluacion-form/GeneralSection'
import VersionsSection from './components/evaluacion-form/VersionsSection'
import LevelsSection from './components/evaluacion-form/LevelsSection'
import QuestionsSection from './components/evaluacion-form/QuestionsSection'
import MaterialSection from './components/evaluacion-form/MaterialSection'
import CsvImportSection from './components/evaluacion-form/CsvImportSection'

// — Helpers y servicios
import { preguntaVacia, parseCSVLine, buildLabels } from './components/evaluacion-form/lib/helpers'
import { LETRAS, CSV_COLUMNS, DEBUG_EVAL_FORM } from './components/evaluacion-form/lib/constants'
import { saveEvaluation, saveAllLevels } from './components/evaluacion-form/services/evalService'
import {
  getPackageIdFromEvaluation,
  savePackage,
  syncPackageVersions,
  syncEvaluationVersions,
  syncMaterialsWithVersions,
  syncPackageVersionLevels,
  loadVersionesWithDetails,
} from './components/evaluacion-form/services/packageService'

function dbg(msg, data) {
  if (DEBUG_EVAL_FORM) console.log(`[EvaluacionForm] ${msg}`, data ?? '')
}

// ============================================================================
// WRAPPER PÚBLICO — provee el contexto de Toast
// ============================================================================
export default function EvaluacionFormWrapper() {
  return (
    <ToastProvider>
      <EvaluacionFormContent />
    </ToastProvider>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
function EvaluacionFormContent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const csvRef = useRef(null)
  const addToast = useToast()
  const isEdit = Boolean(id)

  // — Datos del formulario general
  const [form, setForm] = useState({ title: '', description: '', category_id: '', is_active: true })
  const [categorias, setCategorias] = useState([])
  const [profesiones, setProfesiones] = useState([])

  // — Estado del guardado
  const [guardando, setGuardando] = useState(false)
  const [guardadoStage, setGuardadoStage] = useState('')
  const [errorBloque, setErrorBloque] = useState(null)
  const [exitoMsg, setExitoMsg] = useState(null)

  // — Navegación de tabs
  const [tab, setTab] = useState('general')
  const [modoVersiones, setModoVersiones] = useState('avanzado')
  const [modoGuiado, setModoGuiado] = useState(false)

  // — Niveles y preguntas
  const [niveles, setNiveles] = useState([
    { _id: 'n1', name: '', description: '', time_limit: 90, passing_score: 70, sort_order: 1 },
  ])
  const [nivelActivo, setNivelActivo] = useState('n1')
  const [preguntas, setPreguntas] = useState({ n1: [preguntaVacia()] })
  const [pregExpandida, setPregExpandida] = useState(null)
  const [moduloActivo, setModuloActivo] = useState(null)

  // — Versiones
  const [versiones, setVersiones] = useState([])

  // — Materiales
  const [materiales, setMateriales] = useState([])
  const [nuevoMat, setNuevoMat] = useState({
    title: '', type: 'pdf', source_type: 'upload', file: null, url: '',
    folder: 'General', description: '', is_shared: true, uploading: false, uploadProgress: 0,
  })
  const [matError, setMatError] = useState(null)
  const [guardandoMat, setGuardandoMat] = useState(false)

  // — Modales inline
  const [showCatModal, setShowCatModal] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [showProfModal, setShowProfModal] = useState(false)
  const [nuevaProfesion, setNuevaProfesion] = useState('')

  // — CSV
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importOk, setImportOk] = useState(null)

  // — Warnings de consistencia
  const [warnings, setWarnings] = useState([])

  // ==========================================================================
  // HELPER: package_id de esta evaluación
  // ==========================================================================
  const obtenerPackageId = useCallback(() => getPackageIdFromEvaluation(id), [id])

  // ==========================================================================
  // CARGA INICIAL
  // ==========================================================================
  useEffect(() => {
    cargarCategorias()
    cargarProfesiones()
    if (isEdit) {
      cargarEvaluacion()
      cargarVersiones()
      cargarMateriales()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function cargarCategorias() {
    const { data } = await supabase.from('categories').select('id, name').order('name')
    setCategorias(data || [])
  }

  async function cargarProfesiones() {
    const { data, error } = await supabase.from('professions').select('id, name').order('name')
    if (error) { addToast('error', 'Error al cargar profesiones: ' + error.message); return }
    setProfesiones(data || [])
  }

  async function cargarEvaluacion() {
    const { data: ev, error } = await supabase.from('evaluations').select('*').eq('id', id).maybeSingle()
    if (error) { addToast('error', 'Error al cargar evaluación: ' + error.message); return }
    if (ev) setForm({ title: ev.title, description: ev.description || '', category_id: ev.category_id || '', is_active: ev.is_active })

    const { data: lvs, error: lvError } = await supabase.from('levels').select('*').eq('evaluation_id', id).order('sort_order')
    if (lvError) { addToast('error', 'Error al cargar niveles: ' + lvError.message); return }
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
    const packageId = await obtenerPackageId()
    if (!packageId) { setVersiones([]); return }

    const { data: vers, error } = await supabase
      .from('package_versions').select('*').eq('package_id', packageId).order('sort_order', { ascending: true })
    if (error) { addToast('error', 'Error al cargar versiones: ' + error.message); return }
    if (!vers?.length) { setVersiones([]); return }

    const versionIds = vers.map(v => v.id)
    const { data: pvLevels } = await supabase
      .from('package_version_levels').select('package_version_id, level_id').in('package_version_id', versionIds)
    const levelMap = {}
    pvLevels?.forEach(row => { levelMap[row.package_version_id] = row.level_id })

    const { data: lvs } = await supabase.from('levels').select('id, name').eq('evaluation_id', parseInt(id, 10))
    const levelNameMap = {}
    lvs?.forEach(l => { levelNameMap[l.id] = l.name })

    const versionesBase = vers.map(v => {
      const lvId = levelMap[v.id] || null
      return { ...v, level_id: lvId, level_display: lvId ? (levelNameMap[lvId] || '') : '', profession_display: '' }
    })
    setVersiones(versionesBase)

    const profIds = [...new Set(vers.map(v => v.profession_id).filter(Boolean))]
    if (profIds.length) {
      const { data: profs } = await supabase.from('professions').select('id, name').in('id', profIds)
      if (profs?.length) {
        setVersiones(prev => prev.map(v => ({
          ...v, profession_display: profs.find(p => p.id === v.profession_id)?.name || '',
        })))
      }
    }
  }

  async function cargarMateriales() {
    const packageId = await obtenerPackageId()
    if (!packageId) { setMateriales([]); return }
    const { data, error } = await supabase.from('study_materials').select('*').eq('package_id', packageId).order('folder').order('sort_order')
    if (error) { addToast('error', 'Error al cargar materiales: ' + error.message); return }
    setMateriales(data || [])
  }

  // ==========================================================================
  // CATEGORÍAS
  // ==========================================================================
  async function agregarCategoria() {
    const nombre = nuevaCategoria.trim()
    if (!nombre) { addToast('warning', 'Escribe un nombre para la categoría'); return }
    setGuardandoCat(true)
    try {
      const { data, error } = await supabase.from('categories').insert({ name: nombre }).select().single()
      if (error) throw error
      setCategorias(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setForm(f => ({ ...f, category_id: data.id }))
      setNuevaCategoria('')
      setShowCatModal(false)
      addToast('success', 'Categoría creada y seleccionada correctamente')
    } catch (err) {
      addToast('error', 'Error al crear categoría: ' + err.message)
    } finally {
      setGuardandoCat(false)
    }
  }

  // ==========================================================================
  // PROFESIONES
  // ==========================================================================
  async function agregarProfesion() {
    const nombre = nuevaProfesion.trim()
    if (!nombre) { addToast('warning', 'Escribe un nombre para la profesión'); return }
    const { data, error } = await supabase.from('professions').insert({ name: nombre }).select().single()
    if (error) { addToast('error', 'Error al crear profesión: ' + error.message); return }
    setProfesiones(prev => [...prev, data])
    setNuevaProfesion('')
    setShowProfModal(false)
    addToast('success', 'Profesión creada correctamente')
  }

  // ==========================================================================
  // VERSIONES — CRUD
  // ==========================================================================
  async function agregarVersion() {
    const packageId = await obtenerPackageId()
    if (!packageId) { addToast('warning', 'Primero guarda o publica el paquete para poder agregar versiones.'); return }
    const { data, error } = await supabase
      .from('package_versions')
      .insert({ package_id: packageId, profession_id: null, display_name: 'Nueva versión', price: 0, is_active: true, sort_order: versiones.length })
      .select().single()
    if (error) { addToast('error', 'No se pudo agregar la versión: ' + error.message); return }
    if (data) setVersiones(prev => [...prev, { ...data, level_id: null, level_display: '', profession_display: '' }])
  }

  async function duplicarVersion(version) {
    const packageId = await obtenerPackageId()
    if (!packageId) return
    const { data, error } = await supabase
      .from('package_versions')
      .insert({
        package_id: packageId, display_name: `${version.display_name} (copia)`,
        price: version.price, is_active: version.is_active,
        profession_id: version.profession_id || null, sort_order: versiones.length,
      })
      .select().single()
    if (error) { addToast('error', 'No se pudo duplicar la versión: ' + error.message); return }
    if (data) {
      setVersiones(prev => [...prev, { ...data, level_id: version.level_id, level_display: version.level_display || '', profession_display: version.profession_display || '' }])
      if (version.level_id) {
        await supabase.from('package_version_levels').insert({ package_version_id: data.id, level_id: version.level_id })
      }
      addToast('success', 'Versión duplicada')
    }
  }

  async function actualizarVersion(versionId, campo, valor) {
    const versionPrevia = versiones.find(v => v.id === versionId)
    const valorPrevio = versionPrevia?.[campo]

    // Update optimista
    setVersiones(prev => prev.map(v => v.id === versionId ? { ...v, [campo]: valor } : v))

    const { error } = await supabase.from('package_versions').update({ [campo]: valor }).eq('id', versionId)
    if (error) {
      // Revertir al valor previo real
      setVersiones(prev => prev.map(v => v.id === versionId ? { ...v, [campo]: valorPrevio } : v))
      const msg = `Error al guardar cambio en versión: ${error.message}`
      addToast('error', msg)
      setErrorBloque({ seccion: 'profesiones', message: msg })
    }
  }

  function handleProfesionDisplayChange(versionId, texto) {
    const match = profesiones.find(p => p.name.toLowerCase() === texto.toLowerCase())
    setVersiones(prev => prev.map(v =>
      v.id === versionId ? { ...v, profession_display: texto, profession_id: match ? match.id : null } : v
    ))
    if (match) {
      supabase.from('package_versions').update({ profession_id: match.id }).eq('id', versionId).then(({ error }) => {
        if (error) addToast('error', `Error al guardar profesión: ${error.message}`)
      })
    } else if (texto === '') {
      supabase.from('package_versions').update({ profession_id: null }).eq('id', versionId).then(({ error }) => {
        if (error) addToast('error', `Error al limpiar profesión: ${error.message}`)
      })
    }
  }

  function handleLevelDisplayChange(versionId, texto) {
    const match = niveles.find(n => n.name.toLowerCase() === texto.toLowerCase())
    const levelId = match ? (typeof match._id === 'number' ? match._id : null) : null
    setVersiones(prev => prev.map(v =>
      v.id === versionId ? { ...v, level_display: texto, level_id: levelId } : v
    ))
  }

  async function eliminarVersion(versionId) {
    if (!confirm('¿Eliminar esta versión?')) return
    const { error: e1 } = await supabase.from('package_version_levels').delete().eq('package_version_id', versionId)
    if (e1) { addToast('error', 'Error al eliminar relaciones de nivel: ' + e1.message); return }
    const { error: e2 } = await supabase.from('package_versions').delete().eq('id', versionId)
    if (e2) { addToast('error', 'Error al eliminar versión: ' + e2.message); return }
    setVersiones(prev => prev.filter(v => v.id !== versionId))
    addToast('info', 'Versión eliminada')
  }

  // ==========================================================================
  // MATERIALES — CRUD
  // ==========================================================================
  async function agregarMaterial() {
    setMatError(null)
    if (!nuevoMat.title.trim()) { const m = 'El título es obligatorio'; setMatError(m); addToast('warning', m); return }
    if (nuevoMat.source_type === 'link' && !nuevoMat.url.trim()) { const m = 'La URL es obligatoria'; setMatError(m); addToast('warning', m); return }
    if (nuevoMat.source_type === 'upload' && !nuevoMat.file) { const m = 'Selecciona un archivo'; setMatError(m); addToast('warning', m); return }

    const packageId = await obtenerPackageId()
    if (!packageId) { const m = 'Guarda el paquete primero para poder agregar materiales.'; setMatError(m); addToast('warning', m); return }

    setGuardandoMat(true)
    setNuevoMat(m => ({ ...m, uploading: true, uploadProgress: 0 }))

    try {
      let finalUrl = '', storagePath = '', fileSize = 0, mimeType = '', tipoFinal = nuevoMat.type

      if (nuevoMat.source_type === 'upload' && nuevoMat.file) {
        const file = nuevoMat.file
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        storagePath = `study_materials/${packageId}/${fileName}`
        fileSize = file.size
        mimeType = file.type

        if (mimeType.includes('video')) tipoFinal = 'video'
        else if (mimeType.includes('pdf')) tipoFinal = 'pdf'
        else if (mimeType.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) tipoFinal = 'doc'

        const { error: uploadError } = await supabase.storage.from('materials').upload(storagePath, file, { cacheControl: '3600', upsert: false })
        if (uploadError) throw new Error('Error al subir al storage: ' + uploadError.message)

        const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(storagePath)
        finalUrl = publicUrl
      } else {
        finalUrl = nuevoMat.url
        storagePath = null
      }

      const payload = {
        package_id: packageId, title: nuevoMat.title, type: tipoFinal,
        source_type: nuevoMat.source_type, url: finalUrl, storage_path: storagePath,
        mime_type: mimeType, file_size: fileSize, folder: nuevoMat.folder || 'General',
        description: nuevoMat.description, sort_order: materiales.length, is_active: true, is_shared: nuevoMat.is_shared,
      }

      const { data: material, error: insertError } = await supabase.from('study_materials').insert(payload).select().single()
      if (insertError) throw new Error('Error al guardar el material: ' + insertError.message)

      const versionesActivas = versiones.filter(v => v.is_active)
      if (versionesActivas.length > 0) {
        const relaciones = versionesActivas.map(v => ({ study_material_id: material.id, package_version_id: v.id }))
        const { error: relError } = await supabase.from('study_material_versions').insert(relaciones)
        if (relError) console.error('Error al vincular material con versiones:', relError)
      }

      setMateriales(prev => [...prev, material])
      setNuevoMat({ title: '', type: 'pdf', source_type: 'upload', file: null, url: '', folder: 'General', description: '', is_shared: true, uploading: false, uploadProgress: 0 })
      setMatError(null)
      addToast('success', 'Material agregado correctamente')
    } catch (err) {
      const msg = err.message || 'Error desconocido al subir material'
      setMatError(msg); addToast('error', msg)
    } finally {
      setGuardandoMat(false)
      setNuevoMat(m => ({ ...m, uploading: false }))
    }
  }

  async function eliminarMaterial(matId) {
    const material = materiales.find(m => m.id === matId)
    if (material?.storage_path) {
      const { error } = await supabase.storage.from('materials').remove([material.storage_path])
      if (error) addToast('warning', 'No se pudo eliminar el archivo del storage: ' + error.message)
    }
    await supabase.from('study_material_versions').delete().eq('study_material_id', matId)
    await supabase.from('study_materials').delete().eq('id', matId)
    setMateriales(prev => prev.filter(m => m.id !== matId))
    addToast('info', 'Material eliminado')
  }

  // ==========================================================================
  // NIVELES — CRUD
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
    setPreguntas(prev => ({ ...prev, [_id]: pregsOriginales.map(p => ({ ...p, _id: Math.random().toString(36).slice(2) })) }))
    addToast('success', 'Nivel duplicado con sus preguntas')
  }

  function actualizarNivel(_id, datos) {
    setNiveles(prev => prev.map(n => n._id === _id ? { ...n, ...datos } : n))
  }

  function eliminarNivel(_id) {
    if (niveles.length === 1) return
    setNiveles(prev => prev.filter(n => n._id !== _id))
    setPreguntas(prev => { const copy = { ...prev }; delete copy[_id]; return copy })
    const siguiente = niveles.find(n => n._id !== _id)?._id
    if (siguiente) setNivelActivo(siguiente)
  }

  // ==========================================================================
  // PREGUNTAS — CRUD
  // ==========================================================================
  function agregarPregunta(moduloInicial = '') {
    const nueva = { ...preguntaVacia(), area: moduloInicial }
    setPreguntas(prev => ({ ...prev, [nivelActivo]: [...(prev[nivelActivo] || []), nueva] }))
    setPregExpandida(nueva._id)
  }

  function actualizarPregunta(nId, pregId, datos) {
    setPreguntas(prev => ({ ...prev, [nId]: prev[nId].map(p => p._id === pregId ? { ...p, ...datos } : p) }))
  }

  function eliminarPregunta(nId, pregId) {
    setPreguntas(prev => ({ ...prev, [nId]: prev[nId].filter(p => p._id !== pregId) }))
  }

  function duplicarPreguntaMismoNivel(nId, preg) {
    const copia = { ...preg, _id: Math.random().toString(36).slice(2) }
    setPreguntas(prev => {
      const arr = [...(prev[nId] || [])]
      const idx = arr.findIndex(p => p._id === preg._id)
      arr.splice(idx + 1, 0, copia)
      return { ...prev, [nId]: arr }
    })
    addToast('success', 'Pregunta duplicada')
  }

  function duplicarPreguntaANivel(preg, destinoNivelId) {
    const copia = { ...preg, _id: Math.random().toString(36).slice(2) }
    setPreguntas(prev => ({ ...prev, [destinoNivelId]: [...(prev[destinoNivelId] || []), copia] }))
    const nombreDestino = niveles.find(n => n._id === destinoNivelId)?.name || 'otro nivel'
    addToast('success', `Pregunta duplicada al nivel "${nombreDestino}"`)
  }

  // ==========================================================================
  // CSV
  // ==========================================================================
  function importarCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setImportError(null); setImportOk(null)

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const raw = String(event.target?.result || '').replace(/\r/g, '').split('\n').filter(Boolean)
        if (raw.length < 2) throw new Error('El archivo CSV no tiene suficientes filas (mínimo encabezado + 1 pregunta).')

        const header = parseCSVLine(raw[0]).map(h => h.toLowerCase())
        const reqs = ['enunciado', 'a', 'b', 'c', 'd', 'correcta']
        const missing = reqs.filter(r => !header.includes(r))
        if (missing.length) throw new Error(`Faltan columnas obligatorias: ${missing.join(', ')}. Descarga la plantilla para ver el formato correcto.`)

        const nuevas = raw.slice(1).map((line, i) => {
          const cols = parseCSVLine(line)
          const get = key => cols[header.indexOf(key)] || ''
          const correcta = get('correcta').toUpperCase()
          if (!LETRAS.includes(correcta)) throw new Error(`Fila ${i + 2}: el campo "correcta" debe ser A, B, C o D. Valor encontrado: "${get('correcta')}"`)
          return {
            _id: Math.random().toString(36).slice(2),
            text: get('enunciado'), explanation: get('explicacion'),
            difficulty: get('dificultad') || 'medio', area: get('area') || '',
            options: LETRAS.map(letter => ({ letter, text: get(letter.toLowerCase()), is_correct: letter === correcta })),
          }
        })

        setPreguntas(prev => ({ ...prev, [nivelActivo]: [...(prev[nivelActivo] || []), ...nuevas] }))
        const nivelNombre = niveles.find(n => n._id === nivelActivo)?.name || 'nivel activo'
        setImportOk(`✅ ${nuevas.length} pregunta${nuevas.length !== 1 ? 's' : ''} importada${nuevas.length !== 1 ? 's' : ''} correctamente al ${modoGuiado ? 'banco' : 'nivel'} "${nivelNombre}".`)
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
    const PROMPT = `Convierte este material en preguntas para un archivo CSV con esta estructura exacta:\narea,dificultad,enunciado,A,B,C,D,correcta,explicacion\n\nReglas:\n- "correcta" solo puede ser A, B, C o D\n- no cambies el orden de las columnas\n- no agregues columnas extra\n- cada fila debe representar una sola pregunta\n- "dificultad" debe ser: facil, medio o dificil\n- "explicacion" debe ser breve, clara y útil para retroalimentación\n- devuelve únicamente el CSV limpio, sin markdown, sin comentarios y sin explicación adicional`
    try { await navigator.clipboard.writeText(PROMPT); setImportOk('✅ Prompt copiado.'); setTimeout(() => setImportOk(null), 2000) }
    catch { setImportError('No se pudo copiar el prompt.') }
  }

  async function copiarInstruccionesExcel() {
    const texto = `Instrucciones para preparar el archivo:\n1. Abrir Excel o Google Sheets\n2. Crear columnas: ${CSV_COLUMNS.join(',')}\n3. Una fila = una pregunta\n4. En "correcta" usar solo A, B, C o D\n5. Guardar como CSV UTF-8`
    try { await navigator.clipboard.writeText(texto); setImportOk('✅ Instrucciones copiadas.'); setTimeout(() => setImportOk(null), 2000) }
    catch { setImportError('No se pudo copiar.') }
  }

  // ==========================================================================
  // WARNINGS
  // ==========================================================================
  const calcularWarnings = useCallback(() => {
    const warns = []
    const versionesActivas = versiones.filter(v => v.is_active)

    const nombres = versionesActivas.map(v => v.display_name?.trim().toLowerCase()).filter(Boolean)
    const duplicados = nombres.filter((n, i) => nombres.indexOf(n) !== i)
    if (duplicados.length) warns.push(`Hay versiones activas con el mismo nombre: "${duplicados[0]}". Cada versión debe tener un nombre único.`)

    const levelIdsUsados = new Set(versiones.map(v => v.level_id).filter(Boolean).map(String))
    const nivelesConId = niveles.filter(n => typeof n._id === 'number')
    const nivelesNoUsados = nivelesConId.filter(n => !levelIdsUsados.has(String(n._id)))
    if (nivelesNoUsados.length) warns.push(`${nivelesNoUsados.length} nivel(es) no están asignados a ninguna versión: ${nivelesNoUsados.map(n => n.name || 'sin nombre').join(', ')}.`)

    for (const v of versionesActivas) {
      if (v.level_display && !v.level_id) warns.push(`La versión "${v.display_name}" tiene nivel "${v.level_display}" pero no coincide con ningún nivel real.`)
      if (v.profession_display && !v.profession_id) warns.push(`La versión "${v.display_name}" tiene profesión "${v.profession_display}" que no existe en la base.`)
    }

    setWarnings(warns)
    return warns
  }, [versiones, niveles])

  useEffect(() => { calcularWarnings() }, [versiones, niveles, calcularWarnings])

  // ==========================================================================
  // VALIDACIÓN
  // ==========================================================================
  function validarAntesDeGuardar() {
    if (!form.title.trim()) throw Object.assign(new Error('El nombre del paquete es obligatorio.'), { seccion: 'general' })
    if (niveles.some(n => !n.name.trim())) throw Object.assign(new Error('Todos los niveles deben tener nombre.'), { seccion: 'niveles' })

    const versionesActivas = versiones.filter(v => v.is_active)
    if (!versionesActivas.length) throw Object.assign(new Error('Debes tener al menos una versión activa.'), { seccion: 'profesiones' })

    for (const v of versionesActivas) {
      if (!v.display_name?.trim()) throw Object.assign(new Error('Todas las versiones activas deben tener nombre.'), { seccion: 'profesiones' })
      if (!v.price || v.price <= 0) throw Object.assign(new Error(`La versión "${v.display_name}" debe tener un precio válido.`), { seccion: 'profesiones' })
      if (!v.level_id && !v.level_display) throw Object.assign(new Error(`La versión "${v.display_name}" debe tener un banco de preguntas asignado.`), { seccion: 'profesiones' })
      if (v.level_display && !v.level_id) throw Object.assign(new Error(`La versión "${v.display_name}" tiene un banco que no coincide con ningún nivel real. Selecciónalo de la lista.`), { seccion: 'profesiones' })
      if (v.level_id !== null && typeof v.level_id !== 'number') throw Object.assign(new Error(`La versión "${v.display_name}" tiene un banco que no ha sido guardado aún. Guarda los niveles primero.`), { seccion: 'niveles' })
    }

    for (const nv of niveles) {
      const pregs = preguntas[nv._id] || []
      if (pregs.length === 0 || pregs.every(p => !p.text?.trim())) throw Object.assign(new Error(`El nivel "${nv.name || 'sin nombre'}" no tiene preguntas válidas.`), { seccion: 'preguntas' })
    }
  }

  // ==========================================================================
  // GUARDADO PRINCIPAL — orquestador limpio por etapas
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
        if (!form.title.trim()) throw Object.assign(new Error('El nombre del paquete es obligatorio incluso para borrador.'), { seccion: 'general' })
      }

      // ETAPA 1: Evaluación
      setGuardadoStage('Guardando información del paquete...')
      dbg('etapa 1: saveEvaluation')
      const { evalId } = await saveEvaluation({ isEdit, id, form })

      // ETAPA 2: Niveles y preguntas
      setGuardadoStage('Guardando niveles y preguntas...')
      dbg('etapa 2: saveAllLevels', { evalId })
      await saveAllLevels({ evalId, niveles, preguntas, isEdit })

      // ETAPAS 3-7: Solo si publicando
      if (form.is_active) {
        setGuardadoStage('Configurando paquete y versiones...')
        dbg('etapa 3: savePackage')

        let packageId = await obtenerPackageId()
        const { packageId: pkgId } = await savePackage({ packageId, form, versiones, modoVersiones })
        packageId = pkgId

        dbg('etapa 4: syncPackageVersions')
        const { versionesSincronizadas } = await syncPackageVersions({ packageId, versiones })
        // Actualizar IDs de versiones nuevas en estado local
        setVersiones(prev => prev.map((v, i) => versionesSincronizadas[i] ? { ...v, id: versionesSincronizadas[i].id } : v))

        setGuardadoStage('Vinculando evaluación con versiones...')
        dbg('etapa 5: recargar y vincular versiones')
        const { data: versionesFrescas, error: fetchErr } = await supabase
          .from('package_versions').select('id, is_active').eq('package_id', packageId)
        if (fetchErr) throw Object.assign(new Error(`Error obteniendo versiones frescas: ${fetchErr.message}`), { seccion: 'profesiones' })

        await syncEvaluationVersions({ evalId, versionesFrescas })

        setGuardadoStage('Sincronizando materiales...')
        dbg('etapa 6: syncMaterials')
        const versionesActivasIds = versionesFrescas.filter(v => v.is_active).map(v => v.id)
        if (versionesActivasIds.length) {
          await syncMaterialsWithVersions({ packageId, versionesActivasIds })
        }

        setGuardadoStage('Vinculando niveles a versiones...')
        dbg('etapa 7: syncPackageVersionLevels')
        const levelMapEstado = {}
        versiones.forEach(v => { if (v.id && v.level_id) levelMapEstado[v.id] = v.level_id })
        await syncPackageVersionLevels({ versionesFrescas, levelMapEstado })

        // Recargar versiones con detalles completos
        const versionesActualizadas = await loadVersionesWithDetails({
          packageId, evalId,
          nivelesToActuales: niveles,
          profesiones,
        })
        if (versionesActualizadas) setVersiones(versionesActualizadas)
      }

      setExitoMsg(form.is_active ? 'publicado' : 'borrador')
      setGuardadoStage('¡Completado!')
      addToast('success', form.is_active ? '¡Paquete publicado correctamente!' : 'Borrador guardado')
      setTimeout(() => navigate('/admin/evaluaciones'), 1500)

    } catch (err) {
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
  // VALORES DERIVADOS
  // ==========================================================================
  const totalPregs = Object.values(preguntas).reduce((sum, arr) => sum + arr.length, 0)
  const versionesActivas = versiones.filter(v => v.is_active)
  const precioMinimo = versionesActivas.length ? Math.min(...versionesActivas.map(v => Number(v.price) || 0)) : 0
  const labels = useMemo(() => buildLabels(modoGuiado), [modoGuiado])

  const todosLosModulos = useMemo(() => {
    const areas = Object.values(preguntas).flat().map(p => p.area?.trim()).filter(Boolean)
    return [...new Set(areas)]
  }, [preguntas])

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
            {warnings.length > 0 && (
              <span className="text-xs font-bold text-tertiary bg-tertiary-container/30 px-3 py-1 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                {warnings.length} aviso{warnings.length !== 1 ? 's' : ''}
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
            {exitoMsg === 'publicado' ? (<><span className="material-symbols-outlined text-sm">check</span>¡Publicado!</>)
              : exitoMsg === 'borrador' ? (<><span className="material-symbols-outlined text-sm">draft</span>Borrador guardado</>)
              : guardando ? (guardadoStage || 'Guardando...')
              : isEdit ? 'Actualizar paquete' : 'Publicar paquete'}
          </button>
        </div>
      </header>

      {/* Banner de error */}
      {errorBloque && (
        <div className="px-8 pt-4 max-w-7xl mx-auto">
          <ErrorBanner
            error={errorBloque}
            onClose={() => setErrorBloque(null)}
            onIrASeccion={(sec) => setTab(sec)}
          />
        </div>
      )}

      {/* Indicador de etapa */}
      {guardando && guardadoStage && (
        <div className="px-8 pt-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {guardadoStage}
          </div>
        </div>
      )}

      <form id="eval-form" onSubmit={handleSubmit}>
        <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ==================== SIDEBAR ==================== */}
          <div className="space-y-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">Modo guiado</span>
                <button type="button" onClick={() => setModoGuiado(!modoGuiado)}
                  className={`w-12 h-6 rounded-full transition-all relative ${modoGuiado ? 'bg-secondary' : 'bg-outline-variant'}`}>
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
              ].map(t => {
                const tieneError = errorBloque?.seccion === t.key
                return (
                  <button key={t.key} type="button" onClick={() => setTab(t.key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left
                      ${tab === t.key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}
                      ${tieneError ? 'ring-2 ring-error/50 bg-error-container/10 text-error' : ''}`}>
                    <span className={`material-symbols-outlined text-lg ${tieneError ? 'text-error' : ''}`}>{t.icon}</span>
                    {t.label}
                    {tieneError && <span className="ml-auto w-2.5 h-2.5 rounded-full bg-error flex-shrink-0 animate-pulse" />}
                    {!tieneError && t.key === 'preguntas' && totalPregs > 0 && (
                      <span className="ml-auto text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full">{totalPregs}</span>
                    )}
                    {!tieneError && t.key === 'material' && materiales.length > 0 && (
                      <span className="ml-auto text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full">{materiales.length}</span>
                    )}
                    {!tieneError && t.key === 'profesiones' && versiones.length > 0 && (
                      <span className="ml-auto text-[10px] bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full">{versiones.length}</span>
                    )}
                  </button>
                )
              })}
            </div>

            <ChecklistPublicacion form={form} versiones={versiones} niveles={niveles} preguntas={preguntas} materiales={materiales} modoGuiado={modoGuiado} />

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
                    <button key={nv._id} type="button" onClick={() => { setNivelActivo(nv._id); setModuloActivo(null) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all ${nivelActivo === nv._id ? 'bg-primary text-on-primary shadow-md' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                      {nv.name || (modoGuiado ? 'Banco sin nombre' : 'Sin nombre')}
                      <span className="ml-2 text-[10px] opacity-70">({(preguntas[nv._id] || []).length} pregs.)</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {tab === 'preguntas' && (() => {
              const pregActivas = preguntas[nivelActivo] || []
              const modulosDelNivel = [...new Set(pregActivas.map(p => p.area?.trim()).filter(Boolean))]
              if (modulosDelNivel.length === 0) return null
              return (
                <Card className="p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                    {modoGuiado ? 'Módulos' : 'Áreas temáticas'}
                  </p>
                  <div className="space-y-1">
                    <button type="button" onClick={() => setModuloActivo(null)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!moduloActivo ? 'bg-secondary/10 text-secondary font-bold' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                      Todos ({pregActivas.length})
                    </button>
                    {modulosDelNivel.map(mod => (
                      <button key={mod} type="button" onClick={() => setModuloActivo(mod)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${moduloActivo === mod ? 'bg-secondary/10 text-secondary font-bold' : 'text-on-surface-variant hover:bg-surface-container'}`}>
                        {mod}
                        <span className="ml-1 opacity-60">({pregActivas.filter(p => p.area?.trim() === mod).length})</span>
                      </button>
                    ))}
                  </div>
                </Card>
              )
            })()}

            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Resumen rápido</p>
              <div className="space-y-2 text-xs text-on-surface-variant">
                <div className="flex justify-between"><span>{modoGuiado ? 'Planes activos' : 'Versiones activas'}</span><span className="font-bold text-on-surface">{versionesActivas.length}</span></div>
                <div className="flex justify-between"><span>Precio base</span><span className="font-bold text-on-surface">${precioMinimo.toLocaleString('es-CO')}</span></div>
                <div className="flex justify-between"><span>Materiales</span><span className="font-bold text-on-surface">{materiales.length}</span></div>
                <div className="flex justify-between">
                  <span>Estado</span>
                  <span className={`font-bold ${form.is_active ? 'text-secondary' : 'text-tertiary'}`}>{form.is_active ? 'Publicado' : 'Borrador'}</span>
                </div>
              </div>
            </Card>

            {warnings.length > 0 && (
              <Card className="p-4 border border-tertiary/20 bg-tertiary-container/10">
                <p className="text-xs font-bold uppercase tracking-widest text-tertiary mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Avisos de consistencia
                </p>
                <ul className="space-y-1">
                  {warnings.map((w, i) => <li key={i} className="text-xs text-on-surface-variant">{w}</li>)}
                </ul>
              </Card>
            )}
          </div>

          {/* ==================== CONTENIDO PRINCIPAL ==================== */}
          <div className="lg:col-span-2 space-y-6">
            {tab === 'general' && (
              <GeneralSection
                form={form} setForm={setForm}
                categorias={categorias}
                showCatModal={showCatModal} setShowCatModal={setShowCatModal}
                nuevaCategoria={nuevaCategoria} setNuevaCategoria={setNuevaCategoria}
                guardandoCat={guardandoCat}
                onAgregarCategoria={agregarCategoria}
              />
            )}

            {tab === 'profesiones' && (
              <VersionsSection
                id={id} versiones={versiones} niveles={niveles} profesiones={profesiones}
                modoVersiones={modoVersiones} setModoVersiones={setModoVersiones}
                modoGuiado={modoGuiado} labels={labels}
                showProfModal={showProfModal} setShowProfModal={setShowProfModal}
                nuevaProfesion={nuevaProfesion} setNuevaProfesion={setNuevaProfesion}
                onAgregarVersion={agregarVersion}
                onDuplicarVersion={duplicarVersion}
                onActualizarVersion={actualizarVersion}
                onEliminarVersion={eliminarVersion}
                onProfesionChange={handleProfesionDisplayChange}
                onLevelChange={handleLevelDisplayChange}
                onAgregarProfesion={agregarProfesion}
              />
            )}

            {tab === 'niveles' && (
              <LevelsSection
                niveles={niveles} preguntas={preguntas}
                modoGuiado={modoGuiado} labels={labels}
                onAgregarNivel={agregarNivel}
                onActualizarNivel={actualizarNivel}
                onEliminarNivel={eliminarNivel}
                onDuplicarNivel={duplicarNivel}
                onVerPreguntas={(_id) => { setNivelActivo(_id); setModuloActivo(null); setTab('preguntas') }}
              />
            )}

            {tab === 'preguntas' && (
              <QuestionsSection
                niveles={niveles} nivelActivo={nivelActivo}
                preguntas={preguntas}
                pregExpandida={pregExpandida} setPregExpandida={setPregExpandida}
                moduloActivo={moduloActivo} setModuloActivo={setModuloActivo}
                modoGuiado={modoGuiado}
                todosLosModulos={todosLosModulos}
                onAgregarPregunta={agregarPregunta}
                onActualizarPregunta={actualizarPregunta}
                onEliminarPregunta={eliminarPregunta}
                onDuplicarPreguntaMismoNivel={duplicarPreguntaMismoNivel}
                onDuplicarPreguntaANivel={duplicarPreguntaANivel}
              />
            )}

            {tab === 'material' && (
              <MaterialSection
                id={id} materiales={materiales} versiones={versiones}
                nuevoMat={nuevoMat} setNuevoMat={setNuevoMat}
                matError={matError} setMatError={setMatError}
                guardandoMat={guardandoMat}
                onAgregarMaterial={agregarMaterial}
                onEliminarMaterial={eliminarMaterial}
              />
            )}

            {tab === 'importar' && (
              <CsvImportSection
                nivelActivo={nivelActivo} niveles={niveles} modoGuiado={modoGuiado}
                csvRef={csvRef}
                importando={importando} importError={importError} importOk={importOk}
                onImportar={importarCSV}
                onDescargarPlantilla={descargarPlantilla}
                onCopiarPromptIA={copiarPromptIA}
                onCopiarInstrucciones={copiarInstruccionesExcel}
                setImportError={setImportError}
                setImportOk={setImportOk}
              />
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
