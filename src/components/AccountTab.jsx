import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { getAccountFrequencyData } from '../utils/dataProcessor'

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#f97316','#14b8a6','#84cc16']

function ChartCard({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>
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

export default function AccountTab({ data }) {
  const top20 = getAccountFrequencyData(data, 20)
  const top10 = top20.slice(0, 10)
  const uniqueAccounts = new Set(data.map((r) => r.account)).size
  const uniqueSpecialists = new Set(data.map((r) => r.specialist)).size

  // Accounts by sheet
  const bySheet = {}
  data.forEach((r) => {
    bySheet[r.sheet] = (bySheet[r.sheet] || 0) + 1
  })
  const sheetData = Object.entries(bySheet).map(([sheet, count]) => ({ sheet, count }))

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-500 font-medium">Total Records</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{data.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-500 font-medium">Unique Accounts</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">{uniqueAccounts}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <p className="text-sm text-slate-500 font-medium">Avg per Specialist</p>
          <p className="text-3xl font-bold text-slate-800 mt-1">
            {uniqueSpecialists ? Math.round(data.length / uniqueSpecialists) : 0}
          </p>
        </div>
      </div>

      {/* Top 10 accounts bar */}
      <ChartCard title="Top 10 Accounts by Frequency">
        {top10.length === 0 ? (
          <p className="text-slate-400 text-sm">No data for selected filters.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10} layout="vertical" margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis dataKey="account" type="category" width={150} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Count" radius={[0, 6, 6, 0]}>
                {top10.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* By sheet */}
      {sheetData.length > 1 && (
        <ChartCard title="Records by Sheet">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={sheetData} margin={{ right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="sheet" tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Records" radius={[6, 6, 0, 0]}>
                {sheetData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Full account table */}
      <ChartCard title={`All Accounts (Top ${top20.length})`}>
        {top20.length === 0 ? (
          <p className="text-slate-400 text-sm">No data.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-slate-500 font-medium">Account</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">Count</th>
                  <th className="text-right py-2 px-3 text-slate-500 font-medium">% of total</th>
                </tr>
              </thead>
              <tbody>
                {top20.map((row, i) => (
                  <tr key={row.account} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 text-slate-400">{i + 1}</td>
                    <td className="py-2 px-3 text-slate-700 font-medium">{row.account}</td>
                    <td className="py-2 px-3 text-right font-bold text-indigo-600">{row.count}</td>
                    <td className="py-2 px-3 text-right text-slate-500">
                      {data.length ? ((row.count / data.length) * 100).toFixed(1) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  )
}
