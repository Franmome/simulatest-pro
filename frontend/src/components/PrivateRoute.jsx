import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function PrivateRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth()

  console.log('[PrivateRoute]', {
    loading,
    user: user?.email || null,
    role: user?.role || null
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user) {
    console.warn('[PrivateRoute] redirigiendo a /login porque no hay user')
    return <Navigate to="/login" replace />
  }

  if (requireAdmin && user.role !== 'admin') {
    console.warn('[PrivateRoute] redirigiendo a /dashboard porque no es admin')
    return <Navigate to="/dashboard" replace />
  }

  return children
}