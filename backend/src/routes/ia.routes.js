// ia.routes.js
import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { generarBanco, generarSimulacroPersonal, chatIA } from '../controllers/ia.controller.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.post('/generar',    authMiddleware, upload.single('pdf'), generarBanco)
router.post('/simulacro',  authMiddleware, upload.single('pdf'), generarSimulacroPersonal)
router.post('/chat',       authMiddleware, chatIA)

export default router
