import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminAnalisis() {
  const [usuarios, setUsuarios]     = useState([])
  const [tickets, setTickets]       = useState([])   // [{ user_id, tickets }]
  const [loading, setLoading]       = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [adding, setAdding]         = useState(null) // user_id en proceso
  const [msg, setMsg]               = useState(null)

  useEffect(() => { cargar() }, [])

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
      const r = await fetch(`${BASE}/api/ia/admin/tickets`, { headers: h })
      if (r.ok) { const d = await r.json(); return { tickets: d.tickets || [] } }
    } catch { /* */ }
    return { tickets: [] }
  }

  async function recargarTickets() {
    const res = await fetchTickets()
    setTickets(res.tickets)
  }

  async function agregar(userId, cantidad) {
    setAdding(userId); setMsg(null)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/tickets/add`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, cantidad }),
      })
      if (r.ok) {
        setMsg({ type: 'ok', text: `✓ ${cantidad} ticket(s) agregados` })
        recargarTickets()
      } else {
        const d = await r.json()
        setMsg({ type: 'err', text: d.error || 'Error' })
      }
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
    finally { setAdding(null) }
  }

  // Mezcla usuarios con su saldo de tickets
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

  const totalTickets   = tickets.reduce((a, t) => a + (t.tickets || 0), 0)
  const conTickets     = tickets.filter(t => t.tickets > 0).length

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Título */}
      <div>
        <h2 className="text-2xl font-black text-on-surface">Análisis de Perfil — Tickets</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          1 ticket = 1 análisis completo · Precio público: <strong>$2.000 COP</strong> (Wompi)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Usuarios con tickets', value: conTickets,      icon: 'group',               color: 'bg-primary/10 text-primary' },
          { label: 'Tickets en circulación', value: totalTickets,  icon: 'confirmation_number',  color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Precio por ticket',     value: '$2.000 COP',   icon: 'payments',             color: 'bg-amber-100 text-amber-700' },
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
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
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
              <UserRow
                key={u.id}
                user={u}
                adding={adding === u.id}
                onAdd={(cant) => agregar(u.id, cant)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UserRow({ user, adding, onAdd }) {
  const [cantidad, setCantidad] = useState(1)
  const [open, setOpen] = useState(false)

  const iniciales = ((user.full_name || user.email || '?')[0]).toUpperCase()
  const hasTickets = user.ticketBalance > 0

  return (
    <div className="px-5 py-3.5">
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${hasTickets ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-container text-on-surface-variant'}`}>
          {iniciales}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{user.full_name || '—'}</p>
          <p className="text-xs text-on-surface-variant truncate">{user.email}</p>
        </div>

        {/* Badge tickets */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold flex-shrink-0 ${hasTickets ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
          {user.ticketBalance} ticket{user.ticketBalance !== 1 ? 's' : ''}
        </div>

        {/* Botón regalar */}
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Regalar
        </button>
      </div>

      {/* Panel de regalo (inline expandible) */}
      {open && (
        <div className="mt-3 ml-12 flex items-center gap-2 animate-fade-in">
          <span className="text-xs text-on-surface-variant">Cantidad:</span>
          <div className="flex items-center gap-1 border border-outline-variant/40 rounded-lg overflow-hidden">
            <button onClick={() => setCantidad(c => Math.max(1, c - 1))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-on-surface-variant font-bold">−</button>
            <span className="w-8 text-center text-sm font-bold text-on-surface">{cantidad}</span>
            <button onClick={() => setCantidad(c => Math.min(50, c + 1))} className="w-7 h-7 flex items-center justify-center hover:bg-slate-100 text-on-surface-variant font-bold">+</button>
          </div>
          <button
            onClick={() => { onAdd(cantidad); setOpen(false); setCantidad(1) }}
            disabled={adding}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {adding
              ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>}
            Confirmar
          </button>
          <button onClick={() => setOpen(false)} className="text-xs text-on-surface-variant hover:text-on-surface px-2">Cancelar</button>
        </div>
      )}
    </div>
  )
}
