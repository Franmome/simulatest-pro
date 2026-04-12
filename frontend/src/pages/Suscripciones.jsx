import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const HERO_DEFAULTS = {
  hero_titulo: 'Prepárate con los mejores simulacros.',
  hero_subtitulo: 'Accede a simulacros oficiales para las convocatorias más exigentes del país. Elige tu paquete y empieza hoy.',
  hero_badge: 'Paquetes por convocatoria',
  testimonio: '"Los simulacros son idénticos al examen real. Totalmente vale la pena."',
  testimonio_autor: '— María G., Puntaje 472',
}

const ICONOS_CATEGORIA = {
  CNSC: 'gavel',
  ICFES: 'school',
  'Saber Pro': 'history_edu',
  Procuraduría: 'balance',
  Contraloría: 'account_balance',
  Defensoría: 'shield',
  DIAN: 'receipt_long',
  TyT: 'engineering',
}

const COLORES_CATEGORIA = {
  CNSC: 'from-primary to-primary-container',
  ICFES: 'from-tertiary to-tertiary-container',
  'Saber Pro': 'from-secondary to-[#217128]',
  Procuraduría: 'from-[#003d9b] to-[#1b6d24]',
  Contraloría: 'from-primary to-[#0052cc]',
  Defensoría: 'from-slate-400 to-slate-500',
  DIAN: 'from-[#b45309] to-[#92400e]',
  TyT: 'from-[#6d28d9] to-[#4c1d95]',
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
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-surface-container-high rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  )
}

