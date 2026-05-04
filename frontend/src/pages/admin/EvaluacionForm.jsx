// frontend/src/pages/admin/EvaluacionForm.jsx
// Página principal para crear y editar paquetes de evaluación.
//
// ESTRUCTURA:
//   EvaluacionFormWrapper  → provee el sistema de toasts (contexto)
//     └─ EvaluacionFormContent → orquesta hooks + render
//
// TABS:
//   general     → nombre, descripción, categoría, estado
//   profesiones → versiones/planes con precios y niveles asignados
//   niveles     → bancos de preguntas (niveles)
//   preguntas   → edición de preguntas del nivel activo
//   material    → archivos y enlaces de estudio
//   importar    → importar preguntas desde CSV
//
// FLUJO DE GUARDADO (handleSubmit):
//   1. Validar
//   2. saveEvaluation       → tabla evaluations
//   3. saveAllLevels        → tablas levels, questions, options  ← PROTEGIDO CON TIMEOUT
//   4. savePackage          → tabla packages
//   5. syncPackageVersions  → tabla package_versions
//   6. syncEvaluationVersions → tabla evaluation_versions
//   7. syncMaterialsWithVersions → tabla study_material_versions
//   8. syncPackageVersionLevels → tabla package_version_levels
//   9. Recargar versiones y navegar a /admin/evaluaciones

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

// — Sistema Toast
import ToastProvider, { useToast } from './components/evaluacion-form/ToastProvider'

// — Primitivos UI
import Card from './components/evaluacion-form/Card'
import ErrorBanner from './components/evaluacion-form/ErrorBanner'
import ChecklistPublicacion from './components/evaluacion-form/ChecklistPublicacion'

// — Secciones por tab
import GeneralSection from './components/evaluacion-form/GeneralSection'
import VersionsSection from './components/evaluacion-form/VersionsSection'
import LevelsSection from './components/evaluacion-form/LevelsSection'
import QuestionsSection from './components/evaluacion-form/QuestionsSection'
import MaterialSection from './components/evaluacion-form/MaterialSection'
import CsvImportSection from './components/evaluacion-form/CsvImportSection'

// — Hooks de dominio
import { useNivelesManager } from './components/evaluacion-form/hooks/useNivelesManager'
import { useCsvImport } from './components/evaluacion-form/hooks/useCsvImport'
import { useVersionesManager } from './components/evaluacion-form/hooks/useVersionesManager'
import { useMaterialesManager } from './components/evaluacion-form/hooks/useMaterialesManager'
import { useEvaluacionDraft } from './components/evaluacion-form/hooks/useEvaluacionDraft'

// — Helpers, constantes y validación
import { buildLabels, withTimeout } from './components/evaluacion-form/lib/helpers'
import { LETRAS, DEBUG_EVAL_FORM } from './components/evaluacion-form/lib/constants'
import { FORM_DEFAULTS } from './components/evaluacion-form/lib/defaults'
import { validarAntesDeGuardar } from './components/evaluacion-form/lib/validation'

