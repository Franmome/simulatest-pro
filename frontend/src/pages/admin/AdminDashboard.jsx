import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'

// ── Componente tarjeta de métrica ──────────────────────────────────────────
function StatCard({ icon, iconBg, iconColor, badge, badgeColor, label, value, dark }) {
  return (
    <div className={`p-6 rounded-xl shadow-sm border border-outline-variant/15 flex flex-col justify-between
                    ${dark ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest'}`}>
      <div className="flex justify-between items-start">
        <span className={`material-symbols-outlined p-2 rounded-lg ${iconBg} ${iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}>
          {icon}
        </span>
        {badge && (
          <span className={`flex items-center font-bold text-xs px-2 py-1 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className={`text-sm font-medium ${dark ? 'opacity-80' : 'text-on-surface-variant'}`}>{label}</p>
        <h3 className={`font-extrabold mt-1 ${dark ? 'text-2xl' : 'text-3xl'}`}>{value}</h3>
      </div>
    </div>
  )
}

// ── Componente fila de paquete popular ─────────────────────────────────────
function PaqueteRow({ icon, nombre, ventas, precio, porcentaje }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">{icon}</span>
        </div>
        <div>
          <p className="font-bold text-sm">{nombre}</p>
          <p className="text-xs text-on-surface-variant">{ventas} ventas este mes</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-secondary text-sm">${precio}</p>
        <div className="w-24 h-1.5 bg-surface-container rounded-full mt-1">
          <div className="bg-secondary h-full rounded-full transition-all"
               style={{ width: `${porcentaje}%` }} />
        </div>
      </div>
    </div>
  )
}

// ── Componente fila de actividad reciente ──────────────────────────────────
function ActividadRow({ nombre, accion, detalle, tiempo, avatar, initials, last }) {
  return (
    <div className="flex gap-4">
      {avatar
        ? <img src={avatar} alt={nombre}
               className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
        : <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center
                          text-primary font-bold text-xs flex-shrink-0">
            {initials}
          </div>
      }
      <div className={`w-full ${!last ? 'border-b border-outline-variant/20 pb-4' : ''}`}>
        <p className="text-sm">
          <span className="font-bold">{nombre} </span>
          <span className="text-on-surface-variant">{accion} </span>
          <span className="font-bold text-primary">{detalle}</span>
        </p>
        <p className="text-xs text-on-surface-variant mt-1">{tiempo}</p>
      </div>
    </div>
  )
}

