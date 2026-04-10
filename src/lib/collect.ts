import type { CategoryId, Startup } from '../types'
import { TOPIC_CATEGORY_IDS } from '../types'
import { dataSourceUrlForStartup, websiteUrlForStartup } from './urls'

/**
 * Procedural company names: combine word lists (thousands of combos) instead of
 * reusing a tiny pool + random suffix — that pattern looked like duplicates with noise.
 */
const NAME_A = [
  'Apex', 'Nova', 'Velum', 'Lattice', 'Harbor', 'Northwind', 'Meridian', 'Cinder', 'Quartz',
  'Silverline', 'Arcadia', 'Beacon', 'Cobalt', 'Drift', 'Echo', 'Skylark', 'Nimbus', 'Signal',
  'Vector', 'Prism', 'Flux', 'Helix', 'Granite', 'Summit', 'Cedar', 'Ironwood', 'Bluefin',
  'Northstar', 'Skyline', 'Riverbend', 'Clearwater', 'Brightline', 'Fieldstone', 'Redwood',
  'Pinewood', 'Glasswing', 'Moonrise', 'Daybreak', 'Crosswind', 'Tailwind', 'Fairway',
]

const NAME_B = [
  'Labs', 'Systems', 'Bio', 'Data', 'Health', 'Automata', 'Security', 'Compute', 'Flow',
  'Stack', 'Works', 'Grid', 'Point', 'Bridge', 'Harbor', 'Forge', 'Foundry', 'Collective',
  'Dynamics', 'Analytics', 'Networks', 'Solutions', 'Technologies', 'Ventures', 'Partners',
  'Holdings', 'Group', 'Industries', 'Sciences', 'Therapeutics', 'Diagnostics', 'Logistics',
  'Mobility', 'Capital', 'Markets', 'Commerce', 'Studios', 'Research', 'Innovation',
]

const NAME_C = [
  'AI', 'Cloud', 'Edge', 'Core', 'One', 'North', 'East', 'Global', 'Digital', 'Open',
  'Prime', 'Next', 'Deep', 'Swift', 'Bright', 'True', 'Bold', 'Rapid', 'Solid', 'Fine',
]

const TAGS_BY_TOPIC: Record<CategoryId, string[]> = {
  ai_foundation: [
    'Pre-training orchestration for multi-trillion token runs',
    'Open-weight model releases with safety eval harnesses',
    'Mixture-of-experts routing for cost-aware inference',
  ],
  ai_inference: [
    'Dedicated inference clusters with per-tenant QoS',
    'Edge model serving for sub-100ms P99 latency',
    'Batch + real-time APIs with autoscaling GPU pools',
  ],
  ai_agents: [
    'Tool-using agents with human approval gates',
    'Browser and desktop automation for back-office tasks',
    'Multi-step research agents with citation grounding',
  ],
  ai_enterprise: [
    'Copilots for CRM, ERP, and service desk workflows',
    'RAG over private documents with ACL-aware retrieval',
    'Meeting summarization tied into compliance archives',
  ],
  ai_devtools: [
    'Eval suites and red-team harnesses for LLM apps',
    'Synthetic data generation for fine-tuning pipelines',
    'Feature stores and labeling ops for model iteration',
  ],
  saas_workflow: [
    'Approval chains and SOX-ready audit trails',
    'RevOps playbooks with CRM-native automation',
    'ITSM and asset lifecycle in a single timeline',
  ],
  saas_vertical: [
    'Construction lien and draw management in one stack',
    'EHR-adjacent scheduling without replacing the EMR',
    'Restaurant labor law compliance baked into shifts',
  ],
  saas_data: [
    'Warehouse-centric metrics with dbt-native lineage',
    'Reverse ETL into sales and success tools',
    'Self-serve exploration with row-level security',
  ],
  medical: [
    'Clinical decision support on structured EHR signals',
    'Remote patient monitoring with FDA-aligned workflows',
    'Generative documentation for specialty care teams',
  ],
  finance: [
    'Programmable treasury and real-time liquidity',
    'Fraud graph scoring for card and ACH rails',
    'Embedded lending for vertical SaaS marketplaces',
  ],
  consumer: [
    'Personalized discovery with on-device preference learning',
    'Subscription retention via usage-based nudges',
    'Social commerce checkout in two taps',
  ],
  climate: [
    'Grid-scale storage dispatch and merchant risk',
    'MRV automation for carbon removal suppliers',
    'Heat-pump installer OS with instant rebates',
  ],
  defense: [
    'Mission planning copilots with air-gapped deploys',
    'RF spectrum analytics for contested environments',
    'Supply assurance for critical components',
  ],
  education: [
    'Adaptive STEM tutoring with teacher dashboards',
    'Accreditation-ready skills evidence for learners',
    'Campus operations and safety in one pane',
  ],
  logistics: [
    'Port drayage optimization with live chassis data',
    'Last-mile dynamic routing for dense metros',
    'Warehouse robotics orchestration APIs',
  ],
  government: [
    'Permitting workflows with constituent transparency',
    'Grants compliance automation for agencies',
    'Procurement intelligence across vendor landscapes',
  ],
  robotics: [
    'AMR fleets for dense warehouses with safety-rated lidar',
    'Cobot workstations with force-torque sensing for assembly',
    'Offline motion planning for unpredictable pick-and-place SKUs',
  ],
  real_estate: [
    'Commercial lease abstraction with ASC 842-ready schedules',
    'Tenant experience apps for Class A office portfolios',
    'Title and escrow workflow with instant wire fraud checks',
  ],
}

