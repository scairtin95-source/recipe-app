'use client'

import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Home() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [tags, setTags] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const parseRecipe = async () => {
    if (!url) { setMessage('Please enter a URL'); return }
    setParsing(true)
    const res = await fetch('/api/parse-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    const data = await res.json()
    if (data.title) setTitle(data.title)
    if (data.ingredients) setIngredients(data.ingredients)
    if (data.steps) setSteps(data.steps)
    setMessage('')
    setParsing(false)
  }

  const saveRecipe = async () => {
    if (!title) { setMessage('Please enter a title'); return }
    setSaving(true)
    const { error } = await supabase
      .from('recipes')
      .insert([{ title, ingredients, steps, tags, source_url: url }])
    if (error) {
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Recipe saved!')
      setUrl(''); setTitle(''); setIngredients(''); setSteps(''); setTags('')
    }
    setSaving(false)
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>My Recipe App</h1>
      <a href="/recipes">View all recipes →</a>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        <input type="text" placeholder="Recipe URL" value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} />
        <button onClick={parseRecipe} disabled={parsing}
          style={{ padding: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}>
          {parsing ? 'Parsing...' : 'Parse Recipe'}
        </button>
        <input type="text" placeholder="Title" value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} />
        <textarea placeholder="Ingredients" value={ingredients}
          onChange={(e) => setIngredients(e.target.value)}
          rows={5} style={{ padding: '0.5rem', fontSize: '1rem' }} />
        <textarea placeholder="Steps" value={steps}
          onChange={(e) => setSteps(e.target.value)}
          rows={8} style={{ padding: '0.5rem', fontSize: '1rem' }} />
        <input type="text" placeholder="Tags (e.g. breakfast, healthy)" value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ padding: '0.5rem', fontSize: '1rem' }} />
        <button onClick={saveRecipe} disabled={saving}
          style={{ padding: '0.5rem', fontSize: '1rem', cursor: 'pointer' }}>
          {saving ? 'Saving...' : 'Save Recipe'}
        </button>
        {message && <p>{message}</p>}
      </div>
    </main>
  )
}