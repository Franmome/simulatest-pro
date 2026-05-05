// contextBuilder.js
// Construye el contexto histórico completo del usuario para inyectarlo en Praxia.
// Lee: simulacros, respuestas por área, errores recientes con contexto, salas, materiales.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const HACE_60_DIAS = () => new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

export async function buildUserContext(userId) {
  try {
    const [simsRes, answersRes, salasRes, erroresRes, materialesRes] = await Promise.all([

      // Últimos 10 simulacros con score
      supabase
        .from('user_simulacros')
        .select('id, cargo, score_pct, score_correctas, score_total, completado, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // Respuestas por área (últimos 60 días)
      supabase
        .from('user_simulacro_answers')
        .select('area, dificultad, es_correcta, tiempo_segundos')
        .eq('user_id', userId)
        .gte('created_at', HACE_60_DIAS()),

      // Desempeño en salas
      supabase
        .from('room_participants')
        .select('correct, wrong, score')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(20),

      // Últimas 15 respuestas INCORRECTAS con contexto completo
      supabase
        .from('user_simulacro_answers')
        .select('area, enunciado, opcion_elegida, opcion_correcta, explicacion, created_at')
        .eq('user_id', userId)
        .eq('es_correcta', false)
        .not('enunciado', 'is', null)
        .order('created_at', { ascending: false })
        .limit(15),

      // Materiales de estudio vistos (últimos 60 días)
      supabase
        .from('user_material_views')
        .select('material_nombre, material_tipo, segundos_visto')
        .eq('user_id', userId)
        .gte('created_at', HACE_60_DIAS())
        .order('created_at', { ascending: false })
        .limit(20),
    ])

    const simulacros  = simsRes.data     || []
    const respuestas  = answersRes.data  || []
    const salas       = salasRes.data    || []
    const errores     = erroresRes.data  || []
    const materiales  = materialesRes.data || []

    const tieneData = simulacros.length || respuestas.length || salas.length
    if (!tieneData) return null

    // ── Estadísticas por área ──────────────────────────────────────────────────
    const areaStats = {}
    for (const r of respuestas) {
      const key = r.area || 'General'
      if (!areaStats[key]) areaStats[key] = { correctas: 0, total: 0, tiempos: [] }
      areaStats[key].total++
      if (r.es_correcta) areaStats[key].correctas++
      if (r.tiempo_segundos) areaStats[key].tiempos.push(r.tiempo_segundos)
    }

    const areasOrdenadas = Object.entries(areaStats)
      .map(([area, s]) => ({
        area,
        pct:          Math.round((s.correctas / s.total) * 100),
        total:        s.total,
        avgSegundos:  s.tiempos.length ? Math.round(s.tiempos.reduce((a, b) => a + b, 0) / s.tiempos.length) : null,
      }))
      .filter(a => a.total >= 3)
      .sort((a, b) => a.pct - b.pct)

    const areasDebiles = areasOrdenadas.slice(0, 4).filter(a => a.pct < 70)
    const areasFuertes = areasOrdenadas.slice(-3).filter(a => a.pct >= 75)

    // ── Desempeño en salas ────────────────────────────────────────────────────
    const totalSalaPreguntas = salas.reduce((a, s) => a + (s.correct || 0) + (s.wrong || 0), 0)
    const totalSalaCorrectas = salas.reduce((a, s) => a + (s.correct || 0), 0)
    const promedioSalas = totalSalaPreguntas > 0
      ? Math.round((totalSalaCorrectas / totalSalaPreguntas) * 100) : null

    // ── Score promedio en simulacros completados ──────────────────────────────
    const simsConScore = simulacros.filter(s => s.score_pct !== null)
    const avgScore = simsConScore.length
      ? Math.round(simsConScore.reduce((a, s) => a + Number(s.score_pct), 0) / simsConScore.length)
      : null

    const cargos = [...new Set(simulacros.map(s => s.cargo).filter(Boolean))].slice(0, 4)

    // ── Materiales más estudiados ─────────────────────────────────────────────
    const materialStats = {}
    for (const m of materiales) {
      const key = m.material_nombre || m.material_tipo || 'material'
      materialStats[key] = (materialStats[key] || 0) + (m.segundos_visto || 0)
    }
    const materialesTop = Object.entries(materialStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([nombre, seg]) => `${nombre} (${Math.round(seg / 60)} min)`)

    // ── Construir bloque de texto compacto ────────────────────────────────────
    let ctx = '--- PERFIL DEL ESTUDIANTE (personaliza tu respuesta con esto) ---\n'

    if (cargos.length)
      ctx += `• Cargos que está preparando: ${cargos.join(', ')}\n`

    if (avgScore !== null)
      ctx += `• Promedio en simulacros: ${avgScore}% (${simsConScore.length} completados)\n`

    if (promedioSalas !== null)
      ctx += `• Promedio en salas de competencia: ${promedioSalas}% (${salas.length} partidas)\n`

    if (respuestas.length > 0) {
      const totalCorr = respuestas.filter(r => r.es_correcta).length
      ctx += `• Efectividad general: ${Math.round((totalCorr / respuestas.length) * 100)}% (${respuestas.length} preguntas, últimos 60 días)\n`
    }

    if (areasDebiles.length)
      ctx += `• Áreas débiles (necesita refuerzo): ${areasDebiles.map(a => `${a.area} ${a.pct}%`).join(' | ')}\n`

    if (areasFuertes.length)
      ctx += `• Áreas fuertes: ${areasFuertes.map(a => `${a.area} ${a.pct}%`).join(' | ')}\n`

    if (materialesTop.length)
      ctx += `• Materiales más estudiados: ${materialesTop.join(', ')}\n`

    // Últimos errores con contexto para retroalimentación específica
    if (errores.length > 0) {
      ctx += `\n• Últimas preguntas incorrectas (para dar retroalimentación específica si el usuario pregunta):\n`
      for (const e of errores.slice(0, 8)) {
        if (e.enunciado) {
          ctx += `  - [${e.area || 'General'}] "${e.enunciado.slice(0, 120)}..." `
          ctx += `Marcó: ${e.opcion_elegida || '?'} | Correcta: ${e.opcion_correcta || '?'}`
          if (e.explicacion) ctx += ` | Explicación: ${e.explicacion.slice(0, 100)}`
          ctx += '\n'
        }
      }
    }

    ctx += '--- FIN DEL PERFIL ---\n'
    return ctx

  } catch (err) {
    console.error('[Context] Error construyendo contexto:', err.message)
    return null
  }
}
