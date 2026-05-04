// Suscripciones.jsx
// Página de planes y precios — rediseño premium (Amazon / ML style).
// Flujo: catálogo → detalle paquete → selección versión → checkout → Wompi

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { useFetch } from '../hooks/useFetch'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// ── Constantes ────────────────────────────────────────────────────────────────

const HERO_DEFAULTS = {
  hero_titulo: 'Prepárate con los mejores simulacros.',
  hero_subtitulo: 'Accede a simulacros oficiales para las convocatorias más exigentes del país. Elige tu paquete y empieza hoy.',
  hero_badge: 'Paquetes por convocatoria',
  testimonio: '"Los simulacros son idénticos al examen real. Totalmente vale la pena."',
  testimonio_autor: '— María G., Puntaje 472',
}

const ICONOS_CAT = {
  CNSC: 'gavel', ICFES: 'school', 'Saber Pro': 'history_edu',
  Procuraduría: 'balance', Contraloría: 'account_balance',
  Defensoría: 'shield', DIAN: 'receipt_long', TyT: 'engineering',
}
const COLORES_CAT = {
  CNSC: ['#1a56db', '#e8f0fe'], ICFES: ['#0694a2', '#d5f5f6'],
  'Saber Pro': ['#057a55', '#def7ec'], Procuraduría: ['#1e3a8a', '#dbeafe'],
  Contraloría: ['#1a56db', '#e8f0fe'], Defensoría: ['#64748b', '#f1f5f9'],
  DIAN: ['#b45309', '#fef3c7'], TyT: ['#6d28d9', '#ede9fe'],
}

