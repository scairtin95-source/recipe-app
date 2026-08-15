import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request: Request) {
  const { title, ingredients } = await request.json()

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: `Suggest 2-4 short lowercase tags for this recipe, comma separated, no explanation. Examples of good tags: breakfast, dinner, dessert, healthy, quick, vegetarian, italian, mexican, chicken, pasta, soup, salad.

Title: ${title}
Ingredients: ${ingredients}

Respond with ONLY the comma separated tags, nothing else.`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    const tags = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : ''

    if (!tags) {
      console.error('suggest-tags: no usable text in Claude response', JSON.stringify(message))
    }

    return NextResponse.json({ tags })
  } catch (error) {
    console.error('Tag suggestion error:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ tags: '', debugError: errorMessage }, { status: 200 })
  }
}
