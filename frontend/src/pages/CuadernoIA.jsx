import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel, flexRender } from '@tanstack/react-table'
import { ArrowUpDown, ArrowUp, ArrowDown, Search, Play, Pause, SkipBack, Download } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'

const BASE     = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const TOUR_KEY = 'praxia_tour_cuaderno_v1'
const PAD      = 10

const PASOS_TOUR = [
  { sel: null,                         icon: 'auto_stories',   side: 'center', titulo: '¡Bienvenido al Cuaderno IA!',    desc: 'Tu espacio personal de estudio con inteligencia artificial. En los próximos pasos te mostramos cómo funciona cada sección.' },
  { sel: '[data-tour="fuentes-admin"]', icon: 'folder',        side: 'right',  titulo: 'Fuentes del paquete',            desc: 'Documentos oficiales del concurso cargados por el administrador. La IA los lee completos y los cita cuando te responde.' },
  { sel: '[data-tour="mis-docs"]',      icon: 'upload_file',   side: 'right',  titulo: 'Mis documentos',                 desc: 'Sube tus propios PDFs: acuerdos, normativas, apuntes. La IA puede leer hasta 40 páginas completas por documento y usarlos en todas las funciones.' },
  { sel: '[data-tour="generar-ia"]',    icon: 'auto_awesome',  side: 'right',  titulo: 'Generar material con IA',        desc: 'Con un clic genera 7 tipos de material: Resumen ejecutivo, Quiz interactivo, Flashcards 3D, Plan de estudio, FAQ, Cronología del proceso y un Podcast real con dos locutores.' },
  { sel: '[data-tour="chat-input"]',    icon: 'smart_toy',     side: 'top',    titulo: 'Tutor IA',                       desc: 'Pregúntale lo que quieras. Cita tus fuentes automáticamente con 【Archivo】. Puedes guardar cualquier respuesta como nota con un clic.' },
  { sel: '[data-tour="panel-notas"]',   icon: 'sticky_note_2', side: 'left',   titulo: 'Mis notas',                      desc: 'Guarda ideas, respuestas del chat y artefactos generados. Fija 📌 las más importantes y úsalas directamente en el chat con "Usar en chat".' },
  { sel: '[data-tour="token-counter"]', icon: 'token',         side: 'bottom', titulo: 'Tus tokens disponibles',         desc: 'Tienes 2 millones de tokens por mes por paquete. Cada mensaje y artefacto los consume. Se renuevan automáticamente el día 1 de cada mes.' },
]

