import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

function formatCompact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n || 0}`
}

function tiempoRelativo(fecha) {
  if (!fecha) return '—'
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function DashboardCard({ title, value, subtitle, icon, tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary-fixed text-primary',
    secondary: 'bg-secondary-container/40 text-secondary',
    tertiary: 'bg-tertiary-fixed text-tertiary',
    blue: 'bg-blue-100 text-blue-700',
    orange: 'bg-orange-100 text-orange-700',
    green: 'bg-green-100 text-green-700',
  }

  return (
    <div className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
      <div className={`w-10 h-10 rounded-xl ${tones[tone]} flex items-center justify-center mb-4`}>
        <span
          className="material-symbols-outlined text-lg"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>

      <p className="text-3xl font-black font-headline text-on-surface">{formatCompact(value)}</p>
      <p className="text-sm font-bold text-on-surface mt-1">{title}</p>
      <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>
    </div>
  )
}

function QuickAction({ title, subtitle, icon, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 hover:bg-surface-container-low/40 transition-all group"
    >
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors">
            {title}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">{subtitle}</p>
        </div>

        <span className="material-symbols-outlined text-on-surface-variant text-lg">
          arrow_forward
        </span>
      </div>
    </button>
  )
}

export default function AdminDashboard() {
  const navigate = useNavigate()

  const [stats, setStats] = useState({
    evaluaciones: 0,
    usuarios: 0,
    paquetes: 0,
    preguntas: 0,
    materiales: 0,
    compras: 0,
    activas: 0,
    erroresPendientes: 0,
  })

  const [actividad, setActividad] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    cargarDashboard()
  }, [])

  async function cargarDashboard() {
    setCargando(true)

    try {
      const [
        { count: evaluaciones },
        { count: usuarios },
        { count: paquetes },
        { count: preguntas },
        { count: materiales },
        { count: compras },
        { count: activas },
        { count: erroresPendientes },
        { data: paquetesRecientes },
        { data: usuariosRecientes },
      ] = await Promise.all([
        supabase.from('evaluations').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('packages').select('*', { count: 'exact', head: true }),
        supabase.from('questions').select('*', { count: 'exact', head: true }),
        supabase.from('study_materials').select('*', { count: 'exact', head: true }),
        supabase.from('purchases').select('*', { count: 'exact', head: true }),
        supabase.from('packages').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('system_errors').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase
          .from('packages')
          .select('id, name, created_at, is_active')
          .order('created_at', { ascending: false })
          .limit(4),
        supabase
          .from('users')
          .select('id, full_name, created_at')
          .order('created_at', { ascending: false })
          .limit(4),
      ])

      setStats({
        evaluaciones: evaluaciones || 0,
        usuarios: usuarios || 0,
        paquetes: paquetes || 0,
        preguntas: preguntas || 0,
        materiales: materiales || 0,
        compras: compras || 0,
        activas: activas || 0,
        erroresPendientes: erroresPendientes || 0,
      })

      const actividadPaquetes = (paquetesRecientes || []).map(item => ({
        tipo: 'paquete',
        titulo: item.is_active ? 'Paquete publicado' : 'Paquete creado',
        descripcion: item.name,
        fecha: item.created_at,
      }))

      const actividadUsuarios = (usuariosRecientes || []).map(item => ({
        tipo: 'usuario',
        titulo: 'Nuevo usuario registrado',
        descripcion: item.full_name || item.id,
        fecha: item.created_at,
      }))

      const mezclada = [...actividadPaquetes, ...actividadUsuarios]
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 6)

      setActividad(mezclada)
    } finally {
      setCargando(false)
    }
  }

  const saludSistema = useMemo(() => {
    if (stats.erroresPendientes === 0) return 'Estable'
    if (stats.erroresPendientes <= 5) return 'Con alertas'
    return 'Revisar'
  }, [stats.erroresPendientes])

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Dashboard</span>
            </nav>

            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Dashboard Admin
            </h1>

            <p className="text-on-surface-variant mt-1 text-sm max-w-2xl">
              Vista general de la plataforma, contenido académico, usuarios, ventas y salud operativa.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={cargarDashboard}
              className="px-5 py-2.5 bg-surface-container-lowest text-on-surface-variant font-semibold text-sm rounded-full flex items-center gap-2 shadow-sm hover:bg-surface-bright transition-all border border-outline-variant"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              Actualizar
            </button>

            <button
              onClick={() => navigate('/admin/evaluaciones/nueva')}
              className="px-6 py-3 rounded-full bg-primary text-on-primary font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Nuevo paquete
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-8 bg-primary rounded-3xl text-on-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20" />
            <div className="relative z-10">
              <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Estado general
              </span>

              <div className="mt-4">
                <h2 className="text-4xl font-black font-headline tracking-tight">
                  {cargando ? 'Cargando...' : `${stats.paquetes} paquetes · ${stats.evaluaciones} evaluaciones`}
                </h2>
                <p className="text-sm text-primary-fixed mt-2 max-w-2xl">
                  {cargando
                    ? 'Consultando información...'
                    : `Actualmente hay ${stats.activas} paquetes activos, ${stats.preguntas} preguntas cargadas y ${stats.materiales} materiales de estudio en la base.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mt-6">
                <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
                  Salud: {saludSistema}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
                  Errores pendientes: {stats.erroresPendientes}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/15 text-xs font-bold">
                  Compras: {stats.compras}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 bg-surface-container-lowest rounded-3xl border border-outline-variant/15 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4">
              Resumen rápido
            </p>

            <div className="space-y-4">
              {[
                { label: 'Usuarios registrados', value: stats.usuarios },
                { label: 'Preguntas en banco', value: stats.preguntas },
                { label: 'Materiales cargados', value: stats.materiales },
                { label: 'Errores pendientes', value: stats.erroresPendientes },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-on-surface-variant">{item.label}</span>
                  <span className="text-sm font-black text-on-surface">{formatCompact(item.value)}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-outline-variant/10">
              <button
                onClick={() => navigate('/admin/errores')}
                className="w-full py-3 rounded-2xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all flex items-center justify-center gap-2"
              >
                Ver reporte de errores
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <DashboardCard
            title="Evaluaciones"
            value={stats.evaluaciones}
            subtitle="Simulacros base registrados"
            icon="inventory_2"
            tone="primary"
          />
          <DashboardCard
            title="Usuarios"
            value={stats.usuarios}
            subtitle="Cuentas registradas"
            icon="group"
            tone="secondary"
          />
          <DashboardCard
            title="Paquetes"
            value={stats.paquetes}
            subtitle="Productos comerciales"
            icon="package_2"
            tone="blue"
          />
          <DashboardCard
            title="Compras"
            value={stats.compras}
            subtitle="Accesos vendidos u otorgados"
            icon="payments"
            tone="green"
          />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg font-headline">Accesos rápidos</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Atajos a las áreas que más vas a usar
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <QuickAction
                  title="Gestión de evaluaciones"
                  subtitle="Crear, editar y organizar simulacros, niveles y preguntas."
                  icon="quiz"
                  onClick={() => navigate('/admin/evaluaciones')}
                />
                <QuickAction
                  title="Gestión de paquetes"
                  subtitle="Revisar catálogo, estado comercial y publicación."
                  icon="inventory_2"
                  onClick={() => navigate('/admin/paquetes')}
                />
                <QuickAction
                  title="Usuarios"
                  subtitle="Ver estudiantes, accesos premium y campañas."
                  icon="group"
                  onClick={() => navigate('/admin/usuarios')}
                />
                <QuickAction
                  title="Tesorería"
                  subtitle="Control de ventas, cupones y accesos manuales."
                  icon="account_balance_wallet"
                  onClick={() => navigate('/admin/tesoreria')}
                />
                <QuickAction
                  title="Editor administrativo"
                  subtitle="Cambiar textos visibles en home, suscripciones y configuración."
                  icon="edit_note"
                  onClick={() => navigate('/admin/editor')}
                />
                <QuickAction
                  title="Errores del sistema"
                  subtitle="Monitorear fallos, incidencias y estado operativo."
                  icon="bug_report"
                  onClick={() => navigate('/admin/errores')}
                />
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg font-headline">Guía rápida del flujo</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Resumen del proceso correcto para crear contenido
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  'Crea la evaluación base con su nombre, descripción y categoría.',
                  'Agrega niveles si cambian preguntas o respuestas según cargo o profesión.',
                  'Carga preguntas manualmente o por CSV en el nivel correcto.',
                  'Agrega versiones y precios si el paquete cambia por profesión.',
                  'Sube material de estudio y luego publica el paquete.',
                ].map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold shrink-0">
                      {i + 1}
                    </div>
                    <p className="text-sm text-on-surface-variant">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="font-bold text-lg font-headline">Actividad reciente</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Últimos movimientos detectados en la plataforma
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {cargando ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-12 rounded-xl bg-surface-container animate-pulse" />
                  ))
                ) : actividad.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Sin actividad reciente</p>
                ) : (
                  actividad.map((item, i) => (
                    <div key={i} className="flex gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                        item.tipo === 'paquete' ? 'bg-primary' : 'bg-secondary'
                      }`} />
                      <div>
                        <p className="text-sm font-bold text-on-surface">{item.titulo}</p>
                        <p className="text-xs text-on-surface-variant">{item.descripcion}</p>
                        <p className="text-[10px] text-on-surface-variant mt-1">
                          {tiempoRelativo(item.fecha)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  stats.erroresPendientes === 0
                    ? 'bg-secondary-container/40 text-secondary'
                    : 'bg-error-container/40 text-error'
                }`}>
                  <span className="material-symbols-outlined">
                    {stats.erroresPendientes === 0 ? 'verified' : 'warning'}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-lg font-headline">Salud operativa</h3>
                  <p className="text-xs text-on-surface-variant">Estado actual del panel y sistema</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Estado general</span>
                  <span className="font-bold text-on-surface">{saludSistema}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Paquetes activos</span>
                  <span className="font-bold text-on-surface">{stats.activas}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Errores pendientes</span>
                  <span className={`font-bold ${stats.erroresPendientes > 0 ? 'text-error' : 'text-secondary'}`}>
                    {stats.erroresPendientes}
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-outline-variant/10">
                <button
                  onClick={() => navigate('/admin/errores')}
                  className="w-full py-3 rounded-2xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all"
                >
                  Abrir monitoreo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}