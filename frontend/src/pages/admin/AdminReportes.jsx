import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../utils/supabase'

const TIPO_CONFIG = {
  extraccion_pdf: { label: 'Extracción PDF',  icon: 'picture_as_pdf', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  analisis:       { label: 'Análisis',         icon: 'psychology',     chip: 'bg-blue-100  text-blue-700  dark:bg-blue-900/30  dark:text-blue-400'  },
  resultado:      { label: 'Resultado',        icon: 'quiz',           chip: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  otro:           { label: 'Otro',             icon: 'help',           chip: 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-400'  },
}

const PAGE_SIZE = 20

export default function AdminReportes() {
  const [reportes,   setReportes]   = useState([])
  const [total,      setTotal]      = useState(0)
  const [page,       setPage]       = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [expanded,   setExpanded]   = useState(null)
  const [soloAbiertos, setSoloAbiertos] = useState(true)
  const [token,      setToken]      = useState(null)

  const BASE = import.meta.env.VITE_API_URL || ''

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setToken(session?.access_token || null)
    })
  }, [])

  const fetchReportes = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit: PAGE_SIZE })
      const res    = await fetch(`${BASE}/api/reportes/admin?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error cargando reportes')
      const json = await res.json()
      const lista = soloAbiertos ? (json.reportes || []).filter(r => !r.resuelto) : (json.reportes || [])
      setReportes(lista)
      setTotal(json.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [token, page, soloAbiertos, BASE])

  useEffect(() => { fetchReportes() }, [fetchReportes])

  async function toggleResuelto(id, resueltoActual) {
    try {
      const res = await fetch(`${BASE}/api/reportes/admin/${id}`, {
        method:  'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ resuelto: !resueltoActual }),
      })
      if (res.ok) fetchReportes()
    } catch { /* silencioso */ }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold font-headline">Reportes de usuarios</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">Problemas reportados desde el análisis de perfil</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <div
              onClick={() => { setSoloAbiertos(s => !s); setPage(1) }}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer flex items-center px-0.5
                ${soloAbiertos ? 'bg-primary' : 'bg-surface-container-highest'}`}
            >
              <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${soloAbiertos ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span>Solo abiertos</span>
          </label>
          <button onClick={fetchReportes} className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Actualizar
          </button>
        </div>
      </div>

      {/* Contador */}
      <p className="text-xs text-on-surface-variant">{total} reportes totales — mostrando {reportes.length}</p>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center gap-3 text-on-surface-variant text-sm p-8 justify-center">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Cargando reportes...
        </div>
      ) : reportes.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-30">check_circle</span>
          <p className="mt-2 font-bold">{soloAbiertos ? 'No hay reportes abiertos' : 'No hay reportes aún'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reportes.map(r => {
            const cfg    = TIPO_CONFIG[r.tipo] || TIPO_CONFIG.otro
            const isOpen = expanded === r.id
            const datos  = r.datos || {}
            const fecha  = new Date(r.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })

            return (
              <div key={r.id} className={`card border overflow-hidden transition-all
                ${r.resuelto ? 'opacity-60 border-outline-variant/30' : 'border-outline-variant/50'}`}>
                {/* Fila resumen */}
                <div
                  className="flex items-start gap-3 p-3.5 cursor-pointer hover:bg-surface-container-low transition-colors"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.chip}`}>
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{cfg.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cfg.chip}`}>{cfg.label}</span>
                      {r.resuelto && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Resuelto
                        </span>
                      )}
                      <span className="text-[11px] text-on-surface-variant ml-auto">{fecha}</span>
                    </div>
                    {r.comentario && (
                      <p className="text-xs text-on-surface mt-1 line-clamp-2">"{r.comentario}"</p>
                    )}
                    {datos.error_msg && !r.comentario && (
                      <p className="text-xs text-error/80 mt-1 line-clamp-1">{datos.error_msg}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {datos.file_name && (
                        <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5">
                          <span className="material-symbols-outlined text-[10px]">description</span>
                          {datos.file_name} {datos.file_size_mb ? `(${datos.file_size_mb} MB)` : ''}
                        </span>
                      )}
                      {datos.etapa && (
                        <span className="text-[10px] text-on-surface-variant">Etapa {datos.etapa}</span>
                      )}
                    </div>
                  </div>
                  <span className={`material-symbols-outlined text-sm text-on-surface-variant transition-transform flex-shrink-0 mt-1 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </div>

                {/* Detalle expandido */}
                {isOpen && (
                  <div className="border-t border-outline-variant/20 p-3.5 space-y-3 bg-surface-container-low/50">
                    {/* Todos los campos del datos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      {Object.entries(datos).map(([k, v]) =>
                        v ? (
                          <div key={k} className="bg-surface rounded-lg p-2">
                            <p className="text-on-surface-variant text-[10px] font-bold uppercase tracking-wider">{k.replace(/_/g, ' ')}</p>
                            <p className="text-on-surface mt-0.5 break-all line-clamp-3">{String(v)}</p>
                          </div>
                        ) : null
                      )}
                    </div>
                    {r.user_id && (
                      <p className="text-[10px] text-on-surface-variant">Usuario: {r.user_id}</p>
                    )}
                    <button
                      onClick={() => toggleResuelto(r.id, r.resuelto)}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-colors
                        ${r.resuelto
                          ? 'bg-surface-container text-on-surface-variant hover:bg-error/10 hover:text-error'
                          : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'}`}
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {r.resuelto ? 'undo' : 'check_circle'}
                      </span>
                      {r.resuelto ? 'Marcar como abierto' : 'Marcar como resuelto'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs text-on-surface-variant">Página {page} de {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-surface-container disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  )
}
