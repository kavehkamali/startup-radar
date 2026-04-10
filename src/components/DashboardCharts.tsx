import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CategoryId } from '../types'
import { CATEGORY_CHART_LABELS } from '../types'

/** Distinct colors per topic (charts). */
const TOPIC_COLORS: Record<CategoryId, string> = {
  ai_foundation: '#7c3aed',
  ai_inference: '#6366f1',
  ai_agents: '#8b5cf6',
  ai_enterprise: '#a855f7',
  ai_devtools: '#c026d3',
  saas_workflow: '#64748b',
  saas_vertical: '#475569',
  saas_data: '#0ea5e9',
  medical: '#0d9488',
  finance: '#059669',
  consumer: '#f59e0b',
  climate: '#22c55e',
  defense: '#b91c1c',
  education: '#2563eb',
  logistics: '#ea580c',
  government: '#78716c',
  robotics: '#0891b2',
  real_estate: '#a16207',
}

export type CategoryPieSlice = { category: CategoryId; name: string; value: number }

type FundRow = { topic: string; category: CategoryId; totalUsd: number }

type Props = {
  categoryPieData: CategoryPieSlice[]
  fundData: FundRow[]
  activeTopics: CategoryId[]
}

function formatCompactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Math.round(n)}`
}

export function DashboardCharts({ categoryPieData, fundData, activeTopics }: Props) {
  const showPie = activeTopics.length > 0 && categoryPieData.length > 0
  const showFunds = activeTopics.length > 0 && fundData.some((r) => r.totalUsd > 0)
  const pieTotal = categoryPieData.reduce((s, d) => s + d.value, 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <h3 className="mb-1 text-[11px] font-semibold text-slate-800">Startups by category</h3>
        <p className="mb-2 text-[10px] text-slate-500">
          Share of rows in the table (inferred topic, same date range and filters)
        </p>
        {showPie ? (
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 4, left: 4, bottom: 0 }}>
                <Pie
                  data={categoryPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={44}
                  outerRadius={72}
                  paddingAngle={1}
                  stroke="#fff"
                  strokeWidth={1}
                >
                  {categoryPieData.map((d) => (
                    <Cell key={d.category} fill={TOPIC_COLORS[d.category]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(value) => {
                    const v = Number(value) || 0
                    const pct = pieTotal > 0 ? Math.round((100 * v) / pieTotal) : 0
                    return [`${v} (${pct}%)`, 'Startups']
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-6 text-center text-[11px] text-slate-400">No data in this time range.</p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <h3 className="mb-1 text-[11px] font-semibold text-slate-800">Total fund raised by topic</h3>
        <p className="mb-2 text-[10px] text-slate-500">Sum of disclosed funding in the selected window</p>
        {showFunds ? (
          <div className="h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fundData}
                layout="vertical"
                margin={{ top: 4, right: 8, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                  tickFormatter={(v) => formatCompactUsd(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="topic"
                  tick={{ fontSize: 10 }}
                  stroke="#94a3b8"
                  width={118}
                  interval={0}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11 }}
                  formatter={(value) => formatCompactUsd(Number(value) || 0)}
                />
                <Bar dataKey="totalUsd" radius={[0, 4, 4, 0]}>
                  {fundData.map((entry, i) => (
                    <Cell key={`c-${i}`} fill={TOPIC_COLORS[entry.category]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-6 text-center text-[11px] text-slate-400">No funding data in this range.</p>
        )}
      </div>
    </div>
  )
}

export function buildFundBars(
  rows: { fundRaisedUsd: number | null; category: CategoryId }[],
  topics: CategoryId[],
): FundRow[] {
  const sums = Object.fromEntries(topics.map((t) => [t, 0])) as Record<CategoryId, number>
  for (const r of rows) {
    if (r.fundRaisedUsd != null && r.category in sums) sums[r.category] += r.fundRaisedUsd
  }
  return topics
    .map((category) => ({
      topic: CATEGORY_CHART_LABELS[category],
      category,
      totalUsd: sums[category],
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
}
