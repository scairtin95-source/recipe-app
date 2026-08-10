'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

function convertToImperial(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*ml/g, (_, n) => `${Math.round(parseFloat(n) * 0.034)} fl oz`)
    .replace(/(\d+(?:\.\d+)?)\s*l\b/g, (_, n) => `${Math.round(parseFloat(n) * 4.227)} cups`)
    .replace(/(\d+(?:\.\d+)?)\s*g\b/g, (_, n) => `${Math.round(parseFloat(n) * 0.035)} oz`)
    .replace(/(\d+(?:\.\d+)?)\s*kg/g, (_, n) => `${Math.round(parseFloat(n) * 2.205)} lbs`)
    .replace(/(\d+(?:\.\d+)?)\s*°C/g, (_, n) => `${Math.round(parseFloat(n) * 9/5 + 32)}°F`)
}

function tagList(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

export default function RecipePage() {
  const { id } = useParams()
  const [recipe, setRecipe] = useState<any>(null)
  const [imperial, setImperial] = useState(false)

  useEffect(() => {
    const fetchRecipe = async () => {
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single()
      setRecipe(data)
    }
    fetchRecipe()
  }, [id])

  if (!recipe) return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#888', fontFamily: 'Georgia, serif' }}>Loading…</p>
    </div>
  )

  const ingredients = parseList(recipe.ingredients)
  const steps = parseList(recipe.steps)

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <header style={{
        background: '#7c8c6e', padding: '1rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <a href="/recipes" style={{
          color: '#f7f5f0', textDecoration: 'none', fontSize: '0.95rem',
          fontFamily: 'system-ui, sans-serif'
        }}>
          ← Back to recipes
        </a>
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" style={{
            background: '#b85c3a', color: '#fff',
            padding: '0.4rem 1rem', borderRadius: 999,
            textDecoration: 'none', fontSize: '0.85rem',
            fontFamily: 'system-ui, sans-serif'
          }}>
            View original ↗
          </a>
        )}
      </header>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Image — contained, not full width */}
        {recipe.image && (
          <div style={{ width: '100%', height: 280, overflow: 'hidden', borderRadius: 16, marginBottom: '1.5rem', border: '1px solid #e0dbd2' }}>
            <img src={recipe.image} alt={recipe.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Title */}
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: '#2c2c2c', marginBottom: '0.75rem', lineHeight: 1.3 }}>
          {recipe.title}
        </h1>

        {/* Tags */}
        {tagList(recipe.tags).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
            {tagList(recipe.tags).map((tag, i) => (
              <span key={i} style={{
                fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: 999,
                background: '#e8e3da', color: '#5a6b4a',
                fontFamily: 'system-ui, sans-serif', fontWeight: 500
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Units toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontFamily: 'system-ui, sans-serif' }}>
          <span style={{ fontSize: '0.85rem', color: '#5a6b4a', fontWeight: 500 }}>Units:</span>
          <button
            onClick={() => setImperial(false)}
            style={{
              padding: '0.3rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 500,
              background: !imperial ? '#7c8c6e' : '#e8e3da',
              color: !imperial ? '#fff' : '#5a6b4a'
            }}>
            Metric
          </button>
          <button
            onClick={() => setImperial(true)}
            style={{
              padding: '0.3rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 500,
              background: imperial ? '#7c8c6e' : '#e8e3da',
              color: imperial ? '#fff' : '#5a6b4a'
            }}>
            Imperial
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

          {/* Ingredients */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', border: '1px solid #e0dbd2' }}>
            <h2 style={{
              fontSize: '0.85rem', fontWeight: 600, color: '#7c8c6e',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '1rem', fontFamily: 'system-ui, sans-serif', margin: '0 0 1rem'
            }}>
              Ingredients
            </h2>
            <ul style={{ margin: 0, padding: '0 0 0 1.2rem', listStyle: 'disc' }}>
              {ingredients.length > 0 ? ingredients.map((item, i) => (
                <li key={i} style={{ fontSize: '0.9rem', color: '#3c3c3c', lineHeight: 1.8, marginBottom: '0.25rem' }}>
                  {imperial ? convertToImperial(item) : item}
                </li>
              )) : <li style={{ color: '#888', fontSize: '0.9rem' }}>No ingredients saved.</li>}
            </ul>
          </div>

          {/* Method */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '1.5rem', border: '1px solid #e0dbd2' }}>
            <h2 style={{
              fontSize: '0.85rem', fontWeight: 600, color: '#7c8c6e',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '1rem', fontFamily: 'system-ui, sans-serif', margin: '0 0 1rem'
            }}>
              Method
            </h2>
            <ol style={{ margin: 0, padding: '0 0 0 1.5rem', listStyleType: 'decimal'  }}>
              {steps.length > 0 ? steps.map((step, i) => (
                <li key={i} style={{ fontSize: '0.9rem', color: '#3c3c3c', lineHeight: 1.8, marginBottom: '0.75rem' }}>
                  {imperial ? convertToImperial(step) : step}
                </li>
              )) : <li style={{ color: '#888', fontSize: '0.9rem' }}>No steps saved.</li>}
            </ol>
          </div>

        </div>
      </main>
    </div>
  )
}