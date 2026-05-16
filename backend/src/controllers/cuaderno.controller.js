import OpenAI                from 'openai'
import { createClient }      from '@supabase/supabase-js'
import { YoutubeTranscript } from 'youtube-transcript'
import mammoth               from 'mammoth'
import * as XLSX             from 'xlsx'

// ── Lector universal — OpenAI hace el trabajo pesado ─────────────────────────
async function extraerContenido(buffer, mimetype, originalname) {

  // Word → mammoth (texto puro, cero RAM)
  if (mimetype.includes('wordprocessingml') || originalname.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ buffer })
    return value?.trim() || null
  }

  // Excel → SheetJS (texto puro, cero RAM)
  if (mimetype.includes('spreadsheetml') || originalname.endsWith('.xlsx')) {
    const wb = XLSX.read(buffer)
    const partes = wb.SheetNames.map(name =>
      `[${name}]\n${XLSX.utils.sheet_to_csv(wb.Sheets[name])}`
    )
    return partes.join('\n\n').trim() || null
  }

  // PDF → OpenAI lo lee directamente (sin tocar disco, sin RAM local)
  if (mimetype === 'application/pdf') {
    const b64 = buffer.toString('base64')
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o', max_tokens: 4096,
      messages: [{ role: 'user', content: [
        { type: 'file', file: { filename: originalname, file_data: `data:application/pdf;base64,${b64}` } },
        { type: 'text', text: 'Extrae y analiza TODO el contenido de este documento. Devuelve el texto completo, tablas, artículos, normas y estructuras tal como aparecen. Sé exhaustivo y organizado. Responde en español.' },
      ]}],
    })
    return resp.choices[0].message.content?.trim() || null
  }

  // Imagen suelta → gpt-4o visión (una foto, sin peso)
  if (mimetype.startsWith('image/')) {
    const b64 = buffer.toString('base64')
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o', max_tokens: 3000,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimetype};base64,${b64}`, detail: 'high' } },
        { type: 'text', text: 'Analiza esta imagen. Extrae todo el texto visible, tablas, diagramas y conceptos clave. Sé exhaustivo. Responde en español.' },
      ]}],
    })
    return resp.choices[0].message.content?.trim() || null
  }

  return null
}

const openai    = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const TOKENS_MES = 2_000_000

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPeriodo() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

async function checkTokens(userId, packageId) {
  const { data } = await supabase
    .from('user_cuaderno_tokens')
    .select('tokens_usados, tokens_limite')
    .eq('user_id', userId).eq('package_id', packageId).eq('periodo', getPeriodo())
    .maybeSingle()
  const usados = data?.tokens_usados || 0
  const limite = data?.tokens_limite  || TOKENS_MES
  return { ok: usados < limite, usados, limite }
}

