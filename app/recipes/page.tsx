'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../src/lib/supabase'

interface Recipe {
  id: string
  title: string
  source_url: string | null
  tags: string | null
  image: string | null
}

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])

  useEffect(() => {
    async function loadRecipes() {
      setIsLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, source_url, tags, image')
        .order('created_at', { ascending: false })
      if (error) {
        setError(error.message)
      } else {
        setRecipes(data ?? [])
      }
      setIsLoading(false)
    }
    loadRecipes()
  }, [])

  function tagList(tags: string | null): string[] {
    if (!tags) return []
    return tags.split(',').map((t) => t.trim()).filter(Boolean)
  }

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    recipes.forEach((recipe) => {
      tagList(recipe.tags).forEach((tag) => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [recipes])

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function clearTags() {
    setActiveTags([])
  }

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const activeTagsLower = activeTags.map((t) => t.toLowerCase())

    return recipes.filter((recipe) => {
      const titleMatch = recipe.title?.toLowerCase().includes(query)
      const tagsMatch = recipe.tags?.toLowerCase().includes(query)
      const passesSearch = !query || titleMatch || tagsMatch

      const recipeTagsLower = tagList(recipe.tags).map((t) => t.toLowerCase())
      const passesTagFilter =
        activeTagsLower.length === 0 ||
        activeTagsLower.every((tag) => recipeTagsLower.includes(tag))

      return passesSearch && passesTagFilter
    })
  }, [recipes, searchQuery, activeTags])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>

  

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search recipes or tags…"
          style={{
            width: '100%', padding: '0.75rem 1.1rem', fontSize: '1rem',
            border: '1.5px solid #e5ddd3', borderRadius: 12,
            marginBottom: '1rem', background: '#fff',
            outline: 'none', boxSizing: 'border-box',
            fontFamily: 'var(--font-manrope)', color: '#2c2c2c'
          }}
        />

        {allTags.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center'
            }}>
              {allTags.map((tag) => {
                const isActive = activeTags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.35rem 0.9rem',
                      borderRadius: 999,
                      border: isActive ? `1.5px solid ${COLORS.primary}` : '1.5px solid #e5ddd3',
                      background: isActive ? COLORS.primary : '#fff',
                      color: isActive ? '#fff' : COLORS.secondary,
                      fontFamily: 'var(--font-manrope)',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s'
                    }}
                  >
                    {tag}
                  </button>
                )
              })}
              {activeTags.length > 0 && (
                <button
                  onClick={clearTags}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.9rem',
                    borderRadius: 999,
                    border: 'none',
                    background: 'transparent',
                    color: COLORS.primary,
                    fontFamily: 'var(--font-manrope)',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading && <p style={{ color: '#8a8378', textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-manrope)' }}>Loading your recipes…</p>}
        {error && <p style={{ color: COLORS.primary }}>Failed to load recipes: {error}</p>}
        {!isLoading && !error && recipes.length === 0 && (
          <p style={{ color: '#8a8378', textAlign: 'center', padding: '3rem', fontFamily: 'var(--font-manrope)' }}>No recipes saved yet. Add your first one!</p>
        )}
        {!isLoading && !error && recipes.length > 0 && filteredRecipes.length === 0 && (
          <p style={{ color: '#8a8378', textAlign: 'center', fontFamily: 'var(--font-manrope)' }}>
            No recipes match{searchQuery ? ` "${searchQuery}"` : ''}{activeTags.length > 0 ? ` with the selected tags` : ''}.
          </p>
        )}

        {!isLoading && !error && filteredRecipes.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1.5rem'
          }}>
            {filteredRecipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div
                  style={{
                    background: '#fff', borderRadius: 16, overflow: 'hidden',
                    border: '1px solid #eee3d8',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 28px rgba(93,54,30,0.12)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                  }}
                >
                  <div style={{ width: '100%', height: 180, background: '#f1e9dd', overflow: 'hidden' }}>
                    {recipe.image ? (
                      <img src={recipe.image} alt={recipe.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                        🫒
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '1.1rem' }}>
                    <h2 style={{
                      fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem', margin: '0 0 0.5rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      fontFamily: 'var(--font-newsreader)', color: '#2c2c2c'
                    }}>
                      {recipe.title || 'Untitled recipe'}
                    </h2>

                    {tagList(recipe.tags).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.6rem' }}>
                        {tagList(recipe.tags).map((tag, index) => (
                          <span key={index} style={{
                            fontSize: '0.7rem', padding: '0.2rem 0.65rem', borderRadius: 999,
                            background: '#efe6d8', color: COLORS.tertiary,
                            fontFamily: 'var(--font-manrope)', fontWeight: 500
                          }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}