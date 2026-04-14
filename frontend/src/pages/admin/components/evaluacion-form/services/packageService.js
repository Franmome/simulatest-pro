import { supabase } from '../../../../../utils/supabase'
import { DEBUG_EVAL_FORM } from '../lib/constants'

function dbg(msg, data) {
  if (DEBUG_EVAL_FORM) console.log(`[PackageService] ${msg}`, data ?? '')
}

function tagError(message, seccion) {
  return Object.assign(new Error(message), { seccion })
}

// ============================================================================
// OBTENER PACKAGE ID
// ============================================================================
export async function getPackageIdFromEvaluation(evalId) {
  if (!evalId) return null
  const { data: evalVers } = await supabase
    .from('evaluation_versions')
    .select('package_version_id')
    .eq('evaluation_id', parseInt(evalId, 10))

  if (!evalVers?.length) return null

  const versionIds = evalVers.map(ev => ev.package_version_id)
  const { data: versData } = await supabase
    .from('package_versions')
    .select('package_id')
    .in('id', versionIds)

  return versData?.[0]?.package_id || null
}

// ============================================================================
// PAQUETE
// ============================================================================
export async function savePackage({ packageId, form, versiones, modoVersiones }) {
  dbg('savePackage start', { packageId })

  const versionesActivas = versiones.filter(v => v.is_active)
  const precioBase = versionesActivas.length
    ? Math.min(...versionesActivas.map(v => Number(v.price) || 0))
    : 0

  const payload = {
    name: form.title, description: form.description, base_price: precioBase,
    package_type: 'normal', duration_days: 365, is_active: true,
    pricing_mode: modoVersiones === 'simple' ? 'global' : 'per_profession',
    content_mode: 'shared', has_study_material: true, has_practice_mode: true,
    has_exam_mode: true, has_online_room: true,
    has_level_selector: versionesActivas.length > 1,
  }

  if (packageId) {
    const { error } = await supabase.from('packages').update(payload).eq('id', packageId)
    if (error) throw tagError(`Error guardando el paquete: ${error.message}`, 'general')
    dbg('savePackage updated', packageId)
    return { packageId }
  }

  const { data: newPkg, error } = await supabase.from('packages').insert(payload).select('id').single()
  if (error) throw tagError(`Error creando el paquete: ${error.message}`, 'general')
  dbg('savePackage created', newPkg.id)
  return { packageId: newPkg.id }
}

// ============================================================================
// VERSIONES
// ============================================================================
export async function syncPackageVersions({ packageId, versiones }) {
  dbg('syncPackageVersions start', { packageId, count: versiones.length })

  const { data: versionesEnBD } = await supabase.from('package_versions').select('id').eq('package_id', packageId)
  const idsEnBD = new Set((versionesEnBD || []).map(v => v.id))
  const idsEnEstado = new Set(versiones.filter(v => v.id).map(v => v.id))

  // Eliminar versiones que ya no existen en estado
  for (const v of (versionesEnBD || [])) {
    if (!idsEnEstado.has(v.id)) {
      await supabase.from('package_versions').delete().eq('id', v.id)
    }
  }

  // Upsert versiones actuales
  const versionesSincronizadas = []
  for (let i = 0; i < versiones.length; i++) {
    const v = versiones[i]
    const versionData = {
      package_id: packageId, display_name: v.display_name, price: v.price,
      is_active: v.is_active, sort_order: i,
      profession_id: v.profession_id || null,
    }

    if (v.id && idsEnBD.has(v.id)) {
      const { error } = await supabase.from('package_versions').update(versionData).eq('id', v.id)
      if (error) throw tagError(`Error actualizando versión "${v.display_name}": ${error.message}`, 'profesiones')
      versionesSincronizadas.push({ ...v })
    } else {
      const { data: nueva, error } = await supabase.from('package_versions').insert(versionData).select('id').single()
      if (error) throw tagError(`Error creando versión "${v.display_name}": ${error.message}`, 'profesiones')
      versionesSincronizadas.push({ ...v, id: nueva.id })
    }
  }

  dbg('syncPackageVersions done', versionesSincronizadas.length)
  return { versionesSincronizadas }
}