async function registrarTokens(userId, packageId, tokens) {
  await supabase.rpc('incrementar_tokens_cuaderno', {
    p_user_id:   userId,
    p_package_id: packageId,
    p_periodo:   getPeriodo(),
    p_tokens:    tokens,
    p_limite:    TOKENS_MES,
  })
}

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
    .order('created_at', { ascending: false }).limit(5)

  const partes = []
  if (mats?.length)
    partes.push(`Material del paquete:\n${mats.map(m => `• ${m.title}${m.description ? ': ' + m.description : ''}`).join('\n')}`)
  if (userSrcs?.length)
    partes.push(`Documentos subidos por el usuario:\n${userSrcs.map(s => `【${s.nombre}】:\n${s.texto.slice(0, 40000)}`).join('\n\n')}`)

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

  const tokenInfo = await checkTokens(userId, packageId)
  if (!tokenInfo.ok)
    return res.status(429).json({ error: 'Límite de tokens mensual alcanzado. Recarga para continuar.', tokensUsados: tokenInfo.usados, tokensLimite: tokenInfo.limite })

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
      model: 'gpt-4.1-mini',
      max_tokens: 1200,
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
    await registrarTokens(userId, packageId, completion.usage?.total_tokens || 0)
  } catch (err) {
    console.error('[cuaderno chat]', err.message)
    return res.status(502).json({ error: 'Error al conectar con el tutor IA.' })
  }

  await supabase.from('user_cuaderno_mensajes').insert([
    { user_id: userId, package_id: packageId, rol: 'user',      contenido: mensaje.trim() },
    { user_id: userId, package_id: packageId, rol: 'assistant', contenido: respuesta },
  ])

  const tokensActuales = await checkTokens(userId, packageId)
  return res.json({ respuesta, tokensUsados: tokensActuales.usados, tokensLimite: tokensActuales.limite })
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

  faq: `Genera exactamente 12 preguntas frecuentes que hacen los candidatos sobre este concurso de méritos.
Devuelve SOLO el siguiente array JSON sin texto extra:
[{"pregunta":"¿Pregunta concreta del candidato?","respuesta":"Respuesta clara y completa basada en la norma o el material.","categoria":"Inscripción|Pruebas|Empleo|Normativa|Proceso"}]`,

  cronologia: `Genera una cronología con los hitos más importantes del proceso de selección de este concurso de méritos (etapas, plazos, actuaciones legales).
Devuelve SOLO el siguiente array JSON sin texto extra:
[{"orden":1,"hito":"Nombre del hito","descripcion":"Descripción detallada de qué ocurre en esta etapa","norma":"Artículo o norma aplicable si existe","tipo":"convocatoria|inscripcion|prueba|lista|empleo"}]`,
}

export const generarArtefacto = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { tipo } = req.body
  const userId = req.user.id

  if (!PROMPTS[tipo]) return res.status(400).json({ error: 'Tipo inválido.' })
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })

  const tokenInfo = await checkTokens(userId, packageId)
  if (!tokenInfo.ok) return res.status(429).json({ error: 'Límite de tokens mensual alcanzado.', tokensUsados: tokenInfo.usados, tokensLimite: tokenInfo.limite })

  const [{ data: pkg }, contexto] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    buildContexto(packageId, userId),
  ])

  let raw
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      max_tokens: 3000,
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
    await registrarTokens(userId, packageId, completion.usage?.total_tokens || 0)
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

  const texto = await extraerContenido(req.file.buffer, req.file.mimetype, req.file.originalname)
  if (!texto) return res.status(422).json({ error: 'No se pudo extraer contenido del archivo. Verifica que no esté vacío o protegido.' })

  const nombre = req.file.originalname.replace(/\.[^.]+$/, '')
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

// ── POST /api/cuaderno/:packageId/fuentes/youtube ────────────────────────────
export const agregarYoutube = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { url }   = req.body
  const userId    = req.user.id

  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })
  if (!url?.trim()) return res.status(400).json({ error: 'URL requerida.' })

  // Extraer video ID
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (!match) return res.status(400).json({ error: 'URL de YouTube inválida. Usa el formato youtube.com/watch?v=... o youtu.be/...' })
  const videoId = match[1]

  let transcript
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'es' })
      .catch(() => YoutubeTranscript.fetchTranscript(videoId)) // fallback a cualquier idioma
    transcript = items.map(t => t.text).join(' ').replace(/\s+/g, ' ').trim()
  } catch (err) {
    console.error('[youtube transcript]', err.message)
    return res.status(422).json({ error: 'No se pudo obtener el transcript. El video puede no tener subtítulos o ser privado.' })
  }

  if (!transcript || transcript.length < 50)
    return res.status(422).json({ error: 'El video no tiene subtítulos disponibles.' })

  // Obtener título del video via OpenAI (opcional, rápido)
  let nombreVideo = `YouTube-${videoId}`
  try {
    const info = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', max_tokens: 60,
      messages: [{ role: 'user', content: `Dame SOLO el título probable de un video de YouTube cuyo transcript empieza así: "${transcript.slice(0, 300)}". Responde solo el título, sin comillas.` }],
    })
    nombreVideo = info.choices[0].message.content?.trim() || nombreVideo
  } catch { /* usa el ID como nombre */ }

  const textoFinal = transcript.length > 120000 ? transcript.slice(0, 120000) : transcript

  const { data, error } = await supabase
    .from('user_cuaderno_fuentes')
    .insert({ user_id: userId, package_id: packageId, nombre: nombreVideo, texto: textoFinal })
    .select('id, nombre, texto, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ fuente: { ...data, origen: 'user', tipo: 'youtube', url } })
}

