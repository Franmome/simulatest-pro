import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../utils/supabase'

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 8

const SEVERITY_CONFIG = {
  critical: {
    label: 'Crítico',
    icon: 'error',
    chip: 'bg-error-container text-on-error-container',
    iconBg: 'bg-error-container/40 text-error',
    dot: 'bg-error',
  },
  warning: {
    label: 'Advertencia',
    icon: 'warning',
    chip: 'bg-tertiary-container/20 text-tertiary',
    iconBg: 'bg-tertiary-container/20 text-tertiary',
    dot: 'bg-tertiary',
  },
  info: {
    label: 'Info',
    icon: 'info',
    chip: 'bg-primary/10 text-primary',
    iconBg: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
  },
}

const STATUS_CONFIG = {
  pending: {
    label: 'Pendiente',
    chip: 'bg-tertiary-container/20 text-tertiary',
  },
  resolved: {
    label: 'Resuelto',
    chip: 'bg-secondary-container text-on-secondary-container',
  },
  ignored: {
    label: 'Ignorado',
    chip: 'bg-surface-container text-on-surface-variant',
  },
}

function tiempoRelativo(fecha) {
  if (!fecha) return '—'
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function formatCompact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n || 0}`
}

function StatCard({ title, value, subtitle, icon, tone = 'primary' }) {
  const toneMap = {
    primary: 'bg-surface-container-lowest',
    error: 'bg-surface-container-lowest',
    secondary: 'bg-surface-container-lowest',
    highlight: 'bg-primary text-on-primary',
  }

  const iconMap = {
    primary: 'bg-primary-fixed text-primary',
    error: 'bg-error-container/30 text-error',
    secondary: 'bg-secondary-container/30 text-secondary',
    highlight: 'bg-white/15 text-white',
  }

  return (
    <div className={`${toneMap[tone]} rounded-2xl border border-outline-variant/15 shadow-sm p-6 min-h-[148px]`}>
      <div className={`w-10 h-10 rounded-xl ${iconMap[tone]} flex items-center justify-center mb-4`}>
        <span
          className="material-symbols-outlined text-lg"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>

      <div className={`text-3xl font-black font-headline ${tone === 'highlight' ? 'text-on-primary' : 'text-on-surface'}`}>
        {typeof value === 'number' ? formatCompact(value) : value}
      </div>

      <div className={`text-sm font-bold mt-1 ${tone === 'highlight' ? 'text-on-primary' : 'text-on-surface'}`}>
        {title}
      </div>

      <div className={`text-xs mt-1 ${tone === 'highlight' ? 'text-primary-fixed' : 'text-on-surface-variant'}`}>
        {subtitle}
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

// ─────────────────────────────────────────────────────────────────────────────
// Métricas
// ─────────────────────────────────────────────────────────────────────────────
async function fetchMetrics() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [errorsRes, sessionsRes, uptimeRes] = await Promise.all([
    supabase
      .from('system_errors')
      .select('id, severity, status', { count: 'exact' })
      .gte('created_at', todayStart.toISOString()),

    supabase
      .from('attempts')
      .select('id', { count: 'exact' })
      .eq('status', 'in_progress'),

    supabase
      .from('system_errors')
      .select('id', { count: 'exact' })
      .eq('severity', 'critical')
      .gte('created_at', todayStart.toISOString()),
  ])

  const totalErrors = errorsRes.count ?? 0
  const activeSessions = sessionsRes.count ?? 0
  const criticalToday = uptimeRes.count ?? 0

  return { totalErrors, activeSessions, criticalToday }
}

// ─────────────────────────────────────────────────────────────────────────────
// Principal
// ─────────────────────────────────────────────────────────────────────────────
export default function AdminErrores() {
  const [errors, setErrors] = useState([])
  const [metrics, setMetrics] = useState({
    totalErrors: 0,
    activeSessions: 0,
    criticalToday: 0,
  })

  const [filter, setFilter] = useState('all') // all | critical | pending
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(null)
  const [msg, setMsg] = useState('')

  const loadErrors = useCallback(async () => {
    setLoading(true)
    setMsg('')

    try {
      let query = supabase
        .from('system_errors')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (filter === 'critical') query = query.eq('severity', 'critical')
      if (filter === 'pending') query = query.eq('status', 'pending')
      if (search.trim()) query = query.ilike('description', `%${search.trim()}%`)

      const { data, count, error } = await query
      if (error) throw error

      setErrors(data ?? [])
      setTotal(count ?? 0)
    } catch (err) {
      setErrors([])
      setMsg('No se pudieron cargar los errores.')
    } finally {
      setLoading(false)
    }
  }, [filter, search, page])

  const loadMetrics = useCallback(async () => {
    try {
      const m = await fetchMetrics()
      setMetrics(m)
    } catch {
      // opcional
    }
  }, [])

  useEffect(() => {
    loadErrors()
    loadMetrics()
  }, [loadErrors, loadMetrics])

  useEffect(() => {
    setPage(1)
  }, [filter, search])

  async function resolveError(id) {
    setResolving(id)

    try {
      const { error } = await supabase
        .from('system_errors')
        .update({ status: 'resolved' })
        .eq('id', id)

      if (error) throw error

      setErrors(prev => prev.map(e => (e.id === id ? { ...e, status: 'resolved' } : e)))
      setMetrics(prev => ({
        ...prev,
        totalErrors: Math.max(0, prev.totalErrors - 1),
      }))
      setMsg('Incidente marcado como resuelto.')
      setTimeout(() => setMsg(''), 1800)
    } catch {
      setMsg('No se pudo actualizar el incidente.')
    } finally {
      setResolving(null)
    }
  }

  function exportLogs() {
    const rows = [
      ['Severidad', 'Código', 'Descripción', 'Estado', 'Fecha'],
      ...errors.map(e => [
        e.severity ?? '',
        e.error_code ?? '',
        e.description ?? '',
        e.status ?? '',
        e.created_at ?? '',
      ]),
    ]

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `errores-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const resumen = useMemo(() => {
    const critical = errors.filter(e => e.severity === 'critical').length
    const pending = errors.filter(e => e.status === 'pending').length
    return { critical, pending }
  }, [errors])

  return (
    <div className="min-h-screen bg-background">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Errores</span>
            </nav>

            <h1 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
              Monitoreo de Errores
            </h1>

            <p className="text-on-surface-variant mt-1 text-sm max-w-2xl">
              Revisa incidentes, marca errores como resueltos y exporta logs para análisis técnico.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadErrors}
              className="px-5 py-2.5 rounded-full border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Actualizar
            </button>

            <button
              onClick={exportLogs}
              className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-sm font-bold shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <StatCard
            title="Errores hoy"
            value={metrics.totalErrors}
            subtitle="Incidentes registrados desde hoy"
            icon="bug_report"
            tone="error"
          />

          <StatCard
            title="Críticos hoy"
            value={metrics.criticalToday}
            subtitle="Incidentes severidad crítica"
            icon="emergency"
            tone="highlight"
          />

          <StatCard
            title="Sesiones activas"
            value={metrics.activeSessions}
            subtitle="Intentos en progreso ahora"
            icon="play_circle"
            tone="secondary"
          />

          <StatCard
            title="Pendientes visibles"
            value={resumen.pending}
            subtitle="En la página actual según filtros"
            icon="hourglass_top"
            tone="primary"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Principal */}
          <div className="lg:col-span-9 space-y-6">
            <section className="bg-surface-container-lowest rounded-[2rem] shadow-sm overflow-hidden border border-outline-variant/15">
              <div className="px-8 py-6 border-b border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-bold font-headline">Incidentes recientes</h3>
                  <span className="text-xs font-bold text-on-surface-variant">{total} total</span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Buscar errores..."
                      className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all w-56"
                    />
                  </div>

                  <div className="flex gap-2">
                    {[
                      { key: 'all', label: 'Todos' },
                      { key: 'critical', label: 'Críticos' },
                      { key: 'pending', label: 'Pendientes' },
                    ].map(f => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={`px-4 py-2 text-xs font-bold rounded-full transition-colors ${
                          filter === f.key
                            ? 'bg-primary text-on-primary'
                            : 'bg-surface-container-low text-on-surface-variant hover:text-primary'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {msg && (
                <div className={`mx-8 mt-6 px-4 py-3 rounded-xl text-sm font-bold ${
                  msg.includes('No se pudo')
                    ? 'bg-error-container text-error'
                    : 'bg-secondary-container text-on-secondary-container'
                }`}>
                  {msg}
                </div>
              )}

              <div className="divide-y divide-outline-variant/10">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-8 py-6">
                      <div className="h-4 bg-surface-container rounded animate-pulse w-3/4 mb-3" />
                      <div className="h-3 bg-surface-container rounded animate-pulse w-1/2" />
                    </div>
                  ))
                ) : errors.length === 0 ? (
                  <div className="px-8 py-16 text-center">
                    <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">
                      verified
                    </span>
                    <p className="text-on-surface-variant font-semibold">
                      No hay incidentes con esos filtros
                    </p>
                  </div>
                ) : (
                  errors.map(err => {
                    const sev = SEVERITY_CONFIG[err.severity] || SEVERITY_CONFIG.info
                    const st = STATUS_CONFIG[err.status] || STATUS_CONFIG.pending

                    return (
                      <div key={err.id} className="px-8 py-6 hover:bg-surface-container-low/30 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className={`w-11 h-11 rounded-2xl ${sev.iconBg} flex items-center justify-center flex-shrink-0`}>
                            <span className="material-symbols-outlined text-xl">{sev.icon}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${sev.chip}`}>
                                {sev.label}
                              </span>

                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${st.chip}`}>
                                {st.label}
                              </span>

                              {err.error_code && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface-container text-on-surface-variant">
                                  {err.error_code}
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-sm text-on-surface">
                              {err.description || 'Sin descripción'}
                            </p>

                            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-on-surface-variant">
                              <span>{tiempoRelativo(err.created_at)}</span>
                              {err.created_at && (
                                <span>
                                  {new Date(err.created_at).toLocaleString('es-CO')}
                                </span>
                              )}
                              {err.path && <span>Ruta: {err.path}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {err.status !== 'resolved' && (
                              <button
                                onClick={() => resolveError(err.id)}
                                disabled={resolving === err.id}
                                className="px-4 py-2 rounded-full bg-secondary text-on-secondary text-xs font-bold hover:bg-secondary/90 transition-all disabled:opacity-50"
                              >
                                {resolving === err.id ? 'Resolviendo...' : 'Marcar resuelto'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {totalPages > 1 && (
                <div className="px-8 py-5 border-t border-outline-variant/10 flex items-center justify-between">
                  <p className="text-sm text-on-surface-variant">
                    Mostrando{' '}
                    <span className="font-bold text-on-surface">
                      {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
                      {Math.min(page * PAGE_SIZE, total)}
                    </span>{' '}
                    de <span className="font-bold text-on-surface">{total}</span>
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 transition-all"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>

                    {Array.from({ length: Math.min(totalPages, 4) }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                          page === p
                            ? 'bg-primary text-on-primary shadow-md'
                            : 'border border-outline-variant hover:bg-surface-container-low'
                        }`}
                      >
                        {p}
                      </button>
                    ))}

                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 transition-all"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-8">
            <HelpBox
              title="Cómo usar este módulo"
              items={[
                'Usa “Críticos” para priorizar fallos graves.',
                'Usa “Pendientes” para limpiar la cola de incidentes sin resolver.',
                'Exporta CSV cuando necesites revisar logs fuera del panel.',
              ]}
            />

            <section className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/15 shadow-sm">
              <h3 className="text-lg font-bold font-headline mb-4">Resumen actual</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">Críticos en página</span>
                    <span className="font-bold text-on-surface">{resumen.critical}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container mt-2 overflow-hidden">
                    <div
                      className="h-full bg-error rounded-full"
                      style={{ width: `${errors.length ? (resumen.critical / errors.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-on-surface-variant">Pendientes en página</span>
                    <span className="font-bold text-on-surface">{resumen.pending}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container mt-2 overflow-hidden">
                    <div
                      className="h-full bg-tertiary rounded-full"
                      style={{ width: `${errors.length ? (resumen.pending / errors.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-primary p-6 rounded-2xl shadow-xl shadow-primary/10 text-on-primary relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-bold text-sm mb-2">Estado operativo</h3>
                <p className="text-xs opacity-90 leading-relaxed">
                  {metrics.criticalToday === 0
                    ? 'No se registran críticos hoy. El sistema luce estable.'
                    : `Se detectaron ${metrics.criticalToday} incidentes críticos hoy. Conviene revisar esta cola.`}
                </p>

                <div className="mt-4 space-y-3">
                  <div>
                    <div className="flex justify-between text-[10px] mb-1 font-bold">
                      <span>ERRORES HOY</span>
                      <span>{metrics.totalErrors}</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${Math.min(metrics.totalErrors * 10, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1 font-bold">
                      <span>SESIONES EN PROGRESO</span>
                      <span>{metrics.activeSessions}</span>
                    </div>
                    <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${Math.min(metrics.activeSessions * 10, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}