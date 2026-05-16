import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import DeployWatcher from './components/DeployWatcher'

// Páginas públicas
import InicioPublico from './pages/InicioPublico'
import Login from './pages/Login'
import Register from './pages/Register'
import Catalogo from './pages/Catalogo'
import DetallePrueba from './pages/DetallePrueba'
import PagoResultado from './pages/PagoResultado'

// Páginas privadas
import Dashboard from './pages/Dashboard'
import Simulacro from './pages/Simulacro'
import SimulacroIA from './pages/SimulacroIA'
import Resultados from './pages/Resultados'
import ResultadoFinal from './pages/ResultadoFinal'
import Suscripciones from './pages/Suscripciones'
import Perfil from './pages/Perfil'
import Estudio from './pages/Estudio'
import Configuracion from './pages/Configuracion'
import ModoPruebas from './pages/ModoPruebas'
import MaterialEstudio from './pages/MaterialEstudio'
import AnalisisPerfil from './pages/AnalisisPerfil'
import Salas from './pages/Salas'
import SalaLobby from './pages/SalaLobby'
import SalaSimulacro from './pages/SalaSimulacro'

// Páginas de administración — se cargan solo cuando el admin entra al panel
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsuarios    = lazy(() => import('./pages/admin/AdminUsuarios'))
const AdminPaquetes    = lazy(() => import('./pages/admin/AdminPaquetes'))
const AdminTesoreria   = lazy(() => import('./pages/admin/AdminTesoreria'))
const AdminEditor      = lazy(() => import('./pages/admin/AdminEditor'))
const AdminErrores     = lazy(() => import('./pages/admin/AdminErrores'))
const AdminIATraining  = lazy(() => import('./pages/admin/AdminIATraining'))
const AdminTokens      = lazy(() => import('./pages/admin/AdminTokens'))
const EvaluacionesList = lazy(() => import('./pages/admin/EvaluacionesList'))
const EvaluacionForm   = lazy(() => import('./pages/admin/EvaluacionForm'))

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-10 h-10 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
      <BrowserRouter>
        <DeployWatcher />
        <Routes>
          {/* 🏠 Ruta pública principal (landing) sin Layout */}
          <Route path="/" element={<InicioPublico />} />

          {/* 🔐 Autenticación */}
          <Route path="/login"    element={<Login />} />
          <Route path="/registro" element={<Register />} />

          {/* 📚 Catálogo público (con Layout compartido) */}
          <Route element={<Layout title="Praxia" />}>
            <Route path="/catalogo"       element={<Catalogo />} />
            <Route path="/prueba/:id"     element={<DetallePrueba />} />
            <Route path="/pago-resultado" element={<PagoResultado />} />
          </Route>

          {/* 🔒 Rutas privadas para usuarios autenticados */}
          <Route element={<PrivateRoute><Layout title="Dashboard" /></PrivateRoute>}>
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/simulacro/:id"      element={<Simulacro />} />
            <Route path="/simulacro-ia/:id"   element={<SimulacroIA />} />
            <Route path="/resultados"      element={<Resultados />} />
            <Route path="/resultado-final" element={<ResultadoFinal />} />
            <Route path="/planes"          element={<Suscripciones />} />
            <Route path="/perfil"          element={<Perfil />} />
            <Route path="/estudio"         element={<Estudio />} />
            <Route path="/configuracion"   element={<Configuracion />} />
            <Route path="/modo-pruebas"    element={<ModoPruebas />} />
            <Route path="/material-estudio" element={<MaterialEstudio />} />
            <Route path="/analisis-perfil"  element={<AnalisisPerfil />} />
            <Route path="/salas"           element={<Salas />} />
            <Route path="/sala/:roomId/lobby" element={<SalaLobby />} />
            <Route path="/sala/:roomId/juego" element={<SalaSimulacro />} />
          </Route>

          {/* 👑 Panel de administración */}
          <Route path="/admin" element={<PrivateRoute requireAdmin><AdminLayout /></PrivateRoute>}>
            <Route index                          element={<Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
            <Route path="evaluaciones"            element={<Suspense fallback={<AdminFallback />}><EvaluacionesList /></Suspense>} />
            <Route path="evaluaciones/nueva"      element={<Suspense fallback={<AdminFallback />}><EvaluacionForm /></Suspense>} />
            <Route path="evaluaciones/:id/editar" element={<Suspense fallback={<AdminFallback />}><EvaluacionForm /></Suspense>} />
            <Route path="usuarios"                element={<Suspense fallback={<AdminFallback />}><AdminUsuarios /></Suspense>} />
            <Route path="paquetes"                element={<Suspense fallback={<AdminFallback />}><AdminPaquetes /></Suspense>} />
            <Route path="tesoreria"               element={<Suspense fallback={<AdminFallback />}><AdminTesoreria /></Suspense>} />
            <Route path="editor"                  element={<Suspense fallback={<AdminFallback />}><AdminEditor /></Suspense>} />
            <Route path="errores"                 element={<Suspense fallback={<AdminFallback />}><AdminErrores /></Suspense>} />
            <Route path="ia-training"             element={<Suspense fallback={<AdminFallback />}><AdminIATraining /></Suspense>} />
            <Route path="tokens"                  element={<Suspense fallback={<AdminFallback />}><AdminTokens /></Suspense>} />
          </Route>

          {/* 🔄 Redirección por defecto (por si acaso) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </NotificationsProvider>
    </AuthProvider>
  )
}