import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  getSpecialistBarData, getAccountFrequencyData, getUniqueAccountCount, getAverageTimeTaken,
  getAllSpecialists, getSpecialistColor,
  getPocBarData, getAllPocs, getPocColor,
  displaySheet,
  // formatAnalyticsExportRow,
} from '../utils/dataProcessor'
import useIsMobile from '../hooks/useIsMobile'
import {
  buildExportFileName, downloadPdf, newReport,
  sectionTitle, kpiGrid, kpiGridHeight, barChartCanvas, addImageBlock, imageHeightMM,
  table, tableReserve,
} from '../utils/pdfExport'

// const ROW_COLUMNS = [
//   ['sheet', 'Sheet'], ['rowId', 'Row ID'], ['specialist', 'Specialist'], ['poc', 'POC'],
//   ['account', 'Account'], ['timestamp', 'Date'], ['completionDate', 'Completed'],
//   ['durationDays', 'Duration (d)'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['week', 'Week'],
// ]

const SHEET_ACCENTS = [
  { a: '#6366f1', b: '#8b5cf6' },
  { a: '#0ea5e9', b: '#06b6d4' },
  { a: '#10b981', b: '#14b8a6' },
]

const ACCOUNT_COLORS = [
  '#818cf8','#38bdf8','#34d399','#fbbf24','#f472b6',
  '#a78bfa','#fb923c','#60a5fa','#4ade80','#facc15',
  '#e879f9','#2dd4bf','#f87171','#c084fc','#86efac',
]

const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
}

const AXIS  = 'rgba(255,255,255,0.3)'
const GRID  = 'rgba(255,255,255,0.05)'

const truncateLabel = (max) => (v) => (v && v.length > max ? `${v.slice(0, max - 1)}…` : v)

