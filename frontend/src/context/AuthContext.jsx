import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    if (error) return 'estudiante'
    return data?.role ?? 'estudiante'
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      const role = await fetchUserRole(data.user.id)
      const fullUser = { ...data.user, role }
      setUser(fullUser)
      return fullUser
    }
    return data
  }

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `https://simulatest-pro-production.up.railway.app/dashboard` }
    })
    if (error) throw error
  }

  const register = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw error
    if (!data.user) throw new Error('El correo ya está registrado.')
    return data
  }

  const logout = useCallback(async () => {
    setUser(null)
    await supabase.auth.signOut()
  }, [])

  useEffect(() => {
    // Timeout de seguridad: si getSession tarda más de 5s, no bloquear la app
    const timeout = setTimeout(() => setLoading(false), 5000)

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        clearTimeout(timeout)
        if (session?.user) {
          const role = await fetchUserRole(session.user.id)
          setUser({ ...session.user, role })
        } else {
          setUser(null)
        }
        setLoading(false)
      })
      .catch(() => {
        clearTimeout(timeout)
        setUser(null)
        setLoading(false)
      })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // ✅ INITIAL_SESSION restaura la sesión al recargar — NO ignorar
        if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            const role = await fetchUserRole(session.user.id)
            setUser({ ...session.user, role })
          } else {
            setUser(null)
          }
          setLoading(false)
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          const role = await fetchUserRole(session.user.id)
          setUser({ ...session.user, role })
        } else {
          setUser(null)
        }
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(timeout)
      listener?.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-on-surface-variant font-medium text-sm">Cargando...</p>
        </div>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}