// ── Tour de bienvenida estilo videojuego ──────────────────────────────────────
function TourCuaderno({ onDone }) {
  const [paso, setPaso]   = useState(0)
  const [box,  setBox]    = useState(null)
  const step = PASOS_TOUR[paso]

  useEffect(() => {
    if (!step.sel) { setBox(null); return }
    const el = document.querySelector(step.sel)
    if (!el) { setBox(null); return }
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    const t = setTimeout(() => {
      const r = el.getBoundingClientRect()
      setBox({ top: r.top - PAD, left: r.left - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, right: r.right + PAD, bottom: r.bottom + PAD })
    }, 320)
    return () => clearTimeout(t)
  }, [paso])

  const siguiente = () => paso < PASOS_TOUR.length - 1 ? setPaso(p => p + 1) : onDone()

  const W = typeof window !== 'undefined' ? window.innerWidth  : 1280
  const H = typeof window !== 'undefined' ? window.innerHeight : 800
  const GAP = 16

  let tip = { position: 'fixed', zIndex: 10001, width: 288 }
  if (!box || step.side === 'center') {
    tip = { ...tip, top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
  } else {
    switch (step.side) {
      case 'right':
        tip.left = Math.min(box.right + GAP, W - 300)
        tip.top  = Math.max(8, Math.min(box.top, H - 230))
        break
      case 'left':
        tip.right = Math.max(W - box.left + GAP, 8)
        tip.top   = Math.max(8, Math.min(box.top, H - 230))
        break
      case 'top':
        tip.bottom = Math.max(H - box.top + GAP, 8)
        tip.left   = Math.max(8, Math.min(box.left + box.w / 2 - 144, W - 296))
        break
      case 'bottom':
        tip.top  = Math.min(box.bottom + GAP, H - 230)
        tip.left = Math.max(8, Math.min(box.left + box.w / 2 - 144, W - 296))
        break
    }
  }

  return (
    <div className="fixed inset-0" style={{ zIndex: 9999 }}>
      {/* ── Overlay con recorte ── */}
      {box ? (
        <>
          <div className="absolute bg-black/70" style={{ top: 0, left: 0, right: 0, height: box.top }} />
          <div className="absolute bg-black/70" style={{ top: box.bottom, left: 0, right: 0, bottom: 0 }} />
          <div className="absolute bg-black/70" style={{ top: box.top, left: 0, width: box.left, height: box.h }} />
          <div className="absolute bg-black/70" style={{ top: box.top, left: box.right, right: 0, height: box.h }} />
          <div className="absolute rounded-xl pointer-events-none"
            style={{ top: box.top, left: box.left, width: box.w, height: box.h, zIndex: 10000,
              boxShadow: '0 0 0 3px #6366f1, 0 0 20px 4px rgba(99,102,241,0.5)',
              animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite' }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70" />
      )}

      {/* ── Tarjeta tooltip ── */}
      <div style={tip}
        className="bg-white rounded-2xl shadow-2xl p-5 flex flex-col gap-3.5"
        onClick={e => e.stopPropagation()}>

        {/* Icono + título */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}>{step.icon}</span>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="font-extrabold text-sm leading-snug">{step.titulo}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Paso {paso + 1} de {PASOS_TOUR.length}</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>

        {/* Indicador de pasos */}
        <div className="flex items-center gap-1.5">
          {PASOS_TOUR.map((_, i) => (
            <div key={i} onClick={() => setPaso(i)} className={`h-1.5 rounded-full transition-all cursor-pointer
              ${i === paso ? 'bg-primary w-6' : i < paso ? 'bg-primary/40 w-1.5' : 'bg-slate-200 w-1.5'}`} />
          ))}
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-0.5">
          <button onClick={onDone}
            className="text-xs text-slate-400 hover:text-slate-600 px-3 py-2.5 rounded-xl transition-colors font-semibold">
            Omitir
          </button>
          <button onClick={siguiente}
            className="flex-1 bg-primary text-on-primary font-extrabold text-xs py-2.5 rounded-xl hover:shadow-md transition-all flex items-center justify-center gap-1.5">
            {paso < PASOS_TOUR.length - 1
              ? <><span>Siguiente</span><span className="material-symbols-outlined text-sm">arrow_forward</span></>
              : <><span>¡Entendido!</span><span className="material-symbols-outlined text-sm">check_circle</span></>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

async function hdrs(contentType = 'application/json') {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || ''
  return { Authorization: `Bearer ${token}`, ...(contentType ? { 'Content-Type': contentType } : {}) }
}

const FUENTE_META = {
  manual:      { label: 'Manual',       icon: 'edit',           cls: 'bg-slate-100 text-slate-600' },
  ia_chat:     { label: 'Chat',         icon: 'chat',           cls: 'bg-primary/10 text-primary' },
  resumen:     { label: 'Resumen',      icon: 'summarize',      cls: 'bg-blue-100 text-blue-700' },
  quiz:        { label: 'Quiz',         icon: 'quiz',           cls: 'bg-violet-100 text-violet-700' },
  flashcards:  { label: 'Flashcards',   icon: 'style',          cls: 'bg-amber-100 text-amber-700' },
  plan:        { label: 'Plan',         icon: 'calendar_month', cls: 'bg-emerald-100 text-emerald-700' },
  faq:         { label: 'FAQ',          icon: 'help',           cls: 'bg-cyan-100 text-cyan-700' },
  cronologia:  { label: 'Cronología',   icon: 'timeline',       cls: 'bg-rose-100 text-rose-700' },
  mapa_mental: { label: 'Mapa Mental',  icon: 'account_tree',   cls: 'bg-purple-100 text-purple-700' },
  tabla:       { label: 'Tabla',        icon: 'table_chart',    cls: 'bg-sky-100 text-sky-700' },
  guia:        { label: 'Guía',         icon: 'menu_book',      cls: 'bg-green-100 text-green-700' },
  audio:       { label: 'Audio',        icon: 'headphones',     cls: 'bg-slate-100 text-slate-700' },
}

const ACCIONES = [
  { tipo: 'resumen',    icon: 'summarize',      label: 'Resumen',          desc: 'Ejes temáticos + glosario + ejecutivo',      grad: 'from-blue-600 to-blue-700' },
  { tipo: 'quiz',       icon: 'quiz',           label: 'Quiz CNSC',        desc: '10 preguntas interactivas tipo situación',    grad: 'from-violet-600 to-violet-700' },
  { tipo: 'flashcards', icon: 'style',          label: 'Flashcards',       desc: '12 tarjetas con volteo 3D',                  grad: 'from-amber-500 to-orange-600' },
  { tipo: 'mapa_mental',icon: 'account_tree',   label: 'Mapa Mental',      desc: 'Árbol visual de temas y conceptos clave',    grad: 'from-purple-600 to-indigo-700' },
  { tipo: 'tabla',      icon: 'table_chart',    label: 'Tabla de datos',   desc: 'Análisis matricial del concurso',             grad: 'from-sky-500 to-blue-600' },
  { tipo: 'guia',       icon: 'menu_book',      label: 'Guía de estudio',  desc: 'Módulos por fases con objetivos',             grad: 'from-green-600 to-teal-600' },
  { tipo: 'plan',       icon: 'calendar_month', label: 'Plan de estudio',  desc: 'Cronograma 4 semanas con checkboxes',         grad: 'from-emerald-600 to-teal-700' },
  { tipo: 'faq',        icon: 'help',           label: 'FAQ',              desc: '12 preguntas frecuentes del concurso',        grad: 'from-cyan-500 to-sky-600' },
  { tipo: 'cronologia', icon: 'timeline',       label: 'Cronología',       desc: 'Hitos y etapas del proceso de selección',     grad: 'from-rose-500 to-pink-600' },
  { tipo: 'audio',      icon: 'headphones',     label: 'Audio Overview',   desc: 'Podcast IA · Valentina & Andrés ~5 min',      grad: 'from-slate-700 to-slate-900' },
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

// ── Vista Quiz (con Framer Motion) ───────────────────────────────────────────
const shakeVariants = {
  shake: { x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.45 } },
  idle:  { x: 0 },
}
const slideVariants = {
  enter: dir => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 28 } },
  exit:  dir => ({ x: dir > 0 ? -60 : 60, opacity: 0, transition: { duration: 0.18 } }),
}

function QuizView({ preguntas }) {
  const [actual,     setActual]     = useState(0)
  const [dir,        setDir]        = useState(1)
  const [respuestas, setRespuestas] = useState({})
  const [mostrar,    setMostrar]    = useState({})
  const [shake,      setShake]      = useState(false)
  const [finalizado, setFinalizado] = useState(false)

  const q = preguntas?.[actual]
  if (!q) return <div className="p-6 text-sm text-slate-400">Sin preguntas disponibles.</div>

  const ir = (siguiente) => {
    setDir(siguiente > actual ? 1 : -1)
    setActual(siguiente)
  }

  const seleccionar = (letra) => {
    if (respuestas[actual]) return
    setRespuestas(p => ({ ...p, [actual]: letra }))
    setMostrar(p => ({ ...p, [actual]: true }))
    if (letra !== q.correcta) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  const score = Object.entries(respuestas).filter(([i, r]) => r === preguntas[+i]?.correcta).length

  if (finalizado) return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full gap-5 p-6">
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
            <span className="flex-1 truncate text-xs">{p.pregunta}</span>
            <span className="font-bold text-xs">{p.correcta}</span>
          </div>
        ))}
      </div>
      <button onClick={() => { setActual(0); setRespuestas({}); setMostrar({}); setFinalizado(false) }}
        className="bg-primary text-on-primary font-bold px-6 py-2.5 rounded-full text-sm hover:shadow-md transition-all">
        Repetir quiz
      </button>
    </motion.div>
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
          <motion.div className="h-full bg-primary rounded-full"
            animate={{ width: `${((actual + 1) / preguntas.length) * 100}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }} />
        </div>
      </div>

      {/* Pregunta con slide + shake */}
      <div className="flex-1 overflow-y-auto px-5 pb-5">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div key={actual} custom={dir}
            variants={slideVariants} initial="enter" animate="center" exit="exit"
            className="space-y-4">

            <motion.div animate={shake ? 'shake' : 'idle'} variants={shakeVariants}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="font-bold text-sm leading-relaxed">{q.pregunta}</p>
            </motion.div>

            <div className="space-y-2.5">
              {Object.entries(q.opciones || {}).map(([letra, texto]) => {
                const respondida   = !!respuestas[actual]
                const esSeleccionada = respuestas[actual] === letra
                const esCorrecta   = q.correcta === letra
                let cls = 'border-slate-200 bg-white'
                if (respondida && esCorrecta)    cls = 'border-emerald-400 bg-emerald-50'
                else if (respondida && esSeleccionada) cls = 'border-red-400 bg-red-50'
                else if (respondida)             cls = 'border-slate-200 bg-white opacity-60'
                return (
                  <motion.button key={letra}
                    whileHover={!respondida ? { scale: 1.015 } : {}}
                    whileTap={!respondida ? { scale: 0.98 } : {}}
                    onClick={() => seleccionar(letra)}
                    className={`w-full flex items-start gap-3 p-4 rounded-xl border-2 text-left text-sm transition-colors ${cls} ${!respondida ? 'cursor-pointer' : 'cursor-default'}`}>
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs flex-shrink-0
                      ${respondida && esCorrecta ? 'bg-emerald-500 text-white' : respondida && esSeleccionada ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {letra}
                    </span>
                    <span className="flex-1 leading-relaxed pt-0.5">{texto}</span>
                    {respondida && esCorrecta && (
                      <span className="material-symbols-outlined text-emerald-500 flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    )}
                  </motion.button>
                )
              })}
            </div>

            {mostrar[actual] && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs leading-relaxed">
                <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">info</span>Justificación
                </p>
                <p className="text-slate-600">{q.justificacion}</p>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Nav */}
      <div className="px-5 pb-5 flex gap-2 flex-shrink-0">
        <button onClick={() => ir(actual - 1)} disabled={actual === 0}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold disabled:opacity-40 hover:bg-slate-50 transition-colors">
          Anterior
        </button>
        {actual < preguntas.length - 1 ? (
          <button onClick={() => ir(actual + 1)} disabled={!respuestas[actual]}
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

// ── Vista Plan de estudio (Roadmap + Framer Motion) ──────────────────────────
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

  const totalGlobal  = semanas.reduce((a, s) => a + (s.dias?.length || 0), 0)
  const hechosGlobal = semanas.reduce((a, s) =>
    a + (s.dias?.filter((_, di) => checks[`${s.semana}-${di}`]).length || 0), 0)
  const pctGlobal = totalGlobal ? Math.round((hechosGlobal / totalGlobal) * 100) : 0

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Barra de progreso global */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-slate-600">Progreso total del plan</p>
          <motion.span key={pctGlobal} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
            className="text-sm font-extrabold text-primary">{pctGlobal}%
          </motion.span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full"
            animate={{ width: `${pctGlobal}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5">{hechosGlobal} de {totalGlobal} tareas completadas</p>
      </div>

      {/* Semanas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {semanas.map((s) => {
          const total  = s.dias?.length || 0
          const hechos = s.dias?.filter((_, di) => checks[`${s.semana}-${di}`]).length || 0
          const pct    = total ? (hechos / total) * 100 : 0
          const done   = hechos === total && total > 0

          return (
            <div key={s.semana} className={`bg-white border-2 rounded-2xl overflow-hidden transition-colors ${done ? 'border-emerald-300' : 'border-slate-200'}`}>
              <div className={`px-4 py-3 border-b ${done ? 'bg-emerald-50 border-emerald-100' : 'bg-primary/5 border-primary/10'}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {done && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400 }}
                      className="material-symbols-outlined text-emerald-500 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </motion.span>}
                    <p className="font-bold text-sm">Semana {s.semana}: {s.titulo}</p>
                  </div>
                  <span className={`text-xs font-extrabold ${done ? 'text-emerald-600' : 'text-primary'}`}>{hechos}/{total}</span>
                </div>
                <div className="h-1.5 bg-white/70 rounded-full overflow-hidden">
                  <motion.div className={`h-full rounded-full ${done ? 'bg-emerald-500' : 'bg-primary'}`}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 150, damping: 22 }} />
                </div>
                {s.objetivo && <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{s.objetivo}</p>}
              </div>

              <div className="divide-y divide-slate-100">
                {s.dias?.map((d, di) => {
                  const k    = `${s.semana}-${di}`
                  const hecho = !!checks[k]
                  return (
                    <motion.label key={di} layout
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                      {/* Checkbox animado */}
                      <motion.div
                        onClick={() => toggle(k)}
                        animate={hecho ? { scale: [1, 1.25, 1], backgroundColor: '#6366f1' } : { scale: 1, backgroundColor: '#ffffff' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${hecho ? 'border-primary' : 'border-slate-300'}`}>
                        <AnimatePresence>
                          {hecho && (
                            <motion.span initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }}
                              className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>
                              check
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-xs font-bold ${hecho ? 'line-through text-slate-400' : 'text-primary'}`}>
                            {typeof d.dia === 'number' ? `Día ${d.dia}` : d.dia}
                          </p>
                          {d.horas && <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{d.horas}</span>}
                        </div>
                        <p className={`text-sm mt-0.5 leading-snug ${hecho ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {d.tarea}
                        </p>
                      </div>
                    </motion.label>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vista FAQ (Acordeón Framer Motion + buscador) ─────────────────────────────
const CAT_COLOR = {
  Inscripción: 'bg-blue-100 text-blue-700',
  Pruebas:     'bg-violet-100 text-violet-700',
  Empleo:      'bg-emerald-100 text-emerald-700',
  Normativa:   'bg-amber-100 text-amber-700',
  Proceso:     'bg-rose-100 text-rose-700',
}

function FaqView({ items }) {
  const [abierta, setAbierta] = useState(null)
  const [busqueda, setBusqueda] = useState('')

  if (!items?.length) return <div className="p-6 text-sm text-slate-400">Sin preguntas disponibles.</div>

  const filtrados = busqueda.trim()
    ? items.filter(it =>
        it.pregunta.toLowerCase().includes(busqueda.toLowerCase()) ||
        it.respuesta?.toLowerCase().includes(busqueda.toLowerCase()))
    : items

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Buscador */}
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2">
          <Search size={14} className="text-slate-400 flex-shrink-0" />
          <input value={busqueda} onChange={e => { setBusqueda(e.target.value); setAbierta(null) }}
            placeholder={`Buscar entre ${items.length} preguntas…`}
            className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400" />
          {busqueda && <button onClick={() => setBusqueda('')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>}
        </div>
        <p className="text-[11px] text-slate-400 mt-1.5 ml-1">
          {filtrados.length} {filtrados.length === 1 ? 'resultado' : 'resultados'}
        </p>
      </div>

      {/* Lista acordeón */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        <AnimatePresence>
          {filtrados.length === 0 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center text-slate-400 text-sm py-8">
              Sin resultados para "{busqueda}"
            </motion.p>
          )}
        </AnimatePresence>

        {filtrados.map((item, i) => {
          const open   = abierta === i
          const catCls = CAT_COLOR[item.categoria] || 'bg-slate-100 text-slate-600'
          return (
            <motion.div key={i} layout
              className={`border rounded-xl overflow-hidden ${open ? 'border-primary/40' : 'border-slate-200 bg-white'}`}>
              <button onClick={() => setAbierta(open ? null : i)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors ${open ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 font-extrabold text-xs transition-colors
                  ${open ? 'bg-primary text-on-primary' : 'bg-slate-100 text-slate-500'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold leading-snug ${open ? 'text-primary' : 'text-slate-800'}`}>{item.pregunta}</p>
                  {item.categoria && (
                    <span className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${catCls}`}>
                      {item.categoria}
                    </span>
                  )}
                </div>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25 }}
                  className={`material-symbols-outlined text-base flex-shrink-0 mt-0.5 ${open ? 'text-primary' : 'text-slate-300'}`}>
                  expand_more
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}>
                    <div className="px-4 pb-4 pt-2 border-t border-primary/10">
                      <p className="text-sm leading-relaxed text-slate-700">{item.respuesta}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>
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

// ── Vista Mapa Mental ─────────────────────────────────────────────────────────
const PALETA_MAPA = [
  { borde: 'border-l-blue-400',    fondo: 'bg-blue-50',    titulo: 'text-blue-700',    dot: 'bg-blue-400'    },
  { borde: 'border-l-violet-400',  fondo: 'bg-violet-50',  titulo: 'text-violet-700',  dot: 'bg-violet-400'  },
  { borde: 'border-l-emerald-400', fondo: 'bg-emerald-50', titulo: 'text-emerald-700', dot: 'bg-emerald-400' },
  { borde: 'border-l-amber-400',   fondo: 'bg-amber-50',   titulo: 'text-amber-700',   dot: 'bg-amber-400'   },
  { borde: 'border-l-rose-400',    fondo: 'bg-rose-50',    titulo: 'text-rose-700',    dot: 'bg-rose-400'    },
  { borde: 'border-l-cyan-400',    fondo: 'bg-cyan-50',    titulo: 'text-cyan-700',    dot: 'bg-cyan-400'    },
]

function MapaMentalView({ datos }) {
  if (!datos?.ramas?.length) return <div className="p-6 text-sm text-slate-400">Sin mapa disponible.</div>
  return (
    <div className="p-5 overflow-y-auto h-full space-y-4">
      {/* Nodo central */}
      <div className="flex justify-center mb-2">
        <div className="bg-primary text-on-primary font-extrabold text-sm px-6 py-3 rounded-2xl shadow-lg shadow-primary/25 text-center max-w-xs leading-snug">
          {datos.nodo_central}
        </div>
      </div>
      <div className="flex justify-center mb-3">
        <div className="w-0.5 h-5 bg-primary/30 rounded-full" />
      </div>
      {/* Ramas */}
      {datos.ramas.map((rama, i) => {
        const p = PALETA_MAPA[i % PALETA_MAPA.length]
        return (
          <div key={i} className={`border-l-4 ${p.borde} ${p.fondo} rounded-r-2xl p-4`}>
            <p className={`font-extrabold text-sm mb-3 ${p.titulo}`}>{rama.titulo}</p>
            <div className="space-y-2">
              {rama.subtemas?.map((sub, j) => (
                <div key={j} className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full ${p.dot} mt-1.5 flex-shrink-0`} />
                  <p className="text-sm text-slate-700 leading-snug">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Vista Tabla de datos (TanStack Table: sort + filter) ─────────────────────
function TablaView({ datos }) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState([])

  const columns = useMemo(() => (datos?.columnas || []).map((col, i) => ({
    id:         String(i),
    header:     col,
    accessorFn: row => row[i] ?? '',
    cell:       info => info.getValue(),
  })), [datos?.columnas])

  const tableData = useMemo(() => datos?.filas || [], [datos?.filas])

  const table = useReactTable({
    data:    tableData,
    columns,
    state:   { sorting, globalFilter },
    onSortingChange:      setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel:      getCoreRowModel(),
    getSortedRowModel:    getSortedRowModel(),
    getFilteredRowModel:  getFilteredRowModel(),
  })

  if (!datos?.columnas?.length || !datos?.filas?.length)
    return <div className="p-6 text-sm text-slate-400">Sin datos de tabla.</div>

  return (
    <div className="p-4 flex flex-col gap-3 h-full overflow-hidden">
      {datos.titulo && (
        <h3 className="font-extrabold text-base text-slate-800 flex-shrink-0">{datos.titulo}</h3>
      )}

      {/* Buscador */}
      <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 flex-shrink-0">
        <Search size={14} className="text-slate-400 flex-shrink-0" />
        <input value={globalFilter} onChange={e => setGlobalFilter(e.target.value)}
          placeholder="Buscar en la tabla…"
          className="flex-1 bg-transparent text-sm outline-none placeholder-slate-400" />
        {globalFilter && (
          <button onClick={() => setGlobalFilter('')} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
        )}
      </div>

      {/* Tabla */}
      <div className="overflow-auto rounded-xl border border-slate-200 shadow-sm flex-1">
        <table className="w-full text-sm min-w-max">
          <thead className="sticky top-0 z-10">
            <tr className="bg-primary/10">
              {table.getHeaderGroups()[0]?.headers.map(header => {
                const sorted = header.column.getIsSorted()
                return (
                  <th key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    className="text-left px-4 py-3 font-extrabold text-xs text-primary uppercase tracking-wider whitespace-nowrap border-b border-primary/20 cursor-pointer select-none hover:bg-primary/20 transition-colors">
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc'  ? <ArrowUp size={12} />   :
                       sorted === 'desc' ? <ArrowDown size={12} /> :
                       <ArrowUpDown size={11} className="opacity-30" />}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="text-center py-8 text-slate-400 text-sm">Sin resultados para "{globalFilter}"</td></tr>
            ) : table.getRowModel().rows.map((row, i) => (
              <motion.tr key={row.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`transition-colors hover:bg-primary/5 ${i % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}>
                {row.getVisibleCells().map((cell, j) => (
                  <td key={cell.id} className={`px-4 py-3 leading-snug ${j === 0 ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400 flex-shrink-0">
        {table.getRowModel().rows.length} de {tableData.length} filas
      </p>
    </div>
  )
}

// ── Vista Guía de estudio ─────────────────────────────────────────────────────
const FASE_CLS = [
  'bg-primary/10 text-primary border-primary/20',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
]

function GuiaView({ datos }) {
  if (!datos?.modulos?.length) return <div className="p-6 text-sm text-slate-400">Sin guía disponible.</div>
  return (
    <div className="p-4 overflow-y-auto h-full space-y-4">
      {datos.titulo && (
        <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-xl p-4 border border-primary/10">
          <h3 className="font-extrabold text-base text-primary">{datos.titulo}</h3>
        </div>
      )}
      {datos.modulos.map((mod, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className={`px-4 py-3 border-b ${FASE_CLS[i % FASE_CLS.length]}`}>
            <p className="font-extrabold text-sm">{mod.fase}</p>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tema</p>
              <p className="text-sm font-semibold text-slate-800">{mod.tema}</p>
            </div>
            {mod.lectura_clave && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lectura clave</p>
                <p className="text-sm text-slate-600 leading-relaxed">{mod.lectura_clave}</p>
              </div>
            )}
            {mod.objetivo && (
              <div className="flex items-start gap-2 bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <span className="material-symbols-outlined text-emerald-600 text-sm mt-0.5 flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>target</span>
                <p className="text-sm text-emerald-800 leading-relaxed">{mod.objetivo}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Vista Audio Overview ──────────────────────────────────────────────────────
const SPEEDS = [1, 1.25, 1.5, 2]

function fmtTime(s) {
  if (!isFinite(s) || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const ss = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${ss}`
}

function AudioView({ audioUrl, generando }) {
  const audioRef  = useRef(null)
  const [playing,     setPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [speedIdx,    setSpeedIdx]    = useState(0)
  const [loaded,      setLoaded]      = useState(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCurrentTime(el.currentTime)
    const onMeta = () => { setDuration(el.duration); setLoaded(true) }
    const onEnd  = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
    }
  }, [audioUrl])

  const togglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) { el.pause(); setPlaying(false) }
    else         { el.play();  setPlaying(true)  }
  }

  const restart = () => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    setCurrentTime(0)
  }

  const seek = (e) => {
    const el = audioRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    el.currentTime = pct * duration
  }

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length
    setSpeedIdx(next)
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]
  }

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0

  if (generando) return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-6 text-center">
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-3xl bg-slate-900 flex items-center justify-center">
          <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>headphones</span>
        </div>
        <div className="absolute -inset-1 rounded-[22px] border-2 border-primary border-t-transparent animate-spin opacity-60" />
      </div>
      <div>
        <p className="font-extrabold text-slate-700 text-lg">Generando podcast IA…</p>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
          Valentina y Andrés están discutiendo el material. El proceso toma entre 30 y 60 segundos.
        </p>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="material-symbols-outlined text-sm animate-pulse">mic</span> Generando voces con IA…
      </div>
    </div>
  )

  if (!audioUrl) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center text-slate-400">
      <span className="material-symbols-outlined text-5xl opacity-20">headphones</span>
      <p className="text-sm font-semibold">Toca "Audio Overview" para generar el podcast</p>
    </div>
  )

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 p-6">
      {/* Hidden native audio element */}
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Artwork pulsante */}
      <motion.div
        animate={playing ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={playing ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
        className="w-28 h-28 bg-gradient-to-br from-slate-700 to-slate-900 rounded-3xl flex items-center justify-center shadow-2xl"
      >
        <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>headphones</span>
      </motion.div>

      {/* Títulos */}
      <div className="text-center">
        <p className="font-extrabold text-xl text-slate-800">Audio Overview</p>
        <p className="text-sm text-slate-500 mt-1">Podcast generado por IA · Valentina &amp; Andrés</p>
      </div>

      {/* Player card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-slate-100 p-5 flex flex-col gap-4">
        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div
            className="h-2 bg-slate-100 rounded-full cursor-pointer relative overflow-hidden"
            onClick={seek}
          >
            <motion.div
              className="absolute left-0 top-0 h-full bg-primary rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ type: 'tween', duration: 0.1 }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 font-mono">
            <span>{fmtTime(currentTime)}</span>
            <span>{loaded ? fmtTime(duration) : '--:--'}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Restart */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={restart}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
            title="Reiniciar"
          >
            <SkipBack size={16} />
          </motion.button>

          {/* Play / Pause */}
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={togglePlay}
            className="w-14 h-14 rounded-full bg-slate-900 hover:bg-slate-700 flex items-center justify-center text-white shadow-lg transition-colors"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={playing ? 'pause' : 'play'}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1,   opacity: 1 }}
                exit={{    scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {playing ? <Pause size={22} /> : <Play size={22} className="ml-0.5" />}
              </motion.span>
            </AnimatePresence>
          </motion.button>

          {/* Speed */}
          <motion.button
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={cycleSpeed}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 text-[11px] font-extrabold transition-colors"
            title="Velocidad"
          >
            {SPEEDS[speedIdx]}x
          </motion.button>
        </div>
      </div>

      {/* Descargar */}
      <a
        href={audioUrl}
        download="audio-overview.mp3"
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary transition-colors"
      >
        <Download size={14} /> Descargar MP3
      </a>
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
  const [tourActivo,  setTourActivo]  = useState(() => !localStorage.getItem(TOUR_KEY))

  const finalizarTour = () => { localStorage.setItem(TOUR_KEY, '1'); setTourActivo(false) }

  // Fuentes
  const [fuentes,      setFuentes]      = useState([])
  const [subiendo,     setSubiendo]     = useState(false)
  const [errorSubida,  setErrorSubida]  = useState('')
  const [ytUrl,        setYtUrl]        = useState('')
  const [agregandoYt,  setAgregandoYt]  = useState(false)
  const [modalFuente,  setModalFuente]  = useState(null)
  const fileRef = useRef(null)

  // Chat
  const [mensajes,    setMensajes]    = useState([])
  const [input,       setInput]       = useState('')
  const [enviando,    setEnviando]    = useState(false)
  const [guardandoMsg,setGuardandoMsg]= useState(null)
  const [tokensUsados, setTokensUsados] = useState(0)
  const [tokensLimite, setTokensLimite] = useState(2_000_000)
  const [chatErr,     setChatErr]     = useState('')
  const bottomRef = useRef(null)

  // Vista activa (chat | resumen | quiz | flashcards | plan | faq | cronologia | audio)
  const [vista,       setVista]       = useState('chat')
  const [vistaData,   setVistaData]   = useState(null)
  const [generando,   setGenerando]   = useState(null)
  const [audioUrl,    setAudioUrl]    = useState(null)

  // Notas
  const [notas,       setNotas]       = useState([])
  const [nuevaNota,   setNuevaNota]   = useState('')
  const [addingNota,  setAddingNota]  = useState(false)
  const [expandidas,  setExpandidas]  = useState({})
  const [errorNota,   setErrorNota]   = useState(null)   // null | { msg, notaId }

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

    const tokRes = await fetch(`${BASE}/api/cuaderno/${packageId}/tokens`, { headers: h })
    if (tokRes.ok) {
      const td = await tokRes.json()
      setTokensUsados(td.tokensUsados || 0)
      setTokensLimite(td.tokensLimite || 2_000_000)
    }
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
      if (data.tokensUsados !== undefined) setTokensUsados(data.tokensUsados)
      if (data.tokensLimite !== undefined) setTokensLimite(data.tokensLimite)
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

    if (tipo === 'audio') {
      try {
        const h = await hdrs()
        const res  = await fetch(`${BASE}/api/cuaderno/${packageId}/audio-overview`, { method: 'POST', headers: h })
        const data = await res.json()
        if (res.ok) {
          setAudioUrl(data.audioUrl)
          if (data.nota) setNotas(prev => [data.nota, ...prev])
        }
      } catch {}
      finally { setGenerando(null) }
      return
    }

    try {
      const h = await hdrs()
      const res  = await fetch(`${BASE}/api/cuaderno/${packageId}/generar`, {
        method: 'POST', headers: h, body: JSON.stringify({ tipo }),
      })
      const data = await res.json()
      if (res.ok) {
        setVistaData(normalizarDatos(tipo, data.datos))
        if (data.nota) setNotas(prev => [data.nota, ...prev])
      }
    } catch { setVistaData(null) }
    finally { setGenerando(null) }
  }

  // ── Subir PDF ──
  async function subirPDF(file) {
    if (!file) return
    setSubiendo(true); setErrorSubida('')
    const form = new FormData(); form.append('pdf', file)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token || ''
    try {
      const res = await fetch(`${BASE}/api/cuaderno/${packageId}/fuentes`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (res.ok) {
        setFuentes(prev => [...prev, data.fuente])
      } else {
        setErrorSubida(data.error || 'Error al subir el archivo.')
        setTimeout(() => setErrorSubida(''), 6000)
      }
    } catch {
      setErrorSubida('Error de conexión al subir el archivo.')
      setTimeout(() => setErrorSubida(''), 6000)
    }
    setSubiendo(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function agregarYoutube() {
    if (!ytUrl.trim()) return
    setAgregandoYt(true); setErrorSubida('')
    try {
      const h = await hdrs()
      const res = await fetch(`${BASE}/api/cuaderno/${packageId}/fuentes/youtube`, {
        method: 'POST', headers: h, body: JSON.stringify({ url: ytUrl.trim() }),
      })
      const data = await res.json()
      if (res.ok) { setFuentes(prev => [...prev, data.fuente]); setYtUrl('') }
      else { setErrorSubida(data.error || 'Error al agregar el video.'); setTimeout(() => setErrorSubida(''), 6000) }
    } catch { setErrorSubida('Error de conexión.'); setTimeout(() => setErrorSubida(''), 6000) }
    setAgregandoYt(false)
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

  // ── Helpers para notas de artefactos ──
  const ARTIFACT_TIPOS = new Set(['quiz','flashcards','plan','faq','cronologia','resumen','mapa_mental','tabla','guia','audio'])

  function normalizarDatos(tipo, datos) {
    const ARRAY_TIPOS = new Set(['quiz','flashcards','plan','faq','cronologia'])
    if (!ARRAY_TIPOS.has(tipo)) return datos
    if (Array.isArray(datos)) return datos
    if (datos && typeof datos === 'object') {
      const arr = Object.values(datos).find(v => Array.isArray(v))
      return arr || datos
    }
    return datos
  }

  // Parse robusto: limpia code fences de markdown + intento de rescate si JSON está parcialmente roto
  function limpiarYParsear(str) {
    if (typeof str !== 'string') return str
    let s = str.trim()
    s = s.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim()
    try { return JSON.parse(s) } catch {}
    const m = s.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (m) return JSON.parse(m[1])
    throw new SyntaxError('JSON inválido en artefacto')
  }

  function getArtefactoResumen(nota) {
    try {
      if (nota.fuente === 'audio')       return 'Podcast · Valentina & Andrés'
      const d = limpiarYParsear(nota.contenido)
      const nd = normalizarDatos(nota.fuente, d)
      if (nota.fuente === 'resumen')     return `${nd?.ejes?.length || '?'} ejes temáticos · glosario · puntos críticos`
      if (nota.fuente === 'quiz')        return `${Array.isArray(nd) ? nd.length : '?'} preguntas de práctica`
      if (nota.fuente === 'flashcards')  return `${Array.isArray(nd) ? nd.length : '?'} tarjetas de memoria`
      if (nota.fuente === 'plan')        return `${Array.isArray(nd) ? nd.length : '?'} semanas de estudio`
      if (nota.fuente === 'faq')         return `${Array.isArray(nd) ? nd.length : '?'} preguntas frecuentes`
      if (nota.fuente === 'cronologia')  return `${Array.isArray(nd) ? nd.length : '?'} hitos del proceso`
      if (nota.fuente === 'mapa_mental') return `${nd?.ramas?.length || '?'} ramas temáticas`
      if (nota.fuente === 'tabla')       return `Tabla con ${nd?.filas?.length || '?'} filas`
      if (nota.fuente === 'guia')        return `${nd?.modulos?.length || '?'} módulos de estudio`
    } catch {}
    return 'Artefacto generado por IA'
  }

  function abrirArtefactoDesdeNota(nota) {
    try {
      if (nota.fuente === 'audio') {
        setAudioUrl(nota.contenido)
        setVista('audio')
        setTabMobile('chat')
        return
      }
      let datos = limpiarYParsear(nota.contenido)
      datos = normalizarDatos(nota.fuente, datos)
      setVistaData(datos)
      setVista(nota.fuente)
      setTabMobile('chat')
      setErrorNota(null)
    } catch (e) {
      console.warn('[abrirArtefacto] JSON inválido en nota guardada:', e.message)
      setErrorNota({ msg: 'Este artefacto quedó dañado. Elimínalo y genera uno nuevo.', notaId: nota.id })
    }
  }

  function descargarArtefacto(nota) {
    if (nota.fuente === 'audio') {
      window.open(nota.contenido, '_blank')
      return
    }
    let texto = nota.contenido
    if (nota.fuente !== 'resumen') {
      try {
        const d = normalizarDatos(nota.fuente, limpiarYParsear(nota.contenido))
        if (nota.fuente === 'quiz' && Array.isArray(d))
          texto = d.map((q, i) => `Pregunta ${q.n || i+1}: ${q.pregunta}\nA) ${q.opciones?.A}\nB) ${q.opciones?.B}\nC) ${q.opciones?.C}\nD) ${q.opciones?.D}\nRespuesta: ${q.correcta}\nJustificación: ${q.justificacion}`).join('\n\n')
        else if (nota.fuente === 'flashcards' && Array.isArray(d))
          texto = d.map((c, i) => `[${i+1}] ${c.frente}\n→ ${c.reverso}`).join('\n\n')
        else if (nota.fuente === 'faq' && Array.isArray(d))
          texto = d.map((f, i) => `${i+1}. ${f.pregunta}\n${f.respuesta}`).join('\n\n')
        else if (nota.fuente === 'cronologia' && Array.isArray(d))
          texto = d.map(h => `${h.orden}. ${h.hito}\n${h.descripcion}${h.norma ? '\nNorma: ' + h.norma : ''}`).join('\n\n')
        else if (nota.fuente === 'plan' && Array.isArray(d))
          texto = d.map(s => `SEMANA ${s.semana}: ${s.titulo}\n${s.dias?.map(dd => `  ${dd.dia}: ${dd.tarea} (${dd.horas})`).join('\n')}`).join('\n\n')
        else if (nota.fuente === 'mapa_mental' && d?.ramas)
          texto = `${d.nodo_central}\n${d.ramas.map(r => `\n▶ ${r.titulo}\n${r.subtemas?.map(s => `  • ${s}`).join('\n')}`).join('')}`
        else if (nota.fuente === 'tabla' && d?.filas) {
          const header = (d.columnas || []).join('\t')
          texto = [d.titulo || '', header, ...(d.filas || []).map(f => f.join('\t'))].filter(Boolean).join('\n')
        } else if (nota.fuente === 'guia' && d?.modulos)
          texto = `${d.titulo || 'Guía de estudio'}\n\n${d.modulos.map(m => `${m.fase}\nTema: ${m.tema}\nLectura: ${m.lectura_clave}\nObjetivo: ${m.objetivo}`).join('\n\n')}`
        else
          texto = JSON.stringify(d, null, 2)
      } catch {}
    }
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' })),
      download: `praxia-${nota.fuente}.txt`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const agotado = tokensUsados >= tokensLimite
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

    // Función inline para asegurar array aunque vistaData sea un objeto wrapper
    const toArr = (tipo, d) => {
      if (!d) return []
      const n = normalizarDatos(tipo, d)
      return Array.isArray(n) ? n : []
    }

    if (vista === 'resumen'    && vistaData)  return <ResumenView    datos={vistaData} />
    if (vista === 'quiz'       && vistaData)  return <QuizView       preguntas={toArr('quiz',       vistaData)} />
    if (vista === 'flashcards' && vistaData)  return <FlashcardsView cards={toArr('flashcards',    vistaData)} />
    if (vista === 'plan'       && vistaData)  return <PlanView       semanas={toArr('plan',         vistaData)} packageId={packageId} />
    if (vista === 'faq'        && vistaData)  return <FaqView        items={toArr('faq',            vistaData)} />
    if (vista === 'cronologia' && vistaData)  return <CronologiaView hitos={toArr('cronologia',     vistaData)} />
    if (vista === 'mapa_mental'&& vistaData)  return <MapaMentalView datos={vistaData} />
    if (vista === 'tabla'      && vistaData)  return <TablaView      datos={vistaData} />
    if (vista === 'guia'       && vistaData)  return <GuiaView       datos={vistaData} />
    if (vista === 'audio') return <AudioView audioUrl={audioUrl} generando={generando === 'audio'} />

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
        <div data-tour="chat-input" className="p-4 bg-white border-t border-slate-200 flex-shrink-0">
          {agotado ? (
            <div className="p-3 bg-error/10 text-error text-sm font-semibold rounded-xl text-center space-y-1">
              <p>Agotaste tus 2M tokens este mes.</p>
              <p className="text-xs font-normal">Se renuevan el 1 del próximo mes o recarga tokens.</p>
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
        <div data-tour="token-counter" className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full
          ${tokensUsados >= tokensLimite * 0.8 ? 'bg-error/10 text-error' : 'bg-slate-100 text-slate-500'}`}>
          <span className="material-symbols-outlined text-xs">token</span>
          {tokensUsados >= 1_000_000 ? `${(tokensUsados/1_000_000).toFixed(1)}M` : `${Math.round(tokensUsados/1000)}K`}/{(tokensLimite/1_000_000).toFixed(0)}M
        </div>
        <button onClick={() => { localStorage.removeItem(TOUR_KEY); setTourActivo(true) }} title="Ver tutorial"
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0 font-extrabold text-sm">
          ?
        </button>
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
          <div data-tour="fuentes-admin" className="p-3 border-b border-slate-100">
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
          <div data-tour="mis-docs" className="p-3 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <span className="material-symbols-outlined text-xs">upload_file</span>Mis documentos
            </p>
            <div className="space-y-1">
              {fuentesUser.map(f => (
                <div key={f.id} className="flex items-center gap-1.5">
                  <button onClick={() => setModalFuente(f)}
                    className="flex-1 flex items-center gap-2 text-xs bg-slate-50 hover:bg-primary/5 rounded-lg px-2.5 py-1.5 transition-colors text-left">
                    <span className={`material-symbols-outlined text-sm flex-shrink-0 ${f.tipo === 'youtube' ? 'text-red-500' : 'text-blue-500'}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}>
                      {f.tipo === 'youtube' ? 'smart_display' : 'description'}
                    </span>
                    <span className="truncate">{f.nombre}</span>
                  </button>
                  <button onClick={() => eliminarFuente(f.id)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-error/10 text-slate-300 hover:text-error transition-colors flex-shrink-0">
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" className="hidden"
              onChange={e => e.target.files?.[0] && subirPDF(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={subiendo}
              className="mt-2 w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-primary/10 hover:text-primary
                         text-slate-500 font-bold text-[11px] py-2 rounded-xl transition-all disabled:opacity-50 border-2 border-dashed border-slate-200">
              {subiendo
                ? <><div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />Subiendo…</>
                : <><span className="material-symbols-outlined text-xs">upload</span>Subir archivo</>
              }
            </button>
            {/* YouTube URL */}
            <div className="mt-2 flex gap-1">
              <div className="flex-1 flex items-center gap-1.5 bg-slate-100 rounded-xl px-2.5 py-1.5 border border-transparent focus-within:border-red-400 transition-colors">
                <span className="material-symbols-outlined text-red-500 text-sm flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>smart_display</span>
                <input value={ytUrl} onChange={e => setYtUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && agregarYoutube()}
                  placeholder="Pega un link de YouTube…"
                  className="flex-1 bg-transparent text-[11px] outline-none min-w-0" />
              </div>
              <button onClick={agregarYoutube} disabled={!ytUrl.trim() || agregandoYt}
                className="w-8 h-8 flex items-center justify-center bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-40 flex-shrink-0">
                {agregandoYt
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
                }
              </button>
            </div>

            {errorSubida && (
              <div className="mt-1.5 bg-error/10 border border-error/20 rounded-xl px-3 py-2 flex items-start gap-2">
                <span className="material-symbols-outlined text-error text-xs mt-0.5 flex-shrink-0">error</span>
                <p className="text-[10px] text-error leading-snug">{errorSubida}</p>
              </div>
            )}
          </div>

          {/* Generar */}
          <div data-tour="generar-ia" className="p-3 flex-1">
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
        <aside data-tour="panel-notas" className={`flex flex-col w-full lg:w-72 border-l border-slate-200 bg-white overflow-hidden
          ${tabMobile !== 'notas' ? 'hidden lg:flex' : ''}`}>

          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
            <span className="material-symbols-outlined text-base text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>sticky_note_2</span>
            <p className="font-bold text-sm flex-1">Mis notas</p>
            {notas.length > 0 && (
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">{notas.length}</span>
            )}
          </div>

          {/* Error artefacto dañado */}
          <AnimatePresence>
            {errorNota && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="px-3 py-2.5 bg-red-50 border-b border-red-100 flex flex-col gap-2"
              >
                <div className="flex items-start gap-2 text-[11px] text-red-700">
                  <span className="material-symbols-outlined text-sm flex-shrink-0 mt-0.5">error</span>
                  <span className="flex-1">{errorNota.msg}</span>
                  <button onClick={() => setErrorNota(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                {errorNota.notaId && (
                  <button
                    onClick={() => { borrarNota(errorNota.notaId); setErrorNota(null) }}
                    className="w-full flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold py-1.5 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                    Eliminar nota dañada
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

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
              const meta       = FUENTE_META[nota.fuente] || FUENTE_META.manual
              const esArtef    = ARTIFACT_TIPOS.has(nota.fuente)
              const exp        = !!expandidas[nota.id]
              return (
                <div key={nota.id} className={`bg-white border rounded-xl overflow-hidden transition-all ${nota.fijada ? 'border-primary/30' : 'border-slate-200'}`}>
                  {/* ── Cabecera ── */}
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
                    {!esArtef && (
                      <>
                        <button onClick={() => setInput(nota.contenido.slice(0, 300))} title="Usar en chat"
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-primary hover:bg-slate-100 transition-colors">
                          <span className="material-symbols-outlined text-xs">reply</span>
                        </button>
                        <button onClick={() => setExpandidas(p => ({ ...p, [nota.id]: !p[nota.id] }))}
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:bg-slate-100 transition-colors">
                          <span className="material-symbols-outlined text-xs">{exp ? 'expand_less' : 'expand_more'}</span>
                        </button>
                      </>
                    )}
                    <button onClick={() => borrarNota(nota.id)}
                      className="w-6 h-6 flex items-center justify-center rounded-lg text-slate-300 hover:text-error hover:bg-error/10 transition-colors">
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>

                  {/* ── Cuerpo ── */}
                  {esArtef ? (
                    <div className="px-3 py-3 space-y-2">
                      <p className="text-[11px] text-slate-500">{getArtefactoResumen(nota)}</p>
                      <div className="flex gap-1.5">
                        <button onClick={() => abrirArtefactoDesdeNota(nota)}
                          className="flex-1 flex items-center justify-center gap-1 bg-primary/10 text-primary font-bold text-[11px] py-2 rounded-lg hover:bg-primary/20 transition-colors">
                          <span className="material-symbols-outlined text-xs">open_in_new</span>Abrir
                        </button>
                        <button onClick={() => descargarArtefacto(nota)} title="Descargar como .txt"
                          className="flex items-center gap-1 bg-slate-100 text-slate-600 font-bold text-[11px] px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors">
                          <span className="material-symbols-outlined text-xs">download</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className={`px-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-700 transition-all overflow-hidden
                      ${exp ? 'py-3 max-h-96' : 'py-2 max-h-14 line-clamp-3'}`}>
                      {nota.contenido}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </aside>
      </div>

      {/* ── Modal visor de fuente ── */}
      <ModalFuente fuente={modalFuente} onClose={() => setModalFuente(null)} />

      {/* ── Tour de bienvenida ── */}
      {tourActivo && <TourCuaderno onDone={finalizarTour} />}
    </div>
  )
}
