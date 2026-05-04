// hooks/useCsvImport.js
// Importación de preguntas desde CSV y JSON con preview antes de confirmar.

import { useState } from 'react'
import { parseCSVLine } from '../lib/helpers'
import { LETRAS, CSV_COLUMNS, PROMPT_IA_CSV } from '../lib/constants'

// ── Parsers ──────────────────────────────────────────────────────────────────

function buildPregunta(area, dificultad, enunciado, opcs, correcta, explicacion) {
  const correctaUp = correcta.trim().toUpperCase()
  if (!['A','B','C','D'].includes(correctaUp))
    throw new Error(`"correcta" debe ser A, B, C o D. Encontrado: "${correcta}"`)
  if (!enunciado.trim())
    throw new Error('"enunciado" no puede estar vacío')
  if (!opcs[correctaUp]?.trim())
    throw new Error(`La opción correcta "${correctaUp}" está vacía`)

  return {
    _id: Math.random().toString(36).slice(2),
    text: enunciado.trim(),
    explanation: explicacion.trim(),
    difficulty: ['facil','medio','dificil'].includes(dificultad.toLowerCase())
      ? dificultad.toLowerCase() : 'medio',
    area: area.trim(),
    options: LETRAS.map(l => ({
      letter: l,
      text: (opcs[l] || '').trim(),
      is_correct: l === correctaUp,
    })),
  }
}

function parsearCSV(texto) {
  const lineas = texto.replace(/\r/g, '').split('\n').filter(Boolean)
  if (lineas.length < 2)
    throw new Error('El CSV debe tener encabezado + al menos 1 pregunta.')

  const header = parseCSVLine(lineas[0]).map(h => h.trim().toLowerCase())
  const reqs = ['enunciado','a','b','c','correcta']
  const faltantes = reqs.filter(r => !header.includes(r))
  if (faltantes.length)
    throw new Error(`Columnas obligatorias faltantes: ${faltantes.join(', ')}`)

  const get = (cols, key) => cols[header.indexOf(key)] ?? ''

  return lineas.slice(1).map((linea, i) => {
    const cols = parseCSVLine(linea)
    try {
      return buildPregunta(
        get(cols,'area'),
        get(cols,'dificultad'),
        get(cols,'enunciado'),
        { A: get(cols,'a'), B: get(cols,'b'), C: get(cols,'c'), D: get(cols,'d') },
        get(cols,'correcta'),
        get(cols,'explicacion'),
      )
    } catch (e) {
      throw new Error(`Fila ${i+2}: ${e.message}`)
    }
  })
}

function parsearJSON(texto) {
  let arr
  try { arr = JSON.parse(texto) } catch { throw new Error('JSON inválido. Verifica la sintaxis.') }
  if (!Array.isArray(arr)) throw new Error('El JSON debe ser un arreglo [ { ... }, ... ]')
  if (arr.length === 0) throw new Error('El JSON está vacío.')

  return arr.map((item, i) => {
    try {
      // Soporte opciones planas { A,B,C,D } o anidadas { opciones: {A,B,C,D} }
      const opcs = item.opciones
        ? { A: item.opciones.A||'', B: item.opciones.B||'', C: item.opciones.C||'', D: item.opciones.D||'' }
        : { A: item.A||'', B: item.B||'', C: item.C||'', D: item.D||'' }
      return buildPregunta(
        item.area||'', item.dificultad||'medio',
        item.enunciado||'', opcs,
        item.correcta||'', item.explicacion||'',
      )
    } catch (e) {
      throw new Error(`Item ${i+1}: ${e.message}`)
    }
  })
}

// ── Plantillas ────────────────────────────────────────────────────────────────

const CSV_PLANTILLA = [
  CSV_COLUMNS.join(','),
  'Derecho Fiscal,medio,"¿Cuál es el órgano de control fiscal en Colombia?","Procuraduría General","Contraloría General de la República","Fiscalía General","Defensoría del Pueblo",B,"La Contraloría ejerce vigilancia de la gestión fiscal según el Art. 267 de la Constitución."',
  'Control Interno,facil,"¿Qué significa MIPG?","Modelo Integrado de Planeación y Gestión","Manual Interno de Procesos Generales","Mecanismo Institucional de Planeación General","Modelo Integral de Presupuesto y Gobierno",A,"MIPG es el sistema unificado de gestión y control de las entidades públicas colombianas."',
  'Derecho Administrativo,dificil,"¿Cuál es el término de prescripción de la acción disciplinaria?","3 años","5 años","10 años","12 años",C,"Según el Código General Disciplinario (Ley 1952/2019) el término es de 10 años."',
  'Ofimática,facil,"¿Qué atajo de teclado guarda un documento en MS Word?","Ctrl+P","Ctrl+S","Ctrl+N","Alt+G",B,"Ctrl+S (Save) es el estándar para guardar en la suite de Microsoft Office."',
  'Gestión Pública,medio,"¿Qué entidad lidera el Sistema Nacional de Evaluación de Gestión y Resultados SINERGIA?","DNP","DAFP","Ministerio de Hacienda","Presidencia",A,"SINERGIA es coordinado por el DNP para el seguimiento de metas del Plan Nacional de Desarrollo."',
].join('\n')

