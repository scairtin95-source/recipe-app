// app/api/parse-recipe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ParsedRecipe {
  title: string
  ingredients: string[]
  steps: string[]
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'A valid "url" is required' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'URL must be http or https' }, { status: 400 })
    }

    // 1. Fetch the page HTML
    let html: string
    try {
      const pageRes = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; RecipeParserBot/1.0; +https://example.com/bot)',
        },
        signal: AbortSignal.timeout(15000),
      })

      if (!pageRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch URL (status ${pageRes.status})` },
          { status: 502 }
        )
      }
      html = await pageRes.text()
    } catch {
      return NextResponse.json({ error: 'Could not fetch the given URL' }, { status: 502 })
    }

    // 2. Try to find a Recipe object in JSON-LD structured data first
    const fromJsonLd = extractRecipeFromJsonLd(html)
    if (fromJsonLd) {
      return NextResponse.json(fromJsonLd)
    }

    // 3. Fall back to Claude extraction from cleaned visible HTML
    const cleanedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .slice(0, 50000)

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Extract the recipe from the HTML below and respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:

{
  "title": string,
  "ingredients": string[],
  "steps": string[]
}

Rules:
- "ingredients" should be one string per ingredient line, including quantities (e.g. "2 cups flour").
- "steps" should be one string per instruction step, in order.
- If no recipe can be found, respond with {"title": "", "ingredients": [], "steps": []}.

HTML:
${cleanedHtml}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json({ error: 'No response from model' }, { status: 502 })
    }

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')

    let parsed: ParsedRecipe
    try {
      parsed = JSON.parse(raw)
    } catch {
      return NextResponse.json({ error: 'Model returned invalid JSON', raw }, { status: 502 })
    }

    if (
      typeof parsed.title !== 'string' ||
      !Array.isArray(parsed.ingredients) ||
      !Array.isArray(parsed.steps)
    ) {
      return NextResponse.json(
        { error: 'Model response did not match expected shape', raw: parsed },
        { status: 502 }
      )
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('parse-recipe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Scans all <script type="application/ld+json"> blocks on the page for a
 * schema.org Recipe object (handles @graph wrappers and arrays of objects
 * too) and normalizes it into { title, ingredients, steps }.
 * Returns null if no usable Recipe JSON-LD is found.
 */
function extractRecipeFromJsonLd(html: string): ParsedRecipe | null {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    ),
  ].map((m) => m[1])

  for (const block of blocks) {
    let data: unknown
    try {
      data = JSON.parse(block.trim())
    } catch {
      continue // malformed JSON-LD block, skip it
    }

    const recipeNode = findRecipeNode(data)
    if (recipeNode) {
      const parsed = normalizeRecipeNode(recipeNode)
      if (parsed) return parsed
    }
  }

  return null
}

/**
 * Recursively searches a parsed JSON-LD payload for a node whose @type
 * includes "Recipe". Handles plain objects, arrays, and @graph wrappers.
 */
function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }

  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const type = obj['@type']
    const isRecipe =
      type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
    if (isRecipe) return obj

    if (obj['@graph']) {
      const found = findRecipeNode(obj['@graph'])
      if (found) return found
    }
  }

  return null
}

/**
 * Converts a schema.org Recipe node into { title, ingredients, steps }.
 * Handles the common variations in how sites encode instructions
 * (plain strings, HowToStep objects, HowToSection groups).
 */
function normalizeRecipeNode(node: Record<string, unknown>): ParsedRecipe | null {
  const title = typeof node.name === 'string' ? node.name : ''

  const ingredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient.filter((i): i is string => typeof i === 'string')
    : Array.isArray(node.ingredients)
    ? node.ingredients.filter((i): i is string => typeof i === 'string')
    : []

  const steps = extractInstructionSteps(node.recipeInstructions)

  // Require at least a title or some ingredients/steps to consider this a real hit
  if (!title && ingredients.length === 0 && steps.length === 0) {
    return null
  }

  return { title, ingredients, steps }
}

function extractInstructionSteps(instructions: unknown): string[] {
  if (typeof instructions === 'string') {
    // Some sites put the whole method as one HTML/plain-text blob
    return instructions
      .split(/\n+/)
      .map((s) => stripHtmlTags(s).trim())
      .filter(Boolean)
  }

  if (Array.isArray(instructions)) {
    const steps: string[] = []
    for (const item of instructions) {
      if (typeof item === 'string') {
        const text = stripHtmlTags(item).trim()
        if (text) steps.push(text)
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const type = obj['@type']

        if (type === 'HowToSection' && Array.isArray(obj.itemListElement)) {
          steps.push(...extractInstructionSteps(obj.itemListElement))
        } else if (typeof obj.text === 'string') {
          const text = stripHtmlTags(obj.text).trim()
          if (text) steps.push(text)
        } else if (typeof obj.name === 'string') {
          const text = stripHtmlTags(obj.name).trim()
          if (text) steps.push(text)
        }
      }
    }
    return steps
  }

  return []
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}