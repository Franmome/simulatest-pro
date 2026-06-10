// Caché en memoria de salud de modelos IA — TTL 5 minutos
// Registra éxitos y fallos por modelo; permite saltear modelos degradados en la cascada.

const cache    = new Map() // modelId -> { failures: number, lastFailure: Date|null }
const WINDOW   = 5 * 60 * 1000  // 5 min
const MAX_FAIL = 2

function entry(id) {
  if (!cache.has(id)) cache.set(id, { failures: 0, lastFailure: null })
  return cache.get(id)
}

function resetIfStale(e) {
  if (e.lastFailure && Date.now() - e.lastFailure.getTime() > WINDOW) {
    e.failures   = 0
    e.lastFailure = null
  }
}

export function recordSuccess(modelId) {
  const e = entry(modelId)
  resetIfStale(e)
  e.failures = Math.max(0, e.failures - 1)
}

export function recordFailure(modelId) {
  const e = entry(modelId)
  resetIfStale(e)
  e.failures++
  e.lastFailure = new Date()
  console.warn(`[Health] ${modelId} → ${e.failures} fallo(s) reciente(s)`)
}

export function isHealthy(modelId) {
  const e = cache.get(modelId)
  if (!e) return true
  resetIfStale(e)
  return e.failures < MAX_FAIL
}

export function healthSnapshot() {
  const snap = {}
  for (const [id, e] of cache) {
    resetIfStale(e)
    snap[id] = { failures: e.failures, healthy: e.failures < MAX_FAIL }
  }
  return snap
}
