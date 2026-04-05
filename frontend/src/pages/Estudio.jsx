import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { deepseek } from '../utils/deepseek'

const CATEGORIA_META = {
  default:      { color: 'text-primary',   bg: 'bg-primary-fixed',          icon: 'menu_book'       },
  matematicas:  { color: 'text-primary',   bg: 'bg-primary-fixed',          icon: 'functions'       },
  lenguaje:     { color: 'text-secondary', bg: 'bg-secondary-container/40', icon: 'translate'       },
  sociales:     { color: 'text-tertiary',  bg: 'bg-tertiary-container/20',  icon: 'public'          },
  ciencias:     { color: 'text-secondary', bg: 'bg-secondary-container/40', icon: 'science'         },
  derecho:      { color: 'text-primary',   bg: 'bg-primary-fixed',          icon: 'gavel'           },
  razonamiento: { color: 'text-tertiary',  bg: 'bg-tertiary-container/20',  icon: 'psychology'      },
  fiscal:       { color: 'text-primary',   bg: 'bg-primary-fixed',          icon: 'account_balance' },
  contraloria:  { color: 'text-primary',   bg: 'bg-primary-fixed',          icon: 'account_balance' },
}

function catMeta(nombre) {
  if (!nombre) return CATEGORIA_META.default
  const n = nombre.toLowerCase()
  for (const key of Object.keys(CATEGORIA_META)) {
    if (key !== 'default' && n.includes(key)) return CATEGORIA_META[key]
  }
  return CATEGORIA_META.default
}

