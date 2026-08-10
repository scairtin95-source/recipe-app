'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

interface Recipe {
  id: string
  title: string
  source_url: string | null
  tags: string | null
  image: string | null
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

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

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return recipes
    return recipes.filter((recipe) => {
      const titleMatch = recipe.title?.toLowerCase().includes(query)
      const tagsMatch = recipe.tags?.toLowerCase().includes(query)
      return titleMatch || tagsMatch
    })
  }, [recipes, searchQuery])

  function tagList(tags: string | null): string[] {
    if (!tags) return []
    return tags.split(',').map((t) => t.trim()).filter(Boolean)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f5f0', fontFamily: 'Georgia, serif' }}>

      {/* Header */}
      <header style={{
        background: '#7c8c6e',
        padding: '1rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ color: '#f7f5f0', fontSize: '1.4rem', fontWeight: 700, margin: 0, letterSpacing: '0.02em' }}>
          🍴 My Recipes
        </h1>
        <Link href="/" style={{
          background: '#b85c3a', color: '#fff',
          padding: '0.5rem 1.2rem', borderRadius: 999,
          textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600,
          fontFamily: 'system-ui, sans-serif'
        }}>
          + Add Recipe
        </Link>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search recipes or tags…"
          style={{
            width: '100%', padding: '0.75rem 1rem', fontSize: '1rem',
            border: '1.5px solid #ddd8ce', borderRadius: 10,
            marginBottom: '2rem', background: '#fff',
            outline: 'none', boxSizing: 'border-box',
            fontFamily: 'system-ui, sans-serif', color: '#2c2c2c'
          }}
        />

        {isLoading && <p style={{ color: '#888', textAlign: 'center', padding: '3rem' }}>Loading your recipes…</p>}
        {error && <p style={{ color: '#b91c1c' }}>Failed to load recipes: {error}</p>}
        {!isLoading && !error && recipes.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', padding: '3rem' }}>No recipes saved yet. Add your first one!</p>
        )}
        {!isLoading && !error && recipes.length > 0 && filteredRecipes.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center' }}>No recipes match &ldquo;{searchQuery}&rdquo;.</p>
        )}

        {/* Grid */}
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
                    background: '#fff', borderRadius: 14, overflow: 'hidden',
                    border: '1px solid #e0dbd2',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                  }}
                >
                  {/* Image */}
                  <div style={{ width: '100%', height: 180, background: '#ede9e2', overflow: 'hidden' }}>
                    {recipe.image ? (
                      <img src={recipe.image} alt={recipe.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                        🍽️
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '1rem' }}>
                    <h2 style={{
                      fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem', margin: '0 0 0.5rem',
                      overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      fontFamily: 'Georgia, serif', color: '#2c2c2c'
                    }}>
                      {recipe.title || 'Untitled recipe'}
                    </h2>

                    {tagList(recipe.tags).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.6rem' }}>
                        {tagList(recipe.tags).map((tag, index) => (
                          <span key={index} style={{
                            fontSize: '0.7rem', padding: '0.2rem 0.6rem', borderRadius: 999,
                            background: '#e8e3da', color: '#5a6b4a',
                            fontFamily: 'system-ui, sans-serif', fontWeight: 500
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