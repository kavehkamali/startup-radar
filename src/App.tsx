import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SEED_STARTUPS } from './data/seed'
import { generateBatch } from './lib/collect'
import {
  clearLegacyCacheKeys,
  loadCache,
  mergeStartups,
  prepareBootStartups,
  saveCache,
} from './lib/cache'
import { inferCategoryFromStartup } from './lib/inferCategory'
import { dataSourceUrlForStartup, PRIMARY_DATA_SOURCE, websiteUrlForStartup } from './lib/urls'
import { DashboardCharts, buildFundBars } from './components/DashboardCharts'
import { formatRelative, formatUsd } from './lib/format'
import {
  defaultTimeRangeEnd,
  defaultTimeRangeStart,
  isWithinFoundedDateRange,
  parseDateInputEnd,
  parseDateInputStart,
  toInputDate,
} from './lib/timeRange'
import type { CategoryId, Startup } from './types'
import { CATEGORY_SHORT_LABELS, TOPIC_CATEGORY_IDS } from './types'

const TOPICS: CategoryId[] = [...TOPIC_CATEGORY_IDS]

const AUTO_COLLECT_COUNT = 500
const COLLECT_CHUNK_SIZE = 40
/** Debounce duplicate mount (e.g. React Strict Mode) so we only run one auto-sync. */
const AUTO_COLLECT_DEBOUNCE_MS = 120
const AUTO_COLLECT_TS_KEY = 'startup-radar-last-autocollect-ms'

type SortColumn = 'name' | 'category' | 'fundRaisedUsd' | 'foundedDate' | 'stage' | 'hq' | 'lastUpdated'

const TABLE_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'name', label: 'Startup' },
  { key: 'category', label: 'Topic' },
  { key: 'fundRaisedUsd', label: 'Fund raised' },
  { key: 'foundedDate', label: 'Date started' },
  { key: 'stage', label: 'Stage' },
  { key: 'hq', label: 'HQ' },
  { key: 'lastUpdated', label: 'Updated' },
]

const ALL_SELECTED: Record<CategoryId, boolean> = Object.fromEntries(
  TOPIC_CATEGORY_IDS.map((id) => [id, true]),
) as Record<CategoryId, boolean>

function defaultSortDir(key: SortColumn): 'asc' | 'desc' {
  return key === 'name' || key === 'category' || key === 'stage' || key === 'hq' ? 'asc' : 'desc'
}

