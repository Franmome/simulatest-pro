import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // ─── ROL DESDE TABLA USERS ───────────────────────────────
  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()
    if (error) return 'estudiante'
    return data?.role ?? 'estudiante'
  }

  // ─── LOGIN EMAIL ─────────────────────────────────────────
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

  // ─── LOGIN GOOGLE ─────────────────────────────────────────
 const loginWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { 
      redirectTo: `https://simulatest-pro-production.up.railway.app/dashboard`
    }
  })
  if (error) throw error
}
  // ─── REGISTRO ─────────────────────────────────────────────
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

  // ─── LOGOUT ROBUSTO ──────────────────────────────────────
  // Limpia el estado ANTES de llamar a Supabase para evitar
  // condiciones de carrera con onAuthStateChange
  const logout = useCallback(async () => {
    setUser(null)                      // 1. limpia estado local inmediatamente
    await supabase.auth.signOut()      // 2. invalida sesión en Supabase
    // El redirect lo hace cada componente con navigate('/login')
  }, [])

  // ─── SESIÓN PERSISTENTE ───────────────────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000)

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
        if (event === 'INITIAL_SESSION') return
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

  // ─── SPINNER INICIAL ──────────────────────────────────────
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