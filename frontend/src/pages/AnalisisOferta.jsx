import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL || ''
const MAX_ARCHIVOS = 5
const MAX_OPECS    = 8
const ACCEPTED     = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp'

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function safeStr(v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    const s = v.texto || v.value || v.nombre || JSON.stringify(v)
    return typeof s === 'string' ? s : JSON.stringify(v)
  }
  return String(v)
}

function Semaforo({ color, pct }) {
  const map = {
    verde:    { stroke: 'stroke-emerald-500', text: 'text-emerald-700', label: 'Aplica' },
    amarillo: { stroke: 'stroke-amber-400',   text: 'text-amber-700',   label: 'Aplica con brechas' },
    rojo:     { stroke: 'stroke-red-500',     text: 'text-red-700',     label: 'No aplica' },
  }
  const c = map[color] || map.rojo
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14 flex-shrink-0">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-container" />
          <circle cx="28" cy="28" r="22" fill="none" strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - (pct || 0) / 100)}`}
            className={c.stroke} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-on-surface">{pct}%</span>
      </div>
      <div>
        <p className={`text-sm font-black ${c.text}`}>{c.label}</p>
        <p className="text-xs text-on-surface-variant mt-0.5">compatibilidad</p>
      </div>
    </div>
  )
}

function OfertaCard({ oferta, idx }) {
  const [open, setOpen] = useState(idx === 0)
  const sem = oferta.semaforo || (oferta.porcentaje_compatibilidad >= 70 ? 'verde' : oferta.porcentaje_compatibilidad >= 40 ? 'amarillo' : 'rojo')
  const colorMap    = { verde: 'border-emerald-300 bg-emerald-50/40', amarillo: 'border-amber-300 bg-amber-50/40', rojo: 'border-red-300 bg-red-50/40' }
  const headerColor = { verde: 'bg-emerald-50', amarillo: 'bg-amber-50', rojo: 'bg-red-50' }
  const fuenteBadge = oferta._fuente === 'bd' ? 'BD Praxia' : oferta._archivo ? 'Archivo' : null

  return (
    <div className={`rounded-2xl border overflow-hidden ${colorMap[sem] || colorMap.rojo}`}>
      <button onClick={() => setOpen(o => !o)} className={`w-full flex items-center gap-4 px-5 py-4 text-left ${headerColor[sem] || headerColor.rojo} hover:brightness-95 transition-all`}>
        <div className="flex-shrink-0"><Semaforo color={sem} pct={oferta.porcentaje_compatibilidad || 0} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-black text-on-surface text-base truncate">{safeStr(oferta.cargo_titulo) || `Oferta ${idx + 1}`}</p>
            {fuenteBadge && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${oferta._fuente === 'bd' ? 'bg-primary/10 text-primary' : 'bg-slate-200 text-slate-600'}`}>
                {fuenteBadge}
              </span>
            )}
          </div>
          <p className="text-sm text-on-surface-variant truncate">{safeStr(oferta.empresa) || 'Entidad no identificada'}{oferta.modalidad ? ` · ${safeStr(oferta.modalidad)}` : ''}{oferta.salario_estimado ? ` · ${safeStr(oferta.salario_estimado)}` : ''}</p>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {open && (
        <div className="px-5 py-4 space-y-5">
          {oferta.resumen_ejecutivo && <p className="text-sm text-on-surface leading-relaxed">{safeStr(oferta.resumen_ejecutivo)}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.isArray(oferta.puntos_fuertes) && oferta.puntos_fuertes.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-700">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Puntos fuertes
                </h4>
                <ul className="space-y-1.5">{oferta.puntos_fuertes.map((p, i) => <li key={i} className="flex items-start gap-2 text-sm text-on-surface"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />{safeStr(p)}</li>)}</ul>
              </div>
            )}
            {Array.isArray(oferta.brechas) && oferta.brechas.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-red-700">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>Brechas detectadas
                </h4>
                <ul className="space-y-1.5">{oferta.brechas.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm text-on-surface"><span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />{safeStr(b)}</li>)}</ul>
              </div>
            )}
            {Array.isArray(oferta.requisitos_criticos_cumplidos) && oferta.requisitos_criticos_cumplidos.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-primary">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>Requisitos que cumples
                </h4>
                <ul className="space-y-1.5">{oferta.requisitos_criticos_cumplidos.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-on-surface"><span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />{safeStr(r)}</li>)}</ul>
              </div>
            )}
            {Array.isArray(oferta.requisitos_criticos_faltantes) && oferta.requisitos_criticos_faltantes.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-700">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>Requisitos que te faltan
                </h4>
                <ul className="space-y-1.5">{oferta.requisitos_criticos_faltantes.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-on-surface"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />{safeStr(r)}</li>)}</ul>
              </div>
            )}
          </div>
          {oferta.recomendacion && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/15">
              <span className="material-symbols-outlined text-primary flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              <div>
                <p className="text-xs font-black text-primary uppercase tracking-wide mb-1">Recomendación</p>
                <p className="text-sm text-on-surface leading-relaxed">{safeStr(oferta.recomendacion)}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal detalle de un OPEC ────────────────────────────────────────────────
function ModalOpec({ opec, onClose, onAdd, yaAgregado }) {
  if (!opec) return null
  const ciudades = Array.isArray(opec.ubicaciones) ? opec.ubicaciones.map(u => u.ciudad).filter(Boolean).join(', ') : ''
  const funciones = Array.isArray(opec.funciones) ? opec.funciones.slice(0, 10) : []
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface rounded-3xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sticky top-0 bg-surface rounded-t-3xl px-6 pt-5 pb-4 border-b border-outline-variant/20 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-primary uppercase tracking-wide mb-1">
              {opec.numero_opec ? `OPEC ${opec.numero_opec}` : 'Detalle del cargo'}
            </p>
            <h3 className="text-lg font-black text-on-surface leading-snug">{opec.denominacion}</h3>
            {opec.entidad && <p className="text-sm text-on-surface-variant mt-0.5">{opec.entidad}</p>}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant flex-shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Cuerpo */}
        <div className="px-6 py-4 space-y-4">
          {/* Datos rápidos */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: 'work', label: 'Nivel', value: opec.nivel },
              { icon: 'payments', label: 'Salario', value: opec.salario ? `$${Number(opec.salario).toLocaleString('es-CO')}` : null },
              { icon: 'people', label: 'Vacantes', value: opec.vacantes },
              { icon: 'location_on', label: 'Ciudad(es)', value: ciudades },
              { icon: 'code', label: 'Código', value: opec.codigo || opec.numero_opec },
              { icon: 'domain', label: 'Dependencia', value: opec.dependencia },
            ].filter(d => d.value).map(d => (
              <div key={d.label} className="bg-surface-container rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant" style={{ fontVariationSettings: "'FILL' 1" }}>{d.icon}</span>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wide">{d.label}</p>
                </div>
                <p className="text-sm font-semibold text-on-surface leading-snug">{safeStr(d.value)}</p>
              </div>
            ))}
          </div>

          {opec.estudio_texto && (
            <div>
              <p className="text-xs font-black text-on-surface-variant uppercase tracking-wide mb-2">Requisitos de estudio</p>
              <p className="text-sm text-on-surface leading-relaxed bg-surface-container rounded-xl p-3">{opec.estudio_texto}</p>
            </div>
          )}

          {opec.exp_texto && (
            <div>
              <p className="text-xs font-black text-on-surface-variant uppercase tracking-wide mb-2">Experiencia requerida</p>
              <p className="text-sm text-on-surface leading-relaxed bg-surface-container rounded-xl p-3">{opec.exp_texto}{opec.exp_anios ? ` (${opec.exp_anios} meses)` : ''}</p>
            </div>
          )}

          {funciones.length > 0 && (
            <div>
              <p className="text-xs font-black text-on-surface-variant uppercase tracking-wide mb-2">Funciones principales</p>
              <ul className="space-y-1.5">
                {funciones.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    {safeStr(f)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(opec.conocimientos) && opec.conocimientos.length > 0 && (
            <div>
              <p className="text-xs font-black text-on-surface-variant uppercase tracking-wide mb-2">Conocimientos requeridos</p>
              <div className="flex flex-wrap gap-1.5">
                {opec.conocimientos.map((c, i) => (
                  <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">{safeStr(c)}</span>
                ))}
              </div>
            </div>
          )}

          {(opec.requiere_posgrado || opec.requiere_tarjeta) && (
            <div className="flex gap-2 flex-wrap">
              {opec.requiere_posgrado && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">Requiere posgrado</span>}
              {opec.requiere_tarjeta  && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">Requiere tarjeta profesional</span>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface rounded-b-3xl px-6 pb-5 pt-4 border-t border-outline-variant/20">
          {yaAgregado ? (
            <div className="flex items-center gap-2 justify-center py-3 text-emerald-700 font-bold text-sm">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Ya está en tu lista
            </div>
          ) : (
            <button onClick={() => { onAdd(opec); onClose() }} className="w-full py-3 rounded-2xl bg-primary text-on-primary font-black text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
              Añadir al análisis
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AnalisisOferta() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  // Archivos
  const [cvFile, setCvFile]           = useState(null)
  const [ofertaFiles, setOfertaFiles] = useState([])
  const [cvWarning, setCvWarning]     = useState(null)
  const [ofertaWarning, setOfertaWarning] = useState(null)

  // Modo de las ofertas: 'archivo' | 'bd'
  const [modoOfertas, setModoOfertas] = useState('archivo')

  // BD: convocatorias y búsqueda
  const [convocatorias, setConvocatorias]     = useState([])
  const [convId, setConvId]                   = useState('')
  const [query, setQuery]                     = useState('')
  const [buscando, setBuscando]               = useState(false)
  const [resultados, setResultados]           = useState([])
  const [opecSeleccionados, setOpecSeleccionados] = useState([]) // OPECs añadidos
  const [opecModal, setOpecModal]             = useState(null)   // OPEC en modal

  // Análisis
  const [analizando, setAnalizando]   = useState(false)
  const [progreso, setProgreso]       = useState(null)
  const [error, setError]             = useState(null)
  const [resultado, setResultado]     = useState(null)

  // Tickets y Wompi
  const [ticketBalance, setTicketBalance] = useState(null)
  const [precioCop, setPrecioCop]         = useState(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [pagoBanner, setPagoBanner]           = useState(null)

  // Confirmación
  const [showConfirm, setShowConfirm] = useState(false)

  const cvInputRef     = useRef(null)
  const ofertaInputRef = useRef(null)
  const analizandoRef  = useRef(false)
  const debounceRef    = useRef(null)

  // Retorno Wompi
  useEffect(() => {
    if (searchParams.get('id')) {
      setPagoBanner('verificando')
      let i = 0
      const poll = setInterval(async () => {
        i++; await fetchTickets()
        if (i >= 5) { clearInterval(poll); setPagoBanner(null) }
      }, 5000)
    }
  }, [])

  useEffect(() => { fetchTickets(); fetchPrecio(); fetchConvocatorias() }, [])

  async function fetchTickets() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/oferta/tickets/balance`, { headers: h })
      if (r.ok) { const d = await r.json(); setTicketBalance(d.balance ?? 0); if (d.balance > 0) setPagoBanner('ok') }
    } catch { setTicketBalance(0) }
  }

  async function fetchPrecio() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/oferta/tickets/precio`, { headers: h })
      if (r.ok) { const d = await r.json(); setPrecioCop(d.precio_cop || null) }
    } catch { /* */ }
  }

  async function fetchConvocatorias() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/convocatorias`, { headers: h })
      if (r.ok) { const d = await r.json(); setConvocatorias(d.convocatorias || d || []) }
    } catch { /* */ }
  }

  // Buscar OPECs con debounce
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!convId) { setResultados([]); return }
    debounceRef.current = setTimeout(() => buscarOpecs(), 400)
  }, [query, convId])

  async function buscarOpecs() {
    setBuscando(true)
    try {
      const h = await authHeaders()
      const params = new URLSearchParams({ convocatoria_id: convId, limit: 15 })
      if (query.trim()) params.set('q', query.trim())
      const r = await fetch(`${BASE}/api/ia/oferta/buscar-opecs?${params}`, { headers: h })
      if (r.ok) { const d = await r.json(); setResultados(d.opecs || []) }
    } catch { /* */ }
    finally { setBuscando(false) }
  }

  function agregarOpec(opec) {
    if (opecSeleccionados.find(o => o.id === opec.id)) return
    if (opecSeleccionados.length >= MAX_OPECS) return
    setOpecSeleccionados(prev => [...prev, opec])
  }

  function quitarOpec(id) { setOpecSeleccionados(prev => prev.filter(o => o.id !== id)) }

  // Archivos
  function onCvChange(e) {
    const f = e.target.files?.[0]; if (!f) return
    setCvWarning(f.size > 15 * 1024 * 1024 ? 'El archivo es mayor a 15 MB. Puede tardar más.' : null)
    setCvFile(f); e.target.value = ''
  }
  function onOfertasChange(e) {
    const nuevos = Array.from(e.target.files || [])
    setOfertaFiles(prev => {
      const combined = [...prev, ...nuevos].slice(0, MAX_ARCHIVOS)
      setOfertaWarning(combined.length >= MAX_ARCHIVOS ? `Máximo ${MAX_ARCHIVOS} archivos.` : null)
      return combined
    }); e.target.value = ''
  }
  function removeCv()          { setCvFile(null); setCvWarning(null) }
  function removeOferta(idx)   { setOfertaFiles(prev => prev.filter((_, i) => i !== idx)); setOfertaWarning(null) }
  const formatBytes = b => b < 1024*1024 ? `${Math.round(b/1024)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`

  // Total de ofertas a analizar
  const totalOfertas = ofertaFiles.length + opecSeleccionados.length

  function solicitarAnalisis() {
    if (analizandoRef.current || analizando) return
    if (!cvFile) { setError('Debes subir tu hoja de vida.'); return }
    if (totalOfertas === 0) { setError('Debes añadir al menos una oferta (archivo o OPEC de BD).'); return }
    setError(null)
    if (ticketBalance !== null && ticketBalance < 1) { setError('No tienes tickets disponibles. Compra uno para continuar.'); return }
    setShowConfirm(true)
  }

  async function iniciarCheckout() {
    setLoadingCheckout(true)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/oferta/tickets/checkout`, { method: 'POST', headers: h })
      if (!r.ok) { const d = await r.json(); setError(d.error || 'Error al generar el pago.'); return }
      const d = await r.json()
      if (d.url) window.location.href = d.url
    } catch (e) { setError(e.message) }
    finally { setLoadingCheckout(false) }
  }

  const runAnalysis = useCallback(async () => {
    if (analizandoRef.current) return
    analizandoRef.current = true
    setAnalizando(true); setShowConfirm(false); setError(null); setProgreso(null); setResultado(null)

    const jobId = crypto.randomUUID()
    const sseUrl = `${BASE}/api/ia/analisis-oferta/progreso/${jobId}`
    let evtSource = null, resolveResult, rejectResult

    const resultPromise = new Promise((resolve, reject) => {
      let tId
      resolveResult = v => { clearTimeout(tId); resolve(v) }
      rejectResult  = e => { clearTimeout(tId); reject(e) }
      tId = setTimeout(() => reject(new Error('El análisis tardó demasiado. Intenta de nuevo.')), 10 * 60 * 1000)
    })

    evtSource = new EventSource(sseUrl)
    evtSource.addEventListener('progreso', e => { try { setProgreso(JSON.parse(e.data)) } catch {} })
    evtSource.addEventListener('listo', e => {
      try { resolveResult?.(e.data ? JSON.parse(e.data) : {}) } catch { resolveResult?.({}) }
      evtSource?.close()
    })
    evtSource.addEventListener('error', e => {
      if (e.data) { try { const d = JSON.parse(e.data); if (d.mensaje) { rejectResult?.(new Error(d.mensaje)); evtSource?.close(); return } } catch {} }
      rejectResult?.(new Error('Se perdió la conexión. Verifica tu conexión e intenta de nuevo.'))
      evtSource?.close()
    })

    try {
      const h = await authHeaders()
      const form = new FormData()
      form.append('cv', cvFile)
      form.append('jobId', jobId)
      ofertaFiles.forEach(f => form.append('ofertas', f))
      if (opecSeleccionados.length > 0) {
        form.append('opec_ids', JSON.stringify(opecSeleccionados.map(o => o.id)))
      }

      const r = await fetch(`${BASE}/api/ia/analisis-oferta`, { method: 'POST', headers: h, body: form })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.tickets_agotados ? 'Sin tickets. Compra un ticket para continuar.' : d.error || 'Error al iniciar el análisis.')
        evtSource?.close(); analizandoRef.current = false; setAnalizando(false); return
      }

      const data = await resultPromise
      if (data?.analisis) { setResultado(data.analisis); await fetchTickets() }
      else setError('El análisis no devolvió resultados. Intenta de nuevo.')
    } catch (e) {
      evtSource?.close()
      setError(e.message || 'Error inesperado.')
    } finally {
      analizandoRef.current = false; setAnalizando(false); setProgreso(null)
    }
  }, [cvFile, ofertaFiles, opecSeleccionados])

  const ofertasAptas   = resultado?.ofertas?.filter(o => o.aplica) || []
  const ofertasNoAptas = resultado?.ofertas?.filter(o => !o.aplica) || []
  const maxPct         = resultado?.ofertas?.length ? Math.max(...resultado.ofertas.map(o => o.porcentaje_compatibilidad || 0)) : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Banners Wompi */}
        {pagoBanner === 'verificando' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold">
            <span className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            Verificando tu pago...
          </div>
        )}
        {pagoBanner === 'ok' && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">
            <span className="material-symbols-outlined text-emerald-600" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            ¡Pago exitoso! Ya puedes usar tu ticket.
          </div>
        )}

        {/* Encabezado */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-600/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-teal-600 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>work_history</span>
          </div>
          <div>
            <h1 className="text-xl font-black text-on-surface">Análisis de Oferta de Trabajo</h1>
            <p className="text-sm text-on-surface-variant">Compara tu hoja de vida con las ofertas que te interesan</p>
          </div>
        </div>

        {/* Ticket balance + Wompi */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/15">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
            <div>
              <p className="text-sm font-bold text-on-surface">
                {ticketBalance === null ? 'Cargando...' : ticketBalance === 0 ? 'Sin tickets disponibles' : `${ticketBalance} ticket${ticketBalance !== 1 ? 's' : ''} disponible${ticketBalance !== 1 ? 's' : ''}`}
              </p>
              <p className="text-xs text-on-surface-variant">1 ticket = 1 análisis completo</p>
            </div>
          </div>
          {ticketBalance === 0 && (
            <button onClick={iniciarCheckout} disabled={loadingCheckout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D4A1] text-white text-sm font-black shadow hover:bg-[#00b990] transition-colors disabled:opacity-50">
              {loadingCheckout
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>shopping_cart</span>}
              {precioCop ? `Comprar · $${precioCop.toLocaleString('es-CO')} COP` : 'Comprar ticket'}
            </button>
          )}
        </div>

        {!resultado && (
          <div className="space-y-5">
            {/* Upload HV */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5">
              <h3 className="font-bold text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                Tu hoja de vida
              </h3>
              {!cvFile ? (
                <>
                  <input ref={cvInputRef} type="file" accept={ACCEPTED} onChange={onCvChange} className="hidden" />
                  <button onClick={() => cvInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-outline-variant/40 rounded-2xl py-8 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                    <p className="text-sm font-semibold text-on-surface">Haz clic para subir tu HV</p>
                    <p className="text-xs text-on-surface-variant">PDF, Word, imagen</p>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{cvFile.name}</p>
                    <p className="text-xs text-on-surface-variant">{formatBytes(cvFile.size)}</p>
                  </div>
                  <button onClick={removeCv} className="text-on-surface-variant hover:text-error p-1">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              )}
              {cvWarning && <p className="text-xs text-amber-700 mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">warning</span>{cvWarning}</p>}
            </div>

            {/* Ofertas — tabs Archivo / Base de datos */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
              {/* Tab headers */}
              <div className="flex border-b border-outline-variant/15">
                <button
                  onClick={() => setModoOfertas('archivo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-colors ${modoOfertas === 'archivo' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: modoOfertas === 'archivo' ? "'FILL' 1" : "'FILL' 0" }}>upload_file</span>
                  Subir archivos {ofertaFiles.length > 0 && <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center">{ofertaFiles.length}</span>}
                </button>
                <button
                  onClick={() => setModoOfertas('bd')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-colors ${modoOfertas === 'bd' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: modoOfertas === 'bd' ? "'FILL' 1" : "'FILL' 0" }}>database</span>
                  Base de datos {opecSeleccionados.length > 0 && <span className="w-5 h-5 rounded-full bg-primary text-on-primary text-[10px] font-black flex items-center justify-center">{opecSeleccionados.length}</span>}
                </button>
              </div>

              {/* Tab archivo */}
              {modoOfertas === 'archivo' && (
                <div className="p-5 space-y-3">
                  <p className="text-xs text-on-surface-variant">Sube las ofertas de trabajo en PDF, Word o imagen. Máx. {MAX_ARCHIVOS} archivos.</p>
                  {ofertaFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-teal-600/5 border border-teal-600/15">
                      <span className="material-symbols-outlined text-teal-600 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{f.name}</p>
                        <p className="text-xs text-on-surface-variant">{formatBytes(f.size)}</p>
                      </div>
                      <button onClick={() => removeOferta(i)} className="text-on-surface-variant hover:text-error p-1">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ))}
                  {ofertaFiles.length < MAX_ARCHIVOS && (
                    <>
                      <input ref={ofertaInputRef} type="file" accept={ACCEPTED} multiple onChange={onOfertasChange} className="hidden" />
                      <button onClick={() => ofertaInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl py-5 flex items-center justify-center gap-2 hover:border-teal-500/50 hover:bg-teal-500/5 transition-all">
                        <span className="material-symbols-outlined text-on-surface-variant">add</span>
                        <span className="text-sm font-semibold text-on-surface-variant">{ofertaFiles.length === 0 ? 'Añadir ofertas' : 'Añadir más'}</span>
                      </button>
                    </>
                  )}
                  {ofertaWarning && <p className="text-xs text-amber-700 flex items-center gap-1"><span className="material-symbols-outlined text-sm">warning</span>{ofertaWarning}</p>}
                </div>
              )}

              {/* Tab base de datos */}
              {modoOfertas === 'bd' && (
                <div className="p-5 space-y-4">
                  <p className="text-xs text-on-surface-variant">Busca cargos de la base de datos de Praxia por convocatoria, número o nombre. Máx. {MAX_OPECS} OPECs.</p>

                  {/* Selector convocatoria */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Convocatoria</label>
                    <select
                      value={convId} onChange={e => { setConvId(e.target.value); setResultados([]) }}
                      className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 text-on-surface"
                    >
                      <option value="">Selecciona una convocatoria...</option>
                      {convocatorias.map(c => (
                        <option key={c.id} value={c.id}>{c.nombre}{c.entidad ? ` — ${c.entidad}` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* Buscador */}
                  {convId && (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-lg">search</span>
                      <input
                        value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Buscar por número OPEC o nombre del cargo..."
                        className="w-full pl-10 pr-10 py-2.5 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {buscando && <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
                      {!buscando && query && (
                        <button onClick={() => { setQuery(''); setResultados([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                          <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Resultados */}
                  {resultados.length > 0 && (
                    <div className="border border-outline-variant/20 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                      {resultados.map((opec, i) => {
                        const yaAgregado = opecSeleccionados.some(o => o.id === opec.id)
                        return (
                          <div key={opec.id}
                            className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-container transition-colors ${i > 0 ? 'border-t border-outline-variant/10' : ''}`}
                            onClick={() => setOpecModal(opec)}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-on-surface truncate">{opec.denominacion}</p>
                              <p className="text-xs text-on-surface-variant">{opec.numero_opec ? `OPEC ${opec.numero_opec}` : ''}{opec.nivel ? ` · ${opec.nivel}` : ''}{opec.salario ? ` · $${Number(opec.salario).toLocaleString('es-CO')}` : ''}</p>
                            </div>
                            {yaAgregado ? (
                              <span className="material-symbols-outlined text-emerald-600 text-lg flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); agregarOpec(opec) }}
                                className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
                              >
                                <span className="material-symbols-outlined text-sm">add</span>
                                Añadir
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {convId && !buscando && resultados.length === 0 && query && (
                    <p className="text-sm text-on-surface-variant text-center py-4">Sin resultados para "{query}"</p>
                  )}

                  {convId && !query && !buscando && resultados.length === 0 && (
                    <p className="text-xs text-on-surface-variant text-center py-2">Escribe un número o nombre de cargo para buscar</p>
                  )}

                  {/* OPECs seleccionados */}
                  {opecSeleccionados.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-black text-on-surface-variant uppercase tracking-wide">OPECs seleccionados ({opecSeleccionados.length}/{MAX_OPECS})</p>
                      {opecSeleccionados.map(opec => (
                        <div key={opec.id} className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                          <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface truncate">{opec.denominacion}</p>
                            <p className="text-xs text-on-surface-variant">{opec.numero_opec ? `OPEC ${opec.numero_opec}` : ''}{opec.entidad ? ` · ${opec.entidad}` : ''}</p>
                          </div>
                          <button onClick={() => quitarOpec(opec.id)} className="text-on-surface-variant hover:text-error p-1 flex-shrink-0">
                            <span className="material-symbols-outlined text-lg">close</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Resumen de lo que se analizará */}
            {totalOfertas > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-surface-container border border-outline-variant/15 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-teal-600" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
                <span>
                  Se analizará tu HV contra <strong className="text-on-surface">{totalOfertas}</strong> oferta{totalOfertas !== 1 ? 's' : ''}
                  {ofertaFiles.length > 0 && opecSeleccionados.length > 0 && ` (${ofertaFiles.length} archivo${ofertaFiles.length !== 1 ? 's' : ''} + ${opecSeleccionados.length} de BD)`}
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <span className="material-symbols-outlined flex-shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <p>{error}</p>
              </div>
            )}

            {/* Botón analizar */}
            <button
              onClick={solicitarAnalisis}
              disabled={analizando || !cvFile || totalOfertas === 0}
              className="w-full py-4 rounded-2xl bg-teal-600 text-white font-black text-base flex items-center justify-center gap-3 hover:bg-teal-700 transition-colors disabled:opacity-40 shadow-lg shadow-teal-600/20"
            >
              {analizando
                ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Analizando...</>
                : <><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>manage_search</span>Analizar {totalOfertas > 0 ? `${totalOfertas} oferta${totalOfertas !== 1 ? 's' : ''}` : 'ofertas'}</>
              }
            </button>

            {/* Progreso */}
            {analizando && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{progreso?.msg || 'Iniciando análisis con IA...'}</span>
                  {progreso?.pct && <span className="font-bold">{progreso.pct}%</span>}
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-teal-600 h-2 rounded-full transition-all duration-700" style={{ width: `${progreso?.pct || 0}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal confirmación */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-teal-600 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>manage_search</span>
                </div>
                <div>
                  <p className="font-black text-on-surface">Confirmar análisis</p>
                  <p className="text-xs text-on-surface-variant">Se usará 1 ticket</p>
                </div>
              </div>
              <div className="bg-surface-container rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-on-surface-variant">Hoja de vida</span><span className="font-semibold text-on-surface truncate max-w-[55%] text-right">{cvFile?.name}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Ofertas a analizar</span><span className="font-semibold text-on-surface">{totalOfertas}</span></div>
                {ofertaFiles.length > 0 && <div className="flex justify-between"><span className="text-on-surface-variant">— Archivos</span><span className="text-on-surface">{ofertaFiles.length}</span></div>}
                {opecSeleccionados.length > 0 && <div className="flex justify-between"><span className="text-on-surface-variant">— Desde BD Praxia</span><span className="text-on-surface">{opecSeleccionados.length}</span></div>}
                <div className="flex justify-between"><span className="text-on-surface-variant">Tickets después</span><span className="font-bold text-primary">{Math.max(0, (ticketBalance || 0) - 1)}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-2xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">Cancelar</button>
                <button onClick={runAnalysis} className="flex-1 py-3 rounded-2xl bg-teal-600 text-white text-sm font-black hover:bg-teal-700 transition-colors">Analizar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal OPEC detalle */}
        {opecModal && (
          <ModalOpec
            opec={opecModal}
            onClose={() => setOpecModal(null)}
            onAdd={agregarOpec}
            yaAgregado={opecSeleccionados.some(o => o.id === opecModal.id)}
          />
        )}

        {/* Resultados */}
        {resultado && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-on-surface">Resultados del análisis</h2>
                <p className="text-sm text-on-surface-variant">{resultado.ofertas?.length || 0} oferta(s) · Mayor compatibilidad: {maxPct}%</p>
              </div>
              <button onClick={() => { setResultado(null); setError(null) }}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-2 rounded-xl transition-colors">
                <span className="material-symbols-outlined text-sm">refresh</span>Nuevo análisis
              </button>
            </div>

            {ofertasAptas.length > 0 && (
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                  Ofertas donde calificas ({ofertasAptas.length})
                </p>
                <div className="space-y-3">
                  {resultado.ofertas.map((o, i) => ({ o, i })).filter(({ o }) => o.aplica)
                    .sort((a, b) => (b.o.porcentaje_compatibilidad || 0) - (a.o.porcentaje_compatibilidad || 0))
                    .map(({ o, i }) => <OfertaCard key={i} oferta={o} idx={i} />)}
                </div>
              </div>
            )}
            {ofertasNoAptas.length > 0 && (
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-red-700 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_down</span>
                  Ofertas donde no calificas aún ({ofertasNoAptas.length})
                </p>
                <div className="space-y-3">
                  {resultado.ofertas.map((o, i) => ({ o, i })).filter(({ o }) => !o.aplica)
                    .map(({ o, i }) => <OfertaCard key={i} oferta={o} idx={i} />)}
                </div>
              </div>
            )}

            <div className="flex justify-center pt-2">
              <button onClick={() => { setResultado(null); setError(null) }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-lg">add</span>Analizar otras ofertas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
