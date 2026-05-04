// contextBuilder.js
// Construye el contexto histórico del usuario para que la IA no sea "ciega".
// Agrega datos de: simulacros IA, respuestas por área, desempeño en salas.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const HACE_30_DIAS = () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

export async function buildUserContext(userId) {
  try {
    const [simsRes, answersRes, salasRes] = await Promise.all([
      // Últimos simulacros IA generados
      supabase
        .from('user_simulacros')
        .select('id, cargo, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),

      // Respuestas por área (último mes)
      supabase
        .from('user_simulacro_answers')
        .select('area, dificultad, es_correcta')
        .eq('user_id', userId)
        .gte('created_at', HACE_30_DIAS()),

      // Desempeño en salas de competencia
      supabase
        .from('room_participants')
        .select('correct, wrong, score')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(20),
    ])

    const simulacros  = simsRes.data  || []
    const respuestas  = answersRes.data || []
    const salas       = salasRes.data  || []

    // ── Estadísticas por área ────────────────────────────────────
    const areaStats = {}
    for (const r of respuestas) {
      const key = r.area || 'General'
      if (!areaStats[key]) areaStats[key] = { correctas: 0, total: 0 }
      areaStats[key].total++
      if (r.es_correcta) areaStats[key].correctas++
    }

    const areasOrdenadas = Object.entries(areaStats)
      .map(([area, s]) => ({ area, pct: Math.round((s.correctas / s.total) * 100), total: s.total }))
      .filter(a => a.total >= 3) // solo áreas con datos suficientes
      .sort((a, b) => a.pct - b.pct)

    const areasDebiles  = areasOrdenadas.slice(0, 3).filter(a => a.pct < 70)
    const areasFuertes  = areasOrdenadas.slice(-2).filter(a => a.pct >= 75)

    // ── Desempeño en salas ───────────────────────────────────────
    const totalSalaPreguntas = salas.reduce((acc, s) => acc + (s.correct || 0) + (s.wrong || 0), 0)
    const totalSalaCorrectas = salas.reduce((acc, s) => acc + (s.correct || 0), 0)
    const promedioSalas = totalSalaPreguntas > 0
      ? Math.round((totalSalaCorrectas / totalSalaPreguntas) * 100)
      : null

    // ── Cargos practicados ───────────────────────────────────────
    const cargos = [...new Set(simulacros.map(s => s.cargo).filter(Boolean))].slice(0, 3)

    // ── Construir texto de contexto ──────────────────────────────
    if (simulacros.length === 0 && respuestas.length === 0 && salas.length === 0) {
      return null // Usuario nuevo sin historial
    }

    let ctx = '--- HISTORIAL DEL ESTUDIANTE (usa esto para personalizar tu respuesta) ---\n'

    if (simulacros.length > 0) {
      ctx += `• Simulacros IA generados (último mes): ${simulacros.length}\n`
    }
    if (cargos.length > 0) {
      ctx += `• Cargos practicados: ${cargos.join(', ')}\n`
    }
    if (promedioSalas !== null) {
      ctx += `• Promedio en salas de competencia: ${promedioSalas}% (${salas.length} partidas)\n`
    }
    if (areasDebiles.length > 0) {
      ctx += `• Áreas con más errores: ${areasDebiles.map(a => `${a.area} (${a.pct}%)`).join(', ')}\n`
    }
    if (areasFuertes.length > 0) {
      ctx += `• Áreas más fuertes: ${areasFuertes.map(a => `${a.area} (${a.pct}%)`).join(', ')}\n`
    }
    if (respuestas.length > 0) {
      const totalCorrectas = respuestas.filter(r => r.es_correcta).length
      const pctGeneral = Math.round((totalCorrectas / respuestas.length) * 100)
      ctx += `• Efectividad general en simulacros IA: ${pctGeneral}% (${respuestas.length} preguntas respondidas)\n`
    }
    ctx += '--- FIN DEL HISTORIAL ---\n'

    return ctx

  } catch (err) {
    console.error('[Context] Error construyendo contexto:', err.message)
    return null // Falla silenciosa — la IA funciona sin contexto
  }
}