const BENEFICIOS_PKG = [
  { icon: 'quiz', text: 'Banco de preguntas actualizado' },
  { icon: 'school', text: 'Modo práctica con retroalimentación' },
  { icon: 'timer', text: 'Modo examen con temporizador real' },
  { icon: 'groups', text: 'Sala en línea competitiva' },
  { icon: 'menu_book', text: 'Material de estudio descargable' },
  { icon: 'auto_awesome', text: 'Asistente Praxia IA (si aplica)' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(p) {
  if (!p && p !== 0) return '—'
  return `$${Number(p).toLocaleString('es-CO')}`
}

function getCat(pkg) {
  return pkg.evaluations?.[0]?.categories?.name ?? 'General'
}

function getColor(cat) {
  return COLORES_CAT[cat] || ['#1a56db', '#e8f0fe']
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden animate-pulse">
      <div className="h-1.5 bg-slate-200" />
      <div className="p-6 space-y-4">
        <div className="flex gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-2/3" />
          </div>
        </div>
        <div className="h-10 bg-slate-100 rounded-xl" />
        <div className="h-12 bg-slate-200 rounded-full" />
      </div>
    </div>
  )
}

// ── Tarjeta de paquete ────────────────────────────────────────────────────────

function TarjetaPaquete({ pkg, comprasUsuario, onVer }) {
  const navigate    = useNavigate()
  const cat         = getCat(pkg)
  const [primary]   = getColor(cat)
  const icono       = ICONOS_CAT[cat] || 'quiz'
  const versiones   = (pkg.versiones || []).filter(v => v.is_active)
  const precioDesde = versiones.length ? Math.min(...versiones.map(v => Number(v.price) || 0)) : Number(pkg.price) || 0
  const yaActivo    = comprasUsuario.some(c => c.package_id === pkg.id)
  const niveles     = pkg.evaluations?.reduce((a, e) => a + (e.levels?.length || 0), 0) || 0

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
      {/* Barra color */}
      <div className="h-1" style={{ backgroundColor: primary }} />

      <div className="p-5 flex flex-col flex-1 gap-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: primary + '18' }}>
            <span className="material-symbols-outlined text-2xl" style={{ color: primary, fontVariationSettings: "'FILL' 1" }}>
              {icono}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-extrabold text-base leading-tight">{pkg.name}</h3>
              {yaActivo && (
                <span className="text-[9px] font-black bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Activo
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{pkg.description}</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {niveles > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-xs">layers</span>
              {niveles} nivel{niveles !== 1 ? 'es' : ''}
            </span>
          )}
          {versiones.length > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-xs">sell</span>
              {versiones.length} versión{versiones.length !== 1 ? 'es' : ''}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            <span className="material-symbols-outlined text-xs">menu_book</span>
            Material
          </span>
          {pkg.has_ai_chat && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              <span className="material-symbols-outlined text-xs">auto_awesome</span>
              IA Praxia
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="flex items-end justify-between mt-auto pt-3 border-t border-slate-100">
          <div>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">
              {versiones.length > 1 ? 'Desde' : 'Precio'}
            </p>
            <p className="text-2xl font-extrabold leading-none" style={{ color: primary }}>
              {fmt(precioDesde)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">COP · pago único</p>
          </div>
          <button onClick={() => onVer(pkg)}
            className="px-5 py-2.5 rounded-full text-sm font-extrabold text-white transition-all active:scale-95 hover:opacity-90"
            style={{ backgroundColor: primary }}>
            Ver planes
          </button>
        </div>

        {pkg.evaluations?.[0]?.id && (
          <button onClick={() => navigate(`/prueba/${pkg.evaluations[0].id}`)}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 text-center transition-colors -mt-1">
            Ver contenido del paquete →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Panel detalle + checkout ──────────────────────────────────────────────────

function PanelDetalle({ pkg, versiones, comprasUsuario, onClose, onComprar, procesando }) {
  const navigate = useNavigate()
  const cat      = getCat(pkg)
  const [primary, lightBg] = getColor(cat)
  const icono    = ICONOS_CAT[cat] || 'quiz'

  // Pasos: 'planes' → 'checkout'
  const [paso,              setPaso]              = useState('planes')
  const [versionElegida,    setVersionElegida]    = useState(null)

  // Facturación
  const [factElec,   setFactElec]   = useState(false)
  const [nit,        setNit]        = useState('')
  const [razon,      setRazon]      = useState('')
  const [emailFact,  setEmailFact]  = useState('')
  const [dirFact,    setDirFact]    = useState('')

  const versionesActivas = versiones.filter(v => v.is_active)
  const comprasVersionIds = comprasUsuario.map(c => c.package_version_id)

  // Marca la versión del medio como recomendada
  const idxRec = versionesActivas.length >= 3 ? Math.floor(versionesActivas.length / 2) : 0
  const versionRec = versionesActivas[idxRec]

  function elegir(v) {
    setVersionElegida(v)
    setPaso('checkout')
    window.scrollTo(0, 0)
  }

  function confirmarCompra() {
    onComprar(pkg, versionElegida, factElec ? { nit, razon, email: emailFact, dir: dirFact } : null)
  }

  function cerrar() {
    setPaso('planes')
    setVersionElegida(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={e => e.target === e.currentTarget && cerrar()}>
      <div className="bg-white w-full md:max-w-3xl md:rounded-3xl max-h-[95vh] md:max-h-[88vh] overflow-y-auto shadow-2xl flex flex-col rounded-t-3xl">

        {/* Barra de color + header */}
        <div className="sticky top-0 z-10 bg-white rounded-t-3xl border-b border-slate-100">
          <div className="h-1 rounded-t-3xl" style={{ backgroundColor: primary }} />
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: lightBg }}>
              <span className="material-symbols-outlined text-xl"
                style={{ color: primary, fontVariationSettings: "'FILL' 1" }}>{icono}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-extrabold text-lg leading-tight truncate">{pkg.name}</h2>
              {paso === 'checkout' && versionElegida && (
                <p className="text-xs text-slate-500">{versionElegida.display_name} · {fmt(versionElegida.price)} COP</p>
              )}
            </div>
            <button onClick={cerrar}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors shrink-0">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 px-5 pb-3 text-xs font-semibold text-slate-400">
            <button onClick={() => setPaso('planes')}
              className={paso === 'planes' ? 'text-slate-700 font-bold' : 'hover:text-slate-600 transition-colors'}>
              Seleccionar plan
            </button>
            <span className="material-symbols-outlined text-sm">chevron_right</span>
            <span className={paso === 'checkout' ? 'text-slate-700 font-bold' : ''}>Finalizar compra</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── PASO 1: PLANES ── */}
          {paso === 'planes' && (
            <div className="p-5 space-y-6">

              {/* Descripción */}
              <p className="text-sm text-slate-600 leading-relaxed">{pkg.description}</p>

              {/* Lo que incluye */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Este paquete incluye</p>
                </div>
                <div className="grid grid-cols-2 gap-0 divide-y divide-x divide-slate-100">
                  {BENEFICIOS_PKG.filter(b => !(b.icon === 'auto_awesome' && !pkg.has_ai_chat)).map(b => (
                    <div key={b.icon} className="flex items-center gap-2.5 px-4 py-3">
                      <span className="material-symbols-outlined text-base shrink-0" style={{ color: primary, fontVariationSettings: "'FILL' 1" }}>{b.icon}</span>
                      <span className="text-xs font-medium text-slate-700 leading-tight">{b.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Versiones / Tiers */}
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500 mb-3">
                  {versionesActivas.length > 1 ? 'Selecciona tu versión' : 'Plan disponible'}
                </p>
                <div className="space-y-3">
                  {versionesActivas.map((v, i) => {
                    const yaComprado = comprasVersionIds.includes(v.id)
                    const esRec      = v.id === versionRec?.id && versionesActivas.length > 1
                    return (
                      <div key={v.id} className={`relative rounded-2xl border-2 transition-all
                        ${esRec ? 'border-2 shadow-md' : 'border-slate-200'}
                        ${yaComprado ? 'opacity-75' : 'hover:shadow-sm'}`}
                        style={esRec ? { borderColor: primary } : {}}>

                        {esRec && (
                          <div className="absolute -top-3.5 left-4">
                            <span className="text-[10px] font-extrabold text-white px-3 py-1 rounded-full shadow-sm"
                              style={{ backgroundColor: primary }}>
                              ★ Más popular
                            </span>
                          </div>
                        )}

                        <div className="p-4 flex items-center gap-4">
                          {/* Número */}
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0"
                            style={{ backgroundColor: lightBg, color: primary }}>
                            {i + 1}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-extrabold text-sm">{v.display_name || 'Versión'}</p>
                            <p className="text-xl font-extrabold leading-tight mt-0.5" style={{ color: primary }}>
                              {fmt(v.price)} <span className="text-xs font-semibold text-slate-400">COP</span>
                            </p>
                          </div>

                          {/* CTA */}
                          {yaComprado ? (
                            <span className="flex items-center gap-1 text-xs font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
                              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              Adquirido
                            </span>
                          ) : (
                            <button onClick={() => elegir(v)}
                              className="px-5 py-2.5 rounded-full text-sm font-extrabold text-white transition-all active:scale-95 hover:opacity-90 shrink-0"
                              style={{ backgroundColor: primary }}>
                              Comprar
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Trust badges */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: 'lock', label: 'Pago seguro', sub: 'SSL cifrado' },
                  { icon: 'verified_user', label: 'Datos protegidos', sub: 'Wompi certificado' },
                  { icon: 'support_agent', label: 'Soporte', sub: 'Respuesta en 24h' },
                ].map(b => (
                  <div key={b.label} className="flex flex-col items-center text-center gap-1 p-3 bg-slate-50 rounded-xl">
                    <span className="material-symbols-outlined text-xl text-slate-500">{b.icon}</span>
                    <p className="text-[10px] font-extrabold text-slate-700">{b.label}</p>
                    <p className="text-[9px] text-slate-400">{b.sub}</p>
                  </div>
                ))}
              </div>

              {/* Ver contenido */}
              {pkg.evaluations?.[0]?.id && (
                <button onClick={() => { cerrar(); navigate(`/prueba/${pkg.evaluations[0].id}`) }}
                  className="w-full py-3 rounded-full border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all">
                  Ver contenido completo del paquete →
                </button>
              )}
            </div>
          )}

          {/* ── PASO 2: CHECKOUT ── */}
          {paso === 'checkout' && versionElegida && (
            <div className="p-5 space-y-5">

              <button onClick={() => setPaso('planes')}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Cambiar versión
              </button>

              {/* Resumen de compra */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100" style={{ backgroundColor: lightBg }}>
                  <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: primary }}>Resumen de tu compra</p>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="text-slate-500">Paquete</span>
                    <span className="font-bold text-right max-w-[60%]">{pkg.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Versión</span>
                    <span className="font-bold">{versionElegida.display_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Acceso</span>
                    <span className="font-bold">365 días</span>
                  </div>
                  <div className="h-px bg-slate-100" />
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-base">Total a pagar</span>
                    <span className="text-2xl font-extrabold" style={{ color: primary }}>
                      {fmt(versionElegida.price)} <span className="text-sm font-semibold text-slate-400">COP</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Facturación electrónica */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <button onClick={() => setFactElec(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-amber-600 text-lg"
                        style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-sm">¿Necesitas factura electrónica?</p>
                      <p className="text-xs text-slate-400">Para personas jurídicas o declaración de renta</p>
                    </div>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${factElec ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${factElec ? 'right-0.5' : 'left-0.5'}`} />
                  </div>
                </button>

                {factElec && (
                  <div className="px-4 pb-4 pt-0 border-t border-slate-100 space-y-3">
                    <p className="text-xs text-slate-400 pt-3">Datos para la factura electrónica DIAN</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">NIT / CC</label>
                        <input value={nit} onChange={e => setNit(e.target.value)}
                          placeholder="900.123.456-7"
                          className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Razón social</label>
                        <input value={razon} onChange={e => setRazon(e.target.value)}
                          placeholder="Mi Empresa S.A.S."
                          className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Email para la factura</label>
                      <input type="email" value={emailFact} onChange={e => setEmailFact(e.target.value)}
                        placeholder="contabilidad@empresa.com"
                        className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Dirección</label>
                      <input value={dirFact} onChange={e => setDirFact(e.target.value)}
                        placeholder="Cra. 7 #45-23, Bogotá"
                        className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all" />
                    </div>
                    <p className="text-[10px] text-slate-400 flex items-start gap-1">
                      <span className="material-symbols-outlined text-sm shrink-0">info</span>
                      Recibirás la factura en máx. 24h hábiles al email indicado.
                    </p>
                  </div>
                )}
              </div>

              {/* Método de pago */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-slate-500">Método de pago</p>
                </div>
                <div className="p-4 space-y-2">
                  {/* Wompi — activo */}
                  <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-blue-500 bg-blue-50">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-white text-lg"
                        style={{ fontVariationSettings: "'FILL' 1" }}>credit_card</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-extrabold text-sm text-blue-900">Wompi</p>
                      <p className="text-[10px] text-blue-600">Tarjeta crédito/débito · PSE · Nequi · Daviplata</p>
                    </div>
                    <span className="w-4 h-4 rounded-full border-2 border-blue-500 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-blue-600" />
                    </span>
                  </div>

                  {/* Próximamente */}
                  {[
                    { label: 'Efecty / Baloto', sub: 'Pago en efectivo — Próximamente', icon: 'payments' },
                    { label: 'Transferencia bancaria', sub: 'Próximamente', icon: 'account_balance' },
                  ].map(m => (
                    <div key={m.label} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 opacity-50 cursor-not-allowed">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-slate-400 text-lg">{m.icon}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm text-slate-500">{m.label}</p>
                        <p className="text-[10px] text-slate-400">{m.sub}</p>
                      </div>
                      <span className="text-[9px] font-bold bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Pronto</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA final */}
              <button onClick={confirmarCompra} disabled={!!procesando}
                className="w-full py-4 rounded-2xl font-extrabold text-base text-white transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg"
                style={{ backgroundColor: primary }}>
                {procesando ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Procesando…</>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl"
                      style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                    Pagar {fmt(versionElegida.price)} COP con Wompi
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-4 text-[10px] text-slate-400 font-semibold">
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  Pago cifrado SSL
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  Wompi certificado
                </span>
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">receipt</span>
                  {factElec ? 'Factura electrónica' : 'Soporte de pago'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Modal login ───────────────────────────────────────────────────────────────

function ModalLogin({ onClose, onLogin }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-primary text-3xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>account_circle</span>
        </div>
        <h3 className="text-xl font-extrabold mb-2">Inicia sesión para continuar</h3>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Necesitas una cuenta para adquirir paquetes y acceder a los simulacros.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-full font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all">
            Cancelar
          </button>
          <button onClick={onLogin}
            className="flex-1 py-3 rounded-full font-bold text-sm bg-primary text-white hover:bg-primary/90 transition-all active:scale-95">
            Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal éxito ───────────────────────────────────────────────────────────────

function ModalExito({ pkg, version, onVerSimulacros, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-5">
          <span className="material-symbols-outlined text-emerald-600 text-4xl"
            style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
        </div>
        <h3 className="text-2xl font-extrabold mb-1">¡Compra exitosa!</h3>
        <p className="text-slate-500 text-sm mb-1">Has adquirido</p>
        <p className="font-extrabold text-base mb-1">{pkg.name}</p>
        {version && <p className="text-sm text-slate-400 mb-5">Versión: {version.display_name}</p>}
        <div className="bg-slate-50 rounded-2xl p-4 mb-6">
          <p className="text-xs text-slate-400">Total pagado</p>
          <p className="text-3xl font-extrabold text-primary">{fmt(version?.price || pkg.price)} COP</p>
        </div>
        <div className="space-y-2">
          <button onClick={onVerSimulacros}
            className="w-full py-3 rounded-full font-extrabold text-sm bg-primary text-white hover:bg-primary/90 transition-all active:scale-95">
            Ir a mis simulacros →
          </button>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-full font-bold text-sm text-slate-400 hover:text-slate-600 transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Suscripciones() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [filtro,        setFiltro]        = useState('Todos')
  const [panelPkg,      setPanelPkg]      = useState(null)
  const [showLogin,     setShowLogin]     = useState(false)
  const [pagoExitoso,   setPagoExitoso]   = useState(null)
  const [procesando,    setProcesando]    = useState(null)

  // Cargar widget Wompi
  useEffect(() => {
    if (document.querySelector('script[src="https://checkout.wompi.co/widget.js"]')) return
    const s = document.createElement('script')
    s.src = 'https://checkout.wompi.co/widget.js'
    s.async = true
    document.body.appendChild(s)
    return () => { if (s.parentNode) s.parentNode.removeChild(s) }
  }, [])

  const { data, loading, error, retry } = useFetch(async () => {
    let hero = { ...HERO_DEFAULTS }
    try {
      const { data: content } = await supabase.from('page_content').select('field_key, value').eq('page_key', 'suscripciones')
      content?.forEach(({ field_key, value }) => { hero[field_key] = value })
    } catch {}

    const { data: pkgs, error: pkgErr } = await supabase
      .from('packages')
      .select('id, name, description, price, duration_days, has_ai_chat, is_active')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (pkgErr) throw new Error(pkgErr.message)

    const paquetes = await Promise.all((pkgs || []).map(async pkg => {
      try {
        const { data: versiones } = await supabase
          .from('package_versions')
          .select('id, display_name, price, is_active')
          .eq('package_id', pkg.id).eq('is_active', true).order('price', { ascending: true })

        const versionIds = (versiones || []).map(v => v.id)
        let evaluations = []

        if (versionIds.length) {
          const { data: ev } = await supabase.from('evaluation_versions').select('evaluation_id').in('package_version_id', versionIds)
          const evalIds = [...new Set((ev || []).map(e => e.evaluation_id).filter(Boolean))]
          if (evalIds.length) {
            const { data: evs } = await supabase.from('evaluations').select('id, title, categories(name), levels(id)').in('id', evalIds)
            evaluations = evs || []
          }
        }

        return { ...pkg, versiones: versiones || [], evaluations }
      } catch { return { ...pkg, versiones: [], evaluations: [] } }
    }))

    let comprasUsuario = []
    if (user?.id) {
      const { data: compras } = await supabase.from('purchases')
        .select('package_id, package_version_id, end_date, status')
        .eq('user_id', user.id).eq('status', 'active').gte('end_date', new Date().toISOString())
      comprasUsuario = compras || []
    }

    const categorias = [...new Set(paquetes.flatMap(p => p.evaluations?.map(e => e.categories?.name).filter(Boolean) || []))]
    return { hero, paquetes, comprasUsuario, categorias }
  }, ['suscripciones', user?.id])

  const hero          = data?.hero ?? HERO_DEFAULTS
  const paquetes      = data?.paquetes ?? []
  const comprasUsuario = data?.comprasUsuario ?? []
  const categorias    = data?.categorias ?? []

  const filtrados = filtro === 'Todos'
    ? paquetes
    : paquetes.filter(p => p.evaluations?.some(e => e.categories?.name === filtro))

  function abrirDetalle(pkg) {
    if (!user) { setShowLogin(true); return }
    setPanelPkg({ pkg, versiones: pkg.versiones })
  }

  async function onComprar(pkg, version) {
    if (!version || procesando) return
    setProcesando(version.id)

    try {
      if (!window.WidgetCheckout) throw new Error('El widget de pago aún no cargó. Recarga la página.')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Sesión expirada. Inicia sesión de nuevo.')

      const res = await fetch(`${API}/api/paquetes/comprar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ package_id: pkg.id, package_version_id: version.id }),
      })
      const datos = await res.json()
      if (!res.ok) throw new Error(datos?.error || 'Error al iniciar el pago.')

      setPanelPkg(null)

      const checkout = new window.WidgetCheckout({
        currency: 'COP',
        amountInCents: datos.amount_in_cents,
        reference: datos.reference,
        publicKey: datos.public_key,
        signature: { integrity: datos.signature },
        customerData: { email: user.email },
        redirectUrl: datos.redirect_url,
      })

      checkout.open(result => {
        if (result?.transaction?.status === 'APPROVED') {
          setPagoExitoso({ pkg, version })
        } else {
          navigate('/pago-resultado?status=declined')
        }
      })
    } catch (e) {
      alert(e.message || 'Error al iniciar el pago.')
    } finally {
      setProcesando(null)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8 pb-24 space-y-8">

        {/* ── Hero ── */}
        <div className="relative bg-gradient-to-br from-primary via-primary to-[#1a56db] rounded-3xl p-8 md:p-12 text-white overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full -translate-y-20 translate-x-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-16 -translate-x-16 pointer-events-none" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/15 text-white/90 text-xs font-bold px-3 py-1.5 rounded-full mb-6 uppercase tracking-widest">
              <span className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              {hero.hero_badge}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold leading-tight mb-4">
              {hero.hero_titulo}
            </h1>
            <p className="text-white/75 text-base leading-relaxed">
              {hero.hero_subtitulo}
            </p>
          </div>
        </div>

        {/* ── Banner activos ── */}
        {comprasUsuario.length > 0 && (
          <div className="flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-emerald-600"
                style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-emerald-800 text-sm">
                Tienes {comprasUsuario.length} paquete{comprasUsuario.length !== 1 ? 's' : ''} activo{comprasUsuario.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-emerald-600">Accede a tus simulacros desde el catálogo.</p>
            </div>
            <button onClick={() => navigate('/catalogo')}
              className="text-xs font-extrabold text-emerald-700 hover:underline shrink-0">
              Ver catálogo →
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700">
            <span className="material-symbols-outlined">error</span>
            <p className="text-sm font-semibold flex-1">{error}</p>
            <button onClick={retry} className="text-xs font-bold underline">Reintentar</button>
          </div>
        )}

        {/* ── Filtros ── */}
        {!loading && categorias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {['Todos', ...categorias].map(cat => (
              <button key={cat} onClick={() => setFiltro(cat)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-all
                  ${filtro === cat
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-slate-500 border border-slate-200 hover:border-primary/40 hover:text-primary'}`}>
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ── Grid paquetes ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {loading && [1,2,3,4,5,6].map(i => <Skeleton key={i} />)}
          {!loading && filtrados.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <span className="material-symbols-outlined text-5xl mb-3 block opacity-30">inventory_2</span>
              <p className="font-bold">No hay paquetes disponibles</p>
              <p className="text-sm mt-1">Pronto habrá nuevas convocatorias.</p>
            </div>
          )}
          {!loading && filtrados.map(pkg => (
            <TarjetaPaquete key={pkg.id} pkg={pkg} comprasUsuario={comprasUsuario} onVer={abrirDetalle} />
          ))}
        </div>

        {/* ── Testimonio ── */}
        {!loading && hero.testimonio && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center max-w-xl mx-auto">
            <div className="flex justify-center -space-x-3 mb-5">
              {['CA', 'MG', 'JP'].map((ini, i) => (
                <div key={ini} className={`w-11 h-11 rounded-full border-4 border-white flex items-center justify-center text-white font-extrabold text-xs
                  ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-secondary' : 'bg-tertiary'}`}>
                  {ini}
                </div>
              ))}
              <div className="w-11 h-11 rounded-full border-4 border-white bg-slate-200 flex items-center justify-center font-extrabold text-[10px] text-slate-500">
                +15k
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary mb-3 block"
              style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
            <p className="text-base font-semibold text-slate-700 italic mb-2">{hero.testimonio}</p>
            <p className="text-xs text-slate-400">{hero.testimonio_autor}</p>
          </div>
        )}
      </div>

      {/* ── Modales ── */}
      {panelPkg && (
        <PanelDetalle
          pkg={panelPkg.pkg}
          versiones={panelPkg.versiones}
          comprasUsuario={comprasUsuario}
          onClose={() => setPanelPkg(null)}
          onComprar={onComprar}
          procesando={procesando}
        />
      )}

      {showLogin && (
        <ModalLogin
          onClose={() => setShowLogin(false)}
          onLogin={() => { setShowLogin(false); navigate('/login') }}
        />
      )}

      {pagoExitoso && (
        <ModalExito
          pkg={pagoExitoso.pkg}
          version={pagoExitoso.version}
          onVerSimulacros={() => { setPagoExitoso(null); navigate('/catalogo') }}
          onClose={() => setPagoExitoso(null)}
        />
      )}
    </div>
  )
}
