import 'dotenv/config'
import express  from 'express'
import cors     from 'cors'

import authRoutes        from './routes/auth.routes.js'
import evaluacionRoutes  from './routes/evaluacion.routes.js'
import paqueteRoutes     from './routes/paquete.routes.js'
import usuarioRoutes     from './routes/usuario.routes.js'
import wompiRoutes       from './routes/wompi.routes.js'   // ✅ Agregado

const app  = express()
const PORT = process.env.PORT || 3000

// ─── Middlewares globales ──────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }))
app.use(express.json())

// ─── Rutas ────────────────────────────────────────────────
app.use('/api/auth',        authRoutes)
app.use('/api/evaluaciones', evaluacionRoutes)
app.use('/api/paquetes',    paqueteRoutes)
app.use('/api/usuarios',    usuarioRoutes)
app.use('/api/wompi',       wompiRoutes)   // ✅ Agregado

// ─── Health check ─────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', app: 'SimulaTest Pro API', version: '0.1.0' })
})

// ─── Manejo de errores global ─────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message || 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 SimulaTest Pro API corriendo en http://localhost:${PORT}\n`)
})