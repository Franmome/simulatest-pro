import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'

const POR_PAGINA = 10

function iniciales(nombre) {
  if (!nombre) return '?'
  return nombre
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function barraProgreso(pct) {
  if (pct >= 80) return 'bg-secondary'
  if (pct >= 40) return 'bg-tertiary'
  if (pct >= 20) return 'bg-primary'
  return 'bg-error'
}

function tiempoRelativo(fecha) {
  if (!fecha) return '—'
  const diff = Math.floor((Date.now() - new Date(fecha)) / 1000)
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

function formatCompact(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n || 0}`
}

function StatCard({ title, value, subtitle, icon, tone = 'primary' }) {
  const tones = {
    primary: 'bg-surface-container-lowest',
    secondary: 'bg-surface-container-lowest',
    highlight: 'bg-primary text-on-primary',
    tertiary: 'bg-surface-container-lowest',
  }

  const iconTones = {
    primary: 'bg-primary-fixed text-primary',
    secondary: 'bg-secondary-container/40 text-secondary',
    highlight: 'bg-white/15 text-white',
    tertiary: 'bg-tertiary-fixed text-tertiary',
  }

  return (
    <div className={`${tones[tone]} p-6 rounded-2xl border border-outline-variant/15 shadow-sm flex flex-col justify-between min-h-[140px]`}>
      <div className={`w-10 h-10 rounded-xl ${iconTones[tone]} flex items-center justify-center mb-4`}>
        <span
          className="material-symbols-outlined text-lg"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
      </div>

      <div>
        <div className={`text-3xl font-black font-headline ${tone === 'highlight' ? 'text-on-primary' : 'text-on-surface'}`}>
          {typeof value === 'number' ? formatCompact(value) : value}
        </div>
        <div className={`text-sm font-bold mt-1 ${tone === 'highlight' ? 'text-on-primary' : 'text-on-surface'}`}>
          {title}
        </div>
        <div className={`text-xs mt-1 ${tone === 'highlight' ? 'text-primary-fixed' : 'text-on-surface-variant'}`}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

function HelpBox({ title, items }) {
  return (
    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
      <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-sm">info</span>
        {title}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] text-on-surface-variant leading-relaxed flex gap-2">
            <span className="font-bold text-primary">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function AdminUsuarios() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [usuarios, setUsuarios] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('Todos')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [stats, setStats] = useState({
    total: 0,
    premium: 0,
    rendimiento: 0,
    admins: 0,
  })

  const [usuarioEdit, setUsuarioEdit] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  const [modalCampana, setModalCampana] = useState(false)
  const [paquetes, setPaquetes] = useState([])
  const [campanaForm, setCampanaForm] = useState({
    package_id: '',
    dias: 30,
    rol: 'user',
  })
  const [lanzando, setLanzando] = useState(false)
  const [msgCampana, setMsgCampana] = useState('')

  const [regalando, setRegalando] = useState(null)

  useEffect(() => {
    cargarUsuarios()
  }, [pagina, busqueda, filtroRol, filtroEstado])

  useEffect(() => {
    cargarStats()
    cargarPaquetes()
  }, [])

  const nombreAdmin =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'Admin'

  const cargarUsuarios = useCallback(async () => {
    setCargando(true)

    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda.trim()) query = query.or(`full_name.ilike.%${busqueda.trim()}%,email.ilike.%${busqueda.trim()}%`)
    if (filtroRol !== 'Todos') query = query.eq('role', filtroRol)

    const { data, count } = await query
    setTotal(count || 0)

    if (!data) {
      setUsuarios([])
      setCargando(false)
      return
    }

    const conDatos = await Promise.all(
      data.map(async u => {
        const [{ count: compras }, { data: intentos }] = await Promise.all([
          supabase
            .from('purchases')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .in('status', ['active', 'manual']),
          supabase
            .from('attempts')
            .select('score')
            .eq('user_id', u.id)
            .eq('status', 'completed'),
        ])

        const progreso = intentos?.length
          ? Math.round(intentos.reduce((s, a) => s + (a.score || 0), 0) / intentos.length)
          : 0

        return {
          ...u,
          esPremium: (compras || 0) > 0,
          progreso,
          totalIntentos: intentos?.length || 0,
        }
      })
    )

    const filtrados =
      filtroEstado === 'Todos'
        ? conDatos
        : filtroEstado === 'Premium'
        ? conDatos.filter(u => u.esPremium)
        : conDatos.filter(u => !u.esPremium)

    setUsuarios(filtrados)
    setCargando(false)
  }, [pagina, busqueda, filtroRol, filtroEstado])

  async function cargarStats() {
    const [
      { count: totalU },
      { count: premium },
      { count: admins },
      { data: intentos },
    ] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('purchases').select('*', { count: 'exact', head: true }).in('status', ['active', 'manual']),
      supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
      supabase.from('attempts').select('score').eq('status', 'completed'),
    ])

    const rendimiento = intentos?.length
      ? Math.round(intentos.reduce((s, a) => s + (a.score || 0), 0) / intentos.length)
      : 0

    setStats({
      total: totalU || 0,
      premium: premium || 0,
      rendimiento,
      admins: admins || 0,
    })
  }

  async function cargarPaquetes() {
    const { data } = await supabase
      .from('packages')
      .select('id, name, price')
      .eq('is_active', true)
      .order('name')

    setPaquetes(data || [])
  }

  async function cambiarRol(u) {
    const nuevoRol = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`¿Cambiar rol de "${u.full_name}" a ${nuevoRol}?`)) return

    await supabase.from('users').update({ role: nuevoRol }).eq('id', u.id)
    cargarUsuarios()
    cargarStats()
  }

  async function regalarPaquete(u) {
    if (paquetes.length === 0) {
      alert('No hay paquetes activos. Crea uno primero desde Gestión de Paquetes.')
      navigate('/admin/paquetes')
      return
    }

    const pkgId = paquetes[0].id

    if (!confirm(`¿Otorgar acceso Premium a "${u.full_name || u.email || u.id}" por 30 días?`)) return

    setRegalando(u.id)

    const fin = new Date(Date.now() + 30 * 86400000)

    const { error } = await supabase.from('purchases').insert({
      user_id: u.id,
      package_id: pkgId,
      start_date: new Date().toISOString(),
      end_date: fin.toISOString(),
      status: 'active',
      amount: 0,
    })

    setRegalando(null)

    if (error) {
      alert(`Error al otorgar acceso: ${error.message}`)
      return
    }

    cargarUsuarios()
    cargarStats()
  }

  async function guardarEdicion(e) {
    e.preventDefault()
    setGuardando(true)

    const { error } = await supabase
      .from('users')
      .update({
        full_name: usuarioEdit.full_name,
        role: usuarioEdit.role,
      })
      .eq('id', usuarioEdit.id)

    setGuardando(false)

    if (!error) {
      setMsg('✓ Usuario actualizado.')
      setUsuarioEdit(null)
      cargarUsuarios()
      cargarStats()
    } else {
      setMsg('Error al actualizar.')
    }
  }

  async function exportarCSV() {
    const { data } = await supabase
      .from('users')
      .select('full_name, email, role, created_at')
      .order('created_at', { ascending: false })

    if (!data?.length) return

    const filas = [
      ['Nombre', 'Email', 'Rol', 'Fecha registro'],
      ...data.map(u => [
        u.full_name || '',
        u.email || '',
        u.role || 'user',
        u.created_at?.slice(0, 10) || '',
      ]),
    ]

    const csv = filas.map(f => f.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function lanzarCampana() {
    if (!campanaForm.package_id) {
      setMsgCampana('Selecciona un paquete')
      return
    }

    setLanzando(true)
    setMsgCampana('')

    try {
      let query = supabase.from('users').select('id')

      if (campanaForm.rol !== 'Todos') {
        query = query.eq('role', campanaForm.rol)
      }

      const { data: destinos } = await query

      if (!destinos?.length) {
        setMsgCampana('No hay usuarios con ese filtro')
        setLanzando(false)
        return
      }

      const fin = new Date(Date.now() + Number(campanaForm.dias) * 86400000)

      const inserts = destinos.map(u => ({
        user_id: u.id,
        package_id: campanaForm.package_id,
        start_date: new Date().toISOString(),
        end_date: fin.toISOString(),
        status: 'active',
        amount: 0,
      }))

      const { error } = await supabase.from('purchases').insert(inserts)

      if (error) throw error

      setMsgCampana(`✓ Acceso otorgado a ${destinos.length} usuarios`)
      cargarUsuarios()
      cargarStats()

      setTimeout(() => {
        setModalCampana(false)
        setMsgCampana('')
      }, 1800)
    } catch (err) {
      setMsgCampana(`Error: ${err.message}`)
    } finally {
      setLanzando(false)
    }
  }

  const totalPaginas = Math.ceil(total / POR_PAGINA)
  const porcentajePremium = stats.total ? Math.round((stats.premium / stats.total) * 100) : 0

  const resumen = useMemo(() => {
    return {
      gratis: Math.max(stats.total - stats.premium, 0),
    }
  }, [stats])

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8 min-h-screen max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Usuarios</span>
            </nav>

            <h2 className="text-3xl font-extrabold tracking-tight font-headline">
              Directorio de Usuarios
            </h2>

            <p className="text-on-surface-variant mt-1 text-sm max-w-2xl">
              Gestiona perfiles, roles, membresías, accesos premium y campañas masivas.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-full bg-surface-container-lowest border border-outline-variant/10 text-sm text-on-surface-variant">
              Administrando como <span className="font-bold text-on-surface">{nombreAdmin}</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
          <StatCard
            title="Total estudiantes"
            value={stats.total}
            subtitle="Usuarios registrados en plataforma"
            icon="group"
            tone="primary"
          />

          <StatCard
            title="Usuarios premium"
            value={`${formatCompact(stats.premium)} · ${porcentajePremium}%`}
            subtitle="Con acceso vigente o manual"
            icon="workspace_premium"
            tone="secondary"
          />

          <StatCard
            title="Rendimiento promedio"
            value={`${stats.rendimiento}%`}
            subtitle="Score promedio en intentos completados"
            icon="trending_up"
            tone="highlight"
          />

          <StatCard
            title="Administradores"
            value={stats.admins}
            subtitle={`Usuarios gratis estimados: ${resumen.gratis}`}
            icon="admin_panel_settings"
            tone="tertiary"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Principal */}
          <div className="lg:col-span-9 space-y-6">
            <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-10 border border-outline-variant/15">
              <div className="p-6 border-b border-outline-variant/10 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-lg">
                      search
                    </span>
                    <input
                      type="text"
                      value={busqueda}
                      onChange={e => {
                        setBusqueda(e.target.value)
                        setPagina(1)
                      }}
                      placeholder="Buscar por nombre o email..."
                      className="pl-10 pr-4 py-2.5 bg-surface-container border border-outline-variant/20 rounded-xl text-sm outline-none focus:ring-2 focus:ring-primary/20 w-72"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">
                      Rol:
                    </label>
                    <select
                      className="bg-surface-container-low border-none text-sm font-semibold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                      value={filtroRol}
                      onChange={e => {
                        setFiltroRol(e.target.value)
                        setPagina(1)
                      }}
                    >
                      <option value="Todos">Todos</option>
                      <option value="admin">Admin</option>
                      <option value="user">Usuario</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex bg-surface-container-high rounded-full p-1">
                    {['Todos', 'Premium', 'Activo'].map(f => (
                      <button
                        key={f}
                        onClick={() => {
                          setFiltroEstado(f)
                          setPagina(1)
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                          filtroEstado === f
                            ? 'bg-surface-container-lowest shadow-sm text-primary'
                            : 'text-on-surface-variant hover:text-primary'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={exportarCSV}
                    className="text-sm font-bold text-primary flex items-center gap-1.5 hover:bg-primary-fixed px-3 py-2 rounded-lg transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    Exportar CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      {['Usuario', 'Rol', 'Estado', 'Intentos', 'Progreso', 'Registro', ''].map(h => (
                        <th
                          key={h}
                          className={`px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider ${
                            h === '' ? 'text-right' : ''
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-outline-variant/10">
                    {cargando ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 7 }).map((__, j) => (
                            <td key={j} className="px-6 py-4">
                              <div className="h-4 bg-surface-container rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : usuarios.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-on-surface-variant text-sm">
                          <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">
                            group
                          </span>
                          No se encontraron usuarios
                        </td>
                      </tr>
                    ) : (
                      usuarios.map(u => (
                        <tr key={u.id} className="hover:bg-surface-container-low/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {iniciales(u.full_name || u.email)}
                              </div>

                              <div>
                                <p className="text-sm font-bold">{u.full_name || 'Sin nombre'}</p>
                                <p className="text-[10px] text-on-surface-variant">
                                  {u.email || `${u.id.slice(0, 12)}...`}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg capitalize ${
                              u.role === 'admin'
                                ? 'bg-primary-fixed text-primary'
                                : 'text-on-surface-variant bg-surface-container'
                            }`}>
                              {u.role || 'user'}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                              u.esPremium
                                ? 'bg-secondary-container text-on-secondary-container'
                                : 'bg-surface-container-high text-on-surface-variant'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${u.esPremium ? 'bg-secondary' : 'bg-outline'}`} />
                              {u.esPremium ? 'Premium' : 'Gratuito'}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-on-surface-variant">
                              {u.totalIntentos}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-1.5 bg-surface-container-highest rounded-full">
                                <div
                                  className={`h-full rounded-full transition-all ${barraProgreso(u.progreso)}`}
                                  style={{ width: `${u.progreso}%` }}
                                />
                              </div>
                              <span className="text-xs font-bold">{u.progreso}%</span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-xs text-on-surface-variant">
                              {tiempoRelativo(u.created_at)}
                            </p>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setUsuarioEdit(u)
                                  setMsg('')
                                }}
                                title="Editar"
                                className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-xl">edit</span>
                              </button>

                              <button
                                onClick={() => cambiarRol(u)}
                                title="Cambiar rol"
                                className="p-2 text-on-surface-variant hover:text-tertiary hover:bg-tertiary-fixed rounded-lg transition-all"
                              >
                                <span className="material-symbols-outlined text-xl">swap_horiz</span>
                              </button>

                              <button
                                onClick={() => regalarPaquete(u)}
                                disabled={regalando === u.id}
                                title="Regalar acceso"
                                className="p-2 text-on-surface-variant hover:text-secondary hover:bg-secondary-fixed rounded-lg transition-all disabled:opacity-40"
                              >
                                {regalando === u.id ? (
                                  <span className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin block" />
                                ) : (
                                  <span className="material-symbols-outlined text-xl">card_giftcard</span>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-outline-variant/10 flex items-center justify-between">
                <p className="text-sm text-on-surface-variant">
                  Mostrando{' '}
                  <span className="font-bold text-on-surface">
                    {total === 0
                      ? 0
                      : Math.min((pagina - 1) * POR_PAGINA + 1, total)}–
                    {Math.min(pagina * POR_PAGINA, total)}
                  </span>{' '}
                  de <span className="font-bold text-on-surface">{total.toLocaleString()}</span> usuarios
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPagina(p => Math.max(1, p - 1))}
                    disabled={pagina === 1}
                    className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 transition-all"
                  >
                    <span className="material-symbols-outlined">chevron_left</span>
                  </button>

                  {Array.from({ length: Math.min(totalPaginas, 3) }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPagina(p)}
                      className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                        pagina === p
                          ? 'bg-primary text-on-primary shadow-md'
                          : 'border border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  {totalPaginas > 3 && (
                    <>
                      <span className="px-1 text-on-surface-variant">...</span>
                      <button
                        onClick={() => setPagina(totalPaginas)}
                        className="w-10 h-10 rounded-lg border border-outline-variant hover:bg-surface-container-low text-sm font-bold transition-all"
                      >
                        {totalPaginas}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => setPagina(p => Math.min(totalPaginas || 1, p + 1))}
                    disabled={pagina >= totalPaginas}
                    className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 transition-all"
                  >
                    <span className="material-symbols-outlined">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-8">
            <HelpBox
              title="Cómo funciona este módulo"
              items={[
                'Premium se calcula según compras activas o accesos manuales.',
                'El botón de regalo asigna el primer paquete activo por defecto.',
                'La campaña masiva otorga acceso al paquete seleccionado a muchos usuarios.',
              ]}
            />

            <section className="bg-surface-container-low p-8 rounded-[2rem] border border-outline-variant/10">
              <div className="mb-6">
                <h2 className="text-xl font-bold font-headline">Campañas Masivas</h2>
                <p className="text-on-surface-variant text-xs mt-1">
                  Otorga acceso premium a grupos enteros de usuarios.
                </p>
              </div>

              <button
                onClick={() => setModalCampana(true)}
                className="w-full whitespace-nowrap px-8 py-4 bg-primary text-on-primary rounded-full font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-lg shadow-primary/20 text-sm flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">rocket_launch</span>
                Lanzar campaña
              </button>
            </section>

            <section className="bg-surface-container-lowest p-8 rounded-[2rem] border border-outline-variant/10 shadow-sm">
              <h2 className="text-xl font-bold font-headline mb-4">Resumen de miembros</h2>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Premium</span>
                  <span className="font-bold text-on-surface">{stats.premium}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Gratis</span>
                  <span className="font-bold text-on-surface">{resumen.gratis}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">Admins</span>
                  <span className="font-bold text-on-surface">{stats.admins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant">% premium</span>
                  <span className="font-bold text-on-surface">{porcentajePremium}%</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Modal editar */}
      {usuarioEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md shadow-2xl border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-sm">
                {iniciales(usuarioEdit.full_name || usuarioEdit.email)}
              </div>
              <h3 className="text-xl font-bold font-headline">Editar Usuario</h3>
            </div>

            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Nombre completo
                </label>
                <input
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  value={usuarioEdit.full_name || ''}
                  onChange={e => setUsuarioEdit(u => ({ ...u, full_name: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Rol
                </label>
                <select
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  value={usuarioEdit.role || 'user'}
                  onChange={e => setUsuarioEdit(u => ({ ...u, role: e.target.value }))}
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {msg && (
                <p className={`text-xs font-bold ${
                  msg.includes('Error') ? 'text-error' : 'text-secondary'
                }`}>
                  {msg}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setUsuarioEdit(null)}
                  className="px-6 py-2 rounded-full text-sm font-bold border border-outline-variant hover:bg-surface-container transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2 rounded-full text-sm font-bold bg-primary text-on-primary shadow-lg active:scale-95 transition-all disabled:opacity-60"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal campaña */}
      {modalCampana && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md shadow-2xl border border-outline-variant/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold font-headline">Campaña Masiva</h3>
              <button
                onClick={() => setModalCampana(false)}
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <HelpBox
              title="Antes de lanzar"
              items={[
                'Elige un paquete activo.',
                'Define cuántos días de acceso tendrá.',
                'Selecciona si aplica a todos, solo users o solo admins.',
              ]}
            />

            <div className="space-y-4 mt-5">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Paquete a regalar
                </label>

                {paquetes.length === 0 ? (
                  <p className="text-sm text-error font-semibold">
                    No hay paquetes activos. Crea uno primero.
                  </p>
                ) : (
                  <select
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={campanaForm.package_id}
                    onChange={e => setCampanaForm(f => ({ ...f, package_id: e.target.value }))}
                  >
                    <option value="">Selecciona un paquete</option>
                    {paquetes.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ${Number(p.price).toLocaleString('es-CO')}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Días de acceso
                  </label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={campanaForm.dias}
                    onChange={e => setCampanaForm(f => ({ ...f, dias: e.target.value }))}
                  >
                    <option value={7}>7 días</option>
                    <option value={30}>30 días</option>
                    <option value={90}>90 días</option>
                    <option value={365}>1 año</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                    Aplicar a
                  </label>
                  <select
                    className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                    value={campanaForm.rol}
                    onChange={e => setCampanaForm(f => ({ ...f, rol: e.target.value }))}
                  >
                    <option value="Todos">Todos los usuarios</option>
                    <option value="user">Solo usuarios</option>
                    <option value="admin">Solo admins</option>
                  </select>
                </div>
              </div>

              {msgCampana && (
                <p className={`text-xs font-bold px-3 py-2 rounded-lg ${
                  msgCampana.includes('Error')
                    ? 'bg-error-container text-error'
                    : 'bg-secondary-container text-on-secondary-container'
                }`}>
                  {msgCampana}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  onClick={() => setModalCampana(false)}
                  className="px-6 py-2 rounded-full text-sm font-bold border border-outline-variant hover:bg-surface-container transition-all"
                >
                  Cancelar
                </button>

                <button
                  onClick={lanzarCampana}
                  disabled={lanzando}
                  className="px-6 py-2 rounded-full text-sm font-bold bg-primary text-on-primary shadow-lg active:scale-95 transition-all disabled:opacity-60"
                >
                  {lanzando ? 'Lanzando...' : 'Confirmar campaña'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}