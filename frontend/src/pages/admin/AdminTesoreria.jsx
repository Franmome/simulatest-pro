import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'

// ─────────────────────────────────────────────────────────────────────────────
// Configs
// ─────────────────────────────────────────────────────────────────────────────
const ESTADO_CONFIG = {
  completed: {
    icon: 'check_circle',
    bg: 'bg-secondary-container/30',
    text: 'text-secondary',
    label: 'Completado',
    labelColor: 'text-secondary',
  },
  pending: {
    icon: 'schedule',
    bg: 'bg-tertiary-container/20',
    text: 'text-tertiary',
    label: 'Pendiente',
    labelColor: 'text-tertiary',
  },
  failed: {
    icon: 'error',
    bg: 'bg-error-container/30',
    text: 'text-error',
    label: 'Fallido',
    labelColor: 'text-error',
  },
}

function tiempoRelativo(fecha) {
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600) {
    return `Hoy, ${new Date(fecha).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
  return `Hace ${Math.floor(diff / 86400)} d`
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('es-CO')}`
}

function StatCard({ title, value, subtitle, icon, tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary text-on-primary',
    secondary: 'bg-surface-container-lowest text-on-surface',
    green: 'bg-surface-container-lowest text-on-surface',
    orange: 'bg-surface-container-lowest text-on-surface',
  }

  const iconBg = {
    primary: 'bg-white/15 text-white',
    secondary: 'bg-secondary-container/30 text-on-secondary-container',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
  }

  return (
    <div className={`${tones[tone]} p-6 rounded-3xl border border-outline-variant/10 shadow-sm flex flex-col justify-between min-h-[160px]`}>
      <div className="flex justify-between items-start">
        <div className={`p-3 rounded-2xl ${iconBg[tone]}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-3xl font-extrabold font-headline">
          {typeof value === 'number' ? value.toLocaleString('es-CO') : value}
        </div>
        <div className="text-sm font-bold mt-1">{title}</div>
        <div className="text-xs opacity-80 mt-1">{subtitle}</div>
      </div>
    </div>
  )
}

function HelpBox({ title, items }) {
  return (
    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
      <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm">info</span>
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-on-surface-variant leading-relaxed flex gap-2">
            <span className="font-bold text-primary">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminTesoreria() {
  const { user } = useAuth()

  const [stats, setStats] = useState({
    ingresos: 0,
    cupones: 0,
    accesos: 0,
    transacciones: 0,
    cargando: true,
  })

  const [transacciones, setTransacciones] = useState([])
  const [cupones, setCupones] = useState([])
  const [busqueda, setBusqueda] = useState('')

  const [formCupon, setFormCupon] = useState({
    codigo: '',
    tipo: 'porcentaje',
    valor: '',
    expira: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [msgCupon, setMsgCupon] = useState('')

  const [formAcceso, setFormAcceso] = useState({
    email: '',
    vigencia: 'ilimitado',
    package_id: '',
  })
  const [otorgando, setOtorgando] = useState(false)
  const [msgAcceso, setMsgAcceso] = useState('')
  const [paquetes, setPaquetes] = useState([])

  useEffect(() => {
    cargarStats()
    cargarTransacciones()
    cargarCupones()
    cargarPaquetes()
  }, [])

  async function cargarPaquetes() {
    const { data } = await supabase
      .from('packages')
      .select('id, name, price, is_active')
      .eq('is_active', true)
      .neq('type', 'coupon')
      .order('name')

    setPaquetes(data || [])
  }

  async function cargarStats() {
    const mesInicio = new Date()
    mesInicio.setDate(1)
    mesInicio.setHours(0, 0, 0, 0)

    const [
      { data: comprasMes },
      { count: totalActivos },
      { count: accesosManuales },
      { count: totalTransacciones },
    ] = await Promise.all([
      supabase
        .from('purchases')
        .select('packages(price)')
        .gte('created_at', mesInicio.toISOString())
        .eq('status', 'active')
        .not('wompi_transaction_id', 'is', null),
      supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'manual'),
      supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true }),
    ])

    const ingresosMes =
      comprasMes?.reduce((sum, c) => sum + (c.packages?.price || 0), 0) || 0

    setStats({
      ingresos: ingresosMes,
      cupones: totalActivos || 0,
      accesos: accesosManuales || 0,
      transacciones: totalTransacciones || 0,
      cargando: false,
    })
  }

  async function cargarTransacciones() {
    const { data } = await supabase
      .from('transactions')
      .select('id, created_at, status, amount, package_id, user_id, packages(name)')
      .order('created_at', { ascending: false })
      .limit(12)

    setTransacciones(data || [])
  }

  async function cargarCupones() {
    const { data } = await supabase
      .from('packages')
      .select('id, name, price, is_active, created_at, duration_days, description')
      .eq('type', 'coupon')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(12)

    setCupones(data || [])
  }

  async function crearCupon(e) {
    e.preventDefault()
    if (!formCupon.codigo || !formCupon.valor) return

    setGuardando(true)
    setMsgCupon('')

    const { error } = await supabase.from('packages').insert({
      name: formCupon.codigo.toUpperCase(),
      description:
        formCupon.tipo === 'porcentaje'
          ? `Cupón de ${formCupon.valor}% de descuento`
          : `Cupón de ${formatMoney(formCupon.valor)} de descuento`,
      price: parseFloat(formCupon.valor),
      type: 'coupon',
      is_active: true,
      duration_days: formCupon.expira
        ? Math.ceil((new Date(formCupon.expira) - Date.now()) / 86400000)
        : 365,
    })

    setGuardando(false)

    if (error) {
      setMsgCupon('Error al guardar el cupón.')
    } else {
      setMsgCupon('Cupón creado correctamente.')
      setFormCupon({ codigo: '', tipo: 'porcentaje', valor: '', expira: '' })
      cargarCupones()
      cargarStats()
    }
  }

  async function eliminarCupon(id) {
    if (!confirm('¿Eliminar este cupón?')) return
    await supabase.from('packages').update({ is_active: false }).eq('id', id)
    cargarCupones()
    cargarStats()
  }

  async function otorgarAcceso(e) {
    e.preventDefault()
    if (!formAcceso.email) return

    setOtorgando(true)
    setMsgAcceso('')

    const { data: usuario, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', formAcceso.email)
      .maybeSingle()

    if (userError || !usuario) {
      setMsgAcceso('Usuario no encontrado.')
      setOtorgando(false)
      return
    }

    const diasMap = { ilimitado: 36500, '30': 30, '180': 180, '365': 365 }
    const dias = diasMap[formAcceso.vigencia] || 36500

    const inicio = new Date()
    const fin = new Date(inicio.getTime() + dias * 86400000)

    const { error } = await supabase.from('purchases').insert({
      user_id: usuario.id,
      package_id: formAcceso.package_id ? parseInt(formAcceso.package_id, 10) : null,
      start_date: inicio.toISOString(),
      end_date: fin.toISOString(),
      status: 'manual',
      amount: 0,
    })

    setOtorgando(false)

    if (error) {
      setMsgAcceso('Error al otorgar acceso.')
    } else {
      setMsgAcceso('Acceso otorgado correctamente.')
      setFormAcceso({ email: '', vigencia: 'ilimitado', package_id: '' })
      cargarStats()
      cargarTransacciones()
    }
  }

  const transaccionesFiltradas = useMemo(() => {
    if (!busqueda.trim()) return transacciones

    return transacciones.filter(t =>
      t.packages?.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
      t.user_id?.toLowerCase().includes(busqueda.toLowerCase())
    )
  }, [transacciones, busqueda])

  const nombreAdmin =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Admin'

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Tesorería</span>
            </nav>

            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Tesorería y Accesos
            </h1>

            <p className="text-on-surface-variant mt-1 text-sm max-w-2xl">
              Controla ventas, cupones, membresías activas y accesos manuales de la plataforma.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-full bg-surface-container-lowest border border-outline-variant/10 text-sm text-on-surface-variant">
              Administrando como <span className="font-bold text-on-surface">{nombreAdmin}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            title="Ingresos del mes"
            value={stats.cargando ? '...' : formatMoney(stats.ingresos)}
            subtitle="Solo pagos reales procesados"
            icon="trending_up"
            tone="primary"
          />
          <StatCard
            title="Suscripciones activas"
            value={stats.cargando ? '...' : stats.cupones}
            subtitle="Accesos vigentes en purchases"
            icon="workspace_premium"
            tone="secondary"
          />
          <StatCard
            title="Accesos manuales"
            value={stats.cargando ? '...' : stats.accesos}
            subtitle="Otorgados desde el panel"
            icon="verified_user"
            tone="green"
          />
          <StatCard
            title="Transacciones"
            value={stats.cargando ? '...' : stats.transacciones}
            subtitle="Movimientos registrados"
            icon="receipt_long"
            tone="orange"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Izquierda */}
          <section className="lg:col-span-2 space-y-6">
            {/* Cupones */}
            <div className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold font-headline">Gestión de Cupones</h2>
                  <p className="text-on-surface-variant text-sm">
                    Crea descuentos para campañas, lanzamientos o promociones específicas.
                  </p>
                </div>
              </div>

              <HelpBox
                title="Cómo usar los cupones"
                items={[
                  'El código se guarda como paquete tipo coupon.',
                  'El valor representa el descuento configurado.',
                  'La vigencia define por cuántos días permanece activo.',
                ]}
              />

              <form onSubmit={crearCupon} className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">
                    Código del Cupón
                  </label>
                  <input
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant text-sm"
                    placeholder="EJ: CONTRALORIA10"
                    value={formCupon.codigo}
                    onChange={e => setFormCupon(f => ({ ...f, codigo: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">
                    Tipo de Descuento
                  </label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formCupon.tipo}
                    onChange={e => setFormCupon(f => ({ ...f, tipo: e.target.value }))}
                  >
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="fijo">Monto fijo ($)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">
                    Valor
                  </label>
                  <input
                    type="number"
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-on-surface-variant text-sm"
                    placeholder="20"
                    value={formCupon.valor}
                    onChange={e => setFormCupon(f => ({ ...f, valor: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">
                    Fecha de Expiración
                  </label>
                  <input
                    type="date"
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formCupon.expira}
                    onChange={e => setFormCupon(f => ({ ...f, expira: e.target.value }))}
                  />
                </div>

                {msgCupon && (
                  <div className={`md:col-span-2 text-xs font-bold px-1 ${
                    msgCupon.includes('Error') ? 'text-error' : 'text-secondary'
                  }`}>
                    {msgCupon}
                  </div>
                )}

                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button
                    type="reset"
                    onClick={() => {
                      setFormCupon({ codigo: '', tipo: 'porcentaje', valor: '', expira: '' })
                      setMsgCupon('')
                    }}
                    className="px-6 py-2 text-on-surface-variant font-bold hover:bg-surface-container rounded-full transition-all text-sm"
                  >
                    Descartar
                  </button>

                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-8 py-2 bg-primary text-on-primary font-bold rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm disabled:opacity-60"
                  >
                    {guardando ? 'Guardando...' : 'Guardar cupón'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabla cupones */}
            <div className="bg-surface-container-lowest rounded-[2rem] border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-outline-variant/10">
                <h3 className="text-xl font-bold font-headline">Cupones Activos</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low">
                    <tr>
                      {['Código', 'Descuento', 'Expira', 'Estado', ''].map(h => (
                        <th
                          key={h}
                          className="px-6 py-4 text-xs font-bold text-on-surface-variant uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-outline-variant/10">
                    {cupones.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-10 text-center text-on-surface-variant text-sm">
                          No hay cupones activos aún
                        </td>
                      </tr>
                    ) : (
                      cupones.map(c => (
                        <tr key={c.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-8 py-4">
                            <span className="font-bold text-primary bg-primary/5 px-3 py-1 rounded-lg text-sm">
                              {c.name}
                            </span>
                          </td>

                          <td className="px-6 py-4 font-medium text-sm">
                            {c.description || formatMoney(c.price)}
                          </td>

                          <td className="px-6 py-4 text-on-surface-variant text-sm">
                            {c.duration_days
                              ? new Date(Date.now() + c.duration_days * 86400000).toLocaleDateString('es-CO')
                              : 'Sin límite'}
                          </td>

                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[10px] font-bold">
                              ACTIVO
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => eliminarCupon(c.id)}
                              className="text-on-surface-variant hover:text-error transition-colors p-2 rounded-full hover:bg-error/5"
                            >
                              <span className="material-symbols-outlined">delete</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Derecha */}
          <aside className="space-y-8">
            {/* Acceso manual */}
            <section className="bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/10">
              <div className="mb-6">
                <h2 className="text-xl font-bold font-headline">Accesos Especiales</h2>
                <p className="text-on-surface-variant text-xs mt-1">
                  Otorga acceso manual a un usuario específico.
                </p>
              </div>

              <HelpBox
                title="Cómo usar accesos manuales"
                items={[
                  'Busca al usuario por su correo registrado.',
                  'Selecciona un paquete si quieres dar acceso a uno específico.',
                  'Si dejas el paquete vacío, el acceso se crea sin paquete asociado.',
                ]}
              />

              <form onSubmit={otorgarAcceso} className="space-y-4 mt-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase px-1">
                    Correo del Usuario
                  </label>
                  <input
                    type="email"
                    className="w-full bg-surface-container-lowest border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm placeholder:text-on-surface-variant"
                    placeholder="usuario@ejemplo.com"
                    value={formAcceso.email}
                    onChange={e => setFormAcceso(f => ({ ...f, email: e.target.value }))}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase px-1">
                    Vigencia
                  </label>
                  <select
                    className="w-full bg-surface-container-lowest border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formAcceso.vigencia}
                    onChange={e => setFormAcceso(f => ({ ...f, vigencia: e.target.value }))}
                  >
                    <option value="ilimitado">Ilimitado</option>
                    <option value="30">30 días</option>
                    <option value="180">6 meses</option>
                    <option value="365">1 año</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase px-1">
                    Paquete
                  </label>
                  <select
                    className="w-full bg-surface-container-lowest border-none rounded-2xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formAcceso.package_id}
                    onChange={e => setFormAcceso(f => ({ ...f, package_id: e.target.value }))}
                  >
                    <option value="">Sin paquete específico</option>
                    {paquetes.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatMoney(p.price)}
                      </option>
                    ))}
                  </select>
                </div>

                {msgAcceso && (
                  <p className={`text-xs font-bold px-1 ${
                    msgAcceso.includes('Error') || msgAcceso.includes('no encontrado')
                      ? 'text-error'
                      : 'text-secondary'
                  }`}>
                    {msgAcceso}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={otorgando}
                  className="w-full py-3 bg-on-surface text-surface font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  {otorgando ? 'Otorgando...' : 'Otorgar acceso'}
                </button>
              </form>
            </section>

            {/* Ventas */}
            <section className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold font-headline">Reporte de Ventas</h2>
                  <p className="text-on-surface-variant text-xs mt-1">
                    Últimos movimientos registrados
                  </p>
                </div>

                <button
                  onClick={cargarTransacciones}
                  className="p-2 bg-surface-container-low rounded-xl text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-base">refresh</span>
                </button>
              </div>

              <div className="mb-4 relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar por paquete o user_id..."
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low border-none rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-5">
                {transaccionesFiltradas.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-4">
                    Sin transacciones recientes
                  </p>
                ) : (
                  transaccionesFiltradas.map((t, i) => {
                    const estado =
                      t.status === 'approved'
                        ? 'completed'
                        : t.status === 'pending'
                        ? 'pending'
                        : 'failed'

                    const cfg = ESTADO_CONFIG[estado]

                    return (
                      <div key={t.id || i} className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0`}>
                          <span className="material-symbols-outlined text-xl">{cfg.icon}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">
                            {t.packages?.name || 'Pago / movimiento'}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {tiempoRelativo(t.created_at)}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold">
                            {formatMoney(t.amount)}
                          </div>
                          <div className={`text-[10px] font-extrabold uppercase ${cfg.labelColor}`}>
                            {cfg.label}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  )
}