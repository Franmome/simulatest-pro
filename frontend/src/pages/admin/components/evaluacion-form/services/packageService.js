// packageService.js
// Servicio de guardado para Paquetes, Versiones y sus relaciones.
// Maneja: packages, package_versions, package_version_levels,
//         evaluation_versions, study_material_versions.

import { supabase } from '../../../../../utils/supabase'
import { DEBUG_EVAL_FORM } from '../lib/constants'
import { normalizeSupabaseError } from '../lib/helpers'

// ── helpers de log ──────────────────────────────────────────────────────────

function dbg(msg, data) {
  if (DEBUG_EVAL_FORM) console.log(`[PackageService] ${msg}`, data ?? '')
}

// Crea un Error etiquetado con sección + información técnica expandible.
function tagError(message, seccion, supaErr = null) {
  const richInfo = supaErr
    ? normalizeSupabaseError(supaErr, { etapa: message, seccion })
    : null

  return Object.assign(new Error(message), {
    seccion,
    mensajeHumano: richInfo?.mensajeHumano || message,
    accionSugerida: richInfo?.accionSugerida || '',
    technical: richInfo?.technical || '',
  })
}

// ============================================================================
// OBTENER PACKAGE ID DESDE EVALUACIÓN
// Navega evaluation_versions → package_versions → packages para encontrar
// el package_id asociado a la evaluación actual.
// Retorna null si la evaluación aún no tiene paquete (nuevo paquete).
// ============================================================================
export async function getPackageIdFromEvaluation(evalId) {
  if (!evalId) return null

  // Buscar versiones vinculadas a esta evaluación
  const { data: evalVers } = await supabase
    .from('evaluation_versions')
    .select('package_version_id')
    .eq('evaluation_id', parseInt(evalId, 10))

  if (!evalVers?.length) {
    const { data } = await supabase
      .from('packages')
      .select('id')
      .contains('evaluations_ids', [parseInt(evalId, 10)])
      .limit(1)
    return data?.[0]?.id || null
  }

  const versionIds = evalVers.map(ev => ev.package_version_id)

  // Resolver a cuál package pertenecen esas versiones
  const { data: versData } = await supabase
    .from('package_versions')
    .select('package_id')
    .in('id', versionIds)

  return versData?.[0]?.package_id || null
}

// ============================================================================
// GUARDAR PAQUETE
// Crea o actualiza el registro en `packages`.
// El precio base se deriva del mínimo entre las versiones activas.
// ============================================================================
export async function savePackage({ packageId, evalId, form, versiones, modoVersiones }) {
  dbg('Iniciando etapa: guardar paquete', { packageId })

  const versionesActivas = versiones.filter(v => v.is_active)
  const precioBase = versionesActivas.length
    ? Math.min(...versionesActivas.map(v => Number(v.price) || 0))
    : 0

  const payload = {
    name: form.title,
    description: form.description,
    price: precioBase,
    type: 'one_time',
    duration_days: 365,
    is_active: true,
    pricing_mode: modoVersiones === 'simple' ? 'global' : 'per_profession',
    content_mode: 'shared',
    has_study_material: true,
    has_practice_mode: true,
    has_exam_mode: true,
    has_online_room: true,
    has_level_selector: versionesActivas.length > 1,
  }

  if (packageId) {
    // Paquete existente → UPDATE
    const { error } = await supabase.from('packages').update(payload).eq('id', packageId)
    if (error) {
      dbg('ERROR guardando paquete', error)
      throw tagError(
        `Error guardando el paquete: ${error.message}. (Tabla: packages, operación: UPDATE, id=${packageId})`,
        'general',
        error
      )
    }
    dbg('OK: guardar paquete (update)', packageId)
    return { packageId }
  }

  // Paquete nuevo → INSERT
  const { data: newPkg, error } = await supabase
    .from('packages')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    dbg('ERROR creando paquete', error)
    throw tagError(
      `Error creando el paquete: ${error.message}. (Tabla: packages, operación: INSERT)`,
      'general',
      error
    )
  }

  dbg('OK: guardar paquete (insert)', newPkg.id)
  return { packageId: newPkg.id }
}

