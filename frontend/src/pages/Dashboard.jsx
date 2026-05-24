import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function getSaludo() {
  const h = new Date().getHours()
  if (h >= 5  && h < 12) return 'Buenos días'
  if (h >= 12 && h < 18) return 'Buenas tardes'
  return 'Buenas noches'
}

/* ─── Mockup visual: Análisis de Perfil ─────────────────────────────────── */
function AnalisisMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden select-none pointer-events-none">
      {/* Fondo con gradiente y patrón */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-primary/10 to-indigo-400/10" />
      <div className="absolute inset-0 opacity-[0.04]"
           style={{ backgroundImage: 'radial-gradient(circle, #6d28d9 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      {/* Tarjeta CV — centro-izquierda */}
      <div className="absolute top-6 left-5 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 w-44"
           style={{ transform: 'rotate(1.5deg)' }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-extrabold text-xs">CV</span>
          </div>
          <div>
            <div className="h-2 bg-slate-200 dark:bg-slate-600 rounded-full w-20 mb-1.5" />
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full w-14" />
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full flex-1" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full" style={{ width: '80%' }} />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full" style={{ width: '65%' }} />
          </div>
        </div>
        {/* Etiqueta IA procesando */}
        <div className="mt-3 flex items-center gap-1.5 bg-primary/8 rounded-lg px-2 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          <span className="text-[9px] font-bold text-primary">Analizando con IA</span>
        </div>
      </div>

      {/* Tarjeta de resultado — derecha */}
      <div className="absolute top-4 right-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl px-3 py-3 w-32"
           style={{ transform: 'rotate(-2deg)' }}>
        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mb-2">Compatibilidad</p>
        {/* Mini anillo de progreso */}
        <div className="flex items-center gap-2 mb-2">
          <svg width="36" height="36" className="-rotate-90 flex-shrink-0">
            <circle cx="18" cy="18" r="14" fill="none" stroke="#e5e7eb" strokeWidth="4" />
            <circle cx="18" cy="18" r="14" fill="none" stroke="#16a34a" strokeWidth="4"
                    strokeLinecap="round" strokeDasharray="87.96" strokeDashoffset="11.43" />
          </svg>
          <div>
            <p className="text-lg font-extrabold text-green-600 leading-none">87%</p>
            <p className="text-[8px] text-slate-400">afinidad</p>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-500">Formación</span>
            <span className="text-[8px] font-bold text-green-600">✓</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-500">Experiencia</span>
            <span className="text-[8px] font-bold text-green-600">✓</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[8px] text-slate-500">Funciones</span>
            <span className="text-[8px] font-bold text-amber-500">~</span>
          </div>
        </div>
      </div>

      {/* Pills de OPECs — abajo */}
      <div className="absolute bottom-5 left-4 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 bg-primary text-white rounded-full px-3 py-1 text-[10px] font-extrabold shadow-lg shadow-primary/30">
          <span className="w-1.5 h-1.5 rounded-full bg-white/60 flex-shrink-0" />
          Profesional Universitario · 87%
        </div>
        <div className="flex items-center gap-1.5 bg-white dark:bg-slate-700 text-on-surface rounded-full px-3 py-1 text-[10px] font-bold shadow-md border border-slate-100 dark:border-slate-600">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
          Técnico Administrativo · 64%
        </div>
      </div>

      {/* Badge ACTIVO */}
      <div className="absolute top-3 left-3">
        <span className="inline-flex items-center gap-1 bg-green-500 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
          ACTIVO
        </span>
      </div>
    </div>
  )
}

/* ─── Mockup visual: Paquete de Estudio ─────────────────────────────────── */
function EstudioMockup() {
  return (
    <div className="relative w-full h-full overflow-hidden select-none pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-secondary/10 to-teal-400/8" />
      <div className="absolute inset-0 opacity-[0.04]"
           style={{ backgroundImage: 'radial-gradient(circle, #059669 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      {/* Tarjeta de pregunta */}
      <div className="absolute top-5 left-5 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-4 w-44"
           style={{ transform: 'rotate(-1.5deg)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-lg bg-secondary/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: '12px', fontVariationSettings: "'FILL' 1" }}>quiz</span>
          </div>
          <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full flex-1" />
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full w-full mb-1" />
        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full w-4/5 mb-3" />
        {['A', 'B', 'C'].map((opt, i) => (
          <div key={opt}
               className={`flex items-center gap-2 p-1.5 rounded-xl mb-1 ${i === 1 ? 'bg-secondary/12 border border-secondary/20' : ''}`}>
            <span className="w-4 h-4 rounded-full border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-[8px] font-extrabold text-slate-400">
              {opt}
            </span>
            <div className={`h-1.5 rounded-full ${i === 1 ? 'bg-secondary/40' : 'bg-slate-100 dark:bg-slate-700'}`}
                 style={{ width: ['70%', '88%', '55%'][i] }} />
          </div>
        ))}
      </div>

      {/* Tarjeta de progreso */}
      <div className="absolute bottom-5 right-3 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-3 w-32"
           style={{ transform: 'rotate(2deg)' }}>
        <p className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest mb-2">Avance</p>
        {[
          { label: 'Derecho', pct: 72, color: 'bg-secondary' },
          { label: 'Finanzas', pct: 45, color: 'bg-primary' },
          { label: 'Gestión', pct: 88, color: 'bg-green-500' },
        ].map(b => (
          <div key={b.label} className="mb-1.5">
            <div className="flex justify-between mb-0.5">
              <span className="text-[8px] text-slate-500">{b.label}</span>
              <span className="text-[8px] font-bold text-slate-600">{b.pct}%</span>
            </div>
            <div className="h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${b.color}`} style={{ width: `${b.pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Pill Cuaderno IA */}
      <div className="absolute bottom-5 left-5 flex items-center gap-1.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full px-3 py-1.5 shadow-lg text-[10px] font-extrabold">
        <span className="material-symbols-outlined" style={{ fontSize: '11px', fontVariationSettings: "'FILL' 1" }}>auto_stories</span>
        Cuaderno IA
      </div>

      {/* Overlay próximamente */}
      <div className="absolute inset-0 bg-surface/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center z-10">
        <div className="bg-surface/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl px-6 py-4 shadow-2xl border border-outline-variant/20 text-center">
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center mx-auto mb-2">
            <span className="material-symbols-outlined text-on-surface-variant text-xl">lock</span>
          </div>
          <p className="text-sm font-extrabold text-on-surface">Próximamente</p>
          <p className="text-[10px] text-on-surface-variant mt-0.5">En desarrollo</p>
        </div>
      </div>
    </div>
  )
}

/* ─── Dashboard principal ────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const nombreCompleto =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Usuario'
  const primerNombre = nombreCompleto.split(' ')[0]
  const iniciales    = nombreCompleto.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const avatarUrl    = user?.user_metadata?.avatar_url || null
  const fecha        = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-10 pb-24 sm:pb-14">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="relative rounded-3xl overflow-hidden mb-10 shadow-2xl shadow-primary/20"
             style={{ background: 'linear-gradient(135deg, #4c2fc2 0%, #3b22a0 55%, #291878 100%)' }}>

          {/* Dot-grid pattern */}
          <div className="absolute inset-0 opacity-[0.08]"
               style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

          {/* Orbes de luz */}
          <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.35) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-20 -left-10 w-64 h-64 rounded-full pointer-events-none"
               style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)' }} />

          <div className="relative px-8 sm:px-12 py-8 sm:py-10 flex items-center justify-between gap-6">
            {/* Texto */}
            <div className="flex-1 min-w-0">
              {/* Fecha pill */}
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-3 py-1.5 mb-5 border border-white/10">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-white/80 text-xs font-medium capitalize">{fecha}</span>
              </div>

              <p className="text-white/60 text-sm font-medium mb-1">{getSaludo()},</p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-none mb-5">
                {primerNombre} <span className="inline-block">👋</span>
              </h1>

              <p className="text-white/65 text-sm sm:text-base leading-relaxed max-w-lg mb-6">
                Bienvenido a <span className="text-white font-extrabold">Praxia</span> — inteligencia artificial
                para prepararte y competir en concursos del sector público colombiano.
              </p>

              {/* Trust pills */}
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: 'psychology', label: 'IA disponible' },
                  { icon: 'gavel', label: 'CNSC · Procuraduría · Contraloría' },
                ].map(p => (
                  <span key={p.label}
                        className="inline-flex items-center gap-1.5 bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-3 py-1.5 rounded-full border border-white/15">
                    <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>{p.icon}</span>
                    {p.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Avatar con decoración */}
            <div className="hidden sm:flex flex-col items-center gap-3 flex-shrink-0">
              <div className="relative">
                {/* Anillo decorativo */}
                <div className="absolute -inset-2 rounded-[20px] border border-white/20 rotate-3" />
                <div className="absolute -inset-2 rounded-[20px] border border-white/10 -rotate-2" />
                {avatarUrl ? (
                  <img src={avatarUrl} alt={nombreCompleto}
                       className="relative w-24 h-24 rounded-[16px] object-cover shadow-2xl" />
                ) : (
                  <div className="relative w-24 h-24 rounded-[16px] bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-2xl">
                    <span className="text-white font-extrabold text-3xl">{iniciales}</span>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-white font-bold text-sm">{primerNombre}</p>
                <p className="text-white/45 text-xs">Candidato activo</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Header de sección ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <p className="text-[11px] font-extrabold text-primary uppercase tracking-[0.12em] mb-1">Herramientas disponibles</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-on-surface tracking-tight">Nuestros servicios</h2>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-on-surface-variant bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/30 font-medium">
            <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            Impulsado por IA
          </span>
        </div>

        {/* ── Grid de servicios ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* ── Card 1: Análisis de Perfil ── */}
          <div
            onClick={() => navigate('/analisis-perfil')}
            className="group relative rounded-2xl overflow-hidden border border-primary/20 bg-surface cursor-pointer
                       hover:shadow-2xl hover:shadow-primary/15 hover:-translate-y-1 transition-all duration-300"
          >
            {/* Área visual */}
            <div className="h-56 sm:h-60 relative">
              <AnalisisMockup />
            </div>

            {/* Separador con gradiente */}
            <div className="h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            {/* Contenido */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/30 group-hover:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-on-surface leading-none mb-1">Análisis de Perfil</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-green-600 dark:text-green-400 uppercase tracking-wide">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                    IA · Disponible ahora
                  </span>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
                Sube tu hoja de vida y la IA la compara con todos los cargos de la convocatoria que elijas.
                Recibe un ranking de OPECs compatibles, análisis de brechas y una guía personalizada para ganar.
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-6">
                {['Ranking de OPECs', 'Análisis de brechas', 'Guía de documentos', 'Tips para tu HV'].map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary flex-shrink-0"
                          style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-xs text-on-surface font-medium">{f}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={e => { e.stopPropagation(); navigate('/analisis-perfil') }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm
                           hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-primary/25
                           group-hover:shadow-lg group-hover:shadow-primary/35"
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>person_search</span>
                Analizar mi hoja de vida
              </button>
            </div>
          </div>

          {/* ── Card 2: Paquete de Estudio ── */}
          <div className="relative rounded-2xl overflow-hidden border border-outline-variant/25 bg-surface opacity-75">

            {/* Área visual */}
            <div className="h-56 sm:h-60 relative">
              <EstudioMockup />
            </div>

            {/* Separador */}
            <div className="h-px bg-gradient-to-r from-transparent via-outline-variant/40 to-transparent" />

            {/* Contenido */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0 shadow-md shadow-secondary/20">
                  <span className="material-symbols-outlined text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-on-surface leading-none mb-1">Paquete de Estudio</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-on-surface-variant uppercase tracking-wide">
                    Simulacros · Material · Cuaderno IA
                  </span>
                </div>
              </div>

              <p className="text-sm text-on-surface-variant leading-relaxed mb-5">
                Simulacros personalizados según tu OPEC, banco de preguntas temático, material de estudio oficial
                y un Cuaderno IA para reforzar conceptos con inteligencia artificial.
              </p>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-6">
                {['Simulacros por OPEC', 'Banco de preguntas', 'Material oficial', 'Cuaderno IA'].map(f => (
                  <div key={f} className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-on-surface-variant flex-shrink-0"
                          style={{ fontSize: '14px' }}>schedule</span>
                    <span className="text-xs text-on-surface-variant font-medium">{f}</span>
                  </div>
                ))}
              </div>

              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-3 bg-surface-container border border-outline-variant/30 text-on-surface-variant rounded-xl font-bold text-sm cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                Próximamente
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
