'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

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
    <div style={{ minHeight: '100vh', background: COLORS.neutral, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#8a8378', fontFamily: 'var(--font-manrope)' }}>Loading…</p>
    </div>
  )

  const ingredients = parseList(recipe.ingredients)
  const steps = parseList(recipe.steps)

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>

      {/* Header */}
      <header style={{
        background: COLORS.secondary, padding: '1.25rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <a href="/recipes" style={{
          color: COLORS.neutral, textDecoration: 'none', fontSize: '0.95rem',
          fontFamily: 'var(--font-manrope)'
        }}>
          ← Back to recipes
        </a>
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" style={{
            background: COLORS.primary, color: '#fff',
            padding: '0.4rem 1.1rem', borderRadius: 999,
            textDecoration: 'none', fontSize: '0.85rem',
            fontFamily: 'var(--font-manrope)'
          }}>
            View original ↗
          </a>
        )}
      </header>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '2.5rem 1rem' }}>

        {/* Image — contained, not full width */}
        {recipe.image && (
          <div style={{ width: '100%', height: 280, overflow: 'hidden', borderRadius: 16, marginBottom: '1.5rem', border: '1px solid #eee3d8' }}>
            <img src={recipe.image} alt={recipe.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontSize: '2rem', fontWeight: 600, color: '#2c2c2c', marginBottom: '0.75rem', lineHeight: 1.3,
          fontFamily: 'var(--font-newsreader)'
        }}>
          {recipe.title}
        </h1>

        {/* Tags */}
        {tagList(recipe.tags).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
            {tagList(recipe.tags).map((tag, i) => (
              <span key={i} style={{
                fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: 999,
                background: '#efe6d8', color: COLORS.tertiary,
                fontFamily: 'var(--font-manrope)', fontWeight: 500
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Units toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontFamily: 'var(--font-manrope)' }}>
          <span style={{ fontSize: '0.85rem', color: COLORS.secondary, fontWeight: 500 }}>Units:</span>
          <button
            onClick={() => setImperial(false)}
            style={{
              padding: '0.3rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 500,
              background: !imperial ? COLORS.secondary : '#efe6d8',
              color: !imperial ? '#fff' : COLORS.secondary
            }}>
            Metric
          </button>
          <button
            onClick={() => setImperial(true)}
            style={{
              padding: '0.3rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 500,
              background: imperial ? COLORS.secondary : '#efe6d8',
              color: imperial ? '#fff' : COLORS.secondary
            }}>
            Imperial
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

          {/* Ingredients */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #eee3d8' }}>
            <h2 style={{
              fontSize: '0.85rem', fontWeight: 600, color: COLORS.tertiary,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '1rem', fontFamily: 'var(--font-manrope)', margin: '0 0 1rem'
            }}>
              Ingredients
            </h2>
            <ul style={{ margin: 0, padding: '0 0 0 1.2rem', listStyle: 'disc' }}>
              {ingredients.length > 0 ? ingredients.map((item, i) => (
                <li key={i} style={{ fontSize: '0.9rem', color: '#3c3c3c', lineHeight: 1.8, marginBottom: '0.25rem' }}>
                  {imperial ? convertToImperial(item) : item}
                </li>
              )) : <li style={{ color: '#8a8378', fontSize: '0.9rem' }}>No ingredients saved.</li>}
            </ul>
          </div>

          {/* Method */}
          <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #eee3d8' }}>
            <h2 style={{
              fontSize: '0.85rem', fontWeight: 600, color: COLORS.tertiary,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '1rem', fontFamily: 'var(--font-manrope)', margin: '0 0 1rem'
            }}>
              Method
            </h2>
            <ol style={{ margin: 0, padding: '0 0 0 1.5rem', listStyleType: 'decimal' }}>
              {steps.length > 0 ? steps.map((step, i) => (
                <li key={i} style={{ fontSize: '0.9rem', color: '#3c3c3c', lineHeight: 1.8, marginBottom: '0.75rem' }}>
                  {imperial ? convertToImperial(step) : step}
                </li>
              )) : <li style={{ color: '#8a8378', fontSize: '0.9rem' }}>No steps saved.</li>}
            </ol>
          </div>

        </div>
      </main>
    </div>
  )
}