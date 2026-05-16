import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000'

async function hdrs(contentType = 'application/json') {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || ''
  return { Authorization: `Bearer ${token}`, ...(contentType ? { 'Content-Type': contentType } : {}) }
}

const FUENTE_META = {
  manual:      { label: 'Manual',      icon: 'edit',           cls: 'bg-slate-100 text-slate-600' },
  ia_chat:     { label: 'Chat',        icon: 'chat',           cls: 'bg-primary/10 text-primary' },
  resumen:     { label: 'Resumen',     icon: 'summarize',      cls: 'bg-blue-100 text-blue-700' },
  quiz:        { label: 'Quiz',        icon: 'quiz',           cls: 'bg-violet-100 text-violet-700' },
  flashcards:  { label: 'Flashcards',  icon: 'style',          cls: 'bg-amber-100 text-amber-700' },
  plan:        { label: 'Plan',        icon: 'calendar_month', cls: 'bg-emerald-100 text-emerald-700' },
  faq:         { label: 'FAQ',         icon: 'help',           cls: 'bg-cyan-100 text-cyan-700' },
  cronologia:  { label: 'Cronología',  icon: 'timeline',       cls: 'bg-rose-100 text-rose-700' },
}

const ACCIONES = [
  { tipo: 'resumen',    icon: 'summarize',      label: 'Resumen',          desc: 'Ejes temáticos + glosario + ejecutivo',   grad: 'from-blue-600 to-blue-700' },
  { tipo: 'quiz',       icon: 'quiz',           label: 'Quiz CNSC',        desc: '10 preguntas interactivas tipo situación', grad: 'from-violet-600 to-violet-700' },
  { tipo: 'flashcards', icon: 'style',          label: 'Flashcards',       desc: '12 tarjetas con volteo 3D',               grad: 'from-amber-500 to-orange-600' },
  { tipo: 'plan',       icon: 'calendar_month', label: 'Plan de estudio',  desc: 'Cronograma 4 semanas con checkboxes',     grad: 'from-emerald-600 to-teal-700' },
  { tipo: 'faq',        icon: 'help',           label: 'FAQ',              desc: '12 preguntas frecuentes del concurso',    grad: 'from-cyan-500 to-sky-600' },
  { tipo: 'cronologia', icon: 'timeline',       label: 'Cronología',       desc: 'Hitos y etapas del proceso de selección', grad: 'from-rose-500 to-pink-600' },
]

// ── Parseo de citas 【...】 en texto ──────────────────────────────────────────
function renderConCitas(texto, fuentes, onCitaClick) {
  const partes = texto.split(/(【[^】]+】)/g)
  return partes.map((p, i) => {
    const m = p.match(/^【(.+)】$/)
    if (!m) return <span key={i}>{p}</span>
    const nombre = m[1]
    const src = fuentes.find(f => f.nombre?.toLowerCase().includes(nombre.toLowerCase()) || nombre.toLowerCase().includes(f.nombre?.toLowerCase()))
    return (
      <button key={i} onClick={() => onCitaClick(src || { nombre, texto: '' })}
        className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[11px] font-bold px-1.5 py-0.5 rounded-md mx-0.5 hover:bg-amber-200 transition-colors align-middle">
        <span className="material-symbols-outlined text-[11px]">description</span>
        {nombre}
      </button>
    )
  })
}

