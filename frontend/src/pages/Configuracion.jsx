import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { key: 'perfil',         icon: 'person',               label: 'Perfil'         },
  { key: 'seguridad',      icon: 'security',             label: 'Seguridad'      },
  { key: 'suscripcion',    icon: 'payments',             label: 'Suscripción'    },
  { key: 'notificaciones', icon: 'notifications_active', label: 'Notificaciones' },
  { key: 'preferencias',   icon: 'settings_suggest',     label: 'Preferencias'   },
]

// ── Utilidad: fecha legible ──────────────────────────────────────────────────
function fechaLegible(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'long' })
}

// ── Toast simple ─────────────────────────────────────────────────────────────
function Toast({ msg, tipo }) {
  if (!msg) return null
  return (
    <div className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm animate-fade-in
      ${tipo === 'ok' ? 'bg-secondary text-white' : 'bg-error text-white'}`}>
      <span className="material-symbols-outlined text-lg"
        style={{ fontVariationSettings: "'FILL' 1" }}>
        {tipo === 'ok' ? 'check_circle' : 'error'}
      </span>
      {msg}
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${on ? 'bg-primary' : 'bg-surface-container-highest'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${on ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function TabPerfil({ user, perfil, onSave, saving }) {
  const [form, setForm]     = useState({ full_name: '', level: '' })
  const [avatar, setAvatar] = useState(null)
  const [preview, setPreview] = useState(null)
  const fileRef             = useRef()

  useEffect(() => {
    setForm({
      full_name: perfil?.full_name || user?.user_metadata?.full_name || '',
      level:     perfil?.level || 'basico',
    })
  }, [perfil, user])

  function handleAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    setAvatar(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    let avatarUrl = null
    if (avatar) {
      const ext  = avatar.name.split('.').pop()
      const path = `avatars/${user.id}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, avatar, { upsert: true })
      if (!upErr) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = data.publicUrl
      }
    }
    await onSave({ full_name: form.full_name, level: form.level, ...(avatarUrl ? { avatar_url: avatarUrl } : {}) })
  }

  const avatarSrc = preview
    || perfil?.avatar_url
    || user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.full_name || 'U')}&background=003d9b&color=fff&size=128`

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold font-headline">Información de Perfil</h3>
        </div>

        <div className="card p-4 md:p-8 space-y-6 md:space-y-8">
          {/* Avatar */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative group">
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-4 border-surface-container-low"
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg hover:scale-110 transition-transform"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <div>
              <p className="font-bold">Foto de perfil</p>
              <p className="text-sm text-on-surface-variant">JPG, PNG o GIF. Máximo 2MB.</p>
              {preview && (
                <p className="text-xs text-primary mt-1 font-semibold">
                  ✓ Nueva foto seleccionada — guarda para aplicar
                </p>
              )}
            </div>
          </div>

          {/* Campos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant ml-1">Nombre completo</label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-on-surface-variant ml-1">Correo electrónico</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant/20 font-medium text-on-surface-variant cursor-not-allowed"
              />
              <p className="text-xs text-on-surface-variant ml-1">El correo no se puede cambiar</p>
            </div>
          </div>

          {/* Tipo de perfil */}
          <div className="space-y-3">
            <label className="text-sm font-bold text-on-surface-variant ml-1">Tipo de perfil</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { val: 'basico',      icon: 'school',    label: 'Estudiante',    desc: 'Preparación ICFES' },
                { val: 'intermedio',  icon: 'work',      label: 'Profesional',   desc: 'Convocatorias CNSC' },
                { val: 'avanzado',    icon: 'military_tech', label: 'Especialista', desc: 'Alto nivel' },
              ].map(opt => (
                <label key={opt.val} className="cursor-pointer">
                  <input
                    type="radio"
                    name="level"
                    value={opt.val}
                    checked={form.level === opt.val}
                    onChange={() => setForm(f => ({ ...f, level: opt.val }))}
                    className="sr-only"
                  />
                  <div className={`p-4 rounded-xl border-2 transition-all ${
                    form.level === opt.val
                      ? 'border-primary bg-primary-fixed/50'
                      : 'border-outline-variant/30 hover:border-outline'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined ${form.level === opt.val ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {opt.icon}
                      </span>
                      <div>
                        <p className="font-bold text-sm">{opt.label}</p>
                        <p className="text-xs text-on-surface-variant">{opt.desc}</p>
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="btn-primary px-8 py-3 flex items-center gap-2"
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando…</>
                : <><span className="material-symbols-outlined text-lg">save</span>Guardar cambios</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Seguridad ────────────────────────────────────────────────────────────
function TabSeguridad({ user, onToast }) {
  const [form, setForm]   = useState({ nueva: '', confirmar: '' })
  const [saving, setSaving] = useState(false)
  const [show, setShow]   = useState({ nueva: false, confirmar: false })
  const esGoogle = user?.app_metadata?.provider === 'google'

  async function cambiarPassword() {
    if (form.nueva.length < 8) {
      onToast('La contraseña debe tener al menos 8 caracteres', 'err'); return
    }
    if (form.nueva !== form.confirmar) {
      onToast('Las contraseñas no coinciden', 'err'); return
    }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: form.nueva })
    setSaving(false)
    if (error) onToast('Error al cambiar contraseña', 'err')
    else { onToast('Contraseña actualizada', 'ok'); setForm({ nueva: '', confirmar: '' }) }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold font-headline">Seguridad</h3>

      <div className="card p-4 md:p-8 space-y-6 md:space-y-8">
        {esGoogle ? (
          <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-container border border-outline-variant/20">
            <span className="material-symbols-outlined text-tertiary mt-0.5">info</span>
            <div>
              <p className="font-semibold text-sm">Cuenta vinculada con Google</p>
              <p className="text-xs text-on-surface-variant mt-1">
                Tu cuenta usa Google OAuth. Administra tu contraseña desde tu cuenta de Google.
              </p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant">
              Elige una contraseña segura de al menos 8 caracteres.
            </p>
            {[
              { key: 'nueva',     label: 'Nueva contraseña'    },
              { key: 'confirmar', label: 'Confirmar contraseña' },
            ].map(f => (
              <div key={f.key} className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant ml-1">{f.label}</label>
                <div className="relative">
                  <input
                    type={show[f.key] ? 'text' : 'password'}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {show[f.key] ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            ))}

            {/* Indicador fortaleza */}
            {form.nueva && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${
                      form.nueva.length >= i * 3
                        ? form.nueva.length >= 12 ? 'bg-secondary'
                          : form.nueva.length >= 9 ? 'bg-tertiary'
                          : 'bg-error'
                        : 'bg-surface-container-highest'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant">
                  {form.nueva.length < 8 ? 'Muy corta'
                    : form.nueva.length < 12 ? 'Aceptable'
                    : 'Contraseña fuerte'}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={cambiarPassword}
                disabled={saving}
                className="btn-primary px-8 py-3 flex items-center gap-2"
              >
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando…</>
                  : <><span className="material-symbols-outlined text-lg">lock_reset</span>Cambiar contraseña</>
                }
              </button>
            </div>
          </>
        )}

        {/* Info de sesión */}
        <div className="border-t border-outline-variant/20 pt-6">
          <p className="text-sm font-bold mb-3">Información de sesión</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-on-surface-variant">
            <div className="bg-surface-container p-3 rounded-xl">
              <p className="font-semibold text-on-surface mb-1">Proveedor</p>
              <p className="capitalize">{user?.app_metadata?.provider || 'email'}</p>
            </div>
            <div className="bg-surface-container p-3 rounded-xl">
              <p className="font-semibold text-on-surface mb-1">Último acceso</p>
              <p>{fechaLegible(user?.last_sign_in_at)}</p>
            </div>
            <div className="bg-surface-container p-3 rounded-xl">
              <p className="font-semibold text-on-surface mb-1">Cuenta creada</p>
              <p>{fechaLegible(user?.created_at)}</p>
            </div>
            <div className="bg-surface-container p-3 rounded-xl">
              <p className="font-semibold text-on-surface mb-1">ID de usuario</p>
              <p className="font-mono truncate">{user?.id?.slice(0, 16)}…</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Suscripción ──────────────────────────────────────────────────────────
function TabSuscripcion({ userId }) {
  const navigate   = useNavigate()
  const [plan, setPlan]           = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { cargar() }, [userId])

  async function cargar() {
    setLoading(true)
    try {
      // Plan activo
      const hoy = new Date().toISOString()
      const { data: compras } = await supabase
        .from('purchases')
        .select(`id, start_date, end_date, status, packages(name, price, type)`)
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', hoy)
        .order('end_date', { ascending: false })
        .limit(1)

      setPlan(compras?.[0] || null)

      // Historial
      const { data: hist } = await supabase
        .from('purchases')
        .select(`id, start_date, end_date, status, packages(name, price)`)
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
        .limit(10)

      setHistorial(hist || [])
    } finally {
      setLoading(false)
    }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-surface-container rounded-3xl" />
      <div className="h-32 bg-surface-container rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold font-headline">Suscripción</h3>

      {/* Plan actual */}
      {plan ? (
        <div className="rounded-3xl p-8 bg-gradient-to-br from-primary to-[#0040a2] text-white flex flex-col sm:flex-row justify-between gap-6">
          <div>
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black tracking-widest uppercase mb-4">
              Plan Activo
            </span>
            <h4 className="text-3xl font-extrabold mb-1">{plan.packages?.name}</h4>
            <p className="text-white/70 text-sm">Vence el {fechaLegible(plan.end_date)}</p>
          </div>
          <div className="flex flex-col items-start sm:items-end justify-between gap-4">
            <p className="text-2xl font-bold">
              ${plan.packages?.price?.toLocaleString('es-CO')}
              <span className="text-sm font-normal opacity-70"> COP</span>
            </p>
            <button
              onClick={() => navigate('/planes')}
              className="bg-white text-primary px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform"
            >
              Mejorar plan
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">
            card_membership
          </span>
          <p className="font-bold text-on-surface mb-2">Sin plan activo</p>
          <p className="text-sm text-on-surface-variant mb-6">
            Activa un plan para acceder a todos los simulacros.
          </p>
          <button
            onClick={() => navigate('/planes')}
            className="btn-primary px-8 py-3 inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            Ver planes
          </button>
        </div>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-bold text-sm">Historial de compras</p>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {historial.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-6 py-4">
                <span className="material-symbols-outlined text-on-surface-variant">receipt_long</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{h.packages?.name}</p>
                  <p className="text-xs text-on-surface-variant">{fechaLegible(h.start_date)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                  h.status === 'active'
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container-high text-on-surface-variant'
                }`}>
                  {h.status === 'active' ? 'Activo' : 'Vencido'}
                </span>
                <p className="font-bold text-sm flex-shrink-0">
                  ${h.packages?.price?.toLocaleString('es-CO')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Notificaciones ───────────────────────────────────────────────────────
function TabNotificaciones() {
  const [prefs, setPrefs] = useState({
    resultados:    true,
    recordatorios: true,
    novedades:     false,
    tips:          true,
  })

  const items = [
    { key: 'resultados',    icon: 'quiz',          label: 'Resultados de simulacros', desc: 'Cuando termines un intento' },
    { key: 'recordatorios', icon: 'alarm',         label: 'Recordatorios de estudio', desc: 'Metas semanales y racha diaria' },
    { key: 'novedades',     icon: 'campaign',      label: 'Novedades y actualizaciones', desc: 'Nuevos simulacros disponibles' },
    { key: 'tips',          icon: 'lightbulb',     label: 'Tips de preparación', desc: 'Consejos personalizados' },
  ]

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold font-headline">Notificaciones</h3>
      <div className="card p-6 space-y-1">
        {items.map((item, i) => (
          <div key={item.key}>
            <div className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">{item.icon}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.desc}</p>
              </div>
              <Toggle on={prefs[item.key]} onChange={v => setPrefs(p => ({ ...p, [item.key]: v }))} />
            </div>
            {i < items.length - 1 && <div className="border-b border-outline-variant/10" />}
          </div>
        ))}
      </div>
      <div className="card p-4 flex items-start gap-3 border border-outline-variant/20 bg-surface-container-low">
        <span className="material-symbols-outlined text-on-surface-variant text-sm mt-0.5">info</span>
        <p className="text-xs text-on-surface-variant">
          Las notificaciones por correo electrónico están disponibles solo en planes activos.
        </p>
      </div>
    </div>
  )
}

// ── Tab: Preferencias ─────────────────────────────────────────────────────────
function TabPreferencias({ onToast }) {
  const [prefs, setPrefs] = useState({
    modoOscuro:     false,
    idioma:         'es-CO',
    autoguardar:    true,
    sonidos:        false,
    timerVisible:   true,
  })

  const items = [
    { key: 'modoOscuro',   icon: 'dark_mode',    label: 'Modo oscuro',             desc: 'Próximamente disponible' , disabled: true },
    { key: 'autoguardar',  icon: 'save',         label: 'Autoguardar respuestas',  desc: 'Guarda cada respuesta al seleccionarla' },
    { key: 'sonidos',      icon: 'volume_up',    label: 'Sonidos de interfaz',     desc: 'Efectos al responder preguntas' },
    { key: 'timerVisible', icon: 'timer',        label: 'Timer siempre visible',   desc: 'Muestra el contador de tiempo en pantalla' },
  ]

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold font-headline">Preferencias</h3>

      <div className="card p-6 space-y-1">
        {items.map((item, i) => (
          <div key={item.key}>
            <div className={`flex items-center gap-4 py-4 ${item.disabled ? 'opacity-50' : ''}`}>
              <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-lg">{item.icon}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.desc}</p>
              </div>
              <Toggle
                on={prefs[item.key]}
                onChange={v => !item.disabled && setPrefs(p => ({ ...p, [item.key]: v }))}
              />
            </div>
            {i < items.length - 1 && <div className="border-b border-outline-variant/10" />}
          </div>
        ))}
      </div>

      {/* Idioma */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">language</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Idioma</p>
            <p className="text-xs text-on-surface-variant">Idioma de la interfaz</p>
          </div>
          <select
            value={prefs.idioma}
            onChange={e => setPrefs(p => ({ ...p, idioma: e.target.value }))}
            className="px-3 py-2 rounded-xl bg-surface-container-high border border-outline-variant/30 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="es-CO">Español (Colombia)</option>
            <option value="es">Español</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => onToast('Preferencias guardadas', 'ok')}
          className="btn-primary px-8 py-3 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          Guardar preferencias
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Configuracion() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('perfil')
  const [perfil, setPerfil]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState({ msg: '', tipo: 'ok' })

  useEffect(() => { if (user) cargarPerfil() }, [user])

  async function cargarPerfil() {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    setPerfil(data)
  }

  function onToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: 'ok' }), 3000)
  }

  async function onSave(cambios) {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      await cargarPerfil()
      onToast('Cambios guardados correctamente', 'ok')
    } catch {
      onToast('Error al guardar los cambios', 'err')
    } finally {
      setSaving(false)
    }
  }

  const avatarSrc = perfil?.avatar_url
    || user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil?.full_name || user?.email || 'U')}&background=003d9b&color=fff&size=128`

  const nombreMostrado = perfil?.full_name || user?.user_metadata?.full_name || user?.email || 'Usuario'

  return (
    <div className="p-4 md:p-6 pb-24 max-w-5xl animate-fade-in">

      {/* ── Header de usuario ── */}
      <div className="flex items-center gap-3 mb-6 p-4 card overflow-hidden">
        <img
          src={avatarSrc}
          alt="Avatar"
          className="w-12 h-12 md:w-16 md:h-16 rounded-full object-cover border-4 border-surface-container-low flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-2xl font-extrabold font-headline truncate">{nombreMostrado}</h1>
          <p className="text-sm text-on-surface-variant truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-xs font-semibold text-secondary capitalize">
              {perfil?.level || 'básico'}
            </span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1">
          <p className="text-xs text-on-surface-variant">Miembro desde</p>
          <p className="text-sm font-bold">{fechaLegible(user?.created_at)}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── Sidebar de tabs ── */}
        <nav className="lg:w-56 flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTabActiva(t.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                tabActiva === t.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: tabActiva === t.key ? "'FILL' 1" : "'FILL' 0" }}>
                {t.icon}
              </span>
              <span className="hidden sm:inline lg:inline">{t.label}</span>
            </button>
          ))}
        </nav>

        {/* ── Contenido del tab ── */}
        <div className="flex-1 min-w-0">
          {tabActiva === 'perfil' && (
            <TabPerfil user={user} perfil={perfil} onSave={onSave} saving={saving} />
          )}
          {tabActiva === 'seguridad' && (
            <TabSeguridad user={user} onToast={onToast} />
          )}
          {tabActiva === 'suscripcion' && (
            <TabSuscripcion userId={user?.id} />
          )}
          {tabActiva === 'notificaciones' && (
            <TabNotificaciones />
          )}
          {tabActiva === 'preferencias' && (
            <TabPreferencias onToast={onToast} />
          )}
        </div>
      </div>

      <Toast msg={toast.msg} tipo={toast.tipo} />
    </div>
  )
}