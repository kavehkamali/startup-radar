import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SEED_STARTUPS } from './data/seed'
import { generateBatch } from './lib/collect'
import { loadCache, mergeStartups, saveCache } from './lib/cache'
import { formatRelative, formatUsd } from './lib/format'
import type { CategoryId, Startup } from './types'
import { CATEGORY_LABELS } from './types'

const CATEGORIES: CategoryId[] = ['tech', 'trends', 'funds', 'other']

const COLLECT_BATCH_STORAGE_KEY = 'startup-radar-collect-batch-size'
const COLLECT_CHUNK_SIZE = 40

type SortColumn = 'name' | 'fundRaisedUsd' | 'foundedDate' | 'stage' | 'hq' | 'lastUpdated'

const TABLE_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Startup' },
  { key: 'fundRaisedUsd', label: 'Fund raised' },
  { key: 'foundedDate', label: 'Date started' },
  { key: 'stage', label: 'Stage' },
  { key: 'hq', label: 'HQ' },
  { key: 'lastUpdated', label: 'Updated' },
]

function normalizeBatchSize(n: number): number {
  if (!Number.isFinite(n) || n < 1) return 50
  return Math.floor(n)
}

function readStoredBatchSize(): number {
  try {
    const raw = localStorage.getItem(COLLECT_BATCH_STORAGE_KEY)
    if (raw != null) return normalizeBatchSize(Number(raw))
  } catch {
    /* ignore */
  }
  return 50
}

function defaultSortDir(key: SortColumn): 'asc' | 'desc' {
  return key === 'name' || key === 'stage' || key === 'hq' ? 'asc' : 'desc'
}

function compareRows(a: Startup, b: Startup, key: SortColumn, dir: 'asc' | 'desc'): number {
  const sign = dir === 'asc' ? 1 : -1
  switch (key) {
    case 'name':
      return sign * a.name.localeCompare(b.name)
    case 'stage':
      return sign * a.stage.localeCompare(b.stage)
    case 'hq':
      return sign * a.hq.localeCompare(b.hq)
    case 'foundedDate':
      return sign * a.foundedDate.localeCompare(b.foundedDate)
    case 'lastUpdated':
      return sign * (new Date(a.lastUpdated).getTime() - new Date(b.lastUpdated).getTime())
    case 'fundRaisedUsd': {
      if (a.fundRaisedUsd == null && b.fundRaisedUsd == null) return 0
      if (a.fundRaisedUsd == null) return 1
      if (b.fundRaisedUsd == null) return -1
      const cmp = a.fundRaisedUsd - b.fundRaisedUsd
      return dir === 'asc' ? cmp : -cmp
    }
    default:
      return 0
  }
}

function initialPayload(): { startups: Startup[]; lastCollectAt: string | null } {
  const cached = loadCache()
  if (cached) {
    return { startups: cached.startups, lastCollectAt: cached.lastCollectAt }
  }
  return { startups: SEED_STARTUPS, lastCollectAt: null }
}

