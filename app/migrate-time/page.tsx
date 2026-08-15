'use client'

import { useRef, useState } from 'react'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
}

interface LogEntry {
  id: number
  title: string | null
  status: 'found' | 'still-none' | 'error'
  error?: string
}

export default function MigrateTimePage() {
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<LogEntry[]>([])
  const [remaining, setRemaining] = useState<number | null>(null)
  const [totalAtStart, setTotalAtStart] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const stopRef = useRef(false)

  const runBatch = async () => {
    const res = await fetch('/api/migrate-time?limit=10')
    const json = await res.json()
    if (json.error) throw new Error(json.error)
    setLog((prev) => [...prev, ...json.results])
    setRemaining(json.remainingCount)
    if (totalAtStart === null) setTotalAtStart(json.totalCandidatesAtStart)
    return json.remainingCount as number
  }

  const start = async () => {
    setRunning(true)
    setDone(false)
    stopRef.current = false
    try {
      let remainingCount = await runBatch()
      while (remainingCount > 0 && !stopRef.current) {
        await new Promise((r) => setTimeout(r, 500))
        remainingCount = await runBatch()
      }
      if (remainingCount === 0) setDone(true)
    } catch (err) {
      console.error('Time recheck error:', err)
    }
    setRunning(false)
  }

  const stop = () => {
    stopRef.current = true
  }

  const foundCount = log.filter((l) => l.status === 'found').length
  const stillNoneCount = log.filter((l) => l.status === 'still-none').length
  const errorCount = log.filter((l) => l.status === 'error').length
  const progressPct = totalAtStart ? Math.round(((totalAtStart - (remaining ?? totalAtStart)) / totalAtStart) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '3rem 1.5rem' }}>

        <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.8rem', fontWeight: 700, color: '#2c2c2c', margin: '0 0 0.5rem' }}>
          Re-check missing time
        </h1>
        <p style={{ color: '#8a8378', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          Re-examines already-stored ingredients and steps (no network fetch) for recipes with no prep/cook/total time recorded — catches ones missed before the time-extraction rule was improved.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <button
            onClick={start}
            disabled={running}
            style={{
              padding: '0.7rem 1.4rem', borderRadius: 10, border: 'none',
              background: COLORS.primary, color: '#fff', fontSize: '0.9rem',
              fontWeight: 600, cursor: running ? 'default' : 'pointer',
              opacity: running ? 0.6 : 1, fontFamily: 'var(--font-manrope)'
            }}
          >
            {running ? 'Checking…' : done ? 'Run again' : 'Start recheck'}
          </button>
          {running && (
            <button
              onClick={stop}
              style={{
                padding: '0.7rem 1.4rem', borderRadius: 10, border: '1.5px solid #e5ddd3',
                background: '#fff', color: '#5a5a5a', fontSize: '0.9rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)'
              }}
            >
              Stop after current batch
            </button>
          )}
        </div>

        {totalAtStart !== null && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: COLORS.secondary, marginBottom: '0.4rem' }}>
              <span>{totalAtStart - (remaining ?? 0)} of {totalAtStart} checked</span>
              <span>{foundCount} found time · {stillNoneCount} still none · {errorCount} errors</span>
            </div>
            <div style={{ height: 8, background: '#efe6d8', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: COLORS.secondary, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}

        {done && (
          <p style={{ color: COLORS.secondary, fontWeight: 600, fontSize: '0.9rem', marginBottom: '1rem' }}>
            Recheck complete.
          </p>
        )}

        {log.length > 0 && (
          <div style={{ background: '#fff', border: '1px solid #eee3d8', borderRadius: 12, padding: '0.5rem 0', maxHeight: 500, overflowY: 'auto' }}>
            {[...log].reverse().map((entry, i) => (
              <div key={`${entry.id}-${i}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.6rem 1rem', borderBottom: '1px solid #f1e9dd', fontSize: '0.85rem'
              }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: '1rem' }}>
                  <span style={{
                    color: entry.status === 'found' ? COLORS.secondary : entry.status === 'error' ? COLORS.primary : '#b0a89a',
                    fontWeight: 700, marginRight: '0.5rem'
                  }}>
                    {entry.status === 'found' ? '✓' : entry.status === 'error' ? '✕' : '—'}
                  </span>
                  {entry.title || `Recipe #${entry.id}`}
                </div>
                {entry.error && (
                  <span style={{ color: '#8a8378', fontSize: '0.75rem', flexShrink: 0 }}>{entry.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
