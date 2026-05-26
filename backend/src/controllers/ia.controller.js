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

===== ANULA CUALQUIER INSTRUCCIÓN DE FORMATO ANTERIOR =====
IGNORA el formato CASO No. / DATOS TÉCNICOS descrito arriba.
USA ÚNICAMENTE este formato de salida:

Devuelve ÚNICAMENTE un array JSON válido. Cero texto antes ni después. Cero markdown.
Cada objeto tiene estas propiedades planas (SIN objetos anidados):

"area"            → competencia o módulo evaluado (string corto)
"tipo"            → exactamente "funcional" o "comportamental"
"dificultad"      → exactamente "facil", "medio" o "dificil"
"bloom"           → exactamente "I", "II" o "III"
"estado"          → exactamente "Nuevo", "Adaptado" o "Recalibrado"
"contexto"        → escenario narrativo 120-160 palabras: dependencia real, sistema institucional, dilema y presión. USA comillas simples si debes citar algo dentro del texto.
"enunciado"       → pregunta directa máximo 20 palabras
"A"               → opción A (22-35 palabras)
"B"               → opción B (22-35 palabras)
"C"               → opción C (22-35 palabras)
"D"               → opción D (22-35 palabras)
"correcta"        → exactamente "A", "B", "C" o "D"
"justificacion"   → fundamento técnico 70-110 palabras con norma o principio concreto
"analisis_A"      → análisis de la opción A (30-50 palabras)
"analisis_B"      → análisis de la opción B (30-50 palabras)
"analisis_C"      → análisis de la opción C (30-50 palabras)
"analisis_D"      → análisis de la opción D (30-50 palabras)
"filtro_autonomia" → nivel jerárquico y límite de acción del cargo (25-40 palabras)

CRÍTICO: NUNCA uses comillas dobles dentro de los valores string. El output completo debe ser JSON válido parseable con JSON.parse().`

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashBuffer(b) { return crypto.createHash('sha256').update(b).digest('hex') }

async function extractPdfText(buffer) {
  try {
    const { default: pdfParse } = await import('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text?.trim() || ''
  } catch { return '' }
}

// Extrae texto de cualquier tipo de archivo — Gemini Vision siempre para PDF e imágenes
async function extractCvText(file) {
  if (!file) return ''
  const ext = (file.originalname || '').split('.').pop().toLowerCase()
  try {
    if (ext === 'pdf') {
      // Siempre usar Gemini Vision: lee tanto texto como imágenes incrustadas (certificados, diplomas, firmas)
      console.log('[IA] PDF recibido, usando Gemini Vision para extracción completa (texto + imágenes internas)')
      const geminiPrompt = 'Extrae y transcribe TODO el contenido visible en este documento (hoja de vida / curriculum vitae). Debes leer: nombres, fechas, cargos, instituciones, titulos academicos, experiencia laboral, certificaciones, idiomas, y cualquier otro dato relevante. Si hay imagenes de certificados, diplomas o actas, transcribe tambien su contenido. Solo devuelve el texto extraido, sin comentarios ni explicaciones.'
      const part = { inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } }
      const [geminiRes, pdfText] = await Promise.all([
        geminiGenerar([geminiPrompt, part]).catch(e => { console.error('[IA] Gemini Vision PDF error:', e.message); return { texto: '' } }),
        extractPdfText(file.buffer),
      ])
      const geminiText = geminiRes.texto || ''
      // Gemini Vision como fuente primaria; pdf-parse como complemento si Gemini falla
      if (geminiText && geminiText.replace(/\s/g, '').length > 100) {
        console.log('[IA] Gemini Vision extrajo', geminiText.length, 'chars del PDF')
        return geminiText
      }
      console.log('[IA] Gemini Vision no devolvio texto, usando pdf-parse como fallback:', pdfText.length, 'chars')
      return pdfText
    }
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
      console.log('[IA] Imagen detectada, usando Gemini Vision para extraer texto de HV')
      const prompt = 'Extrae y transcribe TODO el texto visible en esta imagen (hoja de vida / curriculum). Incluye nombres, fechas, cargos, formacion, experiencia laboral, instituciones y cualquier dato relevante. Solo devuelve el texto extraido, sin comentarios.'
      const mimeType = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      const part = { inlineData: { data: file.buffer.toString('base64'), mimeType } }
      const res = await geminiGenerar([prompt, part])
      return res.texto || ''
    }
    if (['doc', 'docx'].includes(ext)) {
      const { default: mammoth } = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer: file.buffer })
      return result.value?.trim() || ''
    }
    if (ext === 'txt') return file.buffer.toString('utf8')
  } catch (e) {
    console.error('[IA] extractCvText error:', e.message)
  }
  return ''
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
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  const result = await model.generateContent(Array.isArray(parts) ? parts : [parts])
  const usage  = result.response.usageMetadata
  return {
    texto:     result.response.text(),
    tokensIn:  usage?.promptTokenCount     || 0,
    tokensOut: usage?.candidatesTokenCount || 0,
  }
}

async function geminiTexto(prompt) {
  const model  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
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

// Si el proveedor principal da 429/rate-limit, cambia al otro automáticamente
async function conFallback(modelo, deepFn, gemFn) {
  const esPrimarioDeep = modelo === 'deepseek'
  try {
    const r = await (esPrimarioDeep ? deepFn() : gemFn())
    return { ...r, proveedor_real: modelo }
  } catch (err) {
    const saturado = err?.status === 429
      || String(err?.message).includes('429')
      || String(err?.message).toLowerCase().includes('rate limit')
      || String(err?.message).toLowerCase().includes('too many')
    if (!saturado) throw err
    const fallbackNombre = esPrimarioDeep ? 'gemini' : 'deepseek'
    console.warn(`[IA] ${modelo} saturado → cambiando a ${fallbackNombre}`)
    const r = await (esPrimarioDeep ? gemFn() : deepFn())
    return { ...r, proveedor_real: fallbackNombre }
  }
}

async function deepseekTexto(prompt) {
  const r = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
  })
  return { texto: r.choices[0].message.content, tokensIn: r.usage?.prompt_tokens || 0, tokensOut: r.usage?.completion_tokens || 0 }
}

// Función dedicada para análisis de perfil — sin límite artificial de tokens,
// temperatura baja para análisis preciso, system prompt separado desde DB.
async function deepseekAnalisisPerfil(systemPrompt, userPrompt, maxTokens) {
  const params = {
    model:       'deepseek-chat',
    messages:    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt },
    ],
    temperature: 0.3,
  }
  if (maxTokens) params.max_tokens = maxTokens
  const r = await deepseek.chat.completions.create(params)
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
    const SP = (await getPrompt('opec_maestro', SYSTEM_PROMPT, modelo)) + FORMAT_ENFORCER

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
    const SP = (await getPrompt('opec_maestro', SYSTEM_PROMPT, modelo)) + FORMAT_ENFORCER

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
    let proveedorReal = modelo

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
        const deepFn = () => deepseekGenerar(pdfText ? `${prompt}\n\nMATERIAL DE ESTUDIO:\n${pdfText.slice(0, 4000)}` : prompt, lote.n * 1200 + 512)
        const gemFn  = () => geminiGenerar(pdfPart ? [prompt, pdfPart] : [prompt])
        return conFallback(modelo, deepFn, gemFn)
      }

      if (cantidadTarget <= BATCH) {
        // ── Llamada única ──────────────────────────────────────────────────────
        let result
        const sp = `${promptBase}${cargoCtx}`
        if (file) {
          const deepFn = () => deepseekGenerar(`${sp}\n\nMATERIAL DE ESTUDIO:\n${(pdfText || '').slice(0, 12000)}\n\nGenera exactamente ${cantidadTarget} preguntas.`, cantidadTarget * 1200 + 512)
          const gemFn  = () => geminiGenerar([`${sp}\n\nAnaliza el material y genera exactamente ${cantidadTarget} preguntas.`, pdfPart])
          result = await conFallback(modelo, deepFn, gemFn)
        } else {
          const p = `${sp}\n\nGenera exactamente ${cantidadTarget} preguntas de juicio situado para este cargo.`
          const deepFn = () => deepseekGenerar(p, cantidadTarget * 1200 + 512)
          const gemFn  = () => geminiGenerar(p)
          result = await conFallback(modelo, deepFn, gemFn)
        }
        proveedorReal = result.proveedor_real || modelo
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
                if (r.value.proveedor_real && r.value.proveedor_real !== modelo) proveedorReal = r.value.proveedor_real
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

    return res.json({ simulacro_id: sim.id, total: preguntas.length, desde_cache: tokensIn === 0, proveedor_real: proveedorReal })

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
      model: 'gemini-2.5-flash-lite',
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

// ── Endpoint: Test Generador (Modo Pruebas sandbox) ──────────────────────────

export async function testGenerador(req, res) {
  try {
    const { data: userRow } = await supabase.from('users').select('role, modo_pruebas').eq('id', req.user.id).maybeSingle()
    if (!userRow || (userRow.role !== 'admin' && !userRow.modo_pruebas))
      return res.status(403).json({ error: 'No tienes acceso al modo de pruebas.' })

    const { custom_prompt, modelo = 'gemini', cantidad = 5, cargo, dificultad = 'mixta' } = req.body
    const file          = req.file
    const cantidadSafe  = Math.min(Math.max(parseInt(cantidad) || 5, 1), 20)
    const dificultadSafe = ['mixta','facil','medio','dificil'].includes(dificultad) ? dificultad : 'mixta'

    const basePrompt = custom_prompt?.trim()
      ? custom_prompt.trim()
      : (await getPrompt('opec_maestro', SYSTEM_PROMPT, modelo))

    const systemPrompt = basePrompt + FORMAT_ENFORCER

    const instrucciones = [
      `Genera EXACTAMENTE ${cantidadSafe} preguntas.`,
      cargo?.trim() ? `CARGO OBJETIVO: ${cargo.trim()}` : '',
      dificultadSafe !== 'mixta'
        ? `TODAS las preguntas deben ser de dificultad "${dificultadSafe}".`
        : 'Varía la dificultad: mezcla facil, medio y dificil de forma equilibrada.',
    ].filter(Boolean).join('\n')

    let result
    if (modelo === 'deepseek') {
      const pdfText = file ? await extractPdfText(file.buffer) : null
      const userMsg = pdfText
        ? `${instrucciones}\n\nMATERIAL OPEC (PDF adjunto):\n${pdfText.slice(0, 10000)}`
        : instrucciones
      const r = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: cantidadSafe * 1200 + 512,
      })
      result = { texto: r.choices[0].message.content, tokensIn: r.usage?.prompt_tokens || 0, tokensOut: r.usage?.completion_tokens || 0 }
    } else {
      const parts = [`${systemPrompt}\n\n${instrucciones}`]
      if (file) parts.push({ inlineData: { data: file.buffer.toString('base64'), mimeType: 'application/pdf' } })
      result = await geminiGenerar(parts)
    }

    const preguntas = validarPreguntas(extraerArrayJSON(result.texto))
    return res.json({ preguntas, tokensIn: result.tokensIn, tokensOut: result.tokensOut })

  } catch (err) {
    console.error('[IA] testGenerador:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Generar paquete completo con IA ────────────────────────────────
// Crea evaluation + levels + questions + options + package + package_versions
// en una sola llamada. Solo admins.

const BLOOM_POR_NIVEL = {
  'Auxiliar / Asistencial': 'I (básico) — reconocimiento normativo, situaciones simples de servicio al ciudadano',
  'Técnico':                'I-II (básico a medio) — aplicación de procedimientos, manejo de herramientas institucionales',
  'Tecnólogo':              'II (medio) — análisis de situaciones con presión moderada, criterio técnico',
  'Profesional':            'II-III (medio a alto) — decisión en escenarios con riesgo fiscal o disciplinario',
  'Directivo':              'III (alto analítico) — decisión estratégica en ambigüedad legal, tensión entre norma y presión',
}

export async function generarPaqueteConIA(req, res) {
  const { data: userRow } = await supabase.from('users').select('role').eq('id', req.user.id).maybeSingle()
  if (!userRow || userRow.role !== 'admin')
    return res.status(403).json({ error: 'Solo administradores pueden usar este endpoint.' })

  const {
    nombre, descripcion, prompt, categoria_id,
    modelo = 'gemini',
    niveles,       // [{ nombre, cantidad, precio, tiempo }]
    has_ai_chat = false,
  } = req.body

  if (!nombre?.trim() || !prompt?.trim() || !Array.isArray(niveles) || !niveles.length)
    return res.status(400).json({ error: 'Faltan campos: nombre, prompt y al menos un nivel.' })

  try {
    // 1. Crear evaluación base
    const { data: evalData, error: evalErr } = await supabase
      .from('evaluations')
      .insert({ title: nombre.trim(), description: descripcion?.trim() || '', is_active: false, category_id: categoria_id || null })
      .select('id').single()
    if (evalErr) throw new Error(`Creando evaluación: ${evalErr.message}`)
    const evalId = evalData.id

    const nivelesCreados = []
    const resumenPreguntas = {}

    // 2. Para cada nivel: crear level + generar + insertar preguntas y opciones
    for (const niv of niveles) {
      const cantidadSafe = Math.min(Math.max(parseInt(niv.cantidad) || 20, 5), 50)
      const bloom = BLOOM_POR_NIVEL[niv.nombre] || 'II (medio)'

      const { data: levelData, error: levelErr } = await supabase
        .from('levels')
        .insert({
          evaluation_id: evalId,
          name:          niv.nombre,
          description:   `Generado por IA — nivel ${niv.nombre}`,
          time_limit:    parseInt(niv.tiempo) || 60,
          passing_score: 60,
          sort_order:    nivelesCreados.length + 1,
        })
        .select('id').single()
      if (levelErr) throw new Error(`Creando nivel ${niv.nombre}: ${levelErr.message}`)
      const levelId = levelData.id

      const storedSP = await getPrompt('opec_maestro', SYSTEM_PROMPT, modelo)
      const fullPrompt = `${storedSP}${FORMAT_ENFORCER}