// ============================================================================
// SINCRONIZAR VERSIONES DEL PAQUETE
// Compara el estado local contra la BD:
//   - Versiones con id existente → UPDATE
//   - Versiones sin id           → INSERT
//   - Versiones en BD pero no en estado → DELETE
// Retorna { versionesSincronizadas } con los IDs actualizados.
// ============================================================================
export async function syncPackageVersions({ packageId, versiones }) {
  dbg('Iniciando etapa: sincronizar versiones', { packageId, count: versiones.length })

  // IDs actualmente en la BD para este paquete
  const { data: versionesEnBD } = await supabase
    .from('package_versions')
    .select('id')
    .eq('package_id', packageId)

  const idsEnBD = new Set((versionesEnBD || []).map(v => v.id))
  const idsEnEstado = new Set(versiones.filter(v => v.id).map(v => v.id))

  // Eliminar versiones que fueron borradas del estado local
  for (const v of (versionesEnBD || [])) {
    if (!idsEnEstado.has(v.id)) {
      dbg('Eliminando versión removida', v.id)
      await supabase.from('package_versions').delete().eq('id', v.id)
    }
  }

  // Upsert versiones del estado local
  const versionesSincronizadas = []
  for (let i = 0; i < versiones.length; i++) {
    const v = versiones[i]
    const versionData = {
      package_id: packageId,
      display_name: v.display_name,
      price: v.price,
      is_active: v.is_active,
      sort_order: i,
      profession_id: v.profession_id || null,
    }

    if (v.id && idsEnBD.has(v.id)) {
      // Actualizar versión existente
      const { error } = await supabase
        .from('package_versions')
        .update(versionData)
        .eq('id', v.id)

      if (error) {
        throw tagError(
          `Error actualizando versión "${v.display_name}": ${error.message}. (Tabla: package_versions, operación: UPDATE, id=${v.id})`,
          'profesiones',
          error
        )
      }
      versionesSincronizadas.push({ ...v })
    } else {
      // Insertar versión nueva
      const { data: nueva, error } = await supabase
        .from('package_versions')
        .insert(versionData)
        .select('id')
        .single()

      if (error) {
        throw tagError(
          `Error creando versión "${v.display_name}": ${error.message}. (Tabla: package_versions, operación: INSERT)`,
          'profesiones',
          error
        )
      }
      versionesSincronizadas.push({ ...v, id: nueva.id })
    }
  }

  dbg('OK: sincronizar versiones', versionesSincronizadas.length)
  return { versionesSincronizadas }
}

// ============================================================================
// SINCRONIZAR RELACIÓN EVALUACIÓN ↔ VERSIONES
// Borra todas las relaciones anteriores y re-inserta las activas.
// Tabla: evaluation_versions
// ============================================================================
export async function syncEvaluationVersions({ evalId, versionesFrescas }) {
  dbg('Iniciando etapa: vincular evaluación con versiones', { evalId, count: versionesFrescas.length })

  // Limpiar relaciones previas de esta evaluación
  const { error: delErr } = await supabase
    .from('evaluation_versions')
    .delete()
    .eq('evaluation_id', evalId)

  if (delErr) {
    throw tagError(
      `Error limpiando relaciones de evaluación: ${delErr.message}. (Tabla: evaluation_versions, operación: DELETE, evaluation_id=${evalId})`,
      'profesiones',
      delErr
    )
  }

  // Re-insertar solo las versiones activas
  const activas = versionesFrescas.filter(v => v.is_active)
  if (activas.length) {
    const relaciones = activas.map(v => ({
      evaluation_id: evalId,
      package_version_id: v.id,
    }))

    const { error } = await supabase.from('evaluation_versions').insert(relaciones)
    if (error) {
      throw tagError(
        `Error vinculando evaluación con versiones: ${error.message}. (Tabla: evaluation_versions, operación: INSERT)`,
        'profesiones',
        error
      )
    }
  }

  dbg('OK: vincular evaluación con versiones')
}

