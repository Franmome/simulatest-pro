import { Router } from 'express'
import multer   from 'multer'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {
  chatCuaderno, getHistorial,
  guardarNota, getNotas, eliminarNota, fijarNota,
  generarArtefacto,
  listarFuentes, subirFuente, eliminarFuente,
} from '../controllers/cuaderno.controller.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const router = Router()

// Chat
router.post('/:packageId/chat',                   authMiddleware, chatCuaderno)
router.get('/:packageId/historial',               authMiddleware, getHistorial)

// Notas
router.post('/:packageId/nota',                   authMiddleware, guardarNota)
router.get('/:packageId/notas',                   authMiddleware, getNotas)
router.delete('/:packageId/nota/:notaId',         authMiddleware, eliminarNota)
router.patch('/:packageId/nota/:notaId/fijar',    authMiddleware, fijarNota)

// Generación
router.post('/:packageId/generar',                authMiddleware, generarArtefacto)

// Fuentes
router.get('/:packageId/fuentes',                 authMiddleware, listarFuentes)
router.post('/:packageId/fuentes',                authMiddleware, upload.single('pdf'), subirFuente)
router.delete('/:packageId/fuentes/:fuenteId',    authMiddleware, eliminarFuente)

export default router
