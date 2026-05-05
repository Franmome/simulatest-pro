// tokenTracker.js
// Gestión de tokens IA por usuario: verificar saldo y registrar uso.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const TOKEN_LIMIT_DEFAULT = 1_000_000

// Devuelve la compra activa del usuario (necesitamos el purchase_id para el saldo)
export async function getActivePurchase(userId) {
  const { data } = await supabase
    .from('purchases')
    .select('id, packages(has_ai_chat)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  return data || null
}

// Verifica si el usuario tiene saldo de tokens disponible
export async function checkTokenBalance(userId, purchaseId) {
  if (!purchaseId) return { ok: true, used: 0, limit: TOKEN_LIMIT_DEFAULT, remaining: TOKEN_LIMIT_DEFAULT }

  const { data } = await supabase
    .from('user_ai_tokens')
    .select('tokens_used, tokens_limit')
    .eq('user_id', userId)
    .eq('purchase_id', purchaseId)
    .maybeSingle()

  const used      = data?.tokens_used  ?? 0
  const limit     = data?.tokens_limit ?? TOKEN_LIMIT_DEFAULT
  const remaining = limit - used

  return { ok: remaining > 0, used, limit, remaining }
}

// Registra el uso de tokens de forma atómica (no bloquea si falla)
export async function recordTokenUsage({ userId, purchaseId, tokensIn, tokensOut, endpoint, modelo }) {
  const total = (tokensIn || 0) + (tokensOut || 0)
  if (total <= 0) return

  try {
    await Promise.all([
      supabase.from('user_ai_usage_log').insert({
        user_id: userId, purchase_id: purchaseId || null,
        endpoint, modelo, tokens_in: tokensIn, tokens_out: tokensOut, tokens_total: total,
      }),
      purchaseId
        ? supabase.rpc('increment_ai_tokens', { p_user_id: userId, p_purchase_id: purchaseId, p_tokens: total })
        : Promise.resolve(),
    ])
  } catch (err) {
    console.error('[Tokens] Error registrando uso:', err.message)
  }
}
