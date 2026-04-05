import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const PAGINAS = [
  { key: 'suscripciones', icon: 'payments',  label: 'Suscripciones' },
  { key: 'home',          icon: 'home',       label: 'Inicio'        },
  { key: 'config',        icon: 'settings',   label: 'Configuración' },
]

const DEFAULTS = {
  home: {
    hero_titulo:    'Potencia tu carrera profesional',
    hero_subtitulo: 'Preparación integral para exámenes de estado con el mejor contenido académico.',
    anuncio:        '',
  },
  suscripciones: {
    hero_titulo:      'Invierte en tu futuro profesional.',
    hero_subtitulo:   'Desbloquea las herramientas que usan los candidatos más exitosos.',
    hero_badge:       'Acceso Premium Incluido',
    testimonio:       '"Los simulacros son idénticos al examen real del ICFES."',
    testimonio_autor: '— María G., Puntaje 472',
  },
  config: {
    whatsapp_numero: '573000000000',
    email_contacto:  'soporte@simulatest.co',
    nombre_app:      'SimulaTest Pro',
  },
}

const CAMPOS_POR_PAGINA = {
  home: [
    { key: 'hero_titulo',    label: 'Título principal',  tipo: 'input'    },
    { key: 'hero_subtitulo', label: 'Subtítulo',         tipo: 'textarea' },
    { key: 'anuncio',        label: 'Barra de anuncio',  tipo: 'textarea', hint: 'Déjalo vacío para ocultarlo' },
  ],
  suscripciones: [
    { key: 'hero_titulo',      label: 'Título del hero',    tipo: 'input'    },
    { key: 'hero_subtitulo',   label: 'Subtítulo del hero', tipo: 'textarea' },
    { key: 'hero_badge',       label: 'Texto del badge',    tipo: 'input'    },
    { key: 'testimonio',       label: 'Testimonio',         tipo: 'textarea' },
    { key: 'testimonio_autor', label: 'Autor del testimonio', tipo: 'input' },
  ],
  config: [
    { key: 'whatsapp_numero', label: 'Número WhatsApp (solo dígitos)', tipo: 'input', hint: 'Ej: 573001234567' },
    { key: 'email_contacto',  label: 'Email de soporte',               tipo: 'input' },
    { key: 'nombre_app',      label: 'Nombre de la app',               tipo: 'input' },
  ],
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function Campo({ campo, value, onChange }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {campo.label}
        </label>
        {campo.hint && (
          <span className="text-[10px] text-on-surface-variant italic">{campo.hint}</span>
        )}
      </div>
      {campo.tipo === 'textarea' ? (
        <textarea
          rows={3}
          value={value || ''}
          onChange={e => onChange(campo.key, e.target.value)}
          className="w-full px-4 py-3 bg-surface-container border border-outline-variant/20
                     rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20
                     text-on-surface resize-none transition-all"
        />
      ) : (
        <input
          type="text"
          value={value || ''}
          onChange={e => onChange(campo.key, e.target.value)}
          className="w-full px-4 py-2.5 bg-surface-container border border-outline-variant/20
                     rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20
                     text-on-surface transition-all"
        />
      )}
    </div>
  )
}

// ─── Gestión de paquetes ──────────────────────────────────────────────────────

