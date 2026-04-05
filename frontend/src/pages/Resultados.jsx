import { useNavigate } from 'react-router-dom'
import APP from '../utils/app.config.js'

const areas = [
  { nombre: 'Derecho Público',        pct: 92, color: 'bg-secondary' },
  { nombre: 'Razonamiento Lógico',    pct: 85, color: 'bg-primary' },
  { nombre: 'Gestión Pública',        pct: 78, color: 'bg-tertiary' },
  { nombre: 'Competencias Ciudadanas', pct: 68, color: 'bg-error' },
]

export default function Resultados() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6 py-12 animate-fade-in">

      {/* Fondo decorativo */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-primary-fixed/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-secondary-fixed/20 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md flex flex-col items-center text-center">

        {/* Spinner */}
        <div className="relative mb-12">
          <div className="w-48 h-48 rounded-full border-[6px] border-surface-container-highest" />
          <div className="absolute inset-0 w-48 h-48 rounded-full border-[6px] border-primary border-t-transparent animate-slow-spin" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-primary"
              style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
          </div>
        </div>

        <div className="space-y-6 w-full">
          <h2 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
            Calculando tus resultados...
          </h2>

          <div className="bg-surface-container-low px-8 py-6 rounded-xl space-y-3">
            <p className="text-lg font-medium text-on-surface-variant leading-relaxed">
              Estamos analizando tu desempeño y preparando tu retroalimentación personalizada.
            </p>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-secondary inline-block" />
              <span className="text-xs uppercase tracking-widest text-secondary font-bold">
                Excelente trabajo hoy
              </span>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary rounded-full animate-progress" />
            </div>
            <div className="flex justify-between text-[11px] font-bold uppercase tracking-widest text-outline">
              <span>Procesando respuestas</span>
              <span>Casi listo...</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/resultado-final')}
            className="btn-primary w-full py-4 mt-4"
          >
            Ver mis resultados
          </button>
        </div>
      </div>
    </div>
  )
}
