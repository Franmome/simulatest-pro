import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { crearReporte, listarReportes, marcarResuelto } from '../controllers/reportes.controller.js'

const router = Router()

router.post('/error',         authMiddleware, crearReporte)
router.get('/admin',          authMiddleware, listarReportes)
router.patch('/admin/:id',    authMiddleware, marcarResuelto)

export default router
