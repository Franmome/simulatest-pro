// ia.routes.js
import { Router } from 'express'
import multer from 'multer'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { generarBanco, generarSimulacroPersonal, chatIA, analizarSala, getTokens, verificarOpec, getAdminUsers, analizarResultadosSimulacro, testGenerador, generarPaqueteConIA, generarPracticaDesdeIA, analizarPerfilCV, masOpecs, listConvocatorias, getCiudadesConvocatoria, createConvocatoria, updateConvocatoria, deleteConvocatoria, listProcuraduriaOpecs, createProcuraduriaOpec, updateProcuraduriaOpec, deleteProcuraduriaOpec, deleteOpecsMasivo, statsProcuraduriaOpecs, importOpecMaestro, getMisAnalisis, updateMiAnalisis, deleteMiAnalisis, getMisAnalisisSimulacros, generarModoPractica, cerebrosHealth } from '../controllers/ia.controller.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const uploadPerfil = multer({ storage: multer.memoryStorage() }) // sin límite de tamaño

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
router.post('/analisis-perfil',    authMiddleware, uploadPerfil.single('pdf'), analizarPerfilCV)
router.post('/mas-opecs',          authMiddleware, masOpecs)
router.get('/mis-analisis',            authMiddleware, getMisAnalisis)
router.patch('/mis-analisis/:id',     authMiddleware, updateMiAnalisis)
router.delete('/mis-analisis/:id',    authMiddleware, deleteMiAnalisis)
router.get('/mis-analisis-simulacros', authMiddleware, getMisAnalisisSimulacros)

// ── Convocatorias (catálogo para dropdown del usuario y admin) ───────────────
router.get('/convocatorias',             authMiddleware, listConvocatorias)
router.get('/convocatorias/:id/ciudades', authMiddleware, getCiudadesConvocatoria)
router.post('/convocatorias',            authMiddleware, createConvocatoria)
router.put('/convocatorias/:id',         authMiddleware, updateConvocatoria)
router.delete('/convocatorias/:id',      authMiddleware, deleteConvocatoria)

// ── OPECs maestro (admin CRUD + importación masiva) ──────────────────────────
router.get('/procuraduria-opecs/stats',  authMiddleware, statsProcuraduriaOpecs)
router.get('/procuraduria-opecs',        authMiddleware, listProcuraduriaOpecs)
router.post('/procuraduria-opecs',       authMiddleware, createProcuraduriaOpec)
router.put('/procuraduria-opecs/:id',    authMiddleware, updateProcuraduriaOpec)
router.delete('/procuraduria-opecs/:id', authMiddleware, deleteProcuraduriaOpec)
router.delete('/procuraduria-opecs',     authMiddleware, deleteOpecsMasivo)
router.post('/opec-maestro/import',      authMiddleware, importOpecMaestro)
router.post('/modo-practica',            authMiddleware, generarModoPractica)
router.get('/cerebros-health',           authMiddleware, cerebrosHealth)

export default router
