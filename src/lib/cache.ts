import type { CachePayload, Startup } from '../types'
import { normalizeCategory } from '../types'
import { dataSourceUrlForStartup, isBrokenDemoWebsite, websiteUrlForStartup } from './urls'

/** Bump when you need a hard reset of stored rows (orphans older keys in cleanup). */
export const CACHE_STORAGE_KEY = 'startup-radar-cache-v5'

const LEGACY_CACHE_KEYS = [
  'startup-radar-cache-v1',
  'startup-radar-cache-v2',
  'startup-radar-cache-v3',
  'startup-radar-cache-v4',
] as const

function enrichFields(s: Startup): Startup {
  const website = isBrokenDemoWebsite(s.website) ? websiteUrlForStartup(s.name) : s.website
  const dataSourceUrl = s.dataSourceUrl ?? dataSourceUrlForStartup(s.name)
  return { ...s, website, dataSourceUrl }
}

function migrateStartups(rows: Startup[]): Startup[] {
  return rows.map((s) => {
    const c = normalizeCategory(s.category as unknown as string)
    const base = c === s.category ? s : { ...s, category: c }
    return enrichFields(base)
  })
}

/** Seed / first boot: normalize category + fix demo URLs before first paint. */
export function prepareBootStartups(rows: Startup[]): Startup[] {
  return migrateStartups(rows)
}

/** Same company appearing under different ids (old mocks): keep the row with the newest cache update. */
function dedupeByNameCategory(rows: Startup[]): Startup[] {
  const map = new Map<string, Startup>()
  for (const s of rows) {
    const key = `${s.name.trim().toLowerCase()}|${s.category}`
    const prev = map.get(key)
    if (!prev || new Date(s.lastUpdated) >= new Date(prev.lastUpdated)) {
      map.set(key, s)
    }
  }
  return [...map.values()]
}

function normalizePayload(payload: CachePayload): CachePayload {
  return {
    ...payload,
    startups: dedupeByNameCategory(migrateStartups(payload.startups)),
  }
}

/**
 * Merge by `id`: if an incoming row has the same id as an existing one, keep the version
 * with the **newer or equal** `lastUpdated` (collect wins on ties so fresh sync replaces stale).
 * Then collapse duplicates that share the same display name + topic (newer wins).
 */
export function mergeStartups(existing: Startup[], incoming: Startup[]): Startup[] {
  const map = new Map<string, Startup>()
  for (const s of existing) map.set(s.id, s)
  for (const s of incoming) {
    const prev = map.get(s.id)
    if (!prev || new Date(s.lastUpdated) >= new Date(prev.lastUpdated)) {
      map.set(s.id, s)
    }
  }
  return dedupeByNameCategory([...map.values()].map(enrichFields))
}

export function loadCache(): CachePayload | null {
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachePayload
    if (parsed?.version !== 1 || !Array.isArray(parsed.startups)) return null
    return normalizePayload(parsed)
  } catch {
    return null
  }
}

export function saveCache(payload: CachePayload) {
  const normalized = normalizePayload(payload)
  localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(normalized))
}

/** Remove legacy cache blobs and the active cache key (full wipe). Session keys optional. */
export function clearStartupRadarStorage(options?: { sessionKeys?: string[] }): void {
  try {
    for (const k of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(k)
    }
    localStorage.removeItem(CACHE_STORAGE_KEY)
    for (const k of options?.sessionKeys ?? []) {
      try {
        sessionStorage.removeItem(k)
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
}

/** Drop old keys only; keeps current `CACHE_STORAGE_KEY` data. */
export function clearLegacyCacheKeys(): void {
  try {
    for (const k of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(k)
    }
  } catch {
    /* ignore */
  }
}
