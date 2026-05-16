import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token}` }
}

export default function AnalisisPerfil() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const [convocatorias, setConvocatorias] = useState([])
  const [convId, setConvId] = useState(searchParams.get('conv') || '')
  const [perfilTexto, setPerfilTexto] = useState('')
  const [pdfFile, setPdfFile] = useState(null)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState(null)
  const [analisis, setAnalisis] = useState(null)

  useEffect(() => {
    supabase.from('convocatorias').select('id, nombre, entidad').eq('is_active', true).order('nombre')
      .then(({ data }) => setConvocatorias(data || []))
  }, [])

  async function analizar() {
    if (!convId) { setError('Selecciona una convocatoria'); return }
    if (!perfilTexto.trim() && !pdfFile) { setError('Escribe tu perfil o sube tu hoja de vida'); return }
    setAnalizando(true)
    setError(null)
    setAnalisis(null)
    try {
      const headers = await authHeaders()
      const fd = new FormData()
      fd.append('convocatoria_id', convId)
      fd.append('perfil_texto', perfilTexto)
      if (pdfFile) fd.append('pdf', pdfFile)
      const res = await fetch(`${BASE}/api/ia/analisis-perfil`, { method: 'POST', headers, body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAnalisis(json.analisis)
    } catch (e) {
      setError(e.message)
    } finally {
      setAnalizando(false)
    }
  }

  const pctColor = (pct) => pct >= 80 ? 'text-secondary bg-secondary/10' : pct >= 60 ? 'text-tertiary bg-tertiary/10' : 'text-error bg-error/10'

  return (
    <div className="p-6 pb-28 max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/material-estudio')} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-2xl font-extrabold font-headline">Análisis de Perfil</h1>
          <p className="text-on-surface-variant text-sm">DeepSeek analiza tu hoja de vida y recomienda los mejores cargos para ti</p>
        </div>
      </div>

      {/* Formulario */}
      {!analisis && (
        <div className="card p-6 space-y-5">
          {/* Convocatoria */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Convocatoria</label>
            <select value={convId} onChange={e => setConvId(e.target.value)}
              className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20">
              <option value="">Selecciona una convocatoria</option>
              {convocatorias.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.entidad}</option>)}
            </select>
          </div>

          {/* Perfil en texto */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cuéntanos tu perfil</label>
            <textarea
              value={perfilTexto}
              onChange={e => setPerfilTexto(e.target.value)}
              rows={5}
              placeholder="Ejemplo: Soy abogado con 4 años de experiencia en contratación estatal. Tengo especialización en derecho administrativo y he trabajado en alcaldías municipales en el área jurídica. Manejo SECOP II y procesos de contratación directa..."
              className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          {/* Upload HV */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Hoja de vida PDF (opcional)</label>
            <label className="flex items-center gap-3 p-4 border-2 border-dashed border-outline-variant/40 rounded-xl cursor-pointer hover:border-primary/40 transition-colors">
              <span className="material-symbols-outlined text-primary">upload_file</span>
              <span className="text-sm text-on-surface-variant">
                {pdfFile ? pdfFile.name : 'Haz clic para subir tu HV en PDF'}
              </span>
              <input type="file" accept=".pdf" className="hidden" onChange={e => setPdfFile(e.target.files[0])} />
            </label>
          </div>

          {error && (
            <div className="p-3 bg-error-container text-error rounded-xl text-sm font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>{error}
            </div>
          )}

          <button onClick={analizar} disabled={analizando}
            className="btn-primary w-full py-3 rounded-full font-bold disabled:opacity-60 flex items-center justify-center gap-2">
            {analizando ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                DeepSeek analizando tu perfil...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                Analizar mi perfil
              </>
            )}
          </button>
        </div>
      )}

      {/* Resultados */}
      {analisis && (
        <div className="space-y-5 animate-fade-in">
          {/* Resumen */}
          <div className="card p-5 bg-primary/5 border border-primary/15">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              Análisis de tu perfil
            </p>
            <p className="text-sm text-on-surface leading-relaxed">{analisis.resumen_perfil}</p>
          </div>

          {/* Cargos recomendados */}
          <div>
            <h2 className="text-lg font-bold font-headline mb-4">Cargos recomendados para ti</h2>
            <div className="space-y-4">
              {(analisis.cargos_recomendados || []).map((c, i) => (
                <div key={i} className="card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold text-sm">{c.nombre_cargo}</p>
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold flex-shrink-0 ${pctColor(c.compatibilidad)}`}>
                      {c.compatibilidad}% compatible
                    </span>
                  </div>
                  {c.fortalezas?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-secondary mb-1">Tus fortalezas</p>
                      <ul className="space-y-1">
                        {c.fortalezas.map((f, j) => (
                          <li key={j} className="text-xs text-on-surface-variant flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-secondary text-sm mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.brechas?.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-error mb-1">Puntos a mejorar</p>
                      <ul className="space-y-1">
                        {c.brechas.map((b, j) => (
                          <li key={j} className="text-xs text-on-surface-variant flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-error text-sm mt-0.5">cancel</span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {c.recomendacion && (
                    <div className="bg-surface-container rounded-xl p-3">
                      <p className="text-xs font-bold text-on-surface-variant mb-1">Cómo prepararte</p>
                      <p className="text-xs text-on-surface leading-relaxed">{c.recomendacion}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recomendación general */}
          {analisis.recomendacion_general && (
            <div className="card p-5 border border-secondary/20">
              <p className="text-xs font-bold text-secondary mb-2">Recomendación general de DeepSeek</p>
              <p className="text-sm text-on-surface leading-relaxed">{analisis.recomendacion_general}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setAnalisis(null)} className="flex-1 py-3 border border-outline-variant rounded-full font-bold text-sm hover:bg-surface-container transition-all">
              Analizar de nuevo
            </button>
            <button onClick={() => navigate('/material-estudio')} className="flex-1 btn-primary py-3 rounded-full font-bold text-sm">
              Ver material de estudio
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
