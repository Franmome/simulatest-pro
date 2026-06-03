import { useEffect, useState } from 'react'
import { supabase } from '../../utils/supabase'

const BASE = import.meta.env.VITE_API_URL || ''

async function authHeaders() {
  const { data } = await supabase.auth.getSession()
  const token = data?.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminAnalisis() {
  const [tickets, setTickets] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [addUserId, setAddUserId] = useState('')
  const [addCantidad, setAddCantidad] = useState(1)
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    Promise.all([fetchTickets(), fetchUsuarios()])
  }, [])

  async function fetchTickets() {
    setLoading(true)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/tickets`, { headers: h })
      if (r.ok) { const d = await r.json(); setTickets(d.tickets || []) }
    } catch { /* no crítico */ }
    finally { setLoading(false) }
  }

  async function fetchUsuarios() {
    const { data } = await supabase.from('users').select('id, email, full_name').order('full_name')
    setUsuarios(data || [])
  }

  async function agregarTickets() {
    if (!addUserId || addCantidad < 1) return
    setAdding(true); setMsg(null)
    try {
      const h = await authHeaders()
      const r = await fetch(`${BASE}/api/ia/admin/tickets/add`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: addUserId, cantidad: addCantidad }),
      })
      if (r.ok) {
        setMsg({ type: 'ok', text: `✓ ${addCantidad} ticket(s) agregados correctamente` })
        setAddUserId(''); setAddCantidad(1)
        fetchTickets()
      } else {
        const d = await r.json()
        setMsg({ type: 'err', text: d.error || 'Error al agregar tickets' })
      }
    } catch (e) { setMsg({ type: 'err', text: e.message }) }
    finally { setAdding(false) }
  }

  const totalTickets = tickets.reduce((acc, t) => acc + (t.tickets || 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-black text-on-surface">Gestión de Tickets — Análisis de Perfil</h2>
        <p className="text-sm text-on-surface-variant mt-1">Administra los tickets de análisis. 1 ticket = 1 análisis completo. Precio público: <strong>$2.000 COP</strong> por ticket (Wompi).</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Usuarios con tickets', value: tickets.length, icon: 'group', color: 'bg-primary/10 text-primary' },
          { label: 'Tickets disponibles (total)', value: totalTickets, icon: 'confirmation_number', color: 'bg-emerald-100 text-emerald-700' },
          { label: 'Precio por ticket', value: '$2.000 COP', icon: 'payments', color: 'bg-amber-100 text-amber-700' },
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

      {/* Agregar tickets manualmente */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-5">
        <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
          Agregar tickets manualmente
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={addUserId}
            onChange={e => setAddUserId(e.target.value)}
            className="flex-1 bg-surface-container-low border border-outline-variant/30 rounded-xl py-2.5 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Selecciona un usuario</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.email})</option>
            ))}
          </select>
          <input
            type="number" min={1} max={100}
            value={addCantidad}
            onChange={e => setAddCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-24 bg-surface-container-low border border-outline-variant/30 rounded-xl py-2.5 px-3 text-sm text-center outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Cant."
          />
          <button
            onClick={agregarTickets}
            disabled={!addUserId || adding}
            className="px-5 py-2.5 bg-primary text-white font-bold text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {adding && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            Agregar
          </button>
        </div>
        {msg && (
          <p className={`text-xs mt-3 px-3 py-2 rounded-lg ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Lista de tickets por usuario */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 overflow-hidden">
        <div className="px-5 py-4 border-b border-outline-variant/15 flex items-center justify-between">
          <h3 className="font-bold text-on-surface">Saldo por usuario</h3>
          <button onClick={fetchTickets} className="text-xs text-primary font-bold hover:underline">Actualizar</button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-12 text-center">
            <span className="material-symbols-outlined text-slate-300 text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
            <p className="text-sm text-on-surface-variant mt-2">Ningún usuario tiene tickets aún.</p>
            <p className="text-xs text-on-surface-variant mt-1 max-w-xs mx-auto">
              Debes crear la tabla <code className="bg-slate-100 px-1 rounded">user_analisis_tickets</code> en Supabase primero.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/10">
            {tickets.map((t, i) => {
              const user = usuarios.find(u => u.id === t.user_id)
              return (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary font-bold text-sm">{(user?.full_name || user?.email || '?')[0].toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{user?.full_name || 'Usuario'}</p>
                    <p className="text-xs text-on-surface-variant truncate">{user?.email || t.user_id}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="material-symbols-outlined text-emerald-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>confirmation_number</span>
                    <span className="font-extrabold text-emerald-700">{t.tickets}</span>
                    <span className="text-xs text-on-surface-variant">ticket{t.tickets !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* SQL migration note */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600 text-lg mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
          <div>
            <p className="text-sm font-bold text-amber-800 mb-2">SQL requerido en Supabase</p>
            <p className="text-xs text-amber-700 mb-3">Si aún no has creado la tabla de tickets, corre este SQL en el editor de Supabase:</p>
            <pre className="text-[11px] bg-amber-100 rounded-lg p-3 text-amber-900 overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`CREATE TABLE IF NOT EXISTS user_analisis_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tickets INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_analisis_tickets ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_analisis_tickets
  ON user_analisis_tickets(user_id);
CREATE POLICY "users_read_own"
  ON user_analisis_tickets FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "service_all"
  ON user_analisis_tickets FOR ALL
  USING (true) WITH CHECK (true);`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
