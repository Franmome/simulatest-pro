import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const HERO_DEFAULTS = {
  hero_titulo:      'Prepárate con los mejores simulacros.',
  hero_subtitulo:   'Accede a simulacros oficiales para las convocatorias más exigentes del país. Elige tu paquete y empieza hoy.',
  hero_badge:       'Paquetes por convocatoria',
  testimonio:       '"Los simulacros son idénticos al examen real. Totalmente vale la pena."',
  testimonio_autor: '— María G., Puntaje 472',
}

const ICONOS_CATEGORIA = {
  'CNSC': 'gavel', 'ICFES': 'school', 'Saber Pro': 'history_edu',
  'Procuraduría': 'balance', 'Contraloría': 'account_balance',
  'Defensoría': 'shield', 'DIAN': 'receipt_long', 'TyT': 'engineering',
}
const COLORES_CATEGORIA = {
  'CNSC': 'from-primary to-primary-container',
  'ICFES': 'from-tertiary to-tertiary-container',
  'Saber Pro': 'from-secondary to-[#217128]',
  'Procuraduría': 'from-[#003d9b] to-[#1b6d24]',
  'Contraloría': 'from-primary to-[#0052cc]',
  'Defensoría': 'from-slate-400 to-slate-500',
  'DIAN': 'from-[#b45309] to-[#92400e]',
  'TyT': 'from-[#6d28d9] to-[#4c1d95]',
}

function formatPrecio(p) {
  if (!p && p !== 0) return '—'
  return `$${Number(p).toLocaleString('es-CO')}`
}

