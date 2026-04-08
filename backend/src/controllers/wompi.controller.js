import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const webhookWompi = async (req, res) => {
  try {
    const { event, data, sent_at, signature } = req.body

    // 1. Verificar firma (nuevo método)
    const checksum = signature?.checksum
    const properties = Object.keys(req.body)
      .filter(k => k !== 'signature')
      .sort()
      .map(k => JSON.stringify(req.body[k]))
      .join('')
    const cadena = `${properties}${sent_at}${process.env.WOMPI_EVENTS_SECRET}`
    const hash = crypto.createHash('sha256').update(cadena).digest('hex')
    if (hash !== checksum) return res.status(401).json({ error: 'Firma inválida' })

    // 2. Solo procesar pagos aprobados
    if (event !== 'transaction.updated') return res.sendStatus(200)
    const tx = data?.transaction
    if (tx?.status !== 'APPROVED') return res.sendStatus(200)

    // 3. Leer metadata
    const { user_id, package_id } = tx.metadata || {}
    if (!user_id || !package_id) return res.sendStatus(200)

    // 4. Obtener paquete
    const { data: pkg } = await supabase
      .from('packages')
      .select('duration_days')
      .eq('id', package_id)
      .single()

    // 5. Crear purchase
    const end_date = new Date()
    end_date.setDate(end_date.getDate() + (pkg?.duration_days || 30))

    await supabase.from('purchases').insert({
      user_id,
      package_id,
      status: 'active',
      end_date: end_date.toISOString(),
      wompi_transaction_id: tx.id,
      amount: tx.amount_in_cents / 100
    })

    // 6. Registrar transacción
    await supabase.from('transactions').insert({
      user_id,
      package_id,
      amount: tx.amount_in_cents / 100,
      status: 'approved',
      wompi_transaction_id: tx.id,
      created_at: new Date().toISOString()
    })

    return res.sendStatus(200)
  } catch (err) {
    console.error('Webhook error:', err)
    return res.sendStatus(500)
  }
}