// ============================================================================
// SINCRONIZAR MATERIALES ↔ VERSIONES
// Vincula todos los materiales del paquete con las versiones activas.
// Inserta solo los vínculos faltantes; elimina los que ya no aplican.
// ============================================================================
export async function syncMaterialsWithVersions({ packageId, versionesActivasIds }) {
  if (!packageId || !versionesActivasIds.length) return
  dbg('Iniciando etapa: sincronizar materiales con versiones', { packageId, versionesActivasIds })

  // Obtener todos los materiales del paquete
  const { data: mats } = await supabase
    .from('study_materials')
    .select('id')
    .eq('package_id', packageId)

  if (!mats?.length) {
    dbg('Sin materiales para sincronizar')
    return
  }

  const matIds = mats.map(m => m.id)

  // Obtener vínculos actuales para no duplicar
  const { data: relacionesActuales } = await supabase
    .from('study_material_versions')
    .select('study_material_id, package_version_id')
    .in('study_material_id', matIds)

  const existentes = new Set(
    (relacionesActuales || []).map(r => `${r.study_material_id}:${r.package_version_id}`)
  )

  // Calcular vínculos faltantes
  const nuevas = []
  for (const matId of matIds) {
    for (const versionId of versionesActivasIds) {
      if (!existentes.has(`${matId}:${versionId}`)) {
        nuevas.push({ study_material_id: matId, package_version_id: versionId })
      }
    }
  }

  // Eliminar vínculos a versiones que ya no están activas
  const versionesActivasSet = new Set(versionesActivasIds.map(String))
  const eliminar = (relacionesActuales || []).filter(
    r => !versionesActivasSet.has(String(r.package_version_id))
  )

  for (const r of eliminar) {
    await supabase
      .from('study_material_versions')
      .delete()
      .eq('study_material_id', r.study_material_id)
      .eq('package_version_id', r.package_version_id)
  }

  // Insertar vínculos nuevos
  if (nuevas.length) {
    const { error } = await supabase.from('study_material_versions').insert(nuevas)
    if (error) {
      throw tagError(
        `Error vinculando materiales con versiones: ${error.message}. (Tabla: study_material_versions, operación: INSERT)`,
        'material',
        error
      )
    }
  }

  dbg('OK: sincronizar materiales con versiones', { nuevas: nuevas.length, eliminadas: eliminar.length })
}

// ============================================================================
// SINCRONIZAR RELACIÓN VERSIÓN ↔ NIVEL (package_version_levels)
// Borra todas las relaciones anteriores para esas versiones y re-inserta
// las que están definidas en el estado local (levelMapEstado).
// ============================================================================
export async function syncPackageVersionLevels({ versionesFrescas, levelMapEstado }) {
  dbg('Iniciando etapa: vincular niveles a versiones', { count: versionesFrescas.length })
  if (!versionesFrescas.length) return

  const versionIds = versionesFrescas.map(v => v.id)

  // Limpiar relaciones anteriores
  const { error: delErr } = await supabase
    .from('package_version_levels')
    .delete()
    .in('package_version_id', versionIds)

  if (delErr) {
    throw tagError(
      `Error limpiando vínculos de niveles: ${delErr.message}. (Tabla: package_version_levels, operación: DELETE)`,
      'profesiones',
      delErr
    )
  }

  // Re-insertar los vínculos actuales
  const nuevasRelaciones = versionesFrescas
    .filter(v => levelMapEstado[v.id])
    .map(v => ({ package_version_id: v.id, level_id: levelMapEstado[v.id] }))

  if (nuevasRelaciones.length) {
    const { error } = await supabase.from('package_version_levels').insert(nuevasRelaciones)
    if (error) {
      throw tagError(
        `Error vinculando niveles a versiones: ${error.message}. (Tabla: package_version_levels, operación: INSERT)`,
        'profesiones',
        error
      )
    }
  }

  dbg('OK: vincular niveles a versiones', nuevasRelaciones.length)
}

// ============================================================================
// RECARGAR VERSIONES CON DETALLES COMPLETOS
// Después del guardado, recarga las versiones con sus niveles y profesiones
// para actualizar el estado local del formulario.
// ============================================================================
export async function loadVersionesWithDetails({ packageId, evalId, nivelesToActuales, profesiones }) {
  dbg('Iniciando: recargar versiones con detalles', { packageId, evalId })

  const { data: versionesFinales } = await supabase
    .from('package_versions')
    .select('*')
    .eq('package_id', packageId)
    .order('sort_order', { ascending: true })

  if (!versionesFinales) return null

  const allVersionIds = versionesFinales.map(v => v.id)

  // Cargar vínculos nivel → versión
  const { data: pvLevels } = await supabase
    .from('package_version_levels')
    .select('package_version_id, level_id')
    .in('package_version_id', allVersionIds)

  const levelMap = {}
  pvLevels?.forEach(row => { levelMap[row.package_version_id] = row.level_id })

  // Construir versiones enriquecidas con nombres de nivel y profesión
  return versionesFinales.map(v => ({
    ...v,
    level_id: levelMap[v.id] || null,
    level_display: levelMap[v.id]
      ? (nivelesToActuales.find(
          n => n._id === levelMap[v.id] || n.id === levelMap[v.id]
        )?.name || '')
      : '',
    profession_display:
      profesiones.find(p => p.id === v.profession_id)?.name || '',
  }))
}
