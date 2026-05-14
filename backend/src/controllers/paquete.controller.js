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
    .from('packages').select('*').eq('id', req.params.id).maybeSingle()
  if (error) return res.status(404).json({ error: 'No encontrado' })
  return res.json({ paquete: data })
}

export const comprarPaquete = async (req, res) => {
  const { package_id, package_version_id } = req.body
  const user_id = req.user.id

  const publicKey = process.env.WOMPI_PUBLIC_KEY
  if (!publicKey) return res.status(500).json({ error: 'Pasarela de pago no configurada. Contacta soporte.' })

  let price
  let refId = package_id

  if (package_version_id) {
    const { data: version } = await supabase
      .from('package_versions').select('price').eq('id', package_version_id).maybeSingle()
    if (!version) return res.status(404).json({ error: 'Versión de paquete no encontrada' })
    price = Number(version.price)
    refId = package_version_id
  } else {
    const { data: pkg } = await supabase
      .from('packages').select('price').eq('id', package_id).maybeSingle()
    if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' })
    price = Number(pkg.price)
  }

  if (!price || price <= 0) return res.status(400).json({ error: 'El precio del paquete no es válido.' })

  const amount_in_cents = Math.round(price * 100)
  const currency = 'COP'
  const reference = `PRX-${String(user_id).slice(0, 8)}-${String(refId).slice(0, 8)}-${Date.now()}`
  const cadena = `${reference}${amount_in_cents}${currency}${process.env.WOMPI_INTEGRITY_SECRET}`
  const signature = crypto.createHash('sha256').update(cadena).digest('hex')

  return res.json({
    public_key: publicKey,
    amount_in_cents,
    currency,
    reference,
    signature,
    metadata: { user_id, package_id, package_version_id },
    redirect_url: `${process.env.FRONTEND_URL}/pago-resultado`
  })
}