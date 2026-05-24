import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function getSaludo() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Buenos días'
  if (h >= 12 && h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

const SERVICIOS = [
  {
    id: 'analisis',
    icon: 'manage_accounts',
    iconBg: 'bg-primary',
    badge: null,
    activo: true,
    titulo: 'Análisis de Perfil',
    subtitulo: 'IA · Disponible',
    subtituloColor: 'text-green-600 dark:text-green-400',
    descripcion:
      'Sube tu hoja de vida y la IA de Praxia la compara con todos los cargos disponibles de la convocatoria pública que elijas. Identifica tu compatibilidad, te recomienda las mejores OPECs según tu formación y experiencia, y te dice exactamente qué ajustar para mejorar tus chances.',
    features: ['Compatibilidad por cargo (OPEC)', 'Brechas y fortalezas', 'Guía de documentos', 'Recomendaciones para tu HV'],
    btnLabel: 'Analizar mi hoja de vida',
    btnIcon: 'person_search',
    ruta: '/analisis-perfil',
    gradient: 'from-primary/10 via-primary/5 to-transparent',
    border: 'border-primary/20',
  },
  {
    id: 'paquete',
    icon: 'school',
    iconBg: 'bg-secondary',
    badge: 'Próximamente',
    activo: false,
    titulo: 'Paquete de Estudio',
    subtitulo: 'Simulacros · Material · Cuaderno IA',
    subtituloColor: 'text-on-surface-variant',
    descripcion:
      'Prepárate con simulacros y pruebas personalizadas según la OPEC que te interesa. Incluye banco de preguntas temático, material de estudio oficial y un Cuaderno IA donde puedes estudiar, hacer preguntas y reforzar conceptos clave con inteligencia artificial.',
    features: ['Simulacros por OPEC y nivel', 'Material de estudio actualizado', 'Cuaderno IA (notebook inteligente)', 'Análisis de resultados'],
    btnLabel: 'Próximamente',
    btnIcon: 'lock',
    ruta: null,
    gradient: 'from-secondary/8 via-secondary/4 to-transparent',
    border: 'border-secondary/15',
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const nombreCompleto =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'estudiante'
  const primerNombre = nombreCompleto.split(' ')[0]
  const iniciales    = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl    = user?.user_metadata?.avatar_url || null

  return (
    <div className="min-h-screen p-4 sm:p-8 pb-24 sm:pb-10 max-w-4xl mx-auto">

      {/* ── Hero saludo ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary-container p-6 sm:p-10 mb-8 shadow-xl shadow-primary/20">
        {/* Círculos decorativos */}
        <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-12 -left-6 w-64 h-64 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">
              {getSaludo()},
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-none mb-3">
              {primerNombre} 👋
            </h1>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-white/80 text-sm">
                <span className="font-extrabold text-white">Praxia</span> · Plataforma de preparación para concursos públicos
              </p>
            </div>
          </div>

          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nombreCompleto}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover ring-4 ring-white/30 flex-shrink-0 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0 ring-4 ring-white/30 shadow-lg">
              <span className="text-white font-extrabold text-2xl sm:text-3xl">{iniciales}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Título de sección ── */}
      <div className="mb-5">
        <h2 className="text-lg font-extrabold text-on-surface">Nuestros servicios</h2>
        <p className="text-sm text-on-surface-variant mt-0.5">Herramientas IA para prepararte para el sector público colombiano</p>
      </div>

      {/* ── Cards de servicios ── */}
      <div className="space-y-4">
        {SERVICIOS.map(srv => (
          <div
            key={srv.id}
            className={`relative rounded-2xl border bg-gradient-to-br ${srv.gradient} ${srv.border} overflow-hidden transition-all ${
              srv.activo ? 'hover:shadow-lg hover:-translate-y-0.5' : 'opacity-80'
            }`}
          >
            {/* Badge próximamente */}
            {srv.badge && (
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-secondary/15 text-secondary border border-secondary/20">
                  {srv.badge}
                </span>
              </div>
            )}

            <div className="p-6 sm:p-8">
              {/* Header card */}
              <div className="flex items-start gap-4 mb-5">
                <div className={`w-14 h-14 rounded-2xl ${srv.iconBg} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                  <span
                    className="material-symbols-outlined text-white text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {srv.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-on-surface leading-tight">{srv.titulo}</h3>
                  <p className={`text-xs font-bold mt-0.5 ${srv.subtituloColor}`}>{srv.subtitulo}</p>
                </div>
              </div>

              {/* Descripción */}
              <p className="text-sm text-on-surface leading-relaxed mb-5">
                {srv.descripcion}
              </p>

              {/* Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                {srv.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span
                      className={`material-symbols-outlined text-sm flex-shrink-0 ${srv.activo ? 'text-primary' : 'text-secondary'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      {srv.activo ? 'check_circle' : 'schedule'}
                    </span>
                    <span className="text-xs text-on-surface font-medium">{f}</span>
                  </div>
                ))}
              </div>

              {/* Botón */}
              {srv.activo ? (
                <button
                  onClick={() => navigate(srv.ruta)}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-bold text-sm hover:bg-primary/90 transition-all shadow-md shadow-primary/20 active:scale-95"
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {srv.btnIcon}
                  </span>
                  {srv.btnLabel}
                </button>
              ) : (
                <button
                  disabled
                  className="flex items-center gap-2 px-6 py-3 bg-surface-container text-on-surface-variant rounded-full font-bold text-sm cursor-not-allowed border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-sm">{srv.btnIcon}</span>
                  {srv.btnLabel}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
