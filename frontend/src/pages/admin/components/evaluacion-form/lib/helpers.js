// helpers.js
// Funciones utilitarias compartidas por todos los componentes y servicios del formulario de evaluación.

import { LETRAS } from './constants'

// ============================================================================
// FÁBRICA DE PREGUNTA VACÍA
// Devuelve un objeto pregunta con todas sus opciones A-D inicializadas vacías.
// Cada pregunta lleva un _id local (string aleatorio) que se reemplaza por el
// id real de la BD en cuanto se guarda.
// ============================================================================
export function preguntaVacia() {
  return {
    _id: Math.random().toString(36).slice(2), // ID local temporal
    text: '',
    explanation: '',
    difficulty: 'medio',
    area: '',
    options: LETRAS.map(letter => ({ letter, text: '', is_correct: false })),
  }
}

// ============================================================================
// ÍCONO DE MATERIAL
// Devuelve el nombre del Material Symbol correspondiente al tipo de recurso.
// ============================================================================
export function iconoMaterial(type) {
  return (
    { pdf: 'picture_as_pdf', video: 'play_circle', link: 'link', doc: 'description' }[type] ||
    'attachment'
  )
}

// ============================================================================
// PARSER DE LÍNEA CSV
// Parsea una línea CSV respetando campos entre comillas dobles.
// Ejemplo: 'Hola,"mundo,cruel"' → ['Hola', 'mundo,cruel']
// ============================================================================
export function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      // Comilla escapada dentro de un campo: "" → "
      current += '"'
      i++
    } else if (char === '"') {
      // Entrada/salida de campo entrecomillado
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      // Separador de columna fuera de comillas
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result.map(v => v.trim())
}

// ============================================================================
// LABELS DINÁMICOS
// Devuelve el mapa de etiquetas según modo (guiado = lenguaje sencillo,
// técnico = terminología estándar).
// ============================================================================
export function buildLabels(modoGuiado) {
  if (!modoGuiado) {
    return {
      versiones: 'Versiones y Precios',
      profesion: 'Profesión / Cargo',
      nivel: 'Nivel de preguntas',
      material: 'Material de Estudio',
      version: 'Versión',
      nivelActivo: 'Nivel activo',
      banco: 'Banco de preguntas',
      planes: 'Planes de acceso',
      recursos: 'Recursos de apoyo',
      modulos: 'Módulos / Áreas',
    }
  }
  return {
    versiones: 'Planes de acceso',
    profesion: 'Cargo o perfil',
    nivel: 'Banco de preguntas',
    material: 'Recursos de apoyo',
    version: 'Plan',
    nivelActivo: 'Banco activo',
    banco: 'Banco de preguntas',
    planes: 'Planes de acceso',
    recursos: 'Recursos de apoyo',
    modulos: 'Módulos',
  }
}

// ============================================================================
// NORMALIZAR ERROR DE SUPABASE
// Convierte el objeto error de Supabase + contexto extra en una estructura
// unificada que el ErrorBanner puede mostrar con detalle.
//
// Retorna: { message, mensajeHumano, accionSugerida, technical, seccion }
// ============================================================================
export function normalizeSupabaseError(supaErr, contexto = {}) {
  const {
    etapa = 'operación desconocida',
    tabla = '',
    operacion = '',
    seccion = 'general',
  } = contexto

  // Texto crudo del error
  const raw = supaErr?.message || String(supaErr) || 'Error desconocido'
  const code = supaErr?.code || supaErr?.statusCode || ''
  const details = supaErr?.details || ''
  const hint = supaErr?.hint || ''
  const rawLower = raw.toLowerCase()

  // Mensajes humanos y acciones según tipo de error detectado
  let mensajeHumano = `No se pudo completar "${etapa}".`
  let accionSugerida = 'Verifica tu conexión a internet y vuelve a intentar. Si el problema persiste, contacta al administrador del sistema.'

  if (rawLower.includes('bucket') || rawLower.includes('storage') || code === 404) {
    mensajeHumano = 'No se pudo acceder al almacenamiento de archivos.'
    accionSugerida = 'Verifica que el bucket "materials" existe en Supabase Storage y que las políticas de acceso (RLS) están configuradas para permitir uploads.'
  } else if (code === '23505' || rawLower.includes('duplicate') || rawLower.includes('unique')) {
    mensajeHumano = 'Ya existe un registro con los mismos datos únicos.'
    accionSugerida = 'Cambia el nombre u otro campo duplicado antes de volver a guardar.'
  } else if (code === '42501' || rawLower.includes('rls') || rawLower.includes('row-level security') || rawLower.includes('permission')) {
    mensajeHumano = 'No tienes permisos para realizar esta operación en la base de datos.'
    accionSugerida = 'Revisa las políticas RLS de la tabla en el panel de Supabase.'
  } else if (code === 'PGRST116' || rawLower.includes('not found') || rawLower.includes('0 rows')) {
    mensajeHumano = 'El registro esperado no se encontró en la base de datos.'
    accionSugerida = 'El registro puede haber sido eliminado externamente. Recarga la página.'
  } else if (rawLower.includes('timeout') || rawLower.includes('timed out')) {
    mensajeHumano = 'La operación tardó demasiado y fue cancelada.'
    accionSugerida = 'Verifica la conexión a internet. Si el problema persiste, reduce la cantidad de datos e inténtalo de nuevo.'
  } else if (rawLower.includes('jwt') || rawLower.includes('token') || rawLower.includes('auth')) {
    mensajeHumano = 'Tu sesión expiró o no tienes autorización.'
    accionSugerida = 'Cierra sesión y vuelve a iniciarla para obtener un token válido.'
  }

  // String técnico completo para el panel expandible
  const partesTecnicas = [
    tabla && `Tabla: ${tabla}`,
    operacion && `Operación: ${operacion}`,
    `Error: ${raw}`,
    code && `Código: ${code}`,
    details && `Detalle: ${details}`,
    hint && `Sugerencia BD: ${hint}`,
  ].filter(Boolean)

  return {
    seccion,
    etapa,
    message: `Falló: ${etapa}${tabla ? ` (${tabla})` : ''}`,
    mensajeHumano,
    accionSugerida,
    technical: partesTecnicas.join(' | '),
  }
}

// ============================================================================
// TIMEOUT DEFENSIVO
// Envuelve cualquier promesa con un timeout máximo.
// Si la promesa no resuelve en `ms` milisegundos, lanza un error descriptivo.
//
// Uso: await withTimeout(saveAllLevels({...}), 60000, 'guardar niveles')
// ============================================================================
export async function withTimeout(promise, ms, etapa) {
  let timerId

  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      reject(
        Object.assign(
          new Error(
            `La etapa "${etapa}" tardó demasiado (>${Math.round(ms / 1000)}s) y fue cancelada para evitar un bloqueo infinito. ` +
            `Verifica tu conexión a internet y vuelve a intentar.`
          ),
          { seccion: 'general', isTimeout: true }
        )
      )
    }, ms)
  })

  try {
    // La primera promesa que resuelva gana; el timeout lanza si gana él
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timerId)
  }
}
