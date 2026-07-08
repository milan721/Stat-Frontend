import { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  getAllSpecialists, getSpecialistColor,
  getSpecialistBarData, getPieData, getTimeSeriesData, getAccountFrequencyData, getUniqueAccountCount, getAverageTimeTaken,
  getPocBarData, getPocPieData, getAllPocs, getPocColor,
  getSpecialistPocBreakdown, POC_PALETTE, displaySheet,
  // formatAnalyticsExportRow,
} from '../utils/dataProcessor'
import useIsMobile from '../hooks/useIsMobile'
import {
  buildExportFileName, downloadPdf, newReport,
  sectionTitle, kpiGrid, kpiGridHeight, barChartCanvas, pieChartCanvas, lineChartCanvas,
  addImageBlock, imageHeightMM, 
  // table, 
  tableReserve,
} from '../utils/pdfExport'

const truncateLabel = (max) => (v) => (v && v.length > max ? `${v.slice(0, max - 1)}…` : v)

// const ROW_COLUMNS = [
//   ['sheet', 'Sheet'], ['rowId', 'Row ID'], ['specialist', 'Specialist'], ['poc', 'POC'],
//   ['account', 'Account'], ['timestamp', 'Date'], ['completionDate', 'Completed'],
//   ['durationDays', 'Duration (d)'], ['year', 'Year'], ['quarter', 'Quarter'], ['month', 'Month'], ['week', 'Week'],
// ]

const glass = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(20px)',
}
const AXIS_COLOR = 'rgba(255,255,255,0.3)'
const GRID_COLOR = 'rgba(255,255,255,0.05)'

const GROUPBYS = [
  { key: 'monthly', label: 'Month' }, { key: 'quarterly', label: 'Quarter' },
  { key: 'yearly',  label: 'Year'  }, { key: 'weekly',    label: 'Week'   },
]

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-2xl p-3 text-sm shadow-2xl"
      style={{ background: 'rgba(8,12,30,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p className="mb-2 font-semibold" style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span style={{ color: 'rgba(255,255,255,0.55)' }}>{p.name}</span>
          <span className="font-bold text-white ml-auto pl-4 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, children, actions }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 overflow-hidden" style={glass}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 sm:mb-5">
        <h3 className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  )
}

function StatCard({ label, value, color, sub }) {
  return (
    <div className="rounded-2xl p-4 sm:p-5 relative overflow-hidden" style={glass}>
      <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: `linear-gradient(90deg, ${color}, ${color}55)` }} />
      <p className="text-sm font-medium mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</p>
      <p className="text-2xl sm:text-3xl font-bold text-white mt-1 tabular-nums">{Number(value).toLocaleString()}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{sub}</p>}
    </div>
  )
}

function Pill({ name, count, selected, color, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
      style={selected
        ? { background: color, color: 'white', border: `1px solid ${color}` }
        : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }
      }
    >
      <span className="w-2 h-2 rounded-full" style={{ background: selected ? 'rgba(255,255,255,0.65)' : color }} />
      {name}
      <span className="tabular-nums" style={{ opacity: 0.65, fontSize: 11 }}>({count})</span>
    </button>
  )
}

