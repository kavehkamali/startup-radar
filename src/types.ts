export type CategoryId = 'tech' | 'trends' | 'funds' | 'other'

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
}

export type CachePayload = {
  version: 1
  startups: Startup[]
  lastCollectAt: string | null
}

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  tech: 'Tech startups',
  trends: 'Trends',
  funds: 'Funds',
  other: 'Other',
}
