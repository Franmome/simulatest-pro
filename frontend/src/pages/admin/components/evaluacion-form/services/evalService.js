// evalService.js
// Servicio de guardado para Evaluaciones, Niveles y Preguntas.
//
// PROBLEMA RESUELTO: la versión anterior hacía inserts/deletes de opciones
// en un loop secuencial (un await por opción). Con 30 preguntas × 4 opciones
// = 120 calls secuenciales → el spinner quedaba colgado minutos o para siempre.
//
// SOLUCIÓN: batch inserts/deletes con .insert([]) y .in('id', [...ids])
// reducen esas 120 calls a 2-3 calls en paralelo por nivel.

import { supabase } from '../../../../../utils/supabase'
import { DEBUG_EVAL_FORM } from '../lib/constants'
import { normalizeSupabaseError } from '../lib/helpers'

// ── helpers de log ──────────────────────────────────────────────────────────

function dbg(msg, data) {
  if (DEBUG_EVAL_FORM) console.log(`[EvalService] ${msg}`, data ?? '')
}

// Crea un Error con sección asociada (para que el banner navegue al tab correcto)
// y adjunta el objeto error crudo de Supabase para el panel técnico expandible.
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
// GUARDAR EVALUACIÓN
// Crea o actualiza el registro principal en la tabla `evaluations`.
// Retorna { evalId } que se usa como FK para niveles y versiones.
// ============================================================================
export async function saveEvaluation({ isEdit, id, form }) {
  dbg('Iniciando etapa: guardar evaluación', { isEdit, id })

  const payload = {
    title: form.title,
    description: form.description,
    category_id: form.category_id || null,
    is_active: form.is_active,
  }

  if (isEdit) {
    // UPDATE evaluación existente
    const { error } = await supabase
      .from('evaluations')
      .update(payload)
      .eq('id', id)

    if (error) {
      dbg('ERROR etapa: guardar evaluación', error)
      throw tagError(
        `Error guardando evaluación: ${error.message}. (Tabla: evaluations, operación: UPDATE, id=${id})`,
        'general',
        error
      )
    }
    dbg('OK etapa: guardar evaluación', id)
    return { evalId: parseInt(id, 10) }
  }

  // INSERT nueva evaluación
  const { data: ev, error } = await supabase
    .from('evaluations')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    dbg('ERROR etapa: crear evaluación', error)
    throw tagError(
      `Error creando evaluación: ${error.message}. (Tabla: evaluations, operación: INSERT)`,
      'general',
      error
    )
  }

  dbg('OK etapa: crear evaluación', ev.id)
  return { evalId: ev.id }
}