export default function SheetView({ data, sheetName, viewMode }) {
  const [selected, setSelected] = useState('all')
  const [groupBy,  setGroupBy]  = useState('monthly')
  const [exporting, setExporting] = useState(false)
  const isMobile = useIsMobile()

  // Reset selection when view mode changes
  useEffect(() => { setSelected('all') }, [viewMode])

  const isPoc = viewMode === 'poc'

  // All POC names in this sheet's data
  const allPocs = useMemo(() => getAllPocs(data), [data])
  const allSpecialists = useMemo(() => getAllSpecialists(data), [data])

  // Filtered data based on selected specialist or POC
  const filtered = useMemo(() => {
    if (selected === 'all') return data
    return isPoc
      ? data.filter(r => r.poc === selected)
      : data.filter(r => r.specialist === selected)
  }, [data, selected, isPoc])

  // Counts for pills
  const pillCounts = useMemo(() => {
    const c = {}
    if (!isPoc) {
      data.forEach(r => { c[r.specialist] = (c[r.specialist] || 0) + 1 })
    } else {
      // Dedup by rowId to avoid multi-specialist inflation
      const seen = new Set()
      data.forEach(r => {
        if (seen.has(r.rowId)) return
        seen.add(r.rowId)
        if (r.poc && r.poc !== 'Unknown') c[r.poc] = (c[r.poc] || 0) + 1
      })
    }
    return c
  }, [data, isPoc])

  // Charts data
  const barData      = useMemo(() => isPoc ? getPocBarData(filtered)     : getSpecialistBarData(filtered), [filtered, isPoc])
  const pieData      = useMemo(() => isPoc ? getPocPieData(filtered)     : getPieData(filtered),           [filtered, isPoc])
  const trend        = useMemo(() => getTimeSeriesData(filtered, groupBy),                                  [filtered, groupBy])
  const topAccounts  = useMemo(() => getAccountFrequencyData(filtered, 10),                                 [filtered])
  const pocBreakdown = useMemo(() => !isPoc ? getSpecialistPocBreakdown(filtered) : null,                   [filtered, isPoc])

  const uniqueAccounts = useMemo(() => getUniqueAccountCount(filtered), [filtered])
  const uniqueRecords = useMemo(() => {
    const seen = new Set(); filtered.forEach(r => seen.add(r.rowId)); return seen.size
  }, [filtered])
  const avgTimeDays = useMemo(() => getAverageTimeTaken(filtered), [filtered])
  const activePeriods = trend.length
  // Cap how many x-axis ticks render so labels never overlap, regardless of how
  // many periods are in the trend (a dense weekly series can span 100+ points).
  const trendTickInterval = Math.max(0, Math.ceil(trend.length / (isMobile ? 5 : 10)) - 1)

  const areaColor = isPoc
    ? (selected === 'all' ? POC_PALETTE[0] : getPocColor(selected, allPocs))
    : (selected === 'all' ? '#818cf8' : getSpecialistColor(selected, allSpecialists))

  const noData = (msg) => <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>{msg}</p>

  const getColor = (name) => isPoc ? getPocColor(name, allPocs) : getSpecialistColor(name, allSpecialists)
  const modeLabel = isPoc ? 'Implementation POC' : 'Implementation Specialist'
  const selectionLabel = selected === 'all' ? 'All' : selected
  const fileParts = [sheetName, viewMode, selected === 'all' ? 'all-selection' : selected]

  const exportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { doc, y: y0 } = newReport(`${displaySheet(sheetName)} Full Report`, `${modeLabel} view · Selection: ${selectionLabel}`)
      let y = y0

      const kpiCards = [
        { label: 'Records', value: uniqueRecords.toLocaleString(), color: areaColor },
        { label: 'Unique Accounts', value: uniqueAccounts.toLocaleString(), color: '#38bdf8' },
        { label: 'Active Periods', value: activePeriods, color: '#34d399' },
      ]
      kpiCards.push(!isPoc
        ? { label: 'Avg Time / Account', value: avgTimeDays == null ? 'N/A' : `${avgTimeDays.toFixed(1)}d`, color: '#fbbf24' }
        : { label: 'Avg / Period', value: activePeriods ? Math.round(uniqueRecords / activePeriods) : 0, color: '#fbbf24' })
      y = sectionTitle(doc, y, 'Overview', kpiGridHeight(kpiCards))
      y = kpiGrid(doc, y, kpiCards)

      if (selected === 'all') {
        const barCanvas = barChartCanvas(barData, getColor)
        const barRows = barData.map(({ name, count }) => [name, count, uniqueRecords ? `${Math.round((count / uniqueRecords) * 100)}%` : '0%'])
        y = sectionTitle(doc, y + 2, isPoc ? 'Accounts per POC' : 'Accounts per Specialist', imageHeightMM(doc, barCanvas) + tableReserve(barRows.length))
        y = addImageBlock(doc, y, barCanvas)
        y = table(doc, y, [isPoc ? 'POC' : 'Specialist', 'Count', 'Share'], barRows)

        const pieCanvas = pieChartCanvas(pieData, getColor)
        y = sectionTitle(doc, y + 2, 'Distribution', imageHeightMM(doc, pieCanvas))
        y = addImageBlock(doc, y, pieCanvas)
      }

      for (const g of GROUPBYS) {
        const groupTrend = getTimeSeriesData(filtered, g.key)
        const trendCanvas = lineChartCanvas(groupTrend, areaColor)
        const trendRows = groupTrend.map((t) => [t.period, t.total])
        y = sectionTitle(doc, y + 2, `Over Time by ${g.label}`, imageHeightMM(doc, trendCanvas) + tableReserve(trendRows.length))
        y = addImageBlock(doc, y, trendCanvas)
        y = table(doc, y, ['Period', 'Total'], trendRows)
      }

      const topCanvas = barChartCanvas(topAccounts.map((a) => ({ name: a.account, count: a.count })), () => areaColor)
      const topRows = topAccounts.map((a) => [a.account, a.count])
      y = sectionTitle(doc, y + 2, 'Top Accounts', imageHeightMM(doc, topCanvas) + tableReserve(topRows.length))
      y = addImageBlock(doc, y, topCanvas)
      y = table(doc, y, ['Account', 'Count'], topRows)

      if (!isPoc && pocBreakdown && Object.keys(pocBreakdown).length > 0) {
        const pocRows = allSpecialists
          .filter((s) => pocBreakdown[s]?.length)
          .flatMap((spec) => pocBreakdown[spec].map(({ poc, count }) => [spec, poc, count]))
        y = sectionTitle(doc, y + 2, 'POC Collaborators by Specialist', tableReserve(pocRows.length))
        y = table(doc, y, ['Specialist', 'POC', 'Count'], pocRows)
      }

      // const rows = filtered.map(formatAnalyticsExportRow)
      // y = sectionTitle(doc, y + 2, `All Rows (${rows.length})`)
      // table(doc, y, ROW_COLUMNS.map(([, label]) => label), rows.map(r => ROW_COLUMNS.map(([key]) => r[key] ?? '')))

      downloadPdf(doc, buildExportFileName('implementation-analytics', [...fileParts, 'full-report']))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-5">

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl p-4 sm:p-5" style={glass}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/35">Downloads</p>
          <p className="text-sm text-white/50 mt-1">One PDF with every stat, chart (month/quarter/year/week) and record for this selection.</p>
        </div>
        <button onClick={exportPdf} disabled={exporting}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 border border-white/10 hover:bg-white/15 transition-colors disabled:opacity-50">
          {exporting ? 'Generating PDF…' : 'Download Analytics'}
        </button>
      </div>

      {/* ── Filter pills ── */}
      <div className="rounded-2xl p-4 sm:p-5" style={glass}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 12 }}>
          Filter by {isPoc ? 'Implementation POC' : 'Implementation Specialist'}
        </p>
        <div className="flex flex-wrap gap-2">
          <Pill name="All" count={isPoc
            ? (() => { const s=new Set(); data.forEach(r=>{if(!s.has(r.rowId))s.add(r.rowId)}); return s.size })()
            : uniqueRecords}
            selected={selected === 'all'} color={areaColor} onClick={() => setSelected('all')} />
          {isPoc
            ? allPocs.map(p => {
                const cnt = pillCounts[p] || 0
                if (!cnt) return null
                return <Pill key={p} name={p} count={cnt} selected={selected === p}
                  color={getPocColor(p, allPocs)} onClick={() => setSelected(p)} />
              })
            : allSpecialists.map(s => {
                const cnt = pillCounts[s] || 0
                if (!cnt) return null
                return <Pill key={s} name={s} count={cnt} selected={selected === s}
                  color={getSpecialistColor(s, allSpecialists)} onClick={() => setSelected(s)} />
              })
          }
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className={`grid gap-4 ${isPoc ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
        <StatCard label="Records"         value={uniqueRecords}   color={areaColor} />
        <StatCard label="Unique Accounts"  value={uniqueAccounts}  color="#38bdf8" />
        <StatCard label="Active Periods"   value={activePeriods}   color="#34d399" />
        {!isPoc && (
          <StatCard label="Avg Time / Account"
            value={avgTimeDays == null ? 0 : avgTimeDays.toFixed(1)}
            color="#fbbf24"
            sub={avgTimeDays == null ? 'No completed dates' : 'days'} />
        )}
        {isPoc && (
          <StatCard label="Avg / Period"
            value={activePeriods ? Math.round(uniqueRecords / activePeriods) : 0}
            color="#fbbf24" />
        )}
      </div>

      {/* ── Bar + Pie (all mode only) ── */}
      {selected === 'all' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <ChartCard title={isPoc ? 'Accounts per POC' : 'Accounts per Specialist'}>
              {barData.length === 0 ? noData('No data') : (
                  <ResponsiveContainer width="100%" height={Math.max(280, barData.length * 42)}>
                    <BarChart data={barData} layout="vertical" margin={{ top: 12, left: 4, right: isMobile ? 32 : 44, bottom: 12 }}>
                    <defs>
                      {barData.map(d => (
                        <linearGradient key={d.name} id={`bg-${d.name.replace(/\s/g,'-')}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%"   stopColor={getColor(d.name)} stopOpacity={1} />
                          <stop offset="100%" stopColor={getColor(d.name)} stopOpacity={0.45} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
                    <XAxis type="number" tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={isMobile ? 70 : 120}
                      tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false}
                      tickFormatter={isMobile ? truncateLabel(9) : undefined} />
                    <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} allowEscapeViewBox={{ x: false, y: true }} />
                    <Bar dataKey="count" name="Accounts" radius={[0, 8, 8, 0]}>
                      {barData.map(d => <Cell key={d.name} fill={`url(#bg-${d.name.replace(/\s/g,'-')})`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
          <div className="lg:col-span-2">
            <ChartCard title="Distribution">
              {pieData.length === 0 ? noData('No data') : (
                <ResponsiveContainer width="100%" height={Math.max(260, barData.length * 40)}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="44%" innerRadius={isMobile ? 44 : 56} outerRadius={isMobile ? 70 : 88}
                      paddingAngle={3} dataKey="value" stroke="none">
                      {pieData.map(d => <Cell key={d.name} fill={getColor(d.name)} />)}
                    </Pie>
                    <Tooltip content={<DarkTooltip />} allowEscapeViewBox={{ x: false, y: true }} />
                    <Legend iconType="circle" iconSize={8}
                      wrapperStyle={{ fontSize: 11, paddingTop: 10, color: 'rgba(255,255,255,0.55)' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </div>
      )}

      {/* ── Area trend ── */}
      <ChartCard
        title={selected === 'all'
          ? (isPoc ? 'Activity Over Time (All POCs)' : 'Accounts Over Time')
          : `${selected} Over Time`}
        actions={
          <div className="flex gap-0.5 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {GROUPBYS.map(g => (
              <button key={g.key} onClick={() => setGroupBy(g.key)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
                style={groupBy === g.key
                  ? { background: 'rgba(255,255,255,0.14)', color: 'white' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.4)' }
                }>{g.label}</button>
            ))}
          </div>
        }
      >
        {trend.length === 0 ? noData('No data for the selected period.') : (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
            <AreaChart data={trend} margin={{ top: 12, left: 0, right: 10, bottom: 8 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={areaColor} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={areaColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: isMobile ? 9 : 10, fill: AXIS_COLOR }} axisLine={false} tickLine={false}
                interval={trendTickInterval} />
              <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} width={isMobile ? 28 : 36} />
              <Tooltip content={<DarkTooltip />} allowEscapeViewBox={{ x: false, y: true }} />
              <Area type="monotone" dataKey="total" name={selected === 'all' ? 'All' : selected}
                stroke={areaColor} fill="url(#areaFill)" isAnimationActive={false}
                strokeWidth={2.5} dot={false} activeDot={{ r: 4, strokeWidth: 0, fill: areaColor }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Top accounts ── */}
      <ChartCard title="Top Accounts">
        {topAccounts.length === 0 ? noData('No accounts found.') : (
          <ResponsiveContainer width="100%" height={Math.max(280, topAccounts.length * 42)}>
            <BarChart data={topAccounts} layout="vertical" margin={{ top: 12, left: 4, right: isMobile ? 28 : 44, bottom: 12 }}>
              <defs>
                <linearGradient id="accGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor={areaColor} stopOpacity={1} />
                  <stop offset="100%" stopColor={areaColor} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={GRID_COLOR} />
              <XAxis type="number" tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false} />
              <YAxis dataKey="account" type="category" width={isMobile ? 88 : 148}
                tick={{ fontSize: isMobile ? 10 : 11, fill: AXIS_COLOR }} axisLine={false} tickLine={false}
                tickFormatter={isMobile ? truncateLabel(11) : undefined} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} allowEscapeViewBox={{ x: false, y: true }} />
              <Bar dataKey="count" name="Count" fill="url(#accGrad)" radius={[0, 8, 8, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Specialist → POC breakdown (specialist mode only) ── */}
      {!isPoc && pocBreakdown && Object.keys(pocBreakdown).length > 0 && (
        <div className="rounded-2xl p-5" style={glass}>
          <p className="text-sm font-semibold text-white/80 mb-1">POC Collaborators by Specialist</p>
          <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Which Implementation POC each specialist worked with most
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allSpecialists.filter(s => pocBreakdown[s]?.length).map(spec => {
              const items = pocBreakdown[spec]
              const maxCount = items[0]?.count || 1
              const color = getSpecialistColor(spec, allSpecialists)
              return (
                <div key={spec} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>{spec}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map(({ poc, count }) => (
                      <div key={poc} className="flex items-center gap-2">
                        <span className="text-xs w-24 truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>{poc}</span>
                        <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full" style={{ width: `${(count/maxCount)*100}%`, background: color }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-5 text-right" style={{ color: 'rgba(255,255,255,0.7)' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
