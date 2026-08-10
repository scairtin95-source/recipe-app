'use client'

import { useState } from 'react'
import { supabase } from '../src/lib/supabase'

export default function Home() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const saveRecipe = async () => {
    if (!url || !title) {
      setMessage('Please enter a URL and title')
      return
    }
    setSaving(true)
    const { error } = await supabase
      .from('recipes')
      .insert([{ url, title }])
   
    if (error) {
      setMessage('Error saving recipe: ' + error.message)
    } else {
      setMessage('Recipe saved!')
      setUrl('')
      setTitle('')
    }
    setSaving(false)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>My Recipe App</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input
          type="text"
          placeholder="Recipe URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        />
        <input
          type="text"
          placeholder="Recipe Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }}
        />
        <button
          onClick={saveRecipe}
          disabled={saving}
          style={{ padding: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}
        >
          {saving ? 'Saving...' : 'Save Recipe'}
        </button>
        {message && <p>{message}</p>}
      </div>
    </main>
  )
}