import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || ''
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

// ── Acciones rápidas IA ───────────────────────────────────────────────────────
const ACCIONES = [
  { tipo: 'resumen',    icon: 'summarize',      label: 'Resumen',       desc: 'Resumen ejecutivo del material',       color: 'from-blue-600 to-blue-700'   },
  { tipo: 'quiz',       icon: 'quiz',           label: 'Quiz',          desc: '10 preguntas tipo CNSC con respuestas', color: 'from-violet-600 to-violet-700' },
  { tipo: 'flashcards', icon: 'style',          label: 'Flashcards',    desc: '12 tarjetas concepto / respuesta',      color: 'from-amber-500 to-orange-600'  },
  { tipo: 'plan',       icon: 'calendar_month', label: 'Plan de estudio', desc: 'Plan semanal de 4 semanas',           color: 'from-emerald-600 to-teal-700'  },
]

const FUENTE_META = {
  manual:     { label: 'Manual',      icon: 'edit',           color: 'bg-slate-100 text-slate-600'    },
  ia_chat:    { label: 'Chat IA',     icon: 'chat',           color: 'bg-primary/10 text-primary'     },
  resumen:    { label: 'Resumen',     icon: 'summarize',      color: 'bg-blue-100 text-blue-700'      },
  quiz:       { label: 'Quiz',        icon: 'quiz',           color: 'bg-violet-100 text-violet-700'  },
  flashcards: { label: 'Flashcards',  icon: 'style',          color: 'bg-amber-100 text-amber-700'    },
  plan:       { label: 'Plan',        icon: 'calendar_month', color: 'bg-emerald-100 text-emerald-700' },
  simulacro:  { label: 'Simulacro',   icon: 'quiz',           color: 'bg-secondary/10 text-secondary'  },
}

