// ia.controller.js
// Dual-provider AI: Gemini + DeepSeek.
// Cada endpoint: verifica tokens → inyecta contexto del usuario → genera → registra uso.

import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { checkTokenBalance, recordTokenUsage, getActivePurchase } from '../utils/tokenTracker.js'
import { buildUserContext } from '../utils/contextBuilder.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY || '',
})

// ── Prompt base ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un psicómetra experto en evaluaciones de selección de personal para el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

CONTEXTO DEL SISTEMA OPEC COLOMBIANO:
Las pruebas de conocimientos para cargos públicos en Colombia son elaboradas según perfiles de competencias definidos en el Manual de Funciones. Generalmente contienen entre 160 y 250 preguntas distribuidas en módulos:
- Competencias Funcionales (60-70%): conocimiento técnico del área de desempeño, normativa aplicable, procedimientos específicos del cargo, legislación sectorial.
- Competencias Comportamentales (20-30%): ética del servidor público, trabajo en equipo, orientación al logro, compromiso institucional, relaciones interpersonales.
- Conocimientos Básicos (10%): Constitución Política, Ley 909/2004, Ley 734/2002 (Código Disciplinario), Ley 1437/2011 (CPACA), principios de administración pública.

CRITERIOS DE CALIDAD PARA CADA PREGUNTA:
- El enunciado debe ser claro, preciso y plantear UNA sola situación o concepto.
- Las opciones incorrectas (distractores) deben ser plausibles y bien construidas, no obviamente erróneas.
- El enunciado NUNCA debe revelar ni insinuar la respuesta correcta.
- Priorizar preguntas situacionales ("En su rol como... ¿qué haría?") sobre preguntas de memorización pura.
- La explicación debe citar el artículo, norma o principio exacto que fundamenta la respuesta.
- Varía el nivel cognitivo: comprensión, aplicación, análisis (no solo memorización).

FORMATO OBLIGATORIO:
- Exactamente 3 opciones por pregunta: A, B, C (NUNCA D ni más).
- "correcta": A, B o C (mayúscula).
- "dificultad": exactamente facil, medio o dificil.
- "area": nombre del módulo o competencia (ej: "Control Fiscal", "Ética Pública", "Gestión Documental").

