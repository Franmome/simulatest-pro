import { Router } from 'express'
import multer   from 'multer'
import { authMiddleware } from '../middleware/auth.middleware.js'
import {
  chatCuaderno, getHistorial,
  guardarNota, getNotas, eliminarNota, fijarNota,
  generarArtefacto,
  listarFuentes, subirFuente, eliminarFuente, agregarYoutube,
  listarFuentesAdmin, subirFuenteAdmin, eliminarFuenteAdmin, agregarYoutubeAdmin,
  getTokens, audioOverview,
} from '../controllers/cuaderno.controller.js'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png', 'image/jpeg', 'image/webp',
]
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) cb(null, true)
    else cb(new Error(`Tipo de archivo no soportado: ${file.mimetype}`))
  },
})

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
router.post('/:packageId/fuentes/youtube',        authMiddleware, agregarYoutube)

// Tokens
router.get('/:packageId/tokens',                  authMiddleware, getTokens)

// Audio Overview
router.post('/:packageId/audio-overview',         authMiddleware, audioOverview)

// ── Admin: materiales base del cuaderno por paquete ───────────────────────────
router.get('/admin/:packageId/fuentes',            authMiddleware, listarFuentesAdmin)
router.post('/admin/:packageId/fuentes',           authMiddleware, upload.single('pdf'), subirFuenteAdmin)
router.post('/admin/:packageId/fuentes/youtube',   authMiddleware, agregarYoutubeAdmin)
router.delete('/admin/:packageId/fuentes/:fuenteId', authMiddleware, eliminarFuenteAdmin)

export default router
