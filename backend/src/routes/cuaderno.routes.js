import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { chatCuaderno, getHistorial, guardarNota, getNotas, eliminarNota } from '../controllers/cuaderno.controller.js'

const router = Router()
router.post('/:packageId/chat',            authMiddleware, chatCuaderno)
router.get('/:packageId/historial',        authMiddleware, getHistorial)
router.post('/:packageId/nota',            authMiddleware, guardarNota)
router.get('/:packageId/notas',            authMiddleware, getNotas)
router.delete('/:packageId/nota/:notaId',  authMiddleware, eliminarNota)
export default router
