// gemini.js
// Cliente del backend IA (Gemini / DeepSeek) para el frontend.
// modelo: 'gemini' | 'deepseek' — se pasa al backend que decide el proveedor.

import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

// POST /api/ia/chat
export async function chatPraxia({ mensaje, contexto_evaluacion, historial = [], modelo = 'gemini' }) {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/ia/chat`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje, contexto_evaluacion, historial, modelo }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error en el asistente IA.')
  return json.respuesta
}

// POST /api/ia/simulacro — genera simulacro personal por OPEC
export async function generarSimulacroPersonal({ evaluacion_id, cargo, pdf, modelo = 'gemini' }) {
  const headers = await authHeaders()
  const fd = new FormData()
  if (pdf) fd.append('pdf', pdf)
  if (evaluacion_id) fd.append('evaluacion_id', String(evaluacion_id))
  if (cargo) fd.append('cargo', cargo)
  fd.append('modelo', modelo)

  const res = await fetch(`${BASE}/api/ia/simulacro`, {
    method: 'POST',
    headers,
    body: fd,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error generando el simulacro.')
  return json
}

// POST /api/ia/sala — análisis de resultados de sala (sin restricción de plan)
export async function analizarSala({ participantes, total, modelo = 'gemini' }) {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/ia/sala`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ participantes, total, modelo }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error generando análisis.')
  return json.analisis
}

// POST /api/ia/generar (multipart con PDF opcional)
export async function generarBancoDesdeIA({ pdf, evaluacion_id, nivel_id, cargo, modelo = 'gemini' }) {
  const headers = await authHeaders()
  const fd = new FormData()
  if (pdf) fd.append('pdf', pdf)
  if (evaluacion_id) fd.append('evaluacion_id', evaluacion_id)
  if (nivel_id) fd.append('nivel_id', nivel_id)
  if (cargo) fd.append('cargo', cargo)
  fd.append('modelo', modelo)

  const res = await fetch(`${BASE}/api/ia/generar`, {
    method: 'POST',
    headers,
    body: fd,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error generando banco de preguntas.')
  return json
}
