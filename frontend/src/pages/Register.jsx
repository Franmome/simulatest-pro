import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config'

export default function Register() {
  const navigate = useNavigate()
  // Traemos register y registerWithGoogle del contexto global
  const { register, registerWithGoogle } = useAuth()

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    tipo: 'Estudiante'
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      const fullName = `${form.nombre} ${form.apellido}`.trim()
      await register(form.email, form.password, fullName)

      setLoading(false)
      setSuccess('¡Cuenta creada con éxito! Ya puedes iniciar sesión.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.message || 'Error al registrarse. Intenta con otro email.')
      setLoading(false)
    }
  }

  const handleGoogleRegister = async () => {
    try {
      await registerWithGoogle?.() || loginWithGoogle?.()
      // Si el contexto no tiene registerWithGoogle, usamos loginWithGoogle (mismo efecto OAuth)
    } catch (err) {
      setError(err.message || 'Error al registrarse con Google')
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col animate-fade-in">
      {/* Decorativo de fondo */}
      <div className="fixed top-[-10%] left-[-10%] w-64 h-64 bg-primary-fixed/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Botón "Volver al inicio" */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:shadow-md transition-all text-primary font-medium text-sm"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Volver al inicio
        </button>
      </div>

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12">
        {/* Marca / Logo */}
        <div className="w-full max-w-md text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-container rounded-2xl mb-4 shadow-lg">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {APP.icon}
            </span>
          </div>
          <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-primary mb-1">
            {APP.name}
          </h1>
          <p className="text-on-surface-variant text-sm">
            Crea tu cuenta y comienza a prepararte
          </p>
        </div>

        {/* Tarjeta del formulario */}
        <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-3xl shadow-[0_20px_40px_rgba(25,28,29,0.04)]">
          <h2 className="font-headline font-bold text-xl text-on-surface mb-6">
            Crear cuenta
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-error-container text-error rounded-xl text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-secondary-container text-on-secondary-fixed-variant rounded-xl text-sm font-semibold">
              {success}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleRegister}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 px-1">
                  Nombre
                </label>
                <input
                  className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="Carlos"
                  value={form.nombre}
                  onChange={e => setForm({ ...form, nombre: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 px-1">
                  Apellido
                </label>
                <input
                  className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20 text-sm"
                  placeholder="Pérez"
                  value={form.apellido}
                  onChange={e => setForm({ ...form, apellido: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 px-1">
                Correo electrónico
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-outline">
                  <span className="material-symbols-outlined text-xl">mail</span>
                </span>
                <input
                  type="email"
                  className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20"
                  placeholder="nombre@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 px-1">
                Contraseña
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-4 flex items-center text-outline">
                  <span className="material-symbols-outlined text-xl">lock</span>
                </span>
                <input
                  type="password"
                  className="w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 px-1">
                Tipo de usuario
              </label>
              <select
                className="w-full px-4 py-3.5 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary/20 text-sm"
                value={form.tipo}
                onChange={e => setForm({ ...form, tipo: e.target.value })}
              >
                <option>Estudiante</option>
                <option>Trabajador / Profesional</option>
                <option>Aspirante a cargo público</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </span>
              ) : (
                'Crear cuenta gratis'
              )}
            </button>

            <p className="text-center text-xs text-on-surface-variant">
              Al registrarte aceptas nuestros{' '}
              <a className="text-primary font-semibold cursor-pointer hover:underline">Términos</a>{' '}
              y{' '}
              <a className="text-primary font-semibold cursor-pointer hover:underline">Política de privacidad</a>
            </p>
          </form>

          {/* Separador y registro con Google */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-surface-container-highest" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-surface-container-lowest text-outline font-medium">
                O regístrate con
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleGoogleRegister}
              className="flex items-center justify-center gap-3 py-3.5 px-8 bg-surface-container-low hover:bg-surface-container-high rounded-2xl transition-colors active:scale-95 duration-150 w-full max-w-xs"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              <span className="text-sm font-semibold text-on-surface">Continuar con Google</span>
            </button>
          </div>
        </div>

        {/* Link a login */}
        <p className="mt-6 text-on-surface-variant text-sm">
          ¿Ya tienes cuenta?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-primary font-bold hover:underline"
          >
            Inicia sesión
          </button>
        </p>
      </main>
    </div>
  )
}