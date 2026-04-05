import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getPerfil, getHistorial, updatePerfil } from '../controllers/usuario.controller.js'

const router = Router()
router.get('/perfil',    authMiddleware, getPerfil)
router.get('/historial', authMiddleware, getHistorial)
router.put('/perfil',    authMiddleware, updatePerfil)
export default router
