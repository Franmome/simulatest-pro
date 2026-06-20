import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const TODAS_HERRAMIENTAS = ['simulacros', 'cuaderno', 'salas']

export const webhookWompi = async (req, res) => {
  console.log('🔔 Webhook recibido:', JSON.stringify(req.body, null, 2))
  try {
    const { event, data, sent_at, signature, timestamp } = req.body
    console.log('📦 Evento:', event, '| Status:', data?.transaction?.status)
    console.log('🔑 Reference:', data?.transaction?.reference)

    // 1. Verificar firma
    const tx    = data?.transaction
    const props = signature?.properties || []
    const valoresFirma = props.map(p => {
      const keys = p.split('.')
      return keys.reduce((obj, key) => obj?.[key], data)
    })
    const cadena = [...valoresFirma, timestamp, process.env.WOMPI_EVENTS_SECRET].join('')
    const hash   = crypto.createHash('sha256').update(cadena).digest('hex')
    if (hash !== signature?.checksum) return res.status(401).json({ error: 'Firma inválida' })

    // 2. Solo procesar pagos aprobados
    if (event !== 'transaction.updated') return res.sendStatus(200)
    if (tx?.status !== 'APPROVED')       return res.sendStatus(200)

    // 3. Parsear referencia
    // Formato tickets: {uuid}-TICKET-{cantidad}-{timestamp}
    // Formato nuevo:   {uuid}-{package_id}-{herramienta}-{dias}-{timestamp}  (9+ partes)
    // Formato legado:  {uuid}-{package_id}-{timestamp}                        (7 partes)
    const reference = tx.reference || ''
    const partes    = reference.split('-')
    const user_id   = partes.slice(0, 5).join('-')
    if (!user_id) return res.sendStatus(200)

    // ── Manejo de tickets de análisis de perfil ──────────────────────────────
    if (partes[5] === 'TICKET') {
      const cantidad = parseInt(partes[6]) || 1
      console.log(`🎟️ Ticket comprado: user=${user_id} cantidad=${cantidad}`)
      const { data: existing } = await supabase
        .from('user_analisis_tickets')
        .select('tickets')
        .eq('user_id', user_id)
        .maybeSingle()
      if (existing) {
        await supabase.from('user_analisis_tickets')
          .update({ tickets: (existing.tickets || 0) + cantidad, updated_at: new Date().toISOString() })
          .eq('user_id', user_id)
      } else {
        await supabase.from('user_analisis_tickets').insert({ user_id, tickets: cantidad })
      }
      await supabase.from('transactions').insert({
        user_id, package_id: null, amount: tx.amount_in_cents / 100,
        status: 'approved', wompi_transaction_id: tx.id, created_at: new Date().toISOString(),
      })
      console.log(`✅ ${cantidad} ticket(s) asignados a ${user_id}`)
      return res.sendStatus(200)
    }

    // ── Manejo de tickets de análisis de oferta de trabajo ───────────────────
    if (partes[5] === 'OFERTA') {
      const cantidad = parseInt(partes[6]) || 1
      console.log(`🎟️ Ticket oferta comprado: user=${user_id} cantidad=${cantidad}`)
      const { data: existing } = await supabase
        .from('user_oferta_tickets')
        .select('tickets')
        .eq('user_id', user_id)
        .maybeSingle()
      if (existing) {
        await supabase.from('user_oferta_tickets')
          .update({ tickets: (existing.tickets || 0) + cantidad, updated_at: new Date().toISOString() })
          .eq('user_id', user_id)
      } else {
        await supabase.from('user_oferta_tickets').insert({ user_id, tickets: cantidad })
      }
      await supabase.from('transactions').insert({
        user_id, package_id: null, amount: tx.amount_in_cents / 100,
        status: 'approved', wompi_transaction_id: tx.id, created_at: new Date().toISOString(),
      })
      console.log(`✅ ${cantidad} ticket(s) oferta asignados a ${user_id}`)
      return res.sendStatus(200)
    }

    const package_id = parseInt(partes[5])
    if (!package_id) return res.sendStatus(200)

    const isNuevoFormato = partes.length >= 9
    const herramienta    = isNuevoFormato ? partes[6] : 'paquete_completo'
    const dias           = isNuevoFormato ? parseInt(partes[7]) : null

    console.log('👤 user_id:', user_id)
    console.log('📦 package_id:', package_id, '| herramienta:', herramienta, '| dias:', dias)

    // 4. Obtener paquete
    const { data: pkg } = await supabase
      .from('packages')
      .select('duration_days, duracion_dias, herramientas')
      .eq('id', package_id)
      .maybeSingle()

    const duracion = dias || pkg?.duracion_dias || pkg?.duration_days || 30
    const end_date = new Date()
    end_date.setDate(end_date.getDate() + duracion)

    // 5. Crear purchase (registro financiero)
    const { data: purchase } = await supabase
      .from('purchases')
      .insert({
        user_id,
        package_id,
        status:               'active',
        end_date:             end_date.toISOString(),
        wompi_transaction_id: tx.id,
        amount:               tx.amount_in_cents / 100,
      })
      .select('id')
      .single()
    console.log('✅ Purchase insertado:', purchase?.id)

    // 6. Determinar qué herramientas otorgar
    const herramientasActivas = Object.entries(pkg?.herramientas || {})
      .filter(([key, val]) => key !== 'paquete_completo' && val?.activo)
      .map(([key]) => key)

    const herramientasAOtorgar = herramienta === 'paquete_completo'
      ? (herramientasActivas.length ? herramientasActivas : TODAS_HERRAMIENTAS)
      : [herramienta]

    // 7. Insertar accesos en user_tool_purchases
    if (herramientasAOtorgar.length) {
      const filas = herramientasAOtorgar.map(h => ({
        user_id,
        package_id,
        herramienta_id: h,
        purchase_id:    purchase?.id || null,
        end_date:       end_date.toISOString(),
      }))
      const { error: errTools } = await supabase.from('user_tool_purchases').insert(filas)
      if (errTools) console.error('⚠️ Error insertando user_tool_purchases:', errTools.message)
      else console.log('✅ Herramientas otorgadas:', herramientasAOtorgar)
    }

    // 8. Registrar transacción
    await supabase.from('transactions').insert({
      user_id,
      package_id,
      amount:               tx.amount_in_cents / 100,
      status:               'approved',
      wompi_transaction_id: tx.id,
      created_at:           new Date().toISOString(),
    })
    console.log('✅ Transaction insertada')

    return res.sendStatus(200)
  } catch (err) {
    console.error('Webhook error:', err)
    await supabase.from('system_errors').insert({
      severity:    'critical',
      error_code:  'WEBHOOK_ERROR',
      description: err.message || 'Error en webhook Wompi',
      status:      'pending',
    })
    return res.sendStatus(500)
  }
}
