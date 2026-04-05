import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../utils/supabase'
import { useAuth } from '../../context/AuthContext'

const POR_PAGINA = 10

function iniciales(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
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
  if (diff < 3600)  return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  return `hace ${Math.floor(diff / 86400)} días`
}

export default function AdminUsuarios() {
  const navigate        = useNavigate()
  const { user, logout } = useAuth()

  const [usuarios,     setUsuarios]     = useState([])
  const [total,        setTotal]        = useState(0)
  const [pagina,       setPagina]       = useState(1)
  const [cargando,     setCargando]     = useState(true)
  const [busqueda,     setBusqueda]     = useState('')
  const [filtroRol,    setFiltroRol]    = useState('Todos')
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [stats,        setStats]        = useState({ total: 0, premium: 0, rendimiento: 0 })

  // Modal editar
  const [usuarioEdit, setUsuarioEdit] = useState(null)
  const [guardando,   setGuardando]   = useState(false)
  const [msg,         setMsg]         = useState('')

  // Modal campaña masiva
  const [modalCampana,  setModalCampana]  = useState(false)
  const [paquetes,      setPaquetes]      = useState([])
  const [campanaForm,   setCampanaForm]   = useState({ package_id: '', dias: 30, rol: 'user' })
  const [lanzando,      setLanzando]      = useState(false)
  const [msgCampana,    setMsgCampana]    = useState('')

  // Regalo individual
  const [regalando, setRegalando] = useState(null)

  useEffect(() => { cargarUsuarios() }, [pagina, busqueda, filtroRol, filtroEstado])
  useEffect(() => { cargarStats(); cargarPaquetes() }, [])

  // ─── Datos del admin en topbar ────────────────────────────────────────
  const nombreAdmin  = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin'
  const avatarAdmin  = user?.user_metadata?.avatar_url || null
  const inicialesAdm = nombreAdmin.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  // ─── Cargar usuarios ──────────────────────────────────────────────────
  const cargarUsuarios = useCallback(async () => {
    setCargando(true)
    let query = supabase
      .from('users')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1)

    if (busqueda.trim())       query = query.ilike('full_name', `%${busqueda}%`)
    if (filtroRol !== 'Todos') query = query.eq('role', filtroRol)

    const { data, count } = await query
    setTotal(count || 0)
    if (!data) { setCargando(false); return }

    const conDatos = await Promise.all(data.map(async u => {
      const [{ count: compras }, { data: intentos }] = await Promise.all([
        supabase.from('purchases').select('*', { count: 'exact', head: true })
          .eq('user_id', u.id).eq('status', 'active'),
        supabase.from('attempts').select('score').eq('user_id', u.id).eq('status', 'completed'),
      ])
      const progreso = intentos?.length
        ? Math.round(intentos.reduce((s, a) => s + (a.score || 0), 0) / intentos.length)
        : 0
      return { ...u, esPremium: (compras || 0) > 0, progreso, totalIntentos: intentos?.length || 0 }
    }))

    const filtrados = filtroEstado === 'Todos'   ? conDatos
      : filtroEstado === 'Premium' ? conDatos.filter(u => u.esPremium)
      : conDatos.filter(u => !u.esPremium)

    setUsuarios(filtrados)
    setCargando(false)
  }, [pagina, busqueda, filtroRol, filtroEstado])

  // ─── Stats globales ───────────────────────────────────────────────────
  async function cargarStats() {
    const [{ count: totalU }, { count: premium }, { data: intentos }] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('purchases').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('attempts').select('score').eq('status', 'completed'),
    ])
    const rendimiento = intentos?.length
      ? Math.round(intentos.reduce((s, a) => s + (a.score || 0), 0) / intentos.length)
      : 0
    setStats({ total: totalU || 0, premium: premium || 0, rendimiento })
  }

  // ─── Cargar paquetes para modal campaña ───────────────────────────────
  async function cargarPaquetes() {
    const { data } = await supabase.from('packages').select('id, name, price').eq('is_active', true)
    setPaquetes(data || [])
  }

  // ─── Cambiar rol ──────────────────────────────────────────────────────
  async function cambiarRol(u) {
    const nuevoRol = u.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`¿Cambiar rol de "${u.full_name}" a ${nuevoRol}?`)) return
    await supabase.from('users').update({ role: nuevoRol }).eq('id', u.id)
    cargarUsuarios()
  }

  // ─── Regalo individual — requiere un paquete real ─────────────────────
  async function regalarPaquete(u) {
    if (paquetes.length === 0) {
      alert('No hay paquetes activos. Crea uno primero desde Gestión de Paquetes.')
      navigate('/admin/paquetes')
      return
    }
    const pkgId = paquetes[0].id  // regalo el primero activo por defecto
    if (!confirm(`¿Otorgar acceso Premium a "${u.full_name}" por 30 días?`)) return
    setRegalando(u.id)
    const fin = new Date(Date.now() + 30 * 86400000)
    const { error } = await supabase.from('purchases').insert({
      user_id:    u.id,
      package_id: pkgId,
      start_date: new Date().toISOString(),
      end_date:   fin.toISOString(),
      status:     'active',
    })
    setRegalando(null)
    if (error) { alert('Error al otorgar acceso: ' + error.message); return }
    cargarUsuarios()
    cargarStats()
  }

  // ─── Guardar edición ──────────────────────────────────────────────────
  async function guardarEdicion(e) {
    e.preventDefault()
    setGuardando(true)
    const { error } = await supabase
      .from('users')
      .update({ full_name: usuarioEdit.full_name, role: usuarioEdit.role })
      .eq('id', usuarioEdit.id)
    setGuardando(false)
    if (!error) {
      setMsg('✓ Usuario actualizado.')
      setUsuarioEdit(null)
      cargarUsuarios()
    } else {
      setMsg('Error al actualizar.')
    }
  }

  // ─── Exportar CSV ─────────────────────────────────────────────────────
  async function exportarCSV() {
    // Traer todos (sin paginación)
    const { data } = await supabase
      .from('users')
      .select('full_name, role, created_at')
      .order('created_at', { ascending: false })

    if (!data?.length) return
    const filas = [
      ['Nombre', 'Rol', 'Fecha registro'],
      ...data.map(u => [u.full_name || '', u.role || 'user', u.created_at?.slice(0, 10) || '']),
    ]
    const csv  = filas.map(f => f.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `usuarios-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Campaña masiva ───────────────────────────────────────────────────
  async function lanzarCampana() {
    if (!campanaForm.package_id) { setMsgCampana('Selecciona un paquete'); return }
    setLanzando(true)
    setMsgCampana('')
    try {
      // Traer usuarios según rol
      let query = supabase.from('users').select('id')
      if (campanaForm.rol !== 'Todos') query = query.eq('role', campanaForm.rol)
      const { data: destinos } = await query

      if (!destinos?.length) { setMsgCampana('No hay usuarios con ese filtro'); setLanzando(false); return }

      const fin = new Date(Date.now() + Number(campanaForm.dias) * 86400000)
      const inserts = destinos.map(u => ({
        user_id:    u.id,
        package_id: campanaForm.package_id,
        start_date: new Date().toISOString(),
        end_date:   fin.toISOString(),
        status:     'active',
      }))

      const { error } = await supabase.from('purchases').insert(inserts)
      if (error) throw error

      setMsgCampana(`✓ Acceso otorgado a ${destinos.length} usuarios`)
      cargarUsuarios()
      cargarStats()
      setTimeout(() => { setModalCampana(false); setMsgCampana('') }, 2000)
    } catch (err) {
      setMsgCampana('Error: ' + err.message)
    } finally {
      setLanzando(false)
    }
  }

  const totalPaginas      = Math.ceil(total / POR_PAGINA)
  const porcentajePremium = stats.total ? Math.round((stats.premium / stats.total) * 100) : 0

  return (
    <div className="min-h-screen bg-background">

      {/* ── TopBar con usuario real ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-8 h-16
                         bg-surface-container-lowest/80 backdrop-blur-xl
                         border-b border-outline-variant/20 shadow-sm">
        <div className="flex items-center flex-1 max-w-xl">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2
                             text-on-surface-variant text-lg">search</span>
            <input
              className="w-full pl-10 pr-4 py-2 bg-surface-container border-none rounded-full
                         text-sm outline-none focus:ring-2 focus:ring-primary/20
                         placeholder:text-on-surface-variant"
              placeholder="Buscar usuarios, roles o progreso..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(1) }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
          </button>
          <div className="h-8 w-px bg-outline-variant/40 mx-1" />
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold leading-none">{nombreAdmin}</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">Super Admin</p>
          </div>
          {avatarAdmin ? (
            <img src={avatarAdmin} alt={nombreAdmin}
                 className="w-9 h-9 rounded-full object-cover ring-2 ring-primary/20" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center
                            text-on-primary font-bold text-xs ring-2 ring-primary/20">
              {inicialesAdm}
            </div>
          )}
        </div>
      </header>

      <main className="p-8 min-h-screen">

        {/* ── Page Header ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <nav className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mb-2">
              <span>Consola</span>
              <span className="material-symbols-outlined text-[10px]">chevron_right</span>
              <span className="text-primary">Directorio de Usuarios</span>
            </nav>
            <h2 className="text-3xl font-extrabold tracking-tight font-headline">Directorio de Usuarios</h2>
            <p className="text-on-surface-variant mt-1 text-sm">
              Gestiona perfiles, membresías y progreso académico de la comunidad.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-surface-container-high rounded-full p-1">
              {['Todos', 'Premium', 'Activo'].map(f => (
                <button
                  key={f}
                  onClick={() => { setFiltroEstado(f); setPagina(1) }}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all
                    ${filtroEstado === f
                      ? 'bg-surface-container-lowest shadow-sm text-primary'
                      : 'text-on-surface-variant hover:text-primary'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 flex flex-col justify-between h-32">
            <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Total Estudiantes</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black">{stats.total.toLocaleString()}</h3>
              <span className="text-secondary text-sm font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-xs">trending_up</span> activos
              </span>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 flex flex-col justify-between h-32">
            <p className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Usuarios Premium</p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-black">{stats.premium.toLocaleString()}</h3>
              <span className="bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded text-[10px] font-bold">
                {porcentajePremium}%
              </span>
            </div>
          </div>

          <div className="bg-primary p-6 rounded-xl col-span-1 md:col-span-2
                          flex items-center justify-between relative overflow-hidden h-32">
            <div className="relative z-10">
              <p className="text-primary-fixed text-sm font-semibold uppercase tracking-wider opacity-80">
                Rendimiento Promedio
              </p>
              <h3 className="text-3xl font-black text-on-primary">{stats.rendimiento}%</h3>
              <p className="text-primary-fixed text-xs mt-1">Score promedio de intentos completados</p>
            </div>
            <div className="w-32 h-32 bg-white/10 rounded-full blur-3xl absolute -right-8 -bottom-8 pointer-events-none" />
            <div className="relative z-10 w-24 h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="bg-secondary-fixed h-full rounded-full transition-all"
                   style={{ width: `${stats.rendimiento}%` }} />
            </div>
          </div>
        </div>

        {/* ── Tabla ── */}
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden mb-10 border border-outline-variant/15">

          {/* Filtros */}
          <div className="p-6 border-b border-outline-variant/10 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-tighter">Rol:</label>
                <select
                  className="bg-surface-container-low border-none text-sm font-semibold rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20"
                  value={filtroRol}
                  onChange={e => { setFiltroRol(e.target.value); setPagina(1) }}
                >
                  <option value="Todos">Todos los roles</option>
                  <option value="admin">Admin</option>
                  <option value="user">Usuario</option>
                </select>
              </div>
            </div>
            <button
              onClick={exportarCSV}
              className="text-sm font-bold text-primary flex items-center gap-1.5 hover:bg-primary-fixed px-3 py-2 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Exportar CSV
            </button>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low/50">
                  {['Usuario', 'Rol', 'Estado', 'Intentos', 'Progreso', 'Registro', ''].map(h => (
                    <th key={h} className={`px-6 py-4 text-[10px] font-bold text-on-surface-variant
                                            uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {cargando ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-surface-container rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-on-surface-variant text-sm">
                      <span className="material-symbols-outlined text-4xl opacity-30 mb-2 block">group</span>
                      No se encontraron usuarios
                    </td>
                  </tr>
                ) : (
                  usuarios.map(u => (
                    <tr key={u.id} className="hover:bg-surface-container-low/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary
                                          flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {iniciales(u.full_name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold">{u.full_name || 'Sin nombre'}</p>
                            <p className="text-[10px] text-on-surface-variant">{u.id.slice(0, 12)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg capitalize
                          ${u.role === 'admin' ? 'bg-primary-fixed text-primary' : 'text-on-surface-variant'}`}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold
                          ${u.esPremium
                            ? 'bg-secondary-container text-on-secondary-container'
                            : 'bg-surface-container-high text-on-surface-variant'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${u.esPremium ? 'bg-secondary' : 'bg-outline'}`} />
                          {u.esPremium ? 'Premium' : 'Gratuito'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-on-surface-variant">{u.totalIntentos}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-20 h-1.5 bg-surface-container-highest rounded-full">
                            <div className={`h-full rounded-full transition-all ${barraProgreso(u.progreso)}`}
                                 style={{ width: `${u.progreso}%` }} />
                          </div>
                          <span className="text-xs font-bold">{u.progreso}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-on-surface-variant">{tiempoRelativo(u.created_at)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setUsuarioEdit(u); setMsg('') }}
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
                            title="Regalar acceso Premium"
                            className="p-2 text-on-surface-variant hover:text-secondary hover:bg-secondary-fixed rounded-lg transition-all disabled:opacity-40"
                          >
                            {regalando === u.id
                              ? <span className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin block" />
                              : <span className="material-symbols-outlined text-xl">card_giftcard</span>
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="p-6 border-t border-outline-variant/10 flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">
              Mostrando{' '}
              <span className="font-bold text-on-surface">
                {total === 0 ? 0 : Math.min((pagina - 1) * POR_PAGINA + 1, total)}–{Math.min(pagina * POR_PAGINA, total)}
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
                  className={`w-10 h-10 rounded-lg text-sm font-bold transition-all
                    ${pagina === p
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'border border-outline-variant hover:bg-surface-container-low'}`}
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
                onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                disabled={pagina >= totalPaginas}
                className="p-2 rounded-lg border border-outline-variant hover:bg-surface-container-low disabled:opacity-40 transition-all"
              >
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Banner campaña masiva ── */}
        <div className="bg-surface-container-low p-8 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-8 border border-outline-variant/15">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-tertiary-fixed rounded-2xl flex items-center justify-center text-tertiary flex-shrink-0">
              <span className="material-symbols-outlined text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <h4 className="text-xl font-bold font-headline">Campañas Masivas de Membresía</h4>
              <p className="text-on-surface-variant text-sm mt-1">
                Otorga acceso Premium a grupos enteros de estudiantes en segundos.
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalCampana(true)}
            className="whitespace-nowrap px-8 py-4 bg-primary text-on-primary rounded-full
                       font-bold hover:bg-primary/90 transition-all active:scale-95
                       shadow-lg shadow-primary/20 text-sm flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            Lanzar Campaña
          </button>
        </div>
      </main>

      {/* ══ Modal editar usuario ══ */}
      {usuarioEdit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md shadow-2xl border border-outline-variant/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-fixed text-primary flex items-center justify-center font-bold text-sm">
                {iniciales(usuarioEdit.full_name)}
              </div>
              <h3 className="text-xl font-bold font-headline">Editar Usuario</h3>
            </div>
            <form onSubmit={guardarEdicion} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Nombre completo
                </label>
                <input
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4
                             outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  value={usuarioEdit.full_name || ''}
                  onChange={e => setUsuarioEdit(u => ({ ...u, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rol</label>
                <select
                  className="w-full bg-surface-container-low border-none rounded-xl py-3 px-4
                             outline-none focus:ring-2 focus:ring-primary/20 text-sm"
                  value={usuarioEdit.role || 'user'}
                  onChange={e => setUsuarioEdit(u => ({ ...u, role: e.target.value }))}
                >
                  <option value="user">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {msg && (
                <p className={`text-xs font-bold ${msg.includes('Error') ? 'text-error' : 'text-secondary'}`}>{msg}</p>
              )}
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setUsuarioEdit(null)}
                  className="px-6 py-2 rounded-full text-sm font-bold border border-outline-variant hover:bg-surface-container transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando}
                  className="px-6 py-2 rounded-full text-sm font-bold bg-primary text-on-primary shadow-lg active:scale-95 transition-all disabled:opacity-60">
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ Modal campaña masiva ══ */}
      {modalCampana && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-8 w-full max-w-md shadow-2xl border border-outline-variant/20">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold font-headline">Campaña Masiva</h3>
              <button onClick={() => setModalCampana(false)}
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-4">
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
                <p className={`text-xs font-bold px-3 py-2 rounded-lg
                  ${msgCampana.includes('Error') ? 'bg-error-container text-error' : 'bg-secondary-container text-on-secondary-container'}`}>
                  {msgCampana}
                </p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setModalCampana(false)}
                  className="px-6 py-2 rounded-full text-sm font-bold border border-outline-variant hover:bg-surface-container transition-all">
                  Cancelar
                </button>
                <button
                  onClick={lanzarCampana}
                  disabled={lanzando || !campanaForm.package_id}
                  className="px-6 py-2 rounded-full text-sm font-bold bg-primary text-on-primary shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center gap-2"
                >
                  {lanzando && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
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