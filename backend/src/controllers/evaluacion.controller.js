// evaluacion.controller.js
export const getEvaluaciones = async (req, res) => {
  // TODO: query a Supabase
  res.json({ evaluaciones: [], message: 'Conectar con Supabase' })
}
export const getEvaluacion     = async (req, res) => res.json({ id: req.params.id })
export const getNiveles         = async (req, res) => res.json({ niveles: [] })
export const getPreguntasPorNivel = async (req, res) => res.json({ preguntas: [] })
export const crearIntento       = async (req, res) => res.status(201).json({ intentoId: 'mock-id' })
export const enviarRespuestas   = async (req, res) => res.json({ procesado: true })
export const getResultado       = async (req, res) => res.json({ puntaje: 87, aprobado: true })