// Modal de aviso de inicio de sesión
function ModalLoginPrompt({ onClose, onLogin }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="text-center">
          <span className="material-symbols-outlined text-5xl text-primary mb-3">account_circle</span>
          <h3 className="text-xl font-bold mb-2">Inicia sesión para continuar</h3>
          <p className="text-on-surface-variant mb-6">
            Necesitas una cuenta para adquirir paquetes y acceder a los simulacros.
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-4 rounded-full font-medium border border-outline-variant hover:bg-surface-container-high transition"
            >
              Cancelar
            </button>
            <button
              onClick={onLogin}
              className="flex-1 py-2 px-4 rounded-full font-medium bg-primary text-on-primary hover:bg-primary/90 transition"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Modal de pago exitoso
function ModalPagoExitoso({ pkg, version, onClose, onVerSimulacros, onVerMisPaquetes }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-3xl w-full max-w-md p-6 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-secondary">check_circle</span>
          </div>
          <h3 className="text-2xl font-bold mb-2">¡Compra exitosa!</h3>
          <p className="text-on-surface-variant mb-2">
            Has adquirido <strong>{pkg.name}</strong>
          </p>
          {version && (
            <p className="text-sm text-on-surface-variant mb-4">
              Versión: {version.display_name || 'Sin nombre'}
            </p>
          )}
          <div className="bg-surface-container-low p-4 rounded-xl mb-6">
            <p className="text-xs text-on-surface-variant">Total pagado</p>
            <p className="text-2xl font-extrabold text-primary">
              {formatPrecio(version?.price || pkg.base_price || pkg.price)} COP
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={onVerSimulacros}
              className="w-full py-3 rounded-full font-bold text-sm bg-primary text-on-primary hover:bg-primary/90 transition"
            >
              Ir a simulacros
            </button>
            <button
              onClick={onVerMisPaquetes}
              className="w-full py-3 rounded-full font-medium text-sm border border-outline-variant hover:bg-surface-container-high transition"
            >
              Ver mis paquetes
            </button>
            <button
              onClick={onClose}
              className="text-xs text-on-surface-variant hover:text-primary mt-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componente Modal para detalle y checkout
function ModalPaquete({ pkg, versiones, comprasUsuario, onClose, onComprar, procesando }) {
  const [paso, setPaso] = useState('detalle') // 'detalle' | 'checkout'
  const [versionSeleccionada, setVersionSeleccionada] = useState(null)

  const catNombre = pkg.evaluations?.[0]?.categories?.name ?? 'General'
  const colorGrad = COLORES_CATEGORIA[catNombre] || 'from-primary to-primary-container'

  const versionesActivas = versiones.filter(v => v.is_active)
  const versionesNoCombo = versionesActivas.filter(v => !v.is_combo)
  const precioDesde = versionesNoCombo.length
    ? Math.min(...versionesNoCombo.map(v => Number(v.price) || 0))
    : Number(pkg.base_price || pkg.price) || 0

  const comprasVersionIds = comprasUsuario.map(c => c.package_version_id)

  // Determinar versión recomendada (la del medio si hay al menos 3, o la primera)
  const versionRecomendada = versionesActivas.length >= 3
    ? versionesActivas[Math.floor(versionesActivas.length / 2)]
    : versionesActivas[0]

  const handleSeleccionarVersion = (version) => {
    setVersionSeleccionada(version)
    setPaso('checkout')
  }

  const handleComprar = () => {
    if (!versionSeleccionada) return
    onComprar(pkg, versionSeleccionada)
  }

  const handleCerrar = () => {
    setPaso('detalle')
    setVersionSeleccionada(null)
    onClose()
  }

  // Beneficios del paquete (pueden venir de metadata o ser fijos)
  const beneficios = [
    'Acceso completo al simulacro',
    'Material de estudio descargable',
    'Modo práctica ilimitado',
    'Modo examen con temporizador',
    'Sala en línea simulada',
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className={`h-1.5 bg-gradient-to-r ${colorGrad}`} />
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-extrabold">{pkg.name}</h2>
            <button onClick={handleCerrar} className="p-2 hover:bg-surface-container-high rounded-full">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {paso === 'detalle' && (
            <>
              <p className="text-on-surface-variant mb-6">{pkg.description}</p>

              {/* Beneficios / características */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">layers</span>
                  <span>{pkg.evaluations?.[0]?.levels?.length || 0} niveles</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">quiz</span>
                  <span>{versionesActivas.length} versiones disponibles</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">menu_book</span>
                  <span>Material incluido</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">sell</span>
                  <span>Desde {formatPrecio(precioDesde)} COP</span>
                </div>
              </div>

              {/* Sección "Este paquete incluye" */}
              <div className="mb-6 p-4 bg-primary-container/10 rounded-2xl border border-primary/20">
                <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">checklist</span>
                  Este paquete incluye
                </h3>
                <ul className="space-y-2">
                  {beneficios.map((beneficio, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                      <span>{beneficio}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Versiones disponibles */}
              <h3 className="font-bold text-lg mb-3">Versiones disponibles</h3>
              <div className="space-y-3">
                {versionesActivas.map(version => {
                  const yaComprado = comprasVersionIds.includes(version.id)
                  const esRecomendada = versionRecomendada?.id === version.id

                  return (
                    <div
                      key={version.id}
                      className={`p-4 rounded-xl border-2 transition-all relative
                        ${esRecomendada ? 'border-primary shadow-md bg-primary-container/5' : 'border-outline-variant/20 bg-surface-container-lowest'}
                        ${version.is_combo ? 'border-tertiary/30 bg-tertiary-container/10' : ''}
                        ${yaComprado ? 'border-secondary/30 bg-secondary-container/10' : ''}`}
                    >
                      {esRecomendada && (
                        <div className="absolute -top-3 left-4 bg-primary text-on-primary text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                          🔥 Más popular
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold">{version.display_name || 'Versión sin nombre'}</p>
                            {version.is_combo && (
                              <span className="text-[9px] font-bold bg-tertiary text-on-tertiary px-1.5 py-0.5 rounded-full">
                                COMBO
                              </span>
                            )}
                            {yaComprado && (
                              <span className="text-[9px] font-bold bg-secondary text-on-secondary px-1.5 py-0.5 rounded-full">
                                ✓ ADQUIRIDO
                              </span>
                            )}
                          </div>
                          <p className="text-xl font-extrabold text-primary mt-1">
                            {formatPrecio(version.price)} COP
                          </p>
                        </div>
                        <button
                          onClick={() => handleSeleccionarVersion(version)}
                          disabled={yaComprado}
                          className={`px-5 py-2 rounded-full text-sm font-bold transition-all
                            ${yaComprado
                              ? 'bg-secondary-container text-secondary cursor-default'
                              : version.is_combo
                                ? 'bg-tertiary text-on-tertiary hover:bg-tertiary/90'
                                : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                        >
                          {yaComprado ? 'Adquirido' : 'Seleccionar'}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {paso === 'checkout' && versionSeleccionada && (
            <>
              <button
                onClick={() => setPaso('detalle')}
                className="flex items-center gap-1 text-sm font-medium text-on-surface-variant mb-6 hover:text-primary"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Volver a versiones
              </button>

              <div className="bg-surface-container-low p-6 rounded-2xl mb-6">
                <h3 className="font-bold text-lg mb-4">Resumen de compra</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Paquete:</span>
                    <span className="font-medium">{pkg.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Versión:</span>
                    <span className="font-medium">{versionSeleccionada.display_name || 'Sin nombre'}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-outline-variant mt-2">
                    <span className="font-bold">Total:</span>
                    <span className="text-xl font-extrabold text-primary">
                      {formatPrecio(versionSeleccionada.price)} COP
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleComprar}
                disabled={!!procesando}
                className="w-full py-3 rounded-full font-bold text-sm transition-all bg-primary text-on-primary hover:bg-primary/90 active:scale-95 disabled:opacity-60"
              >
                {procesando ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </span>
                ) : (
                  'Pagar con Wompi'
                )}
              </button>
              <p className="text-xs text-center text-on-surface-variant mt-3">
                Serás redirigido a la pasarela de pago segura.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function TarjetaPaquete({ pkg, comprasUsuario, onAbrirDetalle }) {
  const navigate = useNavigate()

  const catNombre = pkg.evaluations?.[0]?.categories?.name ?? 'General'
  const icono = ICONOS_CATEGORIA[catNombre] || 'quiz'
  const colorGrad = COLORES_CATEGORIA[catNombre] || 'from-primary to-primary-container'

  const versiones = pkg.versiones || []
  const versionesActivas = versiones.filter(v => v.is_active)
  const versionesNoCombo = versionesActivas.filter(v => !v.is_combo)
  const tieneVersion = versionesActivas.length > 0

  const precioDesde = tieneVersion
    ? (versionesNoCombo.length > 0
        ? Math.min(...versionesNoCombo.map(v => Number(v.price) || 0))
        : 0)
    : Number(pkg.base_price || pkg.price) || 0

  const pkgComprado = comprasUsuario.some(c => c.package_id === pkg.id)
  const nivelesCount = pkg.evaluations?.reduce((acc, ev) => acc + (ev.levels?.length || 0), 0) || 0

  return (
    <div className="card overflow-hidden hover:shadow-xl transition-all duration-300">
      <div className={`h-1.5 bg-gradient-to-r ${colorGrad}`} />

      <div className="p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-b ${colorGrad} flex items-center justify-center flex-shrink-0 shadow-md`}>
            <span
              className="material-symbols-outlined text-white text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              {icono}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-lg leading-tight">{pkg.name}</h3>
            <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{pkg.description}</p>
          </div>

          {pkgComprado && (
            <span className="flex items-center gap-1 bg-secondary-container text-secondary text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0">
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              Activo
            </span>
          )}
        </div>

        <div className="flex gap-4 text-xs text-on-surface-variant mb-5">
          {nivelesCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">layers</span>
              {nivelesCount} nivel{nivelesCount !== 1 ? 'es' : ''}
            </span>
          )}

          {versionesActivas.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">people</span>
              {versionesActivas.length} versión{versionesActivas.length !== 1 ? 'es' : ''}
            </span>
          )}

          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">menu_book</span>
            Material incluido
          </span>
        </div>

        <div className="mb-4">
          <p className="text-xs text-on-surface-variant">{tieneVersion ? 'Desde' : 'Precio'}</p>
          <p className="text-3xl font-extrabold text-primary">{formatPrecio(precioDesde)}</p>
          <p className="text-xs text-on-surface-variant">COP</p>
        </div>

        <button
          onClick={() => onAbrirDetalle(pkg)}
          className="w-full py-3 rounded-full font-bold text-sm transition-all bg-primary text-on-primary hover:bg-primary/90 active:scale-95"
        >
          Ver detalles y adquirir
        </button>

        {pkg.evaluations?.[0]?.id && (
          <button
            onClick={() => navigate(`/prueba/${pkg.evaluations[0].id}`)}
            className="w-full mt-2 py-2 rounded-full text-xs font-bold text-on-surface-variant hover:text-primary hover:bg-surface-container transition-all"
          >
            Ver contenido del paquete →
          </button>
        )}
      </div>
    </div>
  )
}

export default function Suscripciones() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [procesando, setProcesando] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')
  const [modalPaquete, setModalPaquete] = useState(null) // { pkg, versiones }
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [pagoExitoso, setPagoExitoso] = useState(null) // { pkg, version }

  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://checkout.wompi.co/widget.js"]')
    if (existingScript) return

    const script = document.createElement('script')
    script.src = 'https://checkout.wompi.co/widget.js'
    script.async = true
    document.body.appendChild(script)

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script)
      }
    }
  }, [])

  const { data, loading, error, retry } = useFetch(async () => {
    let hero = { ...HERO_DEFAULTS }

    // Cargar contenido de página
    try {
      const { data: contenido, error: contenidoError } = await supabase
        .from('page_content')
        .select('field_key, value')
        .eq('page_key', 'suscripciones')

      if (!contenidoError && contenido?.length) {
        contenido.forEach(({ field_key, value }) => {
          hero[field_key] = value
        })
      }
    } catch (err) {
      console.warn('[Suscripciones] page_content error:', err)
    }

    // 1. Obtener paquetes activos
    const { data: pkgs, error: pkgErr } = await supabase
      .from('packages')
      .select('id, name, description, base_price, price, duration_days, type, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (pkgErr) throw new Error(pkgErr.message || 'No se pudieron cargar los paquetes')

    // 2. Para cada paquete, obtener sus versiones activas
    const paquetesConVersiones = await Promise.all(
      (pkgs || []).map(async pkg => {
        try {
          // Obtener package_versions
          const { data: versiones, error: versionesError } = await supabase
            .from('package_versions')
            .select('id, display_name, price, is_active, is_combo')
            .eq('package_id', pkg.id)
            .eq('is_active', true)
            .order('price', { ascending: true })

          if (versionesError) {
            console.warn(`[Suscripciones] versiones error para package ${pkg.id}:`, versionesError.message)
            return { ...pkg, versiones: [], evaluations: [] }
          }

          // 3. Obtener evaluation_versions y luego evaluations (en dos pasos por robustez)
          const versionIds = versiones.map(v => v.id)
          let evaluations = []

          if (versionIds.length > 0) {
            // Paso 1: obtener evaluation_ids
            const { data: evalVersions, error: evErr } = await supabase
              .from('evaluation_versions')
              .select('evaluation_id')
              .in('package_version_id', versionIds)

            if (!evErr && evalVersions?.length) {
              // Paso 2: obtener evaluations por IDs únicos
              const evalIds = [...new Set(evalVersions.map(ev => ev.evaluation_id).filter(Boolean))]
              if (evalIds.length > 0) {
                const { data: evs, error: evsError } = await supabase
                  .from('evaluations')
                  .select('id, title, categories(name), levels(id)')
                  .in('id', evalIds)

                if (!evsError && evs) {
                  evaluations = evs
                } else {
                  console.warn(`[Suscripciones] evaluations error para package ${pkg.id}:`, evsError?.message)
                }
              }
            } else {
              console.warn(`[Suscripciones] evaluation_versions error para package ${pkg.id}:`, evErr?.message)
            }
          }

          return {
            ...pkg,
            versiones: versiones || [],
            evaluations: evaluations,
          }
        } catch (err) {
          console.warn(`[Suscripciones] error procesando package ${pkg.id}:`, err)
          return { ...pkg, versiones: [], evaluations: [] }
        }
      })
    )

    // 4. Obtener compras del usuario
    let comprasUsuario = []
    if (user?.id) {
      try {
        const { data: compras, error: comprasError } = await supabase
          .from('purchases')
          .select('package_id, package_version_id, end_date, status')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString())

        if (!comprasError && compras) {
          comprasUsuario = compras
        } else {
          console.warn('[Suscripciones] purchases error:', comprasError?.message)
        }
      } catch (err) {
        console.warn('[Suscripciones] purchases exception:', err)
      }
    }

    // Categorías únicas de las evaluaciones
    const categorias = [
      ...new Set(
        paquetesConVersiones
          .flatMap(p => p.evaluations?.map(e => e.categories?.name).filter(Boolean) || [])
      ),
    ]

    return {
      hero,
      paquetes: paquetesConVersiones,
      comprasUsuario,
      categorias,
    }
  }, [user?.id])

  const hero = data?.hero ?? HERO_DEFAULTS
  const paquetes = data?.paquetes ?? []
  const comprasUsuario = data?.comprasUsuario ?? []
  const categorias = data?.categorias ?? []

  const paquetesFiltrados = filtroCategoria === 'Todos'
    ? paquetes
    : paquetes.filter(p => p.evaluations?.some(e => e.categories?.name === filtroCategoria))

  const handleAbrirDetalle = (pkg) => {
    if (!user) {
      setShowLoginPrompt(true)
      return
    }
    setModalPaquete({ pkg, versiones: pkg.versiones })
  }

  const handleCerrarModal = () => {
    setModalPaquete(null)
  }

  const handleLoginPromptClose = () => {
    setShowLoginPrompt(false)
  }

  const handleLoginRedirect = () => {
    setShowLoginPrompt(false)
    navigate('/login')
  }

  const handlePagoExitosoClose = () => {
    setPagoExitoso(null)
  }

  const handleVerSimulacros = () => {
    setPagoExitoso(null)
    navigate('/catalogo')
  }

  const handleVerMisPaquetes = () => {
    setPagoExitoso(null)
    navigate('/mis-paquetes')
  }

  async function onComprar(pkg, version) {
    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (!version) {
      alert('Debe seleccionar una versión para continuar.')
      return
    }

    const key = version.id
    if (procesando) return

    setProcesando(key)

    try {
      if (!window.WidgetCheckout) {
        throw new Error('El widget de pago aún no ha terminado de cargar.')
      }

      const sessionResult = await supabase.auth.getSession()
      const token = sessionResult?.data?.session?.access_token

      if (!token) {
        throw new Error('No se pudo validar la sesión. Inicia sesión nuevamente.')
      }

      // Enviar package_version_id en lugar de profession_id
      const body = {
        package_id: pkg.id,
        package_version_id: version.id,
      }

      const res = await fetch(`${API}/api/paquetes/comprar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      let datos = null
      try {
        datos = await res.json()
      } catch {
        throw new Error('La respuesta del servidor no fue válida.')
      }

      if (!res.ok) {
        throw new Error(datos?.error || 'Error al iniciar el pago.')
      }

      const checkout = new window.WidgetCheckout({
        currency: 'COP',
        amountInCents: datos.amount_in_cents,
        reference: datos.reference,
        publicKey: datos.public_key,
        signature: { integrity: datos.signature },
        customerData: { email: user.email },
        redirectUrl: datos.redirect_url,
      })

      // Cerrar el modal de detalle/checkout antes de abrir Wompi
      setModalPaquete(null)

      checkout.open(result => {
        const transaction = result?.transaction

        if (transaction?.status === 'APPROVED') {
          // Mostrar modal de éxito en lugar de navegar directamente
          setPagoExitoso({ pkg, version })
        } else {
          navigate('/pago-resultado?status=declined')
        }
      })
    } catch (err) {
      console.error('[Suscripciones] onComprar error:', err)
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
          <span
            className="material-symbols-outlined text-secondary-fixed"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            workspace_premium
          </span>
          <p className="text-sm font-semibold uppercase tracking-wider">{hero.hero_badge}</p>
        </div>
      </div>

      {/* Estado de paquetes activos */}
      {comprasUsuario.length > 0 && (
        <div className="mb-8 p-4 bg-secondary-container/30 border border-secondary/30 rounded-2xl flex items-center gap-4">
          <span
            className="material-symbols-outlined text-secondary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            verified
          </span>
          <div>
            <p className="font-bold text-secondary">
              Tienes {comprasUsuario.length} paquete{comprasUsuario.length !== 1 ? 's' : ''} activo{comprasUsuario.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm text-on-surface-variant">Accede a tus simulacros desde el catálogo.</p>
          </div>
          <button
            onClick={() => navigate('/catalogo')}
            className="ml-auto text-xs font-bold text-secondary hover:underline"
          >
            Ver catálogo →
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-error-container text-on-error-container rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-semibold flex-1">{error}</p>
          <button onClick={retry} className="text-xs font-bold underline">
            Reintentar
          </button>
        </div>
      )}

      {/* Filtros */}
      {!loading && categorias.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setFiltroCategoria('Todos')}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all
              ${filtroCategoria === 'Todos'
                ? 'bg-primary text-on-primary shadow-md'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}
          >
            Todos
          </button>
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all
                ${filtroCategoria === cat
                  ? 'bg-primary text-on-primary shadow-md'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid de paquetes */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-10">
        {loading && [1, 2, 3, 4, 5, 6].map(i => <SkeletonPaquete key={i} />)}

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
            onAbrirDetalle={handleAbrirDetalle}
          />
        ))}
      </div>

      {/* Testimonio */}
      {hero.testimonio && (
        <div className="card p-8 text-center max-w-2xl mx-auto">
          <div className="flex justify-center -space-x-3 mb-6">
            {['CA', 'MG', 'JP'].map((ini, idx) => (
              <div
                key={idx}
                className={`w-12 h-12 rounded-full border-4 border-white flex items-center justify-center text-white font-bold text-sm ${idx === 0 ? 'bg-primary' : idx === 1 ? 'bg-secondary' : 'bg-tertiary'}`}
              >
                {ini}
              </div>
            ))}
            <div className="w-12 h-12 rounded-full border-4 border-white bg-primary-container flex items-center justify-center text-white font-bold text-xs">
              +15k
            </div>
          </div>
          <span
            className="material-symbols-outlined text-4xl text-primary mb-4 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            format_quote
          </span>
          <p className="text-lg font-semibold text-on-surface italic mb-3">{hero.testimonio}</p>
          <p className="text-sm text-on-surface-variant">{hero.testimonio_autor}</p>
        </div>
      )}

      {/* Modal de detalle/checkout */}
      {modalPaquete && (
        <ModalPaquete
          pkg={modalPaquete.pkg}
          versiones={modalPaquete.versiones}
          comprasUsuario={comprasUsuario}
          onClose={handleCerrarModal}
          onComprar={onComprar}
          procesando={procesando}
        />
      )}

      {/* Modal de aviso de inicio de sesión */}
      {showLoginPrompt && (
        <ModalLoginPrompt
          onClose={handleLoginPromptClose}
          onLogin={handleLoginRedirect}
        />
      )}

      {/* Modal de pago exitoso */}
      {pagoExitoso && (
        <ModalPagoExitoso
          pkg={pagoExitoso.pkg}
          version={pagoExitoso.version}
          onClose={handlePagoExitosoClose}
          onVerSimulacros={handleVerSimulacros}
          onVerMisPaquetes={handleVerMisPaquetes}
        />
      )}
    </div>
  )
}