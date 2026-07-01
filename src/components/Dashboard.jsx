import { useState, useMemo } from 'react'
import FilterBar from './FilterBar'
import AllView from './AllView'
import SheetView from './SheetView'
import { normalizeAllData, getAvailableYears, filterByTime, displaySheet } from '../utils/dataProcessor'

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const BG = 'linear-gradient(140deg, #07091a 0%, #0f0a2e 40%, #090c20 100%)'
const HEADER_BG = 'linear-gradient(135deg, #3730a3 0%, #5b21b6 55%, #7c3aed 100%)'

export default function Dashboard({ rawData, onRefresh, lastSync }) {
  const allData = useMemo(() => normalizeAllData(rawData.data), [rawData])
  const sheets  = rawData.sheetTitles || []
  const years   = useMemo(() => getAvailableYears(allData), [allData])
  const uniqueEntries = useMemo(() => new Set(allData.map((row) => row.rowId)).size, [allData])

  const now = new Date()
  const [activeSheet, setActiveSheet] = useState('all')
  const [viewMode,    setViewMode]    = useState('specialist')   // 'specialist' | 'poc'
  const [filters, setFilters] = useState({
    period:  'all',
    year:    now.getFullYear(),
    quarter: Math.floor(now.getMonth() / 3) + 1,
    month:   now.getMonth(),
    week:    isoWeek(now),
  })

  const timeFiltered = useMemo(() => filterByTime(allData, filters), [allData, filters])
  const viewData     = useMemo(
    () => activeSheet === 'all' ? timeFiltered : timeFiltered.filter(r => r.sheet === activeSheet),
    [timeFiltered, activeSheet]
  )

  const tabs = [{ key: 'all', label: 'All Sheets' }, ...sheets.map(s => ({ key: s, label: displaySheet(s) }))]

  return (
    <div style={{ minHeight: '100vh', background: BG }}>

      {/* ── Header ── */}
      <header style={{ background: HEADER_BG }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          {/* Logo + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white leading-none tracking-tight truncate">Implementation Analytics</h1>
              <p className="text-indigo-300 text-xs mt-0.5 font-medium break-words">
                {uniqueEntries.toLocaleString()} entries · {sheets.length} sheets
              </p>
            </div>
          </div>

          {/* Last sync + refresh */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto lg:justify-end">
            {lastSync && (
              <span className="text-xs sm:text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle"
                  style={{ boxShadow: '0 0 5px #34d399' }} />
                synced {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl transition-all font-medium w-full sm:w-auto"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.75)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Sheet tabs — docked to bottom of header */}
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 mt-5 flex items-end gap-1 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSheet(tab.key)}
              className="px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-t-xl transition-all whitespace-nowrap flex-shrink-0"
              style={
                activeSheet === tab.key
                  ? { background: 'rgba(255,255,255,0.12)', color: 'white', borderBottom: '2px solid rgba(255,255,255,0.9)' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.45)', borderBottom: '2px solid transparent' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* ── Body ── */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-4">
        <FilterBar filters={filters} onUpdate={(k, v) => setFilters(p => ({ ...p, [k]: v }))} years={years} />

        {/* ── View mode toggle ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            View by
          </span>
          <div className="flex flex-wrap gap-0.5 p-1 rounded-xl w-fit max-w-full" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {[['specialist','Implementation Specialist'],['poc','Implementation POC']].map(([key, label]) => (
              <button key={key} onClick={() => setViewMode(key)}
                className="px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all"
                style={viewMode === key
                  ? { background: 'rgba(255,255,255,0.14)', color: 'white' }
                  : { background: 'transparent', color: 'rgba(255,255,255,0.4)' }
                }>
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeSheet === 'all'
          ? <AllView data={timeFiltered} sheets={sheets} viewMode={viewMode} />
          : <SheetView data={viewData} sheetName={activeSheet} viewMode={viewMode} />
        }
      </div>
    </div>
  )
}
