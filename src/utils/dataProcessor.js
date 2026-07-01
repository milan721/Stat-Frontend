// Sheet display-name overrides
export const SHEET_DISPLAY = {
  'form response 1':   'Non DSO',
  'form responses 1':  'Non DSO',
  'closed':            'Non DSO',
}
export const displaySheet = (name) => SHEET_DISPLAY[(name || '').trim().toLowerCase()] || name

export const ALL_SPECIALISTS = ['Jabir', 'Milan', 'Achu', 'Abishek', 'Vismaya', 'Karthik', 'Sidhu']
export const SPECIALIST_COLORS = {
  Jabir:'#818cf8', Milan:'#38bdf8', Achu:'#34d399', Abishek:'#fbbf24',
  Vismaya:'#f472b6', Karthik:'#a78bfa', Sidhu:'#fb923c', Unknown:'#475569',
}
const SPECIALIST_PALETTE = [
  '#818cf8','#38bdf8','#34d399','#fbbf24','#f472b6',
  '#a78bfa','#fb923c','#60a5fa','#4ade80','#facc15',
  '#e879f9','#2dd4bf','#f87171','#c084fc','#86efac',
]
const SPECIALIST_STOP_WORDS = new Set([
  'implementation', 'specialist', 'implementer', 'assigned', 'assignment',
  'owner', 'consultant', 'agent', 'user', 'person', 'support', 'team',
  'requested', 'request', 'by', 'unknown', '', 'na', 'n/a', 'none', 'tbd', 'tba', '-'
])

export const POC_PALETTE = [
  '#f472b6','#34d399','#fbbf24','#38bdf8','#a78bfa',
  '#fb923c','#818cf8','#60a5fa','#4ade80','#facc15',
  '#e879f9','#2dd4bf','#f87171','#c084fc','#86efac',
]
export function getPocColor(name, allPocs) {
  const i = allPocs.indexOf(name)
  return i >= 0 ? POC_PALETTE[i % POC_PALETTE.length] : '#475569'
}

export function getSpecialistColor(name, allSpecialists = []) {
  if (SPECIALIST_COLORS[name]) return SPECIALIST_COLORS[name]
  const i = allSpecialists.indexOf(name)
  return i >= 0 ? SPECIALIST_PALETTE[i % SPECIALIST_PALETTE.length] : '#475569'
}

function normalizeLabel(raw) {
  return (raw || '').trim().replace(/\s+/g, ' ')
}

function titleCaseName(raw) {
  return raw
    .split(' ')
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : '')
    .join(' ')
}

