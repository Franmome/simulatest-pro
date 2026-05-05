import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useLang } from '../context/LangContext'
import { LANGUAGES } from '../i18n/translations'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fechaLegible(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', { dateStyle: 'long' })
}

function playBeep(type = 'select') {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    if (type === 'correct') {
      osc.frequency.value = 880; osc.type = 'sine'
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    } else if (type === 'wrong') {
      osc.frequency.value = 200; osc.type = 'sawtooth'
      gain.gain.setValueAtTime(0.18, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    } else {
      osc.frequency.value = 440; osc.type = 'sine'
      gain.gain.setValueAtTime(0.12, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12)
    }
    osc.start(); osc.stop(ctx.currentTime + 0.45)
  } catch (_) {}
}
export { playBeep }

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, tipo }) {
  if (!msg) return null
  return (
    <div className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl font-semibold text-sm animate-fade-in
      ${tipo === 'ok' ? 'bg-secondary text-white' : 'bg-error text-white'}`}>
      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
        {tipo === 'ok' ? 'check_circle' : 'error'}
      </span>
      {msg}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!on)} disabled={disabled}
      className={`w-12 h-6 rounded-full relative transition-colors duration-300 flex-shrink-0
        ${on ? 'bg-primary' : 'bg-surface-container-highest'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${on ? 'left-7' : 'left-1'}`} />
    </button>
  )
}

// ── Tab: Perfil ───────────────────────────────────────────────────────────────
function TabPerfil({ user, perfil, onSave, saving, onToast }) {
  const { t } = useLang()
  const [form, setForm] = useState({
    full_name: '', level: 'basico',
    phone: '', documento_tipo: 'CC', documento_numero: '',
    ciudad: '', departamento: '', direccion: '',
  })
  const [avatar,     setAvatar]   = useState(null)
  const [preview,    setPreview]  = useState(null)
  const [uploading,  setUploading]= useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!perfil && !user) return
    setForm({
      full_name:       perfil?.full_name        || user?.user_metadata?.full_name || '',
      level:           perfil?.level            || 'basico',
      phone:           perfil?.phone            || '',
      documento_tipo:  perfil?.documento_tipo   || 'CC',
      documento_numero:perfil?.documento_numero || '',
      ciudad:          perfil?.ciudad           || '',
      departamento:    perfil?.departamento     || '',
      direccion:       perfil?.direccion        || '',
    })
  }, [perfil, user])

  function handleAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { onToast('La foto no puede superar 2 MB', 'err'); return }
    setAvatar(file)
    setPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    let avatarUrl = null
    if (avatar) {
      setUploading(true)
      try {
        const ext  = avatar.name.split('.').pop().toLowerCase()
        const path = `avatars/${user.id}_${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('avatars').upload(path, avatar, { upsert: true, contentType: avatar.type })
        if (upErr) {
          onToast(t('config.perfil.uploadError'), 'err')
        } else {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path)
          avatarUrl = data.publicUrl
        }
      } finally {
        setUploading(false)
      }
    }
    await onSave({
      full_name:        form.full_name,
      level:            form.level,
      phone:            form.phone,
      documento_tipo:   form.documento_tipo,
      documento_numero: form.documento_numero,
      ciudad:           form.ciudad,
      departamento:     form.departamento,
      direccion:        form.direccion,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    })
    if (avatarUrl) { setAvatar(null); setPreview(null) }
  }

  const avatarSrc = preview || perfil?.avatar_url || user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(form.full_name || 'U')}&background=003d9b&color=fff&size=128`

  const INPUT = 'w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary font-medium text-on-surface transition-all'

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('config.perfil.title')}</h3>

      <div className="card p-6 md:p-8 space-y-7">
        {/* Avatar */}
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <img src={avatarSrc} alt="Avatar"
              className="w-24 h-24 rounded-full object-cover border-4 border-surface-container-low shadow-md" />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-2xl">photo_camera</span>
            </div>
            <div className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full shadow-lg border-2 border-white">
              <span className="material-symbols-outlined text-sm">edit</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>
          <div>
            <p className="font-bold">{t('config.perfil.photo')}</p>
            <p className="text-sm text-on-surface-variant">{t('config.perfil.photoHint')}</p>
            {preview && <p className="text-xs text-primary mt-1 font-semibold">{t('config.perfil.photoNewSelected')}</p>}
          </div>
        </div>

        {/* Campos básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('config.perfil.fullName')}</label>
            <input type="text" value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className={INPUT} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('config.perfil.email')}</label>
            <input type="email" value={user?.email || ''} disabled
              className={`${INPUT} opacity-50 cursor-not-allowed`} />
            <p className="text-xs text-on-surface-variant ml-1">{t('config.perfil.emailHint')}</p>
          </div>
        </div>

        {/* Tipo de perfil */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">{t('config.perfil.profileType')}</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { val: 'basico',     icon: 'school',         label: 'Estudiante',   desc: 'Preparación ICFES' },
              { val: 'intermedio', icon: 'work',           label: 'Profesional',  desc: 'Convocatorias CNSC' },
              { val: 'avanzado',   icon: 'military_tech',  label: 'Especialista', desc: 'Alto nivel' },
            ].map(opt => (
              <label key={opt.val} className="cursor-pointer">
                <input type="radio" name="level" value={opt.val}
                  checked={form.level === opt.val}
                  onChange={() => setForm(f => ({ ...f, level: opt.val }))}
                  className="sr-only" />
                <div className={`p-4 rounded-xl border-2 transition-all ${form.level === opt.val ? 'border-primary bg-primary/10' : 'border-outline-variant/30 hover:border-outline'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`material-symbols-outlined ${form.level === opt.val ? 'text-primary' : 'text-on-surface-variant'}`}>{opt.icon}</span>
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

        {/* Datos de facturación */}
        <div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            {t('config.perfil.billingTitle')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Tipo documento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant ml-1">{t('config.perfil.docType')}</label>
              <select value={form.documento_tipo}
                onChange={e => setForm(f => ({ ...f, documento_tipo: e.target.value }))}
                className={INPUT}>
                {['CC','CE','NIT','TI','Pasaporte','PPT'].map(d => (
                  <option key={d} value={d}>{d === 'CC' ? 'Cédula de Ciudadanía (CC)' : d === 'CE' ? 'Cédula de Extranjería (CE)' : d === 'NIT' ? 'NIT' : d === 'TI' ? 'Tarjeta de Identidad (TI)' : d === 'PPT' ? 'Permiso de Protección Temporal (PPT)' : d}</option>
                ))}
              </select>
            </div>

            {/* Número documento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant ml-1">{t('config.perfil.docNumber')}</label>
              <input type="text" value={form.documento_numero}
                onChange={e => setForm(f => ({ ...f, documento_numero: e.target.value }))}
                placeholder="1234567890"
                className={INPUT} />
            </div>

            {/* Teléfono */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant ml-1">{t('config.perfil.phone')}</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-surface-container-high border border-outline-variant/30 rounded-xl text-sm text-on-surface-variant font-semibold select-none">🇨🇴 +57</span>
                <input type="tel" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="300 000 0000"
                  className={`${INPUT} flex-1`} />
              </div>
            </div>

            {/* Ciudad */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant ml-1">{t('config.perfil.city')}</label>
              <input type="text" value={form.ciudad}
                onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))}
                placeholder="Bogotá, Medellín, Cali…"
                className={INPUT} />
            </div>

            {/* Departamento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-on-surface-variant ml-1">{t('config.perfil.dept')}</label>
              <select value={form.departamento}
                onChange={e => setForm(f => ({ ...f, departamento: e.target.value }))}
                className={INPUT}>
                <option value="">Seleccionar…</option>
                {['Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas','Caquetá','Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare','Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo','Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima','Valle del Cauca','Vaupés','Vichada','Bogotá D.C.'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Dirección */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs font-bold text-on-surface-variant ml-1">{t('config.perfil.address')}</label>
              <input type="text" value={form.direccion}
                onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                placeholder="Cra 7 # 45-32, Apto 301"
                className={INPUT} />
            </div>

          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={handleSubmit} disabled={saving || uploading}
            className="btn-primary px-8 py-3 flex items-center gap-2">
            {(saving || uploading)
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving')}</>
              : <><span className="material-symbols-outlined text-lg">save</span>{t('config.perfil.saveBtn')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Seguridad ────────────────────────────────────────────────────────────
function TabSeguridad({ user, onToast }) {
  const { t } = useLang()
  const [form,   setForm]   = useState({ nueva: '', confirmar: '' })
  const [saving, setSaving] = useState(false)
  const [show,   setShow]   = useState({ nueva: false, confirmar: false })
  const esGoogle = user?.app_metadata?.provider === 'google'
    || (user?.app_metadata?.providers || []).includes('google')

  async function cambiarPassword() {
    if (form.nueva.length < 8) { onToast(t('config.seguridad.passShort'), 'err'); return }
    if (form.nueva !== form.confirmar) { onToast(t('config.seguridad.passMismatch'), 'err'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: form.nueva })
    setSaving(false)
    if (error) onToast(t('config.seguridad.passError'), 'err')
    else { onToast(t('config.seguridad.passSuccess'), 'ok'); setForm({ nueva: '', confirmar: '' }) }
  }

  const INPUT = 'w-full px-4 py-3 pr-12 rounded-xl bg-surface-container-low border border-outline-variant/30 focus:outline-none focus:ring-2 focus:ring-primary text-on-surface'

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('config.seguridad.title')}</h3>
      <div className="card p-6 md:p-8 space-y-6">

        {esGoogle ? (
          <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-blue-600" style={{ fontVariationSettings: "'FILL' 1" }}>g_mobiledata</span>
            </div>
            <div>
              <p className="font-bold text-sm">{t('config.seguridad.googleAccount')}</p>
              <p className="text-xs text-on-surface-variant mt-1">{t('config.seguridad.googleHint')}</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-on-surface-variant">{t('config.seguridad.passHint')}</p>
            {[
              { key: 'nueva',     label: t('config.seguridad.newPass') },
              { key: 'confirmar', label: t('config.seguridad.confirmPass') },
            ].map(f => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-widest ml-1">{f.label}</label>
                <div className="relative">
                  <input type={show[f.key] ? 'text' : 'password'} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={INPUT} placeholder="••••••••" />
                  <button type="button" onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined text-lg">{show[f.key] ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>
            ))}

            {form.nueva && (
              <div className="space-y-1.5">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
                      form.nueva.length >= i * 3
                        ? form.nueva.length >= 12 ? 'bg-secondary' : form.nueva.length >= 9 ? 'bg-tertiary' : 'bg-error'
                        : 'bg-surface-container-highest'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant">
                  {form.nueva.length < 8 ? t('config.seguridad.passStrength.short')
                    : form.nueva.length < 12 ? t('config.seguridad.passStrength.ok')
                    : t('config.seguridad.passStrength.strong')}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={cambiarPassword} disabled={saving}
                className="btn-primary px-8 py-3 flex items-center gap-2">
                {saving
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving')}</>
                  : <><span className="material-symbols-outlined text-lg">lock_reset</span>{t('config.seguridad.changePass')}</>}
              </button>
            </div>
          </>
        )}

        <div className="border-t border-outline-variant/20 pt-6">
          <p className="text-sm font-bold mb-4">{t('config.seguridad.session')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-on-surface-variant">
            {[
              { label: t('config.seguridad.provider'),   val: user?.app_metadata?.provider || 'email', icon: 'key' },
              { label: t('config.seguridad.lastAccess'), val: fechaLegible(user?.last_sign_in_at),      icon: 'login' },
              { label: t('config.seguridad.created'),    val: fechaLegible(user?.created_at),           icon: 'calendar_today' },
              { label: t('config.seguridad.userId'),     val: user?.id?.slice(0, 16) + '…',            icon: 'badge' },
            ].map(r => (
              <div key={r.label} className="bg-surface-container p-3.5 rounded-xl flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-base mt-0.5">{r.icon}</span>
                <div>
                  <p className="font-semibold text-on-surface text-xs mb-0.5">{r.label}</p>
                  <p className="font-mono text-xs truncate capitalize">{r.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Suscripción ──────────────────────────────────────────────────────────
function TabSuscripcion({ userId }) {
  const navigate = useNavigate()
  const { t }    = useLang()
  const [plan, setPlan]           = useState(null)
  const [historial, setHistorial] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => { cargar() }, [userId])

  async function cargar() {
    setLoading(true)
    try {
      const hoy = new Date().toISOString()
      const { data: compras } = await supabase.from('purchases')
        .select('id, start_date, end_date, status, packages(name, price, type)')
        .eq('user_id', userId).eq('status', 'active').gte('end_date', hoy)
        .order('end_date', { ascending: false }).limit(1)
      setPlan(compras?.[0] || null)

      const { data: hist } = await supabase.from('purchases')
        .select('id, start_date, end_date, status, packages(name, price)')
        .eq('user_id', userId).order('start_date', { ascending: false }).limit(10)
      setHistorial(hist || [])
    } finally { setLoading(false) }
  }

  if (loading) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-48 bg-surface-container rounded-3xl" />
      <div className="h-32 bg-surface-container rounded-2xl" />
    </div>
  )

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('config.suscripcion.title')}</h3>

      {plan ? (
        <div className="rounded-3xl p-7 bg-gradient-to-br from-primary to-primary-container text-on-primary flex flex-col sm:flex-row justify-between gap-6 shadow-lg">
          <div>
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black tracking-widest uppercase mb-4">
              {t('config.suscripcion.activePlan')}
            </span>
            <h4 className="text-3xl font-extrabold mb-1">{plan.packages?.name}</h4>
            <p className="text-white/70 text-sm">{t('config.suscripcion.expires')} {fechaLegible(plan.end_date)}</p>
          </div>
          <div className="flex flex-col items-start sm:items-end justify-between gap-4">
            <p className="text-2xl font-bold">${plan.packages?.price?.toLocaleString('es-CO')}<span className="text-sm font-normal opacity-70"> COP</span></p>
            <button onClick={() => navigate('/planes')}
              className="bg-white text-primary px-6 py-2 rounded-full font-bold text-sm hover:scale-105 transition-transform">
              {t('config.suscripcion.upgradePlan')}
            </button>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant opacity-30 mb-3 block">card_membership</span>
          <p className="font-bold mb-2">{t('config.suscripcion.noPlan')}</p>
          <p className="text-sm text-on-surface-variant mb-6">{t('config.suscripcion.noPlanHint')}</p>
          <button onClick={() => navigate('/planes')} className="btn-primary px-8 py-3 inline-flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            {t('config.suscripcion.seePlans')}
          </button>
        </div>
      )}

      {historial.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/20">
            <p className="font-bold text-sm">{t('config.suscripcion.purchaseHistory')}</p>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {historial.map(h => (
              <div key={h.id} className="flex items-center gap-4 px-6 py-4">
                <span className="material-symbols-outlined text-on-surface-variant">receipt_long</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{h.packages?.name}</p>
                  <p className="text-xs text-on-surface-variant">{fechaLegible(h.start_date)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${h.status === 'active' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {h.status === 'active' ? t('common.active') : 'Vencido'}
                </span>
                <p className="font-bold text-sm flex-shrink-0">${h.packages?.price?.toLocaleString('es-CO')}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Tab: Notificaciones ───────────────────────────────────────────────────────
function TabNotificaciones({ perfil, onSave, saving }) {
  const { t } = useLang()
  const [prefs, setPrefs] = useState({
    resultados: true, recordatorios: true, novedades: false, tips: true,
  })

  useEffect(() => {
    if (perfil?.notification_prefs) setPrefs(perfil.notification_prefs)
  }, [perfil])

  const items = [
    { key: 'resultados',    icon: 'quiz',      label: t('config.notificaciones.results'),    desc: t('config.notificaciones.resultsDesc') },
    { key: 'recordatorios', icon: 'alarm',     label: t('config.notificaciones.reminders'),  desc: t('config.notificaciones.remindersDesc') },
    { key: 'novedades',     icon: 'campaign',  label: t('config.notificaciones.news'),       desc: t('config.notificaciones.newsDesc') },
    { key: 'tips',          icon: 'lightbulb', label: t('config.notificaciones.tips'),       desc: t('config.notificaciones.tipsDesc') },
  ]

  function handleSave() { onSave({ notification_prefs: prefs }) }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('config.notificaciones.title')}</h3>
      <div className="card p-6 space-y-1">
        {items.map((item, i) => (
          <div key={item.key}>
            <div className="flex items-center gap-4 py-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
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
        <p className="text-xs text-on-surface-variant">{t('config.notificaciones.emailHint')}</p>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary px-8 py-3 flex items-center gap-2">
          {saving
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving')}</>
            : <><span className="material-symbols-outlined text-lg">notifications</span>{t('config.notificaciones.saveBtn')}</>}
        </button>
      </div>
    </div>
  )
}

// ── Tab: Preferencias ─────────────────────────────────────────────────────────
function TabPreferencias({ perfil, onSave, saving }) {
  const { t }            = useLang()
  const { dark, setDark }= useTheme()
  const { lang, changeLang } = useLang()

  const [prefs, setPrefs] = useState({
    autoguardar: true, sonidos: false, timerVisible: true,
  })

  useEffect(() => {
    const stored = localStorage.getItem('uiPrefs')
    if (stored) {
      try { setPrefs(JSON.parse(stored)) } catch (_) {}
    } else if (perfil?.ui_prefs) {
      const p = perfil.ui_prefs
      setPrefs({ autoguardar: p.autoguardar ?? true, sonidos: p.sonidos ?? false, timerVisible: p.timerVisible ?? true })
      if (p.modoOscuro !== undefined) setDark(p.modoOscuro)
    }
  }, [perfil])

  function handleToggle(key, val) {
    if (key === 'sonidos' && val) playBeep('select')
    const next = { ...prefs, [key]: val }
    setPrefs(next)
    localStorage.setItem('uiPrefs', JSON.stringify({ ...next, modoOscuro: dark }))
  }

  function handleSave() {
    const full = { ...prefs, modoOscuro: dark, idioma: lang }
    localStorage.setItem('uiPrefs', JSON.stringify(full))
    onSave({ ui_prefs: full })
  }

  const items = [
    { key: 'modoOscuro',  ctrl: dark,                  onChange: v => { setDark(v); handleToggle('modoOscuro', v) }, icon: 'dark_mode',  label: t('config.preferencias.darkMode'),  desc: t('config.preferencias.darkModeDesc') },
    { key: 'autoguardar', ctrl: prefs.autoguardar,      onChange: v => handleToggle('autoguardar', v),               icon: 'save',       label: t('config.preferencias.autosave'),  desc: t('config.preferencias.autosaveDesc') },
    { key: 'sonidos',     ctrl: prefs.sonidos,          onChange: v => handleToggle('sonidos', v),                   icon: 'volume_up',  label: t('config.preferencias.sounds'),    desc: t('config.preferencias.soundsDesc') },
    { key: 'timerVisible',ctrl: prefs.timerVisible,     onChange: v => handleToggle('timerVisible', v),              icon: 'timer',      label: t('config.preferencias.timer'),     desc: t('config.preferencias.timerDesc') },
  ]

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">{t('config.preferencias.title')}</h3>

      <div className="card p-6 space-y-1">
        {items.map((item, i) => (
          <div key={item.key}>
            <div className="flex items-center gap-4 py-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${item.key === 'modoOscuro' && dark ? 'bg-slate-700' : 'bg-primary/10'}`}>
                <span className={`material-symbols-outlined text-lg ${item.key === 'modoOscuro' && dark ? 'text-white' : 'text-primary'}`}
                  style={{ fontVariationSettings: item.ctrl ? "'FILL' 1" : "'FILL' 0" }}>
                  {item.icon}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{item.label}</p>
                <p className="text-xs text-on-surface-variant">{item.desc}</p>
              </div>
              <Toggle on={item.ctrl} onChange={item.onChange} />
            </div>
            {i < items.length - 1 && <div className="border-b border-outline-variant/10" />}
          </div>
        ))}
      </div>

      {/* Selector idioma */}
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-primary text-lg">language</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{t('config.preferencias.language')}</p>
            <p className="text-xs text-on-surface-variant">Idioma de la interfaz de usuario</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {LANGUAGES.map(l => (
            <button key={l.code} type="button"
              onClick={() => changeLang(l.code)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all text-left
                ${lang === l.code ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant/30 hover:border-primary/40 text-on-surface'}`}>
              <span className="text-lg leading-none">{l.flag}</span>
              <span className="truncate">{l.label}</span>
              {lang === l.code && <span className="material-symbols-outlined text-xs ml-auto shrink-0 text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="btn-primary px-8 py-3 flex items-center gap-2">
          {saving
            ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{t('common.saving')}</>
            : <><span className="material-symbols-outlined text-lg">tune</span>{t('config.preferencias.saveBtn')}</>}
        </button>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Configuracion() {
  const { user }        = useAuth()
  const { t }           = useLang()
  const [tabActiva, setTabActiva] = useState('perfil')
  const [perfil, setPerfil]       = useState(null)
  const [saving, setSaving]       = useState(false)
  const [toast, setToast]         = useState({ msg: '', tipo: 'ok' })

  useEffect(() => { if (user) cargarPerfil() }, [user])

  async function cargarPerfil() {
    const { data } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle()
    setPerfil(data)
  }

  function onToast(msg, tipo = 'ok') {
    setToast({ msg, tipo })
    setTimeout(() => setToast({ msg: '', tipo: 'ok' }), 3000)
  }

  async function onSave(cambios) {
    setSaving(true)
    try {
      const { error } = await supabase.from('users')
        .update({ ...cambios, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) throw error
      await cargarPerfil()
      onToast(t('common.save') + ' ✓', 'ok')
    } catch {
      onToast('Error al guardar los cambios', 'err')
    } finally {
      setSaving(false)
    }
  }

  const TABS = [
    { key: 'perfil',         icon: 'person',               label: t('config.tabs.perfil') },
    { key: 'seguridad',      icon: 'security',             label: t('config.tabs.seguridad') },
    { key: 'suscripcion',    icon: 'payments',             label: t('config.tabs.suscripcion') },
    { key: 'notificaciones', icon: 'notifications_active', label: t('config.tabs.notificaciones') },
    { key: 'preferencias',   icon: 'settings_suggest',     label: t('config.tabs.preferencias') },
  ]

  const avatarSrc = perfil?.avatar_url || user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(perfil?.full_name || user?.email || 'U')}&background=003d9b&color=fff&size=128`

  const nombreMostrado = perfil?.full_name || user?.user_metadata?.full_name || user?.email || 'Usuario'

  return (
    <div className="p-4 md:p-6 pb-24 max-w-5xl animate-fade-in">

      {/* Header usuario */}
      <div className="flex items-center gap-4 mb-6 p-4 card overflow-hidden">
        <img src={avatarSrc} alt="Avatar"
          className="w-14 h-14 md:w-16 md:h-16 rounded-full object-cover border-4 border-surface-container-low shadow flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-2xl font-extrabold truncate">{nombreMostrado}</h1>
          <p className="text-sm text-on-surface-variant truncate">{user?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="text-xs font-semibold text-secondary capitalize">{perfil?.level || 'básico'}</span>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
          <p className="text-xs text-on-surface-variant">Miembro desde</p>
          <p className="text-sm font-bold">{fechaLegible(user?.created_at)}</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* Sidebar tabs */}
        <nav className="lg:w-56 flex flex-row lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0 flex-shrink-0">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setTabActiva(tab.key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all ${
                tabActiva === tab.key
                  ? 'bg-primary text-on-primary shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}>
              <span className="material-symbols-outlined text-lg"
                style={{ fontVariationSettings: tabActiva === tab.key ? "'FILL' 1" : "'FILL' 0" }}>
                {tab.icon}
              </span>
              <span className="hidden sm:inline lg:inline">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {tabActiva === 'perfil'         && <TabPerfil         user={user} perfil={perfil} onSave={onSave} saving={saving} onToast={onToast} />}
          {tabActiva === 'seguridad'      && <TabSeguridad      user={user} onToast={onToast} />}
          {tabActiva === 'suscripcion'    && <TabSuscripcion    userId={user?.id} />}
          {tabActiva === 'notificaciones' && <TabNotificaciones perfil={perfil} onSave={onSave} saving={saving} />}
          {tabActiva === 'preferencias'   && <TabPreferencias   perfil={perfil} onSave={onSave} saving={saving} />}
        </div>
      </div>

      <Toast msg={toast.msg} tipo={toast.tipo} />
    </div>
  )
}
