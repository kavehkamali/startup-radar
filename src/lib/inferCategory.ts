import type { CategoryId, Startup } from '../types'
import { TOPIC_CATEGORY_IDS } from '../types'

/** Lowercase phrases; first match score wins tie-breaker by order in list. */
const KEYWORDS: Record<CategoryId, string[]> = {
  ai_foundation: [
    'pre-training',
    'foundation model',
    'trillion token',
    'mixture-of-experts',
    'open-weight',
    'parameter',
    'base model',
  ],
  ai_inference: [
    'inference',
    'gpu',
    'latency',
    'batch + real-time',
    'autoscaling gpu',
    'edge model serving',
    'tenant qos',
  ],
  ai_agents: [
    'agent',
    'browser and desktop automation',
    'human approval',
    'multi-step research',
    'tool-using',
  ],
  ai_enterprise: [
    'copilot',
    'crm',
    'erp',
    'service desk',
    'rag over',
    'meeting summarization',
    'compliance archive',
  ],
  ai_devtools: [
    'eval suite',
    'red-team',
    'fine-tuning',
    'feature store',
    'labeling ops',
    'synthetic data',
    'mlops',
  ],
  saas_workflow: [
    'approval chain',
    'sox',
    'audit trail',
    'revops',
    'itsm',
    'asset lifecycle',
  ],
  saas_vertical: [
    'construction lien',
    'ehr',
    'emr',
    'restaurant',
    'vertical',
    'industry stack',
  ],
  saas_data: [
    'warehouse-centric',
    'dbt',
    'reverse etl',
    'lineage',
    'row-level security',
    'lakehouse',
    'metrics',
  ],
  medical: [
    'clinical',
    'ehr',
    'fda',
    'patient',
    'therapeutic',
    'diagnostic',
    'care team',
  ],
  finance: [
    'treasury',
    'liquidity',
    'fraud',
    'ach',
    'card',
    'kyc',
    'sanctions',
    'reconciliation',
    'lending',
    'payment',
  ],
  consumer: [
    'subscription',
    'commerce',
    'checkout',
    'preference',
    'discovery',
    'retail',
  ],
  climate: [
    'carbon',
    'grid',
    'storage',
    'mrv',
    'heat-pump',
    'energy',
  ],
  defense: [
    'mission planning',
    'air-gapped',
    'spectrum',
    'contested',
    'classified',
  ],
  education: [
    'accreditation',
    'stem',
    'tutor',
    'campus',
    'learner',
    'teacher',
  ],
  logistics: [
    'drayage',
    'chassis',
    'last-mile',
    'warehouse',
    'port',
    'routing',
  ],
  government: [
    'permitting',
    'constituent',
    'grants',
    'agency',
    'procurement',
    'rfp',
  ],
  robotics: [
    'robotics',
    'robotic',
    'autonomous mobile robot',
    'amr',
    'manipulator',
    'cobot',
    'kinematics',
    'motion planning',
    'warehouse robotics',
    'industrial automation',
    'pick-and-place',
  ],
  real_estate: [
    'real estate',
    'proptech',
    'commercial real estate',
    'lease administration',
    'property management',
    'tenant',
    'multifamily',
    'title and escrow',
    'appraisal',
    'brokerage',
  ],
}

export function inferCategoryFromStartup(s: Startup): CategoryId {
  const text = `${s.tagline} ${s.description}`.toLowerCase()
  const scores: Partial<Record<CategoryId, number>> = {}
  for (const id of TOPIC_CATEGORY_IDS) {
    let sc = 0
    for (const kw of KEYWORDS[id]) {
      if (text.includes(kw)) sc += kw.length
    }
    if (sc > 0) scores[id] = sc
  }
  let best: CategoryId = s.category
  let max = 0
  for (const id of TOPIC_CATEGORY_IDS) {
    const v = scores[id] ?? 0
    if (v > max) {
      max = v
      best = id
    }
  }
  return max > 0 ? best : s.category
}
