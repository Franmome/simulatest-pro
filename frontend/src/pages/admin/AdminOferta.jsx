import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminOferta() {
  const [usuarios, setUsuarios]           = useState([])
  const [tickets, setTickets]             = useState([])
  const [loading, setLoading]             = useState(true)
  const [busqueda, setBusqueda]           = useState('')
  const [adding, setAdding]               = useState(null)
  const [msg, setMsg]                     = useState(null)
  const [precio, setPrecio]               = useState(5000)
  const [precioEdit, setPrecioEdit]       = useState('')
  const [cantidadTickets, setCantidadTickets] = useState(1)
  const [cantidadEdit, setCantidadEdit]   = useState('1')
  const [savingPrecio, setSavingPrecio]   = useState(false)
  const [msgPrecio, setMsgPrecio]         = useState(null)
  const [prompt, setPrompt]               = useState('')
  const [promptEdit, setPromptEdit]       = useState('')
  const [savingPrompt, setSavingPrompt]   = useState(false)
  const [msgPrompt, setMsgPrompt]         = useState(null)

  useEffect(() => { cargar(); fetchPrecio(); fetchPrompt() }, [])

  async function cargar() {
    setLoading(true)
    try {
      const [usrsResult, ticketsResult] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        fetchTickets(),
      ])
      setUsuarios(usrsResult.data || [])
      setTickets(ticketsResult.tickets)
    } catch { /* no crítico */ }
    finally { setLoading(false) }
  }

  async function fetchTickets() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/oferta/tickets`, { headers: h })
      if (r.ok) { const d = await r.json(); return { tickets: d.tickets || [] } }
    } catch { /* */ }
    return { tickets: [] }
  }

  async function fetchPrecio() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/oferta/tickets/precio`, { headers: h })
      if (r.ok) {
        const d = await r.json()
        setPrecio(d.precio_cop || 5000)
        setPrecioEdit(String(d.precio_cop || 5000))
        setCantidadTickets(d.cantidad_tickets || 1)
        setCantidadEdit(String(d.cantidad_tickets || 1))
      }
    } catch { setPrecioEdit('5000'); setCantidadEdit('1') }
  }

  async function fetchPrompt() {
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/oferta/prompt`, { headers: h })
      if (r.ok) {
        const d = await r.json()
        setPrompt(d.prompt || '')
        setPromptEdit(d.prompt || '')
      }
    } catch { /* */ }
  }

  async function guardarPrecio() {
    const val  = parseInt(precioEdit)
    const cant = parseInt(cantidadEdit)
    if (!val || val < 100) { setMsgPrecio({ type: 'err', text: 'Precio mínimo: 100 COP' }); return }
    if (!cant || cant < 1 || cant > 100) { setMsgPrecio({ type: 'err', text: 'Cantidad inválida (1–100)' }); return }
    setSavingPrecio(true); setMsgPrecio(null)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/oferta/tickets/precio`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ precio_cop: val, cantidad_tickets: cant }),
      })
      if (r.ok) {
        setPrecio(val); setCantidadTickets(cant)
        setMsgPrecio({ type: 'ok', text: `✓ Guardado: ${cant} ticket${cant !== 1 ? 's' : ''} por $${val.toLocaleString('es-CO')} COP` })
      } else { const d = await r.json(); setMsgPrecio({ type: 'err', text: d.error || 'Error' }) }
    } catch (e) { setMsgPrecio({ type: 'err', text: e.message }) }
    finally { setSavingPrecio(false) }
  }

  async function guardarPrompt() {
    if (!promptEdit.trim()) { setMsgPrompt({ type: 'err', text: 'El prompt no puede estar vacío.' }); return }
    setSavingPrompt(true); setMsgPrompt(null)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/oferta/prompt`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptEdit }),
      })
      if (r.ok) {
        setPrompt(promptEdit)
        setMsgPrompt({ type: 'ok', text: '✓ Prompt guardado correctamente' })
      } else { const d = await r.json(); setMsgPrompt({ type: 'err', text: d.error || 'Error' }) }
    } catch (e) { setMsgPrompt({ type: 'err', text: e.message }) }
    finally { setSavingPrompt(false) }
  }

  async function agregar(userId, cantidad) {
    setAdding(userId); setMsg(null)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/oferta/tickets/add`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, cantidad }),
      })
      if (r.ok) {
        setMsg({ type: 'ok', text: `✓ ${cantidad} ticket(s) agregados` })
        const res = await fetchTickets(); setTickets(res.tickets)
      } else { const d = await r.json(); setMsg({ type: 'err', text: d.error || 'Error' }) }
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
    finally { setAdding(null) }
  }

  const filas = useMemo(() => {
    return usuarios.map(u => {
      const t = tickets.find(t => t.user_id === u.id)
      return { ...u, ticketBalance: t?.tickets ?? 0, updatedAt: t?.updated_at ?? null }
    })
  }, [usuarios, tickets])

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return filas
    const q = busqueda.toLowerCase()
    return filas.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    )
  }, [filas, busqueda])

  const totalTickets = tickets.reduce((a, t) => a + (t.tickets || 0), 0)
  const conTickets   = tickets.filter(t => t.tickets > 0).length

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Título */}
      <div>
        <h2 className="text-2xl font-black text-on-surface">Análisis de Oferta — Tickets & Config</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          1 ticket = 1 análisis completo · Precio actual: <strong>${precio.toLocaleString('es-CO')} COP</strong> (Wompi)
        </p>
      </div>

      {/* Editor de precio + cantidad */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5">
        <h3 className="font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
          Precio del ticket (COP)
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Cuánto paga el usuario y cuántos análisis recibe por esa compra.
          Actualmente: <strong>${precio.toLocaleString('es-CO')} COP → {cantidadTickets} ticket{cantidadTickets !== 1 ? 's' : ''}</strong>
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Precio (COP)</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-on-surface-variant">$</span>
              <input
                type="number" min={100} max={1000000} step={1000}
                value={precioEdit}
                onChange={e => setPrecioEdit(e.target.value)}
                className="w-32 bg-surface-container-low border border-outline-variant/30 rounded-xl py-2.5 px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="text-sm text-on-surface-variant">COP</span>
            </div>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant pb-2.5">arrow_forward</span>
          <div className="space-y-1">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wide">Tickets que recibe</label>
            <div className="flex items-center gap-1 border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-low">
              <button onClick={() => setCantidadEdit(v => String(Math.max(1, parseInt(v || 1) - 1)))} className="w-9 h-10 flex items-center justify-center hover:bg-surface-container font-bold text-on-surface-variant">−</button>
              <input type="number" min={1} max={100} value={cantidadEdit} onChange={e => setCantidadEdit(e.target.value)} className="w-12 text-center text-sm font-bold text-on-surface bg-transparent outline-none py-2" />
              <button onClick={() => setCantidadEdit(v => String(Math.min(100, parseInt(v || 1) + 1)))} className="w-9 h-10 flex items-center justify-center hover:bg-surface-container font-bold text-on-surface-variant">+</button>
            </div>
          </div>
          <button onClick={guardarPrecio} disabled={savingPrecio} className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40">
            {savingPrecio ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
            Guardar
          </button>
        </div>
        {precioEdit && cantidadEdit && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/15">
            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>preview</span>
            <p className="text-xs text-on-surface">
              El usuario verá: <strong className="text-primary">Comprar {parseInt(cantidadEdit) > 1 ? `${cantidadEdit} tickets` : '1 ticket'} — ${parseInt(precioEdit || 0).toLocaleString('es-CO')}</strong>
            </p>
          </div>
        )}
        {msgPrecio && (
          <p className={`text-xs mt-2 px-3 py-1.5 rounded-lg ${msgPrecio.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msgPrecio.text}</p>
        )}
      </div>

      {/* Editor de prompt maestro */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5">
        <h3 className="font-bold text-on-surface mb-1 flex items-center gap-2">
          <span className="material-symbols-outlined text-violet-600 text-base" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
          Prompt maestro de la IA
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">
          Este es el prompt de sistema que usa la IA para comparar la hoja de vida con las ofertas. Modifícalo con cuidado — afecta todos los análisis.
        </p>
        <textarea
          value={promptEdit}
          onChange={e => setPromptEdit(e.target.value)}
          rows={12}
          placeholder="El prompt de sistema de la IA aparecerá aquí..."
          className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-sm text-on-surface font-mono outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[180px]"
        />
        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={guardarPrompt}
            disabled={savingPrompt || !promptEdit.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {savingPrompt ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : null}
            Guardar prompt
          </button>
          {promptEdit !== prompt && (
            <button onClick={() => setPromptEdit(prompt)} className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-2 rounded-lg hover:bg-surface-container transition-colors">
              Descartar cambios
            </button>
          )}
          <span className="text-xs text-on-surface-variant ml-auto">{promptEdit.length} caracteres</span>
        </div>
        {msgPrompt && (
          <p className={`text-xs mt-2 px-3 py-1.5 rounded-lg ${msgPrompt.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{msgPrompt.text}</p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Usuarios con tickets',   value: conTickets,                               icon: 'group',               color: 'bg-primary/10 text-primary' },
          { label: 'Tickets en circulación', value: totalTickets,                             icon: 'confirmation_number', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Precio por ticket',      value: `$${precio.toLocaleString('es-CO')} COP`, icon: 'payments',            color: 'bg-amber-100 text-amber-700' },
        ].map((s, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4">
            <div className={`w-9 h-9 rounded-xl ${s.color} flex items-center justify-center mb-3`}>
              <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
            </div>
            <p className="text-2xl font-black text-on-surface">{s.value}</p>
            <p className="text-xs text-on-surface-variant mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Mensaje flash */}
      {msg && (
        <div className={`px-4 py-3 rounded-xl text-sm font-semibold ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Buscador */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant text-lg">search</span>
        <input
          value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar usuario por nombre o correo..."
          className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant/30 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {/* Tabla de usuarios */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-outline-variant/15 flex items-center justify-between">
          <p className="text-sm font-bold text-on-surface">
            {busqueda ? `${filtradas.length} resultado${filtradas.length !== 1 ? 's' : ''}` : `${usuarios.length} usuarios`}
          </p>
          <button onClick={cargar} className="text-xs text-primary font-bold hover:underline flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-slate-300 text-4xl">search_off</span>
            <p className="text-sm text-on-surface-variant mt-2">Sin resultados para "{busqueda}"</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {filtradas.map(u => (
              <UserRow key={u.id} user={u} adding={adding === u.id} onAdd={(cant) => agregar(u.id, cant)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({ user, adding, onAdd }) {
  const [cantidad, setCantidad] = useState(1)
  const [open, setOpen]         = useState(false)
  const iniciales = ((user.full_name || user.email || '?')[0]).toUpperCase()
  const hasTickets = user.ticketBalance > 0

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${hasTickets ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'}`}>
          {iniciales}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{user.full_name || '—'}</p>
          <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${hasTickets ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
          {user.ticketBalance} ticket{user.ticketBalance !== 1 ? 's' : ''}
        </div>
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0">
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Regalar
        </button>
      </div>
      {open && (
        <div className="mt-3 ml-12 flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">Cantidad:</span>
          <div className="flex items-center gap-1 border border-outline-variant/40 rounded-lg overflow-hidden">
            <button onClick={() => setCantidad(c => Math.max(1, c - 1))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-on-surface-variant font-bold">−</button>
            <span className="w-8 text-center text-sm font-bold text-on-surface">{cantidad}</span>
            <button onClick={() => setCantidad(c => Math.min(50, c + 1))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-on-surface-variant font-bold">+</button>
          </div>
          <button onClick={() => { onAdd(cantidad); setOpen(false); setCantidad(1) }} disabled={adding} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
            {adding ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>}
            Confirmar
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-on-surface-variant hover:text-on-surface px-2">Cancelar</button>
        </div>
      )}
    </div>
  )
}
