import { Router } from 'express'
import { webhookWompi } from '../controllers/wompi.controller.js'

const router = Router()
router.post('/webhook', webhookWompi)
export default router