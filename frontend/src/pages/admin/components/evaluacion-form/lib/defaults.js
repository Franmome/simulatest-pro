// defaults.js
// Valores iniciales del estado de EvaluacionForm.

import { preguntaVacia } from './helpers'

export const FORM_DEFAULTS = {
  title: '',
  description: '',
  category_id: '',
  is_active: false,
}

export const NUEVO_MAT_DEFAULTS = {
  title: '',
  type: 'pdf',
  source_type: 'upload',
  file: null,
  url: '',
  folder: 'General',
  description: '',
  is_shared: true,
  uploading: false,
  uploadProgress: 0,
}

export const NIVEL_INICIAL = {
  _id: 'n1',
  name: '',
  description: '',
  time_limit: 90,
  passing_score: 70,
  sort_order: 1,
}

export function preguntasIniciales() {
  return { n1: [preguntaVacia()] }
}
