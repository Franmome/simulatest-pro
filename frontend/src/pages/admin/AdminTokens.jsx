import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../utils/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`
  return `${n}`
}

function pct(used, limit) {
  if (!limit) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function colorBarra(p) {
  if (p >= 90) return 'bg-red-500'
  if (p >= 70) return 'bg-amber-500'
  if (p >= 40) return 'bg-blue-500'
  return 'bg-emerald-500'
}

function colorBadge(p) {
  if (p >= 90) return 'bg-red-100 text-red-700 border-red-200'
  if (p >= 70) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-emerald-100 text-emerald-700 border-emerald-200'
}

function iniciales(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
}

// ── Tarjeta de stat ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, color = 'bg-slate-800' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
        <span className="material-symbols-outlined text-white text-xl"
          style={{ fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-black">{value}</p>
        <p className="text-sm font-bold text-on-surface">{label}</p>
        {sub && <p className="text-[11px] text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ── Modal para editar límite ──────────────────────────────────────────────────

function ModalLimite({ usuario, onClose, onGuardado }) {
  const [limite, setLimite] = useState(Math.round((usuario.tokens_limit || 1_000_000) / 1000))
  const [saving, setSaving] = useState(false)

  const opciones = [100, 250, 500, 1000, 2000, 5000]

  const guardar = async (nuevoLimiteK) => {
    setSaving(true)
    const nuevoLimite = (nuevoLimiteK || limite) * 1000
    try {
      if (usuario.tiene_registro) {
        await supabase
          .from('user_ai_tokens')
          .update({ tokens_limit: nuevoLimite })
          .eq('user_id', usuario.user_id)
          .eq('purchase_id', usuario.purchase_id)
      } else {
        await supabase
          .from('user_ai_tokens')
          .upsert({
            user_id:      usuario.user_id,
            purchase_id:  usuario.purchase_id,
            tokens_used:  0,
            tokens_limit: nuevoLimite,
          }, { onConflict: 'user_id,purchase_id' })
      }
      onGuardado()
      onClose()
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const bloquear = async () => {
    if (!window.confirm(`¿Bloquear el acceso IA de ${usuario.full_name || usuario.email}? El usuario verá un mensaje de tokens agotados.`)) return
    await guardar(0)
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center font-bold text-sm">
              {iniciales(usuario.full_name || usuario.email)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">{usuario.full_name || 'Sin nombre'}</p>
              <p className="text-[11px] text-white/60 truncate">{usuario.email}</p>
            </div>
            <button onClick={onClose}
              className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="mt-4 flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-sm">token</span>
            <span className="text-xs font-bold">Consumido: {fmt(usuario.tokens_used)}</span>
            <span className="mx-1 opacity-40">/</span>
            <span className="text-xs opacity-70">Límite actual: {fmt(usuario.tokens_limit)}</span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-3">
            Establecer nuevo límite mensual
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {opciones.map(op => (
              <button key={op} onClick={() => setLimite(op)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
                  ${limite === op ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                {fmt(op * 1000)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 mb-5">
            <input
              type="number" min={0} value={limite}
              onChange={e => setLimite(Number(e.target.value))}
              className="flex-1 px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-slate-400"
            />
            <span className="text-sm text-on-surface-variant font-semibold">× 1,000 tokens</span>
          </div>
          <div className="flex gap-2">
            <button onClick={bloquear} disabled={saving}
              className="px-4 py-2.5 rounded-full border-2 border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-all disabled:opacity-40 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">block</span>
              Bloquear IA
            </button>
            <button onClick={() => guardar()} disabled={saving}
              className="flex-1 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1.5">
              {saving
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>}
              Guardar límite
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function AdminTokens() {
  const [usuarios,   setUsuarios]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [editando,   setEditando]   = useState(null)
  const [ordenar,    setOrdenar]    = useState('consumed') // consumed | limit | name
  const [ultimaAct,  setUltimaAct]  = useState(null)
  const [autoRef,    setAutoRef]    = useState(true)
  const intervalRef = useRef(null)

  const cargar = useCallback(async () => {
    try {
      // 1. Todos los registros de tokens IA
      const { data: tokens } = await supabase
        .from('user_ai_tokens')
        .select('user_id, purchase_id, tokens_used, tokens_limit')

      if (!tokens?.length) { setUsuarios([]); setLoading(false); return }

      const userIds = [...new Set(tokens.map(t => t.user_id))]

      // 2. Info de usuarios
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name, avatar_url')
        .in('id', userIds)

      const usersMap = {}
      for (const u of users || []) usersMap[u.id] = u

      // 3. Consumo por modelo este mes
      const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
      const { data: logs } = await supabase
        .from('user_ai_usage_log')
        .select('user_id, modelo, tokens_total')
        .in('user_id', userIds)
        .gte('created_at', inicioMes)

      // Agrupar por user + modelo
      const byUser = {}
      for (const l of logs || []) {
        if (!byUser[l.user_id]) byUser[l.user_id] = { gemini: 0, deepseek: 0 }
        const isGemini = l.modelo?.toLowerCase().includes('gemini')
        if (isGemini) byUser[l.user_id].gemini += l.tokens_total || 0
        else          byUser[l.user_id].deepseek += l.tokens_total || 0
      }

      // Combinar todo
      const resultado = tokens.map(t => ({
        user_id:       t.user_id,
        purchase_id:   t.purchase_id,
        email:         usersMap[t.user_id]?.email || '—',
        full_name:     usersMap[t.user_id]?.full_name || '',
        avatar_url:    usersMap[t.user_id]?.avatar_url || null,
        tokens_used:   t.tokens_used || 0,
        tokens_limit:  t.tokens_limit || 1_000_000,
        gemini:        byUser[t.user_id]?.gemini  || 0,
        deepseek:      byUser[t.user_id]?.deepseek || 0,
        tiene_registro: true,
        bloqueado:     (t.tokens_limit || 0) <= (t.tokens_used || 0) && (t.tokens_used || 0) > 0,
      }))

      setUsuarios(resultado)
      setUltimaAct(new Date())
    } catch (e) {
      console.error('Error cargando tokens:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (autoRef) {
      intervalRef.current = setInterval(cargar, 30_000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [autoRef, cargar])

  // Supabase real-time
  useEffect(() => {
    const channel = supabase
      .channel('tokens-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_ai_tokens' }, cargar)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [cargar])

  const totalUsado    = usuarios.reduce((s, u) => s + u.tokens_used,  0)
  const totalGemini   = usuarios.reduce((s, u) => s + u.gemini,       0)
  const totalDeepseek = usuarios.reduce((s, u) => s + u.deepseek,     0)
  const bloqueados    = usuarios.filter(u => u.bloqueado).length

  const ordenados = [...usuarios].sort((a, b) => {
    if (ordenar === 'consumed') return b.tokens_used - a.tokens_used
    if (ordenar === 'limit')    return b.tokens_limit - a.tokens_limit
    return (a.full_name || a.email).localeCompare(b.full_name || b.email)
  })

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 space-y-8">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-white text-2xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>monitoring</span>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Consumo de Tokens IA</h1>
              <p className="text-xs text-on-surface-variant">Control de uso Gemini + DeepSeek por usuario</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Indicador live */}
          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <div className={`w-2 h-2 rounded-full ${autoRef ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            {ultimaAct ? `Actualizado ${ultimaAct.toLocaleTimeString('es-CO')}` : 'Cargando...'}
          </div>
          <button onClick={() => setAutoRef(v => !v)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${autoRef ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            {autoRef ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button onClick={cargar}
            className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">refresh</span>
            Recargar
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total consumido este mes"
          value={fmt(totalUsado)}
          sub={`de ${fmt(usuarios.length * 1_000_000)} disponibles`}
          icon="token"
          color="bg-slate-800"
        />
        <StatCard
          label="Gemini"
          value={fmt(totalGemini)}
          sub={`${usuarios.length > 0 ? Math.round((totalGemini / (totalGemini + totalDeepseek || 1)) * 100) : 0}% del total`}
          icon="smart_toy"
          color="bg-blue-600"
        />
        <StatCard
          label="DeepSeek"
          value={fmt(totalDeepseek)}
          sub={`${usuarios.length > 0 ? Math.round((totalDeepseek / (totalGemini + totalDeepseek || 1)) * 100) : 0}% del total`}
          icon="memory"
          color="bg-violet-600"
        />
        <StatCard
          label="Usuarios con IA"
          value={usuarios.length}
          sub={bloqueados > 0 ? `${bloqueados} bloqueado${bloqueados > 1 ? 's' : ''}` : 'Todos activos'}
          icon="group"
          color={bloqueados > 0 ? 'bg-red-600' : 'bg-emerald-600'}
        />
      </div>

      {/* ── Tabla de usuarios ── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-base">Usuarios con acceso IA</h2>
          <div className="flex gap-1.5">
            {[
              { key: 'consumed', label: 'Mayor consumo' },
              { key: 'limit',   label: 'Mayor límite' },
              { key: 'name',    label: 'Nombre A-Z' },
            ].map(o => (
              <button key={o.key} onClick={() => setOrdenar(o.key)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all
                  ${ordenar === o.key ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : ordenados.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-center px-4">
            <span className="material-symbols-outlined text-slate-300 text-5xl"
              style={{ fontVariationSettings: "'FILL' 1" }}>token</span>
            <p className="font-bold text-sm text-on-surface">Sin registros de consumo aún</p>
            <p className="text-xs text-on-surface-variant max-w-xs">Aparecerán aquí cuando los usuarios generen simulacros IA o usen el chat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Usuario</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Gemini</th>
                  <th className="text-right px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">DeepSeek</th>
                  <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Consumo</th>
                  <th className="text-center px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Estado</th>
                  <th className="text-center px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ordenados.map(u => {
                  const p = pct(u.tokens_used, u.tokens_limit)
                  return (
                    <tr key={u.user_id + u.purchase_id}
                      className={`hover:bg-slate-50 transition-colors ${u.bloqueado ? 'bg-red-50/40' : ''}`}>
                      {/* Usuario */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {u.avatar_url
                            ? <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                            : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                {iniciales(u.full_name || u.email)}
                              </div>
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-bold truncate max-w-[180px]">{u.full_name || 'Sin nombre'}</p>
                            <p className="text-[10px] text-on-surface-variant truncate max-w-[180px]">{u.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Gemini */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold text-blue-700">{fmt(u.gemini)}</span>
                          <span className="text-[9px] text-on-surface-variant font-mono">tokens</span>
                        </div>
                      </td>

                      {/* DeepSeek */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-bold text-violet-700">{fmt(u.deepseek)}</span>
                          <span className="text-[9px] text-on-surface-variant font-mono">tokens</span>
                        </div>
                      </td>

                      {/* Barra de consumo */}
                      <td className="px-4 py-4 min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${colorBarra(p)}`}
                              style={{ width: `${p}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-on-surface-variant w-8 text-right shrink-0">{p}%</span>
                        </div>
                        <p className="text-[9px] text-on-surface-variant mt-0.5 font-mono">
                          {fmt(u.tokens_used)} / {fmt(u.tokens_limit)}
                        </p>
                      </td>

                      {/* Estado */}
                      <td className="px-4 py-4 text-center">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${colorBadge(p)}`}>
                          {u.bloqueado ? '🚫 Bloqueado' : p >= 90 ? '⚠️ Crítico' : p >= 70 ? '⚡ Alto' : '✅ Normal'}
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => setEditando(u)}
                          className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-bold text-on-surface-variant hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center gap-1.5 mx-auto">
                          <span className="material-symbols-outlined text-sm">tune</span>
                          Gestionar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Nota ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-xs font-bold text-blue-800 mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            Gemini vs DeepSeek
          </p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Ambos consumen del mismo límite mensual del usuario. La columna muestra el desglose de este mes para saber qué cerebro usa más cada usuario.
          </p>
        </div>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
            Límite personalizado
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Si un usuario abusa, usa <strong>Gestionar</strong> para reducirle el límite o bloquearle el acceso IA. El bloqueo es inmediato.
          </p>
        </div>
      </div>

      {/* Modal editar límite */}
      {editando && (
        <ModalLimite
          usuario={editando}
          onClose={() => setEditando(null)}
          onGuardado={cargar}
        />
      )}
    </div>
  )
}
