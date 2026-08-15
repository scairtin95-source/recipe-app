// app/api/migrate-recipes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../src/lib/supabase'
import { parseRecipeFromUrl, restructureExisting } from '../../../src/lib/recipeParser'

interface RecipeRow {
  id: number
  title: string | null
  source_url: string | null
  ingredients: string | null
  steps: string | null
  image: string | null
}

// A recipe is "legacy" (not yet migrated) if its stored ingredients are a
// plain array of strings rather than the new structured object shape.
// Every recipe saved since the parser update stores structured objects,
// so this is an unambiguous signal — no separate DB flag needed.
function isLegacy(ingredientsRaw: string | null): boolean {
  if (!ingredientsRaw) return false // nothing to migrate
  try {
    const parsed = JSON.parse(ingredientsRaw)
    if (!Array.isArray(parsed) || parsed.length === 0) return false
    return typeof parsed[0] === 'string'
  } catch {
    return true // not valid JSON at all — legacy newline-separated text
  }
}

function parseLines(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit')) || 3, 10)

    const { data: allRecipes, error: fetchError } = await supabase
      .from('recipes')
      .select('id, title, source_url, ingredients, steps, image')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const rows = (allRecipes ?? []) as RecipeRow[]
    const candidates = rows.filter((r) => isLegacy(r.ingredients))
    const batch = candidates.slice(0, limit)

    const results: { id: number; title: string | null; status: 'ok' | 'error'; error?: string; usedSourceUrl: boolean }[] = []

    for (const recipe of batch) {
      try {
        if (recipe.source_url) {
          const result = await parseRecipeFromUrl(recipe.source_url)
          if (!result.ok) {
            results.push({ id: recipe.id, title: recipe.title, status: 'error', error: result.error, usedSourceUrl: true })
            continue
          }

          const update: Record<string, unknown> = {
            ingredients: JSON.stringify(result.recipe.ingredients),
            steps: JSON.stringify(result.recipe.steps),
            prep_time_minutes: result.recipe.prepTimeMinutes,
            cook_time_minutes: result.recipe.cookTimeMinutes,
            total_time_minutes: result.recipe.totalTimeMinutes,
            servings: result.recipe.servings,
          }
          // Only backfill the image if this recipe didn't already have one —
          // never clobber an existing photo with a re-parsed one.
          if (!recipe.image && result.recipe.image) {
            update.image = result.recipe.image
          }

          const { error: updateError } = await supabase.from('recipes').update(update).eq('id', recipe.id)
          if (updateError) {
            results.push({ id: recipe.id, title: recipe.title, status: 'error', error: updateError.message, usedSourceUrl: true })
          } else {
            results.push({ id: recipe.id, title: recipe.title, status: 'ok', usedSourceUrl: true })
          }
        } else {
          // No source URL to re-fetch (e.g. manually entered recipe) —
          // restructure whatever's already stored instead. Time/servings/
          // image can't be recovered this way, only ingredients/steps.
          const ingredientLines = parseLines(recipe.ingredients)
          const stepLines = parseLines(recipe.steps)
          const { ingredients, steps } = await restructureExisting(ingredientLines, stepLines)

          const { error: updateError } = await supabase
            .from('recipes')
            .update({ ingredients: JSON.stringify(ingredients), steps: JSON.stringify(steps) })
            .eq('id', recipe.id)

          if (updateError) {
            results.push({ id: recipe.id, title: recipe.title, status: 'error', error: updateError.message, usedSourceUrl: false })
          } else {
            results.push({ id: recipe.id, title: recipe.title, status: 'ok', usedSourceUrl: false })
          }
        }
      } catch (err) {
        results.push({
          id: recipe.id,
          title: recipe.title,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
          usedSourceUrl: !!recipe.source_url,
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
    console.error('migrate-recipes error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
