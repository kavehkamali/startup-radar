/** Topic sectors: AI sub-categories, split SaaS, and verticals. */
export const TOPIC_CATEGORY_IDS = [
  // AI — sub-categories
  'ai_foundation',
  'ai_inference',
  'ai_agents',
  'ai_enterprise',
  'ai_devtools',
  // Business SaaS (replaces generic “enterprise”)
  'saas_workflow',
  'saas_vertical',
  'saas_data',
  // Other sectors
  'medical',
  'finance',
  'consumer',
  'climate',
  'defense',
  'education',
  'logistics',
  'government',
  'robotics',
  'real_estate',
] as const

export type CategoryId = (typeof TOPIC_CATEGORY_IDS)[number]

export type Startup = {
  id: string
  name: string
  category: CategoryId
  tagline: string
  fundRaisedUsd: number | null
  foundedDate: string
  hq: string
  stage: string
  employees: number | null
  lastUpdated: string
  description: string
  investors: string[]
  website: string | null
  /** Where this row was sourced (demo: search / directory). */
  dataSourceUrl?: string | null
}

export type CachePayload = {
  version: 1
  startups: Startup[]
  lastCollectAt: string | null
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  ai_foundation: 'AI · Foundation models',
  ai_inference: 'AI · Inference & GPU cloud',
  ai_agents: 'AI · Agents & automation',
  ai_enterprise: 'AI · Enterprise copilots',
  ai_devtools: 'AI · MLOps & data for ML',
  saas_workflow: 'SaaS · Workflow & ops',
  saas_vertical: 'SaaS · Vertical / industry',
  saas_data: 'SaaS · Data & analytics',
  medical: 'Medical & health',
  finance: 'Finance & banking',
  consumer: 'Consumer & retail',
  climate: 'Climate & energy',
  defense: 'Defense & aerospace',
  education: 'Education & research',
  logistics: 'Logistics & mobility',
  government: 'Government & civic',
  robotics: 'Robotics & automation',
  real_estate: 'Real estate & proptech',
}

/** Short labels for table, filters, chips (inferred topic uses these). */
export const CATEGORY_CHART_LABELS: Record<CategoryId, string> = {
  ai_foundation: 'AI · Foundation',
  ai_inference: 'AI · Inference',
  ai_agents: 'AI · Agents',
  ai_enterprise: 'AI · Enterprise',
  ai_devtools: 'AI · MLOps',
  saas_workflow: 'SaaS · Workflow',
  saas_vertical: 'SaaS · Vertical',
  saas_data: 'SaaS · Data',
  medical: 'Medical',
  finance: 'Finance',
  consumer: 'Consumer',
  climate: 'Climate',
  defense: 'Defense',
  education: 'Education',
  logistics: 'Logistics',
  government: 'Government',
  robotics: 'Robotics',
  real_estate: 'Real estate',
}

/** Alias for readability in UI code. */
export const CATEGORY_SHORT_LABELS = CATEGORY_CHART_LABELS

/** UI grouping: Artificial intelligence, Business SaaS, Sectors. */
export const TOPIC_GROUPS: { label: string; ids: CategoryId[] }[] = [
  {
    label: 'Artificial intelligence',
    ids: ['ai_foundation', 'ai_inference', 'ai_agents', 'ai_enterprise', 'ai_devtools'],
  },
  {
    label: 'Business SaaS',
    ids: ['saas_workflow', 'saas_vertical', 'saas_data'],
  },
  {
    label: 'Sectors',
    ids: [
      'medical',
      'finance',
      'consumer',
      'climate',
      'defense',
      'education',
      'logistics',
      'government',
      'robotics',
      'real_estate',
    ],
  },
]

const TOPIC_SET = new Set<string>(TOPIC_CATEGORY_IDS)

/** Map legacy / old cache ids into the current taxonomy. */
export const LEGACY_CATEGORY_TO_TOPIC: Record<string, CategoryId> = {
  tech: 'ai_enterprise',
  trends: 'consumer',
  funds: 'finance',
  other: 'government',
  enterprise: 'saas_workflow',
}

export function normalizeCategory(raw: string): CategoryId {
  if (TOPIC_SET.has(raw)) return raw as CategoryId
  return LEGACY_CATEGORY_TO_TOPIC[raw] ?? 'saas_workflow'
}
