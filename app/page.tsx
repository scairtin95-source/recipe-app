// app/page.tsx
'use client'

import { useState } from 'react'
import { supabase } from '../src/lib/supabase'

interface ParsedRecipe {
  title: string
  ingredients: string[]
  steps: string[]
}

export default function RecipeParserPage() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [ingredients, setIngredients] = useState<string[]>([])
  const [steps, setSteps] = useState<string[]>([])

  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const hasRecipe = title.length > 0 || ingredients.length > 0 || steps.length > 0

  async function handleParse() {
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    setIsParsing(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse recipe')
      }

      const parsed = data as ParsedRecipe
      setTitle(parsed.title)
      setIngredients(parsed.ingredients.length > 0 ? parsed.ingredients : [''])
      setSteps(parsed.steps.length > 0 ? parsed.steps : [''])

      if (!parsed.title && parsed.ingredients.length === 0) {
        setError('No recipe could be found on that page. Fields left blank for manual entry.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsParsing(false)
    }
  }

  function updateIngredient(index: number, value: string) {
    setIngredients((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index))
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, ''])
  }

  function updateStep(index: number, value: string) {
    setSteps((prev) => prev.map((item, i) => (i === index ? value : item)))
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index))
  }

  function addStep() {
    setSteps((prev) => [...prev, ''])
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('Please enter a title before saving')
      return
    }

    setIsSaving(true)
    setError(null)
    setSaveSuccess(false)

    try {
      const cleanedIngredients = ingredients.map((i) => i.trim()).filter(Boolean)
      const cleanedSteps = steps.map((s) => s.trim()).filter(Boolean)

      const { error: insertError } = await supabase.from('recipes').insert({
        title: title.trim(),
        ingredients: cleanedIngredients,
        steps: cleanedSteps,
        source_url: url.trim() || null,
      })

      if (insertError) {
        throw new Error(insertError.message)
      }

      setSaveSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
        Recipe Parser
      </h1>

      {/* URL input + Parse button */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/some-recipe"
          style={{
            flex: 1,
            padding: '0.5rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: 6,
          }}
        />
        <button
          onClick={handleParse}
          disabled={isParsing}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: 6,
            border: 'none',
            background: '#111',
            color: '#fff',
            cursor: isParsing ? 'not-allowed' : 'pointer',
            opacity: isParsing ? 0.6 : 1,
          }}
        >
          {isParsing ? 'Parsing…' : 'Parse Recipe'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#b91c1c', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</p>
      )}
      {saveSuccess && (
        <p style={{ color: '#15803d', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Recipe saved!
        </p>
      )}

      {hasRecipe && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                border: '1px solid #ccc',
                borderRadius: 6,
              }}
            />
          </div>

          {/* Ingredients */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
              Ingredients
            </label>
            {ingredients.map((ingredient, index) => (
              <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <input
                  type="text"
                  value={ingredient}
                  onChange={(e) => updateIngredient(index, e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                  }}
                />
                <button
                  onClick={() => removeIngredient(index)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                  aria-label={`Remove ingredient ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addIngredient}
              style={{
                padding: '0.4rem 0.75rem',
                border: '1px dashed #999',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              + Add ingredient
            </button>
          </div>

          {/* Steps */}
          <div>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
              Steps
            </label>
            {steps.map((step, index) => (
              <div
                key={index}
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}
              >
                <span style={{ padding: '0.5rem 0', fontSize: '0.85rem', color: '#666' }}>
                  {index + 1}.
                </span>
                <textarea
                  value={step}
                  onChange={(e) => updateStep(index, e.target.value)}
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    resize: 'vertical',
                  }}
                />
                <button
                  onClick={() => removeStep(index)}
                  style={{
                    padding: '0.4rem 0.6rem',
                    border: '1px solid #ccc',
                    borderRadius: 6,
                    background: '#fff',
                    cursor: 'pointer',
                  }}
                  aria-label={`Remove step ${index + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={addStep}
              style={{
                padding: '0.4rem 0.75rem',
                border: '1px dashed #999',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              + Add step
            </button>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: 6,
              border: 'none',
              background: '#15803d',
              color: '#fff',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              fontWeight: 600,
            }}
          >
            {isSaving ? 'Saving…' : 'Save Recipe'}
          </button>
        </div>
      )}
    </main>
  )
}