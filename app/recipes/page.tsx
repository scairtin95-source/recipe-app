'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'

interface Recipe {
  id: string
  title: string
  source_url: string | null
  tags: string | null
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
        .select('id, title, source_url, tags')
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
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Recipes</h1>
        <Link href="/" style={{ padding: '0.5rem 1rem', borderRadius: 6, background: '#111', color: '#fff', textDecoration: 'none', fontSize: '0.9rem' }}>
          + Add recipe
        </Link>
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search by title or tag…"
        style={{ width: '100%', padding: '0.6rem 0.85rem', border: '1px solid #ccc', borderRadius: 6, marginBottom: '1.5rem', fontSize: '0.95rem' }}
      />

      {isLoading && <p style={{ color: '#666' }}>Loading recipes…</p>}
      {error && <p style={{ color: '#b91c1c' }}>Failed to load recipes: {error}</p>}
      {!isLoading && !error && recipes.length === 0 && <p style={{ color: '#666' }}>No recipes saved yet.</p>}
      {!isLoading && !error && recipes.length > 0 && filteredRecipes.length === 0 && (
        <p style={{ color: '#666' }}>No recipes match &ldquo;{searchQuery}&rdquo;.</p>
      )}

      {!isLoading && !error && filteredRecipes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
          {filteredRecipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`}
              style={{ display: 'block', padding: '1rem', border: '1px solid #e5e5e5', borderRadius: 8, textDecoration: 'none', color: 'inherit', background: '#fff' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {recipe.title || 'Untitled recipe'}
              </h2>
              {recipe.source_url && (
                <p style={{ fontSize: '0.8rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '0.5rem' }}>
                  {recipe.source_url}
                </p>
              )}
              {tagList(recipe.tags).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {tagList(recipe.tags).map((tag, index) => (
                    <span key={index} style={{ fontSize: '0.7rem', padding: '0.15rem 0.55rem', borderRadius: 999, background: '#f3f4f6', color: '#374151' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}