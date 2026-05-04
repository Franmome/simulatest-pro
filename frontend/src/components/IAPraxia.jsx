// IAPraxia.jsx
// Asistente de estudio con IA para DetallePrueba.
// Gated: solo se muestra si el paquete tiene has_ai_chat = true.

import { useState, useRef, useEffect } from 'react'
import { chatPraxia } from '../utils/gemini'

// ── Burbuja de mensaje ────────────────────────────────────────────────────────

function Burbuja({ msg }) {
  const esUser = msg.role === 'user'
  return (
    <div className={`flex gap-2 ${esUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {!esUser && (
        <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0 mt-0.5">
          <span className="material-symbols-outlined text-white text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        </div>
      )}
      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
        ${esUser
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-slate-100 text-on-surface rounded-tl-sm'
        }`}>
        {msg.content}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function IAPraxia({ evaluacionNombre, tienePlan }) {
  const [abierto, setAbierto] = useState(false)
  const [historial, setHistorial] = useState([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (abierto) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [abierto, historial])

  async function enviar() {
    const texto = input.trim()
    if (!texto || cargando) return
    setInput('')
    setError(null)

    const nuevoHist = [...historial, { role: 'user', content: texto }]
    setHistorial(nuevoHist)
    setCargando(true)

    try {
      const respuesta = await chatPraxia({
        mensaje: texto,
        contexto_evaluacion: evaluacionNombre,
        historial: historial.slice(-10), // últimos 10 mensajes como contexto
      })
      setHistorial(prev => [...prev, { role: 'assistant', content: respuesta }])
    } catch (e) {
      setError(e.message || 'Error al conectar con Praxia.')
    } finally {
      setCargando(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() }
  }

  // Si no tiene plan, mostrar teaser
  if (!tienePlan) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -translate-y-10 translate-x-10 pointer-events-none" />
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
          <div>
            <p className="font-extrabold text-sm">IA Praxia</p>
            <span className="text-[10px] font-bold bg-white/15 text-white/80 px-2 py-0.5 rounded-full">Plan Premium</span>
          </div>
        </div>
        <p className="text-white/70 text-xs leading-relaxed">
          Tu asistente personal con IA. Disponible en el plan que incluye el asistente Praxia.
        </p>
      </div>
    )
  }

  // Chat cerrado → botón de apertura
  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="w-full group bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-left text-white hover:from-slate-700 hover:to-slate-800 transition-all active:scale-[0.98]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-white text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-sm">Habla con Praxia IA</p>
            <p className="text-white/60 text-xs">Preguntas, dudas, resúmenes…</p>
          </div>
          <span className="material-symbols-outlined text-white/40 group-hover:text-white transition-colors">
            chat_bubble
          </span>
        </div>
        {historial.length > 0 && (
          <p className="text-white/50 text-xs mt-2 truncate">
            Último: {historial.at(-1)?.content?.slice(0, 50)}…
          </p>
        )}
      </button>
    )
  }

  // Chat abierto
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col" style={{ height: '420px' }}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl">
        <div className="w-7 h-7 rounded-xl bg-white/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-sm"
            style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-white text-sm">Praxia IA</p>
          <p className="text-white/50 text-[10px] truncate">{evaluacionNombre}</p>
        </div>
        <button onClick={() => setAbierto(false)}
          className="text-white/50 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {historial.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 pb-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-slate-400 text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <p className="text-sm font-bold text-on-surface">Hola, soy Praxia</p>
            <p className="text-xs text-on-surface-variant max-w-[200px] leading-relaxed">
              Pregúntame sobre temas del examen, pídeme un resumen o aclara tus dudas.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-1">
              {[
                '¿Qué es el MIPG?',
                'Explícame la Contraloría',
                '¿Qué estudiar primero?',
              ].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                  className="text-[10px] bg-primary/10 text-primary font-bold px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {historial.map((msg, i) => <Burbuja key={i} msg={msg} />)}

        {cargando && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1.5 items-center">
              {[0, 0.15, 0.3].map(d => (
                <div key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-error text-xs bg-error-container/30 px-3 py-2 rounded-xl">
            <span className="material-symbols-outlined text-sm">error</span>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-2 flex gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe tu pregunta…"
          disabled={cargando}
          className="flex-1 resize-none text-sm px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all placeholder:text-slate-400 disabled:opacity-50"
          style={{ maxHeight: '80px' }}
        />
        <button
          onClick={enviar}
          disabled={!input.trim() || cargando}
          className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 active:scale-95 transition-all self-end flex-shrink-0">
          <span className="material-symbols-outlined text-lg"
            style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
        </button>
      </div>
    </div>
  )
}