Nivel de complejidad objetivo: ${bloom}
Cargo / nivel profesional: ${niv.nombre}
Temática y contexto de la convocatoria: ${prompt.trim()}

Genera EXACTAMENTE ${cantidadSafe} preguntas. Devuelve ÚNICAMENTE el array JSON.`

      let rawText
      if (modelo === 'deepseek') {
        const { texto } = await deepseekGenerar(fullPrompt, cantidadSafe * 1200 + 512)
        rawText = texto
      } else {
        const { texto } = await geminiTexto(fullPrompt)
        rawText = texto
      }

      const preguntas = validarPreguntas(extraerArrayJSON(rawText))

      // Batch insert preguntas
      const { data: newQs, error: qErr } = await supabase
        .from('questions')
        .insert(preguntas.map(p => ({
          level_id:      levelId,
          text:          p.enunciado,
          explanation:   p.explicacion || '',
          question_type: 'multiple',
          difficulty:    p.dificultad || 'medio',
          area:          p.area || niv.nombre,
        })))
        .select('id')
      if (qErr) throw new Error(`Guardando preguntas de ${niv.nombre}: ${qErr.message}`)

      // Batch insert opciones
      const opciones = []
      for (let qi = 0; qi < preguntas.length; qi++) {
        const p  = preguntas[qi]
        const qId = newQs[qi].id
        for (const letra of ['A', 'B', 'C', 'D']) {
          if (p[letra]?.trim()) {
            opciones.push({ question_id: qId, text: p[letra], letter: letra, is_correct: p.correcta?.toUpperCase() === letra })
          }
        }
      }
      if (opciones.length) {
        const { error: opErr } = await supabase.from('options').insert(opciones)
        if (opErr) throw new Error(`Guardando opciones de ${niv.nombre}: ${opErr.message}`)
      }

      nivelesCreados.push({ ...niv, level_id: levelId })
      resumenPreguntas[niv.nombre] = preguntas.length
    }

    // 3. Crear paquete
    const precioBase = Math.min(...niveles.map(n => Number(n.precio) || 0))
    const { data: pkgData, error: pkgErr } = await supabase
      .from('packages')
      .insert({
        name:              nombre.trim(),
        description:       descripcion?.trim() || '',
        price:             precioBase,
        type:              'one_time',
        duration_days:     365,
        is_active:         false,
        pricing_mode:      niveles.length > 1 ? 'per_profession' : 'global',
        content_mode:      'shared',
        has_study_material: true,
        has_practice_mode:  true,
        has_exam_mode:      true,
        has_level_selector: niveles.length > 1,
        has_ai_chat,
        evaluations_ids:   [evalId],
      })
      .select('id').single()
    if (pkgErr) throw new Error(`Creando paquete: ${pkgErr.message}`)
    const packageId = pkgData.id

    // 4. Crear package_versions (una por nivel)
    const { data: versionsData, error: versErr } = await supabase
      .from('package_versions')
      .insert(nivelesCreados.map((niv, i) => ({
        package_id:   packageId,
        display_name: niv.nombre,
        price:        Number(niv.precio) || 0,
        is_active:    true,
        sort_order:   i,
      })))
      .select('id, display_name')
    if (versErr) throw new Error(`Creando versiones: ${versErr.message}`)

    // 5. Vincular versiones ↔ niveles
    const { error: pvErr } = await supabase.from('package_version_levels').insert(
      nivelesCreados.map((niv, i) => ({ package_version_id: versionsData[i].id, level_id: niv.level_id }))
    )
    if (pvErr) throw new Error(`Vinculando niveles a versiones: ${pvErr.message}`)

    // 6. Vincular evaluación ↔ versiones
    const { error: evErr } = await supabase.from('evaluation_versions').insert(
      versionsData.map(v => ({ evaluation_id: evalId, package_version_id: v.id }))
    )
    if (evErr) throw new Error(`Vinculando evaluación a versiones: ${evErr.message}`)

    console.log(`[IA] Paquete generado: ${packageId} (eval ${evalId}) | preguntas:`, resumenPreguntas)
    return res.json({ ok: true, package_id: packageId, eval_id: evalId, preguntas: resumenPreguntas })

  } catch (err) {
    console.error('[IA] generarPaqueteConIA:', err)
    return res.status(500).json({ error: formatError(err) })
  }
}

// ── Endpoint: Análisis post-simulacro ────────────────────────────────────────

export async function analizarResultadosSimulacro(req, res) {
  try {
    const userId = req.user.id
    const { cargo, preguntas: preg, modelo = 'gemini', simulacro_id } = req.body

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

    // Guardar análisis independiente en BD (para progreso y modo práctica)
    if (simulacro_id) {
      const { error: saveErr } = await supabase
        .from('user_simulacro_analisis')
        .upsert(
          { user_id: userId, simulacro_id: parseInt(simulacro_id), cargo, score_pct: score, score_correctas: correctas, score_total: total, analisis },
          { onConflict: 'simulacro_id' }
        )
      if (saveErr) console.error('[IA] guardar analisis simulacro:', saveErr.message)
      else console.log('[IA] analisis simulacro guardado:', simulacro_id)
    }

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

// ── Endpoint: Generar práctica dirigida desde simulacro IA ───────────────────

export async function generarPracticaDesdeIA(req, res) {
  try {
    const userId = req.user.id
    const { simulacro_id } = req.body

    const { data: sim } = await supabase
      .from('user_simulacros')
      .select('id, cargo, evaluacion_id, completado')
      .eq('id', parseInt(simulacro_id))
      .eq('user_id', userId)
      .maybeSingle()

    if (!sim) return res.status(404).json({ error: 'Simulacro no encontrado' })
    if (!sim.completado) return res.status(400).json({ error: 'Debes completar el simulacro primero' })

    const { data: answers } = await supabase
      .from('user_simulacro_answers')
      .select('area, dificultad, es_correcta, opcion_elegida, opcion_correcta')
      .eq('simulacro_id', parseInt(simulacro_id))
      .eq('user_id', userId)

    if (!answers?.length) return res.status(400).json({ error: 'No hay respuestas registradas' })

    const areaMap = {}
    answers.forEach(a => {
      if (!areaMap[a.area]) areaMap[a.area] = { correctas: 0, total: 0 }
      areaMap[a.area].total++
      if (a.es_correcta) areaMap[a.area].correctas++
    })

    const areasDebiles = Object.entries(areaMap)
      .map(([area, d]) => ({ area, pct: Math.round((d.correctas / d.total) * 100), total: d.total }))
      .filter(a => a.pct < 70)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 4)

    const SP = (await getPrompt('opec_maestro', SYSTEM_PROMPT, 'deepseek')) + FORMAT_ENFORCER
    const cantidad = Math.min(20, Math.max(10, areasDebiles.length * 5))

    const areasTexto = areasDebiles.length
      ? areasDebiles.map(a => `- ${a.area}: ${a.pct}% acierto`).join('\n')
      : '- Todas las áreas (repaso general)'

    const prompt = `${SP}

MODO: Examen de práctica dirigida — enfocado en debilidades detectadas
CARGO OBJETIVO: ${sim.cargo || 'Profesional sector público colombiano'}

ÁREAS A REFORZAR (el usuario tuvo dificultades aquí):
${areasTexto}

