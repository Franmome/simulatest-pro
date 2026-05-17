import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token}` }
}

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt'
const ACCEPTED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'txt']

function pctStyle(pct) {
  if (pct >= 80) return { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' }
  if (pct >= 65) return { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' }
  return { bar: 'bg-red-400', badge: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400' }
}

function CargoCard({ cargo, index }) {
  const [open, setOpen] = useState(index < 3)
  const s = pctStyle(cargo.compatibilidad)

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full p-4 flex items-center gap-3 hover:bg-surface-container-low/50 transition-colors text-left"
      >
        <span className="text-2xl select-none flex-shrink-0">{MEDALS[index] ?? '•'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm leading-snug">{cargo.nombre_cargo}</p>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Conv. {cargo.num_convocatoria ?? '—'} · {cargo.nivel ?? ''}{cargo.grado ? ` · Grado ${cargo.grado}` : ''}{cargo.vacantes ? ` · ${cargo.vacantes} vacante${cargo.vacantes !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${s.badge}`}>
            {cargo.compatibilidad}%
          </span>
          <span className="material-symbols-outlined text-on-surface-variant text-sm">
            {open ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>

      <div className="px-4 pb-2">
        <div className="w-full h-1.5 bg-surface-container-low rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${s.bar}`}
            style={{ width: `${cargo.compatibilidad}%` }}
          />
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 animate-fade-in">
          {cargo.fortalezas?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-green-600 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                Tus fortalezas para este cargo
              </p>
              <ul className="space-y-1">
                {cargo.fortalezas.map((f, j) => (
                  <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-green-500 text-sm mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cargo.brechas?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-amber-600 mb-1.5 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">priority_high</span>
                Puntos a fortalecer
              </p>
              <ul className="space-y-1">
                {cargo.brechas.map((b, j) => (
                  <li key={j} className="text-xs text-on-surface flex items-start gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5 flex-shrink-0">arrow_forward</span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cargo.recomendacion && (
            <div className="bg-primary/5 rounded-xl p-3">
              <p className="text-xs font-bold text-primary mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                Cómo prepararte
              </p>
              <p className="text-xs text-on-surface leading-relaxed">{cargo.recomendacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryCard({ item, onSelect, active }) {
  const top = item.analisis?.cargos_recomendados?.[0]
  const date = new Date(item.updated_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  const s = top ? pctStyle(top.compatibilidad) : null

  return (
    <button
      onClick={() => onSelect(item)}
      className={`w-full text-left p-3 rounded-xl border transition-all hover:border-primary/40 hover:bg-primary/5
        ${active ? 'border-primary bg-primary/5' : 'border-outline-variant/30 bg-surface-container-low'}`}
    >
      <p className="text-xs font-bold text-on-surface line-clamp-2 leading-snug">{item.convocatoria_nombre ?? 'Convocatoria'}</p>
      <p className="text-xs text-on-surface-variant mt-0.5">{date}</p>
      {top && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-sm select-none">🥇</span>
          <p className="text-xs font-semibold text-on-surface truncate flex-1">{top.nombre_cargo}</p>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${s.badge}`}>{top.compatibilidad}%</span>
        </div>
      )}
    </button>
  )
}

export default function AnalisisPerfil() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fileInputRef = useRef()

  const [convocatorias, setConvocatorias] = useState([])
  const [convId, setConvId] = useState(searchParams.get('conv') || '')
  const [perfilTexto, setPerfilTexto] = useState('')
  const [files, setFiles] = useState([])
  const [dragging, setDragging] = useState(false)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState(null)
  const [analisis, setAnalisis] = useState(null)
  const [historial, setHistorial] = useState([])
  const [activeHistId, setActiveHistId] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    supabase.from('convocatorias').select('id, nombre, entidad').eq('is_active', true).order('nombre')
      .then(({ data }) => setConvocatorias(data || []))
    fetchHistory()
  }, [])

  async function fetchHistory() {
    try {
      const headers = await authHeaders()
      const res = await fetch(`${BASE}/api/ia/mis-analisis`, { headers })
      const json = await res.json()
      setHistorial(json.analisis || [])
    } catch { /* historial no crítico */ }
  }

  function addFiles(fileList) {
    const valid = Array.from(fileList).filter(f => {
      const ext = f.name.split('.').pop().toLowerCase()
      return ACCEPTED_EXTS.includes(ext)
    })
    setFiles(prev => [...prev, ...valid])
  }

  function removeFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function analizar() {
    if (!convId) { setError('Selecciona una convocatoria'); return }
    if (!perfilTexto.trim() && files.length === 0) { setError('Escribe tu perfil o adjunta tu hoja de vida'); return }
    setAnalizando(true)
    setError(null)
    setAnalisis(null)
    setActiveHistId(null)
    try {
      const headers = await authHeaders()
      const fd = new FormData()
      fd.append('convocatoria_id', convId)
      fd.append('perfil_texto', perfilTexto)
      if (files.length > 0) fd.append('pdf', files[0])
      const res = await fetch(`${BASE}/api/ia/analisis-perfil`, { method: 'POST', headers, body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setAnalisis(json.analisis)
      fetchHistory()
    } catch (e) {
      setError(e.message)
    } finally {
      setAnalizando(false)
    }
  }

  function selectHistItem(item) {
    setAnalisis(item.analisis)
    setActiveHistId(item.id)
    setShowHistory(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function resetForm() {
    setAnalisis(null)
    setActiveHistId(null)
  }

  return (
    <div className="min-h-screen">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border-b border-outline-variant/20 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/material-estudio')} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold font-headline">Análisis de Perfil</h1>
            <p className="text-xs text-on-surface-variant hidden sm:block">El Asistente de Praxia compara tu hoja de vida con los cargos disponibles</p>
          </div>
          {historial.length > 0 && (
            <button
              onClick={() => setShowHistory(s => !s)}
              className="lg:hidden flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-2 rounded-full"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              {historial.length} guardado{historial.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 pb-28">
        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-6 lg:items-start">

          {/* ── Main column ── */}
          <div className="space-y-5 min-w-0">

            {/* Form */}
            {!analisis && (
              <div className="card p-5 space-y-5 animate-fade-in">

                {/* Convocatoria */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Convocatoria</label>
                  <select
                    value={convId}
                    onChange={e => setConvId(e.target.value)}
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Selecciona una convocatoria</option>
                    {convocatorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>

                {/* Perfil en texto */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Cuéntanos tu perfil</label>
                  <textarea
                    value={perfilTexto}
                    onChange={e => setPerfilTexto(e.target.value)}
                    rows={5}
                    placeholder="Ejemplo: Soy abogado con 4 años de experiencia en contratación estatal. Tengo especialización en derecho administrativo y he trabajado en alcaldías en el área jurídica..."
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* Upload area */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Documentos de hoja de vida{' '}
                    <span className="text-on-surface-variant/60 normal-case font-normal">(opcional · PDF, imágenes, Word, TXT)</span>
                  </label>
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all select-none
                      ${dragging
                        ? 'border-primary bg-primary/8 scale-[1.01]'
                        : 'border-outline-variant/40 hover:border-primary/40 hover:bg-surface-container-low'}`}
                  >
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
                    <p className="text-sm font-semibold text-on-surface">{dragging ? 'Suelta aquí' : 'Arrastra o haz clic para adjuntar'}</p>
                    <p className="text-xs text-on-surface-variant text-center">PDF · Imágenes (JPG, PNG) · Word · TXT · sin límite de tamaño</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED}
                      multiple
                      className="hidden"
                      onChange={e => addFiles(e.target.files)}
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-surface-container rounded-lg">
                          <span className="material-symbols-outlined text-primary text-sm flex-shrink-0">description</span>
                          <span className="text-xs text-on-surface flex-1 truncate">{f.name}</span>
                          <span className="text-xs text-on-surface-variant flex-shrink-0">
                            {f.size > 1024 * 1024 ? `${(f.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(f.size / 1024)} KB`}
                          </span>
                          <button onClick={() => removeFile(i)} className="text-on-surface-variant hover:text-error transition-colors flex-shrink-0">
                            <span className="material-symbols-outlined text-sm">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-error-container text-error rounded-xl text-sm font-semibold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {error}
                  </div>
                )}

                <button
                  onClick={analizar}
                  disabled={analizando}
                  className="btn-primary w-full py-3.5 rounded-full font-bold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {analizando ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      Asistente de Praxia analizando tu perfil...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>person_search</span>
                      Analizar mi perfil
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Results */}
            {analisis && (
              <div className="space-y-4 animate-fade-in">
                {/* Result top bar */}
                <div className="flex items-center gap-3">
                  <button onClick={resetForm} className="p-2 hover:bg-surface-container rounded-lg transition-colors">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <div className="flex-1">
                    <h2 className="font-bold">Resultado del análisis</h2>
                    {analisis.nivel_perfil && (
                      <span className="inline-block mt-0.5 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                        Perfil: {analisis.nivel_perfil}
                      </span>
                    )}
                  </div>
                </div>

                {/* Profile summary */}
                <div className="card p-5 bg-gradient-to-br from-primary/8 to-secondary/5 border border-primary/15">
                  <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
                    Tu perfil profesional
                  </p>
                  <p className="text-sm text-on-surface leading-relaxed">{analisis.resumen_perfil}</p>
                </div>

                {/* Cargo cards */}
                {(analisis.cargos_recomendados || []).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                      Cargos recomendados para ti
                    </p>
                    <div className="space-y-3">
                      {analisis.cargos_recomendados.map((c, i) => <CargoCard key={i} cargo={c} index={i} />)}
                    </div>
                  </div>
                )}

                {/* General recommendation */}
                {analisis.recomendacion_general && (
                  <div className="card p-5 border border-secondary/20">
                    <p className="text-xs font-bold text-secondary mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>tips_and_updates</span>
                      Recomendación del Asistente de Praxia
                    </p>
                    <p className="text-sm text-on-surface leading-relaxed">{analisis.recomendacion_general}</p>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={resetForm}
                    className="flex-1 py-3 border border-outline-variant rounded-full font-bold text-sm hover:bg-surface-container transition-all"
                  >
                    Analizar de nuevo
                  </button>
                  <button
                    onClick={() => navigate('/material-estudio')}
                    className="flex-1 btn-primary py-3 rounded-full font-bold text-sm"
                  >
                    Ver material de estudio
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── History panel ── */}
          <aside className={`mt-5 lg:mt-0 ${showHistory ? 'block' : 'hidden'} lg:block`}>
            <div className="lg:sticky lg:top-[65px] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">history</span>
                  Mis análisis guardados
                </p>
                {historial.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {historial.length}
                  </span>
                )}
              </div>

              {historial.length === 0 ? (
                <div className="text-center py-10 text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl opacity-30">folder_open</span>
                  <p className="text-xs mt-2 opacity-60">Aún no tienes análisis guardados</p>
                  <p className="text-xs opacity-40">Cada análisis se guarda automáticamente</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historial.map(item => (
                    <HistoryCard
                      key={item.id}
                      item={item}
                      active={activeHistId === item.id}
                      onSelect={selectHistItem}
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