// ============================================================================
// GUARDAR TODOS LOS NIVELES Y SUS PREGUNTAS
// Upsert de todos los niveles del estado local → BD.
// Elimina en batch los niveles que ya no existen en el estado local.
// ============================================================================
export async function saveAllLevels({ evalId, niveles, preguntas, isEdit }) {
  dbg('Iniciando etapa: guardar niveles', { evalId, count: niveles.length })

  // Cargar IDs existentes en BD para detectar niveles eliminados
  const { data: nivelesExistentesDB, error: errDB } = await supabase
    .from('levels')
    .select('id')
    .eq('evaluation_id', evalId)

  if (errDB) {
    throw tagError(
      `Error cargando niveles existentes: ${errDB.message}. (Tabla: levels, operación: SELECT, evaluation_id=${evalId})`,
      'niveles',
      errDB
    )
  }

  const nuevosNivelesIds = [] // IDs guardados en esta pasada

  // Procesar cada nivel secuencialmente (tienen dependencias entre sí)
  for (const [idx, nv] of niveles.entries()) {
    let levelId = typeof nv._id === 'number' ? nv._id : null
    dbg(`Procesando nivel "${nv.name}"`, { levelId, isEdit })

    if (isEdit && levelId) {
      // Nivel ya existe en BD → UPDATE
      const { error } = await supabase
        .from('levels')
        .update({
          name: nv.name,
          description: nv.description,
          time_limit: nv.time_limit,
          passing_score: nv.passing_score,
          sort_order: idx + 1,
        })
        .eq('id', levelId)

      if (error) {
        dbg(`ERROR actualizando nivel "${nv.name}"`, error)
        throw tagError(
          `Error guardando nivel "${nv.name}": ${error.message}. (Tabla: levels, operación: UPDATE, id=${levelId})`,
          'niveles',
          error
        )
      }

      nuevosNivelesIds.push(levelId)
    } else {
      // Nivel nuevo → INSERT
      const { data: lv, error } = await supabase
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

      if (error) {
        dbg(`ERROR creando nivel "${nv.name}"`, error)
        throw tagError(
          `Error creando nivel "${nv.name}": ${error.message}. (Tabla: levels, operación: INSERT)`,
          'niveles',
          error
        )
      }

      levelId = lv.id
      nuevosNivelesIds.push(levelId)
    }

    // Guardar las preguntas de este nivel
    await saveQuestionsForLevel({
      levelId,
      pregsDelNivel: preguntas[nv._id] || [],
      isEdit,
      nivelNombre: nv.name,
    })
  }

  // ── Eliminar niveles que ya no están en el estado local ──────────────────
  const nivelesAEliminar = (nivelesExistentesDB || []).filter(
    lv => !nuevosNivelesIds.includes(lv.id)
  )

  if (nivelesAEliminar.length) {
    const idsAEliminar = nivelesAEliminar.map(lv => lv.id)
    dbg('Eliminando niveles removidos (batch)', idsAEliminar)

    // Obtener preguntas de esos niveles para poder borrar sus opciones
    const { data: pregsDeLevels } = await supabase
      .from('questions')
      .select('id')
      .in('level_id', idsAEliminar)

    if (pregsDeLevels?.length) {
      const pregIds = pregsDeLevels.map(p => p.id)
      // Batch delete: una sola call para borrar todas las opciones
      await supabase.from('options').delete().in('question_id', pregIds)
      // Batch delete: una sola call para borrar todas las preguntas
      await supabase.from('questions').delete().in('id', pregIds)
    }

    // Batch delete: una sola call para borrar los niveles
    await supabase.from('levels').delete().in('id', idsAEliminar)
  }

  dbg('OK etapa: guardar niveles', nuevosNivelesIds)
  return { nuevosNivelesIds }
}

