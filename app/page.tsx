'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../src/lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
}

interface Recipe {
  id: string
  title: string | null
  ingredients: string | null
  image: string | null
}

interface PantryItem {
  name: string
  have_it: boolean
}

const STOP_WORDS = new Set(['all', 'purpose', 'extra', 'virgin', 'fresh', 'ground', 'raw', 'whole'])

function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}

export default function Home() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [craving, setCraving] = useState('')

  useEffect(() => {
    async function load() {
      const { data: recipeData } = await supabase
        .from('recipes')
        .select('id, title, ingredients, image')
      const { data: pantryData } = await supabase
        .from('pantry_items')
        .select('name, have_it')

      if (recipeData) setRecipes(recipeData)
      if (pantryData) setPantryItems(pantryData)
      setIsLoading(false)
    }
    load()
  }, [])

  const haveItNames = useMemo(
    () => pantryItems.filter((p) => p.have_it).map((p) => p.name.toLowerCase()),
    [pantryItems]
  )

  // Build a flat set of significant words from every "have it" pantry item
  // (e.g. "Beef Chuck Steak" -> beef, chuck, steak), so a recipe ingredient
  // line matches if it contains ANY of those words, not just an exact phrase.
  const matches = useMemo(() => {
    const haveItWords = new Set<string>()
    haveItNames.forEach((name) => {
      name.split(/\s+/).forEach((word) => {
        const clean = word.replace(/[^a-z]/g, '')
        if (clean.length > 2 && !STOP_WORDS.has(clean)) haveItWords.add(clean)
      })
    })

    return recipes
      .map((recipe) => {
        const lines = parseList(recipe.ingredients)
        if (lines.length === 0) return { recipe, matchPct: 0, missingCount: 0, matchedCount: 0 }

        let matched = 0
        for (const line of lines) {
          const lower = line.toLowerCase()
          const found = Array.from(haveItWords).some((word) => {
            const pattern = new RegExp(`\\b${word}\\b`)
            return pattern.test(lower)
          })
          if (found) matched++
        }
        const matchPct = matched / lines.length
        return { recipe, matchPct, missingCount: lines.length - matched, matchedCount: matched }
      })
      .filter((m) => m.recipe.title)
  }, [recipes, haveItNames])

  const readyToCook = useMemo(
    () => matches.filter((m) => m.matchPct >= 0.5).sort((a, b) => b.matchPct - a.matchPct).slice(0, 3),
    [matches]
  )

  const almostThere = useMemo(
    () => matches.filter((m) => m.matchPct >= 0.3 && m.matchPct < 0.5)
      .sort((a, b) => b.matchPct - a.matchPct).slice(0, 2),
    [matches]
  )

  const pantryCount = pantryItems.filter((p) => p.have_it).length
  const matchPotential = pantryCount > 40 ? 'High' : pantryCount > 15 ? 'Medium' : 'Low'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        {/* Top row: craving box + pantry status */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem', marginBottom: '3rem' }}>

          <div style={{ background: '#eee7d9', borderRadius: 18, padding: '2rem' }}>
            <h1 style={{
              fontFamily: 'var(--font-newsreader)', fontSize: '1.8rem', fontWeight: 700,
              color: '#2c2c2c', margin: '0 0 0.5rem'
            }}>
              What are we craving today?
            </h1>
            <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
              Tell me what you're in the mood for, or just let me suggest something based on what's in your pantry.
            </p>
            <input
              type="text"
              placeholder="e.g., A quick pasta dish with tomatoes…"
              value={craving}
              onChange={(e) => setCraving(e.target.value)}
              style={{
                width: '100%', padding: '0.85rem 1.1rem', fontSize: '0.95rem',
                border: `1.5px solid ${COLORS.border}`, borderRadius: 12,
                outline: 'none', fontFamily: 'var(--font-manrope)',
                boxSizing: 'border-box', background: '#fff', marginBottom: '1rem'
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Try:
              </span>
              {['Quick & Easy', 'Vegetarian Comfort', 'Use Up Leftovers'].map((chip) => (
                <button key={chip} onClick={() => setCraving(chip)} style={{
                  padding: '0.4rem 0.9rem', borderRadius: 999, border: `1.5px solid ${COLORS.border}`,
                  background: '#fff', fontSize: '0.8rem', color: '#4a4a4a', cursor: 'pointer'
                }}>
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div style={{
            background: COLORS.secondary, borderRadius: 18, padding: '1.75rem', color: COLORS.neutral
          }}>
            <p style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.6rem' }}>
              🥫 Pantry Status
            </p>
            <p style={{ fontSize: '0.85rem', opacity: 0.9, lineHeight: 1.5, margin: '0 0 1.25rem' }}>
              You have {pantryCount} ingredients logged. {pantryCount === 0 ? 'Head to your Pantry to get started.' : "Here's what that unlocks."}
            </p>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: '0.9rem 1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem' }}>Recipe Match Potential</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{matchPotential}</span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: matchPotential === 'High' ? '85%' : matchPotential === 'Medium' ? '50%' : '20%',
                  background: COLORS.neutral
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Ready to Cook */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.5rem', fontWeight: 700, color: '#2c2c2c', margin: 0 }}>
              Ready to Cook
            </h2>
            <Link href="/recipes" style={{ fontSize: '0.85rem', color: COLORS.primary, textDecoration: 'none', fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <p style={{ color: '#8a8378', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            You have a good chunk of the ingredients for these recipes.
          </p>

          {isLoading && <p style={{ color: '#8a8378' }}>Loading…</p>}
          {!isLoading && readyToCook.length === 0 && (
            <p style={{ color: '#8a8378', fontSize: '0.9rem' }}>
              Toggle what you have in your <Link href="/pantry" style={{ color: COLORS.primary }}>Pantry</Link> to see matches here.
            </p>
          )}

          {!isLoading && readyToCook.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              {readyToCook.map(({ recipe, matchPct }) => (
                <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ height: 170, background: '#e8dcc4' }}>
                      {recipe.image && (
                        <img src={recipe.image} alt={recipe.title || ''}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ padding: '1rem' }}>
                      <p style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1rem', fontWeight: 700, color: '#2c2c2c', margin: '0 0 0.3rem' }}>
                        {recipe.title}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: COLORS.secondary, margin: 0, fontWeight: 600 }}>
                        {Math.round(matchPct * 100)}% match
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Almost There */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.5rem', fontWeight: 700, color: '#2c2c2c', margin: '0 0 0.25rem' }}>
            Almost There
          </h2>
          <p style={{ color: '#8a8378', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            A few more pantry items and these are within reach.
          </p>

          {!isLoading && almostThere.length === 0 && (
            <p style={{ color: '#8a8378', fontSize: '0.9rem' }}>Nothing this close right now — keep stocking your pantry!</p>
          )}

          {!isLoading && almostThere.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {almostThere.map(({ recipe, matchPct }) => (
                <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{ display: 'flex', gap: '1rem', background: '#fff', borderRadius: 16, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ width: 100, height: 100, flexShrink: 0, background: '#e8dcc4' }}>
                      {recipe.image && (
                        <img src={recipe.image} alt={recipe.title || ''}
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ padding: '0.9rem 1rem 0.9rem 0' }}>
                      <p style={{ fontFamily: 'var(--font-newsreader)', fontSize: '0.95rem', fontWeight: 700, color: '#2c2c2c', margin: '0 0 0.4rem' }}>
                        {recipe.title}
                      </p>
                      <span style={{
                        display: 'inline-block', fontSize: '0.75rem', color: COLORS.primary,
                        background: '#fbeae7', padding: '0.25rem 0.6rem', borderRadius: 6, fontWeight: 600
                      }}>
                        {Math.round(matchPct * 100)}% match
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  )
}