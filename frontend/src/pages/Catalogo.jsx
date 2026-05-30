import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const BASE_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

const HERRAMIENTAS = [
  { id: 'simulacros', nombre: 'Simulacros + Práctica', icon: 'quiz',         ruta: () => '/dashboard' },
  { id: 'cuaderno',   nombre: 'Cuaderno IA',           icon: 'auto_stories', ruta: (pkgId) => `/cuaderno/${pkgId}` },
  { id: 'salas',      nombre: 'Salas Competitivas',    icon: 'groups',       ruta: () => '/salas' },
]

function fmt(n) {
  if (n === null || n === undefined) return '—'
  return `$${Number(n).toLocaleString('es-CO')}`
}

function fmtFecha(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function precioDesde(pkg) {
  const h = pkg.herramientas || {}
  let min = Infinity
  HERRAMIENTAS.forEach(({ id }) => {
    const cfg = h[id]
    if (cfg?.activo) (cfg.planes || []).forEach(p => { if (Number(p.precio) < min) min = Number(p.precio) })
  })
  const pcCfg = h.paquete_completo
  if (pcCfg?.activo) (pcCfg.planes || []).forEach(p => { if (Number(p.precio) < min) min = Number(p.precio) })
  return min === Infinity ? null : min
}

function herramientasActivasDe(pkg) {
  const h = pkg.herramientas || {}
  return HERRAMIENTAS.filter(({ id }) => h[id]?.activo)
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-1.5 bg-surface-container-high" />
      <div className="p-6 space-y-4">
        <div className="h-5 bg-surface-container-high rounded w-2/3" />
        <div className="h-4 bg-surface-container-high rounded w-full" />
        <div className="flex gap-2 mt-2">
          <div className="h-6 bg-surface-container-high rounded-full w-20" />
          <div className="h-6 bg-surface-container-high rounded-full w-24" />
        </div>
        <div className="flex justify-between items-end mt-4">
          <div className="h-6 bg-surface-container-high rounded w-24" />
          <div className="h-8 bg-surface-container-high rounded-full w-28" />
        </div>
      </div>
    </div>
  )
}