function PaquetesPanel({ navigate }) {
  const [paquetes,  setPaquetes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [editando,  setEditando]  = useState(null)  // id del paquete en edición
  const [form,      setForm]      = useState({})
  const [guardando, setGuardando] = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase
      .from('packages')
      .select('*')
      .order('price', { ascending: true })
    setPaquetes(data || [])
    setLoading(false)
  }

  function abrirEdicion(pkg) {
    setEditando(pkg.id)
    setForm({
      name:          pkg.name,
      description:   pkg.description || '',
      price:         pkg.price,
      duration_days: pkg.duration_days,
      is_active:     pkg.is_active,
    })
    setMsg('')
  }

  async function guardarPaquete(id) {
    setGuardando(true)
    const { error } = await supabase
      .from('packages')
      .update({
        name:          form.name,
        description:   form.description,
        price:         Number(form.price),
        duration_days: Number(form.duration_days),
        is_active:     form.is_active,
      })
      .eq('id', id)
    setGuardando(false)
    if (error) { setMsg('Error al guardar'); return }
    setMsg('¡Guardado!')
    setEditando(null)
    cargar()
    setTimeout(() => setMsg(''), 2000)
  }

  async function toggleActivo(pkg) {
    await supabase.from('packages').update({ is_active: !pkg.is_active }).eq('id', pkg.id)
    cargar()
  }

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-surface-container rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          {paquetes.length} paquete{paquetes.length !== 1 ? 's' : ''} en el sistema
        </p>
        <button
          onClick={() => navigate('/admin/paquetes')}
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
        >
          Gestión avanzada
          <span className="material-symbols-outlined text-sm">open_in_new</span>
        </button>
      </div>

      {msg && (
        <div className={`px-4 py-2 rounded-lg text-xs font-bold
          ${msg.includes('Error') ? 'bg-error-container text-error' : 'bg-secondary-container text-on-secondary-container'}`}>
          {msg}
        </div>
      )}

      {paquetes.length === 0 && (
        <div className="p-8 text-center text-on-surface-variant bg-surface-container rounded-xl">
          <span className="material-symbols-outlined text-3xl opacity-40 mb-2 block">inventory_2</span>
          <p className="text-sm font-semibold">Sin paquetes creados</p>
          <button
            onClick={() => navigate('/admin/paquetes')}
            className="mt-3 btn-primary text-xs px-4 py-2"
          >
            Crear primer paquete
          </button>
        </div>
      )}

      {paquetes.map(pkg => (
        <div key={pkg.id}
          className="bg-surface-container rounded-xl border border-outline-variant/15 overflow-hidden">

          {/* Header del paquete */}
          <div className="flex items-center gap-3 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm truncate">{pkg.name}</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0
                  ${pkg.is_active
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-surface-container-high text-on-surface-variant'}`}>
                  {pkg.is_active ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                ${Number(pkg.price).toLocaleString('es-CO')} · {pkg.duration_days || '∞'} días
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => editando === pkg.id ? setEditando(null) : abrirEdicion(pkg)}
                className="p-2 text-on-surface-variant hover:text-primary rounded-lg hover:bg-surface-container-high transition-all"
              >
                <span className="material-symbols-outlined text-lg">
                  {editando === pkg.id ? 'close' : 'edit'}
                </span>
              </button>
              <button
                onClick={() => toggleActivo(pkg)}
                className="p-2 text-on-surface-variant hover:text-secondary rounded-lg hover:bg-surface-container-high transition-all"
              >
                <span className="material-symbols-outlined text-lg">
                  {pkg.is_active ? 'toggle_on' : 'toggle_off'}
                </span>
              </button>
            </div>
          </div>

          {/* Formulario inline de edición */}
          {editando === pkg.id && (
            <div className="border-t border-outline-variant/15 p-4 bg-surface-container-low space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Nombre</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Precio (COP)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Días de acceso</label>
                  <input
                    type="number"
                    value={form.duration_days}
                    onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                    className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                      className={`w-10 h-5 rounded-full relative transition-all ${form.is_active ? 'bg-secondary' : 'bg-outline-variant'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all
                        ${form.is_active ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                    <span className="text-xs font-semibold text-on-surface-variant">
                      {form.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                  Beneficios (uno por línea)
                </label>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Simulacros ilimitados&#10;Retroalimentación IA&#10;Certificados"
                  className="w-full px-3 py-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                />
                <p className="text-[10px] text-on-surface-variant">Cada línea es un beneficio en la tarjeta de precio</p>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setEditando(null)}
                  className="px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => guardarPaquete(pkg.id)}
                  disabled={guardando}
                  className="px-4 py-2 text-xs font-bold bg-primary text-on-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-1"
                >
                  {guardando && <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminEditor() {
  const navigate = useNavigate()

  const [paginaActiva, setPaginaActiva] = useState('suscripciones')
  const [contenido,    setContenido]    = useState({})
  const [borrador,     setBorrador]     = useState({})
  const [guardando,    setGuardando]    = useState(false)
  const [publicando,   setPublicando]   = useState(false)
  const [msg,          setMsg]          = useState('')

  const cargarContenido = useCallback(async (pagina) => {
    setMsg('')
    const { data } = await supabase
      .from('page_content')
      .select('field_key, value, is_draft')
      .eq('page_key', pagina)

    const defaults = DEFAULTS[pagina] || {}

    if (!data?.length) {
      setContenido(defaults)
      setBorrador(defaults)
      return
    }

    const publicado = { ...defaults }
    const draft     = { ...defaults }
    data.forEach(({ field_key, value, is_draft }) => {
      if (!is_draft) publicado[field_key] = value
      draft[field_key] = value
    })
    setContenido(publicado)
    setBorrador({ ...publicado, ...draft })
  }, [])

  useEffect(() => { cargarContenido(paginaActiva) }, [paginaActiva, cargarContenido])

  function actualizarCampo(key, value) {
    setBorrador(b => ({ ...b, [key]: value }))
  }

  async function guardarBorrador() {
    setGuardando(true)
    setMsg('')
    const upserts = Object.entries(borrador).map(([field_key, value]) => ({
      page_key: paginaActiva, field_key, value, is_draft: true,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('page_content')
      .upsert(upserts, { onConflict: 'page_key,field_key' })
    setGuardando(false)
    setMsg(error ? 'Error al guardar el borrador.' : '✓ Borrador guardado.')
    setTimeout(() => setMsg(''), 3000)
  }

  async function publicar() {
    setPublicando(true)
    setMsg('')
    const upserts = Object.entries(borrador).map(([field_key, value]) => ({
      page_key: paginaActiva, field_key, value, is_draft: false,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('page_content')
      .upsert(upserts, { onConflict: 'page_key,field_key' })
    setPublicando(false)
    if (!error) {
      setContenido({ ...borrador })
      setMsg('🚀 ¡Cambios publicados en vivo!')
    } else {
      setMsg('Error al publicar.')
    }
    setTimeout(() => setMsg(''), 3000)
  }

  const camposModificados = Object.keys(borrador).some(k => borrador[k] !== contenido[k])
  const camposActivos     = CAMPOS_POR_PAGINA[paginaActiva] || []
  const paginaInfo        = PAGINAS.find(p => p.key === paginaActiva)

  return (
    <div className="min-h-screen bg-background">

      {/* TopBar */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-8 h-16
                         bg-surface-container-lowest/80 backdrop-blur-xl
                         border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="font-headline text-xl font-extrabold tracking-tight text-primary">
            Editor de Contenido
          </h1>
          {camposModificados && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-tertiary bg-tertiary-fixed px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-tertiary rounded-full animate-pulse" />
              Cambios sin publicar
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={guardarBorrador}
            disabled={guardando || !camposModificados}
            className="px-5 py-2 rounded-full text-sm font-bold border border-outline-variant
                       hover:bg-surface-container transition-colors disabled:opacity-40"
          >
            {guardando ? 'Guardando...' : 'Guardar borrador'}
          </button>
          <button
            onClick={publicar}
            disabled={publicando}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold
                       bg-primary text-on-primary shadow-lg hover:-translate-y-0.5
                       active:scale-95 transition-all disabled:opacity-60"
          >
            {publicando
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Publicando...</>
              : <><span className="material-symbols-outlined text-sm">rocket_launch</span>Publicar en vivo</>
            }
          </button>
        </div>
      </header>

      <div className="p-8 max-w-7xl mx-auto grid grid-cols-12 gap-8">

        {/* Sidebar izquierdo */}
        <div className="col-span-3 space-y-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 px-1">
              Páginas editables
            </p>
            <div className="space-y-1">
              {PAGINAS.map(({ key, icon, label }) => (
                <button
                  key={key}
                  onClick={() => setPaginaActiva(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left
                    ${paginaActiva === key
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <span className="material-symbols-outlined text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Info de la sección */}
          <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
            <p className="text-xs font-bold text-primary mb-1 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              Cómo funciona
            </p>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Los cambios guardados como borrador no son visibles para los usuarios.
              Usa <strong>Publicar en vivo</strong> para que los cambios aparezcan en la app.
            </p>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="col-span-9 space-y-6">

          {/* Mensaje de estado */}
          {msg && (
            <div className={`px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2
              ${msg.includes('Error') ? 'bg-error-container text-error' : 'bg-secondary-container text-on-secondary-container'}`}>
              {msg}
            </div>
          )}

          {/* Panel de textos */}
          <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">{paginaInfo?.icon}</span>
              </div>
              <div>
                <h3 className="font-bold text-lg font-headline">{paginaInfo?.label}</h3>
                <p className="text-xs text-on-surface-variant">Textos visibles para los usuarios</p>
              </div>
            </div>

            {camposActivos.map(campo => (
              <Campo
                key={campo.key}
                campo={campo}
                value={borrador[campo.key]}
                onChange={actualizarCampo}
              />
            ))}
          </div>

          {/* Panel de paquetes — solo en suscripciones */}
          {paginaActiva === 'suscripciones' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-secondary-container text-lg">inventory_2</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg font-headline">Paquetes de precios</h3>
                  <p className="text-xs text-on-surface-variant">
                    Estos son los planes que ven los usuarios en la página de suscripciones
                  </p>
                </div>
              </div>
              <PaquetesPanel navigate={navigate} />
            </div>
          )}

          {/* Preview de lo que verá el usuario */}
          {paginaActiva === 'suscripciones' && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/15 p-6">
              <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">visibility</span>
                Vista previa del hero
              </p>
              <div className="premium-gradient rounded-2xl p-6 text-white">
                <h2 className="font-headline font-extrabold text-2xl leading-tight mb-2">
                  {borrador.hero_titulo || '—'}
                </h2>
                <p className="text-primary-fixed opacity-90 text-sm mb-4">
                  {borrador.hero_subtitulo || '—'}
                </p>
                <span className="inline-flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider">
                  <span className="material-symbols-outlined text-sm"
                    style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
                  {borrador.hero_badge || '—'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}