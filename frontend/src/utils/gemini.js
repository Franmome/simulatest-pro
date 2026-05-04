// gemini.js
// Cliente del backend IA (Gemini) para el frontend.
// Todas las llamadas requieren el JWT de Supabase en el header.

import { supabase } from './supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    Authorization: `Bearer ${session?.access_token || ''}`,
  }
}

// POST /api/ia/chat
// { mensaje, contexto_evaluacion, historial }
// → { respuesta }
export async function chatPraxia({ mensaje, contexto_evaluacion, historial = [] }) {
  const headers = await authHeaders()
  const res = await fetch(`${BASE}/api/ia/chat`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ mensaje, contexto_evaluacion, historial }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error en el asistente IA.')
  return json.respuesta
}

// POST /api/ia/simulacro — genera y guarda simulacro personal por OPEC
// → { simulacro_id, total, desde_cache }
export async function generarSimulacroPersonal({ evaluacion_id, cargo, pdf }) {
  const headers = await authHeaders()
  const fd = new FormData()
  if (pdf) fd.append('pdf', pdf)
  if (evaluacion_id) fd.append('evaluacion_id', String(evaluacion_id))
  if (cargo) fd.append('cargo', cargo)

  const res = await fetch(`${BASE}/api/ia/simulacro`, {
    method: 'POST',
    headers,
    body: fd,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error generando el simulacro.')
  return json
}

// POST /api/ia/generar (multipart con PDF opcional)
// FormData: { pdf?: File, evaluacion_id, nivel_id, cargo }
// → { preguntas: [...], cached: boolean }
export async function generarBancoDesdeIA({ pdf, evaluacion_id, nivel_id, cargo }) {
  const headers = await authHeaders()
  const fd = new FormData()
  if (pdf) fd.append('pdf', pdf)
  if (evaluacion_id) fd.append('evaluacion_id', evaluacion_id)
  if (nivel_id) fd.append('nivel_id', nivel_id)
  if (cargo) fd.append('cargo', cargo)

  const res = await fetch(`${BASE}/api/ia/generar`, {
    method: 'POST',
    headers, // NO Content-Type aquí — multer lo infiere del boundary
    body: fd,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'Error generando banco de preguntas.')
  return json
}
