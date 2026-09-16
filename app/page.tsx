'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../src/lib/supabase'
import { useAuth } from '../src/lib/AuthContext'
import { useTranslation } from '../src/lib/i18n/LocaleContext'

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
  tags: string | null
  created_at?: string
}

function decodeHtmlEntities(text: string | null): string {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function RecipeImage({ src, alt, size = 32 }: { src: string | null; alt: string; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (!src || broken) {
    return (
      <img
        src="/oliva-icon.png"
        alt=""
        style={{ width: size, height: size, objectFit: 'contain', opacity: 0.5 }}
      />
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth < 150 || img.naturalHeight < 150) setBroken(true)
      }}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}

export default function Home() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [craving, setCraving] = useState('')
  const [searching, setSearching] = useState(false)
  const [cravingResults, setCravingResults] = useState<Recipe[] | null>(null)

  useEffect(() => {
    async function load() {
      // Logged in: RLS returns the user's own + group-shared recipes.
      // Logged out: RLS's select_showcase_recipes policy limits this to
      // only the handful of recipes explicitly flagged is_showcase = true.
      // created_at is fetched too so the logged-in default view can show
      // a small "Recently added" set instead of dumping the whole library.
      const { data: recipeData } = await supabase
        .from('recipes')
        .select('id, title, ingredients, image, tags, created_at')
        .order('created_at', { ascending: false })

      if (recipeData) setRecipes(recipeData)
      setIsLoading(false)
    }
    load()
  }, [user])

  const runCravingSearch = async () => {
    if (!craving.trim() || recipes.length === 0) return
    setSearching(true)
    setCravingResults(null)
    try {
      const res = await fetch('/api/craving-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ craving, recipes }),
      })
      const json = await res.json()
      const ids = new Set((json.ids || []).map((id: any) => String(id)))
      const results = recipes.filter((r) => ids.has(String(r.id)))
      setCravingResults(results)
    } catch (err) {
      console.error(err)
      setCravingResults([])
    }
    setSearching(false)
  }

  const clearCraving = () => {
    setCraving('')
    setCravingResults(null)
  }

  // Logged in with no active search: show a small recent set, not the
  // whole library (that's what /recipes is for). Logged out: RLS already
  // caps this to the handful of showcase recipes, so show all of those.
  const RECENT_COUNT = 6
  const showingRecent = !!user && cravingResults === null
  const displayedRecipes = cravingResults !== null
    ? cravingResults
    : showingRecent
      ? recipes.slice(0, RECENT_COUNT)
      : recipes

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main className="oliva-home-main" style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <div style={{ background: '#eee7d9', borderRadius: 18, padding: '2rem', marginBottom: '2.5rem' }}>
          <h1 style={{
            fontFamily: 'var(--font-newsreader)', fontSize: '1.8rem', fontWeight: 700,
            color: '#2c2c2c', margin: '0 0 0.5rem'
          }}>
            {t('homePage.cravingTitle')}
          </h1>
          <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
            {t('homePage.cravingSubtitle')}
          </p>
          <div className="oliva-craving-row" style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder={t('homePage.cravingPlaceholder')}
              value={craving}
              onChange={(e) => setCraving(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runCravingSearch()}
              style={{
                flex: 1, padding: '0.85rem 1.1rem', fontSize: '0.95rem',
                border: `1.5px solid ${COLORS.border}`, borderRadius: 12,
                outline: 'none', fontFamily: 'var(--font-manrope)',
                boxSizing: 'border-box', background: '#fff', minWidth: 0,
                color: '#2c2c2c',
              }}
            />
            <button
              onClick={runCravingSearch}
              disabled={searching || !craving.trim()}
              style={{
                padding: '0.85rem 1.4rem', borderRadius: 12, border: 'none',
                background: COLORS.secondary, color: '#fff', fontWeight: 600,
                fontSize: '0.9rem', cursor: 'pointer',
                opacity: (searching || !craving.trim()) ? 0.6 : 1, whiteSpace: 'nowrap'
              }}
            >
              {searching ? t('homePage.thinking') : t('homePage.suggest')}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {t('homePage.tryLabel')}
            </span>
            {[
              t('homePage.chipQuickEasy'),
              t('homePage.chipVegetarianComfort'),
              t('homePage.chipUseUpLeftovers'),
            ].map((chip) => (
              <button key={chip} onClick={() => setCraving(chip)} style={{
                padding: '0.4rem 0.9rem', borderRadius: 999, border: `1.5px solid ${COLORS.border}`,
                background: '#fff', fontSize: '0.8rem', color: '#4a4a4a', cursor: 'pointer'
              }}>
                {chip}
              </button>
            ))}
          </div>
        </div>

        {!user && (
          <div style={{
            background: '#fff', border: `1.5px solid ${COLORS.border}`, borderRadius: 14,
            padding: '1rem 1.25rem', marginBottom: '2rem', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem',
          }}>
            <p style={{ fontSize: '0.9rem', color: '#4a4a4a', margin: 0 }}>
              {t('homePage.signInPrompt')}
            </p>
            <Link href="/login" style={{
              padding: '0.5rem 1.1rem', borderRadius: 999, background: COLORS.primary,
              color: '#fff', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none',
            }}>
              {t('loginPage.signIn')}
            </Link>
          </div>
        )}

        {cravingResults !== null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.5rem', fontWeight: 700, color: '#2c2c2c', margin: 0 }}>
              {t('homePage.suggestionsFor')} "{craving}"
            </h2>
            <button onClick={clearCraving} style={{
              fontSize: '0.85rem', color: COLORS.primary, background: 'transparent',
              border: 'none', cursor: 'pointer', fontWeight: 600
            }}>
              {t('homePage.clear')}
            </button>
          </div>
        )}

        {showingRecent && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem' }}>
            <h2 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.5rem', fontWeight: 700, color: '#2c2c2c', margin: 0 }}>
              {t('homePage.recentlyAdded')}
            </h2>
            <Link href="/recipes" style={{ fontSize: '0.85rem', color: COLORS.primary, textDecoration: 'none', fontWeight: 600 }}>
              {t('homePage.viewAll')}
            </Link>
          </div>
        )}

        {isLoading && <p style={{ color: '#8a8378' }}>{t('homePage.loading')}</p>}

        {!isLoading && cravingResults !== null && cravingResults.length === 0 && (
          <p style={{ color: '#8a8378', fontSize: '0.9rem' }}>
            {t('homePage.noCravingMatchPrefix')} <Link href="/recipes" style={{ color: COLORS.primary }}>{t('homePage.allRecipesLink')}</Link>.
          </p>
        )}

        {!isLoading && displayedRecipes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {displayedRecipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
                  <div style={{ height: 170, background: '#e8dcc4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RecipeImage src={recipe.image} alt={decodeHtmlEntities(recipe.title)} />
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <p style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1rem', fontWeight: 700, color: '#2c2c2c', margin: 0 }}>
                      {decodeHtmlEntities(recipe.title)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>

      <style jsx>{`
        @media (max-width: 768px) {
          .oliva-home-main {
            padding: 1.5rem 1.25rem !important;
          }
          .oliva-craving-row {
            flex-direction: column !important;
          }
          .oliva-craving-row button {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  )
}