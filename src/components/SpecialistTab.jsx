import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Cell,
} from 'recharts'
import { getAllSpecialists, getSpecialistDetail, buildExportFileName, downloadCsvFile, 
  // formatAnalyticsExportRow 
} from '../utils/dataProcessor'

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#14b8a6','#84cc16']

function StatCard({ label, value }) {
  return (
    <div className="bg-indigo-50 rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <p className="text-xs font-medium text-indigo-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-indigo-700">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 overflow-hidden">
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
  const specialistList = useMemo(() => getAllSpecialists(allData), [allData])
  const visibleSpecialists = specialists?.length ? specialists : specialistList

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

  // const exportRows = () => {
  //   downloadCsvFile(
  //     buildExportFileName('implementation-analytics', ['specialist', selected === 'all' ? 'all-specialists' : selected, 'rows']),
  //     baseData.map(formatAnalyticsExportRow)
  //   )
  // }

  const exportSummary = () => {
    const summaryRows = [
      { metric: 'selection', value: selected },
      { metric: 'total', value: detail.total },
      { metric: 'thisYear', value: countYear },
      { metric: 'thisQuarter', value: countQuarter },
      { metric: 'thisMonth', value: countMonth },
      { metric: 'avgTimeDays', value: detail.avgTimeDays == null ? '' : Number(detail.avgTimeDays.toFixed(2)) },
    ]

    downloadCsvFile(
      buildExportFileName('implementation-analytics', ['specialist', selected === 'all' ? 'all-specialists' : selected, 'summary']),
      summaryRows
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Downloads</p>
          <p className="text-sm text-slate-500 mt-1">Export the selected specialist or the full specialist pool.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportRows} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            Download rows CSV
          </button>
          <button onClick={exportSummary} className="px-3 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            Download summary CSV
          </button>
        </div>
      </div>
      {/* Specialist selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
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
          {visibleSpecialists.map((s, i) => (
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total (All Time)" value={detail.total} />
        <StatCard label={`This Year (${thisYear})`} value={countYear} />
        <StatCard label="This Quarter" value={countQuarter} />
        <StatCard label="This Month" value={countMonth} />
      </div>

      {/* Trend groupby toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <span className="text-sm text-slate-500 font-medium">View by:</span>
        <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-lg w-fit max-w-full">
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
        <ChartCard title={`Accounts ${GROUPBYS.find((g) => g.key === groupBy)?.label} Trend`}>
          {trendData.length === 0 ? (
            <p className="text-slate-400 text-sm">No data.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={detail.accounts} layout="vertical" margin={{ top: 12, left: 18, right: 30, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis
                  dataKey="account"
                  type="category"
                  width={150}
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
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={detail.quarterly} margin={{ top: 12, right: 14, left: 0, bottom: 8 }}>
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
