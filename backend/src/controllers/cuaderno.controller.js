import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai  = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const LIMITE_MES = 40

async function tieneAcceso(userId, packageId) {
  const { data: u } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
  if (u?.role === 'admin') return true
  const { data: c } = await supabase
    .from('purchases').select('id')
    .eq('user_id', userId).eq('package_id', packageId)
    .in('status', ['active', 'approved', 'manual']).maybeSingle()
  return !!c
}

// ── POST /api/cuaderno/:packageId/chat ────────────────────────────────────────
export const chatCuaderno = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { mensaje } = req.body
  const userId = req.user.id

  if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje vacío.' })
  if (!(await tieneAcceso(userId, packageId)))
    return res.status(403).json({ error: 'Sin acceso a este paquete.' })

  // Límite mensual (solo cuentan mensajes del usuario)
  const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('user_cuaderno_mensajes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('package_id', packageId).eq('rol', 'user')
    .gte('created_at', inicio.toISOString())

  if ((count || 0) >= LIMITE_MES)
    return res.status(429).json({ error: `Límite de ${LIMITE_MES} mensajes por mes alcanzado.` })

  // Contexto del paquete
  const [{ data: pkg }, { data: mats }] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    supabase.from('study_materials').select('title, description')
      .eq('package_id', packageId).eq('is_active', true),
  ])

  const contexto = mats?.length
    ? `Material disponible:\n${mats.map(m => `• ${m.title}${m.description ? ': ' + m.description : ''}`).join('\n')}`
    : 'Aún no hay material cargado.'

  // Historial reciente
  const { data: hist } = await supabase
    .from('user_cuaderno_mensajes')
    .select('rol, contenido')
    .eq('user_id', userId).eq('package_id', packageId)
    .order('created_at', { ascending: false }).limit(16)

  const historial = (hist || []).reverse().map(m => ({ role: m.rol, content: m.contenido }))

  let respuesta
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `Eres el tutor IA de Praxia para el paquete "${pkg?.name || 'de estudio'}". Preparas candidatos para concursos de méritos del Estado colombiano. Responde siempre en español, sé pedagógico y conciso. ${contexto}\n\nSi generas un resumen, mapa conceptual o material que valga la pena guardar, termina la respuesta con: 💾 Puedes guardar esta respuesta en tus notas personales.`,
        },
        ...historial,
        { role: 'user', content: mensaje.trim() },
      ],
    })
    respuesta = completion.choices[0].message.content
  } catch (err) {
    console.error('[cuaderno] OpenAI:', err.message)
    return res.status(502).json({ error: 'Error al conectar con el tutor IA. Intenta de nuevo.' })
  }

  await supabase.from('user_cuaderno_mensajes').insert([
    { user_id: userId, package_id: packageId, rol: 'user',      contenido: mensaje.trim() },
    { user_id: userId, package_id: packageId, rol: 'assistant', contenido: respuesta },
  ])

  return res.json({ respuesta, usados: (count || 0) + 1, limite: LIMITE_MES })
}

// ── GET /api/cuaderno/:packageId/historial ────────────────────────────────────
export const getHistorial = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })

  const { data } = await supabase
    .from('user_cuaderno_mensajes')
    .select('id, rol, contenido, created_at')
    .eq('user_id', userId).eq('package_id', packageId)
    .order('created_at', { ascending: true }).limit(100)

  return res.json({ mensajes: data || [] })
}

// ── POST /api/cuaderno/:packageId/nota ───────────────────────────────────────
export const guardarNota = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { contenido, fuente } = req.body
  const userId = req.user.id
  if (!contenido?.trim()) return res.status(400).json({ error: 'Contenido vacío.' })

  const { data, error } = await supabase
    .from('user_notebook_entries')
    .insert({ user_id: userId, package_id: packageId, contenido: contenido.trim(), fuente: fuente || 'manual' })
    .select('id, contenido, fuente, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ nota: data })
}

// ── GET /api/cuaderno/:packageId/notas ───────────────────────────────────────
export const getNotas = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id

  const { data } = await supabase
    .from('user_notebook_entries')
    .select('id, contenido, fuente, created_at')
    .eq('user_id', userId).eq('package_id', packageId)
    .order('created_at', { ascending: false })

  return res.json({ notas: data || [] })
}

// ── DELETE /api/cuaderno/:packageId/nota/:notaId ─────────────────────────────
export const eliminarNota = async (req, res) => {
  const { notaId } = req.params
  const userId = req.user.id
  await supabase.from('user_notebook_entries').delete().eq('id', notaId).eq('user_id', userId)
  return res.json({ ok: true })
}

// ── POST /api/cuaderno/:packageId/generar ────────────────────────────────────
const PROMPTS_ARTEFACTO = {
  resumen: `Genera un resumen ejecutivo completo y estructurado del material de estudio de este paquete.
Formato:
## Resumen ejecutivo
### Temas principales
- ...
### Conceptos clave
- ...
### Normativa relevante (si aplica)
- ...
### Puntos críticos para el examen
- ...`,

  quiz: `Genera 10 preguntas de selección múltiple (A, B, C, D) tipo CNSC/concurso de méritos sobre el material de este paquete.
Formato para cada pregunta:
**Pregunta N:** [enunciado]
A) [opción]  B) [opción]  C) [opción]  D) [opción]
✅ Respuesta: [letra] — [explicación breve]`,

  flashcards: `Genera 12 flashcards de estudio sobre los conceptos clave de este paquete.
Formato:
🃏 **Flashcard N**
**Frente:** [concepto o pregunta]
**Reverso:** [definición o respuesta]`,

  plan: `Genera un plan de estudio semanal de 4 semanas para preparar este concurso de méritos.
Formato:
## Plan de estudio — 4 semanas
### Semana 1: [tema]
- Lunes: ...
- Miércoles: ...
- Viernes: ...
(repite para cada semana con objetivos, temas y actividades concretas)
### Tips finales para el examen`,
}

export const generarArtefacto = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { tipo } = req.body
  const userId = req.user.id

  if (!PROMPTS_ARTEFACTO[tipo])
    return res.status(400).json({ error: 'Tipo inválido. Usa: resumen, quiz, flashcards, plan.' })

  if (!(await tieneAcceso(userId, packageId)))
    return res.status(403).json({ error: 'Sin acceso a este paquete.' })

  const [{ data: pkg }, { data: mats }] = await Promise.all([
    supabase.from('packages').select('name, description').eq('id', packageId).maybeSingle(),
    supabase.from('study_materials').select('title, description').eq('package_id', packageId).eq('is_active', true),
  ])

  const contexto = mats?.length
    ? `Material del paquete:\n${mats.map(m => `• ${m.title}${m.description ? ': ' + m.description : ''}`).join('\n')}`
    : 'Material aún no cargado — genera contenido general sobre el tipo de concurso indicado.'

  let contenido
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      messages: [
        {
          role: 'system',
          content: `Eres el tutor IA de Praxia para el paquete "${pkg?.name || 'de estudio'}". Preparas candidatos para concursos de méritos del Estado colombiano. Responde siempre en español.

${contexto}`,
        },
        { role: 'user', content: PROMPTS_ARTEFACTO[tipo] },
      ],
    })
    contenido = completion.choices[0].message.content
  } catch (err) {
    console.error('[cuaderno generar]', err.message)
    return res.status(502).json({ error: 'Error al generar. Intenta de nuevo.' })
  }

  const { data: nota, error } = await supabase
    .from('user_notebook_entries')
    .insert({ user_id: userId, package_id: packageId, contenido, fuente: tipo })
    .select('id, contenido, fuente, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ nota, contenido })
}
