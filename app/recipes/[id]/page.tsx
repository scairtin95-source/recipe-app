'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'

export default function RecipePage() {
  const { id } = useParams()
  const [recipe, setRecipe] = useState<any>(null)

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

  if (!recipe) return <p style={{ padding: '2rem' }}>Loading...</p>

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <a href="/recipes">← Back to recipes</a>
      <h1>{recipe.title}</h1>
      <h2>Ingredients</h2>
      <p style={{ whiteSpace: 'pre-wrap' }}>{recipe.ingredients}</p>
      <h2>Steps</h2>
      <p style={{ whiteSpace: 'pre-wrap' }}>{recipe.steps}</p>
      <p><a href={recipe.source_url} target="_blank">View original</a></p>
    </main>
  )
}