INSTRUCCIONES ESPECÍFICAS:
- Genera EXACTAMENTE ${cantidad} preguntas.
- Enfócate EXCLUSIVAMENTE en las áreas débiles listadas arriba.
- Incluye explicación detallada en cada pregunta (campo justificacion).
- Varía dificultad: 40% fácil, 40% medio, 20% difícil.
- Tipo mixto: funcional y comportamental según las áreas.`

    const result = await conFallback('deepseek',
      () => deepseekGenerar(prompt, cantidad * 1200 + 512),
      () => geminiGenerar(prompt)
    )

    const preguntas = validarPreguntas(extraerArrayJSON(result.texto))
    if (!preguntas.length) return res.status(500).json({ error: 'No se generaron preguntas' })

    const { data: nueva, error: simErr } = await supabase
      .from('user_simulacros')
      .insert({
        user_id: userId,
        evaluacion_id: sim.evaluacion_id,
        cargo: sim.cargo,
        preguntas,
        cantidad_preguntas: preguntas.length,
        dificultad_config: 'mixta',
        tipo: 'practica_ia',
        simulacro_origen_id: parseInt(simulacro_id),
      })
      .select('id').single()

    if (simErr) throw new Error(simErr.message)

    return res.json({ simulacro_id: nueva.id, areas_debiles: areasDebiles, total: preguntas.length })
  } catch (err) {
    console.error('[IA] generarPracticaDesdeIA:', err)
    return res.status(500).json({ error: err.message || 'Error generando práctica' })
  }
}

// Construye texto descriptivo de OPECs para enviar a DeepSeek
// ciudadKey: si hay filtro de ciudad, agrega vacantes locales por cargo
function buildOpecTexto(lista, ciudadKey = '') {
  return lista.map((c) => {
    // Vacantes en la ciudad filtrada (si aplica)
    let vacantesLocal = ''
    if (ciudadKey && Array.isArray(c._ubNorm)) {
      const ub = c._ubNorm.find(u => normCiudad(u.ciudad) === ciudadKey)
      if (ub) vacantesLocal = ` | vacantes_en_ciudad_filtrada: ${ub.vacantes}`
    }
    return [
      `codigo_opec: ${c.numero_opec || c.num_convocatoria || c.id}`,
      `denominacion: ${c.denominacion || ''}`,
      `nivel: ${c.nivel || ''} | grado: ${c.grado || ''} | salario: ${c.salario || ''} | vacantes_total: ${c.vacantes || 1}${vacantesLocal}`,
      `dependencia: ${c.dependencia || ''} | proceso: ${c.proceso || ''}`,
      `area_estudio: ${c.area_estudio || ''} | area_funcional: ${c.area_funcional || ''}`,
      `proposito: ${c.proposito || ''}`,
      `educacion_requerida: ${c.estudio_texto || ''}`,
      `requisito_academico: ${c.req_academico || ''}`,
      `profesiones_admitidas: ${Array.isArray(c.profesiones) ? c.profesiones.join(', ') : (c.profesiones || '')}`,
      `nucleos_basicos: ${Array.isArray(c.nucleos_conocimiento) ? c.nucleos_conocimiento.join(', ') : (c.nucleos_conocimiento || '')}`,
      `requiere_posgrado: ${c.requiere_posgrado ? 'Si' : 'No'} | tipo: ${c.tipo_posgrado || ''} | area: ${c.area_posgrado || ''}`,
      `requiere_tarjeta: ${c.requiere_tarjeta ? 'Si' : 'No'}`,
      `experiencia_requerida: ${c.exp_texto || ''} | anios: ${c.exp_anios || ''} | tipo: ${c.tipo_experiencia || ''}`,
      `funciones: ${Array.isArray(c.funciones) ? c.funciones.join(' | ') : (c.funciones || '')}`,
      `conocimientos: ${Array.isArray(c.conocimientos) ? c.conocimientos.join(', ') : (c.conocimientos || '')}`,
      `competencias: ${JSON.stringify(c.competencias_transversales || c.competencias_perfil || {})}`,
    ].filter(Boolean).join('\n')
  }).join('\n---\n')
}

// Extrae OPECs completas de texto aunque el JSON esté truncado
function rescueAnalisis(texto) {
  // Intento 1: parse completo
  try {
    const m = texto.match(/\{[\s\S]*\}/)
    if (m) return JSON.parse(m[0])
  } catch (_) {}

  // Intento 2: extraer objetos individuales del array ranking_opec_recomendadas
  const keyIdx = texto.indexOf('"ranking_opec_recomendadas"')
  if (keyIdx === -1) return null
  const bracketIdx = texto.indexOf('[', keyIdx)
  if (bracketIdx === -1) return null

  const arr = texto.slice(bracketIdx)
  const objects = []
  let depth = 0, objStart = -1
  for (let i = 0; i < arr.length; i++) {
    const ch = arr[i]
    if (ch === '{') { if (depth === 0) objStart = i; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && objStart !== -1) {
        try { objects.push(JSON.parse(arr.slice(objStart, i + 1))) } catch (_) {}
        objStart = -1
      }
    }
  }
  if (!objects.length) return null
  return { ranking_opec_recomendadas: objects, _parcial: true }
}

// ── Endpoint: Analizar perfil vs cargos OPEC ─────────────────────────────────

const SYSTEM_PROMPT_ANALISIS_PERFIL = `Eres una IA agente de Praxia especializada en analisis de hojas de vida, concursos de meritos del sector publico colombiano, empleo publico, verificacion de requisitos minimos, comparacion contra OPEC y orientacion estrategica para candidatos.

Tu funcion es ejecutar un analisis tecnico completo a partir de dos fuentes: la hoja de vida del candidato y la base de datos interna de OPEC/cargos disponibles. Debes leer, extraer, estructurar, comparar, puntuar, justificar y devolver un resultado objetivo, trazable, practico y util para el candidato. No debes inventar informacion. Si un dato no aparece, marcalo como no identificado o requiere validacion.

Actua como experta en concursos de meritos del sector publico colombiano (CNSC, Procuraduria, Contraloria, DIAN, Fiscalia), Ley 909 de 2004, clasificacion de empleos por nivel, tipos de experiencia (laboral, profesional, relacionada, especifica, docente, administrativa, publica), requisitos academicos, nucleos basicos del conocimiento, tarjeta profesional y analisis de funciones certificadas.

FLUJO OBLIGATORIO:
1. Leer y validar el PDF/perfil (legibilidad, fechas, funciones, formacion).
2. Extraer perfil estructurado: profesion, nivel, titulos, posgrados, tarjeta profesional, experiencia total en meses, experiencia profesional/relacionada/especifica, sector publico/privado, areas, funciones principales, categorias funcionales, competencias, herramientas, nucleos basicos, alertas de validacion.
3. Normalizar funciones a categorias (contratacion estatal, gestion juridica, talento humano, control interno, etc.).
4. Revisar TODAS las OPEC con criterios tecnicos.
5. Validar requisitos minimos habilitantes: formacion, posgrado, tarjeta, experiencia, tipo de experiencia, funciones. Clasificar: cumple / cumple parcialmente / no cumple / requiere validacion. No recomendar si no cumple formacion minima.
6. Calcular afinidad 0-100: formacion 30%, experiencia 30%, funciones 25%, conocimientos 10%, coherencia 5%.
7. Restricciones de porcentaje: no >70% si experiencia relacionada no demostrada; no >75% si hay dudas sobre tipo de experiencia; no >80% si coincidencia funcional baja; no >85% si tarjeta/posgrado requiere validacion; no >60% si brecha critica de experiencia; no >50% si formacion parcial.
8. Evaluar riesgo documental (bajo/medio/alto).
9. Generar guia practica por OPEC: decision recomendada, documentos a organizar, correcciones en HV, funciones a evidenciar, palabras clave, acciones antes de postularse.
10. Seleccionar las 10 OPEC mas afines.
11. Identificar hasta 5 cargos descartados con motivo y brecha.
12. Generar recomendaciones concretas para mejorar la hoja de vida.

REGLAS: No inventes datos. No confundas tipos de experiencia. No infles porcentajes. Explica cada puntaje con trazabilidad. Diferencia entre afinidad alta y cumplimiento validado.

Responde UNICAMENTE con JSON valido, sin texto antes ni despues, sin markdown, sin comentarios. Estructura exacta:

