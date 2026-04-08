import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const getPaquetes = async (_req, res) => {
  const { data, error } = await supabase
    .from('packages').select('*').eq('is_active', true).order('price')
  if (error) return res.status(500).json({ error: error.message })
  return res.json({ paquetes: data })
}

export const getPaquete = async (req, res) => {
  const { data, error } = await supabase
    .from('packages').select('*').eq('id', req.params.id).single()
  if (error) return res.status(404).json({ error: 'No encontrado' })
  return res.json({ paquete: data })
}

export const comprarPaquete = async (req, res) => {
  const { package_id } = req.body
  const user_id = req.user.id

  const { data: pkg } = await supabase
    .from('packages').select('*').eq('id', package_id).single()
  if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' })

  // Generar firma de integridad para Wompi
  const amount_in_cents = pkg.price * 100
  const currency = 'COP'
  const reference = `${user_id}-${package_id}-${Date.now()}`
  const cadena = `${reference}${amount_in_cents}${currency}${process.env.WOMPI_INTEGRITY_SECRET}`
  const signature = crypto.createHash('sha256').update(cadena).digest('hex')

  return res.json({
    public_key: process.env.WOMPI_PUBLIC_KEY,
    amount_in_cents,
    currency,
    reference,
    signature,
    metadata: { user_id, package_id },
    redirect_url: `${process.env.FRONTEND_URL}/pago-resultado`
  })
}