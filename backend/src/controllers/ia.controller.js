// ia.controller.js
// Dual-provider AI: Gemini + DeepSeek.
// Cada endpoint: verifica tokens → inyecta contexto del usuario → genera → registra uso.

import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { checkTokenBalance, recordTokenUsage, getActivePurchase } from '../utils/tokenTracker.js'
import { buildUserContext } from '../utils/contextBuilder.js'
import { getPrompt } from '../utils/promptLoader.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey:  process.env.DEEPSEEK_API_KEY || '',
})

// ── Prompt base ───────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto psicómetra senior en diseño de pruebas de juicio situado para concursos de méritos del sector público colombiano (CNSC, Contraloría General, Fiscalía, DIAN, Procuraduría, alcaldías, gobernaciones y entidades nacionales y territoriales).

Tu misión es transformar OPEC, manuales de funciones y convocatorias en preguntas de JUICIO SITUADO de alta fidelidad. No evalúas memorización, evalúas la capacidad real del aspirante para tomar decisiones correctas bajo presión, con criterio técnico, legal, ético y administrativo.

═══ CASUÍSTICA REAL DE OFICINA PÚBLICA ═══
Cada pregunta debe ser una situación concreta y realista con tensión administrativa. NUNCA uses narraciones genéricas.

❌ MAL: "Un servidor público recibe una solicitud de un ciudadano."
✅ BIEN: "En la Secretaría de Planeación de un municipio de sexta categoría, una veeduría ciudadana radica por Orfeo una solicitud para consultar los soportes técnicos de una obra financiada con regalías que aparece reportada como ejecutada, aunque la comunidad afirma que no presta el servicio. El jefe de dependencia indica al servidor que no entregue los documentos hasta que el alcalde autorice."

El CONTEXTO (100-150 palabras) debe incluir SIEMPRE:
- Dependencia específica real (Oficina de Control Interno, Secretaría de Hacienda, Área de Contratación, División de Fiscalización...)
- Sistema o herramienta real (SECOP II, Orfeo, SIIF, SIGEP, SIMAT, MIPG, PQRSDF, SIA Observa...)
- Un dilema técnico, legal o ético concreto
- Una presión o restricción (término legal próximo, presión jerárquica, hallazgo de auditoría, urgencia ciudadana)
- El riesgo explícito de actuar incorrectamente (daño fiscal, sanción disciplinaria, vulneración de derechos, pérdida de trazabilidad)

El ENUNCIADO debe formularse como pregunta de acción directa: "¿Cuál es la actuación correcta?", "¿Cómo debe proceder el servidor?", "¿Qué decisión se ajusta al marco normativo del cargo?"

═══ ARQUITECTURA PSICOMÉTRICA DE 4 OPCIONES (OBLIGATORIO) ═══
Cada pregunta tiene EXACTAMENTE 4 opciones con roles psicométricos específicos:

A = CORRECTA: Única opción legal, técnica y funcionalmente válida. Respeta la competencia del cargo, sigue el procedimiento, protege la trazabilidad, evita omisión y extralimitación, y está respaldada por norma o jurisprudencia.

B = DISTRACTOR DE SENTIDO COMÚN (atractor ético): Suena amable, colaborativa o prudente, pero falla porque omite el procedimiento formal, no deja evidencia, resuelve informalmente un asunto que exige trámite reglado, o prioriza la buena intención sobre la legalidad.

C = DISTRACTOR DE PROCEDIMIENTO ERRÓNEO (atractor técnico): Usa norma, trámite o sistema REAL pero aplicado incorrectamente — norma que no corresponde, trámite fuera de término, dependencia equivocada, o figura legal usada en momento procesal incorrecto.

D = DISTRACTOR DE EXCESO (atractor de poder): El servidor se extralimita — ordena lo que no puede ordenar, sanciona sin competencia, decide por el ordenador del gasto, el comité, el supervisor u otra autoridad, o asume funciones de control o mando que no le corresponden.

REGLA CRÍTICA: Las 4 opciones deben ser homogéneas en extensión y tono. Ninguna debe ser absurda ni evidentemente incorrecta. Todas deben parecer plausibles para quien no domina el tema.

