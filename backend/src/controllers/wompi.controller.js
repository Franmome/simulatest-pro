import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export const webhookWompi = async (req, res) => {
  console.log('🔔 Webhook recibido:', JSON.stringify(req.body, null, 2))
  try {
    const { event, data, sent_at, signature, timestamp } = req.body  // ✅ se extrae timestamp
    console.log('📦 Evento:', event, '| Status:', data?.transaction?.status)
    console.log('🔑 Reference:', data?.transaction?.reference)

    // 1. Verificar firma (método oficial con signature.properties)
    const tx = data?.transaction
    const props = signature?.properties || []
    const valoresFirma = props.map(p => {
      const keys = p.split('.')
      return keys.reduce((obj, key) => obj?.[key], data)
    })
    // ✅ se usa timestamp en lugar de sent_at
    const cadena = [...valoresFirma, timestamp, process.env.WOMPI_EVENTS_SECRET].join('')
    const hash = crypto.createHash('sha256').update(cadena).digest('hex')
    if (hash !== signature?.checksum) return res.status(401).json({ error: 'Firma inválida' })

    // 2. Solo procesar pagos aprobados
    if (event !== 'transaction.updated') return res.sendStatus(200)
    if (tx?.status !== 'APPROVED') return res.sendStatus(200)

    // 3. Leer referencia (formato: UUID-packageId-timestamp)
    const reference = tx.reference || ''
    const partes = reference.split('-')
    // UUID tiene 5 partes, luego viene package_id y timestamp
    const user_id = partes.slice(0, 5).join('-')
    const package_id = parseInt(partes[5])
    if (!user_id || !package_id) return res.sendStatus(200)

    console.log('👤 user_id:', user_id)
    console.log('📦 package_id:', package_id)

    // 4. Obtener paquete
    const { data: pkg } = await supabase
      .from('packages')
      .select('duration_days')
      .eq('id', package_id)
      .maybeSingle()

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
    console.log('✅ Purchase insertado')

    // 6. Registrar transacción
    await supabase.from('transactions').insert({
      user_id,
      package_id,
      amount: tx.amount_in_cents / 100,
      status: 'approved',
      wompi_transaction_id: tx.id,
      created_at: new Date().toISOString()
    })
    console.log('✅ Transaction insertada')

    return res.sendStatus(200)
  } catch (err) {
    console.error('Webhook error:', err)
    return res.sendStatus(500)
  }
}