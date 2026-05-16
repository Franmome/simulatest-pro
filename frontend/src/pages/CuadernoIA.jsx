import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function authHeaders(token) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

async function getToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

function BubbleChat({ msg }) {
  const esIA = msg.rol === 'assistant'
  return (
    <div className={`flex gap-3 ${esIA ? '' : 'flex-row-reverse'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
        ${esIA ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface'}`}>
        {esIA
          ? <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          : <span className="material-symbols-outlined text-sm">person</span>
        }
      </div>
      <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
        ${esIA
          ? 'bg-white border border-slate-200 text-on-surface rounded-tl-sm'
          : 'bg-primary text-on-primary rounded-tr-sm'
        }`}>
        {msg.contenido}
      </div>
    </div>
  )
}

function FuenteBadge({ fuente }) {
  const map = {
    manual:   { label: 'Manual',    icon: 'edit',         color: 'bg-slate-100 text-slate-600' },
    ia_chat:  { label: 'Tutor IA',  icon: 'smart_toy',    color: 'bg-primary/10 text-primary'  },
    simulacro:{ label: 'Simulacro', icon: 'quiz',         color: 'bg-secondary/10 text-secondary' },
  }
  const m = map[fuente] || map.manual
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${m.color}`}>
      <span className="material-symbols-outlined text-[10px]">{m.icon}</span>
      {m.label}
    </span>
  )
}