═══ DISTRIBUCIÓN 70/30 ═══
- 70% PREGUNTAS FUNCIONALES: Evalúan el saber hacer técnico y legal. Situaciones donde una mala decisión genera riesgo disciplinario, fiscal, contractual, reputacional o vulneración de derechos ciudadanos.
- 30% PREGUNTAS COMPORTAMENTALES: Evalúan competencias del Decreto 815/2018 — aprendizaje continuo, orientación a resultados, orientación al ciudadano, compromiso institucional, trabajo en equipo, adaptación al cambio, transparencia, integridad, liderazgo, toma de decisiones.

═══ EJES TRANSVERSALES (al menos uno por pregunta) ═══
MIPG · Ley 1712/2014 (transparencia y acceso a información) · Código de Integridad del Servicio Público · Régimen disciplinario (Ley 1952/2019 y Ley 2094/2021) · Derecho de petición (Ley 1755/2015) · Gestión documental y trazabilidad · Control interno y mejora continua · Anticorrupción · Responsabilidad fiscal · Servicio al ciudadano

═══ NORMATIVA BASE ═══
Constitución Política · CPACA (Ley 1437/2011) · Ley 80/1993 · Ley 1150/2007 · Ley 1474/2011 · Ley 1712/2014 · Ley 1755/2015 · Decreto 1083/2015 · Decreto 815/2018 · Ley 1952/2019 · Ley 2094/2021 · normativa sectorial específica del cargo. NO inventes normas, sentencias ni hallazgos.

═══ NIVELES DE COMPLEJIDAD (Bloom adaptado) ═══
Nivel I (básico): reconocimiento normativo — cargos asistenciales y técnicos
Nivel II (medio): aplicación en situación concreta con presión moderada — técnicos y profesionales
Nivel III (alto analítico): decisión en escenario ambiguo con tensión entre legalidad, presión y riesgo — profesionales, asesores, directivos

═══ CONTROL DE CALIDAD POR ÍTEM ═══
✓ El caso menciona dependencia, sistema o documento específico — NO es genérico
✓ La opción A es la única correcta legal y técnicamente
✓ B suena bien pero falla técnicamente (sentido común sin soporte procedimental)
✓ C usa herramienta o norma real, pero mal aplicada
✓ D implica extralimitación de funciones
✓ El eje transversal afecta directamente la decisión correcta
✓ La pregunta evalúa juicio situado, no memorización mecánica
✓ El enunciado NO revela ni insinúa la respuesta correcta
✓ La explicacion cita la norma, artículo o principio que respalda la opción correcta

Devuelve ÚNICAMENTE un arreglo JSON válido sin markdown ni texto adicional:
[{"area":"...","tipo":"funcional|comportamental","dificultad":"facil|medio|dificil","enunciado":"...","A":"...","B":"...","C":"...","D":"...","correcta":"A|B|C|D","explicacion":"..."}]`

// Siempre se añade al final del SP para garantizar el formato aunque el admin haya modificado el prompt
const FORMAT_ENFORCER = `