function TarjetaProgreso({ cat, pct }) {
  const meta = catMeta(cat.name)
  return (
    <div className="card p-5 border border-transparent hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 ${meta.bg} ${meta.color} rounded-xl flex items-center justify-center`}>
          <span className="material-symbols-outlined">{meta.icon}</span>
        </div>
        <span className={`text-xs font-black px-2 py-1 rounded-lg ${meta.bg} ${meta.color}`}>{pct}%</span>
      </div>
      <h3 className="font-bold text-base mb-1 truncate">{cat.name}</h3>
      <p className="text-xs text-on-surface-variant mb-3 line-clamp-1">{cat.description || 'Área de estudio'}</p>
      <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ${
          meta.color === 'text-primary' ? 'bg-primary' : meta.color === 'text-secondary' ? 'bg-secondary' : 'bg-tertiary'
        }`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TarjetaEval({ ev, intentosUsuario, onClick }) {
  const meta        = catMeta(ev.categories?.name)
  const misIntentos = intentosUsuario.filter(a => a.levels?.evaluation_id === ev.id)
  const completado  = misIntentos.some(a => a.status === 'completed' || a.status === 'passed')
  const mejor       = misIntentos.length ? Math.max(...misIntentos.filter(a => a.score != null).map(a => a.score)) : null

  return (
    <div onClick={() => onClick(ev)} className="card p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all border border-transparent hover:border-primary/20">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 ${meta.bg} ${meta.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className="material-symbols-outlined text-xl">{meta.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-bold text-sm leading-snug">{ev.title}</p>
            {completado && (
              <span className="material-symbols-outlined text-secondary text-lg flex-shrink-0"
                style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant line-clamp-2 mb-3">{ev.description}</p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
            <span className={`px-2 py-0.5 rounded-full font-semibold ${meta.bg} ${meta.color}`}>
              {ev.categories?.name || 'General'}
            </span>
            {mejor !== null && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">star</span>Mejor: {mejor}%</span>}
            {misIntentos.length > 0 && <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">replay</span>{misIntentos.length} {misIntentos.length === 1 ? 'intento' : 'intentos'}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

const SUGERENCIAS = [
  '¿Cuáles son los temas más evaluados en el ICFES?',
  '¿Cómo mejoro mi comprensión lectora?',
  'Explícame qué es el Estado Social de Derecho',
  '¿Qué estrategias uso el día del examen?',
  '¿Cómo funciona el control fiscal en Colombia?',
  '¿Qué evalúa la Contraloría General?',
]

// ── Chat flotante estilo Facebook ─────────────────────────────────────────
function MentorIAFlotante({ contextoEval }) {
  const [abierto,   setAbierto]   = useState(false)
  const [mensajes,  setMensajes]  = useState([])
  const [input,     setInput]     = useState('')
  const [cargando,  setCargando]  = useState(false)
  const bottomRef = useRef()
  const inputRef  = useRef()

  useEffect(() => {
    if (abierto) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes, cargando, abierto])

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 300)
  }, [abierto])

  async function enviar(texto) {
    const msg = (texto || input).trim()
    if (!msg || cargando) return
    setInput('')
    const historial = [...mensajes, { rol: 'user', texto: msg }]
    setMensajes(historial)
    setCargando(true)
    try {
      const historialAPI = historial.map(m => ({
        role: m.rol === 'user' ? 'user' : 'assistant',
        content: m.texto,
      }))
      const contexto = contextoEval
        ? `El usuario estudia: "${contextoEval}". Adapta tus respuestas cuando sea relevante.`
        : 'Eres un tutor académico especializado en exámenes colombianos: ICFES, Saber Pro, CNSC, Contraloría, Procuraduría.'
      const respuesta = await deepseek.chat(historialAPI, contexto)
      setMensajes(prev => [...prev, { rol: 'bot', texto: respuesta }])
    } catch {
      setMensajes(prev => [...prev, { rol: 'bot', texto: '⚠️ Error al conectar. Intenta de nuevo.' }])
    } finally {
      setCargando(false)
      inputRef.current?.focus()
    }
  }

  const noLeidos = !abierto && mensajes.length > 0

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

      {/* Ventana del chat */}
      {abierto && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden flex flex-col animate-fade-in"
          style={{ height: '460px' }}>

          {/* Header */}
          <div className="px-4 py-3 bg-primary text-white flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm leading-none">Mentor IA</p>
              <span className="text-[10px] opacity-80 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                En línea
              </span>
            </div>
            <div className="flex gap-1">
              {mensajes.length > 0 && (
                <button onClick={() => setMensajes([])}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors" title="Limpiar chat">
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                </button>
              )}
              <button onClick={() => setAbierto(false)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {mensajes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-4">
                <span className="material-symbols-outlined text-4xl text-slate-300">auto_awesome</span>
                <div>
                  <p className="font-bold text-sm text-slate-700">¿En qué te ayudo?</p>
                  <p className="text-xs text-slate-400 mt-0.5">Pregúntame sobre tu examen</p>
                </div>
                <div className="flex flex-col gap-1.5 w-full mt-1">
                  {SUGERENCIAS.slice(0, 3).map(s => (
                    <button key={s} onClick={() => enviar(s)}
                      className="text-xs px-3 py-2 bg-white rounded-xl text-slate-600 hover:bg-primary/5 hover:text-primary font-medium transition-all text-left border border-slate-100 shadow-sm">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {mensajes.map((m, i) => (
                  <div key={i} className={`flex gap-2 ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {m.rol === 'bot' && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0 mt-1">
                        <span className="material-symbols-outlined text-xs">smart_toy</span>
                      </div>
                    )}
                    <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      m.rol === 'user'
                        ? 'bg-primary text-white rounded-tr-sm'
                        : 'bg-white text-slate-800 rounded-tl-sm shadow-sm border border-slate-100'
                    }`}>{m.texto}</div>
                  </div>
                ))}
                {cargando && (
                  <div className="flex gap-2">
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white flex-shrink-0">
                      <span className="material-symbols-outlined text-xs">smart_toy</span>
                    </div>
                    <div className="bg-white px-3 py-2 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center gap-1">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"
                          style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Sugerencias rápidas si hay conversación */}
          {mensajes.length > 0 && (
            <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto flex-shrink-0 bg-white border-t border-slate-100">
              {SUGERENCIAS.slice(3).map(s => (
                <button key={s} onClick={() => enviar(s)}
                  className="text-[10px] px-2.5 py-1 bg-slate-100 rounded-full text-slate-500 hover:bg-primary/10 hover:text-primary font-medium whitespace-nowrap flex-shrink-0 transition-all">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 bg-white border-t border-slate-100 flex-shrink-0">
            <div className="flex items-end gap-2 bg-slate-100 rounded-2xl px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Escribe tu pregunta…"
                rows={1}
                style={{ maxHeight: '80px', resize: 'none' }}
                className="bg-transparent border-none focus:ring-0 text-xs flex-1 outline-none leading-relaxed text-slate-700 placeholder-slate-400"
              />
              <button
                onClick={() => enviar()}
                disabled={!input.trim() || cargando}
                className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
              >
                <span className="material-symbols-outlined text-sm">send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all relative"
      >
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
          {abierto ? 'close' : 'smart_toy'}
        </span>
        {noLeidos && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  )
}

export default function Estudio() {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const [categorias,   setCategorias] = useState([])
  const [evaluaciones, setEvals]      = useState([])
  const [intentos,     setIntentos]   = useState([])
  const [busqueda,     setBusqueda]   = useState('')
  const [catFiltro,    setCatFiltro]  = useState('todas')
  const [loading,      setLoading]    = useState(true)
  const [contextoIA,   setContextoIA] = useState('')

  useEffect(() => { cargar() }, [user])

  async function cargar() {
    setLoading(true)
    try {
      const [{ data: cats }, { data: evals }, { data: ints }] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('evaluations').select('id, title, description, category_id, is_active, categories(name)').eq('is_active', true).order('title'),
        user
          ? supabase.from('attempts').select('id, level_id, status, score, levels(id, evaluation_id)').eq('user_id', user.id).order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
      ])
      setCategorias(cats || [])
      setEvals(evals || [])
      setIntentos(ints || [])
    } finally {
      setLoading(false)
    }
  }

  function pctCategoria(catId) {
    const evsCat = evaluaciones.filter(e => e.category_id === catId)
    if (!evsCat.length) return 0
    const intentadas = evsCat.filter(ev => intentos.some(a => a.levels?.evaluation_id === ev.id)).length
    return Math.round((intentadas / evsCat.length) * 100)
  }

  const evalsFiltradas = evaluaciones.filter(ev => {
    const matchCat  = catFiltro === 'todas' || ev.category_id === catFiltro
    const matchText = !busqueda || ev.title.toLowerCase().includes(busqueda.toLowerCase()) || ev.description?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchText
  })

  const completados   = intentos.filter(a => a.status === 'completed' || a.status === 'passed').length
  const scorePromedio = intentos.filter(a => a.score != null).length
    ? Math.round(intentos.filter(a => a.score != null).reduce((s, a) => s + a.score, 0) / intentos.filter(a => a.score != null).length)
    : 0

  const avatarSrc      = user?.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.user_metadata?.full_name || user?.email || 'U')}&background=003d9b&color=fff&size=128`
  const nombreMostrado = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Estudiante'

  return (
    <div className="p-6 pb-24 animate-fade-in">

      {/* Header de página */}
      <div className="flex items-center gap-4 mb-8">
        <img src={avatarSrc} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-surface-container-low flex-shrink-0" />
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold font-headline leading-none">Material de Estudio</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Hola, {nombreMostrado} · {completados > 0 ? `${completados} simulacros completados` : 'Empieza a practicar'}
          </p>
        </div>
        {scorePromedio > 0 && (
          <div className="hidden sm:block text-right">
            <p className="text-2xl font-extrabold font-headline text-primary">{scorePromedio}%</p>
            <p className="text-xs text-on-surface-variant">Promedio general</p>
          </div>
        )}
      </div>

      <div className="space-y-10">

        {/* Stats de actividad */}
        {intentos.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { val: intentos.length,    label: 'Intentos',    icon: 'replay',       color: 'text-primary'   },
              { val: completados,         label: 'Completados', icon: 'check_circle', color: 'text-secondary' },
              { val: `${scorePromedio}%`, label: 'Promedio',    icon: 'bar_chart',    color: 'text-tertiary'  },
            ].map(s => (
              <div key={s.label} className="card text-center p-4">
                <span className={`material-symbols-outlined text-2xl ${s.color} block mb-1`}
                  style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                <p className={`text-xl font-extrabold font-headline ${s.color}`}>{s.val}</p>
                <p className="text-xs text-on-surface-variant font-semibold">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Plan de estudio */}
        {!loading && categorias.length > 0 && (
          <section>
            <h2 className="text-xl font-bold font-headline mb-5">Mi Plan de Estudio</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categorias.slice(0, 3).map(cat => (
                <TarjetaProgreso key={cat.id} cat={cat} pct={pctCategoria(cat.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Evaluaciones */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 className="text-xl font-bold font-headline">Evaluaciones disponibles</h2>
            <button onClick={() => navigate('/catalogo')}
              className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
              Catálogo completo <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-5">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
              <input type="text" placeholder="Buscar evaluación…" value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs bg-surface-container-high rounded-full border border-outline-variant/30 focus:outline-none focus:border-primary w-48" />
            </div>
            <button onClick={() => setCatFiltro('todas')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${catFiltro === 'todas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}>
              Todas
            </button>
            {categorias.map(c => (
              <button key={c.id} onClick={() => setCatFiltro(c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${catFiltro === c.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}>
                {c.name}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="card p-5 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-surface-container-high rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-surface-container-high rounded w-2/3" />
                      <div className="h-3 bg-surface-container-high rounded w-full" />
                      <div className="h-3 bg-surface-container-high rounded w-1/3" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : evalsFiltradas.length === 0 ? (
            <div className="card p-10 text-center text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">search_off</span>
              <p className="font-semibold">{busqueda ? `Sin resultados para "${busqueda}"` : 'Sin evaluaciones en esta categoría'}</p>
              {busqueda && <button onClick={() => setBusqueda('')} className="mt-3 text-xs text-primary underline">Limpiar búsqueda</button>}
            </div>
          ) : (
            <div className="space-y-3">
              {evalsFiltradas.map(ev => (
                <TarjetaEval key={ev.id} ev={ev} intentosUsuario={intentos}
                  onClick={e => { setContextoIA(e.title); navigate(`/prueba/${e.id}`) }} />
              ))}
            </div>
          )}
        </section>

        {/* Recursos */}
        <section>
          <h2 className="text-xl font-bold font-headline mb-5">Recursos de apoyo</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: 'picture_as_pdf', color: 'text-red-500',  bg: 'bg-red-50',        label: 'Guías PDF',           desc: 'Próximamente' },
              { icon: 'style',          color: 'text-amber-500', bg: 'bg-amber-50',      label: 'Flashcards',          desc: 'Próximamente' },
              { icon: 'play_circle',    color: 'text-primary',   bg: 'bg-primary-fixed', label: 'Videos explicativos', desc: 'Próximamente' },
            ].map(r => (
              <div key={r.label} className="card p-5 flex items-center gap-4 opacity-50 cursor-not-allowed select-none">
                <div className={`w-12 h-12 ${r.bg} ${r.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className="material-symbols-outlined text-xl">{r.icon}</span>
                </div>
                <div>
                  <p className="font-bold text-sm">{r.label}</p>
                  <p className="text-xs text-on-surface-variant">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {/* Chat flotante */}
      <MentorIAFlotante contextoEval={contextoIA} />
    </div>
  )
}