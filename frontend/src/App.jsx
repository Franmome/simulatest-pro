import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationsProvider } from './context/NotificationsContext'
import { AnalysisProvider } from './context/AnalysisContext'
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
import CuadernoIA from './pages/CuadernoIA'
import Salas from './pages/Salas'
import SalaLobby from './pages/SalaLobby'
import SalaSimulacro from './pages/SalaSimulacro'
import Registros from './pages/Registros'

// Páginas de administración — se cargan solo cuando el admin entra al panel
const AdminDashboard   = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsuarios    = lazy(() => import('./pages/admin/AdminUsuarios'))
const AdminPaquetes    = lazy(() => import('./pages/admin/AdminPaquetes'))
const AdminTesoreria   = lazy(() => import('./pages/admin/AdminTesoreria'))
const AdminEditor      = lazy(() => import('./pages/admin/AdminEditor'))
const AdminErrores     = lazy(() => import('./pages/admin/AdminErrores'))
const AdminIATraining  = lazy(() => import('./pages/admin/AdminIATraining'))
const AdminTokens      = lazy(() => import('./pages/admin/AdminTokens'))
const AdminAnalisis    = lazy(() => import('./pages/admin/AdminAnalisis'))

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
      <AnalysisProvider>
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
            <Route path="/catalogo"        element={<Catalogo />} />
            <Route path="/paquete/:pkgId"  element={<DetallePrueba />} />
            <Route path="/prueba/:id"      element={<DetallePrueba />} />
            <Route path="/pago-resultado"  element={<PagoResultado />} />
          </Route>

          {/* 🔒 Rutas privadas para todos los usuarios autenticados */}
          <Route element={<PrivateRoute><Layout title="Dashboard" /></PrivateRoute>}>
            <Route path="/dashboard"        element={<Dashboard />} />
            <Route path="/configuracion"    element={<Configuracion />} />
            <Route path="/analisis-perfil"  element={<AnalisisPerfil />} />
            <Route path="/registros"        element={<Registros />} />
            <Route path="/modo-pruebas"     element={<ModoPruebas />} />
            <Route path="/material-estudio" element={<MaterialEstudio />} />
            <Route path="/salas"            element={<Salas />} />
            <Route path="/sala/:roomId/lobby" element={<SalaLobby />} />
            <Route path="/sala/:roomId/juego" element={<SalaSimulacro />} />
            <Route path="/planes"           element={<Suscripciones />} />
            <Route path="/cuaderno/:packageId" element={<CuadernoIA />} />
            <Route path="/simulacro/:id"      element={<Simulacro />} />
            <Route path="/simulacro-ia/:id"   element={<SimulacroIA />} />
            <Route path="/resultado-final"    element={<ResultadoFinal />} />
          </Route>

          {/* 👑 Rutas privadas solo para administradores */}
          <Route element={<PrivateRoute requireAdmin><Layout title="Dashboard" /></PrivateRoute>}>
            <Route path="/resultados"         element={<Resultados />} />
            <Route path="/perfil"             element={<Perfil />} />
            <Route path="/estudio"            element={<Estudio />} />
          </Route>

          {/* 👑 Panel de administración */}
          <Route path="/admin" element={<PrivateRoute requireAdmin><AdminLayout /></PrivateRoute>}>
            <Route index                          element={<Suspense fallback={<AdminFallback />}><AdminDashboard /></Suspense>} />
            <Route path="evaluaciones/*"           element={<Navigate to="/admin/paquetes" replace />} />
            <Route path="usuarios"                element={<Suspense fallback={<AdminFallback />}><AdminUsuarios /></Suspense>} />
            <Route path="paquetes"                element={<Suspense fallback={<AdminFallback />}><AdminPaquetes /></Suspense>} />
            <Route path="tesoreria"               element={<Suspense fallback={<AdminFallback />}><AdminTesoreria /></Suspense>} />
            <Route path="editor"                  element={<Suspense fallback={<AdminFallback />}><AdminEditor /></Suspense>} />
            <Route path="errores"                 element={<Suspense fallback={<AdminFallback />}><AdminErrores /></Suspense>} />
            <Route path="ia-training"             element={<Suspense fallback={<AdminFallback />}><AdminIATraining /></Suspense>} />
            <Route path="tokens"                  element={<Suspense fallback={<AdminFallback />}><AdminTokens /></Suspense>} />
            <Route path="analisis"                element={<Suspense fallback={<AdminFallback />}><AdminAnalisis /></Suspense>} />
          </Route>

          {/* 🔄 Redirección por defecto (por si acaso) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </AnalysisProvider>
      </NotificationsProvider>
    </AuthProvider>
  )
}