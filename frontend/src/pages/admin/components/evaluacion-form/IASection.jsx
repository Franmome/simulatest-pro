import { useState, useRef } from 'react'
import Card from './Card'
import { supabase } from '../../../../utils/supabase'
import { LETRAS } from './lib/constants'

const BASE_URL = import.meta.env.VITE_BACKEND_URL || ''

function mapAIQuestionToLocal(q) {
  const correcta = q.correcta?.toUpperCase()
  return {
    _id:                   Math.random().toString(36).slice(2),
    text:                  q.enunciado || '',
    explanation:           q.justificacion || q.explicacion || '',
    difficulty:            ['facil', 'medio', 'dificil'].includes(q.dificultad) ? q.dificultad : 'medio',
    area:                  q.area || '',
    bloom:                 q.bloom || null,
    estado:                q.estado || null,
    analisis_distractores: q.analisis_distractores || null,
    filtro_autonomia:      q.filtro_autonomia || null,
    options: LETRAS.map(letter => ({
      letter,
      text: q[letter] || '',
      is_correct: letter === correcta,
    })),
  }
}

export default function IASection({ niveles, nivelActivo, setNivelActivo, setPreguntas, addToast }) {
  const fileRef = useRef(null)

  const [modelo, setModelo] = useState('gemini')
  const [cargo, setCargo] = useState('')
  const [cantidad, setCantidad] = useState(5)
  const [dificultad, setDificultad] = useState('mixta')
  const [customPrompt, setCustomPrompt] = useState('')
  const [archivo, setArchivo] = useState(null)

  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState(null)
  const [pregeneradas, setPregeneradas] = useState([]) // {pregunta, seleccionada}
  const [tokensInfo, setTokensInfo] = useState(null)

  async function handleGenerar() {
    if (!nivelActivo) {
      setError('Selecciona un nivel en el sidebar antes de generar preguntas.')
      return
    }
    setGenerando(true)
    setError(null)
    setPregeneradas([])
    setTokensInfo(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()

      const fd = new FormData()
      fd.append('modelo', modelo)
      fd.append('cantidad', String(cantidad))
      fd.append('dificultad', dificultad)
      if (cargo.trim()) fd.append('cargo', cargo.trim())
      if (customPrompt.trim()) fd.append('custom_prompt', customPrompt.trim())
      if (archivo) fd.append('pdf', archivo)

      const res = await fetch(`${BASE_URL}/api/ia/test-generador`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
        body: fd,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar preguntas')

      const mapped = (data.preguntas || []).map(q => ({
        pregunta: mapAIQuestionToLocal(q),
        seleccionada: true,
      }))
      setPregeneradas(mapped)
      setTokensInfo({ in: data.tokensIn, out: data.tokensOut })
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerando(false)
    }
  }

  function toggleSeleccion(idx) {
    setPregeneradas(prev => prev.map((p, i) => i === idx ? { ...p, seleccionada: !p.seleccionada } : p))
  }

  function toggleTodas() {
    const todasSeleccionadas = pregeneradas.every(p => p.seleccionada)
    setPregeneradas(prev => prev.map(p => ({ ...p, seleccionada: !todasSeleccionadas })))
  }

  function handleImportar() {
    const seleccionadas = pregeneradas.filter(p => p.seleccionada).map(p => p.pregunta)
    if (!seleccionadas.length) { addToast('warning', 'Selecciona al menos una pregunta para importar'); return }
    if (!nivelActivo) { addToast('warning', 'Selecciona un nivel destino'); return }

    setPreguntas(prev => ({
      ...prev,
      [nivelActivo]: [...(prev[nivelActivo] || []), ...seleccionadas],
    }))
    addToast('success', `${seleccionadas.length} pregunta${seleccionadas.length !== 1 ? 's' : ''} importada${seleccionadas.length !== 1 ? 's' : ''} al nivel activo`)
    setPregeneradas([])
  }

  const nivelActualNombre = niveles.find(n => n._id === nivelActivo)?.name || '—'

  return (
    <div className="space-y-5">

      {/* Selector de nivel destino */}
      <Card className="p-5 space-y-3">
        <h3 className="font-bold text-lg font-headline flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
          Rellenar con IA
        </h3>
        <p className="text-xs text-on-surface-variant">
          Genera preguntas de juicio situado usando Gemini o DeepSeek. Las preguntas se previsualizan y puedes seleccionar cuáles importar al nivel activo.
        </p>

        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nivel destino</label>
          {niveles.length === 0 ? (
            <p className="text-xs text-error">Crea al menos un nivel antes de generar preguntas.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {niveles.map(nv => (
                <button key={nv._id} type="button"
                  onClick={() => setNivelActivo(nv._id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${nivelActivo === nv._id ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant hover:bg-primary/10'}`}>
                  {nv.name || 'Sin nombre'}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Configuración de generación */}
      <Card className="p-5 space-y-4">
        <h4 className="font-bold text-sm">Configuración</h4>

        {/* Modelo */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Modelo IA</label>
          <div className="flex bg-surface-container rounded-full p-1 w-fit">
            {[
              { key: 'gemini', label: 'Gemini' },
              { key: 'deepseek', label: 'DeepSeek' },
            ].map(m => (
              <button key={m.key} type="button" onClick={() => setModelo(m.key)}
                className={`px-5 py-2 rounded-full text-xs font-bold transition-all ${modelo === m.key ? 'bg-primary text-on-primary' : 'text-on-surface-variant'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cargo / contexto */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Cargo objetivo <span className="normal-case font-normal">(opcional)</span></label>
          <input type="text" value={cargo} onChange={e => setCargo(e.target.value)}
            placeholder="ej: Profesional Universitario Grado 11, Contraloría"
            className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Cantidad */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Cantidad</label>
            <input type="number" min={1} max={20} value={cantidad}
              onChange={e => setCantidad(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Dificultad */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Dificultad</label>
            <select value={dificultad} onChange={e => setDificultad(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30">
              <option value="mixta">Mixta</option>
              <option value="facil">Fácil</option>
              <option value="medio">Medio</option>
              <option value="dificil">Difícil</option>
            </select>
          </div>
        </div>

        {/* PDF */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">PDF de referencia <span className="normal-case font-normal">(OPEC, manual, convocatoria — opcional)</span></label>
          <div className="flex gap-2 items-center">
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => setArchivo(e.target.files?.[0] || null)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
              <span className="material-symbols-outlined text-sm">upload_file</span>
              {archivo ? archivo.name : 'Subir PDF'}
            </button>
            {archivo && (
              <button type="button" onClick={() => { setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                className="p-1.5 rounded-lg hover:bg-error-container/30 text-error transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Prompt maestro personalizado */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            Prompt maestro personalizado <span className="normal-case font-normal">(vacío = usa el prompt por defecto de Praxia)</span>
          </label>
          <textarea rows={4} value={customPrompt} onChange={e => setCustomPrompt(e.target.value)}
            placeholder="Deja vacío para usar el prompt por defecto. O pega aquí un prompt personalizado completo..."
            className="w-full px-3 py-2 rounded-xl border border-outline-variant bg-surface text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none font-mono" />
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-error-container/20 border border-error/20 text-error text-xs">
            <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">error</span>
            {error}
          </div>
        )}

        <button type="button" onClick={handleGenerar} disabled={generando || niveles.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-primary text-on-primary py-3 rounded-full font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
          {generando ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generando {cantidad} pregunta{cantidad !== 1 ? 's' : ''}...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Generar {cantidad} pregunta{cantidad !== 1 ? 's' : ''} con {modelo === 'gemini' ? 'Gemini' : 'DeepSeek'}
            </>
          )}
        </button>

        {tokensInfo && (
          <p className="text-[10px] text-on-surface-variant text-center">
            Tokens usados: {tokensInfo.in.toLocaleString()} entrada · {tokensInfo.out.toLocaleString()} salida
          </p>
        )}
      </Card>

      {/* Preview de preguntas generadas */}
      {pregeneradas.length > 0 && (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm">
              {pregeneradas.length} pregunta{pregeneradas.length !== 1 ? 's' : ''} generadas
              <span className="ml-2 text-xs font-normal text-on-surface-variant">→ nivel: <span className="font-bold text-primary">{nivelActualNombre}</span></span>
            </h4>
            <div className="flex items-center gap-2">
              <button type="button" onClick={toggleTodas}
                className="text-xs font-bold text-primary hover:underline">
                {pregeneradas.every(p => p.seleccionada) ? 'Deseleccionar todas' : 'Seleccionar todas'}
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {pregeneradas.map((item, idx) => {
              const p = item.pregunta
              const [verTec, setVerTec] = [false, () => {}] // solo lectura en preview
              return (
                <div key={p._id}
                  className={`rounded-2xl border-2 overflow-hidden transition-all cursor-pointer ${item.seleccionada ? 'border-primary/40' : 'border-outline-variant/20 opacity-60'}`}
                  onClick={() => toggleSeleccion(idx)}>

                  {/* Header selección */}
                  <div className={`p-4 space-y-2 ${item.seleccionada ? 'bg-primary/5' : 'bg-surface-container-lowest'}`}>
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all ${item.seleccionada ? 'border-primary bg-primary' : 'border-outline-variant'}`}>
                        {item.seleccionada && <span className="material-symbols-outlined text-xs text-white">check</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container font-bold text-on-surface-variant">{idx + 1}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            p.difficulty === 'facil' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : p.difficulty === 'dificil' ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>{p.difficulty}</span>
                          {p.bloom && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-bold">Bloom {p.bloom}</span>}
                          {p.area && <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-bold truncate max-w-[120px]">{p.area}</span>}
                          {p.estado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-dashed border-slate-200">{p.estado}</span>}
                        </div>
                        <p className="text-sm font-medium text-on-surface leading-relaxed">{p.text}</p>
                      </div>
                    </div>

                    {/* Opciones con análisis */}
                    <div className="space-y-1.5 pl-8" onClick={e => e.stopPropagation()}>
                      {p.options.map(opt => {
                        const ad = p.analisis_distractores?.[opt.letter]
                        return (
                          <div key={opt.letter} className={`rounded-xl border overflow-hidden ${
                            opt.is_correct ? 'border-secondary/40 bg-secondary/5' : 'border-outline-variant/20 bg-surface-container-lowest'
                          }`}>
                            <div className={`flex items-start gap-2 px-3 py-2 text-xs ${opt.is_correct ? 'text-secondary font-bold' : 'text-on-surface-variant'}`}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-extrabold mt-0.5 ${
                                opt.is_correct ? 'bg-secondary text-white' : 'bg-surface-container-high text-on-surface-variant'
                              }`}>{opt.letter}</div>
                              <span className="flex-1">{opt.text}</span>
                              {opt.is_correct && <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
                            </div>
                            {ad && (
                              <p className={`px-3 pb-2 pl-9 text-[11px] leading-relaxed italic border-t ${
                                opt.is_correct ? 'text-secondary/70 border-secondary/10' : 'text-slate-400 border-outline-variant/10'
                              }`}>{ad}</p>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Fundamento técnico */}
                    {p.explanation && (
                      <div className="pl-8" onClick={e => e.stopPropagation()}>
                        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3">
                          <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
                            Fundamento técnico
                          </p>
                          <p className="text-[11px] text-on-surface leading-relaxed">{p.explanation}</p>
                        </div>
                      </div>
                    )}

                    {/* Filtro de autonomía */}
                    {p.filtro_autonomia && (
                      <div className="pl-8" onClick={e => e.stopPropagation()}>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">manage_accounts</span>
                            Filtro de autonomía
                          </p>
                          <p className="text-[11px] text-amber-800 leading-relaxed">{p.filtro_autonomia}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-outline-variant/10">
            <p className="text-xs text-on-surface-variant">
              {pregeneradas.filter(p => p.seleccionada).length} de {pregeneradas.length} seleccionadas
            </p>
            <button type="button" onClick={handleImportar}
              disabled={pregeneradas.filter(p => p.seleccionada).length === 0}
              className="flex items-center gap-2 bg-secondary text-on-secondary px-6 py-2 rounded-full font-bold text-sm hover:bg-secondary/90 transition-all disabled:opacity-50">
              <span className="material-symbols-outlined text-sm">download</span>
              Importar seleccionadas al nivel
            </button>
          </div>
        </Card>
      )}
    </div>
  )
}