function SkeletonPaquete() {
  return (
    <div className="card overflow-hidden animate-pulse">
      <div className="h-2 bg-surface-container-high" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3 items-start">
          <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-surface-container-high rounded w-3/4" />
            <div className="h-3 bg-surface-container-high rounded w-full" />
          </div>
        </div>
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-surface-container-high rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

// ── Tarjeta de paquete con versiones expandibles ──────────────────────────────
function TarjetaPaquete({ pkg, comprasUsuario, onComprar, procesando }) {
  const [expandido, setExpandido] = useState(false)
  const navigate = useNavigate()

  const catNombre = pkg.evaluations?.[0]?.categories?.name ?? 'General'
  const icono     = ICONOS_CATEGORIA[catNombre] || 'quiz'
  const colorGrad = COLORES_CATEGORIA[catNombre] || 'from-primary to-primary-container'

  const versiones    = pkg.profesiones || []
  const tieneVersion = versiones.length > 0
  const precioDesde  = tieneVersion
    ? Math.min(...versiones.filter(v => v.is_active && !v.is_combo).map(v => Number(v.price) || 0))
    : Number(pkg.price) || 0

  const comprasIds = comprasUsuario.map(c => c.profession_id)
  const pkgComprado = comprasUsuario.some(c => c.package_id === pkg.id)

  return (
    <div className="card overflow-hidden hover:shadow-xl transition-all duration-300">
      {/* Barra color top */}
      <div className={`h-1.5 bg-gradient-to-r ${colorGrad}`} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-b ${colorGrad} flex items-center justify-center flex-shrink-0 shadow-md`}>
            <span className="material-symbols-outlined text-white text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>{icono}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-lg leading-tight">{pkg.name}</h3>
            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{pkg.description}</p>
          </div>
          {pkgComprado && (
            <span className="flex items-center gap-1 bg-secondary-container text-secondary text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              Activo
            </span>
          )}
        </div>

        {/* Stats del paquete */}
        <div className="flex gap-4 text-xs text-on-surface-variant mb-5">
          {pkg.evaluations?.[0]?.levels?.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">layers</span>
              {pkg.evaluations[0].levels.length} nivel{pkg.evaluations[0].levels.length !== 1 ? 'es' : ''}
            </span>
          )}
          {versiones.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">people</span>
              {versiones.filter(v => !v.is_combo && v.is_active).length} versiones
            </span>
          )}
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">menu_book</span>
            Material incluido
          </span>
        </div>

        {/* Precio desde */}
        {tieneVersion ? (
          <div className="mb-4">
            <p className="text-xs text-on-surface-variant">Desde</p>
            <p className="text-3xl font-extrabold text-primary">{formatPrecio(precioDesde)}</p>
            <p className="text-xs text-on-surface-variant">COP · según tu profesión</p>
          </div>
        ) : (
          <div className="mb-4">
            <p className="text-3xl font-extrabold text-primary">{formatPrecio(pkg.price)}</p>
            <p className="text-xs text-on-surface-variant">COP</p>
          </div>
        )}

        {/* Versiones expandibles */}
        {tieneVersion && (
          <div className="mb-4">
            <button
              onClick={() => setExpandido(e => !e)}
              className="w-full flex items-center justify-between py-2.5 px-4 rounded-xl bg-surface-container-low text-sm font-bold text-on-surface hover:bg-surface-container transition-all">
              <span>Ver versiones disponibles</span>
              <span className="material-symbols-outlined text-lg transition-transform"
                    style={{ transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                expand_more
              </span>
            </button>

            {expandido && (
              <div className="mt-3 space-y-2">
                {versiones.filter(v => v.is_active).map(version => {
                  const yaComprado = comprasIds.includes(version.id)
                  const enProceso  = procesando === version.id
                  return (
                    <div key={version.id}
                         className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all
                           ${version.is_combo ? 'border-tertiary/30 bg-tertiary-container/10' : 'border-outline-variant/20 bg-surface-container-lowest'}
                           ${yaComprado ? 'border-secondary/30 bg-secondary-container/10' : ''}`}>
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{version.name}</p>
                          {version.is_combo && (
                            <span className="text-[9px] font-bold bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded-full">COMBO</span>
                          )}
                          {yaComprado && (
                            <span className="text-[9px] font-bold bg-secondary text-on-secondary px-1.5 py-0.5 rounded-full">✓ ACTIVO</span>
                          )}
                        </div>
                        <p className="text-lg font-extrabold text-primary mt-0.5">
                          {formatPrecio(version.price)} COP
                        </p>
                      </div>
                      <button
                        onClick={() => onComprar(pkg, version)}
                        disabled={yaComprado || !!procesando}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all flex-shrink-0
                          ${yaComprado
                            ? 'bg-secondary-container text-secondary cursor-default'
                            : version.is_combo
                            ? 'bg-tertiary text-on-tertiary hover:bg-tertiary/90 active:scale-95'
                            : 'bg-primary text-on-primary hover:bg-primary/90 active:scale-95'}
                          disabled:opacity-60`}>
                        {enProceso && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                        {yaComprado ? '✓ Adquirido' : enProceso ? '...' : 'Adquirir'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* CTA si no tiene versiones */}
        {!tieneVersion && (
          <button
            onClick={() => onComprar(pkg, null)}
            disabled={pkgComprado || !!procesando}
            className={`w-full py-3 rounded-full font-bold text-sm transition-all
              ${pkgComprado
                ? 'bg-secondary-container text-secondary cursor-default'
                : 'bg-primary text-on-primary hover:bg-primary/90 active:scale-95'}
              disabled:opacity-60`}>
            {pkgComprado ? '✓ Paquete activo' : 'Adquirir paquete'}
          </button>
        )}

        {/* Ver contenido */}
        {pkg.evaluations?.[0]?.id && (
          <button
            onClick={() => navigate(`/prueba/${pkg.evaluations[0].id}`)}
            className="w-full mt-2 py-2 rounded-full text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all">
            Ver contenido del paquete →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Suscripciones() {
  const navigate    = useNavigate()
  const { user }    = useAuth()
  const [procesando, setProcesando] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')

  // Cargar script del widget de Wompi
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://checkout.wompi.co/widget.js'
    script.async = true
    document.body.appendChild(script)
    return () => document.body.removeChild(script)
  }, [])

  const { data, loading, error, retry } = useFetch(async () => {
    // Hero textos
    const { data: contenido } = await supabase
      .from('page_content').select('field_key, value')
      .eq('page_key', 'suscripciones').eq('is_draft', false)
    const hero = { ...HERO_DEFAULTS }
    if (contenido?.length) contenido.forEach(({ field_key, value }) => { hero[field_key] = value })

    // Paquetes activos con sus evaluaciones y versiones por profesión
    const { data: pkgs, error: pkgErr } = await supabase
      .from('packages')
      .select(`
        id, name, description, price, duration_days, type, is_active,
        evaluations_ids
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (pkgErr) throw new Error(pkgErr.message)

    // Para cada paquete traer sus evaluaciones y profesiones
    const paquetesCompletos = await Promise.all((pkgs || []).map(async pkg => {
      // Traer evaluaciones del paquete
      let evaluaciones = []
      if (pkg.evaluations_ids?.length) {
        const { data: evs } = await supabase
          .from('evaluations')
          .select('id, title, categories(name), levels(id)')
          .in('id', pkg.evaluations_ids)
        evaluaciones = evs || []
      }

      // Traer profesiones/versiones del paquete
      const { data: profs } = await supabase
        .from('professions')
        .select('id, name, price, is_active, is_combo, level_id')
        .eq('package_id', pkg.id)
        .eq('is_active', true)
        .order('price', { ascending: true })

      return { ...pkg, evaluations: evaluaciones, profesiones: profs || [] }
    }))

    // Compras activas del usuario
    let comprasUsuario = []
    if (user?.id) {
      const { data: compras } = await supabase
        .from('purchases')
        .select('package_id, profession_id, end_date, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
      comprasUsuario = compras || []
    }

    // Categorías únicas para filtro
    const categorias = [...new Set(
      paquetesCompletos
        .flatMap(p => p.evaluations?.map(e => e.categories?.name).filter(Boolean))
    )]

    return { hero, paquetes: paquetesCompletos, comprasUsuario, categorias }
  }, [user?.id])

  const hero          = data?.hero          ?? HERO_DEFAULTS
  const paquetes      = data?.paquetes      ?? []
  const comprasUsuario= data?.comprasUsuario?? []
  const categorias    = data?.categorias    ?? []

  const paquetesFiltrados = filtroCategoria === 'Todos'
    ? paquetes
    : paquetes.filter(p => p.evaluations?.some(e => e.categories?.name === filtroCategoria))

  // Función de compra con Wompi (reemplaza el antiguo WhatsApp)
  async function onComprar(pkg, version) {
    if (!user) { navigate('/login'); return }
    const key = version ? version.id : pkg.id
    if (procesando) return  // bloquea clicks múltiples
    setProcesando(key)
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token
      const body = {
        package_id:      pkg.id,
        profession_id:   version?.id || null,
        precio_override: version ? version.price : null,
      }
      const res = await fetch(`${API}/api/paquetes/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos.error)

      const checkout = new window.WidgetCheckout({
        currency:      'COP',
        amountInCents: datos.amount_in_cents,
        reference:     datos.reference,
        publicKey:     datos.public_key,
        signature:     { integrity: datos.signature },
        customerData:  { email: user.email },
        redirectUrl:   datos.redirect_url,
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
      alert(err.message || 'Error al iniciar el pago. Intenta de nuevo.')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="p-6 md:p-8 pb-20 max-w-6xl animate-fade-in">

      {/* Hero */}
      <div className="premium-gradient rounded-3xl p-8 md:p-10 text-white mb-10">
        <h2 className="font-headline font-extrabold text-3xl md:text-4xl leading-tight mb-4 tracking-tight">
          {hero.hero_titulo}
        </h2>
        <p className="text-primary-fixed opacity-90 text-lg mb-6 leading-relaxed max-w-2xl">
          {hero.hero_subtitulo}
        </p>
        <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
          <span className="material-symbols-outlined text-secondary-fixed"
                style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          <p className="text-sm font-semibold uppercase tracking-wider">{hero.hero_badge}</p>
        </div>
      </div>

      {/* Compras activas del usuario */}
      {comprasUsuario.length > 0 && (
        <div className="mb-8 p-4 bg-secondary-container/30 border border-secondary/30 rounded-2xl flex items-center gap-4">
          <span className="material-symbols-outlined text-secondary text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
          <div>
            <p className="font-bold text-secondary">Tienes {comprasUsuario.length} paquete{comprasUsuario.length !== 1 ? 's' : ''} activo{comprasUsuario.length !== 1 ? 's' : ''}</p>
            <p className="text-sm text-on-surface-variant">Accede a tus simulacros desde el catálogo.</p>
          </div>
          <button onClick={() => navigate('/catalogo')}
                  className="ml-auto text-xs font-bold text-secondary hover:underline">
            Ver catálogo →
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-semibold flex-1">{error}</p>
          <button onClick={retry} className="text-xs font-bold underline">Reintentar</button>
        </div>
      )}

      {/* Filtro por categoría */}
      {!loading && categorias.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {['Todos', ...categorias].map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all
                      ${filtroCategoria === cat
                        ? 'bg-primary text-on-primary shadow-md'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid de paquetes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {loading && [1,2,3,4,5,6].map(i => <SkeletonPaquete key={i} />)}

        {!loading && paquetesFiltrados.length === 0 && (
          <div className="col-span-full card p-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-40 mb-2 block">inventory_2</span>
            <p className="font-semibold">No hay paquetes disponibles en este momento</p>
            <p className="text-xs mt-1">Pronto habrá nuevos paquetes disponibles</p>
          </div>
        )}

        {!loading && paquetesFiltrados.map(pkg => (
          <TarjetaPaquete
            key={pkg.id}
            pkg={pkg}
            comprasUsuario={comprasUsuario}
            onComprar={onComprar}
            procesando={procesando}
          />
        ))}
      </div>

      {/* Testimonio */}
      {hero.testimonio && (
        <div className="card p-8 text-center max-w-2xl mx-auto">
          <div className="flex justify-center -space-x-3 mb-6">
            {['CA','MG','JP'].map((ini, idx) => (
              <div key={idx} className={`w-12 h-12 rounded-full border-4 border-white flex items-center justify-center text-white font-bold text-sm ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-tertiary'}`}>{ini}</div>
            ))}
            <div className="w-12 h-12 rounded-full border-4 border-white bg-primary-container flex items-center justify-center text-white font-bold text-xs">+15k</div>
          </div>
          <span className="material-symbols-outlined text-4xl text-primary mb-4 block"
                style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
          <p className="text-lg font-semibold text-on-surface italic mb-3">{hero.testimonio}</p>
          <p className="text-sm text-on-surface-variant">{hero.testimonio_autor}</p>
        </div>
      )}
    </div>
  )
}