// — Servicios de guardado
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
// WRAPPER PÚBLICO
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

  // ── Formulario general ────────────────────────────────────────────────────
  const [form, setForm] = useState({ ...FORM_DEFAULTS })
  const [categorias, setCategorias] = useState([])
  const [profesiones, setProfesiones] = useState([])

  // ── Navegación y modo ─────────────────────────────────────────────────────
  const [tab, setTab] = useState('general')
  const [modoVersiones, setModoVersiones] = useState('avanzado')
  const [modoGuiado, setModoGuiado] = useState(false)

  // ── Modales ───────────────────────────────────────────────────────────────
  const [showCatModal, setShowCatModal] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [showProfModal, setShowProfModal] = useState(false)
  const [nuevaProfesion, setNuevaProfesion] = useState('')

  // ── Estado del guardado ───────────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false)
  const [guardadoStage, setGuardadoStage] = useState('')
  const [errorBloque, setErrorBloque] = useState(null)
  const [exitoMsg, setExitoMsg] = useState(null)

  // ── IDs guardados (compartidos entre draft y submit) ──────────────────────
  const [savedEvalId, setSavedEvalId] = useState(null)
  const [savedPkgId, setSavedPkgId] = useState(null)
  const savedPkgIdRef = useRef(null)

  // Setter combinado: mantiene estado + ref sincronizados
  function setSavedPkg(pkgId) {
    setSavedPkgId(pkgId)
    savedPkgIdRef.current = pkgId
  }

  // ── Helper: resolver package_id desde evaluación ──────────────────────────
  const obtenerPackageId = useCallback(() => getPackageIdFromEvaluation(id), [id])

  // ── Hooks de dominio ─────────────────────────────────────────────────────
  const nivelesManager = useNivelesManager({ addToast })
  const {
    niveles, setNiveles, nivelActivo, setNivelActivo,
    preguntas, setPreguntas, pregExpandida, setPregExpandida,
    moduloActivo, setModuloActivo,
    duplicarNivel, actualizarNivel, eliminarNivel,
    agregarPregunta, actualizarPregunta, eliminarPregunta,
    duplicarPreguntaMismoNivel, duplicarPreguntaANivel,
  } = nivelesManager

  const versionesManager = useVersionesManager({
    id, isEdit, niveles, profesiones,
    savedPkgId, savedPkgIdRef, setSavedPkg,
    obtenerPackageId, addToast, setErrorBloque,
  })
  const {
    versiones, setVersiones, warnings,
    cargarVersiones, agregarVersion, duplicarVersion,
    actualizarVersion, eliminarVersion,
    handleProfesionDisplayChange, handleLevelDisplayChange,
  } = versionesManager

  const materialesManager = useMaterialesManager({
    savedPkgId, savedPkgIdRef, setSavedPkg,
    versiones, obtenerPackageId, addToast,
  })
  const {
    materiales, nuevoMat, setNuevoMat,
    matError, setMatError, guardandoMat,
    cargarMateriales, agregarMaterial, eliminarMaterial,
  } = materialesManager

  const csvManager = useCsvImport({
    nivelActivo, niveles, modoGuiado, setPreguntas, addToast, csvRef,
  })
  const {
    importando, importError, setImportError,
    importOk, setImportOk,
    preview,
    procesarArchivo, confirmarImport, cancelarPreview,
    descargarPlantillaCSV, descargarPlantillaJSON,
    copiarPromptIA, copiarInstruccionesExcel,
  } = csvManager

  const draftManager = useEvaluacionDraft({
  form,
  versiones,
  modoVersiones,
  savedEvalId,
  savedPkgId,        // ✅ NUEVO: pasar savedPkgId
  setSavedEvalId,
  setSavedPkg,
  setErrorBloque,
})
  const { guardandoBorrador, borradorGuardado, handleGuardarBorrador } = draftManager

  // ── Aviso al salir con cambios sin guardar ────────────────────────────────
  useEffect(() => {
    if (!isEdit && form.title.trim()) {
      const handler = (e) => { e.preventDefault(); e.returnValue = '' }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }
  }, [isEdit, form.title])

  function handleVolver() {
    if (!isEdit && form.title.trim()) {
      if (window.confirm('¿Guardar borrador antes de salir?')) {
        handleGuardarBorrador().then(() => navigate('/admin/evaluaciones'))
        return
      }
    }
    navigate('/admin/evaluaciones')
  }

  // ── agregarNivel: wrapper que también cambia de tab ───────────────────────
  function agregarNivel() {
    nivelesManager.agregarNivel()
    setTab('niveles')
  }

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

  // Carga la evaluación, sus niveles y todas sus preguntas con opciones
  async function cargarEvaluacion() {
    const { data: ev, error } = await supabase
      .from('evaluations').select('*').eq('id', id).maybeSingle()
    if (error) { addToast('error', 'Error al cargar evaluación: ' + error.message); return }
    if (ev) {
      // Cargar has_ai_chat desde el paquete vinculado
      let hasAiChat = false
      const pkgId = await getPackageIdFromEvaluation(id)
      if (pkgId) {
        setSavedPkg(pkgId)
        const { data: pkg } = await supabase
          .from('packages').select('has_ai_chat').eq('id', pkgId).maybeSingle()
        hasAiChat = pkg?.has_ai_chat ?? false
      }
      setForm({
        title: ev.title,
        description: ev.description || '',
        category_id: ev.category_id || '',
        is_active: ev.is_active,
        has_ai_chat: hasAiChat,
      })
    }

    const { data: lvs, error: lvError } = await supabase
      .from('levels').select('*').eq('evaluation_id', id).order('sort_order')
    if (lvError) { addToast('error', 'Error al cargar niveles: ' + lvError.message); return }

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

          pregsPorNivel[nv._id] = qs?.map(q => ({
            ...q,
            _id: q.id,
            options: LETRAS.map(letter => {
              const op = q.options?.find(o => o.letter === letter)
              return op ? { ...op } : { letter, text: '', is_correct: false }
            }),
          })) || [{ _id: Math.random().toString(36).slice(2), text: '', explanation: '', difficulty: 'medio', area: '', options: LETRAS.map(letter => ({ letter, text: '', is_correct: false })) }]
        })
      )
      setPreguntas(pregsPorNivel)
    }
  }

  // ==========================================================================
  // CATEGORÍAS
  // ==========================================================================
  async function agregarCategoria() {
    const nombre = nuevaCategoria.trim()
    if (!nombre) { addToast('warning', 'Escribe un nombre para la categoría'); return }

    setGuardandoCat(true)
    try {
      const { data, error } = await supabase
        .from('categories').insert({ name: nombre }).select().single()
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

    const { data, error } = await supabase
      .from('professions').insert({ name: nombre }).select().single()
    if (error) { addToast('error', 'Error al crear profesión: ' + error.message); return }

    setProfesiones(prev => [...prev, data])
    setNuevaProfesion('')
    setShowProfModal(false)
    addToast('success', 'Profesión creada correctamente')
  }

  // ==========================================================================
  // GUARDADO PRINCIPAL — orquestador por etapas con timeout defensivo
  // ==========================================================================
  async function handleSubmit(e) {
    e.preventDefault()
    setGuardando(true)
    setErrorBloque(null)
    setExitoMsg(null)
    setGuardadoStage('Preparando...')

    try {
      // ── Validar ────────────────────────────────────────────────────────────
      if (form.is_active) {
        validarAntesDeGuardar({ form, niveles, versiones, preguntas })
      } else {
        if (!form.title.trim()) {
          throw Object.assign(
            new Error('El nombre del paquete es obligatorio incluso para borrador.'),
            { seccion: 'general' }
          )
        }
      }

      // ETAPA 1: Guardar evaluación (título, descripción, categoría)
      setGuardadoStage('Guardando información del paquete...')
      dbg('Iniciando etapa 1: saveEvaluation')
      const { evalId } = await saveEvaluation({ isEdit, id, form })
      setSavedEvalId(evalId)
      dbg('OK etapa 1', { evalId })

      // ETAPA 2: Guardar niveles y preguntas (protegido con timeout)
      setGuardadoStage('Guardando niveles y preguntas...')
      dbg('Iniciando etapa 2: saveAllLevels')
      await withTimeout(
        saveAllLevels({ evalId, niveles, preguntas, isEdit }),
        90_000,
        'guardar niveles y preguntas'
      )
      dbg('OK etapa 2')

      // Las etapas 3-8 solo aplican si se está publicando (no borrador)
      if (form.is_active) {
        // ======================================================================
        // ETAPA 3: Guardar/actualizar el paquete
        // ======================================================================
        setGuardadoStage('Configurando paquete...')
        dbg('Iniciando etapa 3: savePackage')

        // 🔧 CAMBIO 1: Resolver packageId priorizando referencias en memoria
        const packageIdInicial =
          savedPkgIdRef.current ??
          savedPkgId ??
          await obtenerPackageId()

        let packageId = packageIdInicial

        const { packageId: pkgId } = await savePackage({ packageId, evalId, form, versiones, modoVersiones })
        packageId = pkgId
        setSavedPkg(packageId)
        dbg('OK etapa 3', { packageId })

        // ======================================================================
        // ETAPA 4: Sincronizar versiones del paquete
        // ======================================================================
        setGuardadoStage('Sincronizando versiones...')
        dbg('Iniciando etapa 4: syncPackageVersions')
        const { versionesSincronizadas } = await syncPackageVersions({ packageId, versiones })

        // 🔧 CAMBIO 2: Construir array local con IDs frescos (no depender del estado)
        const versionesConIdsFrescos = versiones.map((v, i) => ({
          ...v,
          id: versionesSincronizadas[i]?.id ?? v.id,
        }))

        // Actualizar el estado con los IDs frescos
        setVersiones(versionesConIdsFrescos)
        dbg('OK etapa 4', versionesSincronizadas.length)

        // ======================================================================
        // ETAPA 5: Vincular evaluación ↔ versiones activas
        // ======================================================================
        setGuardadoStage('Vinculando evaluación con versiones...')
        dbg('Iniciando etapa 5: syncEvaluationVersions')
        const { data: versionesFrescasBD, error: fetchErr } = await supabase
          .from('package_versions')
          .select('id, is_active')
          .eq('package_id', packageId)

        if (fetchErr) {
          throw Object.assign(
            new Error(`Error obteniendo versiones frescas: ${fetchErr.message}`),
            {
              seccion: 'profesiones',
              mensajeHumano: 'No se pudieron recargar las versiones después de guardarlas.',
              accionSugerida: 'Recarga la página y vuelve a intentar.',
              technical: `Tabla: package_versions | ${fetchErr.message}${fetchErr.code ? ` | Código: ${fetchErr.code}` : ''}`,
            }
          )
        }

        // Enriquecer con level_id del estado local (viene de package_version_levels)
        const versionesFrescas = (versionesFrescasBD || []).map(v => {
          const local = versionesConIdsFrescos.find(lv => lv.id === v.id)
          return { ...v, level_id: local?.level_id ?? null }
        })

        await syncEvaluationVersions({ evalId, versionesFrescas })
        dbg('OK etapa 5')

        // ======================================================================
        // ETAPA 6: Sincronizar materiales con versiones activas
        // ======================================================================
        setGuardadoStage('Sincronizando materiales...')
        dbg('Iniciando etapa 6: syncMaterialsWithVersions')
        const versionesActivasIds = versionesFrescas.filter(v => v.is_active).map(v => v.id)
        if (versionesActivasIds.length) {
          await syncMaterialsWithVersions({ packageId, versionesActivasIds })
        }
        dbg('OK etapa 6')

        // ======================================================================
        // ETAPA 7: Vincular niveles ↔ versiones (package_version_levels)
        // ======================================================================
        setGuardadoStage('Vinculando niveles a versiones...')
        dbg('Iniciando etapa 7: validación y syncPackageVersionLevels')

        // ✅ Validación existente: versiones activas sin level_id (no se modifica)
        const versionesActivasSinLevel = versionesFrescas.filter(v => v.is_active && !v.level_id)
        if (versionesActivasSinLevel.length > 0) {
          const idsSinLevel = versionesActivasSinLevel.map(v => v.id).join(', ')
          throw Object.assign(
            new Error(`Las siguientes versiones activas no tienen un nivel asignado: ${idsSinLevel}`),
            {
              seccion: 'profesiones',
              mensajeHumano: 'Hay versiones activas que no tienen un nivel asociado.',
              accionSugerida: 'Asigna un nivel a cada versión activa antes de publicar el paquete.',
              technical: `Versiones sin level_id: ${idsSinLevel}`,
            }
          )
        }

        // 🔧 CAMBIO 2 (continuación): Construir levelMapEstado a partir del array local
        const levelMapEstado = {}
        versionesConIdsFrescos.forEach(v => {
          if (v.id && v.level_id) {
            levelMapEstado[v.id] = v.level_id
          }
        })

        // Ejecutar sincronización
        await syncPackageVersionLevels({ versionesFrescas, levelMapEstado })
        dbg('OK etapa 7')

        // ======================================================================
        // ETAPA 8: Recargar versiones con detalles para actualizar UI
        // ======================================================================
        const versionesActualizadas = await loadVersionesWithDetails({
          packageId, evalId, nivelesToActuales: niveles, profesiones,
        })
        if (versionesActualizadas) setVersiones(versionesActualizadas)
        dbg('OK etapa 8: versiones recargadas', versionesActualizadas?.length)
      }

      // ── Éxito ──────────────────────────────────────────────────────────────
      setExitoMsg(form.is_active ? 'publicado' : 'borrador')
      setGuardadoStage('¡Completado!')
      addToast('success', form.is_active ? '¡Paquete publicado correctamente!' : 'Borrador guardado')
      setTimeout(() => navigate('/admin/evaluaciones'), 1500)

    } catch (err) {
      dbg('ERROR en handleSubmit', err)

      const mensaje = err.message || 'Error al guardar'
      setErrorBloque({
        seccion: err.seccion || 'general',
        message: mensaje,
        mensajeHumano: err.mensajeHumano || null,
        accionSugerida: err.accionSugerida || null,
        technical: err.technical || null,
      })

      addToast('error', mensaje.length > 80 ? mensaje.slice(0, 80) + '…' : mensaje)

      const tabMap = {
        general: 'general', niveles: 'niveles', preguntas: 'preguntas',
        profesiones: 'profesiones', material: 'material',
      }
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
  const precioMinimo = versionesActivas.length
    ? Math.min(...versionesActivas.map(v => Number(v.price) || 0))
    : 0
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

      {/* ── Header sticky ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-8 h-16 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleVolver}
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
          <button
            type="button"
            onClick={handleVolver}
            className="px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors"
          >
            Cancelar
          </button>
          {!isEdit && (
            <button
              type="button"
              onClick={handleGuardarBorrador}
              disabled={guardandoBorrador || borradorGuardado}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold border border-outline text-on-surface rounded-xl hover:bg-surface-container transition-colors disabled:opacity-60"
            >
              {guardandoBorrador && (
                <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {borradorGuardado
                ? '✓ Borrador guardado'
                : guardandoBorrador ? 'Guardando...'
                : savedEvalId !== null ? 'Guardar cambios'
                : 'Guardar borrador'}
            </button>
          )}
          <button
            type="submit"
            form="eval-form"
            disabled={guardando || Boolean(exitoMsg)}
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm shadow-lg hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60"
          >
            {guardando && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {exitoMsg === 'publicado'
              ? <><span className="material-symbols-outlined text-sm">check</span>¡Publicado!</>
              : exitoMsg === 'borrador'
              ? <><span className="material-symbols-outlined text-sm">draft</span>Borrador guardado</>
              : guardando
              ? (guardadoStage || 'Guardando...')
              : isEdit
              ? 'Actualizar paquete'
              : 'Publicar paquete'
            }
          </button>
        </div>
      </header>

      {/* ── Banner de error ───────────────────────────────────────────────── */}
      {errorBloque && (
        <div className="px-8 pt-4 max-w-7xl mx-auto">
          <ErrorBanner
            error={errorBloque}
            onClose={() => setErrorBloque(null)}
            onIrASeccion={(sec) => setTab(sec)}
          />
        </div>
      )}

      {/* ── Indicador de etapa mientras guarda ───────────────────────────── */}
      {guardando && guardadoStage && (
        <div className="px-8 pt-2 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 text-xs text-primary font-medium">
            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            {guardadoStage}
          </div>
        </div>
      )}

      {/* ── Formulario principal ──────────────────────────────────────────── */}
      <form id="eval-form" onSubmit={handleSubmit}>
        <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ==================== SIDEBAR ==================== */}
          <div className="space-y-6">

            {/* Toggle modo guiado */}
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

            {/* Navegación de tabs */}
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
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left
                      ${tab === t.key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container'}
                      ${tieneError ? 'ring-2 ring-error/50 bg-error-container/10 text-error' : ''}`}
                  >
                    <span className={`material-symbols-outlined text-lg ${tieneError ? 'text-error' : ''}`}>
                      {t.icon}
                    </span>
                    {t.label}
                    {tieneError && (
                      <span className="ml-auto w-2.5 h-2.5 rounded-full bg-error flex-shrink-0 animate-pulse" />
                    )}
                    {!tieneError && t.key === 'preguntas' && totalPregs > 0 && (
                      <span className="ml-auto text-[10px] bg-primary text-on-primary px-2 py-0.5 rounded-full">
                        {totalPregs}
                      </span>
                    )}
                    {!tieneError && t.key === 'material' && materiales.length > 0 && (
                      <span className="ml-auto text-[10px] bg-secondary text-on-secondary px-2 py-0.5 rounded-full">
                        {materiales.length}
                      </span>
                    )}
                    {!tieneError && t.key === 'profesiones' && versiones.length > 0 && (
                      <span className="ml-auto text-[10px] bg-tertiary text-on-tertiary px-2 py-0.5 rounded-full">
                        {versiones.length}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Checklist de publicación */}
            <ChecklistPublicacion
              form={form}
              versiones={versiones}
              niveles={niveles}
              preguntas={preguntas}
              materiales={materiales}
              modoGuiado={modoGuiado}
            />

            {/* Selector de nivel activo (visible en preguntas/importar) */}
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
                    <button
                      key={nv._id}
                      type="button"
                      onClick={() => { setNivelActivo(nv._id); setModuloActivo(null) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${nivelActivo === nv._id
                          ? 'bg-primary text-on-primary shadow-md'
                          : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                    >
                      {nv.name || (modoGuiado ? 'Banco sin nombre' : 'Sin nombre')}
                      <span className="ml-2 text-[10px] opacity-70">
                        ({(preguntas[nv._id] || []).length} pregs.)
                      </span>
                    </button>
                  ))}
                </div>
              </Card>
            )}

            {/* Filtro de módulos/áreas (solo en tab preguntas) */}
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
                    <button
                      type="button"
                      onClick={() => setModuloActivo(null)}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                        ${!moduloActivo
                          ? 'bg-secondary/10 text-secondary font-bold'
                          : 'text-on-surface-variant hover:bg-surface-container'
                        }`}
                    >
                      Todos ({pregActivas.length})
                    </button>
                    {modulosDelNivel.map(mod => (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => setModuloActivo(mod)}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${moduloActivo === mod
                            ? 'bg-secondary/10 text-secondary font-bold'
                            : 'text-on-surface-variant hover:bg-surface-container'
                          }`}
                      >
                        {mod}
                        <span className="ml-1 opacity-60">
                          ({pregActivas.filter(p => p.area?.trim() === mod).length})
                        </span>
                      </button>
                    ))}
                  </div>
                </Card>
              )
            })()}

            {/* Resumen rápido */}
            <Card className="p-4">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Resumen rápido</p>
              <div className="space-y-2 text-xs text-on-surface-variant">
                <div className="flex justify-between">
                  <span>{modoGuiado ? 'Planes activos' : 'Versiones activas'}</span>
                  <span className="font-bold text-on-surface">{versionesActivas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Precio base</span>
                  <span className="font-bold text-on-surface">
                    ${precioMinimo.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Materiales</span>
                  <span className="font-bold text-on-surface">{materiales.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Estado</span>
                  <span className={`font-bold ${form.is_active ? 'text-secondary' : 'text-tertiary'}`}>
                    {form.is_active ? 'Publicado' : 'Borrador'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Warnings de consistencia */}
            {warnings.length > 0 && (
              <Card className="p-4 border border-tertiary/20 bg-tertiary-container/10">
                <p className="text-xs font-bold uppercase tracking-widest text-tertiary mb-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">warning</span>
                  Avisos de consistencia
                </p>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="text-xs text-on-surface-variant">{w}</li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          {/* ==================== CONTENIDO PRINCIPAL ==================== */}
          <div className="lg:col-span-2 space-y-6">

            {tab === 'general' && (
              <>
                <GeneralSection
                  form={form} setForm={setForm}
                  categorias={categorias}
                  showCatModal={showCatModal} setShowCatModal={setShowCatModal}
                  nuevaCategoria={nuevaCategoria} setNuevaCategoria={setNuevaCategoria}
                  guardandoCat={guardandoCat}
                  onAgregarCategoria={agregarCategoria}
                />
                {!isEdit && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleGuardarBorrador}
                      disabled={guardandoBorrador || borradorGuardado}
                      className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-full font-bold text-sm shadow hover:-translate-y-0.5 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {guardandoBorrador && (
                        <span className="w-3 h-3 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      )}
                      {borradorGuardado
                        ? '✓ Borrador guardado'
                        : guardandoBorrador ? 'Guardando...'
                        : savedEvalId !== null ? 'Guardar cambios'
                        : 'Guardar borrador'}
                    </button>
                  </div>
                )}
              </>
            )}

            {tab === 'profesiones' && (
              <VersionsSection
                id={id} pkgId={savedPkgId} versiones={versiones} niveles={niveles} profesiones={profesiones}
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
                onVerPreguntas={(_id) => {
                  setNivelActivo(_id)
                  setModuloActivo(null)
                  setTab('preguntas')
                }}
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
                id={id} pkgId={savedPkgId} materiales={materiales} versiones={versiones}
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
                preview={preview}
                onProcesarArchivo={procesarArchivo}
                onConfirmarImport={confirmarImport}
                onCancelarPreview={cancelarPreview}
                onDescargarCSV={descargarPlantillaCSV}
                onDescargarJSON={descargarPlantillaJSON}
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