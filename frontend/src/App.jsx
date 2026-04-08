import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'

import Login from './pages/Login'
import Register from './pages/Register'
import Catalogo from './pages/Catalogo'
import DetallePrueba from './pages/DetallePrueba'
import PagoResultado from './pages/PagoResultado'   // ✅ Import agregado

import Dashboard from './pages/Dashboard'
import Simulacro from './pages/Simulacro'
import Resultados from './pages/Resultados'
import ResultadoFinal from './pages/ResultadoFinal'
import Suscripciones from './pages/Suscripciones'
import Perfil from './pages/Perfil'
import Estudio from './pages/Estudio'
import Configuracion from './pages/Configuracion'
import Salas from './pages/Salas'
import SalaLobby from './pages/SalaLobby'
import SalaSimulacro from './pages/SalaSimulacro'

import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminPaquetes from './pages/admin/AdminPaquetes'
import AdminTesoreria from './pages/admin/AdminTesoreria'
import AdminEditor from './pages/admin/AdminEditor'
import AdminErrores from './pages/admin/AdminErrores'
import EvaluacionesList from './pages/admin/EvaluacionesList'
import EvaluacionForm from './pages/admin/EvaluacionForm'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/registro" element={<Register />} />

          <Route element={<Layout title="SimulaTest Pro" />}>
            <Route path="/" element={<Navigate to="/catalogo" replace />} />
            <Route path="/catalogo"   element={<Catalogo />} />
            <Route path="/prueba/:id" element={<DetallePrueba />} />
            <Route path="/pago-resultado" element={<PagoResultado />} />   {/* ✅ Ruta agregada */}
          </Route>

          <Route element={<PrivateRoute><Layout title="Dashboard" /></PrivateRoute>}>
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/simulacro/:id"   element={<Simulacro />} />
            <Route path="/resultados"      element={<Resultados />} />
            <Route path="/resultado-final" element={<ResultadoFinal />} />
            <Route path="/planes"          element={<Suscripciones />} />
            <Route path="/perfil"          element={<Perfil />} />
            <Route path="/estudio"         element={<Estudio />} />
            <Route path="/configuracion"   element={<Configuracion />} />
            <Route path="/salas"               element={<Salas />} />
            <Route path="/sala/:roomId/lobby"  element={<SalaLobby />} />
            <Route path="/sala/:roomId/juego"  element={<SalaSimulacro />} />
          </Route>

          <Route path="/admin" element={<PrivateRoute requireAdmin><AdminLayout /></PrivateRoute>}>
            <Route index                          element={<AdminDashboard />} />
            <Route path="evaluaciones"            element={<EvaluacionesList />} />
            <Route path="evaluaciones/nueva"      element={<EvaluacionForm />} />
            <Route path="evaluaciones/:id/editar" element={<EvaluacionForm />} />
            <Route path="usuarios"                element={<AdminUsuarios />} />
            <Route path="paquetes"                element={<AdminPaquetes />} />
            <Route path="tesoreria"               element={<AdminTesoreria />} />
            <Route path="editor"                  element={<AdminEditor />} />
            <Route path="errores"                 element={<AdminErrores />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}