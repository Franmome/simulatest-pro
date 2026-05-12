import { useState, useRef, useMemo } from 'react'
import { supabase } from '../utils/supabase'

const BASE = (() => {
  const env = import.meta.env.VITE_BACKEND_URL
  if (env && !env.includes('localhost')) return env
  if (!window.location.hostname.includes('localhost')) return window.location.origin
  return 'http://localhost:3000'
})()

const DIFICULTADES = [
  { value: 'mixta',   label: 'Mixta' },
  { value: 'facil',   label: 'Fácil' },
  { value: 'medio',   label: 'Medio' },
  { value: 'dificil', label: 'Difícil' },
]

const TIEMPOS = [
  { value: 0,   label: 'Sin límite' },
  { value: 30,  label: '30 s' },
  { value: 60,  label: '1 min' },
  { value: 90,  label: '1:30' },
  { value: 120, label: '2 min' },
]

function fmt(n) { return (n || 0).toLocaleString() }

const DIF_CHIP_MP = {
  facil:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  medio:   'bg-amber-50 text-amber-700 border-amber-200',
  dificil: 'bg-rose-50 text-rose-700 border-rose-200',
}
const TIPO_CHIP_MP = {
  funcional:      'bg-primary/5 text-primary border-primary/20',
  comportamental: 'bg-tertiary/5 text-tertiary border-tertiary/20',
}
const BLOOM_LABEL_MP = { I: 'Bloom I', II: 'Bloom II', III: 'Bloom III' }

