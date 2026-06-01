import OpenAI, { toFile }   from 'openai'
import { createClient }      from '@supabase/supabase-js'
import mammoth               from 'mammoth'
import * as XLSX             from 'xlsx'

// Extrae transcript de YouTube sin librería externa — scraping directo de la página
async function fetchYTTranscript(videoId) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
  }
  const html = await fetch(`https://www.youtube.com/watch?v=${videoId}`, { headers })
    .then(r => r.text())

  // Busca la URL de captions dentro de ytInitialPlayerResponse
  const captionMatch = html.match(/"captionTracks":\s*\[\s*\{[^}]*"baseUrl"\s*:\s*"([^"]+)"/)
  if (!captionMatch) throw new Error('Sin subtítulos automáticos')

  const captionUrl = captionMatch[1]
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')

  const xml = await fetch(captionUrl, { headers }).then(r => r.text())

  // Parsea el XML de subtítulos a texto plano
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ── Lector universal ──────────────────────────────────────────────────────────
// PDF: Files API (binario) + Chat Completions file_id — cero base64, cero RAM.
// Imagen: Chat Completions base64 vision. Word/Excel: mammoth/SheetJS local.
async function extraerContenido(buffer, mimetype, originalname) {

  // Texto plano / Markdown / CSV → leer directamente como UTF-8
  if (mimetype.startsWith('text/') || originalname.match(/\.(txt|md|csv)$/i)) {
    return buffer.toString('utf8').slice(0, 200_000).trim() || null
  }

  // Word .doc antiguo → mammoth también lo maneja
  if (mimetype === 'application/msword' || originalname.endsWith('.doc')) {
    try { const { value } = await mammoth.extractRawText({ buffer }); return value?.trim() || null } catch { return null }
  }

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

  // Imagen → Chat Completions con base64 vision (imágenes son pequeñas, sin spike de RAM)
  if (mimetype.startsWith('image/')) {
    const b64 = buffer.toString('base64')
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: `data:${mimetype};base64,${b64}`, detail: 'high' } },
        { type: 'text', text: 'Extrae y describe TODO el contenido visible en esta imagen. Incluye texto, tablas, datos y estructuras tal como aparecen. Sé exhaustivo. Responde en español.' },
      ]}],
    })
    return completion.choices[0].message.content?.trim() || null
  }

  // PDF → Files API (binario, cero spike de RAM) + Chat Completions con file_id
  if (mimetype === 'application/pdf') {
    let fileId = null
    try {
      const fileObj = await toFile(buffer, originalname, { type: 'application/pdf' })
      const uploaded = await openai.files.create({ file: fileObj, purpose: 'user_data' })
      fileId = uploaded.id

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4096,
        messages: [{ role: 'user', content: [
          { type: 'file', file: { file_id: fileId } },
          { type: 'text', text: 'Extrae y analiza TODO el contenido de este documento PDF. Devuelve el texto completo, tablas, artículos, normas y estructuras tal como aparecen. Sé exhaustivo y organizado. Responde en español.' },
        ]}],
      })
      return completion.choices[0].message.content?.trim() || null
    } finally {
      if (fileId) await openai.files.delete(fileId).catch(() => {})
    }
  }

  return null
}


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

