import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

export default function PagoResultado() {
  const [params]   = useSearchParams()
  const navigate   = useNavigate()

  const status        = params.get('status')
  const reference     = params.get('reference')     || ''
  const wompiId       = params.get('id')            || ''
  const amountCents   = parseInt(params.get('amount_in_cents') || '0')

  const aprobado = status === 'APPROVED'
  const precio   = amountCents > 0 ? `$${(amountCents / 100).toLocaleString('es-CO')} COP` : null

  const [paqueteNombre, setPaqueteNombre] = useState(null)

  useEffect(() => {
    if (!reference) return
    const partes    = reference.split('-')
    const packageId = parseInt(partes[5])
    if (!packageId || isNaN(packageId)) return

    supabase.from('packages').select('name').eq('id', packageId).maybeSingle()
      .then(({ data }) => { if (data?.name) setPaqueteNombre(data.name) })
  }, [reference])

  const labelStatus = {
    APPROVED: 'Aprobado',
    DECLINED: 'Rechazado',
    ERROR:    'Error',
    PENDING:  'Pendiente',
  }[status] || status

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-surface">
      <div className="card p-10 max-w-md w-full text-center space-y-6 animate-fade-in">

        {/* Icono */}
        <span
          className={`material-symbols-outlined text-7xl block mx-auto ${
            aprobado ? 'text-secondary' : 'text-error'
          }`}
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {aprobado ? 'check_circle' : 'cancel'}
        </span>

        {/* Título */}
        <div>
          <h2 className="font-headline font-extrabold text-2xl mb-1">
            {aprobado ? '¡Pago exitoso!' : 'Pago no completado'}
          </h2>
          <p className="text-on-surface-variant text-sm">
            {aprobado
              ? 'Tu acceso ya está activo. ¡Empieza a prepararte ahora!'
              : 'El pago no fue procesado. Puedes intentarlo nuevamente.'}
          </p>
        </div>

        {/* Detalles de la transacción */}
        <div className="bg-surface-container rounded-2xl p-5 text-left space-y-3 text-sm">
          {paqueteNombre && (
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant font-semibold">Paquete</span>
              <span className="font-bold text-right max-w-[60%]">{paqueteNombre}</span>
            </div>
          )}
          {precio && (
            <div className="flex justify-between items-center">
              <span className="text-on-surface-variant font-semibold">Valor pagado</span>
              <span className={`font-bold ${aprobado ? 'text-secondary' : 'text-error'}`}>{precio}</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-on-surface-variant font-semibold">Estado</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
              aprobado ? 'bg-secondary/10 text-secondary' : 'bg-error/10 text-error'
            }`}>{labelStatus}</span>
          </div>
          {wompiId && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-on-surface-variant font-semibold flex-shrink-0">Referencia</span>
              <span className="font-mono text-xs text-on-surface-variant truncate">{wompiId}</span>
            </div>
          )}
        </div>

        {/* Botones */}
        <div className="space-y-3">
          {aprobado ? (
            <button
              onClick={() => navigate('/estudio')}
              className="btn-primary w-full py-3 rounded-full font-bold"
            >
              Ir a mis simulacros
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/catalogo')}
                className="btn-primary w-full py-3 rounded-full font-bold"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full py-3 rounded-full font-bold text-on-surface-variant text-sm hover:underline"
              >
                Volver al inicio
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}