Devuelve ÚNICAMENTE un arreglo JSON válido sin markdown ni texto adicional:
[{"area":"...","dificultad":"...","enunciado":"...","A":"...","B":"...","C":"...","correcta":"...","explicacion":"..."}]`

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashBuffer(b) { return crypto.createHash('sha256').update(b).digest('hex') }

async function extractPdfText(buffer) {
  try {
    const { default: pdfParse } = await import('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text?.trim() || ''
  } catch { return '' }
}

function esHashReciente(f) {
  if (!f) return false
  return Date.now() - new Date(f).getTime() < 3 * 30 * 24 * 60 * 60 * 1000
}

function limpiarJSON(t) {
  return t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

// Extrae el array JSON aunque el modelo agregue texto antes/después
function extraerArrayJSON(texto) {
  // 1) Limpieza básica de fences
  const cleaned = limpiarJSON(texto)
  try {
    const parsed = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed
    if (parsed?.preguntas && Array.isArray(parsed.preguntas)) return parsed.preguntas
  } catch (_) {}

  // 2) Buscar primer '[' y último ']' balanceado
  const start = texto.indexOf('[')
  if (start !== -1) {
    let depth = 0, end = -1
    for (let i = start; i < texto.length; i++) {
      if (texto[i] === '[') depth++
      else if (texto[i] === ']') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end !== -1) {
      try { return JSON.parse(texto.slice(start, end + 1)) } catch (_) {}
    }
  }

  // 3) Wrapper objeto {"preguntas": [...]}
  const objStart = texto.indexOf('{')
  if (objStart !== -1) {
    const objEnd = texto.lastIndexOf('}')
    if (objEnd !== -1) {
      try {
        const obj = JSON.parse(texto.slice(objStart, objEnd + 1))
        if (Array.isArray(obj?.preguntas)) return obj.preguntas
      } catch (_) {}
    }
  }

  throw new Error('No se pudo extraer JSON válido de la respuesta del modelo.')
}

function validarPreguntas(arr) {
  if (!Array.isArray(arr) || !arr.length) throw new Error('El modelo devolvió un array vacío.')
  for (const [i, p] of arr.entries()) {
    if (!p.enunciado?.trim()) throw new Error(`Pregunta ${i + 1}: enunciado vacío.`)
    if (!['A','B','C'].includes(p.correcta?.toUpperCase?.())) throw new Error(`Pregunta ${i + 1}: correcta debe ser A, B o C.`)
  }
  return arr.map(p => ({ ...p, correcta: p.correcta.toUpperCase() }))
}

function formatError(err) {
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('429') || msg.includes('quota') || msg.includes('too many') || msg.includes('rate limit'))
    return 'El servicio de IA está temporalmente saturado. Intenta en unos minutos.'
  if (msg.includes('404') || msg.includes('not found'))
    return 'Modelo de IA no disponible temporalmente. Prueba el otro modelo.'
  if (msg.includes('401') || msg.includes('403') || msg.includes('api key') || msg.includes('authentication'))
    return 'Error de autenticación con el servicio de IA. Contacta soporte.'
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound'))
    return 'No se pudo conectar con el servicio de IA. Verifica tu conexión.'
  if (msg.includes('json') || msg.includes('parse'))
    return 'El modelo devolvió un formato inesperado. Intenta de nuevo.'
  return 'El servicio de IA no pudo responder. Intenta de nuevo o cambia de modelo.'
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function geminiGenerar(parts) {
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const result = await model.generateContent(Array.isArray(parts) ? parts : [parts])
  const usage  = result.response.usageMetadata
  return {
    texto:     result.response.text(),
    tokensIn:  usage?.promptTokenCount     || 0,
    tokensOut: usage?.candidatesTokenCount || 0,
  }
}

async function geminiTexto(prompt) {
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
  const result = await model.generateContent(prompt)
  const usage  = result.response.usageMetadata
  return {
    texto:     result.response.text(),
    tokensIn:  usage?.promptTokenCount     || 0,
    tokensOut: usage?.candidatesTokenCount || 0,
  }
}

async function geminiChat(systemCtx, historial, mensaje) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
  const chat  = model.startChat({
    history: historial.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    })),
    systemInstruction: systemCtx,
  })
  const result = await chat.sendMessage(mensaje)
  const usage  = result.response.usageMetadata
  return {
    texto:     result.response.text(),
    tokensIn:  usage?.promptTokenCount     || 0,
    tokensOut: usage?.candidatesTokenCount || 0,
  }
}

// ── DeepSeek ──────────────────────────────────────────────────────────────────

async function deepseekGenerar(prompt, maxTokens = 8192) {
  const r = await deepseek.chat.completions.create({
    model:      'deepseek-chat',
    messages:   [
      { role: 'system', content: 'Eres un experto generador de preguntas para el sector público colombiano. Devuelves ÚNICAMENTE JSON válido, sin texto adicional, sin markdown.' },
      { role: 'user',   content: prompt },
    ],
    temperature: 0.6,
    max_tokens:  maxTokens,
  })
  return { texto: r.choices[0].message.content, tokensIn: r.usage?.prompt_tokens || 0, tokensOut: r.usage?.completion_tokens || 0 }
}

async function deepseekTexto(prompt) {
  const r = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
  })
  return { texto: r.choices[0].message.content, tokensIn: r.usage?.prompt_tokens || 0, tokensOut: r.usage?.completion_tokens || 0 }
}

async function deepseekChat(systemCtx, historial, mensaje) {
  const r = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemCtx },
      ...historial.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
      { role: 'user', content: mensaje },
    ],
  })
  return { texto: r.choices[0].message.content, tokensIn: r.usage?.prompt_tokens || 0, tokensOut: r.usage?.completion_tokens || 0 }
}

// ── Endpoint: Saldo de tokens ─────────────────────────────────────────────────

export async function getTokens(req, res) {
  try {
    const compra  = await getActivePurchase(req.user.id)
    const balance = await checkTokenBalance(req.user.id, compra?.id)
    return res.json({
      used:      balance.used,
      limit:     balance.limit,
      remaining: balance.remaining,
      pct:       Math.round((balance.used / balance.limit) * 100),
    })
  } catch (err) {
    return res.status(500).json({ error: 'Error consultando saldo.' })
  }
}

// ── Endpoint: Generar banco de preguntas ──────────────────────────────────────

export async function generarBanco(req, res) {
  try {
    const userId = req.user.id
    const { evaluacion_id, nivel_id, cargo, modelo = 'gemini' } = req.body
    const file   = req.file

    const compra = await getActivePurchase(userId)
    if (!compra?.packages?.has_ai_chat)
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })

    const balance = await checkTokenBalance(userId, compra.id)
    if (!balance.ok)
      return res.status(402).json({
        error: `Tokens de IA agotados (${balance.used.toLocaleString()} / ${balance.limit.toLocaleString()} usados). Renueva tu plan para continuar.`,
        tokens_agotados: true,
      })

    // Cache PDF
    if (file) {
      const hash = hashBuffer(file.buffer)
      const { data: cached } = await supabase.from('bancos_preguntas')
        .select('preguntas, created_at').eq('pdf_hash', hash).eq('evaluacion_id', evaluacion_id).maybeSingle()

      if (cached && esHashReciente(cached.created_at))
        return res.json({ preguntas: cached.preguntas, cached: true })

      let result
      if (modelo === 'deepseek') {
        const pdfText = await extractPdfText(file.buffer)
        const prompt  = `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo || 'General'}\n\n${pdfText ? `MATERIAL DE ESTUDIO:\n${pdfText.slice(0, 12000)}\n\n` : ''}Analiza el material y genera el banco de preguntas.`
        result = await deepseekGenerar(prompt)
      } else {
        const pdfPart = { inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } }
        const prompt  = `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo || 'General'}\n\nAnaliza el material adjunto y genera el banco de preguntas.`
        result = await geminiGenerar([prompt, pdfPart])
      }
      const { texto, tokensIn, tokensOut } = result
      const preguntas = validarPreguntas(extraerArrayJSON(texto))

      await Promise.all([
        supabase.from('bancos_preguntas').upsert(
          { pdf_hash: hash, evaluacion_id: evaluacion_id || null, nivel_id: nivel_id || null, cargo: cargo || null, preguntas, created_at: new Date().toISOString() },
          { onConflict: 'pdf_hash,evaluacion_id' }
        ),
        recordTokenUsage({ userId, purchaseId: compra.id, tokensIn, tokensOut, endpoint: 'banco', modelo }),
      ])
      return res.json({ preguntas, cached: false })
    }

    if (!cargo) return res.status(400).json({ error: 'Debes subir un PDF o especificar un cargo.' })

    const prompt = `${SYSTEM_PROMPT}\n\nCARGO OBJETIVO: ${cargo}\n\nGenera preguntas típicas para este cargo en el sector público colombiano.`
    const { texto, tokensIn, tokensOut } = modelo === 'deepseek'
      ? await deepseekGenerar(prompt) : await geminiGenerar(prompt)
    const preguntas = validarPreguntas(extraerArrayJSON(texto))

    await recordTokenUsage({ userId, purchaseId: compra.id, tokensIn, tokensOut, endpoint: 'banco', modelo })
    return res.json({ preguntas, cached: false })

  } catch (err) {
    console.error('[IA] generarBanco:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Simulacro personal ──────────────────────────────────────────────

export async function generarSimulacroPersonal(req, res) {
  try {
    const userId = req.user.id
    const { evaluacion_id, cargo, modelo = 'gemini', cantidad, tiempo_por_pregunta, dificultad_config } = req.body
    const file   = req.file

    const cantidadTarget   = Math.min(Math.max(parseInt(cantidad) || 160, 5), 250)
    const tiempoPregunta   = parseInt(tiempo_por_pregunta) || 0
    const dificultadTarget = ['mixta','facil','medio','dificil'].includes(dificultad_config) ? dificultad_config : 'mixta'

    const compra = await getActivePurchase(userId)
    if (!compra?.packages?.has_ai_chat)
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })

    const balance = await checkTokenBalance(userId, compra.id)
    if (!balance.ok)
      return res.status(402).json({
        error: `Tokens de IA agotados (${balance.used.toLocaleString()} / ${balance.limit.toLocaleString()} usados). Renueva tu plan para continuar.`,
        tokens_agotados: true,
      })


    // Instrucciones dinámicas de configuración
    const instrConfig = [
      `- Genera EXACTAMENTE ${cantidadTarget} preguntas.`,
      dificultadTarget !== 'mixta' ? `- TODAS las preguntas deben ser de dificultad "${dificultadTarget}".` : '',
    ].filter(Boolean).join('\n')

    const promptBase = `${SYSTEM_PROMPT}\n\n${instrConfig}`

    // RAG cache (solo cuando no hay configuración personalizada de dificultad)
    let preguntas = null
    const cargoKey = cargo?.trim().toLowerCase() || ''
    if (evaluacion_id && cargoKey && dificultadTarget === 'mixta' && cantidadTarget === 20) {
      const hashCargo = `cargo:${evaluacion_id}:${cargoKey}`
      const { data: cached } = await supabase.from('bancos_preguntas')
        .select('preguntas, created_at').eq('pdf_hash', hashCargo).eq('evaluacion_id', parseInt(evaluacion_id, 10)).maybeSingle()
      if (cached && esHashReciente(cached.created_at)) {
        preguntas = cached.preguntas
        console.log('[IA] Cache hit OPEC:', cargo)
      }
    }

    let tokensIn = 0, tokensOut = 0

    if (!preguntas) {
      const BATCH    = 20
      const PARALLEL = 3

      // Preparar PDF una sola vez
      const pdfText = file && modelo === 'deepseek' ? await extractPdfText(file.buffer) : null
      const pdfPart = file && modelo !== 'deepseek'
        ? { inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } } : null

      // Distribución OPEC para lotes (65% Funcionales / 25% Comportamentales / 10% Básicos)
      function calcularLotes() {
        const f = Math.round(cantidadTarget * 0.65)
        const c = Math.round(cantidadTarget * 0.25)
        const b = cantidadTarget - f - c
        const lotes = []
        for (let r = f; r > 0; r -= BATCH) lotes.push({ n: Math.min(BATCH, r),
          area: 'Competencias Funcionales',
          instrArea: 'conocimiento técnico del cargo, normativa aplicable, procedimientos y legislación sectorial específica.' })
        for (let r = c; r > 0; r -= BATCH) lotes.push({ n: Math.min(BATCH, r),
          area: 'Competencias Comportamentales',
          instrArea: 'ética pública, trabajo en equipo, orientación al logro, compromiso institucional y relaciones interpersonales.' })
        if (b > 0) lotes.push({ n: b,
          area: 'Conocimientos Básicos',
          instrArea: 'Constitución Política, Ley 909/2004, Ley 734/2002 (Código Disciplinario), Ley 1437/2011 (CPACA) y principios de administración pública.' })
        return lotes
      }

      async function generarLote(lote) {
        const instr = [
          `- Genera EXACTAMENTE ${lote.n} preguntas.`,
          `- ÁREA EXCLUSIVA: "${lote.area}". Tema: ${lote.instrArea}`,
          dificultadTarget !== 'mixta' ? `- TODAS de dificultad "${dificultadTarget}".` : '',
        ].filter(Boolean).join('\n')
        const prompt = `${SYSTEM_PROMPT}\n\n${instr}${cargo ? `\n\nCARGO OBJETIVO (OPEC): ${cargo}` : ''}`
        if (modelo === 'deepseek') {
          const full = pdfText ? `${prompt}\n\nMATERIAL DE ESTUDIO:\n${pdfText.slice(0, 4000)}` : prompt
          return deepseekGenerar(full, lote.n * 320 + 512)
        }
        return geminiGenerar(pdfPart ? [prompt, pdfPart] : [prompt])
      }

      if (cantidadTarget <= BATCH) {
        // ── Llamada única ──────────────────────────────────────────────────────
        let result
        const sp = `${promptBase}${cargo ? `\n\nCARGO OBJETIVO (OPEC): ${cargo}` : ''}`
        if (file) {
          if (modelo === 'deepseek') {
            result = await deepseekGenerar(`${sp}\n\nMATERIAL DE ESTUDIO:\n${(pdfText || '').slice(0, 12000)}\n\nGenera exactamente ${cantidadTarget} preguntas.`, cantidadTarget * 320 + 512)
          } else {
            result = await geminiGenerar([`${sp}\n\nAnaliza el material y genera exactamente ${cantidadTarget} preguntas.`, pdfPart])
          }
        } else {
          const p = `${sp}\n\nGenera exactamente ${cantidadTarget} preguntas típicas para este cargo en el sector público colombiano.`
          result = modelo === 'deepseek' ? await deepseekGenerar(p, cantidadTarget * 320 + 512) : await geminiGenerar(p)
        }
        preguntas = validarPreguntas(extraerArrayJSON(result.texto))
        tokensIn = result.tokensIn; tokensOut = result.tokensOut

      } else {
        // ── Generación por lotes en paralelo (hasta 3 simultáneos) ────────────
        const lotes = calcularLotes()
        const allPreguntas = []
        let totalTIn = 0, totalTOut = 0

        for (let i = 0; i < lotes.length; i += PARALLEL) {
          const wave = lotes.slice(i, i + PARALLEL)
          const resultados = await Promise.allSettled(wave.map(l => generarLote(l)))
          for (const r of resultados) {
            if (r.status === 'fulfilled') {
              try {
                const ps = validarPreguntas(extraerArrayJSON(r.value.texto))
                allPreguntas.push(...ps)
                totalTIn  += r.value.tokensIn  || 0
                totalTOut += r.value.tokensOut || 0
              } catch (e) { console.error('[IA] batch parse:', e.message) }
            } else {
              console.error('[IA] batch wave failed:', r.reason?.message)
            }
          }
        }

        if (allPreguntas.length < Math.ceil(cantidadTarget * 0.5))
          throw new Error('La generación por lotes falló parcialmente. Intenta con menos preguntas o vuelve a intentarlo.')

        preguntas = allPreguntas
        tokensIn = totalTIn; tokensOut = totalTOut
      }

      // Solo cachear configuración estándar (mixta/20 preguntas)
      if (evaluacion_id && cargoKey && dificultadTarget === 'mixta' && cantidadTarget === 20) {
        const hashCargo = `cargo:${evaluacion_id}:${cargoKey}`
        await supabase.from('bancos_preguntas').upsert(
          { pdf_hash: hashCargo, evaluacion_id: parseInt(evaluacion_id, 10), cargo: cargo.trim(), preguntas, created_at: new Date().toISOString() },
          { onConflict: 'pdf_hash,evaluacion_id' }
        )
      }
    }

    const { data: sim, error: simErr } = await supabase.from('user_simulacros')
      .insert({
        user_id:           userId,
        evaluacion_id:     evaluacion_id ? parseInt(evaluacion_id, 10) : null,
        cargo:             cargo?.trim() || null,
        preguntas,
        cantidad_preguntas: cantidadTarget,
        tiempo_por_pregunta: tiempoPregunta || null,
        dificultad_config:  dificultadTarget,
      })
      .select('id').single()

    if (simErr) throw new Error('Error guardando simulacro: ' + simErr.message)

    if (tokensIn + tokensOut > 0)
      await recordTokenUsage({ userId, purchaseId: compra.id, tokensIn, tokensOut, endpoint: 'simulacro', modelo })

    return res.json({ simulacro_id: sim.id, total: preguntas.length, desde_cache: tokensIn === 0 })

  } catch (err) {
    console.error('[IA] generarSimulacroPersonal:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Análisis de sala ────────────────────────────────────────────────

export async function analizarSala(req, res) {
  try {
    const userId = req.user.id
    const { participantes, total, modelo = 'gemini' } = req.body
    if (!Array.isArray(participantes) || !participantes.length || !total)
      return res.status(400).json({ error: 'Faltan datos de participantes.' })

    const prompt = `Analiza estos resultados de una sala de competencia de simulacros del estado colombiano y genera un análisis breve, concreto y motivador en español colombiano (máx. 200 palabras):

