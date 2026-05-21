import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

function diasRestantes(endDate) {
  if (!endDate) return null
  return Math.ceil((new Date(endDate) - new Date()) / 86400000)
}

function FeatureBadge({ icon, label, color }) {
  return (
    <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 ${color}`}>
      <span className="material-symbols-outlined text-xs">{icon}</span>
      {label}
    </span>
  )
}

export default function MaterialEstudio() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('purchases')
      .select(`
        id, end_date, status,
        packages (
          id, name, description,
          has_ai_chat, has_study_material, has_practice_mode, has_exam_mode,
          evaluations_ids, convocatoria_id,
          convocatorias ( id, nombre, entidad )
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['active', 'approved', 'manual'])
      .order('created_at', { ascending: false })
      .then(({ data }) => { setCompras(data || []); setLoading(false) })
  }, [user?.id])

  return (
    <div className="p-6 pb-28 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold font-headline text-on-background">Material de Estudio</h1>
        <p className="text-on-surface-variant mt-1">Recursos y herramientas IA de tus paquetes activos</p>
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-52 bg-surface-container-high rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && compras.length === 0 && (
        <div className="card p-12 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl opacity-30 block mb-3">inventory_2</span>
          <p className="font-bold text-lg mb-1">Sin paquetes activos</p>
          <p className="text-sm mb-6">
            Compra un paquete del catálogo para acceder al material de estudio, cuadernos IA y análisis de perfil.
          </p>
          <button
            onClick={() => navigate('/catalogo')}
            className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-full text-sm hover:shadow-lg transition-all"
          >
            Ver catálogo
          </button>
        </div>
      )}

      {!loading && compras.length > 0 && (
        <div className="space-y-6">
          {compras.map(compra => {
            const pkg = compra.packages
            if (!pkg) return null
            const dias = diasRestantes(compra.end_date)
            const conv = pkg.convocatorias
            const evals = Array.isArray(pkg.evaluations_ids) ? pkg.evaluations_ids : []

            return (
              <div key={compra.id} className="card p-6 space-y-5">

                {/* Header */}
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-xl"
                          style={{ fontVariationSettings: "'FILL' 1" }}>inventory_2</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-lg leading-tight">{pkg.name}</p>
                    {pkg.description && (
                      <p className="text-sm text-on-surface-variant mt-0.5 line-clamp-2">{pkg.description}</p>
                    )}
                    {conv && (
                      <p className="text-xs text-primary font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">account_balance</span>
                        {conv.entidad || conv.nombre}
                      </p>
                    )}
                  </div>
                  {dias !== null && (
                    <span className={`text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 ${
                      dias > 30 ? 'bg-secondary/10 text-secondary'
                      : dias > 7 ? 'bg-tertiary/10 text-tertiary'
                      : 'bg-error/10 text-error'
                    }`}>
                      {dias}d restantes
                    </span>
                  )}
                </div>

                {/* Feature badges */}
                <div className="flex flex-wrap gap-2">
                  {pkg.has_exam_mode && (
                    <FeatureBadge icon="quiz" label="Modo examen" color="bg-primary/10 text-primary" />
                  )}
                  {pkg.has_practice_mode && (
                    <FeatureBadge icon="fitness_center" label="Modo práctica" color="bg-secondary/10 text-secondary" />
                  )}
                  {pkg.has_ai_chat && (
                    <FeatureBadge icon="smart_toy" label="Simulacro IA" color="bg-tertiary/10 text-tertiary" />
                  )}
                  {pkg.has_study_material && (
                    <FeatureBadge icon="menu_book" label="Material IA" color="bg-blue-100 text-blue-700" />
                  )}
                </div>

                {/* Material IA */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-3">
                    Material IA
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                    {/* Cuaderno IA — OpenAI (próximamente) */}
                    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white opacity-60 cursor-not-allowed select-none">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-lg"
                              style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                        <p className="font-bold text-sm">Cuaderno IA</p>
                        <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold ml-auto">
                          Próximamente
                        </span>
                      </div>
                      <p className="text-white/60 text-xs">
                        Chat con tu material de estudio · OpenAI Notebooks
                      </p>
                    </div>

                    {/* Análisis de perfil vs convocatoria */}
                    {conv ? (
                      <button
                        onClick={() => navigate(`/analisis-perfil?conv=${conv.id}`)}
                        className="bg-primary/5 border-2 border-primary/20 hover:border-primary hover:bg-primary/10 rounded-xl p-4 text-left transition-all group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-primary text-lg"
                                style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
                          <p className="font-bold text-sm text-primary">Mi perfil vs cargos</p>
                          <span className="material-symbols-outlined text-primary/40 group-hover:text-primary text-base ml-auto transition-colors">
                            arrow_forward
                          </span>
                        </div>
                        <p className="text-xs text-on-surface-variant">
                          Praxia analiza qué cargos de {conv.nombre} van con tu perfil
                        </p>
                      </button>
                    ) : (
                      <div className="bg-surface-container-high rounded-xl p-4 opacity-40 cursor-not-allowed select-none">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-on-surface-variant text-lg">manage_accounts</span>
                          <p className="font-bold text-sm text-on-surface-variant">Análisis de perfil</p>
                        </div>
                        <p className="text-xs text-on-surface-variant">
                          Disponible cuando el paquete tenga convocatoria vinculada.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* CTA ir a estudiar */}
                {evals.length > 0 && (
                  <div className="pt-1">
                    <button
                      onClick={() => navigate(`/prueba/${evals[0]}`)}
                      className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-full text-sm hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Ir a estudiar
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