// ── Burbuja de chat ───────────────────────────────────────────────────────────
function Bubble({ msg, fuentes, onGuardar, guardando, onCitaClick }) {
  const esIA = msg.rol === 'assistant'
  return (
    <div className={`flex gap-2.5 ${esIA ? '' : 'flex-row-reverse'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${esIA ? 'bg-primary text-on-primary' : 'bg-slate-200 text-slate-600'}`}>
        <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
          {esIA ? 'smart_toy' : 'person'}
        </span>
      </div>
      <div className={`flex flex-col gap-1 ${esIA ? 'max-w-[85%]' : 'max-w-[75%] items-end'}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
          ${esIA ? 'bg-white border border-slate-200 rounded-tl-sm' : 'bg-primary text-on-primary rounded-tr-sm'}`}>
          {esIA ? renderConCitas(msg.contenido, fuentes, onCitaClick) : msg.contenido}
        </div>
        {esIA && (
          <button onClick={() => onGuardar(msg.contenido)} disabled={guardando}
            className="self-start text-[11px] text-slate-400 hover:text-primary flex items-center gap-1 transition-colors disabled:opacity-40 ml-1">
            <span className="material-symbols-outlined text-xs">bookmark_add</span>
            {guardando ? 'Guardando…' : 'Guardar en notas'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Vista Resumen ─────────────────────────────────────────────────────────────
function ResumenView({ datos }) {
  if (!datos || typeof datos === 'string') return (
    <div className="prose prose-sm max-w-none p-4 text-sm leading-relaxed whitespace-pre-wrap">{datos}</div>
  )
  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full">
      {datos.ejecutivo && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">summarize</span>Resumen ejecutivo
          </p>
          <p className="text-sm leading-relaxed">{datos.ejecutivo}</p>
        </div>
      )}
      {datos.ejes?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">account_tree</span>Ejes temáticos
          </p>
          <div className="space-y-3">
            {datos.ejes.map((eje, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
                <p className="font-bold text-sm mb-2">{eje.titulo}</p>
                <ul className="space-y-1">{eje.puntos?.map((p, j) => (
                  <li key={j} className="text-xs text-on-surface-variant flex gap-2">
                    <span className="text-primary mt-0.5 flex-shrink-0">•</span>{p}
                  </li>
                ))}</ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {datos.glosario?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">menu_book</span>Glosario clave
          </p>
          <div className="space-y-2">
            {datos.glosario.map((g, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="font-bold text-primary min-w-[140px] flex-shrink-0">{g.termino}</span>
                <span className="text-on-surface-variant">{g.definicion}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {datos.criticos?.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-error">priority_high</span>Puntos críticos para el examen
          </p>
          <div className="space-y-2">
            {datos.criticos.map((c, i) => (
              <div key={i} className="flex gap-2 text-sm bg-error/5 border border-error/20 rounded-xl px-3 py-2">
                <span className="text-error font-bold flex-shrink-0">{i + 1}.</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vista Quiz ────────────────────────────────────────────────────────────────
function QuizView({ preguntas }) {
  const [actual,     setActual]     = useState(0)
  const [respuestas, setRespuestas] = useState({})
  const [mostrar,    setMostrar]    = useState({})
  const [finalizado, setFinalizado] = useState(false)

  const q = preguntas?.[actual]
  if (!q) return <div className="p-6 text-sm text-slate-400">Sin preguntas disponibles.</div>

  const seleccionar = (letra) => {
    if (respuestas[actual]) return
    setRespuestas(p => ({ ...p, [actual]: letra }))
    setMostrar(p => ({ ...p, [actual]: true }))
  }

  const score = Object.entries(respuestas).filter(([i, r]) => r === preguntas[+i]?.correcta).length

  if (finalizado) return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-6">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
        <span className="material-symbols-outlined text-4xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
      </div>
      <p className="font-extrabold text-2xl">{score}/{preguntas.length}</p>
      <p className="text-on-surface-variant text-sm">
        {score >= 7 ? '¡Excelente! Estás listo.' : score >= 5 ? 'Bien. Repasa los temas que fallaste.' : 'Necesitas más repaso. ¡Vuelve a intentarlo!'}
      </p>
      <div className="w-full max-w-sm space-y-2">
        {preguntas.map((p, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm
            ${respuestas[i] === p.correcta ? 'bg-emerald-50 border border-emerald-200' : 'bg-error/5 border border-error/20'}`}>
            <span className={`material-symbols-outlined text-base ${respuestas[i] === p.correcta ? 'text-emerald-600' : 'text-error'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}>
              {respuestas[i] === p.correcta ? 'check_circle' : 'cancel'}
            </span>
            <span className="flex-1 truncate">{p.pregunta}</span>
            <span className="font-bold">{p.correcta}</span>
          </div>
        ))}
      </div>
      <button onClick={() => { setActual(0); setRespuestas({}); setMostrar({}); setFinalizado(false) }}
        className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-full text-sm hover:shadow-md transition-all">
        Repetir quiz
      </button>
    </div>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Progress */}
      <div className="px-5 pt-5 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-500">Pregunta {actual + 1} de {preguntas.length}</p>
          <p className="text-xs text-primary font-bold">{Object.keys(respuestas).length} respondidas</p>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((actual + 1) / preguntas.length) * 100}%` }} />
        </div>
      </div>

      {/* Pregunta */}
      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <p className="font-bold text-sm leading-relaxed">{q.pregunta}</p>
        </div>

        <div className="space-y-2.5">
          {Object.entries(q.opciones || {}).map(([letra, texto]) => {
            const respondida = !!respuestas[actual]
            const esSeleccionada = respuestas[actual] === letra
            const esCorrecta = q.correcta === letra
            let cls = 'border-slate-200 bg-white hover:border-primary/40 hover:bg-primary/5'
            if (respondida && esCorrecta) cls = 'border-emerald-400 bg-emerald-50'
            else if (respondida && esSeleccionada) cls = 'border-error bg-error/5'
            else if (respondida) cls = 'border-slate-200 bg-white opacity-60'
            return (
              <button key={letra} onClick={() => seleccionar(letra)}
                className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all text-sm ${cls} ${!respondida ? 'cursor-pointer' : 'cursor-default'}`}>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs flex-shrink-0
                  ${respondida && esCorrecta ? 'bg-emerald-500 text-white' : respondida && esSeleccionada ? 'bg-error text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {letra}
                </span>
                <span className="flex-1 leading-relaxed pt-0.5">{texto}</span>
                {respondida && esCorrecta && (
                  <span className="material-symbols-outlined text-emerald-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                )}
              </button>
            )
          })}
        </div>

        {mostrar[actual] && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed">
            <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-primary">info</span>Justificación
            </p>
            <p className="text-slate-600">{q.justificacion}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <div className="px-5 pb-5 flex gap-2 flex-shrink-0">
        <button onClick={() => setActual(a => Math.max(0, a - 1))} disabled={actual === 0}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition-colors">
          Anterior
        </button>
        {actual < preguntas.length - 1 ? (
          <button onClick={() => setActual(a => a + 1)} disabled={!respuestas[actual]}
            className="flex-1 bg-primary text-on-primary font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:shadow-md transition-all">
            Siguiente
          </button>
        ) : (
          <button onClick={() => setFinalizado(true)} disabled={Object.keys(respuestas).length < preguntas.length}
            className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-sm disabled:opacity-40 hover:shadow-md transition-all">
            Ver resultados
          </button>
        )}
      </div>
    </div>
  )
}

// ── Vista Flashcards ──────────────────────────────────────────────────────────
function FlashcardsView({ cards }) {
  const [volteadas, setVolteadas] = useState({})
  const toggle = (i) => setVolteadas(p => ({ ...p, [i]: !p[i] }))

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {cards.map((c, i) => (
          <div key={i} onClick={() => toggle(i)}
            className="cursor-pointer h-40 select-none"
            style={{ perspective: '1000px' }}>
            <div style={{
              position: 'relative', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              transition: 'transform 0.5s cubic-bezier(.4,2,.55,.44)',
              transform: volteadas[i] ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}>
              {/* Frente */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}
                className="bg-white border-2 border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tarjeta {i + 1}</span>
                  <span className="material-symbols-outlined text-slate-300 text-sm">flip</span>
                </div>
                <p className="font-bold text-sm leading-snug text-center">{c.frente}</p>
                <p className="text-[10px] text-slate-400 text-center">Toca para ver respuesta</p>
              </div>
              {/* Reverso */}
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className="bg-primary rounded-2xl p-4 flex flex-col justify-center">
                <p className="text-on-primary text-sm leading-relaxed text-center">{c.reverso}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Vista Plan de estudio ─────────────────────────────────────────────────────
function PlanView({ semanas, packageId }) {
  const KEY = `plan_${packageId}`
  const [checks, setChecks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
  })

  const toggle = (k) => {
    const next = { ...checks, [k]: !checks[k] }
    setChecks(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      {semanas.map((s) => {
        const total  = s.dias?.length || 0
        const hechos = s.dias?.filter((_, di) => checks[`${s.semana}-${di}`]).length || 0
        return (
          <div key={s.semana} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-primary/5 border-b border-primary/10">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-sm">Semana {s.semana}: {s.titulo}</p>
                <span className="text-xs font-bold text-primary">{hechos}/{total}</span>
              </div>
              <div className="h-1.5 bg-white rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                     style={{ width: total ? `${(hechos / total) * 100}%` : '0%' }} />
              </div>
              {s.objetivo && <p className="text-xs text-on-surface-variant mt-1.5">{s.objetivo}</p>}
            </div>
            <div className="divide-y divide-slate-100">
              {s.dias?.map((d, di) => {
                const k = `${s.semana}-${di}`
                return (
                  <label key={di} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all
                      ${checks[k] ? 'bg-primary border-primary' : 'border-slate-300'}`}
                      onClick={() => toggle(k)}>
                      {checks[k] && <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-bold ${checks[k] ? 'line-through text-slate-400' : 'text-primary'}`}>{d.dia}</p>
                        {d.horas && <span className="text-[10px] text-slate-400">{d.horas}</span>}
                      </div>
                      <p className={`text-sm mt-0.5 leading-snug ${checks[k] ? 'line-through text-slate-400' : ''}`}>{d.tarea}</p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista FAQ ─────────────────────────────────────────────────────────────────
const CAT_COLOR = {
  Inscripción: 'bg-blue-100 text-blue-700',
  Pruebas:     'bg-violet-100 text-violet-700',
  Empleo:      'bg-emerald-100 text-emerald-700',
  Normativa:   'bg-amber-100 text-amber-700',
  Proceso:     'bg-rose-100 text-rose-700',
}

function FaqView({ items }) {
  const [abierta, setAbierta] = useState(null)
  if (!items?.length) return <div className="p-6 text-sm text-slate-400">Sin preguntas disponibles.</div>
  return (
    <div className="p-4 overflow-y-auto h-full space-y-2">
      <p className="text-xs text-slate-400 font-semibold mb-3">
        {items.length} preguntas frecuentes · toca para ver la respuesta
      </p>
      {items.map((item, i) => {
        const open = abierta === i
        const catCls = CAT_COLOR[item.categoria] || 'bg-slate-100 text-slate-600'
        return (
          <div key={i} className={`border rounded-xl overflow-hidden transition-all ${open ? 'border-primary/30 bg-primary/5' : 'border-slate-200 bg-white'}`}>
            <button onClick={() => setAbierta(open ? null : i)}
              className="w-full flex items-start gap-3 px-4 py-3 text-left">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 font-extrabold text-xs
                ${open ? 'bg-primary text-on-primary' : 'bg-slate-100 text-slate-500'}`}>
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold leading-snug ${open ? 'text-primary' : ''}`}>{item.pregunta}</p>
                {item.categoria && (
                  <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${catCls}`}>
                    {item.categoria}
                  </span>
                )}
              </div>
              <span className={`material-symbols-outlined text-base flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180 text-primary' : 'text-slate-300'}`}>
                expand_more
              </span>
            </button>
            {open && (
              <div className="px-4 pb-4 pt-1 border-t border-primary/10">
                <p className="text-sm leading-relaxed text-slate-700">{item.respuesta}</p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Cronología ──────────────────────────────────────────────────────────
const TIPO_HITO = {
  convocatoria: { icon: 'campaign',      cls: 'bg-rose-500' },
  inscripcion:  { icon: 'how_to_reg',    cls: 'bg-blue-500' },
  prueba:       { icon: 'quiz',          cls: 'bg-violet-500' },
  lista:        { icon: 'format_list_numbered', cls: 'bg-amber-500' },
  empleo:       { icon: 'work',          cls: 'bg-emerald-500' },
}

function CronologiaView({ hitos }) {
  const [expandido, setExpandido] = useState(null)
  if (!hitos?.length) return <div className="p-6 text-sm text-slate-400">Sin cronología disponible.</div>
  return (
    <div className="p-4 overflow-y-auto h-full">
      <p className="text-xs text-slate-400 font-semibold mb-4">{hitos.length} hitos del proceso · toca para ver detalle</p>
      <div className="relative">
        {/* línea vertical */}
        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-slate-200" />
        <div className="space-y-3">
          {hitos.map((h, i) => {
            const t   = TIPO_HITO[h.tipo] || { icon: 'circle', cls: 'bg-slate-400' }
            const exp = expandido === i
            return (
              <div key={i} className="relative flex gap-3">
                {/* Icono */}
                <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm ${t.cls}`}>
                  <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
                </div>
                {/* Contenido */}
                <div className={`flex-1 border rounded-xl overflow-hidden transition-all mb-1 ${exp ? 'border-primary/30' : 'border-slate-200 bg-white'}`}>
                  <button onClick={() => setExpandido(exp ? null : i)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md flex-shrink-0">
                          {h.orden}
                        </span>
                        <p className="font-bold text-sm leading-tight">{h.hito}</p>
                      </div>
                    </div>
                    <span className={`material-symbols-outlined text-sm flex-shrink-0 transition-transform ${exp ? 'rotate-180 text-primary' : 'text-slate-300'}`}>
                      expand_more
                    </span>
                  </button>
                  {exp && (
                    <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-1.5">
                      <p className="text-sm leading-relaxed text-slate-700">{h.descripcion}</p>
                      {h.norma && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">gavel</span>{h.norma}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Modal visor de fuente ─────────────────────────────────────────────────────
function ModalFuente({ fuente, onClose }) {
  if (!fuente) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <span className="material-symbols-outlined text-primary text-xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
          <p className="font-bold flex-1 truncate">{fuente.nombre || fuente.title}</p>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {fuente.texto ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-on-surface font-mono text-xs">
              {fuente.texto}
            </p>
          ) : fuente.url ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <span className="material-symbols-outlined text-4xl text-slate-300">open_in_new</span>
              <p className="text-sm text-slate-500">Este archivo está alojado externamente.</p>
              <a href={fuente.url} target="_blank" rel="noopener noreferrer"
                className="bg-primary text-on-primary font-bold px-5 py-2.5 rounded-full text-sm hover:shadow-md transition-all">
                Abrir documento
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">Sin contenido disponible.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function CuadernoIA() {
  const { packageId } = useParams()
  const navigate      = useNavigate()
  const { user }      = useAuth()

  const [pkgNombre,   setPkgNombre]   = useState('')
  const [tabMobile,   setTabMobile]   = useState('chat')

  // Fuentes
  const [fuentes,     setFuentes]     = useState([]) // admin + user
  const [subiendo,    setSubiendo]    = useState(false)
  const [modalFuente, setModalFuente] = useState(null)
  const fileRef = useRef(null)

  // Chat
  const [mensajes,    setMensajes]    = useState([])
  const [input,       setInput]       = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [guardandoMsg,setGuardandoMsg]= useState(null)
  const [usados,      setUsados]      = useState(0)
  const [limite,      setLimite]      = useState(50)
  const [chatErr,     setChatErr]     = useState('')
  const bottomRef = useRef(null)

  // Vista activa (chat | resumen | quiz | flashcards | plan)
  const [vista,       setVista]       = useState('chat')
  const [vistaData,   setVistaData]   = useState(null)
  const [generando,   setGenerando]   = useState(null)

  // Notas
  const [notas,       setNotas]       = useState([])
  const [nuevaNota,   setNuevaNota]   = useState('')
  const [addingNota,  setAddingNota]  = useState(false)
  const [expandidas,  setExpandidas]  = useState({})

  useEffect(() => { cargarTodo() }, [packageId])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [mensajes])

  async function cargarTodo() {
    const h = await hdrs()
    const [histRes, notasRes, fuentesRes, pkgRes] = await Promise.all([
      fetch(`${BASE}/api/cuaderno/${packageId}/historial`, { headers: h }),
      fetch(`${BASE}/api/cuaderno/${packageId}/notas`,    { headers: h }),
      fetch(`${BASE}/api/cuaderno/${packageId}/fuentes`,  { headers: h }),
      supabase.from('packages').select('name').eq('id', packageId).maybeSingle(),
    ])
    if (histRes.ok)    { const d = await histRes.json();    setMensajes(d.mensajes || []) }
    if (notasRes.ok)   { const d = await notasRes.json();   setNotas(d.notas || []) }
    if (fuentesRes.ok) { const d = await fuentesRes.json(); setFuentes([...(d.admin || []), ...(d.user || [])]) }
    if (pkgRes.data)   setPkgNombre(pkgRes.data.name)

    const inicio = new Date(); inicio.setDate(1); inicio.setHours(0,0,0,0)
    const { count } = await supabase
      .from('user_cuaderno_mensajes').select('*', { count: 'exact', head: true })
      .eq('user_id', user?.id).eq('package_id', parseInt(packageId)).eq('rol', 'user')
      .gte('created_at', inicio.toISOString())
    setUsados(count || 0)
  }

  // ── Chat ──
  const enviar = useCallback(async (texto) => {
    const msg = (texto || input).trim()
    if (!msg || enviando) return
    setInput(''); setChatErr(''); setVista('chat')
    setEnviando(true)
    setMensajes(prev => [...prev, { id: `u${Date.now()}`, rol: 'user', contenido: msg }])
    try {
      const h = await hdrs()
      const res  = await fetch(`${BASE}/api/cuaderno/${packageId}/chat`, {
        method: 'POST', headers: h, body: JSON.stringify({ mensaje: msg }),
      })
      const data = await res.json()
      if (!res.ok) { setChatErr(data.error || 'Error.'); return }
      setMensajes(prev => [...prev, { id: `a${Date.now()}`, rol: 'assistant', contenido: data.respuesta }])
      setUsados(data.usados); setLimite(data.limite)
    } catch { setChatErr('Error de conexión.') }
    finally { setEnviando(false) }
  }, [input, enviando, packageId])

  async function guardarMsgComoNota(contenido) {
    setGuardandoMsg(contenido)
    const h = await hdrs()
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/nota`, {
      method: 'POST', headers: h, body: JSON.stringify({ contenido, fuente: 'ia_chat' }),
    })
    if (res.ok) { const d = await res.json(); setNotas(prev => [d.nota, ...prev]) }
    setGuardandoMsg(null)
  }

  // ── Generación ──
  async function generar(tipo) {
    setGenerando(tipo); setVista(tipo); setVistaData(null)
    try {
      const h = await hdrs()
      const res  = await fetch(`${BASE}/api/cuaderno/${packageId}/generar`, {
        method: 'POST', headers: h, body: JSON.stringify({ tipo }),
      })
      const data = await res.json()
      if (res.ok) {
        setVistaData(data.datos)
        if (data.nota) setNotas(prev => [data.nota, ...prev])
      }
    } catch { setVistaData(null) }
    finally { setGenerando(null) }
  }

  // ── Subir PDF ──
  async function subirPDF(file) {
    if (!file || file.type !== 'application/pdf') return
    setSubiendo(true)
    const form = new FormData(); form.append('pdf', file)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token || ''
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/fuentes`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (res.ok) { const d = await res.json(); setFuentes(prev => [...prev, d.fuente]) }
    setSubiendo(false)
  }

  async function eliminarFuente(id) {
    setFuentes(prev => prev.filter(f => f.id !== id || f.origen !== 'user'))
    const h = await hdrs()
    await fetch(`${BASE}/api/cuaderno/${packageId}/fuentes/${id}`, { method: 'DELETE', headers: h })
  }

  // ── Notas ──
  async function agregarNota() {
    if (!nuevaNota.trim()) return
    setAddingNota(true)
    const h = await hdrs()
    const res = await fetch(`${BASE}/api/cuaderno/${packageId}/nota`, {
      method: 'POST', headers: h, body: JSON.stringify({ contenido: nuevaNota.trim(), fuente: 'manual' }),
    })
    if (res.ok) { const d = await res.json(); setNotas(prev => [d.nota, ...prev]); setNuevaNota('') }
    setAddingNota(false)
  }

  async function borrarNota(id) {
    setNotas(prev => prev.filter(n => n.id !== id))
    const h = await hdrs()
    await fetch(`${BASE}/api/cuaderno/${packageId}/nota/${id}`, { method: 'DELETE', headers: h })
  }

  async function toggleFijar(nota) {
    const nuevo = !nota.fijada
    setNotas(prev => prev.map(n => n.id === nota.id ? { ...n, fijada: nuevo } : n))
    const h = await hdrs()
    await fetch(`${BASE}/api/cuaderno/${packageId}/nota/${nota.id}/fijar`, {
      method: 'PATCH', headers: h, body: JSON.stringify({ fijada: nuevo }),
    })
  }

  const agotado = usados >= limite
  const fuentesAdmin = fuentes.filter(f => f.origen === 'admin')
  const fuentesUser  = fuentes.filter(f => f.origen === 'user')

  // ── Render vista central ──
  function CenterContent() {
    if (vista !== 'chat' && generando === vista) return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-bold text-slate-600">Generando {ACCIONES.find(a => a.tipo === vista)?.label}…</p>
        <p className="text-xs">Esto puede tomar unos segundos</p>
      </div>
    )

    if (vista === 'resumen'    && vistaData)              return <ResumenView    datos={vistaData} />
    if (vista === 'quiz'       && Array.isArray(vistaData)) return <QuizView       preguntas={vistaData} />
    if (vista === 'flashcards' && Array.isArray(vistaData)) return <FlashcardsView cards={vistaData} />
    if (vista === 'plan'       && Array.isArray(vistaData)) return <PlanView       semanas={vistaData} packageId={packageId} />
    if (vista === 'faq'        && Array.isArray(vistaData)) return <FaqView        items={vistaData} />
    if (vista === 'cronologia' && Array.isArray(vistaData)) return <CronologiaView hitos={vistaData} />

    // Chat (default)
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensajes.length === 0 && !enviando && (
            <div className="flex flex-col items-center justify-center h-full text-center py-10 text-slate-400">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-3xl text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
              </div>
              <p className="font-bold text-slate-600 mb-1">Pregúntale al tutor IA</p>
              <p className="text-xs max-w-xs leading-relaxed mb-5">
                Explícame un artículo, hazme un resumen, dame preguntas de práctica o pídeme que te evalúe.
              </p>
              <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                {['¿Cuáles son los temas más frecuentes?','Explícame la etapa precontractual','Dame 5 preguntas de práctica','¿Qué es el mérito en el Estado?'].map(s => (
                  <button key={s} onClick={() => enviar(s)}
                    className="text-xs bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:border-primary hover:text-primary transition-all">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mensajes.map(m => (
            <Bubble key={m.id} msg={m} fuentes={fuentes}
              onGuardar={guardarMsgComoNota}
              guardando={guardandoMsg === m.contenido}
              onCitaClick={setModalFuente} />
          ))}
          {enviando && (
            <div className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-sm text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5 items-center">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {chatErr && (
          <div className="mx-4 mb-2 px-3 py-2 bg-error/10 text-error text-xs font-semibold rounded-xl flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">error</span>{chatErr}
          </div>
        )}
        <div className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
          {agotado ? (
            <div className="p-3 bg-error/10 text-error text-sm font-semibold rounded-xl text-center">
              Límite de {limite} mensajes/mes alcanzado. Se renueva el 1 del próximo mes.
            </div>
          ) : (
            <div className="flex gap-2 items-end">
              <textarea rows={1} value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
                placeholder="Pregunta al tutor IA… (Enter para enviar)"
                className="flex-1 resize-none bg-slate-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-36 overflow-y-auto"
                style={{ lineHeight: '1.5' }} />
              <button onClick={() => enviar()} disabled={!input.trim() || enviando}
                className="w-11 h-11 bg-primary text-on-primary rounded-2xl flex items-center justify-center hover:shadow-md transition-all disabled:opacity-40 flex-shrink-0">
                <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">

      {/* ── Header ── */}
      <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0 shadow-sm z-10">
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
        {vista !== 'chat' && (
          <button onClick={() => { setVista('chat'); setVistaData(null) }}
            className="flex items-center gap-1.5 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hover:bg-primary/20 transition-colors">
            <span className="material-symbols-outlined text-sm">chat</span>Volver al chat
          </button>
        )}
        <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
          ${usados >= limite * 0.8 ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-500'}`}>
          <span className="material-symbols-outlined text-xs">chat</span>{usados}/{limite}
        </div>
      </header>

      {/* ── Tabs móvil ── */}
      <div className="flex border-b border-slate-200 bg-white flex-shrink-0 lg:hidden">
        {[
          { key: 'chat',    icon: 'smart_toy',     label: 'Chat' },
          { key: 'generar', icon: 'auto_awesome',   label: 'Generar' },
          { key: 'notas',   icon: 'sticky_note_2',  label: `Notas${notas.length ? ` (${notas.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTabMobile(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-bold border-b-2 transition-all
              ${tabMobile === t.key ? 'border-primary text-primary' : 'border-transparent text-slate-400'}`}>
            <span className="material-symbols-outlined text-sm"
                  style={{ fontVariationSettings: tabMobile === t.key ? "'FILL' 1" : "'FILL' 0" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Cuerpo ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ══ LEFT: Fuentes + Generar ══ */}
        <aside className={`flex flex-col w-full lg:w-60 border-r border-slate-200 bg-white overflow-y-auto flex-shrink-0
          ${tabMobile !== 'generar' ? 'hidden lg:flex' : ''}`}>

          {/* Fuentes admin */}
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">folder</span>Fuentes del paquete
            </p>
            {fuentesAdmin.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">El admin aún no ha cargado archivos.</p>
            ) : (
              <div className="space-y-1">
                {fuentesAdmin.map(f => (
                  <button key={f.id} onClick={() => setModalFuente(f)}
                    className="w-full flex items-center gap-2 text-left text-xs bg-slate-50 hover:bg-primary/5 rounded-lg px-2.5 py-2 transition-colors group">
                    <span className="material-symbols-outlined text-sm text-red-500 flex-shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}>picture_as_pdf</span>
                    <span className="truncate flex-1">{f.title}</span>
                    <span className="material-symbols-outlined text-xs text-slate-300 group-hover:text-primary">open_in_new</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Fuentes del usuario */}
          <div className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">upload_file</span>Mis documentos
            </p>
            <div className="space-y-1">
              {fuentesUser.map(f => (
                <div key={f.id} className="flex items-center gap-1.5">
                  <button onClick={() => setModalFuente(f)}
                    className="flex-1 flex items-center gap-2 text-xs bg-slate-50 hover:bg-primary/5 rounded-lg px-2.5 py-1.5 transition-colors text-left">
                    <span className="material-symbols-outlined text-sm text-blue-500 flex-shrink-0"
                          style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                    <span className="truncate">{f.nombre}</span>
                  </button>
                  <button onClick={() => eliminarFuente(f.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-error/10 text-slate-300 hover:text-error transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => e.target.files?.[0] && subirPDF(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={subiendo}
              className="mt-2 w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-primary/10 hover:text-primary
                         text-slate-500 font-bold text-[11px] py-2 rounded-xl transition-all disabled:opacity-50 border-2 border-dashed border-slate-200">
              {subiendo
                ? <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />Subiendo…</>
                : <><span className="material-symbols-outlined text-xs">upload</span>Subir mi PDF</>
              }
            </button>
          </div>

          {/* Generar */}
          <div className="p-3 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">auto_awesome</span>Generar con IA
            </p>
            <div className="space-y-1.5">
              {ACCIONES.map(a => (
                <button key={a.tipo} onClick={() => generar(a.tipo)} disabled={!!generando}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all
                    border-2 ${vista === a.tipo ? 'border-primary bg-primary/5' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}
                    disabled:opacity-50`}>
                  <div className={`w-8 h-8 bg-gradient-to-br ${a.grad} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    {generando === a.tipo
                      ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      : <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs">{a.label}</p>
                    <p className="text-[10px] text-slate-400 leading-tight truncate">{a.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ══ CENTER: Vista dinámica ══ */}
        <main className={`flex-1 overflow-hidden ${tabMobile === 'notas' || tabMobile === 'generar' ? 'hidden lg:flex lg:flex-col' : 'flex flex-col'}`}>
          <CenterContent />
        </main>

        {/* ══ RIGHT: Notas ══ */}
        <aside className={`flex flex-col w-full lg:w-72 border-l border-slate-200 bg-white overflow-hidden
          ${tabMobile !== 'notas' ? 'hidden lg:flex' : ''}`}>

          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-base text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>sticky_note_2</span>
            <p className="font-bold text-sm flex-1">Mis notas</p>
            {notas.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{notas.length}</span>
            )}
          </div>

          {/* Input nueva nota */}
          <div className="p-3 border-b border-slate-100 flex-shrink-0">
            <textarea rows={2} value={nuevaNota} onChange={e => setNuevaNota(e.target.value)}
              placeholder="Escribe una nota rápida…"
              className="w-full resize-none bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30" />
            <button onClick={agregarNota} disabled={!nuevaNota.trim() || addingNota}
              className="mt-1.5 w-full bg-primary/10 text-primary font-bold text-xs py-2 rounded-xl hover:bg-primary/20 transition-colors disabled:opacity-40 flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-xs">add</span>
              {addingNota ? 'Guardando…' : 'Agregar nota'}
            </button>
          </div>

          {/* Lista notas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-slate-400">
                <span className="material-symbols-outlined text-4xl opacity-30 mb-2">sticky_note_2</span>
                <p className="text-xs font-semibold">Sin notas aún</p>
                <p className="text-[11px] mt-1 max-w-[180px]">Guarda respuestas del chat o genera artefactos IA.</p>
              </div>
            )}
            {notas.map(nota => {
              const meta = FUENTE_META[nota.fuente] || FUENTE_META.manual
              const exp  = !!expandidas[nota.id]
              return (
                <div key={nota.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${nota.fijada ? 'border-primary/30' : 'border-slate-200'}`}>
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-100">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${meta.cls}`}>
                      <span className="material-symbols-outlined text-[10px]">{meta.icon}</span>
                      {meta.label}
                    </span>
                    {nota.fijada && (
                      <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>push_pin</span>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => toggleFijar(nota)} title="Fijar"
                      className={`w-6 h-6 flex items-center justify-center rounded-lg transition-colors
                        ${nota.fijada ? 'text-primary hover:bg-primary/10' : 'text-slate-300 hover:text-primary hover:bg-slate-100'}`}>
                      <span className="material-symbols-outlined text-xs"
                            style={{ fontVariationSettings: nota.fijada ? "'FILL' 1" : "'FILL' 0" }}>push_pin</span>
                    </button>
                    <button onClick={() => setInput(nota.contenido.slice(0, 300))} title="Usar en chat"
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-primary hover:bg-slate-100 transition-colors">
                      <span className="material-symbols-outlined text-xs">reply</span>
                    </button>
                    <button onClick={() => setExpandidas(p => ({ ...p, [nota.id]: !p[nota.id] }))}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 transition-colors">
                      <span className="material-symbols-outlined text-xs">{exp ? 'expand_less' : 'expand_more'}</span>
                    </button>
                    <button onClick={() => borrarNota(nota.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-error hover:bg-error/10 transition-colors">
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                  <div className={`px-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 transition-all overflow-hidden
                    ${exp ? 'py-3 max-h-96' : 'py-2 max-h-14 line-clamp-3'}`}>
                    {nota.contenido}
                  </div>
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      {/* ── Modal visor de fuente ── */}
      <ModalFuente fuente={modalFuente} onClose={() => setModalFuente(null)} />
    </div>
  )
}
