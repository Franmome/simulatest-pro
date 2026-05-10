// promptLoader.js
// Carga system prompts de Supabase con cache de 5 min.
// Fallback al prompt hardcoded si la tabla no existe o hay error.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const _cache  = new Map()
const TTL     = 5 * 60 * 1000 // 5 minutos

export async function getPrompt(key, fallback = '') {
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.ts < TTL) return hit.prompt

  try {
    const { data } = await supabase
      .from('ai_system_prompts')
      .select('system_prompt')
      .eq('endpoint_key', key)
      .maybeSingle()

    const prompt = data?.system_prompt ?? fallback
    if (prompt) _cache.set(key, { prompt, ts: Date.now() })
    return prompt || fallback
  } catch {
    return fallback
  }
}

export function invalidatePromptCache(key) {
  key ? _cache.delete(key) : _cache.clear()
}
