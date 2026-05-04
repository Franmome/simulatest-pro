// ia.controller.js
// Dual-provider AI: Gemini (Google) + DeepSeek.
// Todos los errores de API se convierten a mensajes amigables — nunca se exponen al usuario final.

import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY || '',
})

// ── Sistema de prompts ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un psicómetra experto en evaluaciones de selección de personal para el sector público colombiano.
Tu tarea es generar un banco de preguntas de opción múltiple (3 opciones: A, B, C) a partir del material que se te proporcionará.

INSTRUCCIONES:
- Genera entre 20 y 40 preguntas por solicitud.
- 70% competencias funcionales (conocimiento técnico del cargo, normas, procedimientos).
- 30% competencias comportamentales (ética, trabajo en equipo, orientación al logro).
- Cada pregunta tiene EXACTAMENTE 3 opciones: A, B, C (NO uses D).
- "correcta" debe ser A, B o C (mayúscula).
- "dificultad" debe ser exactamente: facil, medio o dificil.
- El enunciado NO debe revelar la respuesta.
- "explicacion" debe citar norma, artículo o principio cuando sea posible.

FASES DE GENERACIÓN:
1. Extrae y clasifica los temas del material según el nivel del cargo.
2. Genera preguntas funcionales (70%) y comportamentales (30%).
3. Valida coherencia: verifica que la respuesta correcta sea inequívoca.

Devuelve ÚNICAMENTE un arreglo JSON válido sin markdown ni texto adicional:

