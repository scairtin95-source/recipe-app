import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}

export async function POST(request: Request) {
  try {
    const { title, ingredients, steps } = await request.json()

    const parsedIngredients = parseList(ingredients)
    const parsedSteps = parseList(steps)

    if (!title && parsedIngredients.length === 0 && parsedSteps.length === 0) {
      return NextResponse.json({ changed: false })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You will be given a recipe's title, ingredients, and steps as JSON. If the text is already in English, respond with {"changed": false}. If it is in any other language, translate title, ingredients, and steps into natural, accurate English, keeping quantities/units as-is, and respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:

{"changed": true, "title": string, "ingredients": string[], "steps": string[]}

Input:
${JSON.stringify({ title, ingredients: parsedIngredients, steps: parsedSteps })}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ changed: false })
    }

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')
    const result = JSON.parse(raw)

    if (!result.changed) {
      return NextResponse.json({ changed: false })
    }

    if (
      typeof result.title === 'string' &&
      Array.isArray(result.ingredients) &&
      Array.isArray(result.steps)
    ) {
      return NextResponse.json({
        changed: true,
        title: result.title,
        ingredients: result.ingredients,
        steps: result.steps,
      })
    }

    return NextResponse.json({ changed: false })
  } catch (err) {
    console.error('translate-recipe error:', err)
    return NextResponse.json({ changed: false, error: 'Translation failed' }, { status: 500 })
  }
}