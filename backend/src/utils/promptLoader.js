// promptLoader.js
// Carga system prompts de Supabase con cache de 5 min.
// Fallback al prompt hardcoded si la tabla no existe o hay error.

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const _cache  = new Map()
const TTL     = 5 * 60 * 1000 // 5 minutos

export async function getPrompt(key, fallback = '', cerebro = 'gemini') {
  const cacheKey = `${key}:${cerebro}`
  const hit = _cache.get(cacheKey)
  if (hit && Date.now() - hit.ts < TTL) return hit.prompt

  try {
    const { data } = await supabase
      .from('ai_system_prompts')
      .select('system_prompt, system_prompt_deepseek')
      .eq('endpoint_key', key)
      .maybeSingle()

    // DeepSeek usa su prompt específico si existe, si no cae al de Gemini
    const prompt = cerebro === 'deepseek'
      ? (data?.system_prompt_deepseek || data?.system_prompt || fallback)
      : (data?.system_prompt ?? fallback)

    const result = prompt || fallback
    if (result) _cache.set(cacheKey, { prompt: result, ts: Date.now() })
    return result
  } catch {
    return fallback
  }
}

export function invalidatePromptCache(key) {
  key ? _cache.delete(key) : _cache.clear()
}
