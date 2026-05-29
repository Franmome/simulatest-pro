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
  const { package_id, herramienta_id, plan_id, package_version_id } = req.body
  const user_id = req.user.id

  const publicKey = process.env.WOMPI_PUBLIC_KEY
  if (!publicKey) return res.status(500).json({ error: 'Pasarela de pago no configurada. Contacta soporte.' })

  const { data: pkg } = await supabase
    .from('packages')
    .select('price, duracion_dias, herramientas')
    .eq('id', package_id)
    .maybeSingle()
  if (!pkg) return res.status(404).json({ error: 'Paquete no encontrado' })

  let price, dias, herramienta

  if (herramienta_id && plan_id) {
    // ── Nuevo modelo: plan por herramienta o paquete_completo ──────────────
    const cfg = pkg.herramientas?.[herramienta_id]
    if (!cfg?.activo && herramienta_id !== 'paquete_completo') {
      return res.status(400).json({ error: 'Herramienta no disponible en este paquete' })
    }
    if (herramienta_id === 'paquete_completo' && !pkg.herramientas?.paquete_completo?.activo) {
      return res.status(400).json({ error: 'Paquete completo no disponible' })
    }

    const plan = (cfg?.planes || []).find(p => p.id === plan_id)
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' })

    price = Number(plan.precio)
    dias  = Number(plan.dias) || 30
    herramienta = herramienta_id

  } else if (package_version_id) {
    // ── Legado: compra por versión de paquete ──────────────────────────────
    const { data: version } = await supabase
      .from('package_versions').select('price').eq('id', package_version_id).maybeSingle()
    if (!version) return res.status(404).json({ error: 'Versión de paquete no encontrada' })
    price = Number(version.price)
    dias  = Number(pkg.duracion_dias) || 30
    herramienta = 'paquete_completo'

  } else {
    // ── Legado: precio del paquete directamente ────────────────────────────
    price = Number(pkg.price)
    dias  = Number(pkg.duracion_dias) || 30
    herramienta = 'paquete_completo'
  }

  if (!price || price <= 0) return res.status(400).json({ error: 'El precio del plan no es válido.' })

  const amount_in_cents = Math.round(price * 100)
  const currency        = 'COP'
  // Formato: {user_uuid}-{package_id}-{herramienta}-{dias}-{timestamp}
  // El webhook parsea las primeras 5 partes como UUID, luego package_id, herramienta y dias
  const reference = `${user_id}-${package_id}-${herramienta}-${dias}-${Date.now()}`
  const cadena    = `${reference}${amount_in_cents}${currency}${process.env.WOMPI_INTEGRITY_SECRET}`
  const signature = crypto.createHash('sha256').update(cadena).digest('hex')

  return res.json({
    public_key:       publicKey,
    amount_in_cents,
    currency,
    reference,
    signature,
    metadata:         { user_id, package_id, herramienta_id: herramienta, dias },
    redirect_url:     `${process.env.FRONTEND_URL}/pago-resultado`,
  })
}
