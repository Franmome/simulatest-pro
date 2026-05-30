import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const toStr = (v) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object') return v.texto || v.text || v.descripcion || v.nombre || v.name || v.fortaleza || v.area || v.recomendacion || v.tema || v.accion || JSON.stringify(v)
  return String(v)
}

function tiempoRelativo(fecha) {
  if (!fecha) return '—'
  const d = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (d < 3600)   return `hace ${Math.floor(d / 60)} min`
  if (d < 86400)  return `hace ${Math.floor(d / 3600)} h`
  if (d < 604800) return `hace ${Math.floor(d / 86400)} días`
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatSegundos(s) {
  if (!s) return '—'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${sec}s`
  return `${sec}s`
}

function ScoreBadge({ pct }) {
  if (pct === null || pct === undefined) return null
  const ok = pct >= 70
  return (
    <span className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
      {Math.round(pct)}%
    </span>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <span className="material-symbols-outlined text-slate-300 text-5xl mb-3"
        style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      <p className="font-bold text-sm text-on-surface">{title}</p>
      <p className="text-xs text-on-surface-variant max-w-xs mt-1 leading-relaxed">{sub}</p>
    </div>
  )
}

function SectionLabel({ icon, label, color = 'text-on-surface-variant' }) {
  return (
    <p className={`text-[10px] font-extrabold uppercase tracking-widest mb-2 flex items-center gap-1 ${color}`}>
      <span className="material-symbols-outlined" style={{ fontSize: '13px', fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      {label}
    </p>
  )
}

// ── Tab: Pruebas completadas ──────────────────────────────────────────────────

function AreaBar({ correctas, total, label }) {
  const pct = total > 0 ? Math.round((correctas / total) * 100) : 0
  const color = pct >= 70 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <p className="text-[10px] text-on-surface font-semibold w-40 shrink-0 truncate" title={label}>{label}</p>
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-bold w-8 text-right shrink-0 ${pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
        {pct}%
      </span>
      <span className="text-[9px] text-on-surface-variant w-12 text-right shrink-0">{correctas}/{total}</span>
    </div>
  )
}

function TabPruebas({ userId }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [areaData,  setAreaData]  = useState({})
  const [loadingArea, setLoadingArea] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_simulacros')
      .select('id, cargo, cantidad_preguntas, dificultad_config, score_pct, score_correctas, score_total, completado, created_at, evaluacion_id')
      .eq('user_id', userId)
      .not('score_pct', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error }) => {
        if (error) console.error('[Registros] pruebas:', error.message)
        setItems(data || [])
        setLoading(false)
      })
  }, [userId])

  const toggleExpand = async (id) => {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (areaData[id]) return
    setLoadingArea(id)
    const { data } = await supabase
      .from('user_simulacro_answers')
      .select('area, dificultad, es_correcta, tiempo_segundos')
      .eq('simulacro_id', id)
    if (data?.length) {
      const byArea = {}
      data.forEach(r => {
        const a = r.area || 'General'
        if (!byArea[a]) byArea[a] = { correctas: 0, total: 0, tiempos: [] }
        byArea[a].total++
        if (r.es_correcta) byArea[a].correctas++
        if (r.tiempo_segundos) byArea[a].tiempos.push(r.tiempo_segundos)
      })
      const byDif = {}
      data.forEach(r => {
        const d = r.dificultad || 'medio'
        if (!byDif[d]) byDif[d] = { correctas: 0, total: 0 }
        byDif[d].total++
        if (r.es_correcta) byDif[d].correctas++
      })
      setAreaData(prev => ({ ...prev, [id]: { byArea, byDif, total: data.length } }))
    } else {
      setAreaData(prev => ({ ...prev, [id]: null }))
    }
    setLoadingArea(null)
  }

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!items.length) return <EmptyState icon="quiz" title="Sin pruebas completadas" sub="Completa tu primera Prueba Praxia para verla aquí." />

  const LABEL_DIF = { mixta: 'Mixta', facil: 'Fácil', medio: 'Medio', dificil: 'Difícil', practica: 'Práctica' }
  const COLOR_DIF = { facil: 'text-emerald-600 bg-emerald-50', medio: 'text-amber-600 bg-amber-50', dificil: 'text-red-600 bg-red-50', mixta: 'text-slate-600 bg-slate-100', practica: 'text-secondary bg-secondary/10' }

  return (
    <div className="space-y-2">
      {items.map(s => {
        const isOpen = expandido === s.id
        const ad = areaData[s.id]
        return (
          <div key={s.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-primary/20 transition-colors">
            <button onClick={() => toggleExpand(s.id)} className="w-full flex items-center gap-3 p-3.5 text-left">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{s.cargo || 'Prueba Praxia'}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-full">
                    {s.cantidad_preguntas || '—'} pregs
                  </span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${COLOR_DIF[s.dificultad_config] || 'text-slate-600 bg-slate-100'}`}>
                    {LABEL_DIF[s.dificultad_config] || 'Mixta'}
                  </span>
                  {s.score_correctas !== null && s.score_total > 0 && (
                    <span className="text-[10px] text-on-surface-variant">{s.score_correctas}/{s.score_total}</span>
                  )}
                  {s.tiempo_segundos > 0 && (
                    <span className="text-[10px] text-on-surface-variant flex items-center gap-0.5">
                      <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>timer</span>
                      {formatSegundos(s.tiempo_segundos)}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <ScoreBadge pct={s.score_pct} />
                <span className="text-[10px] text-on-surface-variant">{tiempoRelativo(s.created_at)}</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-lg ml-1 shrink-0">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">

                {/* Resumen rápido */}
                {(() => {
                  const totalTiempo = ad ? Object.values(ad.byArea).flatMap(d => d.tiempos).reduce((a, b) => a + b, 0) : 0
                  return (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Score', val: s.score_pct !== null ? `${Math.round(s.score_pct)}%` : '—', color: s.score_pct >= 70 ? 'text-emerald-600' : 'text-red-500' },
                        { label: 'Correctas', val: s.score_correctas !== null ? `${s.score_correctas}/${s.score_total}` : '—', color: 'text-on-surface' },
                        { label: 'Tiempo total', val: totalTiempo > 0 ? formatSegundos(totalTiempo) : '—', color: 'text-on-surface' },
                      ].map(stat => (
                        <div key={stat.label} className="bg-slate-50 rounded-xl p-2.5">
                          <p className={`font-extrabold text-base leading-none ${stat.color}`}>{stat.val}</p>
                          <p className="text-[9px] text-on-surface-variant font-semibold mt-1 uppercase tracking-widest">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                {loadingArea === s.id && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {ad && (
                  <>
                    {/* Desglose por área */}
                    <div>
                      <SectionLabel icon="category" label={`Desglose por área (${Object.keys(ad.byArea).length} áreas)`} />
                      <div className="space-y-2">
                        {Object.entries(ad.byArea)
                          .sort((a, b) => {
                            const pA = a[1].total > 0 ? a[1].correctas / a[1].total : 0
                            const pB = b[1].total > 0 ? b[1].correctas / b[1].total : 0
                            return pA - pB
                          })
                          .map(([area, d]) => (
                            <AreaBar key={area} label={area} correctas={d.correctas} total={d.total} />
                          ))}
                      </div>
                    </div>

                    {/* Desglose por dificultad */}
                    {Object.keys(ad.byDif).length > 1 && (
                      <div>
                        <SectionLabel icon="fitness_center" label="Por dificultad" />
                        <div className="flex gap-2 flex-wrap">
                          {Object.entries(ad.byDif).map(([dif, d]) => {
                            const pct = d.total > 0 ? Math.round((d.correctas / d.total) * 100) : 0
                            return (
                              <div key={dif} className={`rounded-xl px-3 py-2 text-center ${COLOR_DIF[dif] || 'bg-slate-50 text-slate-600'}`}>
                                <p className="font-extrabold text-sm">{pct}%</p>
                                <p className="text-[9px] font-bold uppercase tracking-widest">{dif}</p>
                                <p className="text-[9px] opacity-70">{d.correctas}/{d.total}</p>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Tiempo promedio */}
                    {(() => {
                      const allTiempos = Object.values(ad.byArea).flatMap(d => d.tiempos)
                      if (!allTiempos.length) return null
                      const promedio = Math.round(allTiempos.reduce((a, b) => a + b, 0) / allTiempos.length)
                      return (
                        <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                          <span className="material-symbols-outlined text-primary text-base"
                            style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                          <span className="text-xs font-semibold text-on-surface">
                            Tiempo promedio por pregunta: <strong>{formatSegundos(promedio)}</strong>
                          </span>
                        </div>
                      )
                    })()}
                  </>
                )}

                {ad === null && !loadingArea && (
                  <p className="text-xs text-on-surface-variant text-center py-2">Sin datos de respuestas disponibles.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Análisis de pruebas ──────────────────────────────────────────────────

function TabAnalisisPruebas({ userId }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_simulacro_analisis')
      .select('id, simulacro_id, cargo, score_pct, score_correctas, score_total, analisis, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [userId])

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!items.length) return <EmptyState icon="psychology" title="Sin análisis de pruebas" sub="Completa una prueba y genera el análisis IA para verlo aquí." />

  return (
    <div className="space-y-3">
      {items.map(a => {
        const an = a.analisis || {}
        const isOpen = expandido === a.id
        return (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-primary/20 transition-colors">
            <button
              onClick={() => setExpandido(isOpen ? null : a.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.score_pct >= 70 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className={`text-lg font-extrabold tabular-nums ${a.score_pct >= 70 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {a.score_pct !== null ? `${Math.round(a.score_pct)}%` : '—'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{a.cargo || 'Análisis Praxia'}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {an.nivel_preparacion && (
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                      {toStr(an.nivel_preparacion)}
                    </span>
                  )}
                  {a.score_correctas !== null && a.score_total > 0 && (
                    <span className="text-[10px] text-on-surface-variant">
                      {a.score_correctas}/{a.score_total} correctas
                    </span>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-on-surface-variant shrink-0">{tiempoRelativo(a.created_at)}</span>
              <span className="material-symbols-outlined text-on-surface-variant text-lg ml-1 shrink-0">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">

                {an.resumen && (
                  <p className="text-xs text-on-surface leading-relaxed bg-primary/5 border border-primary/10 rounded-xl p-3">
                    {toStr(an.resumen)}
                  </p>
                )}

                {an.patron_error && (
                  <div>
                    <SectionLabel icon="bolt" label="Patrón de error detectado" color="text-amber-600" />
                    <p className="text-xs text-on-surface leading-relaxed">{toStr(an.patron_error)}</p>
                  </div>
                )}

                {(an.tipo_distractor_frecuente || an.significado_distractor) && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-amber-700 mb-1">
                      Distractor más elegido: Opción {toStr(an.tipo_distractor_frecuente) || '—'}
                    </p>
                    {an.significado_distractor && (
                      <p className="text-xs text-on-surface leading-relaxed">{toStr(an.significado_distractor)}</p>
                    )}
                  </div>
                )}

                {an.areas_mejora?.length > 0 && (
                  <div>
                    <SectionLabel icon="trending_down" label={`Áreas a reforzar (${an.areas_mejora.length})`} color="text-red-600" />
                    <div className="flex flex-wrap gap-1.5">
                      {an.areas_mejora.map((item, i) => (
                        <span key={i} className="text-[10px] bg-red-50 border border-red-100 text-red-600 font-semibold px-2.5 py-0.5 rounded-full">{toStr(item)}</span>
                      ))}
                    </div>
                  </div>
                )}

                {an.temas_criticos?.length > 0 && (
                  <div>
                    <SectionLabel icon="priority_high" label="Temas críticos" color="text-rose-700" />
                    <div className="flex flex-wrap gap-1.5">
                      {an.temas_criticos.map((t, i) => (
                        <span key={i} className="text-[10px] bg-rose-50 border border-rose-100 text-rose-700 font-semibold px-2.5 py-0.5 rounded-full">{toStr(t)}</span>
                      ))}
                    </div>
                  </div>
                )}

                {an.fortalezas?.length > 0 && (
                  <div>
                    <SectionLabel icon="trending_up" label={`Fortalezas (${an.fortalezas.length})`} color="text-emerald-700" />
                    <div className="flex flex-wrap gap-1.5">
                      {an.fortalezas.map((f, i) => (
                        <span key={i} className="text-[10px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold px-2.5 py-0.5 rounded-full">{toStr(f)}</span>
                      ))}
                    </div>
                  </div>
                )}

                {an.analisis_tiempo && (
                  <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                    <p className="text-xs text-on-surface leading-relaxed">{toStr(an.analisis_tiempo)}</p>
                  </div>
                )}

                {an.recomendaciones?.length > 0 && (
                  <div className="bg-secondary/5 border border-secondary/15 rounded-xl p-3">
                    <SectionLabel icon="school" label="Plan de estudio recomendado" color="text-secondary" />
                    <ul className="space-y-1.5">
                      {an.recomendaciones.map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-on-surface">
                          <span className="text-secondary font-extrabold shrink-0">{i + 1}.</span>
                          {toStr(r)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {an.mensaje_motivacional && (
                  <div className="flex items-start gap-2 bg-primary/5 border border-primary/10 rounded-xl p-3">
                    <span className="material-symbols-outlined text-primary text-base shrink-0 mt-0.5"
                      style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
                    <p className="text-xs text-primary font-medium leading-relaxed italic">{toStr(an.mensaje_motivacional)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Análisis de perfil ───────────────────────────────────────────────────

function TabAnalisisPerfil({ userId }) {
  const [items,     setItems]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_profile_analysis')
      .select('id, convocatoria_id, convocatoria_nombre, analisis, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const supabaseItems = (data || []).map(i => ({ ...i, source: 'supabase' }))
        // Fallback: incluir análisis de localStorage si no está en Supabase
        try {
          const raw = localStorage.getItem('praxia_last_analisis')
          if (raw) {
            const local = JSON.parse(raw)
            const yaEsta = supabaseItems.some(i =>
              i.convocatoria_nombre === local.convNombre
            )
            if (!yaEsta && local.analisis) {
              supabaseItems.push({
                id: 'local',
                convocatoria_nombre: local.convNombre || 'Análisis guardado localmente',
                analisis: local.analisis,
                updated_at: new Date(local.ts).toISOString(),
                source: 'local',
              })
            }
          }
        } catch { /* ignore */ }
        setItems(supabaseItems)
        setLoading(false)
      })
  }, [userId])

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!items.length) return <EmptyState icon="manage_accounts" title="Sin análisis de perfil" sub="Ve a 'Mi perfil vs cargos' para generar tu primer análisis OPEC." />

  return (
    <div className="space-y-3">
      {items.map(item => {
        const an          = item.analisis || {}
        const isOpen      = expandido === item.id
        const top5        = an.ranking_opec_recomendadas || an.top5 || []
        const perfil      = an.perfil_candidato || an.perfil_base || {}
        const diag        = an.diagnostico_general || {}
        const rec         = an.opec_mas_recomendada || an.recomendacion_principal || {}
        const fortalezas  = diag.fortalezas_principales || diag.fortalezas || []
        const areasMejora = diag.debilidades_principales || diag.areas_mejora || []
        const cargoTop    = top5[0]?.denominacion || top5[0]?.cargo || null
        const nivelCandidato = perfil.nivel_formacion || perfil.nivel || null

        return (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:border-primary/20 transition-colors">
            <button
              onClick={() => setExpandido(isOpen ? null : item.id)}
              className="w-full flex items-center gap-3 p-4 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003d9b] to-[#1b6d24] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{item.convocatoria_nombre || 'Análisis OPEC'}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {cargoTop && <span className="text-[10px] text-on-surface-variant truncate max-w-[140px]">{cargoTop}</span>}
                  {top5.length > 0 && (
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      {top5.length} cargos
                    </span>
                  )}
                  {nivelCandidato && (
                    <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                      {nivelCandidato}
                    </span>
                  )}
                  {item.source === 'local' && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full shrink-0">
                      local
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[10px] text-on-surface-variant">{tiempoRelativo(item.updated_at)}</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-lg ml-1 shrink-0">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">

                {(diag.resumen || an.observacion_general) && (
                  <p className="text-xs text-on-surface leading-relaxed bg-slate-50 rounded-xl p-3 border border-slate-200">
                    {toStr(diag.resumen || an.observacion_general)}
                  </p>
                )}

                {(perfil.nivel_formacion || perfil.profesion_principal || perfil.experiencia_total_estimada_meses) && (
                  <div className="bg-primary/5 border border-primary/10 rounded-xl p-3">
                    <SectionLabel icon="person" label="Tu perfil profesional" color="text-primary" />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      {perfil.profesion_principal && <div><span className="text-on-surface-variant block text-[10px]">Profesión</span><span className="font-bold">{toStr(perfil.profesion_principal)}</span></div>}
                      {perfil.nivel_formacion && <div><span className="text-on-surface-variant block text-[10px]">Nivel</span><span className="font-bold">{toStr(perfil.nivel_formacion)}</span></div>}
                      {perfil.experiencia_total_estimada_meses > 0 && <div><span className="text-on-surface-variant block text-[10px]">Experiencia</span><span className="font-bold">{perfil.experiencia_total_estimada_meses} meses</span></div>}
                      {perfil.tarjeta_profesional?.estado && <div><span className="text-on-surface-variant block text-[10px]">Tarjeta prof.</span><span className="font-bold">{perfil.tarjeta_profesional.estado}</span></div>}
                    </div>
                    {diag.nivel_competitividad && (
                      <p className="text-[10px] font-bold text-primary mt-2">Competitividad: {toStr(diag.nivel_competitividad)}</p>
                    )}
                  </div>
                )}

                {(fortalezas.length > 0 || areasMejora.length > 0) && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {fortalezas.length > 0 && (
                      <div>
                        <SectionLabel icon="check_circle" label="Fortalezas" color="text-emerald-700" />
                        <ul className="space-y-1">
                          {fortalezas.map((f, i) => (
                            <li key={i} className="text-[11px] text-on-surface flex items-start gap-1.5">
                              <span className="text-emerald-500 shrink-0 mt-0.5">●</span>{toStr(f)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {areasMejora.length > 0 && (
                      <div>
                        <SectionLabel icon="cancel" label="Limitaciones" color="text-red-600" />
                        <ul className="space-y-1">
                          {areasMejora.map((a, i) => (
                            <li key={i} className="text-[11px] text-on-surface flex items-start gap-1.5">
                              <span className="text-red-400 shrink-0 mt-0.5">●</span>{toStr(a)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {top5.length > 0 && (
                  <div>
                    <SectionLabel icon="emoji_events" label="Cargos compatibles" color="text-amber-600" />
                    <div className="space-y-2">
                      {top5.map((c, i) => {
                        const nombre = c.denominacion || c.cargo || c.nombre || String(c)
                        const compat = c.afinidad_porcentaje ?? c.compatibilidad
                        const accion = c.guia_para_el_usuario?.acciones_antes_de_postularse?.[0]
                          || c.guia_para_el_usuario?.decision_recomendada
                          || c.accion_prioritaria
                        return (
                          <div key={i} className={`rounded-xl p-3 border ${i === 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0
                                ${i === 0 ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>{i + 1}</span>
                              <p className="flex-1 text-xs font-extrabold">{nombre}</p>
                              {compat !== undefined && compat !== null && (
                                <span className={`text-xs font-extrabold shrink-0 ${compat >= 70 ? 'text-emerald-600' : compat >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                  {compat}%
                                </span>
                              )}
                            </div>
                            {(c.entidad || c.nivel || c.grado) && (
                              <p className="text-[10px] text-on-surface-variant ml-7 leading-relaxed">
                                {[c.entidad, c.nivel && `Niv. ${c.nivel}`, c.grado && `Gr. ${c.grado}`, c.vacantes && `${c.vacantes} vac.`].filter(Boolean).join(' · ')}
                              </p>
                            )}
                            {c.salario && (
                              <p className="text-[10px] font-bold text-emerald-700 ml-7 mt-0.5">
                                ${Number(String(c.salario).replace(/\D/g, '')).toLocaleString('es-CO')}
                              </p>
                            )}
                            {c.cumplimiento_requisitos_minimos && (
                              <p className="text-[10px] text-on-surface-variant ml-7 mt-0.5">
                                Requisitos: <span className="font-semibold">{c.cumplimiento_requisitos_minimos}</span>
                              </p>
                            )}
                            {c.justificacion && (
                              <p className="text-[10px] text-on-surface-variant ml-7 mt-1 leading-relaxed line-clamp-3">{c.justificacion}</p>
                            )}
                            {accion && (
                              <div className="ml-7 mt-1.5 bg-primary/5 border border-primary/10 rounded-lg px-2 py-1">
                                <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                                  <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>flag</span>
                                  {toStr(accion)}
                                </p>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(rec.denominacion || rec.cargo || rec.razon_principal || rec.motivo) && (
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl p-3">
                    <SectionLabel icon="star" label="Cargo más recomendado" color="text-secondary" />
                    {(rec.denominacion || rec.cargo) && <p className="text-sm font-extrabold text-on-surface mb-1">{rec.denominacion || rec.cargo}</p>}
                    {(rec.razon_principal || rec.motivo) && <p className="text-xs text-on-surface-variant leading-relaxed">{toStr(rec.razon_principal || rec.motivo)}</p>}
                    {rec.accion_prioritaria_antes_de_postularse && (
                      <div className="mt-2 bg-primary/5 border border-primary/10 rounded-lg px-2 py-1">
                        <p className="text-[10px] font-bold text-primary flex items-center gap-1">
                          <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>flag</span>
                          {toStr(rec.accion_prioritaria_antes_de_postularse)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

const TABS = [
  { id: 'pruebas',   label: 'Pruebas',     icon: 'quiz' },
  { id: 'analisis',  label: 'Análisis IA', icon: 'psychology' },
  { id: 'perfil',    label: 'Perfil OPEC', icon: 'manage_accounts' },
]

export default function Registros() {
  const navigate = useNavigate()
  const { user }  = useAuth()
  const [tab, setTab] = useState('pruebas')

  if (!user) { navigate('/login'); return null }

  return (
    <div className="p-4 md:p-6 pb-28 max-w-3xl mx-auto animate-fade-in">
      <button onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm font-semibold mb-5 transition-colors group">
        <span className="material-symbols-outlined text-lg group-hover:-translate-x-0.5 transition-transform">arrow_back</span>
        Volver
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-white text-2xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>history_edu</span>
        </div>
        <div>
          <h1 className="font-extrabold text-xl text-on-surface">Mis registros</h1>
          <p className="text-xs text-on-surface-variant">Historial completo · Pruebas, análisis y perfil</p>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all
              ${tab === t.id ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <span className="material-symbols-outlined text-base"
              style={{ fontVariationSettings: tab === t.id ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'pruebas'  && <TabPruebas userId={user.id} />}
      {tab === 'analisis' && <TabAnalisisPruebas userId={user.id} />}
      {tab === 'perfil'   && <TabAnalisisPerfil userId={user.id} />}
    </div>
  )
}