// ── Dashboard principal ────────────────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [stats, setStats] = useState({
    totalUsuarios: 0,
    suscriptoresPremium: 0,
    ingresoTotal: 0,
    cargando: true,
  })

  const [paquetes, setPaquetes] = useState([])
  const [actividad, setActividad] = useState([])
  const [chartData, setChartData] = useState([])

  useEffect(() => {
    cargarStats()
    cargarPaquetes()
    cargarActividad()
    cargarChart()
  }, [])

  // ── Métricas principales ────────────────────────────────────────────────
  async function cargarStats() {
    const [{ count: totalUsuarios }, { count: suscriptoresPremium }, { data: compras }] =
      await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('purchases').select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase.from('purchases').select('packages(price)').eq('status', 'active'),
      ])

    const ingresoTotal = compras?.reduce((sum, c) => sum + (c.packages?.price || 0), 0) || 0

    setStats({
      totalUsuarios: totalUsuarios || 0,
      suscriptoresPremium: suscriptoresPremium || 0,
      ingresoTotal,
      cargando: false,
    })
  }

  // ── Paquetes más vendidos ───────────────────────────────────────────────
  async function cargarPaquetes() {
    const { data } = await supabase
      .from('packages')
      .select('id, name, price')
      .eq('is_active', true)
      .limit(3)

    if (!data) return

    const conVentas = await Promise.all(
      data.map(async (pkg) => {
        const { count } = await supabase
          .from('purchases')
          .select('*', { count: 'exact', head: true })
          .eq('package_id', pkg.id)
        return { ...pkg, ventas: count || 0 }
      })
    )

    const maxVentas = Math.max(...conVentas.map(p => p.ventas), 1)
    const iconos = ['history_edu', 'military_tech', 'balance']

    setPaquetes(conVentas.map((p, i) => ({
      ...p,
      icon: iconos[i] || 'school',
      porcentaje: Math.round((p.ventas / maxVentas) * 100),
    })))
  }

  // ── Actividad reciente ──────────────────────────────────────────────────
  async function cargarActividad() {
    const { data } = await supabase
      .from('purchases')
      .select('created_at, users(full_name), packages(name)')
      .order('created_at', { ascending: false })
      .limit(4)

    if (!data) return

    setActividad(data.map((item) => ({
      nombre: item.users?.full_name || 'Usuario',
      accion: 'adquirió',
      detalle: item.packages?.name || 'un paquete',
      tiempo: tiempoRelativo(item.created_at),
      initials: iniciales(item.users?.full_name),
    })))
  }

  // ── Datos de la gráfica ─────────────────────────────────────────────────
  async function cargarChart() {
    const dias = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })

    const resultados = await Promise.all(
      dias.map(async (dia) => {
        const { count } = await supabase
          .from('purchases')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${dia}T00:00:00`)
          .lte('created_at', `${dia}T23:59:59`)
        return { dia, count: count || 0 }
      })
    )

    setChartData(resultados)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────
  function tiempoRelativo(fecha) {
    const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
    if (diff < 60) return 'hace un momento'
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
    return `hace ${Math.floor(diff / 86400)} días`
  }

  function iniciales(nombre) {
    if (!nombre) return '?'
    return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  }

  function formatNum(n) {
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString()
  }

  const maxChart = Math.max(...chartData.map(d => d.count), 1)
  const diasLabel = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // ── Iniciales del admin ──────────────────────────────────────────────────
  const nombreAdmin = user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Admin'
  const inicialesAdmin = nombreAdmin.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarAdmin = user?.user_metadata?.avatar_url || null

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">

      {/* ── TopBar ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-6 h-16
                         border-b border-outline-variant/20 bg-surface-container-lowest/80
                         backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-4">

          {/* ── Botón volver al panel de usuario ── */}
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 rounded-full
                       bg-surface-container hover:bg-surface-container-high
                       text-on-surface-variant text-sm font-semibold
                       transition-all active:scale-95 border border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="hidden sm:block">Panel Usuario</span>
          </button>

          <div className="h-6 w-px bg-outline-variant/30" />

          <h1 className="font-headline text-xl font-extrabold text-primary tracking-tight">
            Dashboard General
          </h1>

          <div className="hidden md:flex bg-surface-container rounded-full px-4 py-1.5 items-center gap-2">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">search</span>
            <input className="bg-transparent border-none outline-none text-sm w-56
                              placeholder:text-on-surface-variant"
                   placeholder="Buscar..." type="text" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          </button>
          <div className="h-8 w-px bg-outline-variant/40 mx-1" />
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none">{nombreAdmin}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Super Admin</p>
          </div>

          {/* Avatar real del admin */}
          {avatarAdmin ? (
            <img
              src={avatarAdmin}
              alt={nombreAdmin}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center
                            text-on-primary font-bold text-xs ring-2 ring-primary/20">
              {inicialesAdmin}
            </div>
          )}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="p-8 space-y-8">

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon="group"
            iconBg="bg-primary-fixed"
            iconColor="text-primary"
            badge={stats.cargando ? '...' : null}
            label="Total Usuarios"
            value={stats.cargando ? '...' : formatNum(stats.totalUsuarios)}
          />
          <StatCard
            icon="star"
            iconBg="bg-tertiary-fixed"
            iconColor="text-tertiary"
            badge="En vivo"
            badgeColor="text-on-surface-variant text-[10px] uppercase font-bold"
            label="Suscriptores Activos"
            value={stats.cargando ? '...' : formatNum(stats.suscriptoresPremium)}
          />
          <StatCard
            icon="payments"
            iconBg="bg-secondary-fixed"
            iconColor="text-secondary"
            badge="Últimos 30d"
            badgeColor="text-secondary font-bold text-xs"
            label="Ingresos Totales"
            value={stats.cargando ? '...' : `$${stats.ingresoTotal.toLocaleString('es-CO')}`}
          />
          <StatCard
            icon="dns"
            iconBg="bg-white/10"
            iconColor="text-primary-fixed"
            badge={
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-secondary-fixed-dim rounded-full animate-pulse" />
                En línea
              </span>
            }
            badgeColor="text-secondary-fixed font-bold text-xs px-2 py-1 bg-white/10 rounded-full"
            label="Estado del Sistema"
            value="100% Activo"
            dark
          />
        </div>

        {/* ── Gráfica + Soporte ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Gráfica de ventas */}
          <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-xl
                          border border-outline-variant/15">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h4 className="text-lg font-bold font-headline">Análisis de Ventas</h4>
                <p className="text-sm text-on-surface-variant">Rendimiento diario — últimos 7 días</p>
              </div>
            </div>

            {chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-on-surface-variant text-sm">
                Cargando datos...
              </div>
            ) : (
              <>
                <div className="h-64 flex items-end justify-between gap-2">
                  {chartData.map((d, i) => {
                    const alto = Math.max((d.count / maxChart) * 100, 4)
                    const esMax = d.count === maxChart && d.count > 0
                    return (
                      <div key={i} className="w-full flex flex-col items-center gap-1">
                        {d.count > 0 && (
                          <span className="text-[10px] text-on-surface-variant">{d.count}</span>
                        )}
                        <div
                          className={`w-full rounded-t-lg transition-all hover:opacity-80
                            ${esMax ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-primary/20'}`}
                          style={{ height: `${alto}%` }}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-4 text-[10px] font-bold
                                text-on-surface-variant uppercase tracking-widest px-1">
                  {diasLabel.map(d => <span key={d}>{d}</span>)}
                </div>
              </>
            )}
          </div>

          {/* Soporte pendiente */}
          <div className="bg-surface-container-low p-8 rounded-xl flex flex-col">
            <h4 className="text-lg font-bold font-headline mb-6">Soporte Pendiente</h4>
            <div className="space-y-4 flex-1">
              {[
                { label: 'Pago fallido: #TX902',     sub: 'Hace 2 min • Facturación', color: 'bg-error'    },
                { label: 'Error de acceso: Usuario', sub: 'Hace 14 min • Auth',       color: 'bg-tertiary' },
                { label: 'Solicitud de reembolso',   sub: 'Hace 1 h • Tesorería',     color: 'bg-outline', opacity: true },
              ].map((t, i) => (
                <div key={i} className={`bg-surface-container-lowest p-4 rounded-lg
                                         flex items-center gap-4 ${t.opacity ? 'opacity-60' : ''}`}>
                  <div className={`w-2 h-10 ${t.color} rounded-full flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{t.label}</p>
                    <p className="text-xs text-on-surface-variant">{t.sub}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="mt-6 w-full py-2 text-primary font-bold text-sm hover:underline">
              Ver todos los tickets
            </button>
          </div>
        </div>

        {/* ── Paquetes + Actividad ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Paquetes populares */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/15">
            <div className="flex justify-between items-center mb-8">
              <h4 className="text-lg font-bold font-headline">Paquetes Populares</h4>
              <button
                onClick={() => navigate('/admin/paquetes')}
                className="text-primary text-sm font-bold hover:underline"
              >
                Ver todos
              </button>
            </div>

            {paquetes.length === 0 ? (
              <div className="space-y-6">
                {[85, 65, 45].map((p, i) => (
                  <PaqueteRow
                    key={i}
                    icon={['history_edu', 'military_tech', 'balance'][i]}
                    nombre="Sin datos aún"
                    ventas={0}
                    precio="0"
                    porcentaje={p}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {paquetes.map((p) => (
                  <PaqueteRow
                    key={p.id}
                    icon={p.icon}
                    nombre={p.name}
                    ventas={p.ventas}
                    precio={p.price?.toLocaleString('es-CO') || '0'}
                    porcentaje={p.porcentaje}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="bg-surface-container-lowest p-8 rounded-xl border border-outline-variant/15">
            <h4 className="text-lg font-bold font-headline mb-8">Actividad Reciente</h4>

            {actividad.length === 0 ? (
              <p className="text-sm text-on-surface-variant text-center py-8">
                Sin actividad reciente
              </p>
            ) : (
              <div className="space-y-6">
                {actividad.map((a, i) => (
                  <ActividadRow
                    key={i}
                    {...a}
                    last={i === actividad.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        onClick={() => navigate('/admin/evaluaciones/nueva')}
        className="fixed bottom-8 right-8 bg-primary text-on-primary w-14 h-14 rounded-full
                   shadow-2xl flex items-center justify-center hover:scale-110
                   active:scale-95 transition-all z-50"
      >
        <span className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>
    </div>
  )
}