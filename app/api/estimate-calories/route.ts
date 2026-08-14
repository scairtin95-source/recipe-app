// app/api/estimate-calories/route.ts
import { NextRequest, NextResponse } from 'next/server'

interface StructuredIngredient {
  quantity: number | null
  unit: string | null
  item: string
  raw: string
  gramsPerUnit?: number | null
}

interface EstimateRequestBody {
  ingredients: StructuredIngredient[]
  servings: number | null
}

interface NutrientsPer100g {
  calories: number | null
  proteinG: number | null
  fatG: number | null
  carbsG: number | null
}

const USDA_API_KEY = process.env.USDA_API_KEY
const USDA_SEARCH_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'

// Converts a unit to grams. Weight units are exact; volume units assume
// roughly water-like density (1ml ≈ 1g) — imprecise for things like oil
// or flour, but a reasonable approximation for a labeled "estimate"
// feature rather than precise nutrition tracking.
const UNIT_TO_GRAMS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kilogram: 1000,
  oz: 28.35,
  ounce: 28.35,
  lb: 453.6,
  pound: 453.6,
  ml: 1,
  milliliter: 1,
  l: 1000,
  liter: 1000,
  tsp: 5,
  teaspoon: 5,
  tbsp: 15,
  tablespoon: 15,
  cup: 240,
}

// Last-resort fallback for legacy recipes parsed before gramsPerUnit
// existed. New recipes get a per-ingredient estimate from Claude instead
// (see parse-recipe's structureIngredients), which covers far more items
// than this short hardcoded list ever could.
const ITEM_DEFAULT_GRAMS: { pattern: RegExp; grams: number }[] = [
  { pattern: /\begg\b/i, grams: 50 },
  { pattern: /\bclove\b/i, grams: 3 },
  { pattern: /\bslice\b/i, grams: 30 },
  { pattern: /\bonion\b/i, grams: 110 },
  { pattern: /\blemon\b/i, grams: 60 },
  { pattern: /\blime\b/i, grams: 45 },
  { pattern: /\bpotato\b/i, grams: 170 },
  { pattern: /\btomato\b/i, grams: 120 },
  { pattern: /\bcarrot\b/i, grams: 60 },
  { pattern: /\bbanana\b/i, grams: 120 },
  { pattern: /\bapple\b/i, grams: 180 },
]

function resolveGrams(entry: StructuredIngredient): number | null {
  if (entry.quantity === null) return null

  if (entry.unit) {
    const key = entry.unit.toLowerCase().replace(/s$/, '').trim()
    const factor = UNIT_TO_GRAMS[key] ?? UNIT_TO_GRAMS[entry.unit.toLowerCase()]
    if (factor) return entry.quantity * factor
    return null // unrecognized unit — don't guess
  }

  // No unit — prefer the parser's own per-item estimate (covers far more
  // ingredients, and is generated per-recipe rather than a fixed list).
  if (entry.gramsPerUnit) {
    return entry.quantity * entry.gramsPerUnit
  }

  // Fallback for legacy recipes parsed before gramsPerUnit existed.
  for (const { pattern, grams } of ITEM_DEFAULT_GRAMS) {
    if (pattern.test(entry.item)) {
      return entry.quantity * grams
    }
  }

  return null
}

function findNutrientValue(nutrients: any[], name: string, requireUnit?: string): number | null {
  const match = nutrients.find(
    (n) =>
      n.nutrientName === name &&
      typeof n.value === 'number' &&
      (!requireUnit || n.unitName?.toUpperCase() === requireUnit.toUpperCase())
  )
  return match ? match.value : null
}

// The "item" field is written for human display (e.g. "wholemeal pasta
// (penne or mafalda work well)", "pesto or vegetarian alternative"), which
// makes a poor literal search query — parentheticals and "or X" branches
// confuse USDA's matching and can cause an otherwise-obvious ingredient to
// silently fail to match. This strips that noise down to the core food
// name before searching, without touching what's actually displayed to
// the person.
function simplifyForSearch(item: string): string {
  return item
    .replace(/\([^)]*\)/g, '') // drop parenthetical asides
    .split(/\bor\b/i)[0] // keep only the first option in "X or Y" alternatives
    .split(',')[0] // drop trailing descriptive clauses after a comma
    .replace(/\s+/g, ' ')
    .trim()
}

