import { supabase } from '../../../../../utils/supabase'
import { DEBUG_EVAL_FORM } from '../lib/constants'

function dbg(msg, data) {
  if (DEBUG_EVAL_FORM) console.log(`[EvalService] ${msg}`, data ?? '')
}

function tagError(message, seccion) {
  return Object.assign(new Error(message), { seccion })
}

// ============================================================================
// EVALUACIÓN
// ============================================================================
export async function saveEvaluation({ isEdit, id, form }) {
  dbg('saveEvaluation start', { isEdit, id })

  if (isEdit) {
    const { error } = await supabase.from('evaluations').update({
      title: form.title,
      description: form.description,
      category_id: form.category_id || null,
      is_active: form.is_active,
    }).eq('id', id)

    if (error) throw tagError(`Error guardando evaluación: ${error.message}`, 'general')
    dbg('saveEvaluation updated', id)
    return { evalId: parseInt(id, 10) }
  }

  const { data: ev, error } = await supabase.from('evaluations').insert({
    title: form.title,
    description: form.description,
    category_id: form.category_id || null,
    is_active: form.is_active,
  }).select('id').single()

  if (error) throw tagError(`Error guardando evaluación: ${error.message}`, 'general')
  dbg('saveEvaluation inserted', ev.id)
  return { evalId: ev.id }
}

// ============================================================================
// NIVELES Y PREGUNTAS
// ============================================================================
export async function saveAllLevels({ evalId, niveles, preguntas, isEdit }) {
  dbg('saveAllLevels start', { evalId, nivelesCount: niveles.length })

  const { data: nivelesExistentesDB, error: errDB } = await supabase
    .from('levels').select('id').eq('evaluation_id', evalId)
  if (errDB) throw tagError(`Error cargando niveles existentes: ${errDB.message}`, 'niveles')

  const nuevosNivelesIds = []

  for (const [idx, nv] of niveles.entries()) {
    let levelId = typeof nv._id === 'number' ? nv._id : null
    dbg(`saveLevel "${nv.name}"`, { levelId, isEdit })

    if (isEdit && levelId) {
      const { error } = await supabase.from('levels').update({
        name: nv.name, description: nv.description,
        time_limit: nv.time_limit, passing_score: nv.passing_score, sort_order: idx + 1,
      }).eq('id', levelId)
      if (error) throw tagError(`Error guardando nivel "${nv.name}": ${error.message}`, 'niveles')
      nuevosNivelesIds.push(levelId)
    } else {
      const { data: lv, error } = await supabase.from('levels').insert({
        evaluation_id: evalId, name: nv.name, description: nv.description,
        time_limit: nv.time_limit, passing_score: nv.passing_score, sort_order: idx + 1,
      }).select('id').single()
      if (error) throw tagError(`Error creando nivel "${nv.name}": ${error.message}`, 'niveles')
      levelId = lv.id
      nuevosNivelesIds.push(levelId)
    }

    await saveQuestionsForLevel({ levelId, pregsDelNivel: preguntas[nv._id] || [], isEdit, nivelNombre: nv.name })
  }

  // Limpiar niveles eliminados
  for (const lv of nivelesExistentesDB) {
    if (!nuevosNivelesIds.includes(lv.id)) {
      dbg('deleting removed level', lv.id)
      const { data: pregNivel } = await supabase.from('questions').select('id').eq('level_id', lv.id)
      for (const preg of pregNivel || []) {
        await supabase.from('options').delete().eq('question_id', preg.id)
        await supabase.from('questions').delete().eq('id', preg.id)
      }
      await supabase.from('levels').delete().eq('id', lv.id)
    }
  }

  dbg('saveAllLevels done', nuevosNivelesIds)
  return { nuevosNivelesIds }
}

async function saveQuestionsForLevel({ levelId, pregsDelNivel, isEdit, nivelNombre }) {
  dbg(`saveQuestions for level ${levelId}`, { count: pregsDelNivel.length })

  const { data: preguntasExistentesDB, error: errPreg } = await supabase
    .from('questions').select('id').eq('level_id', levelId)
  if (errPreg) throw tagError(`Error cargando preguntas del nivel "${nivelNombre}": ${errPreg.message}`, 'preguntas')

  const nuevasPregIds = []

  for (const preg of pregsDelNivel) {
    const pregExiste = typeof preg._id === 'number'
    let qId = preg._id

    if (isEdit && pregExiste) {
      const { error } = await supabase.from('questions').update({
        text: preg.text, explanation: preg.explanation,
        difficulty: preg.difficulty, area: preg.area,
      }).eq('id', qId)
      if (error) throw tagError(`Error actualizando pregunta en "${nivelNombre}": ${error.message}`, 'preguntas')

      const { data: optsExistentesDB } = await supabase.from('options').select('id, letter').eq('question_id', qId)
      const idsExistentes = new Set(optsExistentesDB?.map(o => o.id) || [])
      const nuevasOpts = preg.options.filter(op => !op.id)
      const optsActualizar = preg.options.filter(op => op.id && idsExistentes.has(op.id))
      const optsEliminar = optsExistentesDB?.filter(op => !preg.options.some(po => po.id === op.id)) || []

      for (const op of optsEliminar) { await supabase.from('options').delete().eq('id', op.id) }
      for (const op of optsActualizar) {
        await supabase.from('options').update({ text: op.text, is_correct: op.is_correct }).eq('id', op.id)
      }
      if (nuevasOpts.length) {
        await supabase.from('options').insert(
          nuevasOpts.map(op => ({ question_id: qId, text: op.text, letter: op.letter, is_correct: op.is_correct }))
        )
      }
      nuevasPregIds.push(qId)
    } else {
      const { data: q, error } = await supabase.from('questions').insert({
        level_id: levelId, text: preg.text, explanation: preg.explanation,
        question_type: 'multiple', difficulty: preg.difficulty, area: preg.area,
      }).select('id').single()
      if (error) throw tagError(`Error creando pregunta en "${nivelNombre}": ${error.message}`, 'preguntas')
      qId = q.id

      const { error: eOpts } = await supabase.from('options').insert(
        preg.options.map(op => ({ question_id: qId, text: op.text, letter: op.letter, is_correct: op.is_correct }))
      )
      if (eOpts) throw tagError(`Error creando opciones en "${nivelNombre}": ${eOpts.message}`, 'preguntas')
      nuevasPregIds.push(qId)
    }
  }

  // Limpiar preguntas eliminadas
  for (const p of preguntasExistentesDB) {
    if (!nuevasPregIds.includes(p.id)) {
      await supabase.from('options').delete().eq('question_id', p.id)
      await supabase.from('questions').delete().eq('id', p.id)
    }
  }
}
