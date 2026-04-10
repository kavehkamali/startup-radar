import { useCallback, useEffect, useMemo, useState } from 'react'
import { SEED_STARTUPS } from './data/seed'
import { generateBatch } from './lib/collect'
import { loadCache, mergeStartups, saveCache } from './lib/cache'
import { formatRelative, formatUsd } from './lib/format'
import type { CategoryId, Startup } from './types'
import { CATEGORY_LABELS } from './types'

const CATEGORIES: CategoryId[] = ['tech', 'trends', 'funds', 'other']

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

  useEffect(() => {
    if (!loadCache()) {
      saveCache({ version: 1, startups: SEED_STARTUPS, lastCollectAt: null })
    }
  }, [])

  const persist = useCallback((next: Startup[], collectAt: string | null) => {
    saveCache({ version: 1, startups: next, lastCollectAt: collectAt })
  }, [])

  const handleCollect = useCallback(() => {
    setCollecting(true)
    window.setTimeout(() => {
      const fresh = generateBatch(4 + Math.floor(Math.random() * 3), category)
      const merged = mergeStartups(startups, fresh)
      const at = new Date().toISOString()
      setStartups(merged)
      setLastCollectAt(at)
      persist(merged, at)
      setCollecting(false)
    }, 520)
  }, [category, persist, startups])

  const filtered = useMemo(() => {
    return startups
      .filter((s) => s.category === category)
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
  }, [startups, category])

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

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Live workspace</p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Startup Radar</h1>
            <p className="mt-0.5 text-sm text-slate-500">Curated signals, cached locally in your browser</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {lastCollectAt && (
              <span className="hidden text-xs text-slate-500 sm:inline">
                Last collect {formatRelative(lastCollectAt)}
              </span>
            )}
            <button
              type="button"
              onClick={handleCollect}
              disabled={collecting}
              className="inline-flex items-center justify-center rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-600/25 transition hover:bg-teal-700 disabled:cursor-wait disabled:opacity-70"
            >
              {collecting ? (
                <span className="flex items-center gap-2">
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                    aria-hidden
                  />
                  Collecting…
                </span>
              ) : (
                'Collect & update'
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        <nav
          className="flex flex-wrap gap-2 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm shadow-slate-200/40"
          aria-label="Categories"
        >
          {CATEGORIES.map((id) => {
            const active = id === category
            return (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                className={`flex flex-1 min-w-[8rem] items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition sm:min-w-0 sm:flex-none ${
                  active
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{CATEGORY_LABELS[id]}</span>
                <span
                  className={`rounded-lg px-2 py-0.5 text-xs tabular-nums ${
                    active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {counts[id]}
                </span>
              </button>
            )
          })}
        </nav>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{CATEGORY_LABELS[category]}</h2>
              <p className="text-sm text-slate-500">Sorted by most recently updated</p>
            </div>
            <p className="text-xs text-slate-400">{filtered.length} records in view</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 sm:px-5">Startup</th>
                  <th className="px-4 py-3 sm:px-5">Fund raised</th>
                  <th className="px-4 py-3 sm:px-5">Date started</th>
                  <th className="px-4 py-3 sm:px-5">Stage</th>
                  <th className="px-4 py-3 sm:px-5">HQ</th>
                  <th className="px-4 py-3 sm:px-5">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                      No rows yet. Run <strong className="text-slate-700">Collect &amp; update</strong> to add data
                      for this category.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer border-b border-slate-50 transition hover:bg-teal-50/40"
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
                      <td className="px-4 py-3.5 sm:px-5">
                        <div className="font-semibold text-slate-900">{row.name}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">{row.tagline}</div>
                      </td>
                      <td className="px-4 py-3.5 font-medium tabular-nums text-slate-800 sm:px-5">
                        {formatUsd(row.fundRaisedUsd)}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-slate-600 sm:px-5">{row.foundedDate}</td>
                      <td className="px-4 py-3.5 text-slate-600 sm:px-5">{row.stage}</td>
                      <td className="px-4 py-3.5 text-slate-600 sm:px-5">{row.hq}</td>
                      <td className="px-4 py-3.5 text-slate-500 sm:px-5">{formatRelative(row.lastUpdated)}</td>
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
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/20 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <aside
            className="flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl shadow-slate-300/40"
            role="dialog"
            aria-modal="true"
            aria-labelledby="detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-teal-600">
                  {CATEGORY_LABELS[selected.category]}
                </p>
                <h2 id="detail-title" className="mt-1 text-xl font-bold text-slate-900">
                  {selected.name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{selected.tagline}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close details"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Fund raised</dt>
                  <dd className="mt-1 font-semibold tabular-nums text-slate-900">
                    {formatUsd(selected.fundRaisedUsd)}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Date started</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selected.foundedDate}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Stage</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selected.stage}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Team size</dt>
                  <dd className="mt-1 font-semibold text-slate-900">
                    {selected.employees != null ? `${selected.employees}` : '—'}
                  </dd>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Headquarters</dt>
                  <dd className="mt-1 font-semibold text-slate-900">{selected.hq}</dd>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-medium text-slate-500">Last updated in cache</dt>
                  <dd className="mt-1 font-medium text-slate-800">{formatRelative(selected.lastUpdated)}</dd>
                </div>
              </dl>

              <div className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{selected.description}</p>
              </div>

              {selected.investors.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Investors</h3>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {selected.investors.map((inv) => (
                      <li
                        key={inv}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
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
                  className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:border-teal-200 hover:bg-teal-50"
                >
                  Visit site
                  <span aria-hidden>↗</span>
                </a>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