{"estado_analisis":"","observacion_general":"","perfil_candidato":{"nombre":"","profesion_principal":"","nivel_formacion":"","titulos_identificados":[],"posgrados_identificados":[],"formacion_complementaria":[],"tarjeta_profesional":{"estado":"","detalle":""},"experiencia_total_estimada_meses":0,"experiencia_profesional_estimada_meses":0,"experiencia_relacionada_estimada_meses":0,"experiencia_especifica_estimada_meses":0,"experiencia_sector_publico_meses":0,"experiencia_sector_privado_meses":0,"areas_experiencia":[],"sectores_experiencia":[],"funciones_principales_identificadas":[],"categorias_funcionales_perfil":[],"competencias_clave":[],"herramientas_identificadas":[],"posibles_nucleos_basicos_conocimiento":[],"alertas_validacion":[]},"diagnostico_general":{"nivel_competitividad":"","resumen":"","fortalezas_principales":[],"debilidades_principales":[],"tipo_de_cargos_mas_convenientes":[],"tipo_de_cargos_no_recomendados":[]},"ranking_opec_recomendadas":[{"ranking":1,"codigo_opec":"","entidad":"","convocatoria":"","denominacion":"","nivel":"","codigo":"","grado":"","salario":"","vacantes":0,"dependencia":"","proceso":"","area_estudio":"","proposito":"","requisito_academico":"","experiencia_requerida":"","tipo_experiencia_requerida":"","requiere_posgrado":false,"requiere_tarjeta_profesional":false,"cumplimiento_requisitos_minimos":"","afinidad_porcentaje":0,"clasificacion_afinidad":"","puntaje_detallado":{"formacion_academica":{"puntaje":0,"justificacion":""},"experiencia_requerida":{"puntaje":0,"justificacion":""},"coincidencia_funcional":{"puntaje":0,"justificacion":""},"conocimientos_competencias":{"puntaje":0,"justificacion":""},"coherencia_requisitos_adicionales":{"puntaje":0,"justificacion":""}},"cumplimiento":{"formacion":"","experiencia":"","funciones":"","conocimientos":"","tarjeta_profesional":"","posgrado":""},"desglose_afinidad_usuario":{"formacion":{"estado":"","explicacion":""},"experiencia":{"estado":"","explicacion":""},"funciones":{"estado":"","explicacion":""},"conocimientos":{"estado":"","explicacion":""},"riesgo_documental":{"nivel":"","explicacion":""}},"categorias_funcionales_opec":[],"coincidencias_principales":[],"brechas_concretas":[],"riesgo_documental":{"nivel":"","causas":[]},"riesgo_no_cumplimiento":"","justificacion":"","recomendacion_estrategica":"","guia_para_el_usuario":{"decision_recomendada":"","mensaje_claro":"","que_debe_organizar":[],"que_debe_corregir_en_hoja_de_vida":[],"funciones_que_debe_evidenciar":[],"palabras_clave_sugeridas":[],"documentos_prioritarios":[],"acciones_antes_de_postularse":[]}}],"opec_mas_recomendada":{"ranking":1,"codigo_opec":"","entidad":"","denominacion":"","afinidad_porcentaje":0,"razon_principal":"","ventaja_frente_a_las_otras":"","riesgo_principal":"","accion_prioritaria_antes_de_postularse":""},"recomendaciones_para_mejorar_hoja_de_vida":{"perfil_profesional":[],"experiencia_laboral":[],"funciones":[],"certificaciones":[],"soportes_documentales":[],"palabras_clave":[],"preparacion_para_pruebas":[]},"acciones_prioritarias":[{"prioridad":1,"accion":"","motivo":""}],"cargos_descartados_relevantes":[{"codigo_opec":"","entidad":"","denominacion":"","motivo_descarte":"","brecha_principal":""}]}
`

export async function analizarPerfilCV(req, res) {
  try {
    const userId = req.user.id
    const { convocatoria_id, perfil_texto, ciudad_filtro } = req.body
    const file = req.file
    const cvText = await extractCvText(file)
    console.log('[IA] cvText extraido:', cvText.length, 'chars')

    if (!convocatoria_id) return res.status(400).json({ error: 'Debes seleccionar una convocatoria.' })
    if (!perfil_texto?.trim() && !cvText) return res.status(400).json({ error: 'Debes proporcionar tu perfil o subir tu hoja de vida.' })

    const [allOpec, conv] = await Promise.all([
      fetchAllOpecs(parseInt(convocatoria_id)),
      supabase.from('convocatorias').select('nombre, entidad, plataforma_nombre, plataforma_url').eq('id', parseInt(convocatoria_id)).maybeSingle().then(r => r.data),
    ])

    if (!allOpec?.length) return res.status(404).json({ error: 'Esta convocatoria aun no tiene cargos cargados. El equipo los esta importando.' })

    // Filtrar por ciudad si se especificó (comparación normalizada sin tildes)
    const ciudadKey = normCiudad(ciudad_filtro || '')
    let todosOpec = allOpec
    let pocas_opec_local = false
    if (ciudadKey) {
      const filtrados = allOpec.filter(op =>
        normUbicaciones(op).some(ub => normCiudad(ub.ciudad) === ciudadKey)
      )
      if (filtrados.length >= 3) {
        todosOpec = filtrados
      } else {
        pocas_opec_local = true
        console.log(`[IA] ciudad_filtro="${ciudad_filtro}" → solo ${filtrados.length} OPECs, usando todas (${allOpec.length})`)
      }
    }

    // Pre-calcular ubicaciones normalizadas en cada OPEC (para buildOpecTexto)
    todosOpec = todosOpec.map(op => ({ ...op, _ubNorm: normUbicaciones(op) }))

    const entidadNombre = conv?.entidad || 'Entidad publica colombiana'
    const convNombre    = conv?.nombre  || 'Convocatoria publica'

    // Línea compacta por OPEC para el pre-screening (cabe en 64K tokens de entrada)
    const compactLine = c => {
      const ciudades = (c._ubNorm || []).map(u => u.ciudad).filter(Boolean).join('/')
      return `${c.id}|${c.denominacion}|${c.nivel || ''} ${c.grado || ''}|${c.area_estudio || ''}|exp:${c.exp_anios || 0}m|pos:${c.requiere_posgrado ? 'S' : 'N'}|tar:${c.requiere_tarjeta ? 'S' : 'N'}|loc:${ciudades || 'Nacional'}`
    }

    // Si hay PDF, es la fuente principal; el textarea es complemento opcional
    const perfil_base = cvText
      ? (perfil_texto?.trim() ? `INFO ADICIONAL DEL CANDIDATO:\n${perfil_texto.trim()}\n\nHOJA DE VIDA (PDF):\n${cvText}` : cvText)
      : (perfil_texto || '').trim()

    const ciudadContexto = ciudadKey
      ? `\nUBICACION DE INTERES DEL CANDIDATO: ${ciudad_filtro} (los cargos listados tienen vacantes en esta ciudad)\n`
      : ''

    // ── Prompts ───────────────────────────────────────────────────────────────────
    const NIVEL_REGLA = `REGLA DE NIVEL (obligatoria):
- ASISTENCIAL: bachillerato | TECNICO: tecnico/tecnologo | PROFESIONAL: universitario | ASESOR/DIRECTIVO: universitario + experiencia directiva
Nunca selecciones un cargo de nivel superior al del candidato.`

    const SP_PASS1 = `Eres un experto en seleccion de personal del sector publico colombiano. Lee TODOS los cargos OPEC y selecciona los 25 MAS COMPATIBLES con el perfil del candidato en area de conocimiento, funciones, nivel y experiencia requerida.
${NIVEL_REGLA}
Identifica ademas hasta 5 cargos que parecen afines pero tienen un requisito incumplible (descartados).
La primera columna de cada linea es el ID unico del cargo.
Devuelve UNICAMENTE este JSON sin texto adicional: {"top25": ["id1","id2",...], "descartados": ["id1",...]}`

    const SP_PERFIL = `Eres un experto en analisis de hojas de vida del sector publico colombiano (CNSC, Procuraduria, Contraloria, DIAN, Fiscalia), Ley 909 de 2004, clasificacion de empleos, tipos de experiencia y requisitos academicos.

Lee el CV/perfil del candidato y extrae su informacion profesional estructurada. NO analices ningun cargo OPEC.
Devuelve UNICAMENTE este JSON valido sin texto adicional ni markdown:
{"estado_analisis":"","observacion_general":"","perfil_candidato":{"nombre":"","profesion_principal":"","nivel_formacion":"","titulos_identificados":[],"posgrados_identificados":[],"tarjeta_profesional":{"estado":"","detalle":""},"experiencia_total_estimada_meses":0,"experiencia_profesional_estimada_meses":0,"experiencia_relacionada_estimada_meses":0,"experiencia_sector_publico_meses":0,"experiencia_sector_privado_meses":0,"areas_experiencia":[],"funciones_principales_identificadas":[],"categorias_funcionales_perfil":[],"competencias_clave":[],"posibles_nucleos_basicos_conocimiento":[],"alertas_validacion":[]},"diagnostico_general":{"nivel_competitividad":"","resumen":"","fortalezas_principales":[],"debilidades_principales":[],"tipo_de_cargos_mas_convenientes":[],"tipo_de_cargos_no_recomendados":[]},"recomendaciones_para_mejorar_hoja_de_vida":{"perfil_profesional":[],"experiencia_laboral":[],"funciones":[],"certificaciones":[],"palabras_clave":[]},"acciones_prioritarias":[{"prioridad":1,"accion":"","motivo":""}]}`

    const promptPerfil = [
      `CONVOCATORIA: ${convNombre} - ${entidadNombre}`,
      '',
      cvText ? `HOJA DE VIDA (TEXTO EXTRAIDO DEL PDF):\n${cvText}` : '',
      perfil_texto?.trim() ? `INFO ADICIONAL ESCRITA POR EL CANDIDATO:\n${perfil_texto.trim()}` : '',
      '',
      'Extrae el perfil estructurado del candidato. Devuelve UNICAMENTE el JSON.',
    ].filter(Boolean).join('\n')

    // Mezclar para mitigar "lost in the middle" (ítems en el centro reciben menos atención)
    const shuffled = [...todosOpec]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    console.log(`[IA] pass1: leyendo las ${shuffled.length} OPECs completas en un solo llamado`)

    // ── Lanzar pass2a (perfil) y pass1 (todas las OPECs) en paralelo ──────────────
    const [rPerfil, rPass1] = await Promise.all([
      deepseekAnalisisPerfil(SP_PERFIL, promptPerfil, 8192)
        .catch(e => { console.error('[IA] pass2a error:', e.message); return null }),
      deepseekAnalisisPerfil(SP_PASS1,
        `PERFIL DEL CANDIDATO:\n${perfil_base}\n${ciudadContexto}\nCARGOS (${shuffled.length}) — formato ID|cargo|nivel grado|area|exp|posgrado|tarjeta|ciudades:\n${shuffled.map(compactLine).join('\n')}`,
        400
      ).catch(e => { console.error('[IA] pass1 error:', e.message); return null }),
    ])

    // ── Parsear top 25 ────────────────────────────────────────────────────────────
    let top10Ids = []
    let descartadosIds = []
    if (rPass1) {
      try {
        const m = rPass1.texto.match(/\{[\s\S]*\}/)
        if (m) {
          const parsed = JSON.parse(m[0])
          top10Ids = (parsed.top25 || parsed.top15 || parsed.top10 || parsed.top || []).map(String)
          descartadosIds = Array.isArray(parsed.descartados) ? parsed.descartados.map(String) : []
        }
        console.log(`[IA] pass1 seleccionó ${top10Ids.length} OPECs de ${shuffled.length} leídas`)
      } catch (e) {
        console.error('[IA] pass1 parse error:', e.message)
      }
    }

    if (!top10Ids.length) {
      top10Ids = shuffled.slice(0, 25).map(c => String(c.id))
    }

    // ── Resultado de pass2a ───────────────────────────────────────────────────────
    let perfilData = rPerfil ? rescueAnalisis(rPerfil.texto) : null
    if (!perfilData) return res.status(500).json({ error: 'No se pudo extraer el perfil del candidato. Intenta de nuevo.' })

    // ── PASO 2b: Análisis de OPECs usando el perfil ya estructurado ──────────────
    const opecs9   = todosOpec.filter(c => top10Ids.includes(String(c.id))).slice(0, 9)
    const opecsDes = todosOpec.filter(c => descartadosIds.includes(String(c.id))).slice(0, 3)
    const batch1          = opecs9.slice(0, 3)
    const opecsPendientes = opecs9.slice(3).map(c => c.id)

    const p = perfilData.perfil_candidato || {}
    const perfilResumen = [
      `Nombre: ${p.nombre || ''}`,
      `Profesion: ${p.profesion_principal || ''}`,
      `Nivel de formacion: ${p.nivel_formacion || ''}`,
      `Titulos: ${(p.titulos_identificados || []).join(', ')}`,
      `Tarjeta profesional: ${p.tarjeta_profesional?.estado || 'no aplica'}`,
      `Experiencia total: ${p.experiencia_total_estimada_meses || 0} meses`,
      `Exp. profesional: ${p.experiencia_profesional_estimada_meses || 0} meses`,
      `Exp. sector publico: ${p.experiencia_sector_publico_meses || 0} meses`,
      `Areas: ${(p.areas_experiencia || []).join(', ')}`,
      `Funciones: ${(p.funciones_principales_identificadas || []).slice(0, 6).join(' | ')}`,
      `Competencias: ${(p.competencias_clave || []).join(', ')}`,
      `Nucleos: ${(p.posibles_nucleos_basicos_conocimiento || []).join(', ')}`,
    ].join('\n')

    const descartadosTxt = opecsDes.length ? '\n\nCARGOS DESCARTADOS (incluir en cargos_descartados_relevantes):\n' + buildOpecTexto(opecsDes) : ''

    const SP_OPECS = `Eres un experto en seleccion de personal del sector publico colombiano (CNSC, Procuraduria, Contraloria, DIAN). Analiza los cargos OPEC contra el perfil estructurado del candidato.
