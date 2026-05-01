// hooks/useMaterialesManager.js
// Gestiona el estado y CRUD de materiales de estudio (study_materials + storage).

import { useState } from 'react'
import { supabase } from '../../../../../utils/supabase'
import { NUEVO_MAT_DEFAULTS } from '../lib/defaults'

export function useMaterialesManager({
  savedPkgId,
  savedPkgIdRef,
  setSavedPkg,
  versiones,
  obtenerPackageId,
  addToast,
}) {
  const [materiales, setMateriales] = useState([])
  const [nuevoMat, setNuevoMat] = useState({ ...NUEVO_MAT_DEFAULTS })
  const [matError, setMatError] = useState(null)
  const [guardandoMat, setGuardandoMat] = useState(false)

  // ── Carga inicial ────────────────────────────────────────────────────────────

  async function cargarMateriales() {
    const packageId = await obtenerPackageId()
    if (!packageId) { setMateriales([]); return }

    const { data, error } = await supabase
      .from('study_materials')
      .select('*')
      .eq('package_id', packageId)
      .order('folder')
      .order('sort_order')

    if (error) { addToast('error', 'Error al cargar materiales: ' + error.message); return }
    setMateriales(data || [])
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function agregarMaterial() {
    setMatError(null)

    if (!nuevoMat.title.trim()) {
      const m = 'El título es obligatorio'
      setMatError(m); addToast('warning', m); return
    }
    if (nuevoMat.source_type === 'link' && !nuevoMat.url.trim()) {
      const m = 'La URL es obligatoria'
      setMatError(m); addToast('warning', m); return
    }
    if (nuevoMat.source_type === 'upload' && !nuevoMat.file) {
      const m = 'Selecciona un archivo'
      setMatError(m); addToast('warning', m); return
    }

    const packageId = savedPkgId || await obtenerPackageId()
    if (!packageId || packageId < 0) {
      const m = 'Guarda el paquete primero para poder agregar materiales.'
      setMatError(m); addToast('warning', m); return
    }
    if (!savedPkgId || savedPkgId < 0) { setSavedPkg(packageId) }

    setGuardandoMat(true)
    setNuevoMat(m => ({ ...m, uploading: true, uploadProgress: 0 }))

    try {
      let finalUrl = ''
      let storagePath = ''
      let mimeType = ''
      let tipoFinal = nuevoMat.type

      if (nuevoMat.source_type === 'upload' && nuevoMat.file) {
        const file = nuevoMat.file
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        storagePath = `study_materials/${packageId}/${fileName}`
        mimeType = file.type

        if (mimeType.includes('video')) tipoFinal = 'video'
        else if (mimeType.includes('pdf')) tipoFinal = 'pdf'
        else if (mimeType.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc')) tipoFinal = 'doc'

        const { error: uploadError } = await supabase.storage
          .from('materials')
          .upload(storagePath, file, { cacheControl: '3600', upsert: false })

        if (uploadError) {
          const rawMsg = uploadError.message || String(uploadError)
          const rawLower = rawMsg.toLowerCase()
          let mensajeUi
          if (rawLower.includes('bucket') || uploadError.statusCode === 404) {
            mensajeUi =
              `El bucket "materials" no está disponible en Supabase Storage. ` +
              `Verifica que el bucket existe y tiene políticas de acceso configuradas. ` +
              `Error original: ${rawMsg}`
          } else if (rawLower.includes('rls') || rawLower.includes('row-level security') || uploadError.statusCode === 403) {
            mensajeUi =
              `Sin permisos para subir archivos al bucket "materials". ` +
              `Revisa las políticas RLS de Storage en Supabase. ` +
              `Error original: ${rawMsg}`
          } else if (rawLower.includes('already exists') || uploadError.statusCode === 409) {
            mensajeUi =
              `Ya existe un archivo con ese nombre en el storage. ` +
              `El sistema genera nombres únicos automáticamente; si este error persiste, recarga la página. ` +
              `Error original: ${rawMsg}`
          } else {
            mensajeUi = `Error al subir el archivo: ${rawMsg}`
          }
          throw new Error(mensajeUi)
        }

        const { data: { publicUrl } } = supabase.storage.from('materials').getPublicUrl(storagePath)
        finalUrl = publicUrl
      } else {
        finalUrl = nuevoMat.url
        storagePath = null
      }

      const payload = {
        package_id: packageId,
        title: nuevoMat.title,
        type: tipoFinal,
        source_type: nuevoMat.source_type,
        url: finalUrl,
        storage_path: storagePath,
        folder: nuevoMat.folder || 'General',
        description: nuevoMat.description,
        sort_order: materiales.length,
        is_active: true,
        is_shared: nuevoMat.is_shared,
      }

      const { data: material, error: insertError } = await supabase
        .from('study_materials').insert(payload).select().single()

      if (insertError) {
        throw new Error(
          `Error al guardar el material en la base de datos: ${insertError.message} ` +
          `(Tabla: study_materials, operación: INSERT)`
        )
      }

      const versionesActivas = versiones.filter(v => v.is_active)
      if (versionesActivas.length > 0) {
        const relaciones = versionesActivas.map(v => ({
          study_material_id: material.id,
          package_version_id: v.id,
        }))
        const { error: relError } = await supabase
          .from('study_material_versions').insert(relaciones)
        if (relError) {
          console.warn('[MaterialesManager] Error al vincular material con versiones:', relError)
          addToast('warning', 'Material guardado pero no se pudo vincular con todas las versiones.')
        }
      }

      setMateriales(prev => [...prev, material])
      setNuevoMat({ ...NUEVO_MAT_DEFAULTS })
      setMatError(null)
      addToast('success', 'Material agregado correctamente')

    } catch (err) {
      const msg = err.message || 'Error desconocido al subir material'
      setMatError(msg)
      addToast('error', msg)
    } finally {
      setGuardandoMat(false)
      setNuevoMat(m => ({ ...m, uploading: false }))
    }
  }

  async function eliminarMaterial(matId) {
    const material = materiales.find(m => m.id === matId)

    if (material?.storage_path) {
      const { error } = await supabase.storage
        .from('materials').remove([material.storage_path])
      if (error) {
        addToast('warning', 'No se pudo eliminar el archivo del storage: ' + error.message)
      }
    }

    await supabase.from('study_material_versions').delete().eq('study_material_id', matId)
    await supabase.from('study_materials').delete().eq('id', matId)
    setMateriales(prev => prev.filter(m => m.id !== matId))
    addToast('info', 'Material eliminado')
  }

  return {
    materiales, setMateriales,
    nuevoMat, setNuevoMat,
    matError, setMatError,
    guardandoMat,
    cargarMateriales,
    agregarMaterial,
    eliminarMaterial,
  }
}
