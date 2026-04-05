import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabase'

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '—'
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} d`
}

function severityMeta(severity) {
  switch (severity) {
    case 'critical':
      return {
        label: 'Crítico',
        dot: 'bg-error animate-pulse',
        badge: 'bg-error/10 text-error',
      }
    case 'warning':
      return {
        label: 'Advertencia',
        dot: 'bg-tertiary-container',
        badge: 'bg-tertiary-fixed text-tertiary',
      }
    default:
      return {
        label: 'Info',
        dot: 'bg-secondary',
        badge: 'bg-primary-fixed text-primary',
      }
  }
}

function statusMeta(status) {
  switch (status) {
    case 'pending':
      return { label: 'Pendiente', dot: 'bg-tertiary-container animate-pulse', text: 'text-tertiary' }
    case 'resolved':
      return { label: 'Resuelto', dot: 'bg-secondary', text: 'text-secondary' }
    default:
      return { label: status, dot: 'bg-slate-400', text: 'text-slate-500' }
  }
}

// ─── Métricas desde Supabase ────────────────────────────────────────────────

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

// ─── Componente principal ────────────────────────────────────────────────────

export default function AdminErrores() {
  const [errors, setErrors] = useState([])
  const [metrics, setMetrics] = useState({ totalErrors: 0, activeSessions: 0, criticalToday: 0 })
  const [filter, setFilter] = useState('all') // all | critical | pending
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState(null)

  const PAGE_SIZE = 8

  // ── Cargar errores ──────────────────────────────────────────────────────
  const loadErrors = useCallback(async () => {
    setLoading(true)
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
    } catch {
      setErrors([])
    } finally {
      setLoading(false)
    }
  }, [filter, search, page])

  // ── Cargar métricas ─────────────────────────────────────────────────────
  const loadMetrics = useCallback(async () => {
    try {
      const m = await fetchMetrics()
      setMetrics(m)
    } catch {
      // métricas opcionales
    }
  }, [])

  useEffect(() => {
    loadErrors()
    loadMetrics()
  }, [loadErrors, loadMetrics])

  // Reiniciar página al cambiar filtro o búsqueda
  useEffect(() => { setPage(1) }, [filter, search])

  // ── Marcar como resuelto ────────────────────────────────────────────────
  async function resolveError(id) {
    setResolving(id)
    try {
      const { error } = await supabase
        .from('system_errors')
        .update({ status: 'resolved' })
        .eq('id', id)
      if (error) throw error
      setErrors(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e))
      setMetrics(prev => ({
        ...prev,
        totalErrors: Math.max(0, prev.totalErrors - 1),
      }))
    } finally {
      setResolving(null)
    }
  }

  // ── Exportar logs (CSV) ────────────────────────────────────────────────
  function exportLogs() {
    const rows = [
      ['Severidad', 'Código', 'Descripción', 'Estado', 'Fecha'],
      ...errors.map(e => [
        e.severity,
        e.error_code ?? '',
        e.description ?? '',
        e.status,
        e.created_at,
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `errores-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Encabezado ── */}
        <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h2 className="text-3xl font-extrabold text-on-surface tracking-tight font-headline">
              Reporte de Errores del Sistema
            </h2>
            <p className="text-slate-500 mt-1 max-w-2xl font-body text-sm">
              Diagnóstico en tiempo real e historial de incidentes de la plataforma.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={exportLogs}
              className="px-5 py-2.5 bg-surface-container-lowest text-on-surface-variant font-semibold text-sm rounded-full flex items-center gap-2 shadow-sm hover:bg-surface-bright transition-all border border-outline-variant"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Exportar Logs
            </button>
            <button
              onClick={() => { loadErrors(); loadMetrics() }}
              className="px-5 py-2.5 bg-primary text-on-primary font-bold text-sm rounded-full flex items-center gap-2 active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-lg">refresh</span>
              Actualizar
            </button>
          </div>
        </section>

        {/* ── Tarjetas de métricas ── */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6">

          {/* Uptime */}
          <div className="md:col-span-2 p-8 bg-primary rounded-3xl text-on-primary relative overflow-hidden flex flex-col justify-between min-h-[200px]">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20" />
            <div className="z-10">
              <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-bold uppercase tracking-widest">
                Estado Global
              </span>
              <div className="mt-4 flex items-center gap-4">
                <h3 className="text-5xl font-black font-headline tracking-tighter">
                  99.98<span className="text-2xl text-primary-fixed-dim">%</span>
                </h3>
                <div className="flex flex-col">
                  <span className="text-sm font-bold leading-none">Disponibilidad</span>
                  <span className="text-xs text-on-primary-container/80 mt-1">Últimos 30 días</span>
                </div>
              </div>
            </div>
            <div className="z-10 flex items-center gap-6 mt-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 bg-secondary-fixed rounded-full animate-pulse" />
                <span className="text-xs font-semibold">Todos los nodos activos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span className="text-xs font-semibold">Último ping: 2s</span>
              </div>
            </div>
          </div>

          {/* Errores hoy */}
          <div className="p-8 bg-surface-container-low rounded-3xl flex flex-col justify-between">
            <div>
              <div className="h-12 w-12 bg-error-container rounded-2xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-on-error-container">bug_report</span>
              </div>
              <p className="text-sm font-bold text-slate-500">Errores hoy</p>
            </div>
            <div className="mt-4">
              <h3 className="text-4xl font-extrabold text-on-surface font-headline">
                {loading ? '—' : metrics.totalErrors}
              </h3>
              <p className="text-xs text-error font-semibold flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-sm">warning</span>
                {metrics.criticalToday} crítico{metrics.criticalToday !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Sesiones activas */}
          <div className="p-8 bg-surface-container-lowest rounded-3xl flex flex-col justify-between shadow-sm">
            <div>
              <div className="h-12 w-12 bg-secondary-container rounded-2xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-on-secondary-container">group</span>
              </div>
              <p className="text-sm font-bold text-slate-500">Simulacros activos</p>
            </div>
            <div className="mt-4">
              <h3 className="text-4xl font-extrabold text-on-surface font-headline">
                {loading ? '—' : metrics.activeSessions.toLocaleString('es-CO')}
              </h3>
              <p className="text-xs text-secondary font-semibold flex items-center gap-1 mt-1">
                <span className="material-symbols-outlined text-sm">play_circle</span>
                En progreso ahora
              </p>
            </div>
          </div>
        </section>

        {/* ── Tabla de incidentes ── */}
        <section className="bg-surface-container-lowest rounded-[2rem] shadow-sm overflow-hidden">

          {/* Barra superior */}
          <div className="px-8 py-6 border-b border-surface-container-low flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <h3 className="text-xl font-bold font-headline">Incidentes recientes</h3>
              <span className="text-xs font-bold text-slate-400">{total} total</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {/* Búsqueda */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar errores..."
                  className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-full text-sm focus:ring-2 focus:ring-primary/20 transition-all w-52"
                />
              </div>
              {/* Filtros */}
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
                        : 'text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low/50">
                  {['Severidad', 'Código', 'Descripción', 'Hace', 'Estado', ''].map(h => (
                    <th
                      key={h}
                      className={`px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 ${h === '' ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-6 py-5">
                          <div className="h-4 bg-surface-container-low rounded animate-pulse w-24" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : errors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-16 text-center text-slate-400 text-sm">
                      <span className="material-symbols-outlined text-4xl block mb-2">check_circle</span>
                      No se encontraron errores con ese filtro
                    </td>
                  </tr>
                ) : (
                  errors.map(err => {
                    const sev = severityMeta(err.severity)
                    const sta = statusMeta(err.status)
                    return (
                      <tr key={err.id} className="hover:bg-surface-bright/50 transition-colors">
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase ${sev.badge}`}>
                            {sev.label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <code className="text-sm font-mono text-primary font-bold">
                            {err.error_code ?? 'ERR-000'}
                          </code>
                        </td>
                        <td className="px-6 py-5">
                          <div className="max-w-xs">
                            <p className="text-sm font-semibold text-on-surface truncate">
                              {err.description ?? 'Sin descripción'}
                            </p>
                            {err.detail && (
                              <p className="text-xs text-slate-500 truncate">{err.detail}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="text-sm text-slate-600">{timeAgo(err.created_at)}</p>
                          <p className="text-[10px] text-slate-400">
                            {err.created_at
                              ? new Date(err.created_at).toLocaleString('es-CO', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  day: '2-digit',
                                  month: 'short',
                                })
                              : ''}
                          </p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${sta.dot}`} />
                            <span className={`text-xs font-bold ${sta.text}`}>{sta.label}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {err.status !== 'resolved' && (
                            <button
                              onClick={() => resolveError(err.id)}
                              disabled={resolving === err.id}
                              className="px-3 py-1.5 text-xs font-bold text-primary border border-primary/30 rounded-full hover:bg-primary hover:text-on-primary transition-all disabled:opacity-40"
                            >
                              {resolving === err.id ? 'Guardando...' : 'Resolver'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="px-8 py-6 bg-surface-container-low/30 flex justify-between items-center text-xs font-bold text-slate-500">
            <p>
              {total === 0
                ? 'Sin resultados'
                : `Mostrando ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} de ${total}`}
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 hover:text-primary disabled:opacity-30"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 hover:text-primary disabled:opacity-30"
              >
                Siguiente
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Estado de nodos ── */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-12">
          <NodeCard
            label="Nodo Principal"
            status="ACTIVO"
            statusOk
            metric="Uso CPU"
            value={42}
            color="bg-primary"
          />
          <NodeCard
            label="Clúster de Base de Datos"
            status="ACTIVO"
            statusOk
            metric="Carga de Memoria"
            value={78}
            color="bg-tertiary-container"
            valueColor="text-tertiary"
          />
          <NodeCard
            label="CDN Edge (LatAm)"
            status="INESTABLE"
            statusOk={false}
            metric="Pérdida de Solicitudes"
            value={12}
            color="bg-error"
            valueColor="text-error"
            danger
          />
        </section>

      </div>
    </div>
  )
}

// ─── Subcomponente: tarjeta de nodo ─────────────────────────────────────────

function NodeCard({ label, status, statusOk, metric, value, color, valueColor = 'text-primary', danger = false }) {
  return (
    <div className={`p-6 bg-surface-container-low rounded-3xl space-y-4 ${danger ? 'border-2 border-error/10' : ''}`}>
      <div className="flex justify-between items-center">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">{label}</p>
        <span
          className={`px-2 py-0.5 text-[9px] font-black rounded-full ${
            statusOk
              ? 'bg-secondary-fixed text-on-secondary-fixed'
              : 'bg-error-container text-on-error-container'
          }`}
        >
          {status}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold">
          <span>{metric}</span>
          <span className={valueColor}>{value}%</span>
        </div>
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
        </div>
      </div>
    </div>
  )
}