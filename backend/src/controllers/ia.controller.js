// ia.controller.js
// Generación de banco de preguntas y simulacros personales con Gemini 1.5 Flash.
// Flujo: validar acceso → RAG cache (OPEC/cargo) → Gemini → guardar → devolver ID.

import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function esHashReciente(fechaISO) {
  if (!fechaISO) return false
  const meses3 = 3 * 30 * 24 * 60 * 60 * 1000
  return Date.now() - new Date(fechaISO).getTime() < meses3
}

function limpiarJSON(texto) {
  // Elimina bloques markdown ```json ... ``` si Gemini los incluye
  return texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

function validarPreguntas(arr) {
  if (!Array.isArray(arr) || arr.length === 0)
    throw new Error('Gemini devolvió un array vacío o inválido.')
  for (const [i, p] of arr.entries()) {
    if (!p.enunciado?.trim()) throw new Error(`Pregunta ${i + 1}: enunciado vacío.`)
    if (!['A', 'B', 'C'].includes(p.correcta?.toUpperCase?.()))
      throw new Error(`Pregunta ${i + 1}: "correcta" debe ser A, B o C.`)
  }
  return arr.map(p => ({ ...p, correcta: p.correcta.toUpperCase() }))
}

// ── Endpoint principal ────────────────────────────────────────────────────────

export async function generarBanco(req, res) {
  try {
    const userId = req.user.id
    const { evaluacion_id, nivel_id, cargo } = req.body
    const file = req.file // buffer del PDF subido por multer

    // 1. Validar que el usuario tiene un paquete activo con has_ai_chat = true
    const { data: compra } = await supabase
      .from('purchases')
      .select('id, packages(has_ai_chat)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!compra?.packages?.has_ai_chat) {
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })
    }

    // 2. Verificar caché por hash del PDF
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

      // 3. Llamar a Gemini con el PDF
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      const pdfPart = {
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      }

      const prompt = cargo
        ? `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo}\n\nAnaliza el material adjunto y genera el banco de preguntas.`
        : `${SYSTEM_PROMPT}\n\nAnaliza el material adjunto y genera el banco de preguntas.`

      const result = await model.generateContent([prompt, pdfPart])
      const texto = result.response.text()
      const arr = JSON.parse(limpiarJSON(texto))
      const preguntas = validarPreguntas(arr)

      // 4. Guardar en caché
      const { error: cacheErr } = await supabase.from('bancos_preguntas').upsert({
        pdf_hash: hash,
        evaluacion_id: evaluacion_id || null,
        nivel_id: nivel_id || null,
        cargo: cargo || null,
        preguntas,
        created_at: new Date().toISOString(),
      }, { onConflict: 'pdf_hash,evaluacion_id' })

      if (cacheErr) console.error('[IA] Error guardando caché:', cacheErr.message)

      return res.json({ preguntas, cached: false })
    }

    // 5. Sin PDF: generación por texto/cargo únicamente
    if (!cargo) {
      return res.status(400).json({ error: 'Debes subir un PDF o especificar un cargo.' })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const prompt = `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo}\n\nGenera preguntas típicas para este cargo en el sector público colombiano.`
    const result = await model.generateContent(prompt)
    const texto = result.response.text()
    const arr = JSON.parse(limpiarJSON(texto))
    const preguntas = validarPreguntas(arr)

    return res.json({ preguntas, cached: false })

  } catch (err) {
    console.error('[IA] Error generarBanco:', err)
    return res.status(500).json({ error: err.message || 'Error generando banco de preguntas.' })
  }
}

// ── Simulacro personal ───────────────────────────────────────────────────────
// POST /api/ia/simulacro
// Genera y persiste un banco de preguntas personal para el usuario.
// Flujo: rate limit → RAG cache por (evaluacion_id, cargo) → Gemini → user_simulacros

