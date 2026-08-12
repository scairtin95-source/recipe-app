import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  try {
    const { craving, recipes } = await request.json()

    if (!craving || !Array.isArray(recipes) || recipes.length === 0) {
      return NextResponse.json({ ids: [] })
    }

    // Keep the prompt light — just titles and tags, not full ingredients/steps
    const recipeList = recipes.map((r: any) => ({ id: r.id, title: r.title, tags: r.tags }))

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `A person wants a recipe for: "${craving}"

Here is a list of their saved recipes (id, title, tags):
${JSON.stringify(recipeList)}

Pick up to 5 recipe ids that best match what they're craving. Respond with ONLY a JSON array of ids (no markdown fences, no commentary), e.g. [12, 45, 3]. If nothing matches well, respond with an empty array [].`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ ids: [] })
    }

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')
    const ids = JSON.parse(raw)

    if (!Array.isArray(ids)) {
      return NextResponse.json({ ids: [] })
    }

    return NextResponse.json({ ids })
  } catch (err) {
    console.error('craving-search error:', err)
    return NextResponse.json({ ids: [] }, { status: 500 })
  }
}