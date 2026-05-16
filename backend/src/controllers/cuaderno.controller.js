import OpenAI    from 'openai'
import pdfParse  from 'pdf-parse/lib/pdf-parse.js'
import { createClient } from '@supabase/supabase-js'

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const LIMITE_MES = 40

// ── Helpers ───────────────────────────────────────────────────────────────────
async function tieneAcceso(userId, packageId) {
  const { data: u } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
  if (u?.role === 'admin') return true
  const { data: c } = await supabase
    .from('purchases').select('id')
    .eq('user_id', userId).eq('package_id', packageId)
    .in('status', ['active', 'approved', 'manual']).maybeSingle()
  return !!c
}

function parseJsonBlock(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  try { return JSON.parse(m ? m[1] : text.trim()) } catch { return null }
}

async function buildContexto(packageId, userId) {
  // Fuentes admin (study_materials)
  const { data: mats } = await supabase
    .from('study_materials').select('title, description')
    .eq('package_id', packageId).eq('is_active', true)

  // Fuentes del usuario (PDFs subidos)
  const { data: userSrcs } = await supabase
    .from('user_cuaderno_fuentes').select('nombre, texto')
    .eq('user_id', userId).eq('package_id', packageId)
    .order('created_at', { ascending: false }).limit(4)

  const partes = []
  if (mats?.length)
    partes.push(`Material del paquete:\n${mats.map(m => `• ${m.title}${m.description ? ': ' + m.description : ''}`).join('\n')}`)
  if (userSrcs?.length)
    partes.push(`Documentos subidos por el usuario:\n${userSrcs.map(s => `【${s.nombre}】:\n${s.texto.slice(0, 2500)}`).join('\n\n')}`)

  return partes.length ? partes.join('\n\n') : 'Material aún no cargado para este paquete.'
}

// ── POST /api/cuaderno/:packageId/chat ────────────────────────────────────────
export const chatCuaderno = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { mensaje } = req.body
  const userId = req.user.id

  if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje vacío.' })
  if (!(await tieneAcceso(userId, packageId)))
    return res.status(403).json({ error: 'Sin acceso a este paquete.' })

  const inicio = new Date(); inicio.setDate(1); inicio.setHours(0, 0, 0, 0)
  const { count } = await supabase
    .from('user_cuaderno_mensajes')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId).eq('package_id', packageId).eq('rol', 'user')
    .gte('created_at', inicio.toISOString())

  if ((count || 0) >= LIMITE_MES)
    return res.status(429).json({ error: `Límite de ${LIMITE_MES} mensajes/mes alcanzado.` })

  const [{ data: pkg }, contexto] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    buildContexto(packageId, userId),
  ])

  const { data: hist } = await supabase
    .from('user_cuaderno_mensajes')
    .select('rol, contenido')
    .eq('user_id', userId).eq('package_id', packageId)
    .order('created_at', { ascending: false }).limit(14)

  const historial = (hist || []).reverse().map(m => ({ role: m.rol, content: m.contenido }))

  let respuesta
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: `Eres el tutor IA de Praxia para el paquete "${pkg?.name || 'de estudio'}". Preparas candidatos para concursos de méritos del Estado colombiano. Responde siempre en español, de forma pedagógica y concisa.

${contexto}

IMPORTANTE: Cuando tu respuesta se base en uno de los documentos del usuario, cítalo así: 【NombreDelArchivo】. Si generas material que vale la pena guardar, termina con: 💾 Puedes guardar esta respuesta en tus notas.`,
        },
        ...historial,
        { role: 'user', content: mensaje.trim() },
      ],
    })
    respuesta = completion.choices[0].message.content
  } catch (err) {
    console.error('[cuaderno chat]', err.message)
    return res.status(502).json({ error: 'Error al conectar con el tutor IA.' })
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
    .select('id, contenido, fuente, fijada, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ nota: data })
}

// ── GET /api/cuaderno/:packageId/notas ───────────────────────────────────────
export const getNotas = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id

  const { data } = await supabase
    .from('user_notebook_entries')
    .select('id, contenido, fuente, fijada, created_at')
    .eq('user_id', userId).eq('package_id', packageId)
    .order('fijada', { ascending: false })
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

// ── PATCH /api/cuaderno/:packageId/nota/:notaId/fijar ────────────────────────
export const fijarNota = async (req, res) => {
  const { notaId } = req.params
  const { fijada } = req.body
  const userId = req.user.id
  const { data, error } = await supabase
    .from('user_notebook_entries')
    .update({ fijada: !!fijada })
    .eq('id', notaId).eq('user_id', userId)
    .select('id, fijada').single()
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ nota: data })
}