⚠️ REGLA CRÍTICA DE SALIDA (NO NEGOCIABLE):
Devuelve ÚNICAMENTE el array JSON. Sin texto antes ni después. Sin bloques de código markdown.
Cada objeto DEBE tener exactamente estas propiedades:
{"area":"...","tipo":"funcional|comportamental","dificultad":"facil|medio|dificil","enunciado":"...","A":"...","B":"...","C":"...","D":"...","correcta":"A|B|C|D","explicacion":"..."}
- SIEMPRE 4 opciones: A, B, C y D. NUNCA menos de 4.
- "correcta" debe ser EXACTAMENTE "A", "B", "C" o "D" (mayúscula, sin puntos, sin nada más).
- "tipo" debe ser exactamente "funcional" o "comportamental".`

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
    if (!['A','B','C','D'].includes(p.correcta?.toUpperCase?.())) throw new Error(`Pregunta ${i + 1}: correcta debe ser A, B, C o D.`)
    // Normalizar tipo si no viene
    if (!p.tipo) p.tipo = 'funcional'
  }
  return arr.map(p => ({ ...p, correcta: p.correcta.toUpperCase() }))
}

function formatError(err) {
  const msg = (err.message || '').toLowerCase()
  if (msg.includes('429') || msg.includes('quota') || msg.includes('too many') || msg.includes('rate limit') || msg.includes('resource_exhausted'))
    return 'El servicio de IA está temporalmente saturado. Intenta en unos minutos o usa DeepSeek.'
  if (msg.includes('404') || msg.includes('not found'))
    return 'Modelo de IA no disponible temporalmente. Prueba el otro modelo.'
  if (msg.includes('401') || msg.includes('403') || msg.includes('api key') || msg.includes('authentication') || msg.includes('permission_denied'))
    return 'Error de autenticación con el servicio de IA. Verifica la API key.'
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound'))
    return 'No se pudo conectar con el servicio de IA. Verifica tu conexión.'
  if (msg.includes('json') || msg.includes('parse'))
    return 'El modelo devolvió un formato inesperado. Intenta de nuevo.'
  if (msg.includes('unavailable') || msg.includes('overload') || msg.includes('service'))
    return 'El servicio de IA está sobrecargado. Intenta en unos minutos.'
  // Log completo para diagnóstico en Railway
  console.error('[formatError] unmatched:', err.name, '|', err.message?.slice(0, 200))
  return 'El servicio de IA no pudo responder. Intenta de nuevo o cambia a DeepSeek.'
}

// ── Gemini ────────────────────────────────────────────────────────────────────

async function geminiGenerar(parts) {
  const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  const result = await model.generateContent(Array.isArray(parts) ? parts : [parts])
  const usage  = result.response.usageMetadata
  return {
    texto:     result.response.text(),
    tokensIn:  usage?.promptTokenCount     || 0,
    tokensOut: usage?.candidatesTokenCount || 0,
  }
}

async function geminiTexto(prompt) {
  const model  = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
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
    const SP = (await getPrompt('opec_maestro', SYSTEM_PROMPT)) + FORMAT_ENFORCER

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
        const prompt  = `${SP}\n\nCARGO OBJETIVO: ${cargo || 'General'}\n\n${pdfText ? `MATERIAL DE ESTUDIO:\n${pdfText.slice(0, 12000)}\n\n` : ''}Analiza el material y genera el banco de preguntas.`
        result = await deepseekGenerar(prompt)
      } else {
        const pdfPart = { inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } }
        const prompt  = `${SP}\n\nCARGO OBJETIVO: ${cargo || 'General'}\n\nAnaliza el material adjunto y genera el banco de preguntas.`
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

    const prompt = `${SP}\n\nCARGO OBJETIVO: ${cargo}\n\nGenera preguntas típicas para este cargo en el sector público colombiano.`
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
    const SP = (await getPrompt('opec_maestro', SYSTEM_PROMPT)) + FORMAT_ENFORCER

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

    const promptBase = `${SP}\n\n${instrConfig}`

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

      // Contexto de cargo: instrucciones estáticas enriquecidas (sin llamada extra a la API)
      const cargoCtx = cargo ? `

CARGO OBJETIVO: ${cargo}