REGLAS: No infles porcentajes. Si no cumple formacion minima no recomiendes. Calcula afinidad 0-100: formacion 30%, experiencia 30%, funciones 25%, conocimientos 10%, coherencia 5%.
Devuelve UNICAMENTE este JSON valido sin texto adicional ni markdown:
{"ranking_opec_recomendadas":[{"denominacion":"","entidad":"","codigo_opec":"","nivel":"","grado":0,"vacantes":1,"salario":"","proceso":"","afinidad_porcentaje":0,"clasificacion_afinidad":"alta|media-alta|media|baja","justificacion":"","coincidencias_principales":[],"brechas_concretas":[],"cumplimiento":{"formacion":"cumple|cumple parcialmente|no cumple","experiencia":"cumple|cumple parcialmente|no cumple","funciones":"cumple|cumple parcialmente|no cumple","tarjeta_profesional":"no aplica|cumple|no cumple","posgrado":"no aplica|cumple|no cumple"},"riesgo_documental":{"nivel":"bajo|medio|alto","causas":[]},"riesgo_no_cumplimiento":"","guia_para_el_usuario":{"decision_recomendada":"","mensaje_claro":"","acciones_antes_de_postularse":[],"documentos_prioritarios":[],"funciones_que_debe_evidenciar":[],"palabras_clave_sugeridas":[],"que_debe_corregir_en_hoja_de_vida":[]}}],"opec_mas_recomendada":{"codigo_opec":"","denominacion":"","afinidad_porcentaje":0,"razon_principal":"","accion_prioritaria_antes_de_postularse":""},"cargos_descartados_relevantes":[{"codigo_opec":"","denominacion":"","entidad":"","motivo_descarte":"","brecha_principal":""}]}`

    const ciudadLine = ciudadKey
      ? `UBICACION DE INTERES: ${ciudad_filtro} — el candidato busca cargos con vacantes en esta ciudad. Menciona las vacantes locales en la guia al usuario cuando estén disponibles.\n\n`
      : ''
    const promptOpecs = `CONVOCATORIA: ${convNombre} - ${entidadNombre}\n\n${ciudadLine}PERFIL DEL CANDIDATO:\n${perfilResumen}\n\nCARGOS A ANALIZAR:\n${buildOpecTexto(batch1, ciudadKey)}${descartadosTxt}\n\nAnaliza estos ${batch1.length} cargos contra el perfil. Devuelve UNICAMENTE el JSON.`

    let opecsData = null
    try {
      const rOpecs = await deepseekAnalisisPerfil(SP_OPECS, promptOpecs, 8192)
      console.log('[IA] pass2b (opecs) tokensOut:', rOpecs.tokensOut)
      opecsData = rescueAnalisis(rOpecs.texto)
    } catch (e) {
      console.error('[IA] pass2b error:', e.message)
    }

    // Fusionar: perfil + opecs en un solo objeto
    const analisis = {
      ...perfilData,
      ranking_opec_recomendadas: (opecsData?.ranking_opec_recomendadas || []).filter(o => (o.afinidad_porcentaje || 0) > 0),
      opec_mas_recomendada:      opecsData?.opec_mas_recomendada || null,
      cargos_descartados_relevantes: opecsData?.cargos_descartados_relevantes || [],
    }

    // Enriquecer con datos originales de opec_maestro (num OPEC, convocatoria, dependencia, ciudades)
    const opecLookup = new Map()
    for (const op of [...batch1, ...opecsDes]) {
      opecLookup.set(String(op.numero_opec || op.num_convocatoria || op.id), op)
    }
    analisis.ranking_opec_recomendadas = analisis.ranking_opec_recomendadas.map(item => {
      const orig = opecLookup.get(String(item.codigo_opec))
      if (!orig) return item
      return {
        ...item,
        numero_opec:      orig.numero_opec      || null,
        num_convocatoria: orig.num_convocatoria  || null,
        dependencia:      orig.dependencia       || item.proceso || null,
        ubicaciones_norm: orig._ubNorm           || [],
      }
    })

    console.log('[IA] OPECs en resultado:', analisis.ranking_opec_recomendadas.length, '| pendientes:', opecsPendientes.length)

    const now = new Date().toISOString()
    const { error: saveErr } = await supabase.from('user_profile_analysis').insert(
      { user_id: userId, convocatoria_id: parseInt(convocatoria_id), convocatoria_nombre: convNombre, analisis, updated_at: now, created_at: now }
    )
    if (saveErr) console.error('[IA] guardar analisis_perfil:', saveErr.message)

    return res.json({
      analisis, opecs_pendientes: opecsPendientes, pocas_opec_local,
      ciudad_filtro: ciudad_filtro || null,
      plataforma_url:    conv?.plataforma_url    || null,
      plataforma_nombre: conv?.plataforma_nombre || null,
    })
  } catch (err) {
    console.error('[IA] analizarPerfilCV:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ── Endpoint: Ver más OPECs (usa perfil_candidato del análisis previo) ──────────

const SYSTEM_PROMPT_MAS_OPECS = `Eres un experto en seleccion de personal del sector publico colombiano (CNSC, Procuraduria, Contraloria, DIAN). Analiza los cargos OPEC recibidos contra el perfil estructurado del candidato y devuelve UNICAMENTE este JSON valido sin texto adicional ni markdown:
{"ranking_opec_recomendadas":[{"denominacion":"","entidad":"","codigo_opec":"","nivel":"","grado":0,"vacantes":1,"salario":"","proceso":"","afinidad_porcentaje":0,"clasificacion_afinidad":"alta|media-alta|media|baja","justificacion":"","coincidencias_principales":[],"brechas_concretas":[],"cumplimiento":{"formacion":"cumple|cumple parcialmente|no cumple","experiencia":"cumple|cumple parcialmente|no cumple","funciones":"cumple|cumple parcialmente|no cumple","tarjeta_profesional":"no aplica|cumple|no cumple","posgrado":"no aplica|cumple|no cumple"},"riesgo_documental":{"nivel":"bajo|medio|alto","causas":[]},"riesgo_no_cumplimiento":"","guia_para_el_usuario":{"decision_recomendada":"","mensaje_claro":"","acciones_antes_de_postularse":[],"documentos_prioritarios":[],"funciones_que_debe_evidenciar":[],"palabras_clave_sugeridas":[],"que_debe_corregir_en_hoja_de_vida":[]}}]}`

export async function masOpecs(req, res) {
  try {
    const { convocatoria_id, opecs_pendientes_ids, perfil_candidato, ciudad_filtro: ciudadFiltroMas } = req.body
    if (!convocatoria_id || !Array.isArray(opecs_pendientes_ids) || !opecs_pendientes_ids.length) {
      return res.status(400).json({ error: 'Datos incompletos.' })
    }

    const batch    = opecs_pendientes_ids.slice(0, 3).map(id => parseInt(id))
    const restantes = opecs_pendientes_ids.slice(3)

    const [{ data: opecs }, { data: conv }] = await Promise.all([
      supabase.from('opec_maestro').select('*').in('id', batch).eq('is_active', true),
      supabase.from('convocatorias').select('nombre, entidad').eq('id', parseInt(convocatoria_id)).maybeSingle(),
    ])

    if (!opecs?.length) return res.status(404).json({ error: 'No se encontraron los cargos solicitados.' })

    const convNombre    = conv?.nombre  || 'Convocatoria publica'
    const entidadNombre = conv?.entidad || 'Entidad publica colombiana'

    // Resumen compacto del perfil (no re-enviamos el PDF)
    const p = perfil_candidato || {}
    const perfilResumen = [
      `Nombre: ${p.nombre || 'No identificado'}`,
      `Profesion: ${p.profesion_principal || ''}`,
      `Nivel de formacion: ${p.nivel_formacion || ''}`,
      `Titulos: ${(p.titulos_identificados || []).join(', ')}`,
      `Posgrados: ${(p.posgrados_identificados || []).join(', ')}`,
      `Tarjeta profesional: ${p.tarjeta_profesional?.estado || 'no aplica'}`,
      `Experiencia total: ${p.experiencia_total_estimada_meses || 0} meses`,
      `Experiencia profesional: ${p.experiencia_profesional_estimada_meses || 0} meses`,
      `Experiencia sector publico: ${p.experiencia_sector_publico_meses || 0} meses`,
      `Areas de experiencia: ${(p.areas_experiencia || []).join(', ')}`,
      `Funciones principales: ${(p.funciones_principales_identificadas || []).slice(0, 6).join(' | ')}`,
      `Competencias: ${(p.competencias_clave || []).join(', ')}`,
      `Nucleos basicos: ${(p.posibles_nucleos_basicos_conocimiento || []).join(', ')}`,
    ].join('\n')

    const ciudadKeyMas = normCiudad(ciudadFiltroMas || '')
    const opecsMasNorm = opecs.map(op => ({ ...op, _ubNorm: normUbicaciones(op) }))
    const ciudadLineMas = ciudadKeyMas
      ? `UBICACION DE INTERES: ${ciudadFiltroMas} — menciona vacantes locales en la guia al usuario.\n\n`
      : ''
    const prompt = `CONVOCATORIA: ${convNombre} - ${entidadNombre}\n\n${ciudadLineMas}PERFIL DEL CANDIDATO (extraido del analisis previo):\n${perfilResumen}\n\nCARGOS A ANALIZAR:\n${buildOpecTexto(opecsMasNorm, ciudadKeyMas)}\n\nAnaliza estos ${opecs.length} cargos contra el perfil. Devuelve UNICAMENTE el JSON con el array ranking_opec_recomendadas. Sin texto extra.`

    let result = null
    try {
      result = await deepseekAnalisisPerfil(SYSTEM_PROMPT_MAS_OPECS, prompt, 8192)
      console.log('[IA] masOpecs tokensOut:', result.tokensOut)
    } catch (e) {
      console.error('[IA] masOpecs error:', e.message)
      return res.status(503).json({ error: 'En este momento hay alta demanda. Intenta en unos minutos.' })
    }

    const parsed    = result?.texto ? rescueAnalisis(result.texto) : null
    const nuevasOpecs = parsed?.ranking_opec_recomendadas || []
    if (!nuevasOpecs.length) {
      return res.status(500).json({ error: 'No se pudieron analizar los cargos. Intenta de nuevo.' })
    }

    // Enriquecer con datos originales de opec_maestro
    const opecLookupMas = new Map()
    for (const op of opecsMasNorm) {
      opecLookupMas.set(String(op.numero_opec || op.num_convocatoria || op.id), op)
    }
    const nuevasEnriquecidas = nuevasOpecs.map(item => {
      const orig = opecLookupMas.get(String(item.codigo_opec))
      if (!orig) return item
      return {
        ...item,
        numero_opec:      orig.numero_opec      || null,
        num_convocatoria: orig.num_convocatoria  || null,
        dependencia:      orig.dependencia       || item.proceso || null,
        ubicaciones_norm: orig._ubNorm           || [],
      }
    })

    console.log('[IA] masOpecs OPECs nuevas:', nuevasEnriquecidas.length, '| restantes:', restantes.length)

    return res.json({ nuevas_opecs: nuevasEnriquecidas, opecs_pendientes: restantes })
  } catch (err) {
    console.error('[IA] masOpecs:', err)
    return res.status(500).json({ error: err.message })
  }
}

// ── Convocatorias ─────────────────────────────────────────────────────────────

export async function listConvocatorias(req, res) {
  const { todas } = req.query
  let query = supabase
    .from('convocatorias')
    .select('id, codigo, nombre, entidad, anio, descripcion, is_active, departamento, ciudad, plataforma_nombre, plataforma_url')
    .order('anio', { ascending: false })
    .order('nombre')
  if (!todas) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ convocatorias: data || [] })
}

// Normaliza para agrupar: sin tildes, minúscula, sin espacios extra
const normCiudad = s => s?.trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ') || ''

// Lista de valores que no son ciudades reales (basura del import)
const CIUDAD_BLACKLIST = new Set(['cargos', 'cargo', 'todos', 'nacional', 'colombia', 'n/a', 'ninguno', 'na'])

// Fetch paginado de OPECs — Supabase limita 1000 por request
async function fetchAllOpecs(convocatoriaId) {
  const PAGE = 1000
  let offset = 0
  const all = []
  while (true) {
    const { data, error } = await supabase
      .from('opec_maestro')
      .select('*')
      .eq('convocatoria_id', convocatoriaId)
      .eq('is_active', true)
      .order('num_convocatoria')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
    offset += PAGE
  }
  return all
}

// Normaliza ubicaciones a array uniforme [{ciudad, vacantes}]
// Soporta tres formatos encontrados en los datos:
//   1. Array [{ciudad, vacantes}]      — Procuraduría (import correcto)
//   2. Array [{ciudad, vacantes:0}]    — Procuraduría OPECs 378/384 (import roto)
//   3. Objeto {tipo, ciudad, depto}    — Territorial 12 (vacantes en raíz del OPEC)
function normUbicaciones(opec) {
  const ub = opec.ubicaciones
  if (!ub) return []

  if (Array.isArray(ub)) {
    const sumaUb = ub.reduce((s, e) => s + (e.vacantes || 0), 0)
    const raiz   = opec.vacantes || 0
    // Import roto: todas las ubicaciones tienen 0 pero el OPEC tiene vacantes reales
    if (sumaUb === 0 && raiz > 0 && ub.length > 0) {
      const porCiudad = Math.max(1, Math.round(raiz / ub.length))
      return ub.map(e => ({ ...e, vacantes: porCiudad }))
    }
    return ub
  }

  // Objeto simple (Territorial 12) → vacantes del campo raíz del OPEC
  return [{ ciudad: ub.ciudad, departamento: ub.departamento, vacantes: opec.vacantes ?? 0 }]
}

export async function getCiudadesConvocatoria(req, res) {
  const { id } = req.params
  try {
    const allOpecs = await fetchAllOpecs(parseInt(id))

    // Agrupa por clave normalizada; el label es la variante más frecuente
    const normMap = new Map()
    for (const opec of allOpecs) {
      for (const ub of normUbicaciones(opec)) {
        const raw = ub.ciudad?.trim()
        if (!raw) continue
        const key = normCiudad(raw)
        if (CIUDAD_BLACKLIST.has(key)) continue
        if (!normMap.has(key)) normMap.set(key, { ciudad: raw, _counts: {}, vacantes: 0, opecs: 0 })
        const entry = normMap.get(key)
        entry._counts[raw] = (entry._counts[raw] || 0) + 1
        entry.vacantes += ub.vacantes || 0
        entry.opecs += 1
        // elegir el label más frecuente (con tilde gana si empatan)
        const best = Object.entries(entry._counts).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]
        entry.ciudad = best
      }
    }

    const ciudades = [...normMap.values()]
      .map(({ ciudad, vacantes, opecs }) => ({ ciudad, vacantes, opecs }))
      .sort((a, b) => a.ciudad.localeCompare(b.ciudad, 'es'))

    return res.json({ ciudades, total_opecs: allOpecs.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

export async function createConvocatoria(req, res) {
  const { codigo, nombre, entidad, anio, descripcion, departamento, ciudad, plataforma_nombre, plataforma_url } = req.body
  if (!codigo?.trim()) return res.status(400).json({ error: 'El código es requerido.' })
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es requerido.' })
  if (!entidad?.trim()) return res.status(400).json({ error: 'La entidad es requerida.' })
  const { data, error } = await supabase
    .from('convocatorias')
    .insert({
      codigo: codigo.trim().toUpperCase(), nombre: nombre.trim(), entidad: entidad.trim(),
      anio: anio ? parseInt(anio) : null, descripcion: descripcion?.trim() || null,
      departamento: departamento?.trim() || null, ciudad: ciudad?.trim() || null,
      plataforma_nombre: plataforma_nombre?.trim() || null,
      plataforma_url:    plataforma_url?.trim()    || null,
    })
    .select('*').single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ convocatoria: data })
}

export async function updateConvocatoria(req, res) {
  const { id } = req.params
  const { nombre, entidad, anio, descripcion, is_active, departamento, ciudad, plataforma_nombre, plataforma_url } = req.body
  const { data, error } = await supabase
    .from('convocatorias')
    .update({
      nombre, entidad, anio: anio ? parseInt(anio) : null, descripcion, is_active,
      departamento: departamento?.trim() || null, ciudad: ciudad?.trim() || null,
      plataforma_nombre: plataforma_nombre?.trim() || null,
      plataforma_url:    plataforma_url?.trim()    || null,
    })
    .eq('id', id).select('*').single()
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ convocatoria: data })
}

export async function deleteConvocatoria(req, res) {
  const { id } = req.params
  const { error } = await supabase.from('convocatorias').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}

// ── CRUD OPECs maestro (admin) ───────────────────────────────────────────────

export async function listProcuraduriaOpecs(req, res) {
  const { q = '', page = 1, limit = 50, nivel = '', convocatoria_id } = req.query
  if (!convocatoria_id) return res.status(400).json({ error: 'convocatoria_id es requerido.' })
  const from = (parseInt(page) - 1) * parseInt(limit)
  const to   = from + parseInt(limit) - 1

  let query = supabase.from('opec_maestro').select('*', { count: 'exact' })
    .eq('convocatoria_id', parseInt(convocatoria_id))
  if (q)     query = query.or(`denominacion.ilike.%${q}%,area_estudio.ilike.%${q}%,estudio_texto.ilike.%${q}%`)
  if (nivel) query = query.eq('nivel', nivel)
  query = query.order('num_convocatoria').range(from, to)

  const { data, count, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ opecs: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) })
}

export async function createProcuraduriaOpec(req, res) {
  const { denominacion, nivel, grado, area_estudio, vacantes, estudio_texto, exp_texto, codigo,
          num_convocatoria, requiere_posgrado, requiere_tarjeta, exp_anios, exp_tipo, dependencia,
          convocatoria_id, entidad = 'Procuraduría General de la Nación',
          proceso, funciones, conocimientos, competencias_transversales, competencias_perfil, ubicaciones } = req.body
  if (!denominacion?.trim()) return res.status(400).json({ error: 'El nombre del cargo es requerido.' })
  if (!convocatoria_id)      return res.status(400).json({ error: 'convocatoria_id es requerido.' })
  const { data, error } = await supabase
    .from('opec_maestro')
    .insert({ denominacion: denominacion.trim(), nivel, grado: grado ? parseInt(grado) : null,
              area_estudio, vacantes: vacantes ? parseInt(vacantes) : 1, estudio_texto, exp_texto,
              codigo, num_convocatoria, requiere_posgrado: !!requiere_posgrado,
              requiere_tarjeta: !!requiere_tarjeta, exp_anios: exp_anios ? parseInt(exp_anios) : 0,
              exp_tipo, dependencia, convocatoria_id: parseInt(convocatoria_id), entidad,
              proceso: proceso || null,
              funciones: Array.isArray(funciones) ? funciones : [],
              conocimientos: Array.isArray(conocimientos) ? conocimientos : [],
              competencias_transversales: competencias_transversales || {},
              competencias_perfil: competencias_perfil || {},
              ubicaciones: Array.isArray(ubicaciones) ? ubicaciones : [] })
    .select('*').single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(201).json({ opec: data })
}

export async function updateProcuraduriaOpec(req, res) {
  const { id } = req.params
  const { denominacion, nivel, grado, area_estudio, vacantes, estudio_texto, exp_texto, codigo,
          num_convocatoria, requiere_posgrado, requiere_tarjeta, exp_anios, exp_tipo, dependencia,
          is_active, proceso, funciones, conocimientos, competencias_transversales, competencias_perfil, ubicaciones } = req.body
  const { data, error } = await supabase
    .from('opec_maestro')
    .update({ denominacion, nivel, grado: grado ? parseInt(grado) : null, area_estudio,
              vacantes: vacantes ? parseInt(vacantes) : 1, estudio_texto, exp_texto, codigo,
              num_convocatoria, requiere_posgrado: !!requiere_posgrado,
              requiere_tarjeta: !!requiere_tarjeta, exp_anios: exp_anios ? parseInt(exp_anios) : 0,
              exp_tipo, dependencia, is_active, updated_at: new Date().toISOString(),
              proceso: proceso || null,
              funciones: Array.isArray(funciones) ? funciones : [],
              conocimientos: Array.isArray(conocimientos) ? conocimientos : [],
              competencias_transversales: competencias_transversales || {},
              competencias_perfil: competencias_perfil || {},
              ubicaciones: Array.isArray(ubicaciones) ? ubicaciones : [] })
    .eq('id', id).select('*').single()
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ opec: data })
}

export async function deleteProcuraduriaOpec(req, res) {
  const { id } = req.params
  const { error } = await supabase.from('opec_maestro').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}

// ── Modo Práctica personalizado por DeepSeek ─────────────────────────────────

const DEFAULT_PRACTICA_SYSTEM = `Eres un psicómetra experto en preparación de aspirantes para concursos de selección del sector público colombiano (CNSC, Contraloría, Procuraduría, DIAN, Defensoría y entidades territoriales).