// ── GET /api/cuaderno/:packageId/tokens ──────────────────────────────────────
export const getTokens = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id
  const { usados, limite } = await checkTokens(userId, packageId)
  return res.json({ tokensUsados: usados, tokensLimite: limite })
}

// ── POST /api/cuaderno/:packageId/audio-overview ─────────────────────────────
export const audioOverview = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId    = req.user.id

  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })

  const tokenInfo = await checkTokens(userId, packageId)
  if (!tokenInfo.ok) return res.status(429).json({ error: 'Límite de tokens alcanzado.' })

  const [{ data: pkg }, contexto] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    buildContexto(packageId, userId),
  ])

  // 1 ── Generar guion con IA
  let script
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: `Eres un guionista de podcasts educativos para concursos de méritos del Estado colombiano.\n\n${contexto}`,
        },
        {
          role: 'user',
          content: `Genera un guion de podcast de 4-5 minutos entre VALENTINA (tutora entusiasta, pedagógica) y ANDRÉS (tutor analítico, preciso) sobre los temas clave del paquete "${pkg?.name || 'concurso'}".

Reglas estrictas:
- Cada línea DEBE empezar exactamente con VALENTINA: o ANDRÉS: (sin otro texto antes)
- Máximo 2 oraciones por intervención
- Entre 16 y 22 intercambios en total
- Tono dinámico, coloquial pero profesional
- Incluye conceptos concretos del material, normas y consejos para el examen

Devuelve SOLO el guion, sin introducción ni cierre:`,
        },
      ],
    })
    script = completion.choices[0].message.content
    await registrarTokens(userId, packageId, completion.usage?.total_tokens || 0)
  } catch (err) {
    console.error('[audio script]', err.message)
    return res.status(502).json({ error: 'Error generando el guion del podcast.' })
  }

  // 2 ── Parsear segmentos
  const segmentos = []
  for (const line of script.split('\n')) {
    const m = line.match(/^(VALENTINA|ANDRÉS):\s*(.+)/)
    if (m && m[2].trim()) segmentos.push({ hablante: m[1], texto: m[2].trim() })
  }
  if (!segmentos.length) return res.status(502).json({ error: 'El guion generado no tiene el formato esperado.' })

  // 3 ── TTS por segmento (secuencial para evitar rate limits)
  const buffers = []
  try {
    for (const seg of segmentos) {
      const voz = seg.hablante === 'VALENTINA' ? 'shimmer' : 'onyx'
      const audio = await openai.audio.speech.create({
        model: 'tts-1', voice: voz, input: seg.texto, response_format: 'mp3',
      })
      buffers.push(Buffer.from(await audio.arrayBuffer()))
    }
  } catch (err) {
    console.error('[audio tts]', err.message)
    return res.status(502).json({ error: 'Error generando el audio. Verifica que tu API key tenga acceso a TTS.' })
  }

  const audioFinal = Buffer.concat(buffers)

  // 4 ── Subir a Supabase Storage
  const filename = `${userId}/${packageId}/${Date.now()}.mp3`
  try {
    await supabase.storage.createBucket('cuaderno-audio', { public: true }).catch(() => {})
    const { error: upErr } = await supabase.storage
      .from('cuaderno-audio')
      .upload(filename, audioFinal, { contentType: 'audio/mpeg', upsert: true })
    if (upErr) throw upErr
  } catch (err) {
    console.error('[audio upload]', err.message)
    return res.status(502).json({ error: 'Error guardando el audio. Verifica el bucket cuaderno-audio en Supabase.' })
  }

  const { data: { publicUrl } } = supabase.storage.from('cuaderno-audio').getPublicUrl(filename)

  return res.json({ audioUrl: publicUrl, segmentos: segmentos.length })
}