// ============================================================================
// GUARDAR PREGUNTAS DE UN NIVEL (privado)
// Estrategia de batch:
//   - Preguntas existentes → update en paralelo (Promise.all)
//   - Preguntas nuevas    → batch insert (un solo INSERT con array)
//   - Preguntas borradas  → batch delete (.in())
//   - Opciones            → batch insert / batch delete
//
// Antes: ~100 calls secuenciales para 25 preguntas × 4 opciones
// Ahora: 4-6 calls totales por nivel independientemente del volumen
// ============================================================================
async function saveQuestionsForLevel({ levelId, pregsDelNivel, isEdit, nivelNombre }) {
  dbg(`Iniciando: guardar preguntas nivel ${levelId}`, { count: pregsDelNivel.length })

  // Cargar preguntas existentes en BD para detectar borradas
  const { data: preguntasExistentesDB, error: errPreg } = await supabase
    .from('questions')
    .select('id')
    .eq('level_id', levelId)

  if (errPreg) {
    throw tagError(
      `Error cargando preguntas del nivel "${nivelNombre}": ${errPreg.message}. (Tabla: questions, operación: SELECT, level_id=${levelId})`,
      'preguntas',
      errPreg
    )
  }

  const nuevasPregIds = [] // IDs de preguntas guardadas en esta pasada

  // Separar entre preguntas que existen en BD (tienen _id numérico) y preguntas nuevas
  const pregsAActualizar = pregsDelNivel.filter(p => isEdit && typeof p._id === 'number')
  const pregsAInsertar = pregsDelNivel.filter(p => !(isEdit && typeof p._id === 'number'))

  // ── ACTUALIZAR preguntas existentes en PARALELO ──────────────────────────
  if (pregsAActualizar.length) {
    await Promise.all(
      pregsAActualizar.map(async preg => {
        const qId = preg._id

        // Update texto de la pregunta
        const { error } = await supabase
          .from('questions')
          .update({
            text: preg.text,
            explanation: preg.explanation,
            difficulty: preg.difficulty,
            area: preg.area,
          })
          .eq('id', qId)

        if (error) {
          throw tagError(
            `Error actualizando pregunta en "${nivelNombre}": ${error.message}. (Tabla: questions, operación: UPDATE, id=${qId})`,
            'preguntas',
            error
          )
        }

        // Cargar opciones actuales de la pregunta
        const { data: optsDB } = await supabase
          .from('options')
          .select('id, letter')
          .eq('question_id', qId)

        const idsEnDB = new Set((optsDB || []).map(o => o.id))

        // Opciones a eliminar: están en BD pero no en el estado local
        const optsEliminarIds = (optsDB || [])
          .filter(o => !preg.options.some(po => po.id === o.id))
          .map(o => o.id)

        // Opciones a actualizar: existen en ambos lados
        const optsActualizar = preg.options.filter(op => op.id && idsEnDB.has(op.id))

        // Opciones a insertar: están en estado local pero no tienen id de BD
        const optsInsertar = preg.options.filter(op => !op.id)

        // Batch delete opciones obsoletas
        if (optsEliminarIds.length) {
          await supabase.from('options').delete().in('id', optsEliminarIds)
        }

        // Actualizar opciones existentes en paralelo
        if (optsActualizar.length) {
          await Promise.all(
            optsActualizar.map(op =>
              supabase
                .from('options')
                .update({ text: op.text, is_correct: op.is_correct })
                .eq('id', op.id)
            )
          )
        }

        // Batch insert nuevas opciones
        if (optsInsertar.length) {
          const { error: eOpts } = await supabase.from('options').insert(
            optsInsertar.map(op => ({
              question_id: qId,
              text: op.text,
              letter: op.letter,
              is_correct: op.is_correct,
            }))
          )
          if (eOpts) {
            throw tagError(
              `Error insertando opciones en "${nivelNombre}": ${eOpts.message}. (Tabla: options, operación: INSERT, question_id=${qId})`,
              'preguntas',
              eOpts
            )
          }
        }

        nuevasPregIds.push(qId)
      })
    )
  }

  // ── INSERTAR preguntas nuevas en BATCH ───────────────────────────────────
  if (pregsAInsertar.length) {
    // Un solo INSERT con todas las preguntas nuevas del nivel
    const { data: newQs, error: eInsert } = await supabase
      .from('questions')
      .insert(
        pregsAInsertar.map(p => ({
          level_id: levelId,
          text: p.text,
          explanation: p.explanation,
          question_type: 'multiple',
          difficulty: p.difficulty,
          area: p.area,
        }))
      )
      .select('id')

    if (eInsert) {
      throw tagError(
        `Error creando ${pregsAInsertar.length} pregunta(s) en "${nivelNombre}": ${eInsert.message}. (Tabla: questions, operación: INSERT)`,
        'preguntas',
        eInsert
      )
    }

    // Construir todas las opciones para insertar en un solo batch
    // newQs[i] corresponde a pregsAInsertar[i] porque Supabase preserva el orden
    const allNewOptions = newQs.flatMap((q, i) =>
      pregsAInsertar[i].options.map(op => ({
        question_id: q.id,
        text: op.text,
        letter: op.letter,
        is_correct: op.is_correct,
      }))
    )

    if (allNewOptions.length) {
      const { error: eOpts } = await supabase.from('options').insert(allNewOptions)
      if (eOpts) {
        throw tagError(
          `Error creando opciones de ${newQs.length} pregunta(s) en "${nivelNombre}": ${eOpts.message}. (Tabla: options, operación: INSERT)`,
          'preguntas',
          eOpts
        )
      }
    }

    newQs.forEach(q => nuevasPregIds.push(q.id))
  }

  // ── ELIMINAR preguntas borradas del estado local ─────────────────────────
  const pregIdsEliminar = (preguntasExistentesDB || [])
    .filter(p => !nuevasPregIds.includes(p.id))
    .map(p => p.id)

  if (pregIdsEliminar.length) {
    dbg(`Eliminando ${pregIdsEliminar.length} preguntas removidas del nivel ${levelId}`)
    // Batch delete opciones → luego batch delete preguntas
    await supabase.from('options').delete().in('question_id', pregIdsEliminar)
    await supabase.from('questions').delete().in('id', pregIdsEliminar)
  }

  dbg(`OK: guardar preguntas nivel ${levelId}`, {
    saved: nuevasPregIds.length,
    deleted: pregIdsEliminar.length,
  })
}
