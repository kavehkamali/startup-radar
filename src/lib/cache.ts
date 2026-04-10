import type { CachePayload, Startup } from '../types'

const KEY = 'startup-radar-cache-v1'

export function loadCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (parsed?.version !== 1 || !Array.isArray(parsed.startups)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveCache(payload: CachePayload) {
  localStorage.setItem(KEY, JSON.stringify(payload))
}

export function mergeStartups(
  existing: Startup[],
  incoming: Startup[],
): Startup[] {
  const map = new Map<string, Startup>()
  for (const s of existing) map.set(s.id, s)
  for (const s of incoming) {
    const prev = map.get(s.id)
    if (!prev || new Date(s.lastUpdated) >= new Date(prev.lastUpdated)) {
      map.set(s.id, s)
    }
  }
  return [...map.values()]
}