function compareRows(a: Startup, b: Startup, key: SortColumn, dir: 'asc' | 'desc'): number {
  const sign = dir === 'asc' ? 1 : -1
  switch (key) {
    case 'name':
      return sign * a.name.localeCompare(b.name)
    case 'category':
      return (
        sign *
        CATEGORY_SHORT_LABELS[inferCategoryFromStartup(a)].localeCompare(
          CATEGORY_SHORT_LABELS[inferCategoryFromStartup(b)],
        )
      )
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
  return { startups: prepareBootStartups(SEED_STARTUPS), lastCollectAt: null }
}

async function runCollectIntoCache(
  target: number,
  getPrev: () => Startup[],
  onProgress: (pct: number) => void,
): Promise<{ merged: Startup[]; at: string }> {
  const freshAll: Startup[] = []
  for (let i = 0; i < target; ) {
    const chunk = Math.min(COLLECT_CHUNK_SIZE, target - i)
    freshAll.push(...generateBatch(chunk))
    i += chunk
    onProgress(Math.round((i / target) * 100))
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  const merged = mergeStartups(getPrev(), freshAll)
  const at = new Date().toISOString()
  return { merged, at }
}

export default function App() {
  const boot = useMemo(() => initialPayload(), [])
  const [startups, setStartups] = useState<Startup[]>(boot.startups)
  const [lastCollectAt, setLastCollectAt] = useState<string | null>(boot.lastCollectAt)
  const [categoryFilter, setCategoryFilter] = useState<Record<CategoryId, boolean>>({ ...ALL_SELECTED })
  const [nameQuery, setNameQuery] = useState('')
  const [selected, setSelected] = useState<Startup | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [sort, setSort] = useState<{ key: SortColumn; dir: 'asc' | 'desc' }>({
    key: 'lastUpdated',
    dir: 'desc',
  })
  const [dateFrom, setDateFrom] = useState(() => toInputDate(defaultTimeRangeStart()))
  const [dateTo, setDateTo] = useState(() => toInputDate(defaultTimeRangeEnd()))
  const startupsRef = useRef(boot.startups)

  useEffect(() => {
    startupsRef.current = startups
  }, [startups])

  useEffect(() => {
    if (!loadCache()) {
      saveCache({ version: 1, startups: prepareBootStartups(SEED_STARTUPS), lastCollectAt: null })
    }
  }, [])

  useEffect(() => {
    clearLegacyCacheKeys()
  }, [])

  const persist = useCallback((next: Startup[], collectAt: string | null) => {
    saveCache({ version: 1, startups: next, lastCollectAt: collectAt })
  }, [])

  useEffect(() => {
    const now = Date.now()
    let last = 0
    try {
      last = Number(sessionStorage.getItem(AUTO_COLLECT_TS_KEY) || 0)
    } catch {
      /* ignore */
    }
    if (now - last < AUTO_COLLECT_DEBOUNCE_MS) return
    try {
      sessionStorage.setItem(AUTO_COLLECT_TS_KEY, String(now))
    } catch {
      /* ignore */
    }

    void (async () => {
      setSyncing(true)
      setSyncProgress(0)
      const { merged, at } = await runCollectIntoCache(
        AUTO_COLLECT_COUNT,
        () => startupsRef.current,
        setSyncProgress,
      )
      startupsRef.current = merged
      setStartups(merged)
      setLastCollectAt(at)
      persist(merged, at)
      setSyncing(false)
      setSyncProgress(0)
    })()
  }, [persist])

  const handleSortClick = useCallback((key: SortColumn) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: defaultSortDir(key) },
    )
  }, [])

  const toggleCategory = useCallback((id: CategoryId) => {
    setCategoryFilter((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const selectAllCategories = useCallback(() => {
    setCategoryFilter({ ...ALL_SELECTED })
  }, [])

  const clearCategories = useCallback(() => {
    setCategoryFilter(
      Object.fromEntries(TOPIC_CATEGORY_IDS.map((id) => [id, false])) as Record<CategoryId, boolean>,
    )
  }, [])

  const activeCategoryCount = useMemo(
    () => TOPICS.filter((id) => categoryFilter[id]).length,
    [categoryFilter],
  )

  const q = nameQuery.trim().toLowerCase()

  const { rangeStart, rangeEnd } = useMemo(() => {
    let a = parseDateInputStart(dateFrom)
    let b = parseDateInputEnd(dateTo)
    if (a.getTime() > b.getTime()) {
      const t = a
      a = b
      b = t
    }
    return { rangeStart: a, rangeEnd: b }
  }, [dateFrom, dateTo])

  const timeFiltered = useMemo(
    () => startups.filter((s) => isWithinFoundedDateRange(s.foundedDate, rangeStart, rangeEnd)),
    [startups, rangeStart, rangeEnd],
  )

  const topicFiltered = useMemo(
    () => timeFiltered.filter((s) => categoryFilter[inferCategoryFromStartup(s)]),
    [timeFiltered, categoryFilter],
  )

  const filtered = useMemo(() => {
    let rows = topicFiltered
    if (q) rows = rows.filter((s) => s.name.toLowerCase().includes(q))
    return [...rows].sort((a, b) => compareRows(a, b, sort.key, sort.dir))
  }, [topicFiltered, q, sort.key, sort.dir])

  const counts = useMemo(() => {
    const m = Object.fromEntries(TOPIC_CATEGORY_IDS.map((id) => [id, 0])) as Record<CategoryId, number>
    for (const s of timeFiltered) {
      const t = inferCategoryFromStartup(s)
      if (t in m) m[t]++
    }
    return m
  }, [timeFiltered])

  const activeTopics = useMemo(() => TOPICS.filter((id) => categoryFilter[id]), [categoryFilter])

  const categoryPieData = useMemo(() => {
    const counts = new Map<CategoryId, number>()
    for (const id of activeTopics) counts.set(id, 0)
    for (const s of topicFiltered) {
      const t = inferCategoryFromStartup(s)
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return activeTopics
      .map((category) => ({
        category,
        name: CATEGORY_SHORT_LABELS[category],
        value: counts.get(category) ?? 0,
      }))
      .filter((d) => d.value > 0)
  }, [topicFiltered, activeTopics])

  const fundData = useMemo(
    () =>
      buildFundBars(
        topicFiltered.map((s) => ({
          fundRaisedUsd: s.fundRaisedUsd,
          category: inferCategoryFromStartup(s),
        })),
        activeTopics,
      ),
    [topicFiltered, activeTopics],
  )

  const applyPreset = useCallback((preset: '2y' | '1y' | 'all') => {
    const end = new Date()
    const to = toInputDate(end)
    if (preset === 'all') {
      setDateFrom('1990-01-01')
      setDateTo(to)
      return
    }
    const start = new Date(end)
    if (preset === '2y') start.setFullYear(start.getFullYear() - 2)
    else start.setFullYear(start.getFullYear() - 1)
    start.setHours(0, 0, 0, 0)
    setDateFrom(toInputDate(start))
    setDateTo(to)
  }, [])

  const sortLabel = TABLE_COLUMNS.find((c) => c.key === sort.key)?.label ?? sort.key

  const filterSummary =
    activeCategoryCount === 0
      ? 'No topics'
      : activeCategoryCount === TOPICS.length
        ? 'All topics'
        : TOPICS.filter((id) => categoryFilter[id])
            .map((id) => CATEGORY_SHORT_LABELS[id])
            .join(', ')

  return (
    <div className="min-h-dvh flex flex-col text-[13px] leading-snug text-slate-800">
      <header className="sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4">
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-900">Startup Radar</h1>
            <p className="text-[11px] text-slate-500">
              +{AUTO_COLLECT_COUNT} on each visit · local cache
              {lastCollectAt && (
                <span className="text-slate-400"> · updated {formatRelative(lastCollectAt)}</span>
              )}
              {' · '}
              <a
                href={PRIMARY_DATA_SOURCE.url}
                target="_blank"
                rel="noreferrer"
                className="text-teal-700 underline decoration-teal-700/30 underline-offset-2 hover:decoration-teal-700"
              >
                {PRIMARY_DATA_SOURCE.label}
              </a>
            </p>
          </div>
          {syncing && (
            <span className="text-[11px] font-medium text-teal-700">Syncing cache… {syncProgress}%</span>
          )}
        </div>
        {syncing && (
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 sm:px-4">
            <div className="mx-auto max-w-5xl">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={syncProgress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Sync progress"
              >
                <div
                  className="h-full rounded-full bg-teal-600 transition-[width] duration-100 ease-linear"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 px-3 py-3 sm:px-4">
        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2">
          <div className="flex flex-wrap items-end gap-3">
            <fieldset className="min-w-0 flex-1">
              <legend className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Time range (date started)
              </legend>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="text-slate-500">From</span>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded border border-slate-200 px-1.5 py-1 text-[12px] text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600/30"
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] text-slate-600">
                  <span className="text-slate-500">To</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded border border-slate-200 px-1.5 py-1 text-[12px] text-slate-900 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600/30"
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => applyPreset('2y')}
                    className="rounded border border-teal-200 bg-teal-50/80 px-2 py-1 text-[11px] font-medium text-teal-900 hover:bg-teal-100/80"
                  >
                    Last 2 years
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('1y')}
                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  >
                    Last year
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('all')}
                    className="rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                  >
                    All time
                  </button>
                </div>
              </div>
            </fieldset>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="startup-search" className="sr-only">
              Search by startup name
            </label>
            <input
              id="startup-search"
              type="search"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search by name…"
              autoComplete="off"
              className="w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-teal-600 focus:ring-1 focus:ring-teal-600/30"
            />
          </div>
          <div className="flex shrink-0 gap-2 text-[11px]">
            <button
              type="button"
              onClick={selectAllCategories}
              className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
            >
              All topics
            </button>
            <button
              type="button"
              onClick={clearCategories}
              className="rounded border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50"
            >
              Clear
            </button>
          </div>
        </div>

        <fieldset className="rounded-lg border border-slate-200 bg-white p-2">
          <legend className="sr-only">Topic filters</legend>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Topics
          </p>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((id) => {
              const on = categoryFilter[id]
              return (
                <label
                  key={id}
                  className={`flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-[12px] font-medium transition ${
                    on
                      ? 'border-teal-600/40 bg-teal-50/80 text-teal-900'
                      : 'border-slate-200 bg-slate-50/50 text-slate-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleCategory(id)}
                    className="size-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-600"
                  />
                  <span>{CATEGORY_SHORT_LABELS[id]}</span>
                  <span className="tabular-nums text-[10px] text-slate-400">({counts[id]})</span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <DashboardCharts categoryPieData={categoryPieData} fundData={fundData} activeTopics={activeTopics} />

        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5 sm:px-3">
            <h2 className="text-[12px] font-semibold text-slate-800">
              {filterSummary}
              {q ? (
                <span className="font-normal text-slate-500">
                  {' '}
                  · “{nameQuery.trim()}”
                </span>
              ) : null}
            </h2>
            <p className="text-[11px] text-slate-400">
              {filtered.length} rows · {sortLabel} ({sort.dir === 'asc' ? 'asc' : 'desc'})
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[12px]">
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
                    <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                      {activeCategoryCount === 0
                        ? 'Select at least one topic.'
                        : timeFiltered.length === 0 && startups.length > 0
                          ? 'No startups with a start date in this range. Widen the date range or use All time.'
                          : q
                            ? 'No startups match this search.'
                            : 'No rows for this filter.'}
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
                      <td className="max-w-[9rem] px-2 py-1.5 text-[11px] text-slate-700 sm:px-2.5">
                        <span className="line-clamp-2 leading-tight">
                          {CATEGORY_SHORT_LABELS[inferCategoryFromStartup(row)]}
                        </span>
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
                  {CATEGORY_SHORT_LABELS[inferCategoryFromStartup(selected)]}
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

              <div className="mt-3 flex flex-col gap-2">
                <a
                  href={selected.website ?? websiteUrlForStartup(selected.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-teal-700 hover:border-teal-300 hover:bg-teal-50/50"
                >
                  Visit (web search) <span aria-hidden>↗</span>
                </a>
                <a
                  href={selected.dataSourceUrl ?? dataSourceUrlForStartup(selected.name)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  News & funding sources <span aria-hidden>↗</span>
                </a>
                <a
                  href={PRIMARY_DATA_SOURCE.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-[11px] text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-700"
                >
                  Directory: {PRIMARY_DATA_SOURCE.label} <span aria-hidden>↗</span>
                </a>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