const DarkTooltip = ({ active, payload, label: l }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl p-3 shadow-2xl text-sm"
      style={{ background: 'rgba(8,12,30,0.96)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="mb-1.5 font-semibold" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{l}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>{p.name}</span>
          <span className="font-bold text-white ml-auto pl-3 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function GradCard({ label, value, from, to, sub }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}>
      <div className="absolute inset-0 opacity-20"
        style={{ background: 'radial-gradient(ellipse at top right, white 0%, transparent 70%)' }} />
      <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tabular-nums relative">{value.toLocaleString()}</p>
      <p className="text-white/80 font-semibold text-sm mt-3 relative">{label}</p>
      {sub && <p className="text-white/45 text-xs mt-1 relative leading-relaxed break-words">{sub}</p>}
    </div>
  )
}

export default function AllView({ data, sheets, viewMode }) {
  const isPoc = viewMode === 'poc'
  const isMobile = useIsMobile()
  const [exporting, setExporting] = useState(false)

  const dataBySheet = useMemo(() => {
    const r = {}
    sheets.forEach(s => { r[s] = data.filter(d => d.sheet === s) })
    return r
  }, [data, sheets])

  const countUniqueEntries = (rows) => {
    const seen = new Set()
    rows.forEach(r => seen.add(r.rowId))
    return seen.size
  }

  const topAccounts = useMemo(() => getAccountFrequencyData(data, 10), [data])
  const uniqueAccounts = useMemo(() => getUniqueAccountCount(data), [data])
  const allSpecialists = useMemo(() => getAllSpecialists(data), [data])
  const uniqueEntries = useMemo(() => {
    const seen = new Set()
    data.forEach(r => seen.add(r.rowId))
    return seen.size
  }, [data])
  const avgTimeDays = useMemo(() => getAverageTimeTaken(data), [data])

  // Specialist mode aggregations
  const specTotals = useMemo(() => getSpecialistBarData(data), [data])
  const maxTotal   = Math.max(...specTotals.map(d => d.count), 1)

  // POC mode aggregations
  const allPocs   = useMemo(() => getAllPocs(data), [data])
  const pocTotals = useMemo(() => getPocBarData(data), [data])
  const maxPoc    = Math.max(...pocTotals.map(d => d.count), 1)

  // Total unique entries (for percentage base in POC view)
  const totalUniqueRows = useMemo(() => {
    const seen = new Set(); data.forEach(r => seen.add(r.rowId)); return seen.size
  }, [data])

  const modeLabel = isPoc ? 'Implementation POC' : 'Implementation Specialist'
  const breakdownColorFn = isPoc ? (name) => getPocColor(name, allPocs) : (name) => getSpecialistColor(name, allSpecialists)
  const accountColorFn = (name) => ACCOUNT_COLORS[topAccounts.findIndex((a) => a.account === name) % ACCOUNT_COLORS.length]

  const exportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { doc, y: y0 } = newReport('Implementation Analytics Full Report', `${modeLabel} view · All sheets combined`)
      let y = y0

      const kpiCards = [
        { label: 'Total Entries', value: uniqueEntries.toLocaleString(), color: '#3730a3' },
        { label: 'Unique Accounts', value: uniqueAccounts.toLocaleString(), color: '#0369a1' },
      ]
      if (!isPoc) kpiCards.push({ label: 'Avg Time / Account', value: avgTimeDays == null ? 'N/A' : `${avgTimeDays.toFixed(1)}d`, color: '#7c3aed' })
      kpiCards.push(isPoc
        ? { label: 'POCs Active', value: allPocs.length, sub: allPocs.join(', '), color: '#9d174d' }
        : { label: 'Specialists', value: allSpecialists.length, sub: allSpecialists.join(', '), color: '#065f46' })
      y = sectionTitle(doc, y, 'Grand Totals', kpiGridHeight(kpiCards))
      y = kpiGrid(doc, y, kpiCards)

      y = sectionTitle(doc, y + 2, 'Per-Sheet Breakdown')
      sheets.forEach((sheet) => {
        const sd = dataBySheet[sheet] || []
        const sheetEntries = countUniqueEntries(sd)
        const sheetAvgTime = getAverageTimeTaken(sd)
        const bar = isPoc ? getPocBarData(sd) : getSpecialistBarData(sd)
        const canvas = barChartCanvas(bar, breakdownColorFn)
        const rows = bar.map(({ name, count }) => [name, count, sheetEntries ? `${Math.round((count / sheetEntries) * 100)}%` : '0%'])
        const reserve = imageHeightMM(doc, canvas) + tableReserve(rows.length)
        const sheetTitle = `${displaySheet(sheet)} (${sheetEntries} entries${!isPoc ? `, avg ${sheetAvgTime == null ? 'N/A' : sheetAvgTime.toFixed(1) + 'd'}` : ''})`
        y = sectionTitle(doc, y + 2, sheetTitle, reserve)
        y = addImageBlock(doc, y, canvas)
        y = table(doc, y, [isPoc ? 'POC' : 'Specialist', 'Count', 'Share'], rows)
      })

      const combinedTotals = isPoc ? pocTotals : specTotals
      const combinedTotal = isPoc ? totalUniqueRows : uniqueEntries
      const combinedCanvas = barChartCanvas(combinedTotals, breakdownColorFn)
      const combinedRows = combinedTotals.map(({ name, count }) => [name, count, combinedTotal ? `${Math.round((count / combinedTotal) * 100)}%` : '0%'])
      y = sectionTitle(doc, y + 2, `All ${isPoc ? 'Implementation POCs' : 'Specialists'}, Combined Total`, imageHeightMM(doc, combinedCanvas))
      y = addImageBlock(doc, y, combinedCanvas)
      y = table(doc, y, [isPoc ? 'POC' : 'Specialist', 'Count', 'Share'], combinedRows)

      const topAccountsCanvas = barChartCanvas(topAccounts.map((a) => ({ name: a.account, count: a.count })), accountColorFn)
      const topAccountsRows = topAccounts.map((a) => [a.account, a.count])
      y = sectionTitle(doc, y + 2, 'Top Accounts (All Sheets Combined)', imageHeightMM(doc, topAccountsCanvas))
      y = addImageBlock(doc, y, topAccountsCanvas)
      y = table(doc, y, ['Account', 'Locations'], topAccountsRows)

      // const rows = data.map(formatAnalyticsExportRow)
      // y = sectionTitle(doc, y + 2, `All Rows (${rows.length})`)
      // table(doc, y, ROW_COLUMNS.map(([, label]) => label), rows.map(r => ROW_COLUMNS.map(([key]) => r[key] ?? '')))

      downloadPdf(doc, buildExportFileName('implementation-analytics', [viewMode, 'full-report']))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Downloads</p>
          <p className="text-sm text-white/50 mt-1">One PDF with every stat, chart and record from this view.</p>
        </div>
        <button onClick={exportPdf} disabled={exporting}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-50">
          {exporting ? 'Generating PDF…' : 'Download Analytics'}
        </button>
      </div>

      {/* ── Grand total cards ── */}
      <div className={`grid gap-4 ${isPoc ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        <GradCard label="Total Entries"   value={uniqueEntries}         from="#3730a3" to="#6d28d9" />
        <GradCard label="Unique Accounts" value={uniqueAccounts}        from="#0369a1" to="#0891b2" />
        {!isPoc && (
          <GradCard label="Avg Time / Account" value={avgTimeDays ?? 0} from="#7c3aed" to="#a855f7"
            sub={avgTimeDays == null ? 'No completed dates' : 'days'} />
        )}
        {isPoc
          ? <GradCard label="POCs Active" value={allPocs.length}        from="#9d174d" to="#db2777"
              sub={allPocs.join(' · ')} />
          : <GradCard label="Specialists" value={allSpecialists.length} from="#065f46" to="#0d9488"
              sub={allSpecialists.join(' · ')} />
        }
      </div>

      {/* ── Per-sheet cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sheets.map((sheet, i) => {
          const sd     = dataBySheet[sheet] || []
          const accent = SHEET_ACCENTS[i] || SHEET_ACCENTS[0]
          const sheetEntries = countUniqueEntries(sd)
          const sheetAvgTime = getAverageTimeTaken(sd)

          // Specialist or POC breakdown per sheet
          const bar = isPoc ? getPocBarData(sd) : getSpecialistBarData(sd)
          const maxCnt = Math.max(...bar.map(d => d.count), 1)

          return (
            <div key={sheet} className="rounded-2xl overflow-hidden" style={glass}>
              <div className="px-5 pt-5 pb-4 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${accent.a}, ${accent.b})` }}>
                <div className="absolute inset-0 opacity-20"
                  style={{ background: 'radial-gradient(ellipse at top right, white 0%, transparent 70%)' }} />
                <p className="text-white/55 text-xs font-bold uppercase tracking-widest relative">{displaySheet(sheet)}</p>
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mt-1 tabular-nums relative">{sheetEntries.toLocaleString()}</p>
                <p className="text-white/50 text-xs mt-0.5 relative">entries</p>
                {!isPoc && (
                  <p className="text-white/60 text-xs mt-2 relative">
                    Avg time: {sheetAvgTime == null ? 'N/A' : `${sheetAvgTime.toFixed(1)} days`}
                  </p>
                )}
              </div>
              <div className="p-5 space-y-3">
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  By {isPoc ? 'Implementation POC' : 'Specialist'}
                </p>
                {bar.length === 0 && <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>No data</p>}
                {bar.map(({ name, count }) => {
                  const color = isPoc ? getPocColor(name, allPocs) : getSpecialistColor(name, allSpecialists)
                  return (
                    <div key={name} className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs w-20 truncate" style={{ color: 'rgba(255,255,255,0.65)' }}>{name}</span>
                      <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${(count / maxCnt) * 100}%`, background: color }} />
                      </div>
                      <span className="text-xs font-bold tabular-nums w-5 text-right" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Combined totals (Specialist OR POC) ── */}
      {isPoc ? (
        pocTotals.length > 0 && (
          <div className="rounded-2xl p-5" style={glass}>
            <p className="text-sm font-semibold text-white/80 mb-1">All Implementation POCs: Combined Total By Location</p>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Across all sheets for the selected time period
            </p>
            <div className="space-y-3">
              {pocTotals.map(({ name, count }) => {
                const color = getPocColor(name, allPocs)
                const pct = Math.round((count / totalUniqueRows) * 100)
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm font-semibold w-28 truncate" style={{ color: 'rgba(255,255,255,0.75)' }}>{name}</span>
                    <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(count / maxPoc) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums text-white w-8 text-right">{count}</span>
                    <span className="text-xs w-8" style={{ color: 'rgba(255,255,255,0.35)' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      ) : (
        specTotals.length > 0 && (
          <div className="rounded-2xl p-5" style={glass}>
            <p className="text-sm font-semibold text-white/80 mb-1">All Specialists: Combined Total</p>
            <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Across all sheets for the selected time period
            </p>
            <div className="space-y-3">
              {specTotals.map(({ name, count }) => {
                const pct = Math.round((count / uniqueEntries) * 100)
                const color = getSpecialistColor(name, allSpecialists)
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-sm font-semibold w-20" style={{ color: 'rgba(255,255,255,0.75)' }}>{name}</span>
                    <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(count / maxTotal) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums text-white w-8 text-right">{count}</span>
                    <span className="text-xs w-8" style={{ color: 'rgba(255,255,255,0.35)' }}>{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      )}

      {/* ── Top accounts — all sheets combined ── */}
      {topAccounts.length > 0 && (
        <div className="rounded-2xl p-5 overflow-hidden" style={glass}>
          <p className="text-sm font-semibold text-white/80 mb-1">Top Accounts: All Sheets Combined</p>
          <p className="text-xs mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Each bar = number of locations onboarded. Same named accounts are merged.
          </p>

          <ResponsiveContainer width="100%" height={Math.max(340, topAccounts.length * 42)}>
            <BarChart data={topAccounts} layout="vertical" margin={{ top: 12, right: isMobile ? 28 : 56, bottom: 12, left: 4 }}>
              <defs>
                {topAccounts.map((_, i) => (
                  <linearGradient key={i} id={`ag${i}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} stopOpacity={1} />
                    <stop offset="100%" stopColor={ACCOUNT_COLORS[i % ACCOUNT_COLORS.length]} stopOpacity={0.4} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID} />
              <XAxis type="number" tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis
                dataKey="account" type="category" width={isMobile ? 96 : 190}
                tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS }} axisLine={false} tickLine={false}
                tickFormatter={isMobile ? truncateLabel(12) : undefined}
              />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} allowEscapeViewBox={{ x: false, y: true }} />
              <Bar dataKey="count" name="Locations" radius={[0, 8, 8, 0]}>
                {topAccounts.map((_, i) => (
                  <Cell key={i} fill={`url(#ag${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
