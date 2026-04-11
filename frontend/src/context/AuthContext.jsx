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
        const payload = {
          id: authUser.id,
          full_name:
            authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email ||
            '',
          role: 'estudiante',
        }

        const { error: insertError } = await supabase
          .from('users')
          .insert(payload)

        if (insertError) {
          console.warn('[Auth] No se pudo crear usuario en tabla users:', insertError.message)
        } else {
          console.log('[Auth] Usuario creado en tabla users')
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

  const buildFullUser = async (authUser) => {
    if (!authUser) return null

    await ensureUserExists(authUser)
    const role = await fetchUserRole(authUser.id)

    return {
      ...authUser,
      role,
    }
  }

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    if (data?.user) {
      const fullUser = await buildFullUser(data.user)
      setUser(fullUser)
      return fullUser
    }

    return data
  }

  const loginWithGoogle = async () => {
    const redirectTo = `${window.location.origin}/dashboard`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
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

    if (data.user) {
      await ensureUserExists({
        ...data.user,
        user_metadata: {
          ...data.user.user_metadata,
          full_name: fullName,
        },
      })
    }

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
    let isMounted = true

    console.log('[Auth] iniciando AuthContext')

    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('[Auth] safety timeout — forzando loading false')
        setLoading(false)
      }
    }, 4000)

    const bootstrapSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) throw error

        const session = data?.session ?? null
        console.log('[Auth] getSession:', session?.user?.email ?? 'sin sesión')

        if (!isMounted) return

        if (session?.user) {
          const fullUser = await buildFullUser(session.user)
          if (!isMounted) return
          setUser(fullUser)
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('[Auth] getSession error:', err)
        if (isMounted) {
          setUser(null)
        }
      } finally {
        clearTimeout(safetyTimeout)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    bootstrapSession()

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] evento:', event, '| user:', session?.user?.email ?? 'null')

      if (!isMounted) return

      if (event === 'TOKEN_REFRESHED') {
        console.log('[Auth] TOKEN_REFRESHED — token renovado ok')
        return
      }

      try {
        if (event === 'SIGNED_OUT') {
          console.log('[Auth] SIGNED_OUT — limpiando usuario')
          roleCache.current = {}
          setUser(null)
          return
        }

        if (session?.user) {
          const fullUser = await buildFullUser(session.user)
          if (!isMounted) return
          setUser(fullUser)
        } else {
          setUser(null)
        }
      } catch (err) {
        console.error('[Auth] onAuthStateChange error:', err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
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