[
  {
    "area": "Nombre del área temática",
    "dificultad": "facil | medio | dificil",
    "enunciado": "Enunciado completo de la pregunta",
    "A": "Texto opción A",
    "B": "Texto opción B",
    "C": "Texto opción C",
    "correcta": "A | B | C",
    "explicacion": "Explicación pedagógica con base legal/conceptual."
  }
]`

// ── Helpers generales ─────────────────────────────────────────────────────────

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function esHashReciente(fechaISO) {
  if (!fechaISO) return false
  const meses3 = 3 * 30 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(fechaISO).getTime() < meses3
}

function limpiarJSON(texto) {
  return texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

function validarPreguntas(arr) {
  if (!Array.isArray(arr) || arr.length === 0)
    throw new Error('El modelo devolvió un array vacío o inválido.')
  for (const [i, p] of arr.entries()) {
    if (!p.enunciado?.trim()) throw new Error(`Pregunta ${i + 1}: enunciado vacío.`)
    if (!['A', 'B', 'C'].includes(p.correcta?.toUpperCase?.()))
      throw new Error(`Pregunta ${i + 1}: "correcta" debe ser A, B o C.`)
  }
  return arr.map(p => ({ ...p, correcta: p.correcta.toUpperCase() }))
}

// Convierte errores técnicos de API en mensajes amigables
function formatError(err) {
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('429') || msg.includes('quota') || msg.includes('too many') || msg.includes('rate limit'))
    return 'El servicio de IA está temporalmente saturado. Intenta en unos minutos.'
  if (msg.includes('404') || msg.includes('not found'))
    return 'Modelo de IA no disponible temporalmente. Intenta con el otro modelo.'
  if (msg.includes('401') || msg.includes('403') || msg.includes('api key') || msg.includes('authentication'))
    return 'Error de autenticación con el servicio de IA. Contacta soporte.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('econnrefused') || msg.includes('enotfound'))
    return 'No se pudo conectar con el servicio de IA. Verifica tu conexión.'
  if (msg.includes('json') || msg.includes('parse') || msg.includes('invalid'))
    return 'El modelo de IA devolvió un formato inesperado. Intenta de nuevo.'
  return 'El servicio de IA no pudo generar la respuesta. Intenta de nuevo o cambia de modelo.'
}

// ── Gemini helpers ────────────────────────────────────────────────────────────

async function geminiGenerar(parts) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(Array.isArray(parts) ? parts : [parts])
  return result.response.text()
}

async function geminiTexto(prompt) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function geminiChat(systemCtx, historial, mensaje) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
  const chat = model.startChat({
    history: historial.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    systemInstruction: systemCtx,
  })
  const result = await chat.sendMessage(mensaje)
  return result.response.text()
}

// ── DeepSeek helpers ──────────────────────────────────────────────────────────

async function deepseekGenerar(prompt) {
  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  })
  return response.choices[0].message.content
}

async function deepseekTexto(prompt) {
  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
  })
  return response.choices[0].message.content
}

async function deepseekChat(systemCtx, historial, mensaje) {
  const response = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemCtx },
      ...historial.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      })),
      { role: 'user', content: mensaje },
    ],
  })
  return response.choices[0].message.content
}

// ── Endpoint: Generar banco de preguntas ──────────────────────────────────────

export async function generarBanco(req, res) {
  try {
    const userId = req.user.id
    const { evaluacion_id, nivel_id, cargo, modelo = 'gemini' } = req.body
    const file = req.file

    const { data: compra } = await supabase
      .from('purchases')
      .select('id, packages(has_ai_chat)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!compra?.packages?.has_ai_chat) {
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })
    }

    // Cache por hash de PDF
    if (file) {
      const hash = hashBuffer(file.buffer)
      const { data: cached } = await supabase
        .from('bancos_preguntas')
        .select('preguntas, created_at')
        .eq('pdf_hash', hash)
        .eq('evaluacion_id', evaluacion_id)
        .maybeSingle()

      if (cached && esHashReciente(cached.created_at)) {
        return res.json({ preguntas: cached.preguntas, cached: true })
      }

      // PDF solo lo puede procesar Gemini (DeepSeek no soporta inline PDF)
      const pdfPart = { inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } }
      const prompt = `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo || 'General'}\n\nAnaliza el material adjunto y genera el banco de preguntas.`
      const texto = await geminiGenerar([prompt, pdfPart])
      const preguntas = validarPreguntas(JSON.parse(limpiarJSON(texto)))

      await supabase.from('bancos_preguntas').upsert({
        pdf_hash: hash, evaluacion_id: evaluacion_id || null,
        nivel_id: nivel_id || null, cargo: cargo || null,
        preguntas, created_at: new Date().toISOString(),
      }, { onConflict: 'pdf_hash,evaluacion_id' })

      return res.json({ preguntas, cached: false })
    }

    if (!cargo) {
      return res.status(400).json({ error: 'Debes subir un PDF o especificar un cargo.' })
    }

    const prompt = `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo}\n\nGenera preguntas típicas para este cargo en el sector público colombiano.`
    const texto = modelo === 'deepseek' ? await deepseekGenerar(prompt) : await geminiGenerar(prompt)
    const preguntas = validarPreguntas(JSON.parse(limpiarJSON(texto)))

    return res.json({ preguntas, cached: false })

  } catch (err) {
    console.error('[IA] Error generarBanco:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Simulacro personal ──────────────────────────────────────────────

export async function generarSimulacroPersonal(req, res) {
  try {
    const userId = req.user.id
    const { evaluacion_id, cargo, modelo = 'gemini' } = req.body
    const file = req.file

    const { data: compra } = await supabase
      .from('purchases')
      .select('id, packages(has_ai_chat)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!compra?.packages?.has_ai_chat) {
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })
    }

    // Rate limit: máx 3/día por usuario
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const { count } = await supabase
      .from('user_simulacros')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', hoy.toISOString())

    if ((count ?? 0) >= 3) {
      return res.status(429).json({
        error: 'Límite diario alcanzado. Puedes generar hasta 3 simulacros por día.',
        restante_manana: true,
      })
    }

    // RAG cache por cargo + evaluación
    let preguntas = null
    const cargoKey = cargo?.trim().toLowerCase() || ''

    if (evaluacion_id && cargoKey) {
      const hashCargo = `cargo:${evaluacion_id}:${cargoKey}`
      const { data: cached } = await supabase
        .from('bancos_preguntas')
        .select('preguntas, created_at')
        .eq('pdf_hash', hashCargo)
        .eq('evaluacion_id', parseInt(evaluacion_id, 10))
        .maybeSingle()

      if (cached && esHashReciente(cached.created_at)) {
        preguntas = cached.preguntas
        console.log('[IA] Cache hit OPEC:', cargo)
      }
    }

    if (!preguntas) {
      let texto

      if (file) {
        // PDF: siempre Gemini
        const pdfPart = { inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } }
        const prompt = `${SYSTEM_PROMPT}${cargo ? `\n\nCARGO OBJETIVO (OPEC): ${cargo}` : ''}\n\nAnaliza este material y genera el banco de preguntas.`
        texto = await geminiGenerar([prompt, pdfPart])
      } else {
        const prompt = `${SYSTEM_PROMPT}${cargo ? `\n\nCARGO OBJETIVO (OPEC): ${cargo}` : ''}\n\nGenera preguntas típicas para este cargo en el sector público colombiano basándote en competencias funcionales y comportamentales estándar del CNSC.`
        texto = modelo === 'deepseek' ? await deepseekGenerar(prompt) : await geminiGenerar(prompt)
      }

      preguntas = validarPreguntas(JSON.parse(limpiarJSON(texto)))

      if (evaluacion_id && cargoKey) {
        const hashCargo = `cargo:${evaluacion_id}:${cargoKey}`
        await supabase.from('bancos_preguntas').upsert({
          pdf_hash: hashCargo, evaluacion_id: parseInt(evaluacion_id, 10),
          cargo: cargo.trim(), preguntas, created_at: new Date().toISOString(),
        }, { onConflict: 'pdf_hash,evaluacion_id' })
      }
    }

    const { data: sim, error: simErr } = await supabase
      .from('user_simulacros')
      .insert({ user_id: userId, evaluacion_id: evaluacion_id ? parseInt(evaluacion_id, 10) : null, cargo: cargo?.trim() || null, preguntas })
      .select('id').single()

    if (simErr) throw new Error('Error guardando simulacro: ' + simErr.message)

    return res.json({ simulacro_id: sim.id, total: preguntas.length, desde_cache: !!(evaluacion_id && cargoKey) })

  } catch (err) {
    console.error('[IA] Error generarSimulacroPersonal:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Análisis de sala ────────────────────────────────────────────────

export async function analizarSala(req, res) {
  try {
    const { participantes, total, modelo = 'gemini' } = req.body
    if (!Array.isArray(participantes) || !participantes.length || !total) {
      return res.status(400).json({ error: 'Faltan datos de participantes.' })
    }

    const prompt = `Analiza estos resultados de una sala de competencia de simulacros del estado colombiano y genera un análisis breve, concreto y motivador en español colombiano (máx. 200 palabras):