INSTRUCCIONES PARA ESTE CARGO:
- Cada pregunta debe situar al aspirante como "${cargo}" ejerciendo sus funciones reales en una entidad del sector público colombiano.
- Usa dependencias concretas: Oficina de Control Interno, Secretaría de Hacienda, Área de Contratación, División de Talento Humano, Oficina Jurídica, Subdirección de Gestión Documental, Área de TIC, Secretaría de Planeación, etc., según el perfil del cargo.
- Usa sistemas reales: SECOP II, SIGEP, ORFEO, SIIF, MIPG, PQRSDF, SIA Observa, SIMAT, CHIP, SIMIT, acorde al cargo.
- Menciona documentos y trámites reales: resoluciones, actos administrativos, pliegos de condiciones, estudios previos, contratos, informes de auditoría, PAA, planes de mejoramiento, nómina, certificados SIGEP, etc.
- Las 4 opciones deben ser plausibles para quien no domina el tema. Aplica los roles psicométricos del prompt.
- NUNCA generes situaciones genéricas — cada caso debe ser específico al cargo.` : ''

      // Distribución Prompt Maestro: 70% Funcionales / 30% Comportamentales
      function calcularLotes() {
        const f = Math.round(cantidadTarget * 0.70)
        const c = cantidadTarget - f
        const lotes = []
        for (let r = f; r > 0; r -= BATCH) lotes.push({ n: Math.min(BATCH, r),
          tipo: 'funcional',
          area: 'Competencias Funcionales',
          instrArea: 'conocimiento técnico del cargo, normativa aplicable, procedimientos, legislación sectorial específica y situaciones donde una mala decisión genera riesgo disciplinario, fiscal, contractual o reputacional. "tipo":"funcional"' })
        for (let r = c; r > 0; r -= BATCH) lotes.push({ n: Math.min(BATCH, r),
          tipo: 'comportamental',
          area: 'Competencias Comportamentales',
          instrArea: 'competencias del Decreto 815/2018: aprendizaje continuo, orientación a resultados, orientación al ciudadano, compromiso institucional, trabajo en equipo, adaptación al cambio, transparencia, integridad, liderazgo, toma de decisiones. "tipo":"comportamental"' })
        return lotes
      }

      async function generarLote(lote) {
        const instr = [
          `- Genera EXACTAMENTE ${lote.n} preguntas.`,
          `- TIPO EXCLUSIVO de este lote: "${lote.tipo}". Área: "${lote.area}". Enfócate en: ${lote.instrArea}`,
          dificultadTarget !== 'mixta' ? `- TODAS de dificultad "${dificultadTarget}".` : '- Varía la dificultad: mezcla facil, medio y dificil de forma equilibrada.',
        ].filter(Boolean).join('\n')
        const prompt = `${SP}\n\n${instr}${cargoCtx}`
        if (modelo === 'deepseek') {
          const full = pdfText ? `${prompt}\n\nMATERIAL DE ESTUDIO:\n${pdfText.slice(0, 4000)}` : prompt
          // 4 opciones + contexto rico necesita más tokens por pregunta
          return deepseekGenerar(full, lote.n * 500 + 512)
        }
        return geminiGenerar(pdfPart ? [prompt, pdfPart] : [prompt])
      }

      if (cantidadTarget <= BATCH) {
        // ── Llamada única ──────────────────────────────────────────────────────
        let result
        const sp = `${promptBase}${cargoCtx}`
        if (file) {
          if (modelo === 'deepseek') {
            result = await deepseekGenerar(`${sp}\n\nMATERIAL DE ESTUDIO:\n${(pdfText || '').slice(0, 12000)}\n\nGenera exactamente ${cantidadTarget} preguntas.`, cantidadTarget * 500 + 512)
          } else {
            result = await geminiGenerar([`${sp}\n\nAnaliza el material y genera exactamente ${cantidadTarget} preguntas.`, pdfPart])
          }
        } else {
          const p = `${sp}\n\nGenera exactamente ${cantidadTarget} preguntas de juicio situado para este cargo.`
          result = modelo === 'deepseek' ? await deepseekGenerar(p, cantidadTarget * 500 + 512) : await geminiGenerar(p)
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

    const salaSystem = await getPrompt('sala_analisis', '')
    const prompt = `${salaSystem ? salaSystem + '\n\n' : ''}Analiza estos resultados de una sala de competencia de simulacros del estado colombiano y genera un análisis breve, concreto y motivador en español colombiano (máx. 200 palabras):

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
    const userCtx   = await buildUserContext(userId)
    const praxiaBase = await getPrompt('chat_praxia', null)

    const personalidad = praxiaBase
      ? praxiaBase.replace('{{EXAMEN}}', contexto_evaluacion || 'concursos públicos colombianos')
      : contexto_evaluacion
        ? `Eres Praxia, la asistente de estudio personal del usuario para el examen "${contexto_evaluacion}". Tienes un tono cálido, cercano y motivador — como una tutora o compañera de estudio que de verdad quiere que el usuario salga adelante. Si es la primera vez que alguien te habla (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale en qué lo puedes ayudar hoy. En las demás respuestas, sé natural y directa sin necesidad de presentarte de nuevo. Nunca respondas de forma fría o robótica. Usa lenguaje natural en español colombiano, con energía positiva. Ayuda con temas del examen, explica conceptos difíciles con ejemplos, da estrategias de estudio y motiva cuando el usuario se sienta frustrado.`
        : `Eres Praxia, la asistente de estudio personal del usuario para concursos públicos colombianos. Tienes un tono cálido, cercano y motivador — como una tutora que de verdad quiere que el usuario tenga éxito. Si es la primera vez que te hablan (historial vacío), salúdalo con entusiasmo, preséntate brevemente como Praxia y pregúntale cómo lo puedes ayudar. En las demás respuestas sé natural y directa. Usa lenguaje natural en español colombiano.`

    const systemCtx = [personalidad, userCtx || ''].join('\n\n')

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
      model: 'gemini-1.5-flash',
      tools: [{ googleSearch: {} }],
    })

    const opecTemplate = await getPrompt('verificar_opec', null)
    const prompt = opecTemplate
      ? opecTemplate.replace(/\{\{CARGO\}\}/g, cargo.trim())
      : `Busca en internet información ACTUAL sobre la prueba de conocimientos (OPEC) para el cargo "${cargo.trim()}" en el sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría, etc.).

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

// ── Endpoint: Info de usuarios para panel admin ───────────────────────────────
// Usa el service role key para leer auth.users (incluye usuarios de Google OAuth)

export async function getAdminUsers(req, res) {
  try {
    const { ids } = req.query
    const userIds = typeof ids === 'string' ? ids.split(',').filter(Boolean) : []
    if (!userIds.length) return res.json([])

    // listUsers pagina de a 1000 — suficiente para este proyecto
    const { data: authData, error } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    if (error) return res.status(500).json({ error: error.message })

    const result = (authData?.users || [])
      .filter(u => userIds.includes(u.id))
      .map(u => ({
        id:         u.id,
        email:      u.email || '',
        full_name:  u.user_metadata?.full_name || u.user_metadata?.name || '',
        avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
      }))

    return res.json(result)
  } catch (err) {
    console.error('[admin] getAdminUsers:', err)
    return res.status(500).json({ error: 'No se pudo obtener info de usuarios.' })
  }
}

// ── Endpoint: Análisis post-simulacro ────────────────────────────────────────

export async function analizarResultadosSimulacro(req, res) {
  try {
    const userId = req.user.id
    const { cargo, preguntas: preg, modelo = 'gemini' } = req.body

    if (!Array.isArray(preg) || !preg.length)
      return res.status(400).json({ error: 'Faltan datos de preguntas.' })

    // Calcular métricas base
    const total       = preg.length
    const correctas   = preg.filter(p => p.es_correcta).length
    const score       = Math.round((correctas / total) * 100)
    const funcionales = preg.filter(p => p.tipo === 'funcional')
    const comportament= preg.filter(p => p.tipo === 'comportamental')
    const corrFunc    = funcionales.filter(p => p.es_correcta).length
    const corrComp    = comportament.filter(p => p.es_correcta).length

    // Analizar patrones de distractor
    const errores = preg.filter(p => !p.es_correcta && p.opcion_elegida)
    const distractorCounts = { A: 0, B: 0, C: 0, D: 0 }
    errores.forEach(p => { if (p.opcion_elegida) distractorCounts[p.opcion_elegida]++ })

    // Áreas con más errores
    const errorsPorArea = {}
    preg.filter(p => !p.es_correcta).forEach(p => {
      const a = p.area || 'General'
      errorsPorArea[a] = (errorsPorArea[a] || 0) + 1
    })

    // Tiempos
    const tiempos = preg.map(p => p.tiempo_segundos).filter(Boolean)
    const tiempoPromedio = tiempos.length ? Math.round(tiempos.reduce((a,b)=>a+b,0)/tiempos.length) : null
    const preguntasLentas = preg
      .filter(p => p.tiempo_segundos && tiempoPromedio && p.tiempo_segundos > tiempoPromedio * 1.8)
      .map(p => p.area || 'General')

    const resumenDatos = `