// Scan a cell for all specialist names, including names not hardcoded elsewhere.
function extractSpecialists(raw) {
  if (!raw) return ['Unknown']
  const cleaned = normalizeLabel(raw)
  if (!cleaned) return ['Unknown']

  const withoutPrefix = cleaned.replace(/^(?:implementation\s+)?(?:specialist|implementer|assigned|consultant|owner|agent|user|person)\s*[-:]\s*/i, '')
  const parts = withoutPrefix
    .split(/\s*(?:,|&|\/|;|\||\band\b|\s[-–—]\s)\s*/i)
    .map(part => normalizeLabel(part))
    .filter(Boolean)

  const out = []
  parts.forEach(part => {
    if (SPECIALIST_STOP_WORDS.has(part.toLowerCase())) return
    const titleCased = titleCaseName(part)
    if (!out.includes(titleCased)) out.push(titleCased)
  })

  return out.length ? out : ['Unknown']
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
    accountCol:    find('client name/account', 'client name/account name', 'client name / account', 'client name', 'account name', 'account', 'company', 'organization', 'customer') || headers[2],
    completionCol: find('completion date', 'completed date', 'complete date', 'closed date', 'resolved date', 'completion', 'completed', 'close date', 'resolution date') || null,
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
// Variants like "asif", "Asif Ali", "ASIF ALI" collapse to "Asif".
// Variants like "ancy", "ANCY P" collapse to "Ancy".

const NO_POC_VALS = new Set(['n/a', 'na', 'none', 'tbd', 'tba', '-', 'unknown', ''])

function normalizePoc(raw) {
  if (!raw) return 'Unknown'
  const trimmed = raw.trim()
  if (!trimmed) return 'Unknown'
  if (NO_POC_VALS.has(trimmed.toLowerCase())) return 'Unknown'
  const normalized = normalizeLabel(trimmed)
  const firstToken = normalized.split(' ')[0]
  return titleCaseName(firstToken)
}

// ── Normalize ─────────────────────────────────────────────────────────────────
// One row per specialist — if a cell contains two names, both get credit.
// poc is always a single value (full cell trimmed).

export function normalizeAllData(rawData) {
  const rows = []
  for (const [sheetName, sheetData] of Object.entries(rawData)) {
    const { headers, rows: sheetRows } = sheetData
    if (!headers.length || !sheetRows.length) continue
    const { specialistCol, timestampCol, accountCol, completionCol, pocCol } = detectColumns(headers)

    sheetRows.forEach((row, rowIdx) => {
      const date = parseDate(row[timestampCol])
      if (!date) return
      const account     = (row[accountCol]    || '').trim() || 'Unknown'
      const completionDate = completionCol ? parseDate(row[completionCol]) : null
      const poc         = normalizePoc(pocCol ? (row[pocCol] || '') : '')
      const specialists = extractSpecialists((row[specialistCol] || '').trim())
      const rowId       = `${sheetName}||${rowIdx}`   // unique per original spreadsheet row
      const durationDays = completionDate && completionDate >= date ? (completionDate - date) / 86400000 : null

      for (const specialist of specialists) {
        rows.push({
          specialist, poc, date, account,
          completionDate,
          durationDays,
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
  data.forEach(r => {
    if (!r.specialist || r.specialist === 'Unknown') return
    counts[r.specialist] = (counts[r.specialist] || 0) + 1
  })
  return Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function getAllSpecialists(data) {
  const names = new Set()
  data.forEach(r => {
    if (r.specialist && r.specialist !== 'Unknown') names.add(r.specialist)
  })
  return [...names].sort()
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

function isDsoAliasSheet(sheetName) {
  const name = (sheetName || '').toLowerCase()
  return name.includes('dso') || name.includes('support')
}

function normalizeAccountName(raw, sheetName) {
  const cleaned = (raw || '').trim().replace(/\s+/g, ' ')
  if (!cleaned) return 'Unknown'

  if (!isDsoAliasSheet(sheetName)) return cleaned

  const normalized = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
  const aliases = [
    { canonical: 'Paradigm', patterns: [/\bparadigm\b/] },
    { canonical: 'Espire Dental', patterns: [/\bespire\b/] },
    { canonical: 'Passion Dental', patterns: [/\bpassion\b/] },
    { canonical: 'Elite Dental Partners', patterns: [/\belite\b/, /\bdental partners\b/] },
    { canonical: 'Highfive', patterns: [/\bhigh\s*five\b/] },
    { canonical: 'Bebright', patterns: [/\bbe\s*bright\b/] },
    { canonical: 'Fuller Smiles', patterns: [/\bfuller\s*smiles\b/] },
  ]

  for (const { canonical, patterns } of aliases) {
    if (patterns.some((pattern) => pattern.test(normalized))) return canonical
  }

  return cleaned
}

function toKey(name) {
  return name.toLowerCase()
}

function buildAccountFrequencyMap(data) {
  const eventSeen = new Set()
  const accountMap = {}

  data.forEach(r => {
    if (!r.account || r.account === 'Unknown') return
    if (eventSeen.has(r.rowId)) return
    eventSeen.add(r.rowId)

    const name = normalizeAccountName(r.account, r.sheet)
    const k = toKey(name)
    if (!accountMap[k]) accountMap[k] = { display: name, count: 0 }
    accountMap[k].count += 1
  })

  return accountMap
}

export function getUniqueAccountCount(data) {
  return Object.keys(buildAccountFrequencyMap(data)).length
}

export function getAccountFrequencyData(data, limit = 10) {
  return Object.values(buildAccountFrequencyMap(data))
    .map(({ display, count }) => ({ account: display, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function formatTimeSeriesData(data, groupBy) {
  return getTimeSeriesData(data, groupBy).map(({ period, total }) => ({ period, count: total }))
}

export function getAverageTimeTaken(data) {
  const seen = new Set()
  let totalDays = 0
  let count = 0
  const MAX_REASONABLE_DURATION_DAYS = 365

  data.forEach(r => {
    if (!r.rowId || seen.has(r.rowId)) return
    seen.add(r.rowId)
    if (!r.completionDate) return
    if (typeof r.durationDays !== 'number' || Number.isNaN(r.durationDays)) return
    if (r.durationDays < 0 || r.durationDays > MAX_REASONABLE_DURATION_DAYS) return
    totalDays += r.durationDays
    count += 1
  })

  return count ? totalDays / count : null
}

export function getSpecialistDetail(data, specialist = 'all') {
  const filtered = specialist === 'all'
    ? data
    : data.filter(r => r.specialist === specialist)

  return {
    total: new Set(filtered.map(r => r.rowId)).size,
    accounts: getAccountFrequencyData(filtered, 20),
    monthly: formatTimeSeriesData(filtered, 'monthly'),
    quarterly: formatTimeSeriesData(filtered, 'quarterly'),
    yearly: formatTimeSeriesData(filtered, 'yearly'),
    weekly: formatTimeSeriesData(filtered, 'weekly'),
    avgTimeDays: getAverageTimeTaken(filtered),
  }
}

function csvEscape(value) {
  if (value == null) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function rowsToCsv(rows) {
  if (!rows?.length) return ''
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  const header = keys.map(csvEscape).join(',')
  const body = rows.map((row) => keys.map((key) => csvEscape(row[key])).join(',')).join('\n')
  return `${header}\n${body}`
}

function formatExportDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

export function formatAnalyticsExportRow(row) {
  return {
    sheet: displaySheet(row.sheet),
    rowId: row.rowId,
    specialist: row.specialist,
    poc: row.poc,
    account: row.account,
    timestamp: formatExportDate(row.date),
    completionDate: formatExportDate(row.completionDate),
    durationDays: row.durationDays == null ? '' : Number(row.durationDays.toFixed(2)),
    year: row.year,
    quarter: row.quarter,
    month: row.month + 1,
    week: row.week,
  }
}

function sanitizeFileNamePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function buildExportFileName(prefix, parts = []) {
  const cleanParts = [prefix, ...parts].map(sanitizeFileNamePart).filter(Boolean)
  return `${cleanParts.join('_') || 'export'}.csv`
}

export function downloadCsvFile(fileName, rows) {
  if (typeof document === 'undefined') return
  const csv = rowsToCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