Participantes:
${participantes.map((p, i) => `${i + 1}. ${p.display_name}: ${p.correct} aciertos, ${p.wrong} errores de ${total} preguntas (${Math.round((p.correct / total) * 100)}%)`).join('\n')}

Incluye: quién destacó y por qué, puntos de mejora, recomendaciones de estudio y mensaje motivacional.`

    const { texto, tokensIn, tokensOut } = modelo === 'deepseek'
      ? await deepseekTexto(prompt) : await geminiTexto(prompt)

    // Registrar uso (soft — no bloquear por tokens en salas)
    const compra = await getActivePurchase(userId).catch(() => null)
    if (compra?.id)
      recordTokenUsage({ userId, purchaseId: compra.id, tokensIn, tokensOut, endpoint: 'sala', modelo }).catch(() => {})

    return res.json({ analisis: texto })
  } catch (err) {
    console.error('[IA] analizarSala:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Chat contextual ─────────────────────────────────────────────────

export async function chatIA(req, res) {
  try {
    const userId = req.user.id
    const { mensaje, contexto_evaluacion, historial = [], modelo = 'gemini' } = req.body

    const compra = await getActivePurchase(userId)
    if (!compra?.packages?.has_ai_chat)
      return res.status(403).json({ error: 'Tu plan no incluye el asistente de IA.' })

    const balance = await checkTokenBalance(userId, compra.id)
    if (!balance.ok)
      return res.status(402).json({
        error: `Tokens de IA agotados (${balance.used.toLocaleString()} / ${balance.limit.toLocaleString()} usados). Renueva tu plan para continuar.`,
        tokens_agotados: true,
      })

    // Construir contexto del usuario (historial, áreas débiles, etc.)
    const userCtx = await buildUserContext(userId)

    const systemCtx = [
      contexto_evaluacion
        ? `Eres Praxia, la asistente de estudio personal del usuario para el examen "${contexto_evaluacion}". Tienes un tono cálido, cercano y motivador — como una tutora o compañera de estudio que de verdad quiere que el usuario salga adelante. Si es la primera vez que alguien te habla (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale en qué lo puedes ayudar hoy. En las demás respuestas, sé natural y directa sin necesidad de presentarte de nuevo. Nunca respondas de forma fría o robótica. Usa lenguaje natural en español colombiano, con energía positiva. Ayuda con temas del examen, explica conceptos difíciles con ejemplos, da estrategias de estudio y motiva cuando el usuario se sienta frustrado.`
        : `Eres Praxia, la asistente de estudio personal del usuario para concursos públicos colombianos. Tienes un tono cálido, cercano y motivador — como una tutora que de verdad quiere que el usuario tenga éxito. Si es la primera vez que te hablan (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale cómo lo puedes ayudar. En las demás respuestas sé natural y directa. Usa lenguaje natural en español colombiano.`,
      userCtx || '',
    ].join('\n\n')

    const { texto, tokensIn, tokensOut } = modelo === 'deepseek'
      ? await deepseekChat(systemCtx, historial, mensaje)
      : await geminiChat(systemCtx, historial, mensaje)

    await recordTokenUsage({ userId, purchaseId: compra.id, tokensIn, tokensOut, endpoint: 'chat', modelo })

    return res.json({ respuesta: texto, tokens_restantes: balance.remaining - tokensIn - tokensOut })

  } catch (err) {
    console.error('[IA] chatIA:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Verificar OPEC con Google Search ────────────────────────────────

const VERIFICACION_FALLBACK = { encontrado: false, entidad: null, total_preguntas: null, duracion_minutos: null, modulos: [], año_info: null, nota: null }

export async function verificarOpec(req, res) {
  const { cargo } = req.body
  if (!cargo?.trim()) return res.status(400).json({ error: 'Cargo requerido' })

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      tools: [{ googleSearch: {} }],
    })

    const prompt = `Busca en internet información ACTUAL sobre la prueba de conocimientos (OPEC) para el cargo "${cargo.trim()}" en el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

Responde EXCLUSIVAMENTE con este JSON (sin markdown, sin texto adicional):
{"encontrado":true,"entidad":"nombre de la entidad","total_preguntas":número,"duracion_minutos":número_o_null,"modulos":[{"nombre":"nombre del módulo","porcentaje":número}],"año_info":"2024 o 2025","nota":"observación relevante o null"}

Si no encuentras información específica para ese cargo, responde exactamente:
{"encontrado":false,"entidad":null,"total_preguntas":null,"duracion_minutos":null,"modulos":[],"año_info":null,"nota":null}`

    const result = await model.generateContent(prompt)
    const raw    = result.response.text() || ''
    // Extraer el objeto JSON del texto (el modelo puede agregar texto extra)
    const match  = raw.match(/\{[\s\S]*\}/)
    if (!match) return res.json({ verificacion: VERIFICACION_FALLBACK })

    const data = JSON.parse(match[0])
    return res.json({ verificacion: data })

  } catch (e) {
    console.error('[IA] verificarOpec:', e.message)
    return res.json({ verificacion: VERIFICACION_FALLBACK })
  }
}