async function isAdmin(userId) {
  const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

// selectedIds: array de {id, origen:'admin'|'user'} — si vacío, incluye todos
async function buildContexto(packageId, userId, selectedIds = null) {
  const [{ data: adminSrcs }, { data: userSrcs }] = await Promise.all([
    supabase.from('package_cuaderno_fuentes').select('id, nombre, texto')
      .eq('package_id', packageId).order('created_at', { ascending: true }),
    supabase.from('user_cuaderno_fuentes').select('id, nombre, texto')
      .eq('user_id', userId).eq('package_id', packageId)
      .order('created_at', { ascending: false }).limit(20),
  ])

  // Filtrar por selección si viene del frontend
  let adminFiltradas = adminSrcs || []
  let userFiltradas  = userSrcs  || []
  if (selectedIds && selectedIds.length > 0) {
    const adminIds = selectedIds.filter(s => s.origen === 'admin').map(s => s.id)
    const userIds  = selectedIds.filter(s => s.origen === 'user' ).map(s => s.id)
    adminFiltradas = adminFiltradas.filter(s => adminIds.includes(s.id))
    userFiltradas  = userFiltradas.filter(s => userIds.includes(s.id))
  }

  const partes = []

  if (adminFiltradas.length) {
    const charsPorFuente = Math.floor(30000 / adminFiltradas.length)
    partes.push(
      `Material base del paquete:\n${adminFiltradas.map(s => `【${s.nombre}】:\n${s.texto.slice(0, charsPorFuente)}`).join('\n\n')}`
    )
  }

  if (userFiltradas.length)
    partes.push(`Documentos personales del usuario:\n${userFiltradas.map(s => `【${s.nombre}】:\n${s.texto.slice(0, 20000)}`).join('\n\n')}`)

  return partes.length ? partes.join('\n\n') : 'Material aún no cargado para este paquete.'
}

// ── POST /api/cuaderno/:packageId/chat ────────────────────────────────────────
export const chatCuaderno = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { mensaje, selectedFuenteIds } = req.body
  const userId = req.user.id

  if (!mensaje?.trim()) return res.status(400).json({ error: 'Mensaje vacío.' })
  if (!(await tieneAcceso(userId, packageId)))
    return res.status(403).json({ error: 'Sin acceso a este paquete.' })

  const tokenInfo = await checkTokens(userId, packageId)
  if (!tokenInfo.ok)
    return res.status(429).json({ error: 'Límite de tokens mensual alcanzado. Recarga para continuar.', tokensUsados: tokenInfo.usados, tokensLimite: tokenInfo.limite })

  const [{ data: pkg }, contexto] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    buildContexto(packageId, userId, selectedFuenteIds || null),
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
// Tipos que devuelven OBJETO JSON (response_format: json_object es seguro)
const OBJECT_TIPOS = new Set(['resumen', 'mapa_mental', 'tabla', 'guia'])

const PROMPTS = {
  resumen: `Genera un resumen ejecutivo estructurado de este material.
Devuelve SOLO el siguiente objeto JSON sin texto extra:
{"ejes":[{"titulo":"Nombre del eje temático","puntos":["punto 1","punto 2"]}],"glosario":[{"termino":"término","definicion":"definición concisa"}],"criticos":["Punto crítico para el examen 1","..."],"ejecutivo":"Párrafo de resumen ejecutivo de 3-4 oraciones."}`,

  quiz: `Genera exactamente 5 preguntas tipo juicio de situación estilo CNSC/concurso de méritos. Enunciados concisos (máx 2 oraciones). Opciones de respuesta cortas (máx 15 palabras cada una). Justificación breve (máx 1 oración).
IMPORTANTE: distribuye las respuestas correctas de forma equilibrada entre A, B, C y D (ej: B, D, A, C, B).
Devuelve el siguiente objeto JSON con el array dentro de la clave "preguntas":
{"preguntas":[{"n":1,"pregunta":"Enunciado de la situación","opciones":{"A":"opción A","B":"opción B","C":"opción C","D":"opción D"},"correcta":"B","justificacion":"Justificación legal concisa."}]}`,

  flashcards: `Genera exactamente 12 flashcards sobre los conceptos clave de este concurso de méritos.
Devuelve el siguiente objeto JSON con el array dentro de la clave "tarjetas":
{"tarjetas":[{"frente":"Concepto o pregunta corta","reverso":"Definición o respuesta completa"}]}`,

  plan: `Genera un plan de estudio de 4 semanas para preparar este concurso de méritos.
Devuelve el siguiente objeto JSON con el array dentro de la clave "semanas":
{"semanas":[{"semana":1,"titulo":"Nombre de la semana","objetivo":"Objetivo principal de la semana","dias":[{"dia":"Lunes","tarea":"Descripción concreta de la actividad","horas":"2h"}]}]}`,

  faq: `Genera exactamente 12 preguntas frecuentes que hacen los candidatos sobre este concurso de méritos.
Devuelve el siguiente objeto JSON con el array dentro de la clave "preguntas":
{"preguntas":[{"pregunta":"¿Pregunta concreta del candidato?","respuesta":"Respuesta clara y completa basada en la norma o el material.","categoria":"Inscripción|Pruebas|Empleo|Normativa|Proceso"}]}`,

  cronologia: `Genera una cronología con los hitos más importantes del proceso de selección de este concurso de méritos (etapas, plazos, actuaciones legales).
Devuelve el siguiente objeto JSON con el array dentro de la clave "hitos":
{"hitos":[{"orden":1,"hito":"Nombre del hito","descripcion":"Descripción detallada de qué ocurre en esta etapa","norma":"Artículo o norma aplicable si existe","tipo":"convocatoria|inscripcion|prueba|lista|empleo"}]}`,

  mapa_mental: `Genera un mapa mental estructurado con los temas y conceptos clave de este concurso de méritos.
Devuelve SOLO el siguiente objeto JSON sin texto extra:
{"nodo_central":"Nombre del concurso/cargo","ramas":[{"titulo":"Eje temático 1","color":"blue","subtemas":["Subtema 1","Subtema 2","Subtema 3"]},{"titulo":"Eje temático 2","color":"violet","subtemas":["Subtema 1","Subtema 2"]}]}
Usa entre 4 y 6 ramas. Colores disponibles: blue, violet, emerald, amber, rose, cyan.`,

  tabla: `Analiza el material y genera una tabla comparativa con los datos más importantes para preparar este concurso de méritos (requisitos, funciones, normas aplicables, sueldos, competencias, etc.).
Devuelve SOLO el siguiente objeto JSON sin texto extra:
{"titulo":"Nombre descriptivo de la tabla","columnas":["Componente","Detalle de la OPEC","Importancia para el examen"],"filas":[["Nivel/Grado","Profesional Universitario - Grado 01","Define la complejidad del cuestionario"],["Función principal","Control fiscal participativo","Tema obligatorio de estudio"]]}
Genera entre 6 y 10 filas con datos reales del material.`,

  guia: `Genera una guía de estudio estructurada por fases para preparar este concurso de méritos.
Devuelve SOLO el siguiente objeto JSON sin texto extra:
{"titulo":"Nombre de la guía","modulos":[{"fase":"Fase 1: Fundamentos (Días 1-3)","tema":"Tema principal de la fase","lectura_clave":"Descripción de qué estudiar y dónde enfocarse","objetivo":"Objetivo de aprendizaje de esta fase"},{"fase":"Fase 2: Aplicación (Días 4-6)","tema":"Tema de aplicación práctica","lectura_clave":"Descripción de ejercicios y práctica","objetivo":"Objetivo de la fase de aplicación"}]}
Genera entre 3 y 5 módulos progresivos.`,
}

export const generarArtefacto = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const { tipo, selectedFuenteIds } = req.body
  const userId = req.user.id

  if (!PROMPTS[tipo]) return res.status(400).json({ error: 'Tipo inválido.' })
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })

  const tokenInfo = await checkTokens(userId, packageId)
  if (!tokenInfo.ok) return res.status(429).json({ error: 'Límite de tokens mensual alcanzado.', tokensUsados: tokenInfo.usados, tokensLimite: tokenInfo.limite })

  const [{ data: pkg }, contexto] = await Promise.all([
    supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    buildContexto(packageId, userId, selectedFuenteIds || null),
  ])

  let raw
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      max_tokens: 4096,
      response_format: { type: 'json_object' },
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

  // Todos los tipos devuelven JSON — parsear siempre
  let datos = raw
  let contenidoNota = raw
  const parsed = parseJsonBlock(raw)
  if (parsed) {
    datos = parsed
    contenidoNota = JSON.stringify(parsed)
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
    supabase.from('package_cuaderno_fuentes').select('id, nombre, tipo, created_at')
      .eq('package_id', packageId).order('created_at', { ascending: true }),
    supabase.from('user_cuaderno_fuentes').select('id, nombre, texto, created_at')
      .eq('user_id', userId).eq('package_id', packageId).order('created_at', { ascending: false }),
  ])

  return res.json({
    admin: (admin || []).map(f => ({ ...f, origen: 'admin' })),
    user:  (user  || []).map(f => ({ ...f, origen: 'user'  })),
  })
}