Tu tarea: generar un MODO PRÁCTICA personalizado basado en el análisis de errores del aspirante.

PROCESO:
1. Analiza las respuestas del aspirante e identifica las áreas con más errores.
2. Genera preguntas nuevas enfocadas en esas áreas débiles (formato idéntico al examen original).
3. Cada pregunta debe abordar el mismo concepto que el aspirante falló, pero desde una situación diferente.
4. Mantén la arquitectura psicométrica: contexto real (100-150 palabras), enunciado directo, 4 opciones con roles A=correcta B=sentido_común_incorrecto C=norma_mal_aplicada D=extralimitación.

FORMATO OBLIGATORIO (JSON array):
[{"area":"...","tipo":"funcional|comportamental","dificultad":"facil|medio|dificil","bloom":"I|II|III","contexto":"...","enunciado":"...","A":"...","B":"...","C":"...","D":"...","correcta":"A|B|C|D","justificacion":"...","analisis_A":"...","analisis_B":"...","analisis_C":"...","analisis_D":"..."}]

Devuelve ÚNICAMENTE el array JSON válido, sin markdown ni texto adicional.`

export async function generarModoPractica(req, res) {
  const userId = req.user.id
  const { simulacro_id, evaluacion_id } = req.body
  if (!simulacro_id) return res.status(400).json({ error: 'simulacro_id es requerido.' })

  // 1. Cargar simulacro origen
  const { data: sim } = await supabase
    .from('user_simulacros')
    .select('preguntas, cargo, completado, evaluacion_id, cantidad_preguntas')
    .eq('id', parseInt(simulacro_id))
    .eq('user_id', userId)
    .maybeSingle()
  if (!sim) return res.status(404).json({ error: 'Simulacro no encontrado.' })
  if (!sim.completado) return res.status(400).json({ error: 'El simulacro debe estar completado para generar práctica.' })

  // 2. Análisis guardado + respuestas
  const [{ data: analisisGuardado }, { data: respuestas }] = await Promise.all([
    supabase.from('user_simulacro_analisis')
      .select('analisis, score_pct, score_correctas, score_total')
      .eq('simulacro_id', parseInt(simulacro_id)).eq('user_id', userId).maybeSingle(),
    supabase.from('user_simulacro_answers')
      .select('area, es_correcta')
      .eq('simulacro_id', parseInt(simulacro_id)).eq('user_id', userId),
  ])

  // 3. Verificar tokens
  const compra = await getActivePurchase(userId)
  if (!compra) return res.status(402).json({ error: 'No tienes tokens disponibles.' })
  const balance = await checkTokenBalance(userId, compra.id)
  if (!balance.ok) return res.status(402).json({ error: `Tokens de IA agotados (${balance.used.toLocaleString()} / ${balance.limit.toLocaleString()} usados).`, tokens_agotados: true })

  // 4. Calcular áreas débiles
  const an = analisisGuardado?.analisis
  let areasDebiles = [], pctError = 0
  if (an?.areas_mejora?.length) {
    areasDebiles = an.areas_mejora
    pctError = analisisGuardado.score_pct != null ? Math.round(100 - analisisGuardado.score_pct) : 0
  } else {
    const errores = (respuestas || []).filter(r => !r.es_correcta)
    areasDebiles = [...new Set(errores.map(r => r.area).filter(Boolean))]
    pctError = respuestas?.length ? Math.round((errores.length / respuestas.length) * 100) : 0
  }

  // 5. Total a generar = mismo que el examen original
  const totalTarget = (sim.preguntas || []).length || sim.cantidad_preguntas || 20

  // 6. Prompt configurable del admin panel
  const systemPrompt = await getPrompt('modo_practica', DEFAULT_PRACTICA_SYSTEM, 'deepseek')

  // 7. Agrupar preguntas originales por área (para referencia de estilo por lote)
  const pregsPorArea = {}
  ;(sim.preguntas || []).forEach(p => {
    const a = p.area || 'General'
    if (!pregsPorArea[a]) pregsPorArea[a] = []
    pregsPorArea[a].push(p)
  })

  // Contexto de análisis IA (va en todos los lotes)
  const ctxAnalisis = an
    ? `ANÁLISIS IA: nivel ${an.nivel_preparacion || 'N/A'} · patrón de error: ${an.patron_error || 'N/A'} · temas críticos: ${(an.temas_criticos || []).join(', ') || 'N/A'} · distractor frecuente: opción ${an.tipo_distractor_frecuente || 'N/A'}`
    : ''

  // 8. Construir lotes — distribuir totalTarget entre áreas débiles
  // BATCH=8 para que el output quepa en el límite real de 8192 tokens de DeepSeek-chat
  const BATCH    = 8
  const PARALLEL = 3
  const lotes    = []

  if (!areasDebiles.length) {
    // Sin áreas claras: lotes generales
    for (let r = totalTarget; r > 0; r -= BATCH)
      lotes.push({ n: Math.min(BATCH, r), area: 'General', refPregs: [] })
  } else {
    // Distribuir preguntas entre áreas débiles proporcionalmente
    const basePerArea = Math.floor(totalTarget / areasDebiles.length)
    const extra       = totalTarget % areasDebiles.length
    areasDebiles.forEach((area, idx) => {
      const cuota = basePerArea + (idx < extra ? 1 : 0)
      // 2 preguntas de referencia del área (estilo y nivel)
      const ref = (pregsPorArea[area] || Object.values(pregsPorArea)[0] || [])
        .slice(0, 2)
        .map(p => ({ area: p.area, tipo: p.tipo, dificultad: p.dificultad, bloom: p.bloom,
                     enunciado: p.enunciado, A: p.A, B: p.B, C: p.C, D: p.D, correcta: p.correcta }))
      for (let r = cuota; r > 0; r -= BATCH)
        lotes.push({ n: Math.min(BATCH, r), area, refPregs: ref })
    })
  }

  // 9. Función de generación por lote
  async function generarLote(lote) {
    const bloqueRef = lote.refPregs.length
      ? `\nREFERENCIA DE ESTILO (${lote.refPregs.length} pregunta/s del área — replica nivel y formato):\n${JSON.stringify(lote.refPregs)}`
      : ''
    const prompt = `${systemPrompt}

