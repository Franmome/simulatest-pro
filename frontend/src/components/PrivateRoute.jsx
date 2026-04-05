import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth()

  // Mientras carga la sesión — spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  // Sin usuario — va al login
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Si requiere admin y no es admin — va al dashboard
  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}