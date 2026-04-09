import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'
import { useFetch } from '../hooks/useFetch'
import { deepseek } from '../utils/deepseek'

// ── Helpers de categoría ──────────────────────────────────────────────────────
function catMeta(nombre) {
  const map = {
    'CNSC':          { icon: 'gavel',           color: 'text-primary',   bg: 'bg-primary/10'   },
    'ICFES':         { icon: 'school',          color: 'text-tertiary',  bg: 'bg-tertiary/10'  },
    'Saber Pro':     { icon: 'history_edu',     color: 'text-secondary', bg: 'bg-secondary/10' },
    'Procuraduría':  { icon: 'balance',         color: 'text-primary',   bg: 'bg-primary/10'   },
    'Contraloría':   { icon: 'account_balance', color: 'text-primary',   bg: 'bg-primary/10'   },
    'Defensoría':    { icon: 'shield',          color: 'text-slate-500', bg: 'bg-slate-100'    },
  }
  return map[nombre] || { icon: 'quiz', color: 'text-primary', bg: 'bg-primary/10' }
}

// ── Tarjeta de progreso por categoría ────────────────────────────────────────
function TarjetaProgreso({ cat, pct }) {
  const meta = catMeta(cat.name)
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 ${meta.bg} ${meta.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <span className="material-symbols-outlined text-lg">{meta.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{cat.name}</p>
          <p className="text-xs text-on-surface-variant">{pct}% completado</p>
        </div>
      </div>
      <div className="w-full h-1.5 bg-surface-container-high rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${
          meta.color === 'text-primary' ? 'bg-primary'
          : meta.color === 'text-secondary' ? 'bg-secondary'
          : 'bg-tertiary'
        }`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Tarjeta de evaluación ─────────────────────────────────────────────────────
function TarjetaEval({ ev, intentosUsuario, onClick }) {
  const meta        = catMeta(ev.categories?.name)
  const misIntentos = intentosUsuario.filter(a => a.levels?.evaluation_id === ev.id)
  const completado  = misIntentos.some(a => a.status === 'completed' || a.status === 'passed')
  const mejor       = misIntentos.length
    ? Math.max(...misIntentos.filter(a => a.score != null).map(a => a.score))
    : null

  return (
    <div onClick={() => onClick(ev)}
         className="card p-5 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all
                    border border-transparent hover:border-primary/20">
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
            {mejor !== null && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">star</span>
                Mejor: {mejor}%
              </span>
            )}
            {misIntentos.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">replay</span>
                {misIntentos.length} {misIntentos.length === 1 ? 'intento' : 'intentos'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chat IA flotante ──────────────────────────────────────────────────────────
const SUGERENCIAS = [
  '¿Cuáles son los temas más evaluados en el ICFES?',
  '¿Cómo mejoro mi comprensión lectora?',
  'Explícame qué es el Estado Social de Derecho',
  '¿Qué estrategias uso el día del examen?',
  '¿Cómo funciona el control fiscal en Colombia?',
]

function MentorIAFlotante({ contextoEval }) {
  const [abierto,   setAbierto]   = useState(false)
  const [mensajes,  setMensajes]  = useState([])
  const [input,     setInput]     = useState('')
  const [cargando,  setCargando]  = useState(false)
  const [noLeidos,  setNoLeidos]  = useState(false)

  async function enviar(texto) {
    const msg = texto || input.trim()
    if (!msg || cargando) return
    setInput('')
    const nuevos = [...mensajes, { role: 'user', content: msg }]
    setMensajes(nuevos)
    setCargando(true)
    try {
      const extra = contextoEval ? `El usuario está viendo la evaluación: "${contextoEval}"` : ''
      const resp  = await deepseek.chat(nuevos, extra)
      setMensajes(m => [...m, { role: 'assistant', content: resp }])
      if (!abierto) setNoLeidos(true)
    } catch {
      setMensajes(m => [...m, { role: 'assistant', content: 'Hubo un error al contactar al mentor. Intenta de nuevo.' }])
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-3">
      {abierto && (
        <div className="w-80 sm:w-96 bg-surface-container-lowest rounded-3xl shadow-2xl
                        border border-outline-variant/20 flex flex-col overflow-hidden"
             style={{ maxHeight: '70vh' }}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/20 bg-primary text-on-primary">
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            <div>
              <p className="font-bold text-sm">Mentor IA</p>
              <p className="text-[10px] opacity-80">Preparación CNSC · ICFES · Saber Pro</p>
            </div>
            <button onClick={() => setAbierto(false)} className="ml-auto opacity-70 hover:opacity-100">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {mensajes.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-on-surface-variant font-medium text-center mb-4">
                  ¡Hola! Soy tu mentor de preparación. ¿En qué te ayudo hoy?
                </p>
                {SUGERENCIAS.map(s => (
                  <button key={s} onClick={() => enviar(s)}
                          className="w-full text-left text-xs px-3 py-2 rounded-xl bg-surface-container
                                     hover:bg-primary/10 hover:text-primary transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {mensajes.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                  ${m.role === 'user'
                    ? 'bg-primary text-on-primary rounded-br-sm'
                    : 'bg-surface-container text-on-surface rounded-bl-sm'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {cargando && (
              <div className="flex justify-start">
                <div className="bg-surface-container px-4 py-3 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 bg-primary/40 rounded-full animate-bounce"
                           style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-outline-variant/20 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Escribe tu pregunta..."
              className="flex-1 bg-surface-container rounded-full px-4 py-2 text-sm outline-none
                         focus:ring-2 focus:ring-primary/20 border-none"
            />
            <button onClick={() => enviar()}
                    disabled={!input.trim() || cargando}
                    className="w-9 h-9 bg-primary text-on-primary rounded-full flex items-center justify-center
                               disabled:opacity-40 hover:bg-primary/90 transition-all active:scale-95 flex-shrink-0">
              <span className="material-symbols-outlined text-sm">send</span>
            </button>
          </div>
        </div>
      )}

      <button onClick={() => { setAbierto(a => !a); setNoLeidos(false) }}
              className="w-14 h-14 bg-primary text-on-primary rounded-full shadow-xl flex items-center justify-center
                         hover:scale-110 active:scale-95 transition-all relative">
        <span className="material-symbols-outlined text-2xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>
          {abierto ? 'close' : 'smart_toy'}
        </span>
        {noLeidos && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white" />
        )}
      </button>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Estudio() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [busqueda,    setBusqueda]   = useState('')
  const [catFiltro,   setCatFiltro]  = useState('todas')
  const [contextoIA,  setContextoIA] = useState('')

  // ── Carga principal con useFetch ──────────────────────────────────────────
  const { data, loading, error, retry } = useFetch(async () => {
    const [{ data: cats }, { data: evals }, intentosRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('evaluations')
        .select('id, title, description, category_id, is_active, categories(name)')
        .eq('is_active', true)
        .order('title'),
      user?.id
        ? supabase.from('attempts')
            .select('id, level_id, status, score, levels(id, evaluation_id)')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])

    return {
      categorias:   cats              || [],
      evaluaciones: evals             || [],
      intentos:     intentosRes.data  || [],
    }
  }, [user?.id])

  const categorias   = data?.categorias   ?? []
  const evaluaciones = data?.evaluaciones ?? []
  const intentos     = data?.intentos     ?? []

  function pctCategoria(catId) {
    const evsCat    = evaluaciones.filter(e => e.category_id === catId)
    if (!evsCat.length) return 0
    const intentadas = evsCat.filter(ev => intentos.some(a => a.levels?.evaluation_id === ev.id)).length
    return Math.round((intentadas / evsCat.length) * 100)
  }

  const evalsFiltradas = evaluaciones.filter(ev => {
    const matchCat  = catFiltro === 'todas' || ev.category_id === catFiltro
    const matchText = !busqueda
      || ev.title.toLowerCase().includes(busqueda.toLowerCase())
      || ev.description?.toLowerCase().includes(busqueda.toLowerCase())
    return matchCat && matchText
  })

  const completados   = intentos.filter(a => a.status === 'completed' || a.status === 'passed').length
  const scorePromedio = intentos.filter(a => a.score != null).length
    ? Math.round(intentos.filter(a => a.score != null).reduce((s, a) => s + a.score, 0) / intentos.filter(a => a.score != null).length)
    : 0

  const statsBanner = [
    { icon: 'quiz',        color: 'text-primary',   val: evaluaciones.length, label: 'Evaluaciones' },
    { icon: 'check_circle',color: 'text-secondary', val: completados,         label: 'Completados'  },
    { icon: 'trending_up', color: 'text-tertiary',  val: scorePromedio ? `${scorePromedio}%` : '—', label: 'Promedio' },
  ]

  return (
    <div className="p-6 pb-28 max-w-4xl mx-auto space-y-8 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-headline text-on-background">Centro de Estudio</h1>
        <p className="text-on-surface-variant mt-1">Tu espacio personalizado de preparación</p>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-error-container text-error rounded-xl flex items-center gap-3">
          <span className="material-symbols-outlined">error</span>
          <p className="text-sm font-semibold flex-1">{error}</p>
          <button onClick={retry} className="text-xs font-bold underline">Reintentar</button>
        </div>
      )}

      {/* Stats banner */}
      {!loading && (
        <div className="grid grid-cols-3 gap-4">
          {statsBanner.map(s => (
            <div key={s.label} className="card p-4 text-center">
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
            Catálogo completo
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input type="text" placeholder="Buscar evaluación…" value={busqueda}
                   onChange={e => setBusqueda(e.target.value)}
                   className="pl-9 pr-4 py-2 text-xs bg-surface-container-high rounded-full
                              border border-outline-variant/30 focus:outline-none focus:border-primary w-48" />
          </div>
          <button onClick={() => setCatFiltro('todas')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                    ${catFiltro === 'todas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}>
            Todas
          </button>
          {categorias.map(c => (
            <button key={c.id} onClick={() => setCatFiltro(c.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all
                      ${catFiltro === c.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'}`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="card p-5 animate-pulse flex gap-4">
                <div className="w-12 h-12 bg-surface-container-high rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-container-high rounded w-3/4" />
                  <div className="h-3 bg-surface-container-high rounded w-full" />
                  <div className="h-3 bg-surface-container-high rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sin resultados */}
        {!loading && evalsFiltradas.length === 0 && !error && (
          <div className="card p-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl opacity-30 block mb-2">search_off</span>
            <p className="font-semibold">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin evaluaciones en esta categoría'}
            </p>
            {busqueda && (
              <button onClick={() => setBusqueda('')} className="mt-3 text-xs text-primary underline">
                Limpiar búsqueda
              </button>
            )}
          </div>
        )}

        {/* Lista */}
        {!loading && (
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

      <MentorIAFlotante contextoEval={contextoIA} />
    </div>
  )
}