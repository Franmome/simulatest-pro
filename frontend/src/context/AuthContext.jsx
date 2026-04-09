import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [inactivo, setInactivo] = useState(false)
  const timerInactividad = useRef(null)
  const LIMITE = 15 * 60 * 1000 // 15 minutos

  // ─── ROL DESDE TABLA USERS ───────────────────────────────
  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
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
  const logout = useCallback(async () => {
    setUser(null)
    await supabase.auth.signOut()
  }, [])

  // ─── RESET TIMER DE INACTIVIDAD ───────────────────────────
  const resetTimer = useCallback(() => {
    setInactivo(false)
    clearTimeout(timerInactividad.current)
    timerInactividad.current = setTimeout(() => {
      setInactivo(true)
    }, LIMITE)
  }, [])

  // ─── DETECTAR ACTIVIDAD DEL USUARIO ───────────────────────
  useEffect(() => {
    if (!user) return
    const eventos = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart']
    eventos.forEach(e => window.addEventListener(e, resetTimer))
    resetTimer()
    return () => {
      eventos.forEach(e => window.removeEventListener(e, resetTimer))
      clearTimeout(timerInactividad.current)
    }
  }, [user, resetTimer])

  // ─── SESIÓN PERSISTENTE (nueva versión sin timeout ni catch) ──
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      if (session?.user) {
        const role = await fetchUserRole(session.user.id)
        setUser({ ...session.user, role })
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setLoading(false)
          return
        }
        if (event === 'INITIAL_SESSION') return
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
      mounted = false
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

  // ─── MODAL DE INACTIVIDAD ─────────────────────────────────
  if (inactivo) {
    return (
      <div className="fixed inset-0 z-[999] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
          <span className="material-symbols-outlined text-5xl text-error mb-4 block">timer_off</span>
          <h2 className="font-bold text-xl mb-2">Sesión inactiva</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            Tu sesión se cerró por inactividad de 15 minutos.
          </p>
          <button
            onClick={() => { logout(); setInactivo(false) }}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold">
            Ir al login
          </button>
          <button
            onClick={() => { setInactivo(false); resetTimer() }}
            className="w-full py-3 mt-2 border border-outline-variant rounded-xl font-bold text-sm">
            Seguir en la sesión
          </button>
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