// ============================================================================
// RELACIÓN EVALUATION ↔ VERSIONS
// ============================================================================
export async function syncEvaluationVersions({ evalId, versionesFrescas }) {
  dbg('syncEvaluationVersions', { evalId, count: versionesFrescas.length })

  const { error: delErr } = await supabase.from('evaluation_versions').delete().eq('evaluation_id', evalId)
  if (delErr) throw tagError(`Error limpiando relaciones de evaluación: ${delErr.message}`, 'profesiones')

  const activas = versionesFrescas.filter(v => v.is_active)
  if (activas.length) {
    const relaciones = activas.map(v => ({ evaluation_id: evalId, package_version_id: v.id }))
    const { error } = await supabase.from('evaluation_versions').insert(relaciones)
    if (error) throw tagError(`Error vinculando evaluación con versiones: ${error.message}`, 'profesiones')
  }
  dbg('syncEvaluationVersions done')
}

// ============================================================================
// MATERIALES ↔ VERSIONES
// ============================================================================
export async function syncMaterialsWithVersions({ packageId, versionesActivasIds }) {
  if (!packageId || !versionesActivasIds.length) return
  dbg('syncMaterials', { packageId, versionesActivasIds })

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
      if (!existentes.has(`${matId}:${versionId}`)) {
        nuevas.push({ study_material_id: matId, package_version_id: versionId })
      }
    }
  }

  const versionesActivasSet = new Set(versionesActivasIds.map(String))
  const eliminar = (relacionesActuales || []).filter(r => !versionesActivasSet.has(String(r.package_version_id)))
  for (const r of eliminar) {
    await supabase.from('study_material_versions')
      .delete().eq('study_material_id', r.study_material_id).eq('package_version_id', r.package_version_id)
  }

  if (nuevas.length) {
    const { error } = await supabase.from('study_material_versions').insert(nuevas)
    if (error) throw tagError(`Error vinculando materiales: ${error.message}`, 'material')
  }
  dbg('syncMaterials done')
}

// ============================================================================
// NIVELES ↔ VERSIONES
// ============================================================================
export async function syncPackageVersionLevels({ versionesFrescas, levelMapEstado }) {
  dbg('syncPackageVersionLevels', { count: versionesFrescas.length })
  if (!versionesFrescas.length) return

  const versionIds = versionesFrescas.map(v => v.id)
  const { error: delErr } = await supabase.from('package_version_levels').delete().in('package_version_id', versionIds)
  if (delErr) throw tagError(`Error limpiando vínculos de niveles: ${delErr.message}`, 'profesiones')

  const nuevasRelaciones = versionesFrescas
    .filter(v => levelMapEstado[v.id])
    .map(v => ({ package_version_id: v.id, level_id: levelMapEstado[v.id] }))

  if (nuevasRelaciones.length) {
    const { error } = await supabase.from('package_version_levels').insert(nuevasRelaciones)
    if (error) throw tagError(`Error vinculando niveles a versiones: ${error.message}`, 'profesiones')
  }
  dbg('syncPackageVersionLevels done')
}

// ============================================================================
// RECARGAR VERSIONES CON DETALLES COMPLETOS
// ============================================================================
export async function loadVersionesWithDetails({ packageId, evalId, nivelesToActuales, profesiones }) {
  const { data: versionesFinales } = await supabase
    .from('package_versions').select('*').eq('package_id', packageId).order('sort_order', { ascending: true })
  if (!versionesFinales) return null

  const allVersionIds = versionesFinales.map(v => v.id)
  const { data: pvLevels } = await supabase
    .from('package_version_levels').select('package_version_id, level_id').in('package_version_id', allVersionIds)

  const levelMap = {}
  pvLevels?.forEach(row => { levelMap[row.package_version_id] = row.level_id })

  return versionesFinales.map(v => ({
    ...v,
    level_id: levelMap[v.id] || null,
    level_display: levelMap[v.id]
      ? (nivelesToActuales.find(n => n._id === levelMap[v.id] || n.id === levelMap[v.id])?.name || '')
      : '',
    profession_display: profesiones.find(p => p.id === v.profession_id)?.name || '',
  }))
}