// ── Bubble chat ───────────────────────────────────────────────────────────────
function Bubble({ msg, onGuardar, guardando }) {
  const esIA = msg.rol === 'assistant'
  return (
    <div className={`flex gap-2.5 ${esIA ? '' : 'flex-row-reverse'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs
        ${esIA ? 'bg-primary text-on-primary' : 'bg-slate-200 text-slate-600'}`}>
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
          {esIA ? 'smart_toy' : 'person'}
        </span>
      </div>
      <div className="flex flex-col gap-1 max-w-[82%]">
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${esIA
            ? 'bg-white border border-slate-200 rounded-tl-sm text-on-surface'
            : 'bg-primary text-on-primary rounded-tr-sm'}`}>
          {msg.contenido}
        </div>
        {esIA && (
          <button
            onClick={() => onGuardar(msg.contenido)}
            disabled={guardando}
            className="self-start text-[11px] text-slate-400 hover:text-primary flex items-center gap-1 transition-colors disabled:opacity-40 ml-1">
            <span className="material-symbols-outlined text-xs">bookmark_add</span>
            {guardando ? 'Guardando…' : 'Guardar en notas'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Tarjeta de nota ───────────────────────────────────────────────────────────
function TarjetaNota({ nota, onBorrar, expandida, onToggle }) {
  const meta = FUENTE_META[nota.fuente] || FUENTE_META.manual
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
          <span className="material-symbols-outlined text-[10px]">{meta.icon}</span>
          {meta.label}
        </span>
        <span className="text-[10px] text-slate-400 flex-1">
          {new Date(nota.created_at).toLocaleDateString('es-CO')}
        </span>
        <button onClick={onToggle}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
          <span className="material-symbols-outlined text-sm">{expandida ? 'expand_less' : 'expand_more'}</span>
        </button>
        <button onClick={() => onBorrar(nota.id)}
          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-error/10 text-slate-300 hover:text-error transition-colors">
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>
      <div className={`px-3 text-xs leading-relaxed whitespace-pre-wrap text-on-surface transition-all overflow-hidden
        ${expandida ? 'py-3 max-h-[600px]' : 'py-2 max-h-16 text-ellipsis line-clamp-3'}`}>
        {nota.contenido}
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CuadernoIA() {
  const { packageId } = useParams()
  const navigate      = useNavigate()
  const { user }      = useAuth()

  // Estado general
  const [pkgNombre,   setPkgNombre]   = useState('')
  const [fuentes,     setFuentes]     = useState([])
  const [tabMobile,   setTabMobile]   = useState('chat')

  // Chat
  const [mensajes,    setMensajes]    = useState([])
  const [input,       setInput]       = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [guardandoId, setGuardandoId] = useState(null)
  const [usados,      setUsados]      = useState(0)
  const [limite,      setLimite]      = useState(40)
  const [chatError,   setChatError]   = useState('')
  const bottomRef = useRef(null)

  // Notas
  const [notas,       setNotas]       = useState([])
  const [expandidas,  setExpandidas]  = useState({})
  const [nuevaNota,   setNuevaNota]   = useState('')
  const [addingNota,  setAddingNota]  = useState(false)

  // Generación
  const [generando,   setGenerando]   = useState(null) // tipo que está generando

  useEffect(() => { cargarTodo() }, [packageId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function cargarTodo() {
    const h = await authHeaders()
    const [histRes, notasRes, pkgRes, matsRes] = await Promise.all([
      fetch(`${BASE}/api/cuaderno/${packageId}/historial`, { headers: h }),
      fetch(`${BASE}/api/cuaderno/${packageId}/notas`,    { headers: h }),
      supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
      supabase.from('study_materials').select('id, title, type')
        .eq('package_id', parseInt(packageId)).eq('is_active', true),
    ])
    if (histRes.ok)  { const d = await histRes.json();  setMensajes(d.mensajes || []) }
    if (notasRes.ok) { const d = await notasRes.json(); setNotas(d.notas || []) }
    if (pkgRes.data) setPkgNombre(pkgRes.data.name)
    if (matsRes.data) setFuentes(matsRes.data)

    const inicio = new Date(); inicio.setDate(1); inicio.setHours(0,0,0,0)
    const { count } = await supabase
      .from('user_cuaderno_mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id).eq('package_id', parseInt(packageId)).eq('rol', 'user')
      .gte('created_at', inicio.toISOString())
    setUsados(count || 0)
  }

  // ── Chat ──
  async function enviar() {
    if (!input.trim() || enviando) return
    const texto = input.trim()
    setInput(''); setChatError('')
    setEnviando(true)
    setMensajes(prev => [...prev, { id: `t${Date.now()}`, rol: 'user', contenido: texto }])
    try {
      const h = await authHeaders()
      const res  = await fetch(`${BASE}/api/cuaderno/${packageId}/chat`, {
        method: 'POST', headers: h, body: JSON.stringify({ mensaje: texto }),
      })
      const data = await res.json()
      if (!res.ok) { setChatError(data.error || 'Error'); return }
      setMensajes(prev => [...prev, { id: `a${Date.now()}`, rol: 'assistant', contenido: data.respuesta }])
      setUsados(data.usados); setLimite(data.limite)
    } catch { setChatError('Error de conexión.') }
    finally { setEnviando(false) }
  }

  async function guardarMsgComoNota(contenido) {
    setGuardandoId(contenido)
    const h = await authHeaders()
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/nota`, {
      method: 'POST', headers: h, body: JSON.stringify({ contenido, fuente: 'ia_chat' }),
    })
    if (res.ok) { const d = await res.json(); setNotas(prev => [d.nota, ...prev]) }
    setGuardandoId(null)
  }

  // ── Notas manuales ──
  async function agregarNota() {
    if (!nuevaNota.trim()) return
    setAddingNota(true)
    const h = await authHeaders()
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/nota`, {
      method: 'POST', headers: h, body: JSON.stringify({ contenido: nuevaNota.trim(), fuente: 'manual' }),
    })
    if (res.ok) { const d = await res.json(); setNotas(prev => [d.nota, ...prev]); setNuevaNota('') }
    setAddingNota(false)
  }

  async function borrarNota(notaId) {
    setNotas(prev => prev.filter(n => n.id !== notaId))
    const h = await authHeaders()
    await fetch(`${BASE}/api/cuaderno/${packageId}/nota/${notaId}`, { method: 'DELETE', headers: h })
  }

  // ── Generación de artefactos ──
  async function generar(tipo) {
    setGenerando(tipo)
    setTabMobile('notas')
    try {
      const h = await authHeaders()
      const res  = await fetch(`${BASE}/api/cuaderno/${packageId}/generar`, {
        method: 'POST', headers: h, body: JSON.stringify({ tipo }),
      })
      const data = await res.json()
      if (res.ok) {
        setNotas(prev => [data.nota, ...prev])
        setExpandidas(prev => ({ ...prev, [data.nota.id]: true }))
      }
    } catch { /* silencioso */ }
    finally { setGenerando(null) }
  }

  const agotado = usados >= limite

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="w-9 h-9 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm leading-tight truncate">Cuaderno IA</p>
          <p className="text-xs text-on-surface-variant truncate">{pkgNombre || '…'}</p>
        </div>
        <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
          ${usados >= limite * 0.8 ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-500'}`}>
          <span className="material-symbols-outlined text-xs">chat</span>
          {usados}/{limite}
        </div>
      </header>

      {/* ── Tabs móvil ── */}
      <div className="flex border-b border-slate-200 bg-white flex-shrink-0 lg:hidden">
        {[
          { key: 'chat',    icon: 'smart_toy',    label: 'Chat tutor' },
          { key: 'generar', icon: 'auto_awesome',  label: 'Generar'    },
          { key: 'notas',   icon: 'sticky_note_2', label: `Notas${notas.length ? ` (${notas.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTabMobile(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold border-b-2 transition-all
              ${tabMobile === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>
            <span className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: tabMobile === t.key ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cuerpo 3 columnas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ COLUMNA IZQUIERDA: Fuentes + Generar ══ */}
        <aside className={`flex flex-col w-full lg:w-64 border-r border-slate-200 bg-white overflow-y-auto flex-shrink-0
          ${tabMobile !== 'generar' ? 'hidden lg:flex' : ''}`}>

          {/* Fuentes */}
          <div className="p-4 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">folder_open</span>
              Fuentes del paquete
            </p>
            {fuentes.length === 0 ? (
              <p className="text-xs text-slate-400 italic">El admin aún no ha cargado archivos.</p>
            ) : (
              <div className="space-y-1.5">
                {fuentes.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-xs text-on-surface bg-slate-50 rounded-lg px-2.5 py-2">
                    <span className="material-symbols-outlined text-sm text-primary"
                          style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                    <span className="truncate font-medium">{f.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Acciones IA */}
          <div className="p-4 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Generar con IA
            </p>
            <div className="space-y-2">
              {ACCIONES.map(a => (
                <button
                  key={a.tipo}
                  onClick={() => generar(a.tipo)}
                  disabled={!!generando}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all
                    border-2 border-transparent hover:border-primary/20 hover:bg-primary/5
                    disabled:opacity-50 disabled:cursor-not-allowed group`}>
                  <div className={`w-9 h-9 bg-gradient-to-br ${a.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {generando === a.tipo ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-white text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{a.label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight">{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ══ COLUMNA CENTRO: Chat ══ */}
        <div className={`flex flex-col flex-1 overflow-hidden ${tabMobile !== 'chat' ? 'hidden lg:flex' : ''}`}>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mensajes.length === 0 && !enviando && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 text-slate-400 select-none">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                </div>
                <p className="font-bold text-slate-600">Pregúntale al tutor IA</p>
                <p className="text-xs mt-1 max-w-xs leading-relaxed">
                  Explícame un artículo, hazme un resumen de un tema, genera preguntas de práctica o pídeme que te evalúe.
                </p>
                <div className="mt-5 flex flex-wrap gap-2 justify-center max-w-sm">
                  {[
                    '¿Cuáles son los temas más frecuentes?',
                    'Explícame la etapa precontractual',
                    'Dame 5 preguntas de práctica',
                    '¿Qué es el mérito en el Estado?',
                  ].map(s => (
                    <button key={s} onClick={() => { setInput(s) }}
                      className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {mensajes.map(m => (
              <Bubble key={m.id} msg={m}
                onGuardar={guardarMsgComoNota}
                guardando={guardandoId === m.contenido} />
            ))}

            {enviando && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-sm text-on-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
                         style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Error chat */}
          {chatError && (
            <div className="mx-4 mb-2 px-3 py-2 bg-error/10 text-error text-xs font-semibold rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {chatError}
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
            {agotado ? (
              <div className="p-3 bg-error/10 text-error text-sm font-semibold rounded-xl text-center">
                Límite de {limite} mensajes/mes alcanzado. Se renueva el 1 del próximo mes.
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder="Pregunta al tutor IA… (Enter para enviar, Shift+Enter salto de línea)"
                  className="flex-1 resize-none bg-slate-100 rounded-2xl px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-36 overflow-y-auto"
                  style={{ lineHeight: '1.5' }}
                />
                <button onClick={enviar} disabled={!input.trim() || enviando}
                  className="w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center
                             hover:shadow-md transition-all disabled:opacity-40 flex-shrink-0">
                  <span className="material-symbols-outlined text-lg"
                        style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══ COLUMNA DERECHA: Notas ══ */}
        <aside className={`flex flex-col w-full lg:w-80 border-l border-slate-200 bg-white overflow-hidden
          ${tabMobile !== 'notas' ? 'hidden lg:flex' : ''}`}>

          <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-primary"
                  style={{ fontVariationSettings: "'FILL' 1" }}>sticky_note_2</span>
            <p className="font-bold text-sm flex-1">Mis notas</p>
            {notas.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                {notas.length}
              </span>
            )}
          </div>

          {/* Nueva nota manual */}
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <textarea
              rows={2}
              value={nuevaNota}
              onChange={e => setNuevaNota(e.target.value)}
              placeholder="Escribe una nota rápida…"
              className="w-full resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs
                         focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
            />
            <button onClick={agregarNota} disabled={!nuevaNota.trim() || addingNota}
              className="mt-1.5 w-full bg-primary/10 text-primary font-bold text-xs py-2 rounded-xl
                         hover:bg-primary/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-xs">add</span>
              {addingNota ? 'Guardando…' : 'Agregar nota'}
            </button>
          </div>

          {/* Lista notas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {generando && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <div>
                  <p className="text-xs font-bold text-primary">Generando {ACCIONES.find(a => a.tipo === generando)?.label}…</p>
                  <p className="text-[10px] text-slate-400">Aparecerá aquí en segundos</p>
                </div>
              </div>
            )}

            {notas.length === 0 && !generando && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl opacity-30 mb-2">sticky_note_2</span>
                <p className="text-xs font-semibold">Sin notas aún</p>
                <p className="text-[11px] mt-1 max-w-[200px]">
                  Usa "Generar con IA" o guarda respuestas del chat.
                </p>
              </div>
            )}

            {notas.map(nota => (
              <TarjetaNota
                key={nota.id}
                nota={nota}
                onBorrar={borrarNota}
                expandida={!!expandidas[nota.id]}
                onToggle={() => setExpandidas(prev => ({ ...prev, [nota.id]: !prev[nota.id] }))}
              />
            ))}
          </div>
        </aside>

      </div>
    </div>
  )
}