// ── GET /api/cuaderno/admin/:packageId/fuentes ────────────────────────────────
export const listarFuentesAdmin = async (req, res) => {
  if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: 'Solo administradores.' })
  const packageId = parseInt(req.params.packageId)
  const { data, error } = await supabase
    .from('package_cuaderno_fuentes')
    .select('id, nombre, tipo, created_at')
    .eq('package_id', packageId)
    .order('created_at', { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ fuentes: data || [] })
}

// ── POST /api/cuaderno/admin/:packageId/fuentes ───────────────────────────────
export const subirFuenteAdmin = async (req, res) => {
  if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: 'Solo administradores.' })
  const packageId = parseInt(req.params.packageId)
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' })

  let texto
  try {
    texto = await extraerContenido(req.file.buffer, req.file.mimetype, req.file.originalname)
  } catch (err) {
    console.error('[subirFuenteAdmin]', err.message)
    return res.status(502).json({ error: 'Error al procesar el archivo. Intenta de nuevo.' })
  }
  if (!texto) return res.status(422).json({ error: 'No se pudo extraer contenido del archivo.' })

  const nombre = req.file.originalname.replace(/\.[^.]+$/, '')
  const { data, error } = await supabase
    .from('package_cuaderno_fuentes')
    .insert({ package_id: packageId, nombre, tipo: 'archivo', texto })
    .select('id, nombre, tipo, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ fuente: data })
}

