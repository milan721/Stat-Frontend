const PERIODS = [
  { key: 'all',     label: 'All Time' },
  { key: 'year',    label: 'Year' },
  { key: 'quarter', label: 'Quarter' },
  { key: 'month',   label: 'Month' },
  { key: 'week',    label: 'Week' },
]
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const selectStyle = {
  background: 'rgba(255,255,255,0.07)',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.85)',
  borderRadius: 10,
  padding: '6px 12px',
  fontSize: 13,
  outline: 'none',
  cursor: 'pointer',
}

export default function FilterBar({ filters, onUpdate, years }) {
  return (
    <div
      className="flex flex-col lg:flex-row lg:flex-wrap lg:items-center gap-3 px-4 sm:px-5 py-3.5 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Period
      </span>

      {/* Period pills */}
      <div className="flex flex-wrap gap-0.5 p-1 rounded-xl w-fit max-w-full" style={{ background: 'rgba(0,0,0,0.25)' }}>
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => onUpdate('period', p.key)}
            className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all"
            style={
              filters.period === p.key
                ? { background: 'rgba(255,255,255,0.14)', color: 'white' }
                : { background: 'transparent', color: 'rgba(255,255,255,0.45)' }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Conditional dropdowns */}
      {filters.period !== 'all' && years.length > 0 && (
        <select className="w-full sm:w-auto" value={filters.year} onChange={e => onUpdate('year', Number(e.target.value))} style={selectStyle}>
          {years.map(y => <option key={y} value={y} style={{ background: '#1e1b4b' }}>{y}</option>)}
        </select>
      )}

      {filters.period === 'quarter' && (
        <select className="w-full sm:w-auto" value={filters.quarter} onChange={e => onUpdate('quarter', Number(e.target.value))} style={selectStyle}>
          {[1,2,3,4].map(q => <option key={q} value={q} style={{ background: '#1e1b4b' }}>Q{q}</option>)}
        </select>
      )}

      {filters.period === 'month' && (
        <select className="w-full sm:w-auto" value={filters.month} onChange={e => onUpdate('month', Number(e.target.value))} style={selectStyle}>
          {MONTHS.map((m, i) => <option key={i} value={i} style={{ background: '#1e1b4b' }}>{m}</option>)}
        </select>
      )}

      {filters.period === 'week' && (
        <select className="w-full sm:w-auto" value={filters.week} onChange={e => onUpdate('week', Number(e.target.value))} style={selectStyle}>
          {Array.from({ length: 52 }, (_, i) => (
            <option key={i+1} value={i+1} style={{ background: '#1e1b4b' }}>Week {i+1}</option>
          ))}
        </select>
      )}
    </div>
  )
}
