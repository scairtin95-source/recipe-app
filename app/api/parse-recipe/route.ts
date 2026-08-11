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
  image: string | null
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
      // JSON-LD recipes sometimes omit "image" even when a good one exists
      // elsewhere on the page, so fall back to meta/img scanning if needed.
      if (!fromJsonLd.image) {
        fromJsonLd.image = extractFallbackImage(html, parsedUrl)
      } else {
        fromJsonLd.image = resolveUrl(fromJsonLd.image, parsedUrl)
      }
      const translated = await translateIfNeeded(fromJsonLd)
      return NextResponse.json({ ...translated, image: fromJsonLd.image })
    }

    // 3. Fall back to Claude extraction from cleaned visible HTML for
    // title/ingredients/steps, but resolve the image ourselves from the
    // raw HTML (og:image / first large <img>) rather than asking the model.
    const image = extractFallbackImage(html, parsedUrl)

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

    let parsed: Omit<ParsedRecipe, 'image'>
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

    const translated = await translateIfNeeded(parsed)
    return NextResponse.json({ ...translated, image })
  } catch (err) {
    console.error('parse-recipe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Detects the language of the parsed recipe and translates title,
 * ingredients, and steps to English if needed. If already in English,
 * or if translation fails for any reason, returns the input unchanged.
 */
async function translateIfNeeded(
  parsed: Omit<ParsedRecipe, 'image'>
): Promise<Omit<ParsedRecipe, 'image'>> {
  if (!parsed.title && parsed.ingredients.length === 0 && parsed.steps.length === 0) {
    return parsed
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You will be given a recipe's title, ingredients, and steps as JSON. If the text is already in English, return it completely unchanged. If it is in any other language, translate title, ingredients, and steps into natural, accurate English, keeping quantities/units as-is. Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this shape:

{
  "title": string,
  "ingredients": string[],
  "steps": string[]
}

Input:
${JSON.stringify(parsed)}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return parsed

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')
    const translated = JSON.parse(raw)

    if (
      typeof translated.title === 'string' &&
      Array.isArray(translated.ingredients) &&
      Array.isArray(translated.steps)
    ) {
      return translated
    }
    return parsed
  } catch (err) {
    console.error('translateIfNeeded error:', err)
    return parsed
  }
}

/**
 * Scans all <script type="application/ld+json"> blocks on the page for a
 * schema.org Recipe object (handles @graph wrappers and arrays of objects
 * too) and normalizes it into { title, ingredients, steps, image }.
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
 * Converts a schema.org Recipe node into { title, ingredients, steps, image }.
 * Handles the common variations in how sites encode instructions
 * (plain strings, HowToStep objects, HowToSection groups) and images
 * (plain string, array of strings, single ImageObject, array of ImageObjects).
 */
function normalizeRecipeNode(node: Record<string, unknown>): ParsedRecipe | null {
  const title = typeof node.name === 'string' ? node.name : ''

  const ingredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient.filter((i): i is string => typeof i === 'string')
    : Array.isArray(node.ingredients)
    ? node.ingredients.filter((i): i is string => typeof i === 'string')
    : []

  const steps = extractInstructionSteps(node.recipeInstructions)
  const image = extractJsonLdImage(node.image)

  // Require at least a title or some ingredients/steps to consider this a real hit
  if (!title && ingredients.length === 0 && steps.length === 0) {
    return null
  }

  return { title, ingredients, steps, image }
}

/**
 * schema.org "image" is inconsistent across sites: it can be a plain URL
 * string, an array of URL strings, a single ImageObject ({ "@type":
 * "ImageObject", "url": "..." }), or an array of ImageObjects. This pulls
 * the first usable URL out of any of those shapes.
 */
function extractJsonLdImage(image: unknown): string | null {
  if (typeof image === 'string') {
    return image.trim() || null
  }

  if (Array.isArray(image)) {
    for (const item of image) {
      const url = extractJsonLdImage(item)
      if (url) return url
    }
    return null
  }

  if (image && typeof image === 'object') {
    const obj = image as Record<string, unknown>
    if (typeof obj.url === 'string') return obj.url.trim() || null
    if (typeof obj['@id'] === 'string') return obj['@id'].trim() || null
  }

  return null
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

/**
 * Fallback image discovery when JSON-LD has no usable image: checks
 * og:image / twitter:image meta tags first (most reliable signal for a
 * page's "main" image), then falls back to the first sufficiently large
 * <img> tag in the body as a last resort.
 */
function extractFallbackImage(html: string, pageUrl: URL): string | null {
  const metaPatterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ]

  for (const pattern of metaPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return resolveUrl(match[1], pageUrl)
    }
  }

  // Last resort: scan <img> tags for one that looks like real content
  // (has width/height attributes above a small icon threshold, or is
  // simply the first <img> with a src if no sizing info is present).
  const imgTags = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0])

  for (const tag of imgTags) {
    const srcMatch = tag.match(/\bsrc=["']([^"']+)["']/i)
    if (!srcMatch) continue

    const src = srcMatch[1]
    // Skip obvious non-content images
    if (/\b(logo|icon|sprite|avatar|pixel|spacer|tracking)\b/i.test(src)) continue

    const widthMatch = tag.match(/\bwidth=["']?(\d+)/i)
    const heightMatch = tag.match(/\bheight=["']?(\d+)/i)
    const width = widthMatch ? parseInt(widthMatch[1], 10) : null
    const height = heightMatch ? parseInt(heightMatch[1], 10) : null

    // If sizing is present, require it to be reasonably large (skip icons/thumbnails)
    if (width !== null && width < 200) continue
    if (height !== null && height < 200) continue

    return resolveUrl(src, pageUrl)
  }

  return null
}

/**
 * Resolves a possibly-relative image URL against the page's URL, and
 * leaves already-absolute URLs untouched.
 */
function resolveUrl(maybeRelativeUrl: string, pageUrl: URL): string | null {
  try {
    return new URL(maybeRelativeUrl, pageUrl).toString()
  } catch {
    return null
  }
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}