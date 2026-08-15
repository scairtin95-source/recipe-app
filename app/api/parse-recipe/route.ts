// app/api/parse-recipe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { parseRecipeFromUrl } from '../../../src/lib/recipeParser'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A valid "url" is required' }, { status: 400 })
    }

    const result = await parseRecipeFromUrl(url)

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 502 })
    }

    return NextResponse.json(result.recipe)
  } catch (err) {
    console.error('parse-recipe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