const JSON_PLANTILLA = JSON.stringify([
  {
    area: 'Derecho Fiscal',
    dificultad: 'medio',
    enunciado: '¿Cuál es el órgano de control fiscal en Colombia?',
    A: 'Procuraduría General',
    B: 'Contraloría General de la República',
    C: 'Fiscalía General',
    D: 'Defensoría del Pueblo',
    correcta: 'B',
    explicacion: 'La Contraloría ejerce vigilancia de la gestión fiscal según el Art. 267.',
  },
  {
    area: 'Control Interno',
    dificultad: 'facil',
    enunciado: '¿Qué significa MIPG?',
    opciones: {
      A: 'Modelo Integrado de Planeación y Gestión',
      B: 'Manual Interno de Procesos Generales',
      C: 'Mecanismo Institucional de Planeación General',
      D: 'Modelo Integral de Presupuesto y Gobierno',
    },
    correcta: 'A',
    explicacion: 'MIPG es el sistema unificado de gestión y control de las entidades públicas colombianas.',
  },
  {
    area: 'Derecho Administrativo',
    dificultad: 'dificil',
    enunciado: '¿Cuál es el término de prescripción de la acción disciplinaria?',
    A: '3 años',
    B: '5 años',
    C: '10 años',
    D: '12 años',
    correcta: 'C',
    explicacion: 'Según la Ley 1952 de 2019 (Código General Disciplinario) el término es de 10 años.',
  },
], null, 2)

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useCsvImport({ nivelActivo, niveles, modoGuiado, setPreguntas, addToast, csvRef }) {
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importOk, setImportOk] = useState(null)
  const [preview, setPreview] = useState(null) // { preguntas, fileName, tipo }

  function procesarArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (csvRef.current) csvRef.current.value = ''

    setImportando(true)
    setImportError(null)
    setImportOk(null)
    setPreview(null)

    const esJSON = file.name.toLowerCase().endsWith('.json')
    const reader = new FileReader()

    reader.onload = ev => {
      try {
        const texto = String(ev.target?.result || '')
        const preguntas = esJSON ? parsearJSON(texto) : parsearCSV(texto)
        setPreview({ preguntas, fileName: file.name, tipo: esJSON ? 'JSON' : 'CSV' })
      } catch (err) {
        setImportError(err.message || 'No se pudo procesar el archivo.')
        addToast('error', err.message)
      } finally {
        setImportando(false)
      }
    }
    reader.readAsText(file, 'utf-8')
  }

  function confirmarImport() {
    if (!preview) return
    const nivelNombre = niveles.find(n => n._id === nivelActivo)?.name || 'nivel activo'
    setPreguntas(prev => ({
      ...prev,
      [nivelActivo]: [...(prev[nivelActivo] || []), ...preview.preguntas],
    }))
    setImportOk(
      `${preview.preguntas.length} pregunta${preview.preguntas.length !== 1 ? 's' : ''} ` +
      `importadas al ${modoGuiado ? 'banco' : 'nivel'} "${nivelNombre}".`
    )
    addToast('success', `Importadas ${preview.preguntas.length} preguntas`)
    setPreview(null)
  }

  function cancelarPreview() {
    setPreview(null)
    setImportError(null)
  }

  function descargarPlantillaCSV() {
    const blob = new Blob([CSV_PLANTILLA], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_preguntas_praxia.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function descargarPlantillaJSON() {
    const blob = new Blob([JSON_PLANTILLA], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'plantilla_preguntas_praxia.json'; a.click()
    URL.revokeObjectURL(url)
  }

  async function copiarPromptIA() {
    try {
      await navigator.clipboard.writeText(PROMPT_IA_CSV)
      setImportOk('Prompt copiado al portapapeles.')
      setTimeout(() => setImportOk(null), 2500)
    } catch { setImportError('No se pudo copiar el prompt.') }
  }

  async function copiarInstruccionesExcel() {
    const texto =
      `INSTRUCCIONES PARA PREPARAR EL ARCHIVO DE PREGUNTAS\n\n` +
      `Columnas requeridas (en este orden):\n${CSV_COLUMNS.join(' | ')}\n\n` +
      `Reglas:\n` +
      `- Una fila = una pregunta\n` +
      `- "correcta" solo puede ser A, B, C o D (mayúscula)\n` +
      `- "dificultad" debe ser: facil, medio o dificil\n` +
      `- La opción D es opcional (puede ir vacía)\n` +
      `- Guardar como CSV UTF-8 (no UTF-16)\n` +
      `- Si el enunciado tiene comas, enciérralo en comillas dobles\n\n` +
      `Pasos en Excel:\n` +
      `1. Archivo > Guardar como\n` +
      `2. Tipo: CSV UTF-8 (delimitado por comas)\n` +
      `3. Confirmar que no hay filas vacías al final`
    try {
      await navigator.clipboard.writeText(texto)
      setImportOk('Instrucciones copiadas.')
      setTimeout(() => setImportOk(null), 2500)
    } catch { setImportError('No se pudo copiar.') }
  }

  return {
    importando, importError, setImportError,
    importOk, setImportOk,
    preview,
    procesarArchivo,
    confirmarImport,
    cancelarPreview,
    descargarPlantillaCSV,
    descargarPlantillaJSON,
    copiarPromptIA,
    copiarInstruccionesExcel,
  }
}
