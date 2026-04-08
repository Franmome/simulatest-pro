import { useSearchParams, useNavigate } from 'react-router-dom'

export default function PagoResultado() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status')
  const aprobado = status === 'approved'

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="card p-10 max-w-md w-full text-center">
        <span className={`material-symbols-outlined text-6xl mb-4 block ${aprobado ? 'text-secondary' : 'text-error'}`}
          style={{ fontVariationSettings: "'FILL' 1" }}>
          {aprobado ? 'check_circle' : 'cancel'}
        </span>
        <h2 className="font-headline font-extrabold text-2xl mb-2">
          {aprobado ? '¡Pago exitoso!' : 'Pago no completado'}
        </h2>
        <p className="text-on-surface-variant text-sm mb-8">
          {aprobado
            ? 'Tu paquete ya está activo. ¡Empieza a practicar ahora!'
            : 'El pago no fue procesado. Puedes intentarlo de nuevo.'}
        </p>
        <button onClick={() => navigate(aprobado ? '/dashboard' : '/suscripciones')}
          className="btn-primary w-full py-3 rounded-full font-bold">
          {aprobado ? 'Ir al Dashboard' : 'Volver a paquetes'}
        </button>
      </div>
    </div>
  )
}