const HQS = [
  'San Francisco, CA',
  'New York, NY',
  'London, UK',
  'Berlin, DE',
  'Austin, TX',
  'Toronto, ON',
  'Seattle, WA',
  'Boston, MA',
  'Los Angeles, CA',
  'Chicago, IL',
  'Denver, CO',
  'Atlanta, GA',
  'Singapore',
  'Tel Aviv, IL',
  'Paris, FR',
  'Amsterdam, NL',
  'Dublin, IE',
  'Sydney, AU',
]
const STAGES = ['Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C', 'Growth']
const INVESTORS = ['a16z', 'Sequoia', 'Index', 'Lightspeed', 'Accel', 'GV', 'NEA', 'Benchmark']

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomId() {
  return `st-${crypto.randomUUID().slice(0, 8)}`
}

/**
 * Avoid duplicate display names within a batch (random picks would repeat “Apex Labs” often).
 * If many collisions, append a short hex block (not base36 noise like old mocks).
 */
function uniqueDisplayName(used: Set<string>): string {
  for (let attempt = 0; attempt < 120; attempt++) {
    const name =
      Math.random() > 0.38
        ? `${pick(NAME_A)} ${pick(NAME_B)}`
        : `${pick(NAME_A)} ${pick(NAME_C)} ${pick(NAME_B)}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const tail = crypto.randomUUID().replace(/-/g, '').slice(0, 5)
  const fallback = `${pick(NAME_A)} ${pick(NAME_B)} ${tail}`
  used.add(fallback)
  return fallback
}

function tagFor(category: CategoryId): string {
  return pick(TAGS_BY_TOPIC[category])
}

function fundForCategory(cat: CategoryId): number | null {
  if (cat.startsWith('ai_') && Math.random() > 0.04) {
    return Math.round(5 + Math.random() * 150) * 1_000_000
  }
  if (cat === 'education' && Math.random() > 0.65) return null
  if (cat === 'government' && Math.random() > 0.55) return null
  if (Math.random() > 0.06) return Math.round(2 + Math.random() * 120) * 1_000_000
  return null
}

const ALL_CATEGORIES: CategoryId[] = [...TOPIC_CATEGORY_IDS]

/** Random calendar date between ~9y and ~1y ago (UTC date parts, varied month/day). */
function randomFoundedDateYmd(): string {
  const now = new Date()
  const endY = now.getUTCFullYear() - 1
  const startY = now.getUTCFullYear() - 9
  const y = startY + Math.floor(Math.random() * (endY - startY + 1))
  const mi = Math.floor(Math.random() * 12)
  const lastD = new Date(Date.UTC(y, mi + 1, 0)).getUTCDate()
  const d = 1 + Math.floor(Math.random() * lastD)
  return `${y}-${String(mi + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function generateBatch(count: number): Startup[] {
  const now = new Date()
  const batch: Startup[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < count; i++) {
    const category = ALL_CATEGORIES[i % ALL_CATEGORIES.length]!
    const foundedDate = randomFoundedDateYmd()
    const lastUpdated = new Date(now.getTime() - Math.floor(Math.random() * 36) * 60_000 * 60)

    const fund = fundForCategory(category)
    const displayName = uniqueDisplayName(usedNames)
    const tagline = tagFor(category)
    batch.push({
      id: randomId(),
      name: displayName,
      category,
      tagline,
      fundRaisedUsd: fund,
      foundedDate,
      hq: pick(HQS),
      stage: pick(STAGES),
      employees: Math.random() > 0.2 ? 12 + Math.floor(Math.random() * 400) : null,
      lastUpdated: lastUpdated.toISOString(),
      description: `${tagline}. The team is expanding GTM in North America and shipping a new enterprise tier with SSO, audit logs, and regional data residency. Early design partners report measurable time savings across core ops workflows.`,
      investors: Array.from(
        new Set(
          Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => pick(INVESTORS)),
        ),
      ),
      website: websiteUrlForStartup(displayName),
      dataSourceUrl: dataSourceUrlForStartup(displayName),
    })
  }

  return batch
}