Participantes:
${participantes.map((p, i) => `${i + 1}. ${p.display_name}: ${p.correct} aciertos, ${p.wrong} errores de ${total} preguntas (${Math.round((p.correct / total) * 100)}%)`).join('\n')}

Incluye: quién destacó y por qué, puntos de mejora por participante, recomendaciones de estudio específicas y un mensaje motivacional final.`

    const analisis = modelo === 'deepseek'
      ? await deepseekTexto(prompt)
      : await geminiTexto(prompt)

    return res.json({ analisis })
  } catch (err) {
    console.error('[IA] Error analizarSala:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Chat contextual ─────────────────────────────────────────────────

export async function chatIA(req, res) {
  try {
    const userId = req.user.id
    const { mensaje, contexto_evaluacion, historial = [], modelo = 'gemini' } = req.body

    const { data: compra } = await supabase
      .from('purchases')
      .select('id, packages(has_ai_chat)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!compra?.packages?.has_ai_chat) {
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })
    }

    const systemCtx = contexto_evaluacion
      ? `Eres Praxia, asistente de estudio para el examen "${contexto_evaluacion}". Ayuda al usuario a comprender los temas, resolver dudas y estudiar para la convocatoria. Responde en español, de forma clara y pedagógica.`
      : `Eres Praxia, asistente de estudio para concursos públicos colombianos. Responde en español, de forma clara y pedagógica.`

    const respuesta = modelo === 'deepseek'
      ? await deepseekChat(systemCtx, historial, mensaje)
      : await geminiChat(systemCtx, historial, mensaje)

    return res.json({ respuesta })

  } catch (err) {
    console.error('[IA] Error chatIA:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}
