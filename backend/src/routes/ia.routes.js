// ia.routes.js
import { Router } from 'express'
import multer from 'multer'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
import { generarBanco, generarSimulacroPersonal, chatIA, analizarSala, getTokens, verificarOpec, getAdminUsers, analizarResultadosSimulacro, testGenerador, generarPaqueteConIA, generarPracticaDesdeIA, analizarPerfilCV, progresoAnalisis, masOpecs, listConvocatorias, getCiudadesConvocatoria, createConvocatoria, updateConvocatoria, deleteConvocatoria, listProcuraduriaOpecs, createProcuraduriaOpec, updateProcuraduriaOpec, deleteProcuraduriaOpec, deleteOpecsMasivo, statsProcuraduriaOpecs, importOpecMaestro, getMisAnalisis, updateMiAnalisis, deleteMiAnalisis, getMisAnalisisSimulacros, generarModoPractica, cerebrosHealth, getTicketBalance, generateWompiTicketCheckout, getAdminTickets, adminAddTickets, getPrecioTicket, setPrecioTicket, analizarOfertaTrabajo, getOfertaTicketBalance, generateWompiOfertaCheckout, getAdminOfertaTickets, adminAddOfertaTickets, getPrecioOfertaTicket, setPrecioOfertaTicket, getPromptOferta, setPromptOferta, getMisAnalisisOfertas, buscarOpecsOferta } from '../controllers/ia.controller.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })
const uploadPerfil  = multer({ storage: multer.memoryStorage() }) // sin límite de tamaño
const uploadOferta  = multer({ storage: multer.memoryStorage() }) // cv + hasta 5 ofertas, sin límite

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
router.post('/analisis-perfil',               authMiddleware, uploadPerfil.single('pdf'), analizarPerfilCV)
router.get('/analisis-perfil/progreso/:jobId', progresoAnalisis) // SSE — sin auth (jobId es el token)
router.post('/mas-opecs',                     authMiddleware, masOpecs)
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
router.get('/modo-practica/:id/status',  authMiddleware, async (req, res) => {
  const { data } = await supabase
    .from('user_simulacros')
    .select('id, status, cantidad_preguntas')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single()
  res.json(data || { status: 'error' })
})
router.get('/cerebros-health',           authMiddleware, cerebrosHealth)

// ── Tickets de análisis de perfil ─────────────────────────────────────────────
router.get('/tickets/balance',           authMiddleware, getTicketBalance)
router.post('/tickets/checkout',         authMiddleware, generateWompiTicketCheckout)
router.get('/admin/tickets',             authMiddleware, getAdminTickets)
router.post('/admin/tickets/add',        authMiddleware, adminAddTickets)
router.get('/tickets/precio',            authMiddleware, getPrecioTicket)
router.post('/admin/tickets/precio',     authMiddleware, setPrecioTicket)

// ── Análisis de oferta de trabajo ─────────────────────────────────────────────
router.post('/analisis-oferta',               authMiddleware, uploadOferta.fields([{ name: 'cv', maxCount: 1 }, { name: 'ofertas', maxCount: 5 }]), analizarOfertaTrabajo)
router.get('/analisis-oferta/progreso/:jobId', progresoAnalisis) // SSE — reutiliza jobEmitters (sin auth, jobId es el token)
router.get('/oferta/tickets/balance',         authMiddleware, getOfertaTicketBalance)
router.post('/oferta/tickets/checkout',       authMiddleware, generateWompiOfertaCheckout)
router.get('/oferta/tickets/precio',          authMiddleware, getPrecioOfertaTicket)
router.get('/admin/oferta/tickets',           authMiddleware, getAdminOfertaTickets)
router.post('/admin/oferta/tickets/add',      authMiddleware, adminAddOfertaTickets)
router.post('/admin/oferta/tickets/precio',   authMiddleware, setPrecioOfertaTicket)
router.get('/admin/oferta/prompt',            authMiddleware, getPromptOferta)
router.post('/admin/oferta/prompt',           authMiddleware, setPromptOferta)
router.get('/mis-analisis-oferta',            authMiddleware, getMisAnalisisOfertas)
router.get('/oferta/buscar-opecs',            authMiddleware, buscarOpecsOferta)

export default router
