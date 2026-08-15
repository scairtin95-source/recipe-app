// app/api/migrate-time/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../src/lib/supabase'
import { recheckTimeFromText } from '../../../src/lib/recipeParser'

interface RecipeRow {
  id: number
  title: string | null
  ingredients: string | null
  steps: string | null
  prep_time_minutes: number | null
  cook_time_minutes: number | null
  total_time_minutes: number | null
}

function parseLines(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry) => {
          if (typeof entry === 'string') return entry
          if (entry && typeof entry === 'object') return entry.raw ?? entry.item ?? ''
          return ''
        })
        .filter(Boolean)
    }
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 10, 20)

    const { data: allRecipes, error: fetchError } = await supabase
      .from('recipes')
      .select('id, title, ingredients, steps, prep_time_minutes, cook_time_minutes, total_time_minutes')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const rows = (allRecipes ?? []) as RecipeRow[]
    // Candidates: no time data at all yet, and has steps worth checking.
    const candidates = rows.filter(
      (r) =>
        r.prep_time_minutes === null &&
        r.cook_time_minutes === null &&
        r.total_time_minutes === null &&
        parseLines(r.steps).length > 0
    )
    const batch = candidates.slice(0, limit)

    const results: { id: number; title: string | null; status: 'found' | 'still-none' | 'error'; error?: string }[] = []

    for (const recipe of batch) {
      try {
        const ingredientLines = parseLines(recipe.ingredients)
        const stepLines = parseLines(recipe.steps)
        const times = await recheckTimeFromText(ingredientLines, stepLines)

        const foundAny = times.prepTimeMinutes !== null || times.cookTimeMinutes !== null || times.totalTimeMinutes !== null

        if (foundAny) {
          const { error: updateError } = await supabase
            .from('recipes')
            .update({
              prep_time_minutes: times.prepTimeMinutes,
              cook_time_minutes: times.cookTimeMinutes,
              total_time_minutes: times.totalTimeMinutes,
            })
            .eq('id', recipe.id)

          if (updateError) {
            results.push({ id: recipe.id, title: recipe.title, status: 'error', error: updateError.message })
          } else {
            results.push({ id: recipe.id, title: recipe.title, status: 'found' })
          }
        } else {
          results.push({ id: recipe.id, title: recipe.title, status: 'still-none' })
        }
      } catch (err) {
        results.push({
          id: recipe.id,
          title: recipe.title,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }

    const remainingCount = candidates.length - batch.length

    return NextResponse.json({
      processedCount: batch.length,
      results,
      remainingCount,
      totalCandidatesAtStart: candidates.length,
    })
  } catch (err) {
    console.error('migrate-time error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
