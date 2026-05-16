import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

export default function MaterialEstudio() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [convocatorias, setConvocatorias] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('convocatorias').select('*').eq('is_active', true).order('nombre')
      .then(({ data }) => { setConvocatorias(data || []); setLoading(false) })
  }, [])

  return (
    <div className="p-6 pb-28 max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-extrabold font-headline text-on-background">Material de Estudio</h1>
        <p className="text-on-surface-variant mt-1">Tu espacio de preparación personalizada por convocatoria</p>
      </div>

      {/* Banner analizar perfil */}
      <div className="bg-gradient-to-br from-primary to-primary-container rounded-2xl p-6 text-white flex items-center gap-5">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
        </div>
        <div className="flex-1">
          <p className="font-extrabold text-lg">¿A qué cargo puedo aplicar?</p>
          <p className="text-white/80 text-sm">Sube tu hoja de vida y DeepSeek analiza qué cargos de la convocatoria se ajustan a tu perfil</p>
        </div>
        <button onClick={() => navigate('/analisis-perfil')}
          className="bg-white text-primary font-bold px-5 py-2.5 rounded-full text-sm hover:shadow-lg transition-all flex-shrink-0">
          Analizar perfil
        </button>
      </div>

      {/* Convocatorias */}
      {loading ? (
        <div className="space-y-4">
          {[1,2].map(i => <div key={i} className="h-40 bg-surface-container-high rounded-2xl animate-pulse" />)}
        </div>
      ) : convocatorias.length === 0 ? (
        <div className="card p-10 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">menu_book</span>
          <p className="font-semibold">El equipo de Praxia está cargando el material de estudio.</p>
          <p className="text-sm mt-1">Vuelve pronto.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {convocatorias.map(conv => (
            <div key={conv.id} className="card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
                <div>
                  <p className="font-bold">{conv.nombre}</p>
                  <p className="text-xs text-on-surface-variant">{conv.entidad}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cuaderno IA */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white opacity-70 cursor-not-allowed select-none">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                    <p className="font-bold text-sm">Cuaderno IA</p>
                    <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold ml-auto">Próximamente</span>
                  </div>
                  <p className="text-white/60 text-xs">Chat con tu material de estudio usando IA · OpenAI Notebooks</p>
                </div>

                {/* Analizar mi perfil */}
                <button onClick={() => navigate(`/analisis-perfil?conv=${conv.id}`)}
                  className="bg-primary/5 border-2 border-primary/20 hover:border-primary hover:bg-primary/10 rounded-xl p-4 text-left transition-all group">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
                    <p className="font-bold text-sm text-primary">Mi perfil vs cargos</p>
                    <span className="material-symbols-outlined text-primary/40 group-hover:text-primary text-base ml-auto transition-colors">arrow_forward</span>
                  </div>
                  <p className="text-xs text-on-surface-variant">DeepSeek analiza qué cargos de esta convocatoria van con tu perfil</p>
                </button>
              </div>

              {conv.fecha_inicio && (
                <p className="text-xs text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">calendar_month</span>
                  {conv.fecha_inicio ? `Convocatoria: ${new Date(conv.fecha_inicio).toLocaleDateString('es-CO')}` : ''}
                  {conv.fecha_fin ? ` — ${new Date(conv.fecha_fin).toLocaleDateString('es-CO')}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
