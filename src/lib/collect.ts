import type { CategoryId, Startup } from '../types'

const NAMES = [
  'Nimbus AI',
  'Lattice Bio',
  'Harbor Ops',
  'Velum Security',
  'Cinder Compute',
  'Northwind Data',
  'Quartz Health',
  'Meridian Flow',
  'Kite Robotics',
  'Silverline Fintech',
  'Arcadia Climate',
  'Beacon HR',
  'Cobalt Edge',
  'Drift Commerce',
  'Echo Labs',
]

const TAGS = [
  'Automating enterprise workflows with LLMs',
  'Edge inference for regulated industries',
  'Carbon-aware supply chain intelligence',
  'Real-time fraud graph for payments',
  'Modular robotics for light manufacturing',
]

const HQS = ['San Francisco, CA', 'New York, NY', 'London, UK', 'Berlin, DE', 'Austin, TX', 'Toronto, ON']
const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth']
const INVESTORS = ['a16z', 'Sequoia', 'Index', 'Lightspeed', 'Accel', 'GV', 'NEA', 'Benchmark']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomId() {
  return `st-${crypto.randomUUID().slice(0, 8)}`
}

function uniqueDisplayName(): string {
  const base = pick(NAMES)
  const suffix = Math.random().toString(36).slice(2, 5)
  return `${base} ${suffix}`
}

function fundForCategory(cat: CategoryId): number | null {
  if (cat === 'trends') return null
  if (cat === 'other') return Math.random() > 0.4 ? Math.round(2 + Math.random() * 80) * 1_000_000 : null
  return Math.round(3 + Math.random() * 120) * 1_000_000
}

/** Even spread across all category tabs (no current-tab bias). */
const ALL_CATEGORIES: CategoryId[] = ['tech', 'trends', 'funds', 'other']

export function generateBatch(count: number): Startup[] {
  const now = new Date()
  const batch: Startup[] = []

  for (let i = 0; i < count; i++) {
    const category = ALL_CATEGORIES[i % ALL_CATEGORIES.length]!
    const founded = new Date(now)
    founded.setFullYear(now.getFullYear() - Math.floor(Math.random() * 8) - 1)
    const lastUpdated = new Date(now.getTime() - Math.floor(Math.random() * 36) * 60_000 * 60)

    const fund = fundForCategory(category)
    const displayName = uniqueDisplayName()
    batch.push({
      id: randomId(),
      name: displayName,
      category,
      tagline: pick(TAGS),
      fundRaisedUsd: fund,
      foundedDate: founded.toISOString().slice(0, 10),
      hq: pick(HQS),
      stage: pick(STAGES),
      employees: Math.random() > 0.2 ? 12 + Math.floor(Math.random() * 400) : null,
      lastUpdated: lastUpdated.toISOString(),
      description: `${pick(TAGS)}. The team is expanding GTM in North America and shipping a new enterprise tier with SSO, audit logs, and regional data residency. Early design partners report measurable time savings across core ops workflows.`,
      investors: Array.from(
        new Set(
          Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => pick(INVESTORS)),
        ),
      ),
      website:
        Math.random() > 0.15
          ? `https://${displayName.toLowerCase().replace(/[^a-z0-9]+/g, '')}.example`
          : null,
    })
  }

  return batch
}