CARGO: ${sim.cargo}
ÁREA A REFORZAR EN ESTE LOTE: ${lote.area}
PREGUNTAS A GENERAR: ${lote.n}
RESULTADO ORIGINAL: ${pctError}% de error
${ctxAnalisis}${bloqueRef}

Devuelve ÚNICAMENTE el JSON array con exactamente ${lote.n} preguntas.`

    const r = await deepseekGenerar(prompt, 8192)
    const cleaned = r.texto.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    let parsed
    try { parsed = JSON.parse(cleaned) } catch {
      const match = cleaned.match(/\[[\s\S]*\]/)
      if (!match) throw new Error('sin JSON array')
      parsed = JSON.parse(match[0])
    }
    const arr = Array.isArray(parsed) ? parsed : (parsed.preguntas || parsed.questions || [])
    return { preguntas: arr, tokensIn: r.tokensIn || 0, tokensOut: r.tokensOut || 0 }
  }

  // 10. Generar en oleadas paralelas
  const allPreguntas = []
  let totalTIn = 0, totalTOut = 0
  for (let i = 0; i < lotes.length; i += PARALLEL) {
    const wave = lotes.slice(i, i + PARALLEL)
    const resultados = await Promise.allSettled(wave.map(l => generarLote(l)))
    for (const r of resultados) {
      if (r.status === 'fulfilled') {
        allPreguntas.push(...r.value.preguntas)
        totalTIn  += r.value.tokensIn
        totalTOut += r.value.tokensOut
      } else {
        console.error('[Práctica] lote error:', r.reason?.message)
      }
    }
  }

  if (!allPreguntas.length)
    return res.status(500).json({ error: 'Praxia no pudo generar las preguntas. Intenta de nuevo.' })

  // 11. Guardar como nuevo simulacro de práctica
  const evalId = evaluacion_id || sim.evaluacion_id
  const { data: nuevo, error: insErr } = await supabase
    .from('user_simulacros')
    .insert({
      user_id:             userId,
      evaluacion_id:       evalId ? parseInt(evalId) : null,
      cargo:               sim.cargo,
      preguntas:           allPreguntas,
      cantidad_preguntas:  allPreguntas.length,
      tiempo_por_pregunta: 90,
      dificultad_config:   'practica',
      simulacro_origen_id: parseInt(simulacro_id),
    })
    .select('id')
    .single()
  if (insErr) return res.status(500).json({ error: insErr.message })

  // 12. Registrar tokens
  await recordTokenUsage({ userId, purchaseId: compra.id, tokensIn: totalTIn, tokensOut: totalTOut, endpoint: 'modo_practica', modelo: 'deepseek' })

  return res.status(201).json({ simulacro_id: nuevo.id, total: allPreguntas.length, areas_cubiertas: areasDebiles })
}

export async function deleteOpecsMasivo(req, res) {
  const { ids } = req.body
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Se requiere un array de ids.' })
  if (ids.length > 500) return res.status(400).json({ error: 'Máximo 500 ids por operación.' })
  const { error } = await supabase.from('opec_maestro').delete().in('id', ids.map(Number))
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true, eliminados: ids.length })
}

export async function statsProcuraduriaOpecs(req, res) {
  const { convocatoria_id } = req.query
  if (!convocatoria_id) return res.status(400).json({ error: 'convocatoria_id es requerido.' })
  const { data, error } = await supabase
    .from('opec_maestro').select('nivel, is_active')
    .eq('convocatoria_id', parseInt(convocatoria_id))
  if (error) return res.status(500).json({ error: error.message })
  const total   = data.length
  const activos = data.filter(r => r.is_active).length
  const porNivel = data.reduce((acc, r) => {
    if (r.is_active) acc[r.nivel || 'Sin nivel'] = (acc[r.nivel || 'Sin nivel'] || 0) + 1
    return acc
  }, {})
  return res.json({ total, activos, porNivel })
}

// ── Normaliza un registro OPEC desde cualquier formato de fuente ──────────────
// Soporta: formato interno, SIMO camelCase, exports con nombres alternativos,
// arrays de municipios/ciudades, experiencia en años o meses, etc.
function normalizarRegistroOPEC(r, entidadConv, convocatoriaId) {
  // Auto-desempaquetar subobjetos comunes (ej: r.empleo, r.cargo)
  if (r.empleo && typeof r.empleo === 'object' && !Array.isArray(r.empleo)) r = { ...r, ...r.empleo }
  if (r.cargo  && typeof r.cargo  === 'object' && !Array.isArray(r.cargo))  r = { ...r, ...r.cargo  }

  const denominacion = (
    r.denominacion || r.nombreEmpleo || r.nombre_empleo || r.cargoNombre ||
    r.nombre_cargo || r.nombre || ''
  ).toString().trim()
  if (!denominacion) return null

  // Vacantes
  const vacantesRaw = r.vacantes ?? r.total_vacantes ?? r.cupos ?? r.cuposDisponibles ??
    r.plazas ?? r.num_vacantes ?? r.cupos_disponibles ?? 1
  const vacantes = Math.max(1, parseInt(vacantesRaw) || 1)

  // Número de convocatoria y de OPEC
  const num_convocatoria = r.num_convocatoria || r.numero_convocatoria ||
    r.numeroConvocatoria || r.codigoConvocatoria || r.convocatoria || null
  const numero_opec_raw  = r.numero_opec || r.codigoOpec || r.codigo_opec ||
    r.numeroOpec || r.opecCodigo || null
  const numero_opec      = numero_opec_raw ? String(numero_opec_raw) : null

  // Nivel / grado / salario
  const nivel   = r.nivel || r.nivelJerarquico || r.nivel_jerarquico || r.nivelEmpleo || r.nivel_empleo || null
  const gradoRaw = r.grado ?? r.gradoBienestar ?? r.grado_salarial ?? r.gradoSalarial ?? null
  const grado   = gradoRaw != null ? parseInt(gradoRaw) || null : null
  const salRaw   = r.salario ?? r.salarioBasico ?? r.salario_basico ?? r.sueldo ?? null
  const salario = salRaw != null ? parseInt(salRaw) || null : null

  // Dependencia / area / código
  const dependencia  = r.dependencia || r.dependenciaNombre || r.nombre_dependencia || null
  const area_estudio = r.area_estudio || r.areaEstudio || r.area_conocimiento ||
    r.areaConocimiento || r.nucleo_basico || r.nucleoBasico || null
  const codigo = r.codigo || r.codigoEmpleo || r.codigo_empleo || null

  // Requisitos de estudio y experiencia
  const estudio_texto = r.estudio_texto || r.educacion_requerida || r.requisito_estudio ||
    r.requisitoEstudio || r.educacion || r.requisito_academico || null
  const exp_texto = r.exp_texto || r.experiencia_requerida || r.requisito_experiencia ||
    r.requisitoExperiencia || r.experiencia || null

  // Experiencia: meses preferido; si viene en años se convierte
  let exp_anios = r.exp_anios ?? r.anos_exp ?? r.meses_experiencia ?? null
  if (exp_anios == null && r.aniosExperiencia != null) exp_anios = Math.round(parseFloat(r.aniosExperiencia) * 12)
  if (exp_anios == null && r.anos_experiencia != null) exp_anios = Math.round(parseFloat(r.anos_experiencia) * 12)
  if (exp_anios == null && r.years_experience != null) exp_anios = Math.round(parseFloat(r.years_experience) * 12)
  exp_anios = exp_anios != null ? parseInt(exp_anios) || 0 : 0

  const exp_tipo = r.exp_tipo || r.tipo_exp || r.tipoExperiencia || r.tipo_experiencia || null

  // Entidad
  const entidad = r.entidad || r.entidadNombre || r.nombre_entidad || entidadConv

  // ── Ubicaciones — múltiples formatos ─────────────────────────────────────────
  let ubicaciones = []
  if (Array.isArray(r.ubicaciones) && r.ubicaciones.length > 0) {
    // Formato interno: [{ciudad, vacantes, departamento}]
    ubicaciones = r.ubicaciones.map(u => ({
      ciudad:      u.ciudad      || u.municipio    || u.municipioNombre || null,
      departamento:u.departamento|| u.depto        || null,
      vacantes:    parseInt(u.vacantes || u.cantidad || 0) || 0,
    })).filter(u => u.ciudad)
  } else if (Array.isArray(r.municipios) && r.municipios.length > 0) {
    ubicaciones = r.municipios.map(m =>
      typeof m === 'string'
        ? { ciudad: m, vacantes: 0 }
        : { ciudad: m.nombre || m.municipio || m.ciudad || null, vacantes: parseInt(m.vacantes || m.cantidad || 0) || 0, departamento: m.departamento || null }
    ).filter(u => u.ciudad)
  } else if (Array.isArray(r.ciudades) && r.ciudades.length > 0) {
    ubicaciones = r.ciudades.map(c =>
      typeof c === 'string' ? { ciudad: c, vacantes: 0 } : { ciudad: c.nombre || c.ciudad || null, vacantes: parseInt(c.vacantes || 0) || 0 }
    ).filter(u => u.ciudad)
  } else {
    const ciudad = r.municipio || r.ciudad || r.municipioNombre || r.nombreMunicipio || null
    const depto  = r.departamento || r.departamentoNombre || r.nombreDepartamento || null
    if (ciudad || depto) ubicaciones = [{ ciudad, departamento: depto, vacantes }]
  }

  // Funciones: array de strings, array de objetos, o string separado por saltos
  let funciones = []
  if (Array.isArray(r.funciones)) {
    funciones = r.funciones.map(f => typeof f === 'string' ? f : f.descripcion || f.funcion || '').filter(Boolean)
  } else if (typeof r.funciones === 'string' && r.funciones.trim()) {
    funciones = r.funciones.split(/\n|;/).map(s => s.trim()).filter(Boolean)
  }

  // Conocimientos
  let conocimientos = Array.isArray(r.conocimientos) ? r.conocimientos : []
  if (!conocimientos.length && r.conocimientos_especificos) {
    conocimientos = typeof r.conocimientos_especificos === 'string'
      ? r.conocimientos_especificos.split(',').map(s => s.trim()).filter(Boolean)
      : Array.isArray(r.conocimientos_especificos) ? r.conocimientos_especificos : []
  }

  // Fecha cierre
  const cierreRaw = r.cierre_inscripciones || r.fechaInscripcion || r.fecha_cierre || null
  const cierre = cierreRaw && /^\d{4}-\d{2}-\d{2}/.test(cierreRaw) ? cierreRaw.slice(0, 10) : null

  return {
    convocatoria_id:            parseInt(convocatoriaId),
    entidad,
    num_convocatoria,
    denominacion,
    nivel,
    codigo,
    grado,
    salario,
    vacantes,
    dependencia,
    area_estudio,
    requiere_posgrado:          !!(r.requiere_posgrado || r.requierePosgrado || r.req_posgrado),
    requiere_tarjeta:           !!(r.requiere_tarjeta  || r.requiereTarjeta  || r.req_tarjeta),
    exp_anios,
    exp_tipo,
    estudio_texto,
    exp_texto,
    proceso:                    r.proceso || r.tipo_proceso || null,
    funciones,
    conocimientos,
    competencias_transversales: r.competencias_transversales && typeof r.competencias_transversales === 'object' ? r.competencias_transversales : {},
    competencias_perfil:        r.competencias_perfil        && typeof r.competencias_perfil        === 'object' ? r.competencias_perfil        : {},
    ubicaciones,
    numero_opec,
    manual_url:                 r.manual_url   || r.url_manual  || null,
    proposito:                  r.proposito    || r.objeto       || r.descripcion_cargo || null,
    municipio:                  r.municipio    || r.municipioNombre || null,
    departamento:               r.departamento || r.departamentoNombre || null,
    proceso_de_seleccion:       r.proceso_de_seleccion || null,
    requisito_otros:            r.requisito_otros || r.requisitoOtros || null,
    vigencia_salarial:          r.vigencia_salarial ? parseInt(r.vigencia_salarial) : null,
    cierre_inscripciones:       cierre,
    anio_convocatoria:          r.anio_convocatoria ? parseInt(r.anio_convocatoria) : null,
    nit_entidad:                r.nit_entidad ? String(r.nit_entidad) : null,
    fuente:                     r.fuente || 'manual',
    is_active:                  r.is_active !== false,
  }
}

export async function importOpecMaestro(req, res) {
  let { registros, convocatoria_id } = req.body
  if (!Array.isArray(registros) || !registros.length) return res.status(400).json({ error: 'Se requiere un array de registros.' })
  if (!convocatoria_id) return res.status(400).json({ error: 'convocatoria_id es requerido.' })
  if (registros.length > 2000) return res.status(400).json({ error: 'Máximo 2000 registros por importación.' })

  const { data: conv } = await supabase.from('convocatorias').select('entidad').eq('id', parseInt(convocatoria_id)).maybeSingle()
  const entidadConv = conv?.entidad || 'Entidad pública'

  const rows = registros
    .map(r => normalizarRegistroOPEC(r, entidadConv, convocatoria_id))
    .filter(Boolean)

  if (!rows.length) return res.status(400).json({ error: 'Ningún registro tiene denominación (nombre del cargo). Revisa el formato del JSON.' })

  // Stats para el feedback al admin
  const stats = {
    total_archivo:   registros.length,
    con_denominacion: rows.length,
    sin_denominacion: registros.length - rows.length,
    con_numero_opec: rows.filter(r => r.numero_opec).length,
    con_ubicaciones: rows.filter(r => r.ubicaciones?.length > 0).length,
    con_vacantes:    rows.filter(r => r.vacantes > 1).length,
  }

  let insertados = 0
  const insertedRows = []
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    const { data, error } = await supabase.from('opec_maestro').insert(chunk).select('id, num_convocatoria, denominacion')
    if (error) return res.status(500).json({ error: error.message, insertados_antes: insertados, stats })
    insertados += data.length
    insertedRows.push(...data)
  }

  return res.status(201).json({ insertados, stats, registros: insertedRows })
}

// ── Historial de análisis de perfil del usuario ───────────────────────────────

export async function getMisAnalisis(req, res) {
  const userId = req.user.id
  const { data, error } = await supabase
    .from('user_profile_analysis')
    .select('id, convocatoria_id, convocatoria_nombre, analisis, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('[IA] getMisAnalisis:', error.message)
    return res.json({ analisis: [] })
  }
  return res.json({ analisis: data || [] })
}

export async function deleteMiAnalisis(req, res) {
  const userId = req.user.id
  const { id } = req.params
  const { error } = await supabase
    .from('user_profile_analysis')
    .delete()
    .eq('id', id)
    .eq('user_id', userId) // solo puede borrar los suyos
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
}

// ── Historial de análisis de simulacros del usuario ───────────────────────────

export async function getMisAnalisisSimulacros(req, res) {
  const userId = req.user.id
  const { data, error } = await supabase
    .from('user_simulacro_analisis')
    .select('id, simulacro_id, evaluacion_id, cargo, score_pct, score_correctas, score_total, analisis, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.error('[IA] getMisAnalisisSimulacros:', error.message)
    return res.json({ analisis: [] })
  }
  return res.json({ analisis: data || [] })
}
