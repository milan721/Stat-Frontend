import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from 'recharts'
import { getSpecialistDetail } from '../utils/dataProcessor'

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#14b8a6','#84cc16']

function StatCard({ label, value }) {
  return (
    <div className="bg-indigo-50 rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs font-medium text-indigo-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-indigo-700">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>
      {children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

const GROUPBYS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'weekly', label: 'Weekly' },
]

export default function SpecialistTab({ data, allData, specialists }) {
  const [selected, setSelected] = useState('all')
  const [groupBy, setGroupBy] = useState('monthly')

  const detail = getSpecialistDetail(data, selected)
  const trendData = detail[groupBy] || []

  // Calculate this-year / this-month / this-quarter stats from full data
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()
  const thisQuarter = Math.floor(thisMonth / 3) + 1

  const baseData = selected === 'all' ? allData : allData.filter((r) => r.specialist === selected)
  const countYear = baseData.filter((r) => r.year === thisYear).length
  const countMonth = baseData.filter((r) => r.year === thisYear && r.month === thisMonth).length
  const countQuarter = baseData.filter((r) => r.year === thisYear && r.quarter === thisQuarter).length

  return (
    <div className="space-y-5">
      {/* Specialist selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-slate-600 mr-2">Specialist:</span>
          <button
            onClick={() => setSelected('all')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              selected === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
            }`}
          >
            All
          </button>
          {specialists.map((s, i) => (
            <button
              key={s}
              onClick={() => setSelected(s)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                selected === s
                  ? 'text-white border-transparent'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}
              style={selected === s ? { background: COLORS[i % COLORS.length], borderColor: COLORS[i % COLORS.length] } : {}}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total (All Time)" value={detail.total} />
        <StatCard label={`This Year (${thisYear})`} value={countYear} />
        <StatCard label="This Quarter" value={countQuarter} />
        <StatCard label="This Month" value={countMonth} />
      </div>

      {/* Trend groupby toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">View by:</span>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          {GROUPBYS.map((g) => (
            <button
              key={g.key}
              onClick={() => setGroupBy(g.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                groupBy === g.key
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Trend chart */}
        <ChartCard title={`Accounts — ${GROUPBYS.find((g) => g.key === groupBy)?.label} Trend`}>
          {trendData.length === 0 ? (
            <p className="text-slate-400 text-sm">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trendData} margin={{ right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Accounts"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#6366f1' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top accounts */}
        <ChartCard title="Top Accounts">
          {detail.accounts.length === 0 ? (
            <p className="text-slate-400 text-sm">No accounts found.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={detail.accounts} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis
                  dataKey="account"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Accounts" radius={[0, 6, 6, 0]}>
                  {detail.accounts.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Quarterly bar chart */}
      <ChartCard title="Quarterly Breakdown">
        {detail.quarterly.length === 0 ? (
          <p className="text-slate-400 text-sm">No data.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={detail.quarterly} margin={{ right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Accounts" fill="#6366f1" radius={[6, 6, 0, 0]}>
                {detail.quarterly.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}