// ── Modal de planes ──────────────────────────────────────────────────────────
function ModalPlanes({ pkg, convNombre, toolAccess, esAdmin, onClose, onComprar, comprando, user, navigate }) {
  const h      = pkg.herramientas || {}
  const activas = HERRAMIENTAS.filter(({ id }) => h[id]?.activo)
  const pcCfg   = h.paquete_completo

  function BtnComprar({ pkgId, herramientaId, planId }) {
    const enCurso = comprando?.pkgId === pkgId && comprando?.herramientaId === herramientaId && comprando?.planId === planId
    if (!user) return (
      <button onClick={() => navigate('/login')}
        className="px-4 py-2 rounded-full border border-primary text-primary text-xs font-bold hover:bg-primary/5 transition-colors">
        Iniciar sesión
      </button>
    )
    return (
      <button
        onClick={() => onComprar(pkgId, herramientaId, planId)}
        disabled={!!comprando}
        className="px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
      >
        {enCurso ? '…' : 'Comprar'}
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-surface-container-lowest w-full md:max-w-lg md:rounded-3xl max-h-[95vh] overflow-y-auto shadow-2xl rounded-t-3xl flex flex-col">

        {/* Header */}
        <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant/15 px-5 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div>
            <h2 className="font-extrabold text-lg text-on-surface">{pkg.name}</h2>
            {convNombre && <p className="text-xs text-on-surface-variant mt-0.5">{convNombre}</p>}
          </div>
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Sin planes configurados */}
          {!pcCfg?.activo && activas.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/30">build_circle</span>
              <p className="font-bold text-on-surface-variant">Este paquete aún no tiene planes de precio configurados.</p>
              <p className="text-xs text-on-surface-variant">Pronto estará disponible. Contáctanos si tienes dudas.</p>
            </div>
          )}

          {/* Paquete completo */}
          {pcCfg?.activo && (pcCfg.planes || []).length > 0 && (
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
              <div className="px-4 py-3 bg-primary/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                <p className="font-extrabold text-primary text-sm">Paquete Completo</p>
                <span className="ml-auto text-[9px] font-black bg-primary text-on-primary px-2 py-0.5 rounded-full uppercase tracking-wide">Mejor valor</span>
              </div>
              <div className="p-4 space-y-0">
                <p className="text-xs text-on-surface-variant mb-3">Acceso a todas las herramientas incluidas</p>
                {pcCfg.planes.map(plan => (
                  <div key={plan.id} className="flex items-center justify-between gap-3 py-3 border-b border-primary/10 last:border-0">
                    <div>
                      <p className="font-bold text-sm text-on-surface">{plan.label}</p>
                      <p className="text-xs text-on-surface-variant">{plan.dias} días de acceso</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-primary">{fmt(plan.precio)} <span className="text-[10px] font-normal text-on-surface-variant">COP</span></span>
                      <BtnComprar pkgId={pkg.id} herramientaId="paquete_completo" planId={plan.id} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Herramientas individuales */}
          {activas.map(hDef => {
            const cfg      = h[hDef.id]
            const accessKey = `${pkg.id}:${hDef.id}`
            const endDate  = toolAccess.get(accessKey)
            const tieneAcceso = esAdmin || !!endDate
            const planes   = cfg.planes || []

            return (
              <div key={hDef.id} className="rounded-2xl border border-outline-variant/20 overflow-hidden">
                <div className="px-4 py-3 bg-surface-container flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{hDef.icon}</span>
                  <p className="font-bold text-sm text-on-surface">{hDef.nombre}</p>
                  {tieneAcceso && (
                    <span className="ml-auto text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                      {esAdmin ? 'Admin' : `Activo · vence ${fmtFecha(endDate)}`}
                    </span>
                  )}
                </div>

                {tieneAcceso ? (
                  <div className="px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      <p className="text-xs text-on-surface-variant">Ya tienes acceso.</p>
                    </div>
                    <button
                      onClick={() => { onClose(); navigate(hDef.ruta(pkg.id)) }}
                      className="flex items-center gap-1 px-4 py-2 rounded-full bg-primary text-on-primary text-xs font-bold hover:opacity-90 transition-opacity shrink-0"
                    >
                      Ir a {hDef.nombre.split(' ')[0]}
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </button>
                  </div>
                ) : planes.length === 0 ? (
                  <div className="px-4 py-3">
                    <p className="text-xs text-on-surface-variant italic">Sin planes disponibles aún.</p>
                  </div>
                ) : (
                  <div className="p-4 space-y-0">
                    {planes.map(plan => (
                      <div key={plan.id} className="flex items-center justify-between gap-3 py-3 border-b border-outline-variant/10 last:border-0">
                        <div>
                          <p className="font-bold text-sm text-on-surface">{plan.label}</p>
                          <p className="text-xs text-on-surface-variant">{plan.dias} días de acceso</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-extrabold text-on-surface">{fmt(plan.precio)} <span className="text-[10px] font-normal text-on-surface-variant">COP</span></span>
                          <BtnComprar pkgId={pkg.id} herramientaId={hDef.id} planId={plan.id} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Trust pills */}
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            {[
              { icon: 'lock', label: 'Pago cifrado SSL' },
              { icon: 'verified_user', label: 'Wompi certificado' },
              { icon: 'support_agent', label: 'Soporte 24h' },
            ].map(b => (
              <span key={b.label} className="flex items-center gap-1 text-[10px] text-on-surface-variant font-semibold">
                <span className="material-symbols-outlined text-sm">{b.icon}</span>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function Catalogo() {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const [busqueda,  setBusqueda]  = useState('')
  const [modalPkg,  setModalPkg]  = useState(null)
  const [comprando, setComprando] = useState(null) // { pkgId, herramientaId, planId }

  // Cargar widget Wompi
  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.wompi.co/widget.js"]')) return
    const s   = document.createElement('script')
    s.src     = 'https://checkout.wompi.co/widget.js'
    s.async   = true
    document.body.appendChild(s)
    return () => { try { document.body.removeChild(s) } catch {} }
  }, [])

  const { data, loading, error, retry } = useFetch(async () => {
    const [{ data: pkgs, error: errPkgs }, { data: convs }] = await Promise.all([
      supabase.from('packages').select('*').eq('is_active', true).order('created_at'),
      supabase.from('convocatorias').select('id, nombre'),
    ])
    if (errPkgs) throw new Error(errPkgs.message)

    const esAdmin  = user?.role === 'admin'
    let toolAccess = new Map()

    if (user?.id && !esAdmin) {
      const [{ data: toolPurchases }, { data: legacyPurchases }] = await Promise.all([
        supabase.from('user_tool_purchases')
          .select('package_id, herramienta_id, end_date')
          .eq('user_id', user.id)
          .gte('end_date', new Date().toISOString()),
        supabase.from('purchases')
          .select('package_id, end_date')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString()),
      ])

      ;(toolPurchases || []).forEach(tp => {
        toolAccess.set(`${tp.package_id}:${tp.herramienta_id}`, tp.end_date)
      })

      // Legado: purchase del paquete completo → acceso a todas las herramientas
      ;(legacyPurchases || []).forEach(lp => {
        HERRAMIENTAS.forEach(({ id }) => {
          const key = `${lp.package_id}:${id}`
          if (!toolAccess.has(key)) toolAccess.set(key, lp.end_date)
        })
      })
    }

    return { paquetes: pkgs || [], convocatorias: convs || [], toolAccess, esAdmin }
  }, ['catalogo-v2', user?.id])

  const paquetes      = data?.paquetes      ?? []
  const convocatorias = data?.convocatorias ?? []
  const toolAccess    = data?.toolAccess    ?? new Map()
  const esAdmin       = data?.esAdmin       ?? false

  const lista = paquetes.filter(p =>
    !busqueda.trim() ||
    p.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.description?.toLowerCase().includes(busqueda.toLowerCase())
  )

  async function comprar(packageId, herramientaId, planId) {
    if (!user) { navigate('/login'); return }
    if (comprando) return
    setComprando({ pkgId: packageId, herramientaId, planId })
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesión expirada. Inicia sesión de nuevo.')

      const res  = await fetch(`${BASE_URL}/api/paquetes/comprar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ package_id: packageId, herramienta_id: herramientaId, plan_id: planId }),
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos?.error || 'Error al iniciar el pago.')
      if (!window.WidgetCheckout) throw new Error('Widget de pago no cargado. Recarga la página.')

      const checkout = new window.WidgetCheckout({
        currency:       'COP',
        amountInCents:  datos.amount_in_cents,
        reference:      datos.reference,
        publicKey:      datos.public_key,
        signature:      { integrity: datos.signature },
        customerData:   { email: user.email },
        redirectUrl:    datos.redirect_url,
      })

      setModalPkg(null)
      checkout.open(result => {
        if (result?.transaction?.status === 'APPROVED') retry()
      })
    } catch (e) {
      alert(e.message || 'Error al iniciar el pago.')
    } finally {
      setComprando(null)
    }
  }

  const modalConv = modalPkg ? convocatorias.find(c => c.id === modalPkg.convocatoria_id)?.nombre : null

  return (
    <div className="p-8 pb-20 animate-fade-in">

      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-on-background tracking-tight mb-1">Paquetes</h1>
        <p className="text-on-surface-variant">
          Accede a las herramientas IA para prepararte en convocatorias nacionales.
        </p>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm mb-8">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">search</span>
        <input
          className="w-full bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant"
          placeholder="Buscar paquete..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-error-container text-error rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-semibold flex-1">{error}</p>
          <button onClick={retry} className="text-xs font-bold underline hover:opacity-70">Reintentar</button>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}

        {!loading && lista.length === 0 && !error && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl mb-3 opacity-40">search_off</span>
            <p className="font-semibold">{busqueda ? `Sin resultados para "${busqueda}"` : 'No hay paquetes disponibles'}</p>
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="mt-3 text-primary text-sm font-bold hover:underline">
                Ver todos
              </button>
            )}
          </div>
        )}

        {!loading && lista.map(pkg => {
          const activas     = herramientasActivasDe(pkg)
          const desde       = precioDesde(pkg)
          const convNombre  = convocatorias.find(c => c.id === pkg.convocatoria_id)?.nombre
          const pcActivo    = pkg.herramientas?.paquete_completo?.activo

          // Calcular acceso del usuario a este paquete
          const herramientasConAcceso = esAdmin
            ? activas
            : activas.filter(({ id }) => toolAccess.has(`${pkg.id}:${id}`))
          const tieneAlguno = herramientasConAcceso.length > 0

          return (
            <div key={pkg.id}
              className="card overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col">

              <div className="h-1.5 bg-gradient-to-r from-primary to-primary-container" />

              <div className="p-6 flex flex-col flex-1">

                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-on-surface leading-snug group-hover:text-primary transition-colors">
                      {pkg.name}
                    </h3>
                    {convNombre && (
                      <span className="inline-block mt-1 text-[10px] font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-full">
                        {convNombre}
                      </span>
                    )}
                  </div>
                  {tieneAlguno && (
                    <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                      Activo
                    </span>
                  )}
                </div>

                {pkg.description && (
                  <p className="text-xs text-on-surface-variant line-clamp-2 mb-4 leading-relaxed">{pkg.description}</p>
                )}

                {/* Herramientas */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {activas.length === 0 ? (
                    <span className="text-[10px] text-on-surface-variant italic">Sin herramientas configuradas</span>
                  ) : activas.map(({ id, nombre, icon }) => {
                    const hasAccess = esAdmin || toolAccess.has(`${pkg.id}:${id}`)
                    return (
                      <span key={id}
                        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
                          hasAccess
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-surface-container text-on-surface-variant'
                        }`}>
                        <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
                        {nombre.split(' ')[0]}
                        {hasAccess && <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                      </span>
                    )
                  })}
                  {pcActivo && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded-full">
                      <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                      Paquete completo
                    </span>
                  )}
                </div>

                {/* Footer precio + CTA */}
                <div className="mt-auto pt-4 border-t border-outline-variant/15 flex items-center justify-between gap-2">
                  <div>
                    {desde !== null ? (
                      <>
                        <p className="text-[9px] text-on-surface-variant font-semibold uppercase tracking-wide">Desde</p>
                        <p className="text-lg font-extrabold text-primary leading-tight">{fmt(desde)}</p>
                        <p className="text-[9px] text-on-surface-variant">COP</p>
                      </>
                    ) : (
                      <p className="text-xs text-on-surface-variant italic">Consultar precio</p>
                    )}
                  </div>
                  <button
                    onClick={() => setModalPkg(pkg)}
                    className="bg-primary text-on-primary px-5 py-2.5 rounded-full text-xs font-bold hover:shadow-md hover:shadow-primary/20 transition-all active:scale-95"
                  >
                    Ver planes →
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal planes */}
      {modalPkg && (
        <ModalPlanes
          pkg={modalPkg}
          convNombre={modalConv}
          toolAccess={toolAccess}
          esAdmin={esAdmin}
          onClose={() => setModalPkg(null)}
          onComprar={comprar}
          comprando={comprando}
          user={user}
          navigate={navigate}
        />
      )}
    </div>
  )
}
