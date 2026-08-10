'use client'

import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function Home() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState('')
  const [steps, setSteps] = useState('')
  const [tags, setTags] = useState('')
  const [image, setImage] = useState('')
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
    if (data.image) setImage(data.image)
    setMessage('')
    setParsing(false)
  }

  const saveRecipe = async () => {
    if (!title) { setMessage('Please enter a title'); return }
    setSaving(true)
    const { error } = await supabase
      .from('recipes')
      .insert([{ title, ingredients, steps, tags, source_url: url, image }])
    if (error) {
      setMessage('Error saving: ' + error.message)
    } else {
      setMessage('Recipe saved!')
      setUrl(''); setTitle(''); setIngredients(''); setSteps(''); setTags(''); setImage('')
    }
    setSaving(false)
  }

  const inputStyle = {
    padding: '0.7rem 1rem', fontSize: '0.95rem',
    border: '1.5px solid #ddd8ce', borderRadius: 10,
    background: '#fff', outline: 'none',
    fontFamily: 'system-ui, sans-serif', color: '#2c2c2c',
    width: '100%', boxSizing: 'border-box' as const
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <header style={{
        background: '#7c8c6e', padding: '1rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h1 style={{ color: '#f7f5f0', fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>
          🍴 My Recipes
        </h1>
        <a href="/recipes" style={{
          color: '#f7f5f0', textDecoration: 'none', fontSize: '0.9rem',
          fontFamily: 'system-ui, sans-serif'
        }}>
          View all recipes →
        </a>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: '#2c2c2c', marginBottom: '1.5rem' }}>
          Add a recipe
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* URL + Parse */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <input
              type="text" placeholder="Paste a recipe URL…" value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={parseRecipe} disabled={parsing} style={{
              padding: '0.7rem 1.2rem', borderRadius: 10, border: 'none',
              background: '#7c8c6e', color: '#fff', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap', opacity: parsing ? 0.7 : 1
            }}>
              {parsing ? 'Parsing…' : 'Parse'}
            </button>
          </div>

          {/* Image preview */}
          {image && (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #e0dbd2', height: 200 }}>
              <img src={image} alt="Recipe preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* Title */}
          <input
            type="text" placeholder="Recipe title" value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />

          {/* Ingredients */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#7c8c6e', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'system-ui, sans-serif', display: 'block', marginBottom: '0.4rem' }}>
              Ingredients
            </label>
            <textarea
              placeholder="One ingredient per line…" value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              rows={6} style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>

          {/* Steps */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 500, color: '#7c8c6e', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'system-ui, sans-serif', display: 'block', marginBottom: '0.4rem' }}>
              Method
            </label>
            <textarea
              placeholder="One step per line…" value={steps}
              onChange={(e) => setSteps(e.target.value)}
              rows={8} style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>

          {/* Tags */}
          <input
            type="text" placeholder="Tags — e.g. breakfast, healthy, quick" value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={inputStyle}
          />

          {/* Save button */}
          <button onClick={saveRecipe} disabled={saving} style={{
            padding: '0.8rem', borderRadius: 10, border: 'none',
            background: '#b85c3a', color: '#fff', fontSize: '1rem',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            opacity: saving ? 0.7 : 1
          }}>
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>

          {/* Message */}
          {message && (
            <p style={{
              padding: '0.75rem 1rem', borderRadius: 8, margin: 0,
              background: message.includes('Error') ? '#fef2f0' : '#f0f5eb',
              color: message.includes('Error') ? '#b85c3a' : '#5a6b4a',
              fontFamily: 'system-ui, sans-serif', fontSize: '0.9rem'
            }}>
              {message}
            </p>
          )}

        </div>
      </main>
    </div>
  )
}