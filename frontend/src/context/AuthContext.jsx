import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // 🔥 cache de roles para evitar llamadas repetidas
  const roleCache = useRef({})

  const fetchUserRole = async (userId) => {
    if (roleCache.current[userId]) {
      return roleCache.current[userId]
    }

    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    const role = error ? 'estudiante' : data?.role ?? 'estudiante'
    roleCache.current[userId] = role

    return role
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
      options: {
        redirectTo: `https://simulatest-pro-production.up.railway.app/dashboard`
      }
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

  // 🔥 MANEJO LIMPIO DE SESIÓN (SIN getSession)
  useEffect(() => {
    let isMounted = true

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          const role = await fetchUserRole(session.user.id)
          if (!isMounted) return

          setUser({ ...session.user, role })
        } else {
          setUser(null)
        }

        setLoading(false)
      }
    )

    return () => {
      isMounted = false
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