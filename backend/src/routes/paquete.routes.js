import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { getPaquetes, getPaquete, comprarPaquete } from '../controllers/paquete.controller.js'

const router = Router()
router.get('/',         getPaquetes)
router.get('/:id',      getPaquete)
router.post('/comprar', authMiddleware, comprarPaquete)
export default router