// ── POST /api/cuaderno/admin/:packageId/fuentes/youtube ──────────────────────
export const agregarYoutubeAdmin = async (req, res) => {
  if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: 'Solo administradores.' })
  const packageId = parseInt(req.params.packageId)
  const { url } = req.body
  if (!url?.trim()) return res.status(400).json({ error: 'URL requerida.' })

  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
  if (!match) return res.status(400).json({ error: 'URL de YouTube inválida.' })
  const videoId = match[1]

  let transcript
  try {
    transcript = await fetchYTTranscript(videoId)
  } catch (err) {
    console.error('[youtubeAdmin]', err.message)
    return res.status(422).json({ error: 'Sin subtítulos automáticos en este video.' })
  }
  if (!transcript || transcript.length < 50)
    return res.status(422).json({ error: 'El video no tiene subtítulos disponibles.' })

  let nombreVideo = `YouTube-${videoId}`
  try {
    const info = await openai.chat.completions.create({
      model: 'gpt-4.1-mini', max_tokens: 60,
      messages: [{ role: 'user', content: `Dame SOLO el título probable de este video de YouTube cuyo transcript empieza: "${transcript.slice(0, 300)}". Solo el título, sin comillas.` }],
    })
    nombreVideo = info.choices[0].message.content?.trim() || nombreVideo
  } catch { /* usa ID como nombre */ }

  const textoFinal = transcript.length > 120000 ? transcript.slice(0, 120000) : transcript
  const { data, error } = await supabase
    .from('package_cuaderno_fuentes')
    .insert({ package_id: packageId, nombre: nombreVideo, tipo: 'youtube', texto: textoFinal })
    .select('id, nombre, tipo, created_at').single()

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ fuente: data })
}

// ── DELETE /api/cuaderno/admin/:packageId/fuentes/:fuenteId ──────────────────
export const eliminarFuenteAdmin = async (req, res) => {
  if (!(await isAdmin(req.user.id))) return res.status(403).json({ error: 'Solo administradores.' })
  await supabase.from('package_cuaderno_fuentes').delete().eq('id', req.params.fuenteId)
  return res.json({ ok: true })
}

// ── POST /api/cuaderno/:packageId/fuentes ────────────────────────────────────
export const subirFuente = async (req, res) => {
  const packageId = parseInt(req.params.packageId)
  const userId = req.user.id
  if (!(await tieneAcceso(userId, packageId))) return res.status(403).json({ error: 'Sin acceso.' })
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' })

  let texto
  try {
    texto = await extraerContenido(req.file.buffer, req.file.mimetype, req.file.originalname)
  } catch (err) {
    console.error('[subirFuente]', {
      message: err.message,
      status:  err.status,
      code:    err.code,
      type:    err.type,
      body:    err.body ? JSON.stringify(err.body).slice(0, 600) : undefined,
    })
    return res.status(502).json({ error: 'Error al procesar el archivo con la IA. Intenta de nuevo.' })
  }
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
    transcript = await fetchYTTranscript(videoId)
  } catch (err) {
    console.error('[youtube transcript]', err.message)
    return res.status(422).json({ error: 'No se pudo obtener el transcript. El video puede no tener subtítulos automáticos o ser privado.' })
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

  // Guardar nota con la URL del audio para que aparezca en el panel de notas
  const { data: nota } = await supabase
    .from('user_notebook_entries')
    .insert({ user_id: userId, package_id: packageId, contenido: publicUrl, fuente: 'audio' })
    .select('id, contenido, fuente, fijada, created_at').single()

  return res.json({ audioUrl: publicUrl, segmentos: segmentos.length, nota })
}