async function lookupNutrientsPer100g(item: string): Promise<NutrientsPer100g | null> {
  if (!USDA_API_KEY) return null

  try {
    const params = new URLSearchParams({
      query: item,
      api_key: USDA_API_KEY,
      pageSize: '3',
      dataType: 'Foundation,SR Legacy',
    })
    const res = await fetch(`${USDA_SEARCH_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null

    const json = await res.json()
    const foods = Array.isArray(json.foods) ? json.foods : []
    if (foods.length === 0) return null

    // Use the first result — USDA's search already ranks by relevance.
    const nutrients = foods[0].foodNutrients
    if (!Array.isArray(nutrients)) return null

    const calories = findNutrientValue(nutrients, 'Energy', 'KCAL')
    const proteinG = findNutrientValue(nutrients, 'Protein')
    const fatG = findNutrientValue(nutrients, 'Total lipid (fat)')
    const carbsG = findNutrientValue(nutrients, 'Carbohydrate, by difference')

    if (calories === null) return null // calories is the minimum bar for a "match"

    return { calories, proteinG, fatG, carbsG }
  } catch (err) {
    console.error('lookupNutrientsPer100g error:', item, err)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!USDA_API_KEY) {
      return NextResponse.json(
        { error: 'USDA_API_KEY is not configured on the server' },
        { status: 500 }
      )
    }

    const body: EstimateRequestBody = await request.json()
    const { ingredients, servings } = body

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ error: 'No ingredients provided' }, { status: 400 })
    }

    let totalCalories = 0
    let totalProteinG = 0
    let totalFatG = 0
    let totalCarbsG = 0
    let matchedCount = 0

    // Run lookups in parallel — a single recipe has at most a couple dozen
    // ingredients, well within USDA's rate limits for one request.
    const results = await Promise.all(
      ingredients.map(async (entry) => {
        const grams = resolveGrams(entry)
        if (grams === null) return null

        const nutrients = await lookupNutrientsPer100g(simplifyForSearch(entry.item))
        if (nutrients === null) return null

        const factor = grams / 100
        return {
          calories: nutrients.calories !== null ? nutrients.calories * factor : 0,
          proteinG: nutrients.proteinG !== null ? nutrients.proteinG * factor : 0,
          fatG: nutrients.fatG !== null ? nutrients.fatG * factor : 0,
          carbsG: nutrients.carbsG !== null ? nutrients.carbsG * factor : 0,
        }
      })
    )

    for (const r of results) {
      if (r !== null) {
        totalCalories += r.calories
        totalProteinG += r.proteinG
        totalFatG += r.fatG
        totalCarbsG += r.carbsG
        matchedCount++
      }
    }

    if (matchedCount === 0) {
      return NextResponse.json(
        {
          estimatedCaloriesPerServing: null,
          estimatedProteinGPerServing: null,
          estimatedFatGPerServing: null,
          estimatedCarbsGPerServing: null,
          matchedCount: 0,
          totalCount: ingredients.length,
          error: 'Could not confidently estimate nutrition for any ingredient in this recipe',
        },
        { status: 200 }
      )
    }

    const effectiveServings = servings && servings > 0 ? servings : 1

    return NextResponse.json({
      estimatedCaloriesPerServing: Math.round(totalCalories / effectiveServings),
      estimatedProteinGPerServing: Math.round(totalProteinG / effectiveServings),
      estimatedFatGPerServing: Math.round(totalFatG / effectiveServings),
      estimatedCarbsGPerServing: Math.round(totalCarbsG / effectiveServings),
      matchedCount,
      totalCount: ingredients.length,
      servingsUsed: effectiveServings,
      servingsWasKnown: !!(servings && servings > 0),
    })
  } catch (err) {
    console.error('estimate-calories error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}