import { useState, useEffect, useRef } from 'react'
import Dashboard from './components/Dashboard'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const REFRESH_INTERVAL = 10_000  // 10 seconds

async function loadAllSheets() {
  // 1. Get sheet names
  const sheetNames = await fetch(`${API}/sheets`).then((r) => {
    if (!r.ok) throw new Error(`/sheets returned ${r.status}`)
    return r.json()
  })

  // 2. Fetch each sheet's raw 2-D values in parallel
  const results = await Promise.all(
    sheetNames.map((name) =>
      fetch(`${API}/data/${encodeURIComponent(name)}`).then((r) => {
        if (!r.ok) throw new Error(`/data/${name} returned ${r.status}`)
        return r.json()
      })
    )
  )

  // 3. Convert raw [[header,...], [val,...], ...] → { headers, rows } objects
  const data = {}
  sheetNames.forEach((name, i) => {
    const values = results[i] || []
    const headers = values[0] || []
    data[name] = {
      headers,
      rows: values.slice(1).map((row) => {
        const obj = {}
        headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? row[j] : '' })
        return obj
      }),
    }
  })

  return { sheetTitles: sheetNames, data }
}

export default function App() {
  const [rawData, setRawData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const fetchingRef = useRef(false)

  // Silent background fetch — no spinner, just swap data in
  const silentFetch = () => {
    if (fetchingRef.current) return
    fetchingRef.current = true
    loadAllSheets()
      .then((d) => { setRawData(d); setLastSync(new Date()) })
      .catch(() => { /* swallow background errors silently */ })
      .finally(() => { fetchingRef.current = false })
  }

  // Initial load (with spinner)
  const fetchData = () => {
    setLoading(true)
    setError(null)
    loadAllSheets()
      .then((d) => { setRawData(d); setLastSync(new Date()); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }

  useEffect(() => {
    fetchData()
    const id = setInterval(silentFetch, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading spreadsheet data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">Could not load data</h2>
          <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3 mb-6 font-mono break-all">{error}</p>
          <p className="text-slate-500 text-sm mb-4">
            Make sure the backend is running on port 5000 and{' '}
            <code className="bg-slate-100 px-1 rounded">service-account.json</code> exists in the Backend folder.
          </p>
          <button
            onClick={fetchData}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return <Dashboard rawData={rawData} onRefresh={fetchData} lastSync={lastSync} />
}
