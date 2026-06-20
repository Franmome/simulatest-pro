import { useState, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL || ''
const MAX_OFERTAS = 5
const ACCEPTED    = '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.webp'

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
    verde:    { bg: 'bg-emerald-500', ring: 'ring-emerald-200', text: 'text-emerald-700', label: 'Aplica' },
    amarillo: { bg: 'bg-amber-400',   ring: 'ring-amber-200',   text: 'text-amber-700',   label: 'Aplica con brechas' },
    rojo:     { bg: 'bg-red-500',     ring: 'ring-red-200',     text: 'text-red-700',     label: 'No aplica' },
  }
  const c = map[color] || map.rojo
  return (
    <div className="flex items-center gap-3">
      <div className={`relative w-14 h-14 flex-shrink-0`}>
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" strokeWidth="5" className="text-surface-container" />
          <circle
            cx="28" cy="28" r="22" fill="none" strokeWidth="5"
            strokeDasharray={`${2 * Math.PI * 22}`}
            strokeDashoffset={`${2 * Math.PI * 22 * (1 - (pct || 0) / 100)}`}
            className={c.bg.replace('bg-', 'stroke-')}
            strokeLinecap="round"
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
  const colorMap = { verde: 'border-emerald-300 bg-emerald-50/40', amarillo: 'border-amber-300 bg-amber-50/40', rojo: 'border-red-300 bg-red-50/40' }
  const headerColor = { verde: 'bg-emerald-50', amarillo: 'bg-amber-50', rojo: 'bg-red-50' }

  return (
    <div className={`rounded-2xl border overflow-hidden ${colorMap[sem] || colorMap.rojo}`}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left ${headerColor[sem] || headerColor.rojo} hover:brightness-95 transition-all`}
      >
        <div className="flex-shrink-0">
          <Semaforo color={sem} pct={oferta.porcentaje_compatibilidad || 0} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-on-surface text-base truncate">{safeStr(oferta.cargo_titulo) || `Oferta ${idx + 1}`}</p>
          <p className="text-sm text-on-surface-variant truncate">{safeStr(oferta.empresa) || 'Empresa no identificada'}{oferta.modalidad ? ` · ${safeStr(oferta.modalidad)}` : ''}{oferta.salario_estimado ? ` · ${safeStr(oferta.salario_estimado)}` : ''}</p>
        </div>
        <span className={`material-symbols-outlined text-on-surface-variant transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {/* Cuerpo expandible */}
      {open && (
        <div className="px-5 py-4 space-y-5">
          {/* Resumen ejecutivo */}
          {oferta.resumen_ejecutivo && (
            <p className="text-sm text-on-surface leading-relaxed">{safeStr(oferta.resumen_ejecutivo)}</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Puntos fuertes */}
            {Array.isArray(oferta.puntos_fuertes) && oferta.puntos_fuertes.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-emerald-700">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  Puntos fuertes
                </h4>
                <ul className="space-y-1.5">
                  {oferta.puntos_fuertes.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                      {safeStr(p)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Brechas */}
            {Array.isArray(oferta.brechas) && oferta.brechas.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-red-700">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>cancel</span>
                  Brechas detectadas
                </h4>
                <ul className="space-y-1.5">
                  {oferta.brechas.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
                      {safeStr(b)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requisitos cumplidos */}
            {Array.isArray(oferta.requisitos_criticos_cumplidos) && oferta.requisitos_criticos_cumplidos.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-primary">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                  Requisitos que cumples
                </h4>
                <ul className="space-y-1.5">
                  {oferta.requisitos_criticos_cumplidos.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                      {safeStr(r)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Requisitos faltantes */}
            {Array.isArray(oferta.requisitos_criticos_faltantes) && oferta.requisitos_criticos_faltantes.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-700">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  Requisitos que te faltan
                </h4>
                <ul className="space-y-1.5">
                  {oferta.requisitos_criticos_faltantes.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-on-surface">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-1.5" />
                      {safeStr(r)}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Recomendación */}
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

export default function AnalisisOferta() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  // Estado del formulario
  const [cvFile, setCvFile]           = useState(null)
  const [ofertaFiles, setOfertaFiles] = useState([])
  const [cvWarning, setCvWarning]     = useState(null)
  const [ofertaWarning, setOfertaWarning] = useState(null)

  // Estado del análisis
  const [analizando, setAnalizando]   = useState(false)
  const [progreso, setProgreso]       = useState(null)
  const [error, setError]             = useState(null)
  const [resultado, setResultado]     = useState(null)

  // Tickets y Wompi
  const [ticketBalance, setTicketBalance] = useState(null)
  const [precioCop, setPrecioCop]         = useState(null)
  const [loadingCheckout, setLoadingCheckout] = useState(false)
  const [pagoVerificando, setPagoVerificando] = useState(false)
  const [pagoBanner, setPagoBanner]           = useState(null) // 'verificando' | 'ok' | null

  // Confirmación de ticket
  const [showConfirm, setShowConfirm] = useState(false)

  const cvInputRef     = useRef(null)
  const ofertaInputRef = useRef(null)
  const analizandoRef  = useRef(false)

  // Detectar retorno desde Wompi
  useEffect(() => {
    const wompiId = searchParams.get('id')
    if (wompiId) {
      setPagoBanner('verificando')
      let intentos = 0
      const poll = setInterval(async () => {
        intentos++
        await fetchTickets()
        if (ticketBalance > 0 || intentos >= 5) {
          clearInterval(poll)
          if (intentos < 5 || ticketBalance > 0) {
            setPagoBanner('ok')
            setTimeout(() => setPagoBanner(null), 6000)
          } else {
            setPagoBanner(null)
          }
        }
      }, 5000)
    }
  }, [])

  useEffect(() => { fetchTickets(); fetchPrecio() }, [])

  async function fetchTickets() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/oferta/tickets/balance`, { headers: h })
      if (r.ok) { const d = await r.json(); setTicketBalance(d.balance ?? 0) }
    } catch { setTicketBalance(0) }
  }

  async function fetchPrecio() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/oferta/tickets/precio`, { headers: h })
      if (r.ok) { const d = await r.json(); setPrecioCop(d.precio_cop || null) }
    } catch { /* */ }
  }

  function onCvChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 15 * 1024 * 1024) { setCvWarning('El archivo es mayor a 15 MB. Puede tardar más.') }
    else { setCvWarning(null) }
    setCvFile(f)
    e.target.value = ''
  }

  function onOfertasChange(e) {
    const nuevos = Array.from(e.target.files || [])
    setOfertaFiles(prev => {
      const combined = [...prev, ...nuevos].slice(0, MAX_OFERTAS)
      if (combined.length >= MAX_OFERTAS) setOfertaWarning(`Máximo ${MAX_OFERTAS} ofertas por análisis.`)
      else setOfertaWarning(null)
      return combined
    })
    e.target.value = ''
  }

  function removeCv() { setCvFile(null); setCvWarning(null) }
  function removeOferta(idx) {
    setOfertaFiles(prev => prev.filter((_, i) => i !== idx))
    setOfertaWarning(null)
  }

  function solicitarAnalisis() {
    if (analizandoRef.current || analizando) return
    if (!cvFile) { setError('Debes subir tu hoja de vida.'); return }
    if (ofertaFiles.length === 0) { setError('Debes subir al menos una oferta de trabajo.'); return }
    setError(null)
    if (ticketBalance !== null && ticketBalance < 1) {
      setError('No tienes tickets disponibles. Compra uno para continuar.')
      return
    }
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
    setAnalizando(true)
    setShowConfirm(false)
    setError(null)
    setProgreso(null)
    setResultado(null)

    const jobId = crypto.randomUUID()

    // Conectar SSE primero
    const sseUrl = `${BASE}/api/ia/analisis-oferta/progreso/${jobId}`
    let evtSource = null
    let resolveResult, rejectResult

    const resultPromise = new Promise((resolve, reject) => {
      let timeoutId
      resolveResult = (val) => { clearTimeout(timeoutId); resolve(val) }
      rejectResult  = (err) => { clearTimeout(timeoutId); reject(err) }
      timeoutId = setTimeout(() => reject(new Error('El análisis tardó demasiado. Intenta de nuevo.')), 10 * 60 * 1000)
    })

    evtSource = new EventSource(sseUrl)

    evtSource.addEventListener('progreso', (e) => {
      try { const d = JSON.parse(e.data); setProgreso(d) } catch { /* */ }
    })

    evtSource.addEventListener('listo', (e) => {
      try {
        const data = e.data ? JSON.parse(e.data) : {}
        resolveResult?.(data)
      } catch { resolveResult?.({}) }
      evtSource?.close()
    })

    evtSource.addEventListener('error', (e) => {
      if (e.data) {
        try {
          const d = JSON.parse(e.data)
          if (d.mensaje) { rejectResult?.(new Error(d.mensaje)); evtSource?.close(); return }
        } catch { /* */ }
      }
      rejectResult?.(new Error('Se perdió la conexión con el servidor. Verifica tu conexión e intenta de nuevo.'))
      evtSource?.close()
    })

    // Enviar el POST con los archivos
    try {
      const h = await authHeaders()
      const form = new FormData()
      form.append('cv', cvFile)
      form.append('jobId', jobId)
      ofertaFiles.forEach(f => form.append('ofertas', f))

      const r = await fetch(`${BASE}/api/ia/analisis-oferta`, { method: 'POST', headers: h, body: form })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        if (d.tickets_agotados) {
          setError('Sin tickets. Compra un ticket para continuar.')
          setShowConfirm(false)
        } else {
          setError(d.error || 'Error al iniciar el análisis.')
        }
        evtSource?.close()
        analizandoRef.current = false
        setAnalizando(false)
        return
      }

      // Esperar resultado por SSE
      const data = await resultPromise
      if (data?.analisis) {
        setResultado(data.analisis)
        await fetchTickets()
      } else {
        setError('El análisis no devolvió resultados. Intenta de nuevo.')
      }
    } catch (e) {
      evtSource?.close()
      setError(e.message || 'Error inesperado.')
    } finally {
      analizandoRef.current = false
      setAnalizando(false)
      setProgreso(null)
    }
  }, [cvFile, ofertaFiles])

  const formatBytes = (b) => {
    if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  const ofertasAptas    = resultado?.ofertas?.filter(o => o.aplica) || []
  const ofertasNoAptas  = resultado?.ofertas?.filter(o => !o.aplica) || []
  const maxPct          = resultado?.ofertas?.length ? Math.max(...(resultado.ofertas.map(o => o.porcentaje_compatibilidad || 0))) : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Banner retorno Wompi */}
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
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>work_history</span>
            </div>
            <div>
              <h1 className="text-xl font-black text-on-surface">Análisis de Oferta de Trabajo</h1>
              <p className="text-sm text-on-surface-variant">Compara tu hoja de vida con las ofertas que te interesan</p>
            </div>
          </div>
        </div>

        {/* Ticket balance + botón Wompi */}
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
          {(ticketBalance === 0 || ticketBalance === null) && (
            <button
              onClick={iniciarCheckout}
              disabled={loadingCheckout}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00D4A1] text-white text-sm font-black shadow hover:bg-[#00b990] transition-colors disabled:opacity-50"
            >
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
                  <button
                    onClick={() => cvInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-outline-variant/40 rounded-2xl py-8 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                  >
                    <span className="material-symbols-outlined text-3xl text-on-surface-variant">upload_file</span>
                    <p className="text-sm font-semibold text-on-surface">Haz clic para subir tu HV</p>
                    <p className="text-xs text-on-surface-variant">PDF, Word, imagen · Máx. recomendado 15 MB</p>
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{cvFile.name}</p>
                    <p className="text-xs text-on-surface-variant">{formatBytes(cvFile.size)}</p>
                  </div>
                  <button onClick={removeCv} className="text-on-surface-variant hover:text-error transition-colors p-1">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>
              )}
              {cvWarning && <p className="text-xs text-amber-700 mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">warning</span>{cvWarning}</p>}
            </div>

            {/* Upload Ofertas */}
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5">
              <h3 className="font-bold text-on-surface mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>work</span>
                Ofertas de trabajo
                <span className="ml-auto text-xs font-normal text-on-surface-variant">{ofertaFiles.length}/{MAX_OFERTAS}</span>
              </h3>
              <p className="text-xs text-on-surface-variant mb-3">Puedes subir hasta {MAX_OFERTAS} ofertas a la vez (PDF, Word, imagen)</p>

              {ofertaFiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {ofertaFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/5 border border-secondary/15">
                      <span className="material-symbols-outlined text-secondary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-on-surface truncate">{f.name}</p>
                        <p className="text-xs text-on-surface-variant">{formatBytes(f.size)}</p>
                      </div>
                      <button onClick={() => removeOferta(i)} className="text-on-surface-variant hover:text-error transition-colors p-1">
                        <span className="material-symbols-outlined text-lg">close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {ofertaFiles.length < MAX_OFERTAS && (
                <>
                  <input ref={ofertaInputRef} type="file" accept={ACCEPTED} multiple onChange={onOfertasChange} className="hidden" />
                  <button
                    onClick={() => ofertaInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-outline-variant/40 rounded-xl py-5 flex items-center justify-center gap-2 hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                  >
                    <span className="material-symbols-outlined text-on-surface-variant">add</span>
                    <span className="text-sm font-semibold text-on-surface-variant">
                      {ofertaFiles.length === 0 ? 'Añadir ofertas' : 'Añadir más ofertas'}
                    </span>
                  </button>
                </>
              )}
              {ofertaWarning && <p className="text-xs text-amber-700 mt-2 flex items-center gap-1"><span className="material-symbols-outlined text-sm">warning</span>{ofertaWarning}</p>}
            </div>

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
              disabled={analizando || !cvFile || ofertaFiles.length === 0}
              className="w-full py-4 rounded-2xl bg-primary text-on-primary font-black text-base flex items-center justify-center gap-3 hover:bg-primary/90 transition-colors disabled:opacity-40 shadow-lg shadow-primary/20"
            >
              {analizando
                ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Analizando...</>
                : <><span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>manage_search</span>Analizar ofertas</>
              }
            </button>

            {/* Progreso */}
            {analizando && progreso && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-on-surface-variant">
                  <span>{progreso.msg || 'Procesando...'}</span>
                  <span className="font-bold">{progreso.pct || 0}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-700"
                    style={{ width: `${progreso.pct || 0}%` }}
                  />
                </div>
              </div>
            )}

            {analizando && !progreso && (
              <div className="flex items-center gap-3 text-sm text-on-surface-variant py-2">
                <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin flex-shrink-0" />
                Iniciando análisis con IA...
              </div>
            )}
          </div>
        )}

        {/* Modal de confirmación */}
        {showConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
            <div className="bg-surface rounded-3xl shadow-2xl max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>manage_search</span>
                </div>
                <div>
                  <p className="font-black text-on-surface">Confirmar análisis</p>
                  <p className="text-xs text-on-surface-variant">Se usará 1 ticket</p>
                </div>
              </div>
              <div className="bg-surface-container rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Hoja de vida</span>
                  <span className="font-semibold text-on-surface truncate max-w-[60%] text-right">{cvFile?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Ofertas a analizar</span>
                  <span className="font-semibold text-on-surface">{ofertaFiles.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Tickets restantes después</span>
                  <span className="font-bold text-primary">{Math.max(0, (ticketBalance || 0) - 1)}</span>
                </div>
              </div>
              <p className="text-xs text-on-surface-variant text-center">
                La IA comparará tu perfil con cada oferta usando la cascada Gemini → GPT → DeepSeek.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-2xl border border-outline-variant text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors">
                  Cancelar
                </button>
                <button onClick={runAnalysis} className="flex-1 py-3 rounded-2xl bg-primary text-on-primary text-sm font-black hover:bg-primary/90 transition-colors">
                  Analizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resultados */}
        {resultado && (
          <div className="space-y-5">
            {/* Resumen */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-on-surface">Resultados del análisis</h2>
                <p className="text-sm text-on-surface-variant">
                  {resultado.ofertas?.length || 0} oferta(s) analizadas · Mayor compatibilidad: {maxPct}%
                </p>
              </div>
              <button
                onClick={() => { setResultado(null); setError(null) }}
                className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-3 py-2 rounded-xl transition-colors"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Nuevo análisis
              </button>
            </div>

            {/* Resumen ejecutivo: cartas aplicables primero */}
            {resultado.ofertas?.length > 0 && (
              <div className="space-y-4">
                {ofertasAptas.length > 0 && (
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-700 mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>thumb_up</span>
                      Ofertas donde calificas ({ofertasAptas.length})
                    </p>
                    <div className="space-y-3">
                      {resultado.ofertas
                        .map((o, i) => ({ o, i }))
                        .filter(({ o }) => o.aplica)
                        .sort((a, b) => (b.o.porcentaje_compatibilidad || 0) - (a.o.porcentaje_compatibilidad || 0))
                        .map(({ o, i }) => <OfertaCard key={i} oferta={o} idx={i} />)
                      }
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
                      {resultado.ofertas
                        .map((o, i) => ({ o, i }))
                        .filter(({ o }) => !o.aplica)
                        .map(({ o, i }) => <OfertaCard key={i} oferta={o} idx={i} />)
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA nuevo análisis */}
            <div className="flex justify-center pt-2">
              <button
                onClick={() => { setResultado(null); setError(null) }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 text-sm font-bold text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-lg">add</span>
                Analizar otras ofertas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
