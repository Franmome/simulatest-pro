import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import APP from '../utils/app.config'

export default function Register() {
  const navigate = useNavigate()
  // Traemos la función register del contexto global
  const { register } = useAuth()

  // Estado del formulario
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    tipo: 'Estudiante'
  })
  // Mensaje de error si algo falla
  const [error, setError] = useState('')
  // Mensaje de éxito al registrarse
  const [success, setSuccess] = useState('')
  // Controla el estado de carga para deshabilitar el botón
  const [loading, setLoading] = useState(false)

  // ─── REGISTRO ─────────────────────────────────────────────
 const handleRegister = async (e) => {
  e.preventDefault()
  setError('')
  setSuccess('')
  setLoading(true)

  try {
    const fullName = `${form.nombre} ${form.apellido}`.trim()
    await register(form.email, form.password, fullName)

    // Siempre mostramos mensaje de éxito y vamos al login
    // sin importar si Supabase requiere verificación o no
    setLoading(false)
    setSuccess('¡Cuenta creada con éxito! Ya puedes iniciar sesión.')
    setTimeout(() => navigate('/login'), 2000)

  } catch (err) {
    setError(err.message || 'Error al registrarse. Intenta con otro email.')
    setLoading(false)
  }
}

  return (
    <div className="min-h-screen bg-surface flex flex-col animate-fade-in">

      {/* ── Decorativo de fondo ── */}
      <div className="fixed top-[-10%] left-[-10%] w-64 h-64 bg-primary-fixed/20 rounded-full blur-3xl -z-10 pointer-events-none" />

      <main className="flex-grow flex flex-col items-center justify-center px-6 py-12">

        {/* ── Marca / Logo ── */}
        <div className="w-full max-w-md text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-container rounded-2xl mb-4 shadow-lg">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {APP.icon}
            </span>
          </div>
          {/* Nombre de la app — se cambia en utils/app.config.js */}
          <h1 className="font-headline font-extrabold text-2xl tracking-tighter text-primary mb-1">
            {APP.name}
          </h1>
          <p className="text-on-surface-variant text-sm">
            Crea tu cuenta y comienza a prepararte
          </p>
        </div>

        {/* ── Tarjeta del formulario ── */}
        <div className="w-full max-w-md bg-surface-container-lowest p-8 rounded-3xl shadow-[0_20px_40px_rgba(25,28,29,0.04)]">
          <h2 className="font-headline font-bold text-xl text-on-surface mb-6">
            Crear cuenta
          </h2>

          {/* ── Mensaje de error ── */}
          {error && (
            <div className="mb-4 p-3 bg-error-container text-error rounded-xl text-sm">
              {error}
            </div>
          )}

          {/* ── Mensaje de éxito ── */}
          {success && (
            <div className="mb-4 p-3 bg-secondary-container text-on-secondary-fixed-variant rounded-xl text-sm font-semibold">
              {success}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleRegister}>

            {/* Nombre y apellido en dos columnas */}
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

            {/* Campo email con icono */}
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

            {/* Campo contraseña con icono */}
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

            {/* Selector tipo de usuario */}
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

            {/* Botón submit — deshabilitado mientras carga */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 mt-2 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  {/* Spinner inline mientras registra */}
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando...
                </span>
              ) : (
                'Crear cuenta gratis'
              )}
            </button>

            {/* Términos y política */}
            <p className="text-center text-xs text-on-surface-variant">
              Al registrarte aceptas nuestros{' '}
              <a className="text-primary font-semibold cursor-pointer hover:underline">Términos</a>{' '}
              y{' '}
              <a className="text-primary font-semibold cursor-pointer hover:underline">Política de privacidad</a>
            </p>
          </form>
        </div>

        {/* ── Link para ir al login ── */}
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