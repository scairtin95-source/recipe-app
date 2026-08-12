'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../../src/lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

interface Recipe {
  id: number
  title: string
  image: string | null
  tags: string | null
}

function tagList(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

export default function CollectionDetailPage() {
  const { id } = useParams()
  const [collectionName, setCollectionName] = useState('')
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setIsLoading(true)

      const { data: collection } = await supabase
        .from('collections')
        .select('name')
        .eq('id', id)
        .single()

      if (collection) setCollectionName(collection.name)

      const { data: links } = await supabase
        .from('collection_recipes')
        .select('recipe_id')
        .eq('collection_id', id)

      if (links && links.length > 0) {
        const recipeIds = links.map((l: any) => l.recipe_id)
        const { data: recipeData } = await supabase
          .from('recipes')
          .select('id, title, image, tags')
          .in('id', recipeIds)

        if (recipeData) setRecipes(recipeData)
      } else {
        setRecipes([])
      }

      setIsLoading(false)
    }
    load()
  }, [id])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1rem' }}>

        <Link href="/collections" style={{
          color: COLORS.primary, textDecoration: 'none', fontSize: '0.85rem',
          fontFamily: 'var(--font-manrope)', fontWeight: 600
        }}>
          ← All Collections
        </Link>

        <h1 style={{
          fontSize: '2rem', fontWeight: 600, color: '#2c2c2c', margin: '0.5rem 0 2rem',
          fontFamily: 'var(--font-newsreader)'
        }}>
          {collectionName || 'Collection'}
        </h1>

        {isLoading && <p style={{ color: '#8a8378', textAlign: 'center', padding: '3rem' }}>Loading…</p>}

        {!isLoading && recipes.length === 0 && (
          <p style={{ color: '#8a8378', textAlign: 'center', padding: '3rem' }}>
            No recipes in this collection yet. Add some from a recipe's page.
          </p>
        )}

        {!isLoading && recipes.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '1.5rem'
          }}>
            {recipes.map((recipe) => (
              <Link key={recipe.id} href={`/recipes/${recipe.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: '#fff', borderRadius: 16, overflow: 'hidden',
                  border: '1px solid #eee3d8', cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
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
                      fontSize: '1.15rem', fontWeight: 600, margin: 0,
                      fontFamily: 'var(--font-newsreader)', color: '#2c2c2c'
                    }}>
                      {recipe.title || 'Untitled recipe'}
                    </h2>
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