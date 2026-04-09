import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const HERO_DEFAULTS = {
  hero_titulo:      'Invierte en tu futuro profesional.',
  hero_subtitulo:   'Desbloquea las herramientas que usan los candidatos más exitosos. Domina tus exámenes de estado con precisión y confianza.',
  hero_badge:       'Acceso Premium Incluido',
  testimonio:       '"Los simulacros son idénticos al examen real. Totalmente vale la pena."',
  testimonio_autor: '— María G., Puntaje 472',
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function formatPrecio(precio) {
  if (!precio && precio !== 0) return '—'
  return `$${Number(precio).toLocaleString('es-CO')}`
}

function SkeletonPlan() {
  return (
    <div className="card p-6 animate-pulse space-y-4">
      <div className="h-6 bg-surface-container-high rounded w-1/2" />
      <div className="h-8 bg-surface-container-high rounded w-2/3" />
      <div className="space-y-2">
        {[1,2,3,4].map(i => <div key={i} className="h-4 bg-surface-container-high rounded" />)}
      </div>
      <div className="h-10 bg-surface-container-high rounded-full" />
    </div>
  )
}

export default function Suscripciones() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [planes,      setPlanes]      = useState([])
  const [hero,        setHero]        = useState(HERO_DEFAULTS)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [planActivo,  setPlanActivo]  = useState(null)
  const [procesando,  setProcesando]  = useState(null)

  // Nuevos estados para el modal de profesión
  const [profesionesDisponibles, setProfesionesDisponibles] = useState([])
  const [paqueteSeleccionado, setPaqueteSeleccionado] = useState(null)
  const [profesionSeleccionada, setProfesionSeleccionada] = useState(null)
  const [mostrarModal, setMostrarModal] = useState(false)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true); setError(null)
    try {
      const { data: contenido } = await supabase
        .from('page_content').select('field_key, value')
        .eq('page_key', 'suscripciones').eq('is_draft', false)
      if (contenido?.length) {
        const textos = {}
        contenido.forEach(({ field_key, value }) => { textos[field_key] = value })
        setHero(prev => ({ ...prev, ...textos }))
      }

      const { data: pkgs, error: pkgErr } = await supabase
        .from('packages').select('*').eq('is_active', true).order('price', { ascending: true })
      if (pkgErr) throw pkgErr

      if (user) {
        const { data: purchase } = await supabase
          .from('purchases').select('package_id, end_date, status')
          .eq('user_id', user.id).eq('status', 'active')
          .gte('end_date', new Date().toISOString())
          .order('end_date', { ascending: false }).limit(1).single()
        if (purchase) setPlanActivo(purchase.package_id)
      }

      setPlanes(pkgs || [])
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los paquetes.')
    } finally {
      setLoading(false)
    }
  }

  // Cargar profesiones asociadas a una evaluación (vinculada al paquete)
  async function cargarProfesiones(evaluationId) {
    const { data } = await supabase
      .from('professions')
      .select('*')
      .eq('evaluation_id', evaluationId)
      .eq('is_active', true)
      .order('price')
    setProfesionesDisponibles(data || [])
  }

  // Al hacer clic en un paquete, se abre el modal para elegir profesión
  async function seleccionarPlan(pkg) {
    if (!user) { navigate('/login'); return }
    if (planActivo === pkg.id) return
    setPaqueteSeleccionado(pkg)
    setProfesionSeleccionada(null)
    // Buscar la evaluación que esté vinculada a este paquete (por category_id)
    const { data: eval_ } = await supabase
      .from('evaluations')
      .select('id')
      .eq('category_id', pkg.id)
      .single()
    if (eval_) {
      await cargarProfesiones(eval_.id)
    } else {
      setProfesionesDisponibles([])
    }
    setMostrarModal(true)
  }

  // Iniciar pago con la profesión seleccionada (o sin ella)
  async function iniciarPago() {
    if (!paqueteSeleccionado) return
    setProcesando(paqueteSeleccionado.id)
    setMostrarModal(false)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const body = {
        package_id: paqueteSeleccionado.id,
        profession_id: profesionSeleccionada?.id || null,
        precio_override: profesionSeleccionada ? profesionSeleccionada.price : null
      }
      const res = await fetch(`${API}/api/paquetes/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error)

      const checkout = new window.WidgetCheckout({
        currency:        'COP',
        amountInCents:   datos.amount_in_cents,
        reference:       datos.reference,
        publicKey:       datos.public_key,
        signature:       { integrity: datos.signature },
        customerData: { email: user.email },
        redirectUrl:     datos.redirect_url,
      })
      checkout.open(result => {
        const { transaction } = result
        if (transaction?.status === 'APPROVED') {
          navigate('/pago-resultado?status=approved')
        } else {
          navigate('/pago-resultado?status=declined')
        }
      })
    } catch (err) {
      console.error(err)
      setError('Error al iniciar el pago. Intenta de nuevo.')
    } finally {
      setProcesando(null)
    }
  }

  function getFeatures(pkg) {
    if (pkg.description) {
      const lineas = pkg.description.split('\n').filter(Boolean)
      if (lineas.length > 1) return lineas
    }
    const base = ['Simulacros ilimitados', 'Retroalimentación inmediata', 'Historial de resultados']
    if (pkg.type === 'premium' || pkg.price > 50000)
      return [...base, 'Retroalimentación IA completa', 'Salas de competición', 'Certificados de participación']
    return [...base, 'Retroalimentación IA básica']
  }

  function getDuracionLabel(dias) {
    if (!dias) return ''
    if (dias === 30)  return '/MES COP'
    if (dias === 90)  return '/3 MESES COP'
    if (dias === 365) return '/AÑO COP'
    return `/${dias} días`
  }

  const maxPrecio = Math.max(...planes.map(p => p.price ?? 0), 0)

  return (
    <div className="p-4 md:p-8 pb-20 max-w-5xl animate-fade-in">

      <div className="premium-gradient rounded-3xl p-6 md:p-10 text-white mb-8">
        <h2 className="font-headline font-extrabold text-2xl md:text-4xl leading-tight mb-4 tracking-tight">
          {hero.hero_titulo}
        </h2>
        <p className="text-primary-fixed opacity-90 text-lg mb-6 leading-relaxed max-w-2xl">
          {hero.hero_subtitulo}
        </p>
        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/10">
          <span className="material-symbols-outlined text-secondary-fixed"
            style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          <p className="text-sm font-semibold uppercase tracking-wider">{hero.hero_badge}</p>
        </div>
      </div>

      {planActivo && (
        <div className="mb-6 p-4 bg-secondary-container/30 border border-secondary/30 rounded-2xl flex items-center gap-4">
          <span className="material-symbols-outlined text-secondary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          <div>
            <p className="font-bold text-secondary">Tienes un paquete activo</p>
            <p className="text-sm text-on-surface-variant">Sigue disfrutando de todos los beneficios.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-semibold">{error}</p>
          <button onClick={cargarDatos} className="ml-auto text-xs font-bold underline">Reintentar</button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {loading && [1,2,3].map(i => <SkeletonPlan key={i} />)}

        {!loading && planes.length === 0 && (
          <div className="col-span-full card p-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-40 mb-2 block">inventory_2</span>
            <p className="font-semibold">No hay paquetes disponibles en este momento</p>
          </div>
        )}

        {!loading && planes.map(pkg => {
          const destacado = pkg.price === maxPrecio && planes.length > 1
          const features  = getFeatures(pkg)
          const esActivo  = planActivo === pkg.id
          const enProceso = procesando === pkg.id

          return (
            <div key={pkg.id}
              className={`rounded-2xl p-6 relative overflow-hidden transition-all
                ${destacado ? 'bg-white border-2 border-primary shadow-[0_20px_40px_rgba(0,61,155,0.10)] hover:shadow-xl' : 'card hover:shadow-md'}
                ${esActivo ? 'ring-2 ring-secondary' : ''}`}>

              {esActivo && (
                <div className="absolute top-0 left-0 bg-secondary text-on-secondary px-4 py-1.5 rounded-br-xl text-[10px] font-bold uppercase tracking-widest">
                  Tu paquete actual
                </div>
              )}
              {destacado && !esActivo && (
                <div className="absolute top-0 right-0 bg-primary text-on-primary px-4 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest">
                  Más popular
                </div>
              )}

              <div className={`flex justify-between items-start mb-4 ${(destacado || esActivo) ? 'mt-4' : ''}`}>
                <div>
                  <h3 className={`font-headline font-bold text-on-surface ${destacado ? 'text-2xl' : 'text-xl'}`}>
                    {pkg.name}
                  </h3>
                  <p className={`text-sm ${destacado ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                    {pkg.duration_days ? `${pkg.duration_days} días de acceso` : 'Acceso ilimitado'}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`font-headline font-extrabold text-primary ${destacado ? 'text-3xl' : 'text-2xl'}`}>
                    {formatPrecio(pkg.price)}
                  </span>
                  <span className="text-xs text-outline block">{getDuracionLabel(pkg.duration_days)}</span>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-sm text-secondary"
                      style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    <span className="text-sm font-semibold text-on-surface">{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => seleccionarPlan(pkg)}
                disabled={esActivo || enProceso}
                className={`w-full py-3 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2
                  ${esActivo ? 'bg-secondary-container text-secondary cursor-default'
                    : destacado ? 'btn-primary hover:scale-105 active:scale-95'
                    : 'bg-surface-container-high text-primary hover:bg-primary-fixed'}
                  disabled:opacity-60`}>
                {enProceso && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {esActivo ? '✓ Paquete activo' : enProceso ? 'Abriendo pago...' : destacado ? 'Adquirir ahora' : 'Seleccionar'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="card p-8 text-center">
        <h4 className="font-headline font-bold text-on-surface-variant mb-4 uppercase tracking-widest text-[11px]">
          Utilizado por miles de aspirantes
        </h4>
        <div className="flex justify-center -space-x-3 mb-4">
          {['CA','MG','JP'].map((ini, idx) => (
            <div key={idx}
              className={`w-12 h-12 rounded-full border-4 border-white flex items-center justify-center text-white font-bold text-sm
                ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-tertiary'}`}>
              {ini}
            </div>
          ))}
          <div className="w-12 h-12 rounded-full border-4 border-white bg-primary-container flex items-center justify-center text-white font-bold text-xs">
            +15k
          </div>
        </div>
        <p className="text-on-surface-variant italic text-sm max-w-md mx-auto">{hero.testimonio}</p>
        <p className="text-[11px] font-bold text-primary mt-2 uppercase">{hero.testimonio_autor}</p>
      </div>

      {/* Modal de selección de profesión */}
      {mostrarModal && paqueteSeleccionado && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-headline font-bold text-lg">{paqueteSeleccionado.name}</h3>
              <button onClick={() => setMostrarModal(false)}
                className="p-2 rounded-full hover:bg-surface-container">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {profesionesDisponibles.length > 0 ? (
              <>
                <p className="text-sm text-on-surface-variant">Selecciona tu perfil profesional:</p>
                <div className="space-y-2">
                  {profesionesDisponibles.map(prof => (
                    <button key={prof.id} type="button"
                      onClick={() => setProfesionSeleccionada(prof)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all
                        ${profesionSeleccionada?.id === prof.id
                          ? 'border-primary bg-primary/5'
                          : 'border-outline-variant hover:border-primary/40'}`}>
                      <span className="font-semibold text-sm">{prof.name}</span>
                      <span className="font-bold text-primary">
                        ${prof.price.toLocaleString('es-CO')}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-on-surface-variant">
                Precio: <span className="font-bold text-primary">
                  ${paqueteSeleccionado.price.toLocaleString('es-CO')}
                </span>
              </p>
            )}

            <button onClick={iniciarPago}
              disabled={profesionesDisponibles.length > 0 && !profesionSeleccionada}
              className="w-full py-4 bg-primary text-on-primary rounded-2xl font-bold text-sm
                         disabled:opacity-40 hover:bg-primary/90 transition-all">
              Continuar al pago
            </button>
          </div>
        </div>
      )}
    </div>
  )
}