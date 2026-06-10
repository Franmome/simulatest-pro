import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export async function crearReporte(req, res) {
  try {
    const userId = req.user?.id || null
    const {
      tipo          = 'otro',      // 'extraccion_pdf' | 'analisis' | 'resultado' | 'otro'
      comentario    = '',
      analisis_id   = null,
      convocatoria_id = null,
      file_name     = null,
      file_size_mb  = null,
      error_msg     = null,
      etapa         = null,        // etapa del análisis donde falló
      modelo_usado  = null,
      user_agent    = null,
    } = req.body

    const datos = {
      analisis_id,
      convocatoria_id,
      file_name,
      file_size_mb,
      error_msg,
      etapa,
      modelo_usado,
      user_agent: user_agent || req.headers['user-agent'] || null,
    }

    const { data, error } = await supabase
      .from('error_reports')
      .insert({ user_id: userId, tipo, comentario, datos })
      .select('id')
      .single()

    if (error) {
      console.error('[Reportes] insert error:', error.message)
      return res.status(500).json({ error: 'No se pudo guardar el reporte.' })
    }

    console.log(`[Reportes] nuevo reporte id=${data.id} tipo=${tipo} user=${userId}`)
    return res.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[Reportes] excepción:', err.message)
    return res.status(500).json({ error: 'Error interno al guardar reporte.' })
  }
}

export async function listarReportes(req, res) {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo admins.' })

    const page  = Math.max(1, parseInt(req.query.page  || '1'))
    const limit = Math.min(50, parseInt(req.query.limit || '20'))
    const from  = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('error_reports')
      .select('id, tipo, comentario, datos, resuelto, created_at, user_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1)

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ reportes: data, total: count, page, limit })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}

export async function marcarResuelto(req, res) {
  try {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Solo admins.' })
    const { id } = req.params
    const { resuelto = true } = req.body
    const { error } = await supabase.from('error_reports').update({ resuelto }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
