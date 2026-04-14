import { LETRAS } from './constants'

export function preguntaVacia() {
  return {
    _id: Math.random().toString(36).slice(2),
    text: '',
    explanation: '',
    difficulty: 'medio',
    area: '',
    options: LETRAS.map(letter => ({ letter, text: '', is_correct: false })),
  }
}

export function iconoMaterial(type) {
  return { pdf: 'picture_as_pdf', video: 'play_circle', link: 'link', doc: 'description' }[type] || 'attachment'
}

export function parseCSVLine(line) {
  const result = []; let current = ''; let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]; const next = line[i + 1]
    if (char === '"' && inQuotes && next === '"') { current += '"'; i++ }
    else if (char === '"') { inQuotes = !inQuotes }
    else if (char === ',' && !inQuotes) { result.push(current); current = '' }
    else { current += char }
  }
  result.push(current)
  return result.map(v => v.trim())
}

export function buildLabels(modoGuiado) {
  if (!modoGuiado) return {
    versiones: 'Versiones y Precios', profesion: 'Profesión / Cargo',
    nivel: 'Nivel de preguntas', material: 'Material de Estudio',
    version: 'Versión', nivelActivo: 'Nivel activo', banco: 'Banco de preguntas',
    planes: 'Planes de acceso', recursos: 'Recursos de apoyo', modulos: 'Módulos / Áreas',
  }
  return {
    versiones: 'Planes de acceso', profesion: 'Cargo o perfil',
    nivel: 'Banco de preguntas', material: 'Recursos de apoyo',
    version: 'Plan', nivelActivo: 'Banco activo', banco: 'Banco de preguntas',
    planes: 'Planes de acceso', recursos: 'Recursos de apoyo', modulos: 'Módulos',
  }
}
