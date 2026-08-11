'use client'

import { useState } from 'react'
import { supabase } from './lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

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
    border: '1.5px solid #e5ddd3', borderRadius: 10,
    background: '#fff', outline: 'none',
    fontFamily: 'var(--font-manrope)', color: '#2c2c2c',
    width: '100%', boxSizing: 'border-box' as const
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>

      {/* Header */}
      <header style={{
        background: COLORS.secondary, padding: '1.25rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <h1 style={{
          color: COLORS.neutral, fontSize: '1.6rem', fontWeight: 600, margin: 0,
          fontFamily: 'var(--font-newsreader)', letterSpacing: '0.01em'
        }}>
          The Olive Table
        </h1>
        <a href="/recipes" style={{
          color: COLORS.neutral, textDecoration: 'none', fontSize: '0.9rem',
          fontFamily: 'var(--font-manrope)'
        }}>
          View all recipes →
        </a>
      </header>

      <main style={{ maxWidth: 640, margin: '0 auto', padding: '2.5rem 1rem' }}>

        <h2 style={{
          fontSize: '1.7rem', fontWeight: 600, color: '#2c2c2c', marginBottom: '1.5rem',
          fontFamily: 'var(--font-newsreader)'
        }}>
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
              padding: '0.7rem 1.3rem', borderRadius: 999, border: 'none',
              background: COLORS.secondary, color: '#fff', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
              whiteSpace: 'nowrap', opacity: parsing ? 0.7 : 1
            }}>
              {parsing ? 'Parsing…' : 'Parse'}
            </button>
          </div>

          {/* Image preview */}
          {image && (
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #eee3d8', height: 200 }}>
              <img src={image} alt="Recipe preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}

          {/* Title */}
          <input
            type="text" placeholder="Recipe title" value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ ...inputStyle, fontFamily: 'var(--font-newsreader)', fontSize: '1.1rem' }}
          />

          {/* Ingredients */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-manrope)', display: 'block', marginBottom: '0.4rem' }}>
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
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'var(--font-manrope)', display: 'block', marginBottom: '0.4rem' }}>
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
            padding: '0.85rem', borderRadius: 999, border: 'none',
            background: COLORS.primary, color: '#fff', fontSize: '1rem',
            fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
            opacity: saving ? 0.7 : 1
          }}>
            {saving ? 'Saving…' : 'Save Recipe'}
          </button>

          {/* Message */}
          {message && (
            <p style={{
              padding: '0.75rem 1rem', borderRadius: 10, margin: 0,
              background: message.includes('Error') ? '#fbeae7' : '#eef0e8',
              color: message.includes('Error') ? COLORS.primary : COLORS.secondary,
              fontFamily: 'var(--font-manrope)', fontSize: '0.9rem'
            }}>
              {message}
            </p>
          )}

        </div>
      </main>
    </div>
  )
}