export async function generarSimulacroPersonal(req, res) {
  try {
    const userId = req.user.id
    const { evaluacion_id, cargo } = req.body
    const file = req.file

    // 1. Validar acceso
    const { data: compra } = await supabase
      .from('purchases')
      .select('id, packages(has_ai_chat)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!compra?.packages?.has_ai_chat) {
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })
    }

    // 2. Rate limit: máx 3 generaciones por día por usuario
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

    // 3. RAG cache: buscar banco existente para este cargo + evaluación
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
        console.log('[IA] Cache hit para OPEC:', cargo)
      }
    }

    // 4. Generar con Gemini si no hay cache
    if (!preguntas) {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

      let promptTexto = SYSTEM_PROMPT
      if (cargo) promptTexto += `\n\nCARGO OBJETIVO (OPEC): ${cargo}`

      const parts = [promptTexto]

      if (file) {
        parts.push({
          inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' },
        })
        parts.push('Analiza este material y genera el banco de preguntas siguiendo las instrucciones anteriores.')
      } else {
        parts[0] += '\n\nGenera preguntas típicas para este cargo en el sector público colombiano basándote en competencias funcionales y comportamentales estándar del CNSC.'
      }

      const result = await model.generateContent(parts)
      const texto = result.response.text()
      const arr = JSON.parse(limpiarJSON(texto))
      preguntas = validarPreguntas(arr)

      // Guardar en cache RAG
      if (evaluacion_id && cargoKey) {
        const hashCargo = `cargo:${evaluacion_id}:${cargoKey}`
        await supabase.from('bancos_preguntas').upsert({
          pdf_hash: hashCargo,
          evaluacion_id: parseInt(evaluacion_id, 10),
          cargo: cargo.trim(),
          preguntas,
          created_at: new Date().toISOString(),
        }, { onConflict: 'pdf_hash,evaluacion_id' })
      }
    }

    // 5. Persistir simulacro personal del usuario
    const { data: sim, error: simErr } = await supabase
      .from('user_simulacros')
      .insert({
        user_id: userId,
        evaluacion_id: evaluacion_id ? parseInt(evaluacion_id, 10) : null,
        cargo: cargo?.trim() || null,
        preguntas,
      })
      .select('id')
      .single()

    if (simErr) throw new Error('Error guardando simulacro: ' + simErr.message)

    return res.json({
      simulacro_id: sim.id,
      total: preguntas.length,
      desde_cache: preguntas !== null && !file,
    })

  } catch (err) {
    console.error('[IA] Error generarSimulacroPersonal:', err)
    return res.status(500).json({ error: err.message || 'Error generando el simulacro.' })
  }
}

// ── Análisis de sala (sin restricción de plan — feature de plataforma) ────────
// POST /api/ia/sala
// Body: { participantes: [{display_name, correct, wrong}], total: number }

export async function analizarSala(req, res) {
  try {
    const { participantes, total } = req.body
    if (!Array.isArray(participantes) || !participantes.length || !total) {
      return res.status(400).json({ error: 'Faltan datos de participantes.' })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })

    const prompt = `Analiza estos resultados de una sala de competencia de simulacros del estado colombiano y genera un análisis breve, concreto y motivador en español colombiano (máx. 200 palabras):

Participantes:
${participantes.map((p, i) => `${i + 1}. ${p.display_name}: ${p.correct} aciertos, ${p.wrong} errores de ${total} preguntas (${Math.round((p.correct / total) * 100)}%)`).join('\n')}

Incluye: quién destacó y por qué, puntos de mejora por participante, recomendaciones de estudio específicas y un mensaje motivacional final.`

    const result = await model.generateContent(prompt)
    return res.json({ analisis: result.response.text() })
  } catch (err) {
    console.error('[IA] Error analizarSala:', err)
    return res.status(500).json({ error: err.message || 'Error generando análisis.' })
  }
}

// ── Chat contextual ───────────────────────────────────────────────────────────

export async function chatIA(req, res) {
  try {
    const userId = req.user.id
    const { mensaje, contexto_evaluacion, historial = [] } = req.body

    // Validar acceso
    const { data: compra } = await supabase
      .from('purchases')
      .select('id, packages(has_ai_chat)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!compra?.packages?.has_ai_chat) {
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })

    const systemCtx = contexto_evaluacion
      ? `Eres Praxia, asistente de estudio para el examen "${contexto_evaluacion}". Ayuda al usuario a comprender los temas, resolver dudas y estudiar para la convocatoria. Responde en español, de forma clara y pedagógica.`
      : `Eres Praxia, asistente de estudio para concursos públicos colombianos. Responde en español, de forma clara y pedagógica.`

    // Construir historial de chat
    const chat = model.startChat({
      history: historial.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      systemInstruction: systemCtx,
    })

    const result = await chat.sendMessage(mensaje)
    const respuesta = result.response.text()

    return res.json({ respuesta })

  } catch (err) {
    console.error('[IA] Error chatIA:', err)
    return res.status(500).json({ error: err.message || 'Error en el asistente.' })
  }
}
