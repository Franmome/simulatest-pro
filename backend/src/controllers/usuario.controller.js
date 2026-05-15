import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const getPerfil    = async (req, res) => res.json({ user: req.user })
export const getHistorial = async (req, res) => res.json({ historial: [] })
export const updatePerfil = async (req, res) => res.json({ updated: true })

export const deleteUsuario = async (req, res) => {
  // Solo admins pueden borrar usuarios
  const { data: solicitante } = await supabase
    .from('users').select('role').eq('id', req.user.id).maybeSingle()
  if (solicitante?.role !== 'admin')
    return res.status(403).json({ error: 'Solo administradores pueden eliminar usuarios.' })

  const { id } = req.params
  if (id === req.user.id)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo.' })

  // Limpiar datos del usuario antes de borrar auth
  await supabase.from('purchases').delete().eq('user_id', id)
  await supabase.from('attempts').delete().eq('user_id', id)
  await supabase.from('users').delete().eq('id', id)

  // Borrar de Supabase Auth (requiere service key)
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return res.status(500).json({ error: error.message })

  return res.json({ ok: true })
}
