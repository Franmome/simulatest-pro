import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const HERO_DEFAULTS = {
  hero_titulo:       'Invierte en tu futuro profesional.',
  hero_subtitulo:    'Desbloquea las herramientas que usan los candidatos más exitosos. Domina tus exámenes de estado con precisión y confianza.',
  hero_badge:        'Acceso Premium Incluido',
  testimonio:        '"Los simulacros son idénticos al examen real del ICFES. Totalmente vale la pena."',
  testimonio_autor:  '— María G., Puntaje 472',
}

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

  const [planes,     setPlanes]     = useState([])
  const [hero,       setHero]       = useState(HERO_DEFAULTS)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [planActivo, setPlanActivo] = useState(null)
  const [procesando, setProcesando] = useState(null)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    setError(null)
    try {
      // 1. Textos del hero desde page_content
      const { data: contenido } = await supabase
        .from('page_content')
        .select('field_key, value')
        .eq('page_key', 'suscripciones')
        .eq('is_draft', false)

      if (contenido?.length) {
        const textos = {}
        contenido.forEach(({ field_key, value }) => { textos[field_key] = value })
        setHero(prev => ({ ...prev, ...textos }))
      }

      // 2. Paquetes activos
      const { data: pkgs, error: pkgErr } = await supabase
        .from('packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true })
      if (pkgErr) throw pkgErr

      // 3. Plan activo del usuario
      if (user) {
        const { data: purchase } = await supabase
          .from('purchases')
          .select('package_id, end_date, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString())
          .order('end_date', { ascending: false })
          .limit(1)
          .single()
        if (purchase) setPlanActivo(purchase.package_id)
      }

      setPlanes(pkgs || [])
    } catch (err) {
      console.error('Error cargando planes:', err)
      setError('No se pudieron cargar los planes.')
    } finally {
      setLoading(false)
    }
  }

  async function seleccionarPlan(pkg) {
    if (!user) { navigate('/login'); return }
    if (planActivo === pkg.id) return
    setProcesando(pkg.id)
    try {
      const { data: wa } = await supabase
        .from('page_content')
        .select('value')
        .eq('page_key', 'config')
        .eq('field_key', 'whatsapp_numero')
        .single()
      const numero  = wa?.value || '573000000000'
      const mensaje = encodeURIComponent(
        `Hola, quiero adquirir el plan "${pkg.name}" por ${formatPrecio(pkg.price)}. Mi correo es ${user.email}`
      )
      window.open(`https://wa.me/${numero}?text=${mensaje}`, '_blank')
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
    if (pkg.type === 'premium' || pkg.price > 50000) {
      return [...base, 'Retroalimentación IA completa', 'Salas de competición', 'Certificados de participación']
    }
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
    <div className="p-8 pb-20 max-w-5xl animate-fade-in">

      {/* Hero — textos desde page_content */}
      <div className="premium-gradient rounded-3xl p-10 text-white mb-10">
        <h2 className="font-headline font-extrabold text-4xl leading-tight mb-4 tracking-tight">
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
            <p className="font-bold text-secondary">Tienes un plan activo</p>
            <p className="text-sm text-on-surface-variant">Sigue disfrutando de todos los beneficios premium.</p>
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
            <p className="font-semibold">No hay planes disponibles en este momento</p>
            <p className="text-xs mt-1 text-on-surface-variant">
              El administrador debe crear paquetes desde el panel admin
            </p>
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
                ${destacado
                  ? 'bg-white border-2 border-primary shadow-[0_20px_40px_rgba(0,61,155,0.10)] hover:shadow-xl'
                  : 'card hover:shadow-md'}
                ${esActivo ? 'ring-2 ring-secondary' : ''}`}
            >
              {esActivo && (
                <div className="absolute top-0 left-0 bg-secondary text-on-secondary px-4 py-1.5 rounded-br-xl text-[10px] font-bold uppercase tracking-widest">
                  Tu plan actual
                </div>
              )}
              {destacado && !esActivo && (
                <div className="absolute top-0 right-0 bg-primary text-on-primary px-4 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase tracking-widest">
                  Mejor valor
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
                  ${esActivo
                    ? 'bg-secondary-container text-secondary cursor-default'
                    : destacado
                      ? 'btn-primary hover:scale-105 active:scale-95'
                      : 'bg-surface-container-high text-primary hover:bg-primary-fixed'}
                  disabled:opacity-60`}
              >
                {enProceso && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {esActivo ? '✓ Plan activo' : enProceso ? 'Procesando...' : destacado ? 'Comenzar ahora' : 'Seleccionar plan'}
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
    </div>
  )
}