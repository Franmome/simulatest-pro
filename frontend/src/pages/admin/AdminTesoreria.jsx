import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase'

// ── Estados de transacción ─────────────────────────────────────────────────
const ESTADO_CONFIG = {
  completed: { icon: 'add_shopping_cart', bg: 'bg-secondary-container/20', text: 'text-secondary', label: 'Completado', labelColor: 'text-secondary' },
  pending:   { icon: 'pending',           bg: 'bg-tertiary-container/10',   text: 'text-tertiary',  label: 'Pendiente',  labelColor: 'text-tertiary'  },
  failed:    { icon: 'block',             bg: 'bg-error-container/20',      text: 'text-error',     label: 'Fallido',    labelColor: 'text-error'     },
}

export default function AdminTesoreria() {
  const [stats,        setStats]        = useState({ ingresos: 0, cupones: 0, accesos: 0, cargando: true })
  const [transacciones, setTransacciones] = useState([])
  const [cupones,      setCupones]      = useState([])
  const [busqueda,     setBusqueda]     = useState('')

  // Form cupón
  const [formCupon, setFormCupon] = useState({ codigo: '', tipo: 'porcentaje', valor: '', expira: '' })
  const [guardando,  setGuardando]  = useState(false)
  const [msgCupon,   setMsgCupon]   = useState('')

  // Acceso manual
  const [formAcceso, setFormAcceso] = useState({ email: '', vigencia: 'ilimitado' })
  const [otorgando,  setOtorgando]  = useState(false)
  const [msgAcceso,  setMsgAcceso]  = useState('')

  useEffect(() => {
    cargarStats()
    cargarTransacciones()
    cargarCupones()
  }, [])

  // ── Stats principales ───────────────────────────────────────────────────
  async function cargarStats() {
    const mesInicio = new Date()
    mesInicio.setDate(1)
    mesInicio.setHours(0, 0, 0, 0)

    const [{ data: comprasMes }, { count: totalCupones }, { count: accesosManuales }] =
      await Promise.all([
        supabase.from('purchases')
          .select('packages(price)')
          .gte('created_at', mesInicio.toISOString())
          .eq('status', 'active'),
        supabase.from('purchases')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('purchases')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'manual'),
      ])

    const ingresosMes = comprasMes?.reduce((sum, c) => sum + (c.packages?.price || 0), 0) || 0

    setStats({
      ingresos: ingresosMes,
      cupones:  totalCupones  || 0,
      accesos:  accesosManuales || 0,
      cargando: false,
    })
  }

  // ── Transacciones recientes ─────────────────────────────────────────────
  async function cargarTransacciones() {
    const { data } = await supabase
      .from('purchases')
      .select('id, created_at, status, users(full_name), packages(name, price)')
      .order('created_at', { ascending: false })
      .limit(5)

    setTransacciones(data || [])
  }

  // ── Cupones activos (tabla packages con type = 'coupon' si aplica) ──────
  // Nota: si no tienes tabla de cupones aún, esto queda preparado
  async function cargarCupones() {
    const { data } = await supabase
      .from('packages')
      .select('id, name, price, is_active, created_at')
      .eq('type', 'coupon')
      .eq('is_active', true)
      .limit(10)
    setCupones(data || [])
  }

  // ── Crear cupón ─────────────────────────────────────────────────────────
  async function crearCupon(e) {
    e.preventDefault()
    if (!formCupon.codigo || !formCupon.valor) return
    setGuardando(true)
    setMsgCupon('')

    const { error } = await supabase.from('packages').insert({
      name:          formCupon.codigo.toUpperCase(),
      description:   `Cupón ${formCupon.tipo === 'porcentaje' ? formCupon.valor + '%' : '$' + formCupon.valor} de descuento`,
      price:         parseFloat(formCupon.valor),
      type:          'coupon',
      is_active:     true,
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
    }
  }

  // ── Eliminar cupón ──────────────────────────────────────────────────────
  async function eliminarCupon(id) {
    if (!confirm('¿Eliminar este cupón?')) return
    await supabase.from('packages').update({ is_active: false }).eq('id', id)
    cargarCupones()
  }

  // ── Otorgar acceso manual ───────────────────────────────────────────────
  async function otorgarAcceso(e) {
    e.preventDefault()
    if (!formAcceso.email) return
    setOtorgando(true)
    setMsgAcceso('')

    // Buscar usuario por email en auth
    const { data: usuario } = await supabase
      .from('users')
      .select('id')
      .eq('id', (await supabase.auth.admin?.getUserByEmail?.(formAcceso.email))?.data?.user?.id)
      .single()

    if (!usuario) {
      setMsgAcceso('Usuario no encontrado.')
      setOtorgando(false)
      return
    }

    const diasMap = { ilimitado: 36500, '30': 30, '180': 180, '365': 365 }
    const dias = diasMap[formAcceso.vigencia] || 36500
    const inicio = new Date()
    const fin    = new Date(inicio.getTime() + dias * 86400000)

    const { error } = await supabase.from('purchases').insert({
      user_id:    usuario.id,
      package_id: null,
      start_date: inicio.toISOString(),
      end_date:   fin.toISOString(),
      status:     'manual',
    })

    setOtorgando(false)
    if (error) {
      setMsgAcceso('Error al otorgar acceso.')
    } else {
      setMsgAcceso('Acceso Premium otorgado correctamente.')
      setFormAcceso({ email: '', vigencia: 'ilimitado' })
      cargarStats()
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function tiempoRelativo(fecha) {
    const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
    if (diff < 3600)  return `Hoy, ${new Date(fecha).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
    return `Ayer`
  }

  const transaccionesFiltradas = busqueda.trim()
    ? transacciones.filter(t =>
        t.packages?.name?.toLowerCase().includes(busqueda.toLowerCase()) ||
        t.users?.full_name?.toLowerCase().includes(busqueda.toLowerCase()))
    : transacciones

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── TopBar ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-8 h-16
                         bg-surface-container-lowest/80 backdrop-blur-xl
                         border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-8">
          <h1 className="font-headline text-xl font-extrabold tracking-tight text-primary">
            Tesorería y Cupones
          </h1>
          <div className="hidden md:flex relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined
                             text-on-surface-variant text-lg">search</span>
            <input
              className="bg-surface-container border-none rounded-full pl-10 pr-4 py-1.5
                         text-sm w-80 outline-none focus:ring-2 focus:ring-primary/20
                         placeholder:text-on-surface-variant"
              placeholder="Buscar transacción o cupón..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" />
            </button>
          </div>
          <div className="h-8 w-px bg-outline-variant/40 mx-1" />
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center
                          text-on-primary font-bold text-xs">A</div>
        </div>
      </header>

      <div className="p-8 space-y-8">

        {/* ── Stats Hero ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {/* Ingresos mes */}
          <div className="col-span-1 md:col-span-2 p-8 rounded-3xl bg-primary text-on-primary
                          flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <div className="text-primary-fixed/80 font-bold tracking-widest text-xs uppercase mb-2">
                Total Recaudado (Mes)
              </div>
              <div className="text-5xl font-extrabold font-headline mb-4 tracking-tighter">
                {stats.cargando ? '...' : `$${stats.ingresos.toLocaleString('es-CO')}`}
              </div>
              <div className="flex items-center gap-2 text-secondary-container font-semibold text-sm">
                <span className="material-symbols-outlined text-sm">trending_up</span>
                Ingresos del mes actual
              </div>
            </div>
            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none
                            translate-x-1/4 translate-y-1/4 scale-150">
              <span className="material-symbols-outlined text-9xl">account_balance_wallet</span>
            </div>
          </div>

          {/* Cupones canjeados */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm
                          border border-outline-variant/10 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-secondary-container/30 rounded-2xl text-on-secondary-container">
                <span className="material-symbols-outlined">confirmation_number</span>
              </div>
              <div className="text-secondary font-bold text-sm">Activos</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold font-headline">
                {stats.cargando ? '...' : stats.cupones}
              </div>
              <div className="text-on-surface-variant text-sm font-medium">Suscripciones activas</div>
            </div>
          </div>

          {/* Accesos manuales */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl shadow-sm
                          border border-outline-variant/10 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="p-3 bg-tertiary-container/10 rounded-2xl text-tertiary">
                <span className="material-symbols-outlined">group_add</span>
              </div>
              <div className="text-on-surface-variant font-bold text-sm">Manual</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold font-headline">
                {stats.cargando ? '...' : stats.accesos}
              </div>
              <div className="text-on-surface-variant text-sm font-medium">Accesos Manuales</div>
            </div>
          </div>
        </div>

        {/* ── Grid principal ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* ── Cupones ── */}
          <section className="lg:col-span-2 space-y-6">

            {/* Formulario nuevo cupón */}
            <div className="bg-surface-container-lowest p-8 rounded-[2rem]
                            border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold font-headline">Gestión de Cupones</h2>
                  <p className="text-on-surface-variant text-sm">Crea nuevas promociones y descuentos estratégicos.</p>
                </div>
              </div>

              <form onSubmit={crearCupon} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">
                    Código del Cupón
                  </label>
                  <input
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4
                               outline-none focus:ring-2 focus:ring-primary/20
                               placeholder:text-on-surface-variant text-sm"
                    placeholder="EJ: PRO2024"
                    value={formCupon.codigo}
                    onChange={e => setFormCupon(f => ({ ...f, codigo: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">
                    Tipo de Descuento
                  </label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4
                               outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formCupon.tipo}
                    onChange={e => setFormCupon(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="porcentaje">Porcentaje (%)</option>
                    <option value="fijo">Monto Fijo ($)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase px-1">Valor</label>
                  <input
                    type="number"
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4
                               outline-none focus:ring-2 focus:ring-primary/20
                               placeholder:text-on-surface-variant text-sm"
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
                    className="w-full bg-surface-container-low border-none rounded-2xl py-3 px-4
                               outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formCupon.expira}
                    onChange={e => setFormCupon(f => ({ ...f, expira: e.target.value }))}
                  />
                </div>
                {msgCupon && (
                  <div className={`md:col-span-2 text-xs font-bold px-1
                    ${msgCupon.includes('Error') ? 'text-error' : 'text-secondary'}`}>
                    {msgCupon}
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end gap-3 mt-2">
                  <button
                    type="reset"
                    onClick={() => { setFormCupon({ codigo: '', tipo: 'porcentaje', valor: '', expira: '' }); setMsgCupon('') }}
                    className="px-6 py-2 text-on-surface-variant font-bold
                               hover:bg-surface-container rounded-full transition-all text-sm">
                    Descartar
                  </button>
                  <button
                    type="submit"
                    disabled={guardando}
                    className="px-8 py-2 bg-primary text-on-primary font-bold rounded-full
                               shadow-lg shadow-primary/20 active:scale-95 transition-all text-sm
                               disabled:opacity-60">
                    {guardando ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
                </div>
              </form>
            </div>

            {/* Tabla cupones activos */}
            <div className="bg-surface-container-lowest rounded-[2rem]
                            border border-outline-variant/10 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-outline-variant/10">
                <h3 className="text-xl font-bold font-headline">Cupones Activos</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-container-low">
                    <tr>
                      {['Código', 'Descuento', 'Expiración', 'Estado', ''].map(h => (
                        <th key={h} className="px-6 py-4 text-xs font-bold text-on-surface-variant
                                               uppercase tracking-wider">
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
                          <td className="px-6 py-4 font-medium text-sm">${c.price}</td>
                          <td className="px-6 py-4 text-on-surface-variant text-sm">
                            {c.duration_days
                              ? new Date(Date.now() + c.duration_days * 86400000)
                                  .toLocaleDateString('es-CO')
                              : 'Sin límite'}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-1 rounded-full bg-secondary-container
                                             text-on-secondary-container text-[10px] font-bold">
                              ACTIVO
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => eliminarCupon(c.id)}
                              className="text-on-surface-variant hover:text-error transition-colors
                                         p-2 rounded-full hover:bg-error/5">
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

          {/* ── Sidebar derecho ── */}
          <aside className="space-y-8">

            {/* Acceso manual */}
            <section className="bg-surface-container-low p-8 rounded-[2rem]
                                border border-outline-variant/10">
              <div className="mb-6">
                <h2 className="text-xl font-bold font-headline">Accesos Especiales</h2>
                <p className="text-on-surface-variant text-xs mt-1">
                  Otorga privilegios Premium manualmente.
                </p>
              </div>
              <form onSubmit={otorgarAcceso} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase px-1">
                    Correo del Usuario
                  </label>
                  <input
                    type="email"
                    className="w-full bg-surface-container-lowest border-none rounded-2xl
                               py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm
                               placeholder:text-on-surface-variant"
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
                    className="w-full bg-surface-container-lowest border-none rounded-2xl
                               py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={formAcceso.vigencia}
                    onChange={e => setFormAcceso(f => ({ ...f, vigencia: e.target.value }))}>
                    <option value="ilimitado">Ilimitado</option>
                    <option value="30">30 días</option>
                    <option value="180">6 meses</option>
                    <option value="365">1 año</option>
                  </select>
                </div>
                {msgAcceso && (
                  <p className={`text-xs font-bold px-1
                    ${msgAcceso.includes('Error') || msgAcceso.includes('no encontrado')
                      ? 'text-error' : 'text-secondary'}`}>
                    {msgAcceso}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={otorgando}
                  className="w-full py-3 bg-on-surface text-surface font-bold rounded-2xl
                             shadow-lg active:scale-95 transition-all text-sm mt-2
                             flex items-center justify-center gap-2 disabled:opacity-60">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  {otorgando ? 'Otorgando...' : 'Otorgar Premium'}
                </button>
              </form>
            </section>

            {/* Transacciones recientes */}
            <section className="bg-surface-container-lowest p-8 rounded-[2rem]
                                border border-outline-variant/10 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold font-headline">Reporte de Ventas</h2>
                <button className="p-2 bg-surface-container-low rounded-xl text-on-surface-variant">
                  <span className="material-symbols-outlined text-base">download</span>
                </button>
              </div>
              <div className="space-y-6">
                {transaccionesFiltradas.length === 0 ? (
                  <p className="text-sm text-on-surface-variant text-center py-4">
                    Sin transacciones recientes
                  </p>
                ) : (
                  transaccionesFiltradas.map((t, i) => {
                    const estado = t.status === 'active' ? 'completed'
                                 : t.status === 'manual' ? 'pending'
                                 : 'failed'
                    const cfg = ESTADO_CONFIG[estado]
                    return (
                      <div key={t.id || i} className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full ${cfg.bg} ${cfg.text}
                                         flex items-center justify-center shrink-0`}>
                          <span className="material-symbols-outlined text-xl">{cfg.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold truncate">
                            {t.packages?.name || 'Acceso manual'}
                          </div>
                          <div className="text-xs text-on-surface-variant">
                            {tiempoRelativo(t.created_at)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold">
                            ${t.packages?.price?.toLocaleString('es-CO') || '0'}
                          </div>
                          <div className={`text-[10px] font-extrabold uppercase ${cfg.labelColor}`}>
                            {cfg.label}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <button className="w-full py-3 border border-outline-variant/50 text-on-surface-variant
                                   font-bold rounded-2xl hover:bg-surface-container transition-all
                                   text-xs flex items-center justify-center gap-2">
                  Ver todas las transacciones
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* ── FAB ── */}
      <button className="fixed bottom-8 right-8 w-14 h-14 bg-primary text-on-primary rounded-full
                         flex items-center justify-center shadow-2xl shadow-primary/25
                         active:scale-95 hover:scale-110 transition-all z-50">
        <span className="material-symbols-outlined">file_open</span>
      </button>
    </div>
  )
}