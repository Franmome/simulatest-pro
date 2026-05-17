// ia.routes.js
import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { generarBanco, generarSimulacroPersonal, chatIA, analizarSala, getTokens, verificarOpec, getAdminUsers, analizarResultadosSimulacro, testGenerador, generarPaqueteConIA, generarPracticaDesdeIA, analizarPerfilCV, listConvocatorias, listProcuraduriaOpecs, createProcuraduriaOpec, updateProcuraduriaOpec, deleteProcuraduriaOpec, statsProcuraduriaOpecs, importOpecMaestro } from '../controllers/ia.controller.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.post('/generar',         authMiddleware, upload.single('pdf'), generarBanco)
router.post('/simulacro',       authMiddleware, upload.single('pdf'), generarSimulacroPersonal)
router.post('/chat',            authMiddleware, chatIA)
router.post('/sala',            authMiddleware, analizarSala)
router.post('/verificar-opec',  authMiddleware, verificarOpec)
router.get('/tokens',           authMiddleware, getTokens)
router.get('/admin-users',      authMiddleware, getAdminUsers)
router.post('/analisis-resultado', authMiddleware, analizarResultadosSimulacro)
router.post('/test-generador',     authMiddleware, upload.single('pdf'), testGenerador)
router.post('/generar-paquete',    authMiddleware, generarPaqueteConIA)
router.post('/practica-desde-ia',  authMiddleware, generarPracticaDesdeIA)
router.post('/analisis-perfil',    authMiddleware, upload.single('pdf'), analizarPerfilCV)

// ── Convocatorias (catálogo para dropdown del usuario) ───────────────────────
router.get('/convocatorias',             authMiddleware, listConvocatorias)

// ── OPECs maestro (admin CRUD + importación masiva) ──────────────────────────
router.get('/procuraduria-opecs/stats',  authMiddleware, statsProcuraduriaOpecs)
router.get('/procuraduria-opecs',        authMiddleware, listProcuraduriaOpecs)
router.post('/procuraduria-opecs',       authMiddleware, createProcuraduriaOpec)
router.put('/procuraduria-opecs/:id',    authMiddleware, updateProcuraduriaOpec)
router.delete('/procuraduria-opecs/:id', authMiddleware, deleteProcuraduriaOpec)
router.post('/opec-maestro/import',      authMiddleware, importOpecMaestro)

export default router