export default function CuadernoIA() {
  const { packageId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab,       setTab]       = useState('chat')  // 'chat' | 'notas'
  const [mensajes,  setMensajes]  = useState([])
  const [notas,     setNotas]     = useState([])
  const [input,     setInput]     = useState('')
  const [enviando,  setEnviando]  = useState(false)
  const [usados,    setUsados]    = useState(0)
  const [limite,    setLimite]    = useState(40)
  const [pkgNombre, setPkgNombre] = useState('')
  const [error,     setError]     = useState('')
  const [guardando, setGuardando] = useState(null) // id del mensaje guardando
  const [nuevaNota, setNuevaNota] = useState('')
  const [addingNota,setAddingNota]= useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    cargarTodo()
  }, [packageId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function cargarTodo() {
    const token = await getToken()
    const h = authHeaders(token)

    const [histRes, notasRes, pkgRes] = await Promise.all([
      fetch(`${BASE}/api/cuaderno/${packageId}/historial`, { headers: h }),
      fetch(`${BASE}/api/cuaderno/${packageId}/notas`,    { headers: h }),
      supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    ])

    if (histRes.ok)  { const d = await histRes.json();  setMensajes(d.mensajes || []) }
    if (notasRes.ok) { const d = await notasRes.json(); setNotas(d.notas || []) }
    if (pkgRes.data) setPkgNombre(pkgRes.data.name)

    // Contar mensajes del mes
    const inicio = new Date(); inicio.setDate(1); inicio.setHours(0,0,0,0)
    const { count } = await supabase
      .from('user_cuaderno_mensajes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id).eq('package_id', parseInt(packageId)).eq('rol', 'user')
      .gte('created_at', inicio.toISOString())
    setUsados(count || 0)
  }

  async function enviar() {
    if (!input.trim() || enviando) return
    const texto = input.trim()
    setInput('')
    setError('')
    setEnviando(true)

    // Optimista: agrega mensaje del usuario de inmediato
    const temp = { id: Date.now(), rol: 'user', contenido: texto, created_at: new Date().toISOString() }
    setMensajes(prev => [...prev, temp])

    try {
      const token = await getToken()
      const res   = await fetch(`${BASE}/api/cuaderno/${packageId}/chat`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ mensaje: texto }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Error al enviar.'); return }

      const iaMsg = { id: Date.now() + 1, rol: 'assistant', contenido: data.respuesta, created_at: new Date().toISOString() }
      setMensajes(prev => [...prev, iaMsg])
      setUsados(data.usados)
      setLimite(data.limite)
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  async function guardarMensajeComoNota(contenido) {
    setGuardando(contenido)
    const token = await getToken()
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/nota`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ contenido, fuente: 'ia_chat' }),
    })
    if (res.ok) {
      const data = await res.json()
      setNotas(prev => [data.nota, ...prev])
    }
    setGuardando(null)
  }

  async function agregarNotaManual() {
    if (!nuevaNota.trim()) return
    setAddingNota(true)
    const token = await getToken()
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/nota`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ contenido: nuevaNota.trim(), fuente: 'manual' }),
    })
    if (res.ok) {
      const data = await res.json()
      setNotas(prev => [data.nota, ...prev])
      setNuevaNota('')
    }
    setAddingNota(false)
  }

  async function borrarNota(notaId) {
    setNotas(prev => prev.filter(n => n.id !== notaId))
    const token = await getToken()
    await fetch(`${BASE}/api/cuaderno/${packageId}/nota/${notaId}`, {
      method: 'DELETE', headers: authHeaders(token),
    })
  }

  const agotado = usados >= limite

  return (
    <div className="flex flex-col h-screen bg-surface">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-extrabold text-sm leading-tight truncate">Cuaderno IA</p>
          <p className="text-xs text-on-surface-variant truncate">{pkgNombre}</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-on-surface-variant">
          <span className="material-symbols-outlined text-sm">chat_bubble</span>
          <span className={usados >= limite * 0.8 ? 'text-error font-bold' : ''}>{usados}/{limite}</span>
        </div>
      </div>

      {/* Tabs móvil */}
      <div className="flex border-b border-slate-200 bg-white flex-shrink-0 lg:hidden">
        {[
          { key: 'chat',  icon: 'smart_toy',  label: 'Chat tutor' },
          { key: 'notas', icon: 'sticky_note_2', label: `Mis notas${notas.length ? ` (${notas.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-colors
              ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}>
            <span className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: tab === t.key ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Panel Chat ── */}
        <div className={`flex flex-col flex-1 overflow-hidden ${tab === 'notas' ? 'hidden lg:flex' : ''}`}>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {mensajes.length === 0 && !enviando && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 text-on-surface-variant">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-3xl text-primary"
                        style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
                </div>
                <p className="font-bold">Pregúntame sobre el material</p>
                <p className="text-xs mt-1 max-w-xs">Explícame un tema, pídeme un resumen, un mapa conceptual o preguntas de práctica.</p>
              </div>
            )}

            {mensajes.map(m => (
              <div key={m.id}>
                <BubbleChat msg={m} />
                {m.rol === 'assistant' && (
                  <div className="ml-11 mt-1">
                    <button
                      onClick={() => guardarMensajeComoNota(m.contenido)}
                      disabled={guardando === m.contenido}
                      className="text-[11px] text-on-surface-variant hover:text-primary font-semibold flex items-center gap-1 transition-colors disabled:opacity-50">
                      <span className="material-symbols-outlined text-xs">bookmark_add</span>
                      {guardando === m.contenido ? 'Guardando…' : 'Guardar en notas'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            {enviando && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
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

          {/* Error */}
          {error && (
            <div className="mx-4 mb-2 p-3 bg-error/10 text-error text-xs font-semibold rounded-xl flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
            {agotado ? (
              <div className="p-3 bg-error/10 text-error text-sm font-semibold rounded-xl text-center">
                Límite mensual de {limite} mensajes alcanzado. Se renueva el 1 del próximo mes.
              </div>
            ) : (
              <div className="flex gap-2 items-end">
                <textarea
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                  placeholder="Escribe tu pregunta… (Enter para enviar)"
                  className="flex-1 resize-none bg-surface-container-high rounded-2xl px-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary/40 max-h-32 overflow-y-auto"
                  style={{ lineHeight: '1.5' }}
                />
                <button onClick={enviar} disabled={!input.trim() || enviando}
                  className="w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center
                             hover:shadow-md transition-all disabled:opacity-40 flex-shrink-0">
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Panel Notas ── */}
        <div className={`flex flex-col w-full lg:w-96 lg:border-l border-slate-200 overflow-hidden bg-white
          ${tab === 'chat' ? 'hidden lg:flex' : ''}`}>

          <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0">
            <p className="font-bold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-primary"
                    style={{ fontVariationSettings: "'FILL' 1" }}>sticky_note_2</span>
              Mis notas personales
              {notas.length > 0 && (
                <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{notas.length}</span>
              )}
            </p>
          </div>

          {/* Nueva nota manual */}
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <textarea
              rows={2}
              value={nuevaNota}
              onChange={e => setNuevaNota(e.target.value)}
              placeholder="Agrega una nota rápida…"
              className="w-full resize-none bg-surface-container-high rounded-xl px-3 py-2 text-xs
                         focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={agregarNotaManual} disabled={!nuevaNota.trim() || addingNota}
              className="mt-1.5 w-full bg-primary/10 text-primary font-bold text-xs py-2 rounded-xl
                         hover:bg-primary/20 transition-colors disabled:opacity-40">
              {addingNota ? 'Guardando…' : '+ Agregar nota'}
            </button>
          </div>

          {/* Lista de notas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl opacity-30 mb-2">sticky_note_2</span>
                <p className="text-xs font-semibold">Sin notas aún</p>
                <p className="text-[11px] mt-1">Guarda respuestas del tutor o escribe las tuyas aquí.</p>
              </div>
            )}
            {notas.map(nota => (
              <div key={nota.id}
                className="bg-surface-container-high rounded-xl p-3 relative group">
                <div className="flex items-center justify-between mb-1.5">
                  <FuenteBadge fuente={nota.fuente} />
                  <button onClick={() => borrarNota(nota.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center
                               rounded-lg hover:bg-error/10 text-error">
                    <span className="material-symbols-outlined text-sm">delete</span>
                  </button>
                </div>
                <p className="text-xs leading-relaxed whitespace-pre-wrap line-clamp-6">{nota.contenido}</p>
                <p className="text-[10px] text-on-surface-variant mt-2">
                  {new Date(nota.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