// ── POST /api/cuaderno/:packageId/generar ────────────────────────────────────
const PROMPTS = {
  resumen: `Genera un resumen ejecutivo estructurado de este material.
Devuelve SOLO el siguiente objeto JSON sin texto extra:
{"ejes":[{"titulo":"Nombre del eje temático","puntos":["punto 1","punto 2"]}],"glosario":[{"termino":"término","definicion":"definición concisa"}],"criticos":["Punto crítico para el examen 1","..."],"ejecutivo":"Párrafo de resumen ejecutivo de 3-4 oraciones."}`,

  quiz: `Genera exactamente 10 preguntas tipo juicio de situación estilo CNSC/concurso de méritos.
Devuelve SOLO el siguiente array JSON sin texto extra:
[{"n":1,"pregunta":"Enunciado completo de la situación","opciones":{"A":"opción A","B":"opción B","C":"opción C","D":"opción D"},"correcta":"B","justificacion":"Justificación legal o técnica concisa."}]`,

  flashcards: `Genera exactamente 12 flashcards sobre los conceptos clave de este concurso de méritos.
Devuelve SOLO el siguiente array JSON sin texto extra:
[{"frente":"Concepto o pregunta corta","reverso":"Definición o respuesta completa"}]`,

  plan: `Genera un plan de estudio de 4 semanas para preparar este concurso de méritos.
Devuelve SOLO el siguiente array JSON sin texto extra:
[{"semana":1,"titulo":"Nombre de la semana","objetivo":"Objetivo principal de la semana","dias":[{"dia":"Lunes","tarea":"Descripción concreta de la actividad","horas":"2h"}]}]`,
}

export const generarArtefacto = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { tipo } = req.body
  const userId = req.user.id

  if (!PROMPTS[tipo]) return res.status(400).json({ error: 'Tipo inválido.' })
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })

  const [{ data: pkg }, contexto] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    buildContexto(packageId, userId),
  ])

  let raw
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      response_format: tipo !== 'resumen' ? { type: 'json_object' } : undefined,
      messages: [
        {
          role: 'system',
          content: `Eres el tutor IA de Praxia para "${pkg?.name || 'concurso de méritos'}". Preparas candidatos para concursos del Estado colombiano. Responde siempre en español.\n\n${contexto}`,
        },
        { role: 'user', content: PROMPTS[tipo] },
      ],
    })
    raw = completion.choices[0].message.content
  } catch (err) {
    console.error('[cuaderno generar]', err.message)
    return res.status(502).json({ error: 'Error al generar. Intenta de nuevo.' })
  }

  // Para quiz/flashcards/plan: parsear JSON. Para resumen: texto plano
  let datos = raw
  let contenidoNota = raw
  if (tipo !== 'resumen') {
    const parsed = parseJsonBlock(raw)
    if (parsed) {
      datos = parsed
      contenidoNota = JSON.stringify(parsed)
    }
  }

  const { data: nota } = await supabase
    .from('user_notebook_entries')
    .insert({ user_id: userId, package_id: packageId, contenido: contenidoNota, fuente: tipo })
    .select('id, contenido, fuente, fijada, created_at').single()

  return res.json({ tipo, datos, nota })
}

// ── GET /api/cuaderno/:packageId/fuentes ─────────────────────────────────────
export const listarFuentes = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })

  const [{ data: admin }, { data: user }] = await Promise.all([
    supabase.from('study_materials').select('id, title, url, type')
      .eq('package_id', packageId).eq('is_active', true).order('sort_order'),
    supabase.from('user_cuaderno_fuentes').select('id, nombre, texto, created_at')
      .eq('user_id', userId).eq('package_id', packageId).order('created_at', { ascending: false }),
  ])

  return res.json({
    admin: (admin || []).map(f => ({ ...f, origen: 'admin' })),
    user:  (user  || []).map(f => ({ ...f, origen: 'user'  })),
  })
}

// ── POST /api/cuaderno/:packageId/fuentes ────────────────────────────────────
export const subirFuente = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' })

  let texto
  try {
    const result = await pdfParse(req.file.buffer)
    texto = result.text?.trim() || ''
  } catch {
    return res.status(422).json({ error: 'No se pudo leer el PDF. Verifica que no esté protegido.' })
  }

  if (!texto) return res.status(422).json({ error: 'El PDF no contiene texto extraíble.' })
  if (texto.length > 120000) texto = texto.slice(0, 120000) // límite razonable

  const nombre = req.file.originalname.replace(/\.pdf$/i, '')
  const { data, error } = await supabase
    .from('user_cuaderno_fuentes')
    .insert({ user_id: userId, package_id: packageId, nombre, texto })
    .select('id, nombre, texto, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ fuente: { ...data, origen: 'user' } })
}

// ── DELETE /api/cuaderno/:packageId/fuentes/:fuenteId ────────────────────────
export const eliminarFuente = async (req, res) => {
  const { fuenteId } = req.params
  const userId = req.user.id
  await supabase.from('user_cuaderno_fuentes').delete().eq('id', fuenteId).eq('user_id', userId)
  return res.json({ ok: true })
}
