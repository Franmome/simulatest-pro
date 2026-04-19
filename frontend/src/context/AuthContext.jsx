import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const roleCache = useRef({})

  const ensureUserExists = async (authUser) => {
    if (!authUser?.id) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle()

      if (error) {
        console.warn('[Auth] ensureUserExists select error:', error.message)
        return
      }

      if (!data) {
        const { error: insertError } = await supabase.from('users').insert({
          id: authUser.id,
          full_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email ||
            '',
          role: 'estudiante',
        })

        if (insertError) {
          console.warn('[Auth] No se pudo crear usuario:', insertError.message)
        } else {
          console.log('[Auth] Usuario creado en users')
        }
      }
    } catch (err) {
      console.warn('[Auth] ensureUserExists exception:', err?.message || err)
    }
  }

  const fetchUserRole = async (userId) => {
    if (!userId) return 'estudiante'
    if (roleCache.current[userId]) return roleCache.current[userId]

    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.warn('[Auth] fetchUserRole error:', error.message)
        return 'estudiante'
      }

      const role = data?.role ?? 'estudiante'
      roleCache.current[userId] = role
      return role
    } catch (err) {
      console.warn('[Auth] fetchUserRole exception:', err?.message || err)
      return 'estudiante'
    }
  }

  const syncUserRoleInBackground = async (authUser, isMountedRef) => {
    if (!authUser?.id) return

    try {
      await ensureUserExists(authUser)
      const role = await fetchUserRole(authUser.id)

      if (!isMountedRef.current) return

      setUser((prev) => {
        if (!prev || prev.id !== authUser.id) return prev
        return { ...prev, role }
      })
    } catch (err) {
      console.warn('[Auth] syncUserRoleInBackground error:', err?.message || err)
    }
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    if (data?.user) {
      const baseUser = { ...data.user, role: 'estudiante' }
      setUser(baseUser)

      const isMountedRef = { current: true }
      syncUserRoleInBackground(data.user, isMountedRef)

      return baseUser
    }

    return data
  }

  const loginWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/dashboard`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  }

  const register = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    })

    if (error) throw error
    if (!data.user) throw new Error('El correo ya está registrado.')

    await ensureUserExists({
      ...data.user,
      user_metadata: {
        ...data.user.user_metadata,
        full_name: fullName,
      },
    })

    return data
  }

  const logout = useCallback(async () => {
    try {
      setUser(null)
      roleCache.current = {}
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[Auth] logout error:', err)
    }
  }, [])

  useEffect(() => {
    const isMountedRef = { current: true }

    console.log('[Auth] iniciando AuthContext')

    const safetyTimeout = setTimeout(() => {
      if (isMountedRef.current) {
        console.warn('[Auth] safety timeout — forzando loading false')
        setLoading(false)
      }
    }, 4000)

    const applySessionUser = (sessionUser) => {
      if (!sessionUser) {
        setUser(null)
        return
      }

      // Setear usuario base inmediatamente para no perder auth en refresh
      setUser((prev) => ({
        ...sessionUser,
        role: prev?.id === sessionUser.id && prev?.role ? prev.role : 'estudiante',
      }))

      // Sincronizar role y fila users en segundo plano
      syncUserRoleInBackground(sessionUser, isMountedRef)
    }

    const bootstrapSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (error) throw error

        const session = data?.session ?? null
        console.log('[Auth] getSession:', session?.user?.email ?? 'sin sesión')

        if (!isMountedRef.current) return

        applySessionUser(session?.user ?? null)
      } catch (err) {
        console.error('[Auth] getSession error:', err)
        console.log('[Auth] bootstrapSession falló:', err)
        if (isMountedRef.current) setUser(null)
      } finally {
        clearTimeout(safetyTimeout)
        if (isMountedRef.current) setLoading(false)
      }
    }

    bootstrapSession()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] evento:', event, '| user:', session?.user?.email ?? 'null')

      if (!isMountedRef.current) return

      if (event === 'SIGNED_OUT') {
        console.log('[Auth] SIGNED_OUT detectado - stack:', new Error().stack)
        roleCache.current = {}
        setUser(null)
        setLoading(false)
        return
      }

      if (event === 'TOKEN_REFRESHED') {
        return
      }

      applySessionUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      isMountedRef.current = false
      clearTimeout(safetyTimeout)
      listener?.subscription?.unsubscribe()
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
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}