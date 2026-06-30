// Sheet display-name overrides
export const SHEET_DISPLAY = { 'Form Response 1': 'Non DSO' }
export const displaySheet = (name) => SHEET_DISPLAY[name] || name

const KNOWN = ['jabir', 'milan', 'achu', 'abishek', 'vismaya', 'karthik', 'sidhu']
export const ALL_SPECIALISTS = ['Jabir', 'Milan', 'Achu', 'Abishek', 'Vismaya', 'Karthik', 'Sidhu']
export const SPECIALIST_COLORS = {
  Jabir:'#818cf8', Milan:'#38bdf8', Achu:'#34d399', Abishek:'#fbbf24',
  Vismaya:'#f472b6', Karthik:'#a78bfa', Sidhu:'#fb923c', Unknown:'#475569',
}

export const POC_PALETTE = [
  '#f472b6','#34d399','#fbbf24','#38bdf8','#a78bfa',
  '#fb923c','#818cf8','#60a5fa','#4ade80','#facc15',
  '#e879f9','#2dd4bf','#f87171','#c084fc','#86efac',
]
export function getPocColor(name, allPocs) {
  const i = allPocs.indexOf(name)
  return i >= 0 ? POC_PALETTE[i % POC_PALETTE.length] : '#475569'
}

// Scan a cell for ALL known specialist names
function extractSpecialists(raw) {
  if (!raw) return ['Unknown']
  const lower = raw.toLowerCase()
  const found = KNOWN.filter(s => lower.includes(s))
  if (found.length === 0) return ['Unknown']
  return found.map(s => s.charAt(0).toUpperCase() + s.slice(1))
}

// ── Column detection ──────────────────────────────────────────────────────────