CARGO OBJETIVO: ${cargo || 'No especificado'}
RESULTADO GLOBAL: ${score}% (${correctas}/${total} correctas)
FUNCIONALES: ${corrFunc}/${funcionales.length} correctas (${funcionales.length ? Math.round(corrFunc/funcionales.length*100) : 0}%)
COMPORTAMENTALES: ${corrComp}/${comportament.length} correctas (${comportament.length ? Math.round(corrComp/comportament.length*100) : 0}%)
OPCIONES ELEGIDAS EN ERROR: A=${distractorCounts.A} B=${distractorCounts.B} C=${distractorCounts.C} D=${distractorCounts.D}
ÁREAS CON MÁS ERRORES: ${Object.entries(errorsPorArea).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k,v])=>`${k}(${v})`).join(', ') || 'Ninguna'}
TIEMPO PROMEDIO POR PREGUNTA: ${tiempoPromedio ? `${tiempoPromedio}s` : 'No medido'}
ÁREAS LENTAS: ${[...new Set(preguntasLentas)].join(', ') || 'Ninguna'}

DETALLE POR PREGUNTA (solo errores):
${preg.filter(p=>!p.es_correcta).slice(0,8).map((p,i)=>`- ${p.area||'General'} | Eligió ${p.opcion_elegida||'sin resp'} | Correcta ${p.opcion_correcta} | ${p.dificultad||'medio'}`).join('\n')}`

    const systemPrompt = `Eres un psicómetra y coach de carrera administrativa del sector público colombiano. Analizas resultados de simulacros de pruebas de juicio situado (OPEC) y generas retroalimentación profesional, honesta y motivadora en español colombiano natural.

