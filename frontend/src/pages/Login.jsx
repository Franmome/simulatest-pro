import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config'

export default function Login() {
  const navigate = useNavigate()
  // Traemos login normal y login con Google del contexto global
  const { login, loginWithGoogle } = useAuth()

  // Estado del formulario email/contraseña
  const [form, setForm] = useState({ email: '', password: '' })
  // Controla si se muestra u oculta la contraseña
  const [showPass, setShowPass] = useState(false)
  // Mensaje de error si algo falla
  const [error, setError] = useState('')
  // Controla el estado de carga para deshabilitar el botón
  const [loading, setLoading] = useState(false)

  // ─── LOGIN CON EMAIL Y CONTRASEÑA ─────────────────────────
 const handleLogin = async (e) => {
  e.preventDefault()
  setError('')
  setLoading(true)

  try {
    await login(form.email, form.password)
    navigate('/dashboard')
  } catch (err) {
    setError(err.message || 'Credenciales incorrectas')
    setLoading(false)
  }
}


  // ─── LOGIN CON GOOGLE ──────────────────────────────────────
  const handleGoogle = async () => {
    try {
      // Supabase abre el popup de Google y redirige solo a /dashboard
      await loginWithGoogle()
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión con Google')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col animate-fade-in">

      {/* ── Decorativos de fondo (círculos borrosos) ── */}
      <div className="fixed top-[-10%] right-[-10%] w-64 h-64 bg-primary-fixed-dim/20 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="fixed bottom-[-5%] left-[-5%] w-72 h-72 bg-secondary-fixed/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12">

        {/* ── Marca / Logo ── */}
        <div className="w-full max-w-md text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-container rounded-2xl mb-6 shadow-xl shadow-primary/10">
            <span
              className="material-symbols-outlined text-white text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {APP.icon}
            </span>
          </div>
          {/* Nombre de la app — se cambia en utils/app.config.js */}
          <h1 className="font-headline font-extrabold text-3xl tracking-tighter text-primary mb-2">
            {APP.name}
          </h1>
          <p className="text-on-surface-variant text-base">{APP.tagline}</p>
        </div>

        {/* ── Tarjeta del formulario ── */}
        <div className="w-full max-w-md space-y-8">
          <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0_20px_40px_rgba(25,28,29,0.04)]">
            <h2 className="font-headline font-bold text-xl text-on-surface mb-8">
              Bienvenido de nuevo
            </h2>

            {/* ── Mensaje de error visible si algo falla ── */}
            {error && (
              <div className="mb-4 p-3 bg-error-container text-error rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* ── Formulario email + contraseña ── */}
            <form className="space-y-6" onSubmit={handleLogin}>

              {/* Campo email */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant px-1">
                  Correo electrónico
                </label>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-outline group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">mail</span>
                  </span>
                  <input
                    type="email"
                    className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all"
                    placeholder="nombre@ejemplo.com"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Campo contraseña con toggle de visibilidad */}
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-sm font-semibold text-on-surface-variant">Contraseña</label>
                  <a className="text-primary text-xs font-semibold hover:underline cursor-pointer">
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
                <div className="relative group">
                  <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-outline group-focus-within:text-primary transition-colors">
                    <span className="material-symbols-outlined text-xl">lock</span>
                  </span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="w-full pl-11 pr-12 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20 text-on-surface placeholder:text-outline transition-all"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                  />
                  {/* Botón ojo para mostrar/ocultar contraseña */}
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-outline hover:text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Botón principal — se deshabilita mientras carga */}
              <button
                type="submit"
                className="btn-primary w-full py-4 text-center"
                disabled={loading}
              >
                {loading ? 'Iniciando...' : 'Iniciar sesión'}
              </button>
            </form>

            {/* ── Separador "O continúa con" ── */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-surface-container-highest" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-surface-container-lowest text-outline font-medium">
                  O continúa con
                </span>
              </div>
            </div>

            {/* ── Botones OAuth ── */}
            <div className="grid grid-cols-2 gap-4">

              {/* Botón Google — llama a Supabase OAuth con provider google */}
              <button
                onClick={handleGoogle}
                className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-colors active:scale-95 duration-150"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span className="text-sm font-semibold text-on-surface">Google</span>
              </button>

              {/* Botón Apple — pendiente de implementar */}
              <button className="flex items-center justify-center gap-2 py-3 px-4 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-colors active:scale-95 duration-150">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>phone_iphone</span>
                <span className="text-sm font-semibold text-on-surface">Apple</span>
              </button>
            </div>
          </div>

          {/* ── Link para ir a registro ── */}
          <div className="text-center">
            <p className="text-on-surface-variant">
              ¿No tienes cuenta?{' '}
              <button
                onClick={() => navigate('/registro')}
                className="text-primary font-bold hover:underline"
              >
                Regístrate
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* ── Footer con badge de seguridad ── */}
      <footer className="p-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary-container/30 rounded-full">
          <span
            className="material-symbols-outlined text-secondary text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified_user
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-fixed-variant">
            Entorno Académico Seguro
          </span>
        </div>
      </footer>
    </div>
  )
}