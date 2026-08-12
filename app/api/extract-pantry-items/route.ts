import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const CATEGORIES = [
  'Baking',
  'Spices & Herbs',
  'Oils & Vinegars',
  'Produce',
  'Meat & Seafood',
  'Cold Storage',
  'Pantry Staples',
]

export async function POST(request: Request) {
  try {
    const { ingredients } = await request.json()

    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: `You are given a list of recipe ingredient lines (with quantities). Extract the distinct base ingredient names (no quantities, no prep notes like "chopped" or "to taste"), normalize similar items to one name (e.g. "2 cloves garlic" and "1 garlic clove" both become "Garlic"), and assign each to exactly one of these categories: ${CATEGORIES.join(', ')}.

Respond with ONLY a JSON array (no markdown fences, no commentary) of objects shaped exactly like this:
[{"name": "Garlic", "category": "Produce"}]

Ingredient lines:
${JSON.stringify(ingredients)}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ items: [] })
    }

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')
    const items = JSON.parse(raw)

    if (!Array.isArray(items)) {
      return NextResponse.json({ items: [] })
    }

    const cleaned = items
      .filter((i) => typeof i.name === 'string' && typeof i.category === 'string')
      .map((i) => ({
        name: i.name.trim(),
        category: CATEGORIES.includes(i.category) ? i.category : 'Pantry Staples',
      }))

    return NextResponse.json({ items: cleaned })
  } catch (err) {
    console.error('extract-pantry-items error:', err)
    return NextResponse.json({ items: [] }, { status: 500 })
  }
}