function detectColumns(headers) {
  const h = headers.map(x => (x || '').toLowerCase().trim())
  const find = (...patterns) => {
    for (const p of patterns) {
      const i = h.findIndex(x => x.includes(p))
      if (i !== -1) return headers[i]
    }
    return null
  }
  return {
    // 'poc' intentionally removed from specialist search so "Implementation POC" isn't grabbed here
    specialistCol: find('specialist', 'implementer', 'assigned', 'consultant') || find('name', 'user', 'person', 'owner') || headers[0],
    timestampCol:  find('timestamp', 'date', 'time', 'created', 'submitted', 'added') || headers[1],
    accountCol:    find('account', 'client', 'company', 'organization', 'customer') || headers[2],
    pocCol:        find('implementation poc', 'poc', 'requested by', 'requested') || null,
  }
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(str) {
  if (!str) return null
  const d = new Date(str)
  if (!isNaN(d.getTime())) return d
  const parts = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (parts) {
    const a = new Date(`${parts[3]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`)
    if (!isNaN(a.getTime())) return a
  }
  return null
}

function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── POC name normalization ────────────────────────────────────────────────────
// "asif", "Asif Ali", "ASIF ALI" → "Asif"
// "jayadev j", "Jayadev J", "JAYADEV" → "Jayadev"
// Uses first-word extraction so variants with suffixes merge automatically.

const NO_POC_VALS = new Set(['n/a', 'na', 'none', 'tbd', 'tba', '-', 'unknown', ''])

function normalizePoc(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  if (!trimmed) return 'Unknown'
  if (NO_POC_VALS.has(trimmed.toLowerCase())) return 'Unknown'
  const firstWord = trimmed.split(/\s+/)[0]
  return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase()
}

// ── Normalize ─────────────────────────────────────────────────────────────────
// One row per specialist — if a cell contains two names, both get credit.
// poc is always a single value (full cell trimmed).

export function normalizeAllData(rawData) {
  const rows = []
  for (const [sheetName, sheetData] of Object.entries(rawData)) {
    const { headers, rows: sheetRows } = sheetData
    if (!headers.length || !sheetRows.length) continue
    const { specialistCol, timestampCol, accountCol, pocCol } = detectColumns(headers)

    sheetRows.forEach((row, rowIdx) => {
      const date = parseDate(row[timestampCol])
      if (!date) return
      const account     = (row[accountCol]    || '').trim() || 'Unknown'
      const poc         = normalizePoc(pocCol ? (row[pocCol] || '') : '')
      const specialists = extractSpecialists((row[specialistCol] || '').trim())
      const rowId       = `${sheetName}||${rowIdx}`   // unique per original spreadsheet row

      for (const specialist of specialists) {
        rows.push({
          specialist, poc, date, account,
          sheet:   sheetName,
          rowId,
          year:    date.getFullYear(),
          month:   date.getMonth(),
          quarter: Math.floor(date.getMonth() / 3) + 1,
          week:    isoWeek(date),
        })
      }
    })
  }
  return rows
}

// ── Filters ───────────────────────────────────────────────────────────────────

export function filterByTime(data, filters) {
  return data.filter(r => {
    if (filters.period === 'year')    return r.year === filters.year
    if (filters.period === 'quarter') return r.year === filters.year && r.quarter === filters.quarter
    if (filters.period === 'month')   return r.year === filters.year && r.month === filters.month
    if (filters.period === 'week')    return r.year === filters.year && r.week === filters.week
    return true
  })
}

export function getAvailableYears(data) {
  return [...new Set(data.map(r => r.year))].sort((a, b) => a - b)
}

// ── Specialist aggregations ───────────────────────────────────────────────────

export function getSpecialistBarData(data) {
  const counts = {}
  data.forEach(r => { counts[r.specialist] = (counts[r.specialist] || 0) + 1 })
  return ALL_SPECIALISTS
    .filter(s => counts[s])
    .map(s => ({ name: s, count: counts[s] }))
    .sort((a, b) => b.count - a.count)
}

export function getPieData(data) {
  return getSpecialistBarData(data).map(d => ({ name: d.name, value: d.count }))
}

// For each specialist: which POCs they worked with and how many times.
// Dedup by specialist+rowId so a 2-specialist row counts once for each specialist.
export function getSpecialistPocBreakdown(data) {
  const seen = new Set()
  const result = {}
  data.forEach(r => {
    if (!r.specialist || r.specialist === 'Unknown') return
    const key = `${r.specialist}||${r.rowId}`
    if (seen.has(key)) return
    seen.add(key)
    if (!result[r.specialist]) result[r.specialist] = {}
    const poc = r.poc || 'Unknown'
    result[r.specialist][poc] = (result[r.specialist][poc] || 0) + 1
  })
  // Convert to sorted arrays
  const out = {}
  Object.entries(result).forEach(([spec, pocMap]) => {
    out[spec] = Object.entries(pocMap)
      .map(([poc, count]) => ({ poc, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  })
  return out
}

// ── POC aggregations ──────────────────────────────────────────────────────────

// All unique POC names present in data, sorted alphabetically
export function getAllPocs(data) {
  const s = new Set(data.map(r => r.poc).filter(p => p && p !== 'Unknown'))
  return [...s].sort()
}

// Count per POC, deduped by rowId (avoids double-counting multi-specialist rows)
export function getPocBarData(data) {
  const seen = new Set()
  const counts = {}
  data.forEach(r => {
    if (seen.has(r.rowId)) return
    seen.add(r.rowId)
    if (!r.poc || r.poc === 'Unknown') return
    counts[r.poc] = (counts[r.poc] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getPocPieData(data) {
  return getPocBarData(data).map(d => ({ name: d.name, value: d.count }))
}

// ── Time series ───────────────────────────────────────────────────────────────

function periodSort(groupBy) {
  return (a, b) => {
    if (groupBy === 'yearly') return Number(a.period) - Number(b.period)
    const yA = a.period.match(/\d{4}$/)?.[0], yB = b.period.match(/\d{4}$/)?.[0]
    if (yA !== yB) return Number(yA) - Number(yB)
    if (groupBy === 'monthly')   return MONTHS.indexOf(a.period.slice(0,3)) - MONTHS.indexOf(b.period.slice(0,3))
    if (groupBy === 'quarterly') return Number(a.period[1]) - Number(b.period[1])
    if (groupBy === 'weekly')    return Number(a.period.replace(/W(\d+).*/,'$1')) - Number(b.period.replace(/W(\d+).*/,'$1'))
    return 0
  }
}

export function getTimeSeriesData(data, groupBy) {
  const map = {}
  data.forEach(r => {
    let key
    if (groupBy === 'monthly')        key = `${MONTHS[r.month]} ${r.year}`
    else if (groupBy === 'quarterly') key = `Q${r.quarter} ${r.year}`
    else if (groupBy === 'yearly')    key = String(r.year)
    else if (groupBy === 'weekly')    key = `W${r.week} ${r.year}`
    if (!key) return
    if (!map[key]) map[key] = { period: key, total: 0 }
    map[key].total += 1
  })
  return Object.values(map).sort(periodSort(groupBy))
}

// ── Account frequency ─────────────────────────────────────────────────────────

function extractRoot(raw) {
  let n = raw.trim()
  n = n.replace(/^IMPORTANT\s*[-:]\s*/i, '').trim()
  n = n.replace(/\s*:\s*.+$/, '').trim()
  n = n.replace(/\s+-\s+.+$/, '').trim()
  return n.replace(/\s+/g, ' ').trim()
}

function toKey(name) {
  return name.toLowerCase().replace(/\s+/g, '')
}

export function getAccountFrequencyData(data, limit = 10) {
  const eventSeen = new Set()
  const rootMap   = {}

  data.forEach(r => {
    if (!r.account || r.account === 'Unknown') return
    if (eventSeen.has(r.rowId)) return
    eventSeen.add(r.rowId)

    const root = extractRoot(r.account)
    const k    = toKey(root)
    if (!rootMap[k]) rootMap[k] = { display: root, count: 0 }
    rootMap[k].count += 1
  })

  const entries = Object.entries(rootMap)
    .map(([k, v]) => ({ k, ...v }))
    .sort((a, b) => a.k.length - b.k.length)

  const merged = {}
  entries.forEach(({ k, display, count }) => {
    const parentKey = Object.keys(merged).find(pk =>
      pk.length >= 5 && k.length > pk.length && k.startsWith(pk)
    )
    if (parentKey) merged[parentKey].count += count
    else merged[k] = { display, count }
  })

  return Object.values(merged)
    .map(({ display, count }) => ({ account: display, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}
