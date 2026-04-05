import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {
  getEvaluaciones, getEvaluacion,
  getNiveles, getPreguntasPorNivel,
  crearIntento, enviarRespuestas, getResultado
} from '../controllers/evaluacion.controller.js'

const router = Router()

router.get('/',                        getEvaluaciones)
router.get('/:id',                     getEvaluacion)
router.get('/:id/niveles',             getNiveles)
router.get('/nivel/:nivelId/preguntas', authMiddleware, getPreguntasPorNivel)
router.post('/intento',                authMiddleware, crearIntento)
router.post('/intento/:id/respuestas', authMiddleware, enviarRespuestas)
router.get('/intento/:id/resultado',   authMiddleware, getResultado)

export default router