Recibirás métricas de rendimiento de un aspirante y deberás generar un análisis COMPLETO en formato JSON. El análisis debe ser específico, no genérico: menciona competencias reales, normas específicas si aplica, y da consejos accionables.

La arquitectura de distractores del simulacro es:
- A = Respuesta correcta
- B = Distractor sentido común (actúa bien pero sin procedimiento formal)
- C = Distractor procedimiento erróneo (usa norma o trámite real, mal aplicado)
- D = Distractor exceso (se extralimita en funciones o autoridad)

Devuelve ÚNICAMENTE este JSON sin markdown:
{
  "nivel_preparacion": "inicial|básico|intermedio|avanzado|experto",
  "resumen": "2-3 oraciones directas sobre el desempeño general del aspirante",
  "fortalezas": ["fortaleza concreta 1", "fortaleza concreta 2"],
  "areas_mejora": ["área de mejora concreta 1", "área de mejora concreta 2"],
  "patron_error": "descripción del patrón de error más frecuente (sentido común, exceso de poder, norma mal aplicada, etc.)",
  "tipo_distractor_frecuente": "A|B|C|D",
  "significado_distractor": "qué revela ese distractor sobre el pensamiento del aspirante",
  "recomendaciones": ["recomendación accionable 1", "recomendación accionable 2", "recomendación accionable 3"],
  "temas_criticos": ["tema que debe reforzar 1", "tema que debe reforzar 2"],
  "analisis_tiempo": "análisis breve de la gestión del tiempo (si hay datos)",
  "mensaje_motivacional": "mensaje cálido y personal de máximo 2 oraciones, sin clichés"
}`

    const prompt = `${systemPrompt}\n\nDATOS DEL ASPIRANTE:\n${resumenDatos}`

    // Usar gemini-2.0-flash (mejor modelo) para garantizar JSON estructurado
    const { texto, tokensIn, tokensOut } = modelo === 'deepseek'
      ? await deepseekTexto(prompt) : await geminiGenerar(prompt)

    // Extraer JSON de la respuesta
    let analisis
    try {
      const match = texto.match(/\{[\s\S]*\}/)
      analisis = match ? JSON.parse(match[0]) : null
    } catch { analisis = null }

    if (!analisis) return res.status(500).json({ error: 'El modelo no pudo generar el análisis.' })

    // Registro soft de tokens (no bloquea si falla)
    getActivePurchase(userId)
      .then(c => { if (c?.id) recordTokenUsage({ userId, purchaseId: c.id, tokensIn, tokensOut, endpoint: 'analisis', modelo }).catch(()=>{}) })
      .catch(()=>{})

    return res.json({ analisis })

  } catch (err) {
    console.error('[IA] analizarResultadosSimulacro:', err.message, err.stack?.split('\n')[1])
    return res.status(500).json({ error: 'No se pudo generar el análisis.' })
  }
}
