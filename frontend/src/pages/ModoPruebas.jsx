import { useState, useRef } from 'react'
import { supabase } from '../utils/supabase'

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

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
  { value: 90,  label: '1:30 min' },
  { value: 120, label: '2 min' },
]

const COLORES_OPCION = {
  A: 'bg-blue-50 border-blue-200 text-blue-800',
  B: 'bg-slate-50 border-slate-200 text-slate-700',
  C: 'bg-slate-50 border-slate-200 text-slate-700',
  D: 'bg-slate-50 border-slate-200 text-slate-700',
}

function TarjetaPregunta({ pregunta, index }) {
  const [abierta, setAbierta] = useState(false)

  const difColor = {
    facil:   'bg-green-100 text-green-700',
    medio:   'bg-yellow-100 text-yellow-700',
    dificil: 'bg-red-100 text-red-700',
  }[pregunta.dificultad] || 'bg-slate-100 text-slate-600'

  const tipoColor = pregunta.tipo === 'funcional'
    ? 'bg-primary/10 text-primary'
    : 'bg-tertiary/10 text-tertiary'

  return (
    <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm">
      <button
        onClick={() => setAbierta(a => !a)}
        className="w-full text-left p-4 flex items-start gap-3 hover:bg-surface-container/40 transition-colors"
      >
        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
          {index + 1}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${difColor}`}>
              {pregunta.dificultad || 'medio'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${tipoColor}`}>
              {pregunta.tipo || 'funcional'}
            </span>
            {pregunta.area && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-surface-container text-on-surface-variant uppercase">
                {pregunta.area}
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface leading-snug line-clamp-2">{pregunta.enunciado}</p>
        </div>

        <span className="material-symbols-outlined text-on-surface-variant text-lg flex-shrink-0 mt-1 transition-transform duration-200"
          style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      {abierta && (
        <div className="px-4 pb-4 space-y-2 border-t border-outline-variant/10 pt-3">
          {['A', 'B', 'C', 'D'].map(letra => (
            <div
              key={letra}
              className={`flex items-start gap-2 p-3 rounded-xl border text-sm transition-all ${
                pregunta.correcta === letra
                  ? 'bg-green-50 border-green-300 text-green-800'
                  : 'bg-surface-container border-outline-variant/20 text-on-surface-variant'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 mt-0.5 ${
                pregunta.correcta === letra
                  ? 'bg-green-200 text-green-800'
                  : 'bg-surface-container-high text-on-surface-variant'
              }`}>
                {letra}
              </span>
              <span className="leading-snug">{pregunta[letra]}</span>
              {pregunta.correcta === letra && (
                <span className="material-symbols-outlined text-green-600 text-lg ml-auto flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              )}
            </div>
          ))}

          {pregunta.explicacion && (
            <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-xl">
              <p className="text-[10px] font-bold text-primary uppercase mb-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">lightbulb</span>
                Explicación
              </p>
              <p className="text-xs text-on-surface-variant leading-relaxed">{pregunta.explicacion}</p>
            </div>
          )}
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

  const [generando, setGenerando] = useState(false)
  const [preguntas, setPreguntas] = useState([])
  const [tokenInfo, setTokenInfo] = useState(null)
  const [error,     setError]     = useState('')

  const resultRef = useRef(null)

  async function generar() {
    if (generando) return
    setGenerando(true)
    setError('')
    setPreguntas([])
    setTokenInfo(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sesión expirada.')

      const res = await fetch(`${BASE}/api/ia/test-generador`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          custom_prompt: customPrompt.trim() || null,
          modelo,
          cantidad,
          cargo: cargo.trim() || null,
          dificultad,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`)

      setPreguntas(data.preguntas || [])
      setTokenInfo({ in: data.tokensIn || 0, out: data.tokensOut || 0 })

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
        <div className="mb-8">
          <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
            <span>Dashboard</span>
            <span className="material-symbols-outlined text-[10px]">chevron_right</span>
            <span className="text-primary">Modo Pruebas</span>
          </nav>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-tertiary text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight font-headline">Modo Pruebas</h1>
              <p className="text-sm text-on-surface-variant mt-0.5">
                Sandbox para probar prompts y modelos de IA sin consumir tokens del sistema. Máx. 20 preguntas.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Config Panel ─── */}
          <div className="lg:col-span-4 space-y-4">

            {/* Cerebro */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">memory</span>
                Cerebro IA
              </p>
              <div className="flex gap-2">
                {[
                  { value: 'gemini',   label: 'Gemini',   sub: '2.5 Flash Lite' },
                  { value: 'deepseek', label: 'DeepSeek', sub: 'V4 Pro' },
                ].map(m => (
                  <button
                    key={m.value}
                    onClick={() => setModelo(m.value)}
                    className={`flex-1 py-3 rounded-xl border text-sm font-bold transition-all ${
                      modelo === m.value
                        ? 'bg-primary text-on-primary border-primary shadow-md'
                        : 'bg-surface-container border-outline-variant/20 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    <p>{m.label}</p>
                    <p className={`text-[10px] font-normal mt-0.5 ${modelo === m.value ? 'text-primary-fixed' : 'opacity-60'}`}>{m.sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cargo */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">work</span>
                Cargo objetivo
              </p>
              <input
                type="text"
                value={cargo}
                onChange={e => setCargo(e.target.value)}
                placeholder="Ej: Profesional Universitario Grado 11"
                className="w-full bg-surface-container border-none rounded-xl py-2.5 px-3.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Cantidad + Dificultad */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">format_list_numbered</span>
                    Preguntas
                  </p>
                  <span className="text-lg font-extrabold text-primary">{cantidad}</span>
                </div>
                <input
                  type="range"
                  min={1} max={20} step={1}
                  value={cantidad}
                  onChange={e => setCantidad(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant mt-1">
                  <span>1</span><span>10</span><span>20</span>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">bar_chart</span>
                  Dificultad
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {DIFICULTADES.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setDificultad(d.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        dificultad === d.value
                          ? 'bg-primary text-on-primary shadow'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">timer</span>
                  Tiempo por pregunta
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {TIEMPOS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setTiempo(t.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        tiempo === t.value
                          ? 'bg-primary text-on-primary shadow'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Prompt personalizado */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">edit_note</span>
                  Prompt personalizado
                </p>
                <span className="text-[9px] text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">opcional</span>
              </div>
              <textarea
                value={customPrompt}
                onChange={e => setCustomPrompt(e.target.value)}
                rows={7}
                placeholder="Deja vacío para usar el prompt configurado en Admin → Entrenamiento IA.&#10;&#10;O escribe aquí un prompt personalizado para probar cambios antes de guardarlo."
                className="w-full bg-surface-container border-none rounded-xl py-2.5 px-3.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary/20 resize-y font-mono leading-relaxed"
              />
              {customPrompt.trim() && (
                <button
                  onClick={() => setCustomPrompt('')}
                  className="mt-2 text-[10px] text-on-surface-variant hover:text-error flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                  Limpiar — usar prompt del sistema
                </button>
              )}
            </div>

            {/* Botón generar */}
            <button
              onClick={generar}
              disabled={generando}
              className="w-full py-4 bg-primary text-on-primary rounded-full font-extrabold text-sm shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {generando ? (
                <>
                  <span className="w-4 h-4 border-2 border-on-primary/40 border-t-on-primary rounded-full animate-spin" />
                  Generando {cantidad} preguntas con {modelo === 'gemini' ? 'Gemini' : 'DeepSeek'}…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>rocket_launch</span>
                  Generar {cantidad} {cantidad === 1 ? 'pregunta' : 'preguntas'}
                </>
              )}
            </button>

            {/* Info tokens */}
            {tokenInfo && (
              <div className="bg-tertiary/5 border border-tertiary/15 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-tertiary uppercase mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">token</span>
                  Tokens consumidos
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-extrabold text-on-surface">{tokenInfo.in.toLocaleString()}</p>
                    <p className="text-[10px] text-on-surface-variant">Entrada</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-on-surface">{tokenInfo.out.toLocaleString()}</p>
                    <p className="text-[10px] text-on-surface-variant">Salida</p>
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-tertiary">{(tokenInfo.in + tokenInfo.out).toLocaleString()}</p>
                    <p className="text-[10px] text-on-surface-variant">Total</p>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-error-container text-error rounded-2xl p-4 text-sm font-medium flex items-start gap-2">
                <span className="material-symbols-outlined text-lg flex-shrink-0 mt-0.5">error</span>
                {error}
              </div>
            )}
          </div>

          {/* ── Results Panel ─── */}
          <div className="lg:col-span-8" ref={resultRef}>
            {preguntas.length === 0 && !generando && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/15 border-dashed">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4"
                  style={{ fontVariationSettings: "'FILL' 1" }}>science</span>
                <p className="text-base font-bold text-on-surface-variant">Sandbox listo</p>
                <p className="text-sm text-on-surface-variant/70 mt-1 max-w-sm">
                  Configura tu prueba a la izquierda y pulsa "Generar" para ver las preguntas aquí.
                </p>
              </div>
            )}

            {generando && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-8 bg-surface-container-lowest rounded-2xl border border-outline-variant/15">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
                  <span className="material-symbols-outlined text-primary text-3xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
                <p className="text-base font-bold text-on-surface">Generando con {modelo === 'gemini' ? 'Gemini 2.5 Flash Lite' : 'DeepSeek V4 Pro'}…</p>
                <p className="text-sm text-on-surface-variant mt-1">{cantidad} preguntas · {dificultad} · {cargo || 'cargo general'}</p>
              </div>
            )}

            {preguntas.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold font-headline">
                      {preguntas.length} {preguntas.length === 1 ? 'pregunta' : 'preguntas'} generadas
                    </h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {modelo === 'gemini' ? 'Gemini 2.5 Flash Lite' : 'DeepSeek V4 Pro'} · {dificultad} · {cargo || 'cargo general'}
                    </p>
                  </div>
                  <button
                    onClick={() => { setPreguntas([]); setTokenInfo(null) }}
                    className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container hover:text-error transition-colors"
                    title="Limpiar resultados"
                  >
                    <span className="material-symbols-outlined text-lg">delete_sweep</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {preguntas.map((p, i) => (
                    <TarjetaPregunta key={i} pregunta={p} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