export default function App() {
  const boot = useMemo(() => initialPayload(), [])
  const [startups, setStartups] = useState<Startup[]>(boot.startups)
  const [lastCollectAt, setLastCollectAt] = useState<string | null>(boot.lastCollectAt)
  const [category, setCategory] = useState<CategoryId>('tech')
  const [selected, setSelected] = useState<Startup | null>(null)
  const [collecting, setCollecting] = useState(false)
  const [collectProgress, setCollectProgress] = useState(0)
  const [batchSize, setBatchSize] = useState(readStoredBatchSize)
  const [sort, setSort] = useState<{ key: SortColumn; dir: 'asc' | 'desc' }>({
    key: 'lastUpdated',
    dir: 'desc',
  })
  const startupsRef = useRef(boot.startups)

  useEffect(() => {
    startupsRef.current = startups
  }, [startups])

  useEffect(() => {
    if (!loadCache()) {
      saveCache({ version: 1, startups: SEED_STARTUPS, lastCollectAt: null })
    }
  }, [])

  const persist = useCallback((next: Startup[], collectAt: string | null) => {
    saveCache({ version: 1, startups: next, lastCollectAt: collectAt })
  }, [])

  const persistBatchSize = useCallback((n: number) => {
    const normalized = normalizeBatchSize(n)
    try {
      localStorage.setItem(COLLECT_BATCH_STORAGE_KEY, String(normalized))
    } catch {
      /* ignore */
    }
    return normalized
  }, [])

  const handleSortClick = useCallback((key: SortColumn) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: defaultSortDir(key) },
    )
  }, [])

  const handleCollect = useCallback(async () => {
    const target = persistBatchSize(batchSize)
    setBatchSize(target)

    setCollecting(true)
    setCollectProgress(0)

    const freshAll: Startup[] = []
    for (let i = 0; i < target; ) {
      const chunk = Math.min(COLLECT_CHUNK_SIZE, target - i)
      freshAll.push(...generateBatch(chunk))
      i += chunk
      setCollectProgress(Math.round((i / target) * 100))
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })
    }

    const prev = startupsRef.current
    const merged = mergeStartups(prev, freshAll)
    const at = new Date().toISOString()
    startupsRef.current = merged
    setStartups(merged)
    setLastCollectAt(at)
    persist(merged, at)
    setCollecting(false)
    setCollectProgress(0)
  }, [batchSize, persist, persistBatchSize])

  const filtered = useMemo(() => {
    const rows = startups.filter((s) => s.category === category)
    return [...rows].sort((a, b) => compareRows(a, b, sort.key, sort.dir))
  }, [startups, category, sort.key, sort.dir])

  const counts = useMemo(() => {
    const m: Record<CategoryId, number> = {
      tech: 0,
      trends: 0,
      funds: 0,
      other: 0,
    }
    for (const s of startups) m[s.category]++
    return m
  }, [startups])

  const sortLabel = TABLE_COLUMNS.find((c) => c.key === sort.key)?.label ?? sort.key

  return (
    <div className="min-h-dvh flex flex-col text-[13px] leading-snug text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">Startup Radar</h1>
            <p className="text-[11px] text-slate-500">Local cache</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-slate-600">
              <span className="whitespace-nowrap text-[11px]">Batch</span>
              <input
                type="number"
                min={1}
                value={batchSize}
                disabled={collecting}
                onChange={(e) => {
                  const v = e.target.valueAsNumber
                  if (!Number.isFinite(v)) return
                  setBatchSize(normalizeBatchSize(v))
                }}
                onBlur={() => setBatchSize((b) => persistBatchSize(b))}
                className="w-[4.5rem] rounded border border-slate-200 bg-white px-1.5 py-1 text-[12px] font-medium tabular-nums text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600/30 disabled:opacity-50"
              />
            </label>
            {lastCollectAt && (
              <span className="hidden text-[11px] text-slate-400 sm:inline">
                {formatRelative(lastCollectAt)}
              </span>
            )}
            <button
              type="button"
              onClick={handleCollect}
              disabled={collecting}
              className="rounded border border-teal-700 bg-teal-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-teal-700 disabled:cursor-wait disabled:opacity-60"
            >
              {collecting ? `Collecting ${collectProgress}%` : 'Collect'}
            </button>
          </div>
        </div>
        {collecting && (
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 sm:px-4">
            <div className="mx-auto max-w-5xl">
              <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                <span>Collecting records</span>
                <span className="tabular-nums text-slate-700">{collectProgress}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={collectProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Collect progress"
              >
                <div
                  className="h-full rounded-full bg-teal-600 transition-[width] duration-100 ease-linear"
                  style={{ width: `${collectProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <nav
          className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-white p-0.5"
          aria-label="Categories"
        >
          {CATEGORIES.map((id) => {
            const active = id === category
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex min-w-0 flex-1 items-center justify-between gap-1 rounded px-2 py-1 text-left text-[12px] font-medium sm:flex-none ${
                  active ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{CATEGORY_LABELS[id]}</span>
                <span
                  className={`shrink-0 rounded px-1 py-px text-[10px] tabular-nums ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {counts[id]}
                </span>
              </button>
            )
          })}
        </nav>

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5 sm:px-3">
            <h2 className="text-[12px] font-semibold text-slate-800">{CATEGORY_LABELS[category]}</h2>
            <p className="text-[11px] text-slate-400">
              {filtered.length} rows · {sortLabel} ({sort.dir === 'asc' ? 'asc' : 'desc'})
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {TABLE_COLUMNS.map(({ key, label }) => {
                    const active = sort.key === key
                    return (
                      <th key={key} className="px-2 py-1.5 sm:px-2.5">
                        <button
                          type="button"
                          onClick={() => handleSortClick(key)}
                          className={`flex w-full items-center gap-0.5 rounded px-0.5 py-0.5 text-left hover:text-slate-800 ${active ? 'text-slate-800' : ''}`}
                          aria-sort={
                            active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                          }
                        >
                          <span>{label}</span>
                          {active && (
                            <span className="font-normal text-teal-600" aria-hidden>
                              {sort.dir === 'asc' ? '↑' : '↓'}
                            </span>
                          )}
                        </button>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      No rows. Use <span className="font-medium text-slate-700">Collect</span>.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/80"
                      onClick={() => setSelected(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelected(row)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open details for ${row.name}`}
                    >
                      <td className="px-2 py-1.5 sm:px-2.5">
                        <div className="font-medium text-slate-900">{row.name}</div>
                        <div className="line-clamp-1 text-[11px] text-slate-500">{row.tagline}</div>
                      </td>
                      <td className="px-2 py-1.5 font-medium tabular-nums text-slate-700 sm:px-2.5">
                        {formatUsd(row.fundRaisedUsd)}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums text-slate-600 sm:px-2.5">{row.foundedDate}</td>
                      <td className="px-2 py-1.5 text-slate-600 sm:px-2.5">{row.stage}</td>
                      <td className="px-2 py-1.5 text-slate-600 sm:px-2.5">{row.hq}</td>
                      <td className="px-2 py-1.5 text-slate-500 sm:px-2.5">{formatRelative(row.lastUpdated)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {selected && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/15 backdrop-blur-[1px]"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <aside
            className="flex h-full w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-teal-700">
                  {CATEGORY_LABELS[selected.category]}
                </p>
                <h2 id="detail-title" className="mt-0.5 text-[15px] font-semibold text-slate-900">
                  {selected.name}
                </h2>
                <p className="mt-0.5 text-[12px] text-slate-600">{selected.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close details"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              <dl className="grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded border border-slate-100 bg-slate-50/80 p-2">
                  <dt className="text-[10px] font-medium text-slate-500">Fund raised</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums text-slate-900">
                    {formatUsd(selected.fundRaisedUsd)}
                  </dd>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50/80 p-2">
                  <dt className="text-[10px] font-medium text-slate-500">Date started</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{selected.foundedDate}</dd>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50/80 p-2">
                  <dt className="text-[10px] font-medium text-slate-500">Stage</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{selected.stage}</dd>
                </div>
                <div className="rounded border border-slate-100 bg-slate-50/80 p-2">
                  <dt className="text-[10px] font-medium text-slate-500">Team size</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">
                    {selected.employees != null ? `${selected.employees}` : '—'}
                  </dd>
                </div>
                <div className="col-span-2 rounded border border-slate-100 bg-slate-50/80 p-2">
                  <dt className="text-[10px] font-medium text-slate-500">Headquarters</dt>
                  <dd className="mt-0.5 font-semibold text-slate-900">{selected.hq}</dd>
                </div>
                <div className="col-span-2 rounded border border-slate-100 bg-slate-50/80 p-2">
                  <dt className="text-[10px] font-medium text-slate-500">Cache updated</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatRelative(selected.lastUpdated)}</dd>
                </div>
              </dl>

              <div className="mt-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Overview</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{selected.description}</p>
              </div>

              {selected.investors.length > 0 && (
                <div className="mt-3">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Investors</h3>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {selected.investors.map((inv) => (
                      <li
                        key={inv}
                        className="rounded border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700"
                      >
                        {inv}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {selected.website && (
                <a
                  href={selected.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-teal-700 hover:border-teal-300 hover:bg-teal-50/50"
                >
                  Visit site <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
