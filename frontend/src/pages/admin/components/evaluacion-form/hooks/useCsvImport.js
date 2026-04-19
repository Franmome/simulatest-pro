// hooks/useCsvImport.js
// Gestiona la importación de preguntas desde CSV y utilidades relacionadas.

import { useState } from 'react'
import { parseCSVLine } from '../lib/helpers'
import { LETRAS, CSV_COLUMNS, PROMPT_IA_CSV } from '../lib/constants'

export function useCsvImport({ nivelActivo, niveles, modoGuiado, setPreguntas, addToast, csvRef }) {
  const [importando, setImportando] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importOk, setImportOk] = useState(null)

  function importarCSV(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportando(true)
    setImportError(null)
    setImportOk(null)

    const reader = new FileReader()
    reader.onload = event => {
      try {
        const raw = String(event.target?.result || '')
          .replace(/\r/g, '')
          .split('\n')
          .filter(Boolean)

        if (raw.length < 2) {
          throw new Error('El archivo CSV no tiene suficientes filas (mínimo encabezado + 1 pregunta).')
        }

        const header = parseCSVLine(raw[0]).map(h => h.toLowerCase())
        const reqs = ['enunciado', 'a', 'b', 'c', 'd', 'correcta']
        const missing = reqs.filter(r => !header.includes(r))
        if (missing.length) {
          throw new Error(
            `Faltan columnas obligatorias: ${missing.join(', ')}. ` +
            `Descarga la plantilla para ver el formato correcto.`
          )
        }

        const nuevas = raw.slice(1).map((line, i) => {
          const cols = parseCSVLine(line)
          const get = key => cols[header.indexOf(key)] || ''
          const correcta = get('correcta').toUpperCase()

          if (!LETRAS.includes(correcta)) {
            throw new Error(
              `Fila ${i + 2}: el campo "correcta" debe ser A, B, C o D. ` +
              `Valor encontrado: "${get('correcta')}"`
            )
          }

          return {
            _id: Math.random().toString(36).slice(2),
            text: get('enunciado'),
            explanation: get('explicacion'),
            difficulty: get('dificultad') || 'medio',
            area: get('area') || '',
            options: LETRAS.map(letter => ({
              letter,
              text: get(letter.toLowerCase()),
              is_correct: letter === correcta,
            })),
          }
        })

        setPreguntas(prev => ({
          ...prev,
          [nivelActivo]: [...(prev[nivelActivo] || []), ...nuevas],
        }))

        const nivelNombre = niveles.find(n => n._id === nivelActivo)?.name || 'nivel activo'
        setImportOk(
          `✅ ${nuevas.length} pregunta${nuevas.length !== 1 ? 's' : ''} importada${nuevas.length !== 1 ? 's' : ''} ` +
          `correctamente al ${modoGuiado ? 'banco' : 'nivel'} "${nivelNombre}".`
        )

        if (csvRef.current) csvRef.current.value = ''
        addToast('success', `Importadas ${nuevas.length} preguntas`)

      } catch (err) {
        setImportError(err.message || 'No se pudo procesar el CSV.')
        addToast('error', 'Error al importar CSV: ' + err.message)
      } finally {
        setImportando(false)
      }
    }

    reader.readAsText(file, 'utf-8')
  }

  function descargarPlantilla() {
    const filas = [
      CSV_COLUMNS.join(','),
      'Derecho Fiscal,medio,"¿Cuál es el órgano de control fiscal en Colombia?","Procuraduría","Contraloría","Fiscalía","Defensoría",B,"La Contraloría ejerce vigilancia fiscal según el Art. 267."',
      'Control Interno,facil,"¿Qué significa MIPG?","Modelo Integrado de Planeación y Gestión","Manual Interno de Procesos Generales","Mecanismo Institucional de Planeación General","Modelo Integral de Procesos de Gobierno",A,"MIPG significa Modelo Integrado de Planeación y Gestión."',
    ]
    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'plantilla_preguntas_simulatest.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function copiarPromptIA() {
    try {
      await navigator.clipboard.writeText(PROMPT_IA_CSV)
      setImportOk('✅ Prompt copiado.')
      setTimeout(() => setImportOk(null), 2000)
    } catch {
      setImportError('No se pudo copiar el prompt.')
    }
  }

  async function copiarInstruccionesExcel() {
    const texto =
      `Instrucciones para preparar el archivo:\n` +
      `1. Abrir Excel o Google Sheets\n` +
      `2. Crear columnas: ${CSV_COLUMNS.join(',')}\n` +
      `3. Una fila = una pregunta\n` +
      `4. En "correcta" usar solo A, B, C o D\n` +
      `5. Guardar como CSV UTF-8`
    try {
      await navigator.clipboard.writeText(texto)
      setImportOk('✅ Instrucciones copiadas.')
      setTimeout(() => setImportOk(null), 2000)
    } catch {
      setImportError('No se pudo copiar.')
    }
  }

  return {
    importando,
    importError, setImportError,
    importOk, setImportOk,
    importarCSV,
    descargarPlantilla,
    copiarPromptIA,
    copiarInstruccionesExcel,
  }
}
