'use client'

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ImportPage() {
  const [status, setStatus] = useState('')
  const [importing, setImporting] = useState(false)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    setStatus('Reading file...')

    const text = await file.text()
    const lines = text.split('\n').filter(Boolean)
    const rows = lines.slice(1) // skip header

    let success = 0
    let failed = 0

    for (const line of rows) {
      const columns = line.split(',')
      const title = columns[0]?.replace(/"/g, '').trim()
      const url = columns[1]?.replace(/"/g, '').trim() ||
                  columns[2]?.replace(/"/g, '').trim() ||
                  columns[3]?.replace(/"/g, '').trim()

      if (!title || !url || !url.startsWith('http')) {
        failed++
        continue
      }

      setStatus(`Importing ${success + failed + 1} of ${rows.length}: ${title}`)

      try {
        // Try to parse the recipe via Claude API
        const res = await fetch('/api/parse-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        })
        const data = await res.json()

        const { error } = await supabase
          .from('recipes')
          .insert([{
            title: data.title || title,
            source_url: url,
            ingredients: data.ingredients || '',
            steps: data.steps || ''
          }])

        if (error) { failed++ } else { success++ }
      } catch {
        // If parsing fails, save with just title and URL
        const { error } = await supabase
          .from('recipes')
          .insert([{ title, source_url: url }])
        if (error) { failed++ } else { success++ }
      }
    }

    setStatus(`Done! ${success} recipes imported, ${failed} failed.`)
    setImporting(false)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Import from Google Sheets</h1>
      <p style={{ color: '#666', marginBottom: '1rem' }}>
        Upload your CSV file. Each recipe will be automatically parsed for ingredients and steps.
      </p>
      <p style={{ color: '#b45309', marginBottom: '1rem', fontSize: '0.9rem' }}>
        ⚠️ This may take several minutes depending on how many recipes you have.
      </p>
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        disabled={importing}
        style={{ marginBottom: '1rem' }}
      />
      {status && <p>{status}</p>}
      <br />
      <a href="/recipes" style={{ color: '#111' }}>← Back to recipes</a>
    </main>
  )
}