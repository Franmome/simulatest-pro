import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

function tiempoRelativo(fecha) {
  if (!fecha) return '—'
  const d = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (d < 3600)   return `hace ${Math.floor(d / 60)} min`
  if (d < 86400)  return `hace ${Math.floor(d / 3600)} h`
  if (d < 604800) return `hace ${Math.floor(d / 86400)} días`
  return new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
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

// ── Tab: Pruebas completadas ──────────────────────────────────────────────────

function TabPruebas({ userId }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return
    supabase.from('user_simulacros')
      .select('id, cargo, cantidad_preguntas, dificultad_config, score_pct, score_correctas, score_total, completado, created_at, evaluacion_id')
      .eq('user_id', userId)
      .eq('completado', true)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [userId])

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!items.length) return <EmptyState icon="quiz" title="Sin pruebas completadas" sub="Completa tu primera Prueba Praxia para verla aquí." />

  const LABEL_DIF = { mixta: 'Mixta', facil: 'Fácil', medio: 'Medio', dificil: 'Difícil', practica: 'Práctica' }

  return (
    <div className="space-y-2">
      {items.map(s => (
        <div key={s.id} className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200 hover:border-primary/20 hover:shadow-sm transition-all">
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
              <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-full">
                {LABEL_DIF[s.dificultad_config] || 'Mixta'}
              </span>
              {s.score_correctas !== null && s.score_total > 0 && (
                <span className="text-[10px] text-on-surface-variant">
                  {s.score_correctas}/{s.score_total} correctas
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <ScoreBadge pct={s.score_pct} />
            <span className="text-[10px] text-on-surface-variant">{tiempoRelativo(s.created_at)}</span>
          </div>
        </div>
      ))}
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
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-tertiary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-lg"
                  style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{a.cargo || 'Análisis Praxia'}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {an.nivel_preparacion && (
                    <span className="text-[10px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full">
                      {an.nivel_preparacion}
                    </span>
                  )}
                  {a.score_correctas !== null && a.score_total > 0 && (
                    <span className="text-[10px] text-on-surface-variant">
                      {a.score_correctas}/{a.score_total} correctas
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1">
                <ScoreBadge pct={a.score_pct} />
                <span className="text-[10px] text-on-surface-variant">{tiempoRelativo(a.created_at)}</span>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant text-lg ml-1 shrink-0">
                {isOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {isOpen && (
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">

                {an.patron_error && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Patrón de error</p>
                    <p className="text-xs text-on-surface leading-relaxed">{an.patron_error}</p>
                  </div>
                )}

                {an.areas_mejora?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Áreas a mejorar</p>
                    <div className="flex flex-wrap gap-1">
                      {an.areas_mejora.map((a, i) => (
                        <span key={i} className="text-[10px] bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {an.fortalezas?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1.5">Fortalezas</p>
                    <div className="flex flex-wrap gap-1">
                      {an.fortalezas.map((f, i) => (
                        <span key={i} className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                {an.recomendacion_estudio && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Recomendación</p>
                    <p className="text-xs text-on-surface leading-relaxed">{an.recomendacion_estudio}</p>
                  </div>
                )}

                <details className="mt-1">
                  <summary className="text-[10px] font-bold text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                    Ver JSON completo
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-on-surface-variant whitespace-pre-wrap overflow-x-auto max-h-60">
                    {JSON.stringify(an, null, 2)}
                  </pre>
                </details>
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
      .then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [userId])

  if (loading) return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
  if (!items.length) return <EmptyState icon="manage_accounts" title="Sin análisis de perfil" sub="Ve a 'Mi perfil vs cargos' para generar tu primer análisis OPEC." />

  return (
    <div className="space-y-3">
      {items.map(item => {
        const an = item.analisis || {}
        const isOpen = expandido === item.id
        const top5 = an.top5 || an.resultado?.top5 || []
        const cargoTop = top5[0]?.cargo || top5[0]?.nombre || null
        const nivelCandidato = an.perfil_base?.nivel || an.nivel_candidato || null
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
                <p className="font-bold text-sm truncate">
                  {item.convocatoria_nombre || 'Análisis OPEC'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  {cargoTop && (
                    <span className="text-[10px] text-on-surface-variant truncate max-w-[160px]">
                      {cargoTop}
                    </span>
                  )}
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
              <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
                {top5.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">Top cargos compatibles</p>
                    <div className="space-y-1.5">
                      {top5.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                            i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-500'
                          }`}>{i + 1}</span>
                          <p className="flex-1 text-xs font-semibold truncate">{c.cargo || c.nombre || c}</p>
                          {c.compatibilidad !== undefined && (
                            <span className="text-[10px] font-bold text-primary shrink-0">{c.compatibilidad}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <details className="mt-1">
                  <summary className="text-[10px] font-bold text-on-surface-variant cursor-pointer hover:text-primary transition-colors">
                    Ver JSON completo
                  </summary>
                  <pre className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-[10px] font-mono text-on-surface-variant whitespace-pre-wrap overflow-x-auto max-h-60">
                    {JSON.stringify(an, null, 2)}
                  </pre>
                </details>
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
  { id: 'pruebas',   label: 'Pruebas',         icon: 'quiz' },
  { id: 'analisis',  label: 'Análisis IA',      icon: 'psychology' },
  { id: 'perfil',    label: 'Perfil OPEC',      icon: 'manage_accounts' },
]

export default function Registros() {
  const navigate = useNavigate()
  const { user }  = useAuth()
  const [tab, setTab] = useState('pruebas')

  if (!user) {
    navigate('/login')
    return null
  }

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

      {/* Tabs */}
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
