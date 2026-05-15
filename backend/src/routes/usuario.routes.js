import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getPerfil, getHistorial, updatePerfil, deleteUsuario } from '../controllers/usuario.controller.js'

const router = Router()
router.get('/perfil',       authMiddleware, getPerfil)
router.get('/historial',    authMiddleware, getHistorial)
router.put('/perfil',       authMiddleware, updatePerfil)
router.delete('/:id',       authMiddleware, deleteUsuario)
export default router
