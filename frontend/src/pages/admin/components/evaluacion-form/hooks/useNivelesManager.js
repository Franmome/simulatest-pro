// hooks/useNivelesManager.js
// Gestiona el estado y CRUD en memoria de niveles y preguntas.
// Estos datos se persisten en BD solo al hacer Submit (handleSubmit en EvaluacionForm).

import { useState } from 'react'
import { preguntaVacia } from '../lib/helpers'
import { NIVEL_INICIAL, preguntasIniciales } from '../lib/defaults'

export function useNivelesManager({ addToast }) {
  const [niveles, setNiveles] = useState([{ ...NIVEL_INICIAL }])
  const [nivelActivo, setNivelActivo] = useState('n1')
  const [preguntas, setPreguntas] = useState(preguntasIniciales)
  const [pregExpandida, setPregExpandida] = useState(null)
  const [moduloActivo, setModuloActivo] = useState(null)

  // Agrega un nuevo nivel vacío. No cambia de tab (caller decide).
  function agregarNivel() {
    const _id = Math.random().toString(36).slice(2)
    setNiveles(prev => [
      ...prev,
      { _id, name: '', description: '', time_limit: 90, passing_score: 70, sort_order: prev.length + 1 },
    ])
    setPreguntas(prev => ({ ...prev, [_id]: [preguntaVacia()] }))
    setNivelActivo(_id)
  }

  // Duplica un nivel con todas sus preguntas (con IDs locales nuevos)
  function duplicarNivel(nivelOriginal) {
    const _id = Math.random().toString(36).slice(2)
    const copia = {
      ...nivelOriginal,
      _id,
      name: `${nivelOriginal.name} (copia)`,
      sort_order: niveles.length + 1,
    }
    setNiveles(prev => [...prev, copia])
    const pregsOriginales = preguntas[nivelOriginal._id] || []
    setPreguntas(prev => ({
      ...prev,
      [_id]: pregsOriginales.map(p => ({ ...p, _id: Math.random().toString(36).slice(2) })),
    }))
    addToast('success', 'Nivel duplicado con sus preguntas')
  }

  function actualizarNivel(_id, datos) {
    setNiveles(prev => prev.map(n => n._id === _id ? { ...n, ...datos } : n))
  }

  // No permite eliminar el único nivel restante
  function eliminarNivel(_id) {
    if (niveles.length === 1) return
    setNiveles(prev => prev.filter(n => n._id !== _id))
    setPreguntas(prev => { const copy = { ...prev }; delete copy[_id]; return copy })
    const siguiente = niveles.find(n => n._id !== _id)?._id
    if (siguiente) setNivelActivo(siguiente)
  }

  // Agrega una pregunta vacía al nivel activo
  function agregarPregunta(moduloInicial = '') {
    const nueva = { ...preguntaVacia(), area: moduloInicial }
    setPreguntas(prev => ({
      ...prev,
      [nivelActivo]: [...(prev[nivelActivo] || []), nueva],
    }))
    setPregExpandida(nueva._id)
  }

  function actualizarPregunta(nId, pregId, datos) {
    setPreguntas(prev => ({
      ...prev,
      [nId]: prev[nId].map(p => p._id === pregId ? { ...p, ...datos } : p),
    }))
  }

  function eliminarPregunta(nId, pregId) {
    setPreguntas(prev => ({
      ...prev,
      [nId]: prev[nId].filter(p => p._id !== pregId),
    }))
  }

  // Duplica la pregunta justo después de la original en el mismo nivel
  function duplicarPreguntaMismoNivel(nId, preg) {
    const copia = { ...preg, _id: Math.random().toString(36).slice(2) }
    setPreguntas(prev => {
      const arr = [...(prev[nId] || [])]
      const idx = arr.findIndex(p => p._id === preg._id)
      arr.splice(idx + 1, 0, copia)
      return { ...prev, [nId]: arr }
    })
    addToast('success', 'Pregunta duplicada')
  }

  // Copia la pregunta al final del nivel destino
  function duplicarPreguntaANivel(preg, destinoNivelId) {
    const copia = { ...preg, _id: Math.random().toString(36).slice(2) }
    setPreguntas(prev => ({
      ...prev,
      [destinoNivelId]: [...(prev[destinoNivelId] || []), copia],
    }))
    const nombreDestino = niveles.find(n => n._id === destinoNivelId)?.name || 'otro nivel'
    addToast('success', `Pregunta duplicada al nivel "${nombreDestino}"`)
  }

  return {
    niveles, setNiveles,
    nivelActivo, setNivelActivo,
    preguntas, setPreguntas,
    pregExpandida, setPregExpandida,
    moduloActivo, setModuloActivo,
    agregarNivel,
    duplicarNivel,
    actualizarNivel,
    eliminarNivel,
    agregarPregunta,
    actualizarPregunta,
    eliminarPregunta,
    duplicarPreguntaMismoNivel,
    duplicarPreguntaANivel,
  }
}