function TarjetaPregunta({ pregunta, index }) {
  const [abierta, setAbierta] = useState(false)
  const [verTecnico, setVerTecnico] = useState(false)

  const difChip  = DIF_CHIP_MP[pregunta.dificultad]  || 'bg-slate-100 text-slate-600 border-slate-200'
  const tipoChip = TIPO_CHIP_MP[pregunta.tipo] || 'bg-slate-100 text-slate-500 border-slate-200'

  const ad = pregunta.analisis_distractores

  return (
    <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-white shadow-sm">

      {/* Header */}
      <button onClick={() => setAbierta(a => !a)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-slate-50 transition-colors">
        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1 mb-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${difChip}`}>
              {pregunta.dificultad || 'medio'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${tipoChip}`}>
              {pregunta.tipo || 'funcional'}
            </span>
            {pregunta.bloom && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                {BLOOM_LABEL_MP[pregunta.bloom] || pregunta.bloom}
              </span>
            )}
            {pregunta.area && (
              <span className="px-2 py-0.5 rounded-full text-[9px] text-slate-400 bg-slate-50 border border-slate-100 max-w-[130px] truncate">
                {pregunta.area}
              </span>
            )}
            {pregunta.estado && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold text-slate-400 bg-slate-50 border border-dashed border-slate-200">
                {pregunta.estado}
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface leading-snug line-clamp-2">{pregunta.enunciado}</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant text-lg flex-shrink-0 mt-0.5 transition-transform duration-200"
          style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
      </button>

      {/* Detalle */}
      {abierta && (
        <div className="border-t border-outline-variant/10 p-4 space-y-2">

          {/* Opciones */}
          {['A','B','C','D'].filter(l => pregunta[l]?.trim()).map(letra => {
            const esCorrecta = pregunta.correcta === letra
            const analisis   = ad?.[letra]
            return (
              <div key={letra} className={`rounded-xl border overflow-hidden ${
                esCorrecta ? 'border-secondary/40 bg-secondary/5' : 'border-slate-100 bg-slate-50'
              }`}>
                <div className="flex items-start gap-2 px-3 py-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-extrabold mt-0.5 ${
                    esCorrecta ? 'bg-secondary text-white' : 'bg-slate-200 text-slate-500'
                  }`}>{letra}</div>
                  <span className={`text-sm leading-snug flex-1 ${esCorrecta ? 'text-secondary font-semibold' : 'text-on-surface-variant'}`}>
                    {pregunta[letra]}
                  </span>
                  {esCorrecta && (
                    <span className="material-symbols-outlined text-secondary text-base flex-shrink-0"
                      style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  )}
                </div>
                {analisis && (
                  <p className={`px-3 pb-2.5 pl-11 text-[11px] leading-relaxed italic border-t ${
                    esCorrecta ? 'text-secondary/70 border-secondary/10' : 'text-slate-400 border-slate-100'
                  }`}>{analisis}</p>
                )}
              </div>
            )
          })}

          {/* Datos técnicos */}
          {(pregunta.justificacion || pregunta.filtro_autonomia) && (
            <div className="pt-1">
              <button onClick={() => setVerTecnico(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:underline mb-2">
                <span className="material-symbols-outlined text-sm">analytics</span>
                {verTecnico ? 'Ocultar datos técnicos' : 'Ver datos técnicos'}
              </button>

              {verTecnico && (
                <div className="space-y-2">
                  {pregunta.justificacion && (
                    <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>gavel</span>
                        Fundamento técnico
                      </p>
                      <p className="text-sm text-on-surface leading-relaxed">{pregunta.justificacion}</p>
                    </div>
                  )}
                  {pregunta.filtro_autonomia && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">manage_accounts</span>
                        Filtro de autonomía
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed">{pregunta.filtro_autonomia}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fallback explicacion legacy */}
          {!pregunta.justificacion && pregunta.explicacion && (
            <div className="mt-1 p-3 bg-primary/5 border border-primary/10 rounded-xl">
              <p className="text-[9px] font-bold text-primary uppercase mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">lightbulb</span>Explicación
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">{pregunta.explicacion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RunCard({ run, onEliminar }) {
  const [expandido, setExpandido] = useState(true)
  const fecha = new Date(run.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
  const total = run.tokensIn + run.tokensOut

  return (
    <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm">
      {/* Header del run */}
      <div className="flex items-center gap-3 p-4 border-b border-outline-variant/10">
        <button onClick={() => setExpandido(e => !e)} className="flex-1 flex items-center gap-3 text-left">
          <span className="material-symbols-outlined text-on-surface-variant text-lg transition-transform duration-200"
            style={{ transform: expandido ? 'rotate(90deg)' : 'rotate(0deg)' }}>chevron_right</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface truncate">
              {run.cargo || 'Cargo general'} · {run.preguntas.length} preg.
            </p>
            <p className="text-[10px] text-on-surface-variant">
              {run.modelo === 'gemini' ? 'Gemini 2.5 Flash Lite' : 'DeepSeek V4 Pro'} · {run.dificultad} · {fecha}
              {run.conPdf && <span className="ml-1.5 inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-[11px]">picture_as_pdf</span>PDF</span>}
            </p>
          </div>
        </button>

        {/* Tokens de este run */}
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-extrabold text-tertiary">{fmt(total)}</p>
          <p className="text-[9px] text-on-surface-variant">tokens</p>
        </div>

        <button onClick={() => onEliminar(run.id)} title="Eliminar este run"
          className="p-1.5 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors flex-shrink-0">
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>

      {/* Preguntas */}
      {expandido && (
        <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
          {run.preguntas.map((p, i) => (
            <TarjetaPregunta key={i} pregunta={p} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ModoPruebas() {
  const [cargo,        setCargo]        = useState('')
  const [modelo,       setModelo]       = useState('gemini')
  const [cantidad,     setCantidad]     = useState(5)
  const [dificultad,   setDificultad]   = useState('mixta')
  const [tiempo,       setTiempo]       = useState(0)
  const [customPrompt, setCustomPrompt] = useState('')
  const [pdfFile,      setPdfFile]      = useState(null)
  const pdfInputRef = useRef(null)

  const [generando, setGenerando] = useState(false)
  const [error,     setError]     = useState('')

  // Historial de runs en la sesión
  const [historial, setHistorial] = useState([])

  const resultRef = useRef(null)

  // Token totales acumulados en la sesión
  const totalTokensSesion = useMemo(
    () => historial.reduce((s, r) => s + r.tokensIn + r.tokensOut, 0),
    [historial]
  )

  function eliminarRun(id) {
    setHistorial(h => h.filter(r => r.id !== id))
  }

  function limpiarTodo() {
    if (!confirm('¿Limpiar todo el historial de esta sesión?')) return
    setHistorial([])
  }

  async function generar() {
    if (generando) return
    setGenerando(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sesión expirada.')

      const form = new FormData()
      form.append('modelo',    modelo)
      form.append('cantidad',  cantidad)
      form.append('dificultad', dificultad)
      if (cargo.trim())        form.append('cargo',         cargo.trim())
      if (customPrompt.trim()) form.append('custom_prompt', customPrompt.trim())
      if (pdfFile)             form.append('pdf',           pdfFile, pdfFile.name)

      const res = await fetch(`${BASE}/api/ia/test-generador`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      const nuevoRun = {
        id:        Date.now(),
        timestamp: new Date().toISOString(),
        cargo:     cargo.trim() || null,
        modelo,
        cantidad,
        dificultad,
        conPdf:    !!pdfFile,
        preguntas: data.preguntas || [],
        tokensIn:  data.tokensIn  || 0,
        tokensOut: data.tokensOut || 0,
      }

      setHistorial(h => [nuevoRun, ...h])
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="p-6 md:p-8 max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
            <span>Dashboard</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-primary">Modo Pruebas</span>
          </nav>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-tertiary text-2xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight font-headline">Modo Pruebas</h1>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  Sandbox para probar prompts y modelos de IA. Máx. 20 preguntas por generación.
                </p>
              </div>
            </div>

            {/* Contador sesión */}
            {historial.length > 0 && (
              <div className="bg-tertiary/5 border border-tertiary/20 rounded-2xl px-4 py-2 text-right flex-shrink-0">
                <p className="text-xl font-extrabold text-tertiary">{fmt(totalTokensSesion)}</p>
                <p className="text-[10px] text-on-surface-variant">tokens · sesión ({historial.length} {historial.length === 1 ? 'run' : 'runs'})</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Config Panel ─────────────────────────────── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Cerebro */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">memory</span>Cerebro IA
              </p>
              <div className="flex gap-2">
                {[
                  { value: 'gemini',   label: 'Gemini',   sub: '2.5 Flash Lite' },
                  { value: 'deepseek', label: 'DeepSeek', sub: 'V4 Pro' },
                ].map(m => (
                  <button key={m.value} onClick={() => setModelo(m.value)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                      modelo === m.value
                        ? 'bg-primary text-on-primary border-primary shadow-md'
                        : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                    }`}>
                    <p>{m.label}</p>
                    <p className={`text-[10px] font-normal mt-0.5 ${modelo === m.value ? 'text-primary-fixed' : 'opacity-60'}`}>{m.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cargo */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">work</span>Cargo objetivo
              </p>
              <input type="text" value={cargo} onChange={e => setCargo(e.target.value)}
                placeholder="Ej: Profesional Universitario Grado 11"
                className="w-full bg-surface-container border-none rounded-xl py-2.5 px-3.5 text-sm outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            {/* PDF OPEC */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">picture_as_pdf</span>PDF OPEC
                <span className="text-[9px] bg-surface-container px-1.5 py-0.5 rounded-full ml-auto">opcional</span>
              </p>
              <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden"
                onChange={e => setPdfFile(e.target.files[0] || null)} />
              {pdfFile ? (
                <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/15 rounded-xl">
                  <span className="material-symbols-outlined text-primary text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
                  <p className="text-xs font-medium text-on-surface flex-1 truncate">{pdfFile.name}</p>
                  <button onClick={() => { setPdfFile(null); pdfInputRef.current.value = '' }}
                    className="p-1 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
              ) : (
                <button onClick={() => pdfInputRef.current.click()}
                  className="w-full border-2 border-dashed border-outline-variant/30 rounded-xl py-4 text-center text-sm text-on-surface-variant hover:border-primary/40 hover:bg-primary/3 transition-all">
                  <span className="material-symbols-outlined text-xl block mb-1 opacity-50">upload_file</span>
                  Subir convocatoria / OPEC
                </button>
              )}
            </div>

            {/* Cantidad + Dificultad + Tiempo */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">format_list_numbered</span>Preguntas
                  </p>
                  <span className="text-lg font-extrabold text-primary">{cantidad}</span>
                </div>
                <input type="range" min={1} max={20} step={1} value={cantidad}
                  onChange={e => setCantidad(Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                  <span>1</span><span>10</span><span>20</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">bar_chart</span>Dificultad
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {DIFICULTADES.map(d => (
                    <button key={d.value} onClick={() => setDificultad(d.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        dificultad === d.value
                          ? 'bg-primary text-on-primary shadow'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}>{d.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">timer</span>Tiempo / pregunta
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {TIEMPOS.map(t => (
                    <button key={t.value} onClick={() => setTiempo(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        tiempo === t.value
                          ? 'bg-primary text-on-primary shadow'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}>{t.label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prompt personalizado */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">edit_note</span>Prompt personalizado
                </p>
                <span className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">opcional</span>
              </div>
              <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} rows={6}
                placeholder="Vacío = usa el prompt del sistema (AdminIATraining).&#10;&#10;Escribe aquí para probar cambios antes de guardarlos."
                className="w-full bg-surface-container border-none rounded-xl py-2.5 px-3.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20 resize-y font-mono leading-relaxed" />
              {customPrompt.trim() && (
                <button onClick={() => setCustomPrompt('')}
                  className="mt-1.5 text-[10px] text-on-surface-variant hover:text-error flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">close</span>
                  Limpiar — usar prompt del sistema
                </button>
              )}
            </div>

            {/* Generar */}
            <button onClick={generar} disabled={generando}
              className="w-full py-4 bg-primary text-on-primary rounded-full font-extrabold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {generando ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                  Generando con {modelo === 'gemini' ? 'Gemini' : 'DeepSeek'}…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                  Generar {cantidad} {cantidad === 1 ? 'pregunta' : 'preguntas'}
                </>
              )}
            </button>

            {error && (
              <div className="bg-error-container text-error rounded-2xl p-4 text-sm font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5">error</span>
                {error}
              </div>
            )}
          </div>

          {/* ── Results Panel ────────────────────────────── */}
          <div className="lg:col-span-8" ref={resultRef}>

            {historial.length === 0 && !generando && (
              <div className="min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 border-dashed">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4"
                  style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
                <p className="text-base font-bold text-on-surface-variant">Sandbox listo</p>
                <p className="text-sm text-on-surface-variant/70 mt-1 max-w-sm">
                  Configura tu prueba a la izquierda y pulsa "Generar" para ver las preguntas aquí.
                </p>
              </div>
            )}

            {generando && (
              <div className="min-h-[200px] flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3 animate-pulse">
                  <span className="material-symbols-outlined text-primary text-2xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <p className="text-sm font-bold text-on-surface">Generando con {modelo === 'gemini' ? 'Gemini 2.5 Flash Lite' : 'DeepSeek V4 Pro'}…</p>
                <p className="text-xs text-on-surface-variant mt-1">{cantidad} preguntas · {dificultad} · {cargo || 'cargo general'}{pdfFile ? ' · PDF' : ''}</p>
              </div>
            )}

            {historial.length > 0 && (
              <div className="space-y-4">
                {/* Barra de resumen */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-on-surface">
                      {historial.length} {historial.length === 1 ? 'generación' : 'generaciones'} · sesión actual
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {historial.reduce((s, r) => s + r.preguntas.length, 0)} preguntas totales
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Tabla tokens por run */}
                    <div className="hidden md:flex gap-4 text-center">
                      {historial.slice(0, 3).map((r, i) => (
                        <div key={r.id} className="text-center">
                          <p className="text-xs font-extrabold text-tertiary">{fmt(r.tokensIn + r.tokensOut)}</p>
                          <p className="text-[9px] text-on-surface-variant">run {historial.length - i}</p>
                        </div>
                      ))}
                    </div>

                    <button onClick={limpiarTodo}
                      className="text-xs font-bold text-on-surface-variant hover:text-error flex items-center gap-1.5 px-3 py-2 rounded-xl hover:bg-error/10 transition-colors">
                      <span className="material-symbols-outlined text-base">delete_sweep</span>
                      Limpiar todo
                    </button>
                  </div>
                </div>

                {/* Runs */}
                {historial.map(run => (
                  <RunCard key={run.id} run={run} onEliminar={eliminarRun} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
