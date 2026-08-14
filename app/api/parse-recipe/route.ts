// app/api/parse-recipe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// The final shape returned to the client and saved to the DB.
interface StructuredIngredient {
  quantity: number | null
  unit: string | null
  item: string
  raw: string
  // Best-effort average weight (grams) of ONE unit of this ingredient,
  // populated only when "unit" is null and the item is a countable food
  // with a typical size (e.g. "6 chicken thighs" → ~120). Used by the
  // calorie estimator to convert count-based ingredients to grams without
  // needing a hardcoded lookup table.
  gramsPerUnit: number | null
}

interface ParsedRecipe {
  title: string
  ingredients: StructuredIngredient[]
  steps: string[]
  image: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  totalTimeMinutes: number | null
  servings: number | null
}

// Intermediate shape used while gathering data from JSON-LD or the Claude
// fallback — ingredients are still plain strings at this point, structured
// into StructuredIngredient[] only at the very end (see structureIngredients),
// so both extraction paths share one normalization step.
interface RawParsedRecipe {
  title: string
  ingredients: string[]
  steps: string[]
  image: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  totalTimeMinutes: number | null
  servings: number | null
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
      const [structuredIngredients, clarifiedSteps] = await Promise.all([
        structureIngredients(translated.ingredients),
        clarifyOvenTemperatures(translated.steps, translated.ingredients),
      ])
      return NextResponse.json({
        ...translated,
        ingredients: structuredIngredients,
        steps: clarifiedSteps,
        image: fromJsonLd.image,
      })
    }

    // 3. Fall back to Claude extraction from cleaned visible HTML for
    // title/ingredients/steps/time/servings, but resolve the image ourselves
    // from the raw HTML (og:image / first large <img>) rather than asking
    // the model.
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
  "steps": string[],
  "prepTimeMinutes": number | null,
  "cookTimeMinutes": number | null,
  "totalTimeMinutes": number | null,
  "servings": number | null
}

Rules:
- "ingredients" should be one string per ingredient line, including quantities (e.g. "2 cups flour").
- "steps" should be one string per instruction step, in order.
- "prepTimeMinutes", "cookTimeMinutes", "totalTimeMinutes" should be the total number of minutes ONLY if the page explicitly states them (e.g. "Prep: 15 min" → 15, "1 hr 30 min" → 90). Do not guess or estimate — use null if not explicitly stated.
- "servings" should be the number of servings/yield ONLY if explicitly stated (e.g. "Serves 4" → 4, "Makes 4-6 servings" → 4). Use null if not stated.
- If no recipe can be found, respond with {"title": "", "ingredients": [], "steps": [], "prepTimeMinutes": null, "cookTimeMinutes": null, "totalTimeMinutes": null, "servings": null}.

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

    let parsed: RawParsedRecipe
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
    const [structuredIngredients, clarifiedSteps] = await Promise.all([
      structureIngredients(translated.ingredients),
      clarifyOvenTemperatures(translated.steps, translated.ingredients),
    ])
    return NextResponse.json({
      ...translated,
      ingredients: structuredIngredients,
      steps: clarifiedSteps,
      image,
    })
  } catch (err) {
    console.error('parse-recipe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Detects the language of the parsed recipe and translates title,
 * ingredients, and steps to English if needed. If already in English,
 * or if translation fails for any reason, returns the input unchanged.
 * Time/servings fields are language-agnostic and passed through untouched.
 */
async function translateIfNeeded(parsed: RawParsedRecipe): Promise<RawParsedRecipe> {
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
${JSON.stringify({ title: parsed.title, ingredients: parsed.ingredients, steps: parsed.steps })}`,
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
      return { ...parsed, title: translated.title, ingredients: translated.ingredients, steps: translated.steps }
    }
    return parsed
  } catch (err) {
    console.error('translateIfNeeded error:', err)
    return parsed
  }
}

/**
 * Converts plain ingredient-line strings (e.g. "2 cups flour", "a pinch of
 * salt", "1/2 tsp vanilla extract") into structured { quantity, unit, item }
 * objects via Claude, since reliably parsing fractions, ranges, and vague
 * quantities ("to taste", "a handful of") with regex alone is not robust.
 * Also estimates a per-unit gram weight for count-based ingredients with no
 * unit (e.g. "6 chicken thighs"), used later for calorie estimation.
 * Lines that can't be cleanly split keep quantity/unit as null — the raw
 * text is always preserved so nothing is ever lost, just not convertible
 * between metric/imperial.
 */
async function structureIngredients(lines: string[]): Promise<StructuredIngredient[]> {
  if (lines.length === 0) return []

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Split each of the following ingredient lines into a structured object. Respond with ONLY a JSON array (no markdown fences, no commentary), one object per input line, in the same order, matching exactly this shape:

{
  "quantity": number | null,
  "unit": string | null,
  "item": string,
  "gramsPerUnit": number | null
}

Rules:
- "quantity" is a plain number (convert fractions like "1/2" to 0.5, "1 1/2" to 1.5). Use null if there's no clear numeric quantity (e.g. "a pinch of salt", "salt to taste").
- "unit" should be a short standard unit (g, kg, ml, l, tsp, tbsp, cup, oz, lb, clove, etc.) if present. Use null if there's no unit (e.g. "3 eggs" → quantity 3, unit null, item "eggs").
- "item" is just the ingredient name/description, without the quantity or unit (e.g. "2 cups flour" → item "flour"; "2 tbsp olive oil, plus extra for drizzling" → item "olive oil, plus extra for drizzling").
- "gramsPerUnit" is your best estimate of the average weight in grams of ONE unit of this ingredient — ONLY fill this in when "unit" is null AND the item is a countable food with a typical real-world size (e.g. "3 eggs" → gramsPerUnit ~50; "6 chicken thighs boneless and skinless" → gramsPerUnit ~120; "1 onion" → gramsPerUnit ~110; "2 cloves garlic" → gramsPerUnit ~3; "1 lemon" → gramsPerUnit ~60). Use null whenever "unit" is already set, or when there's no reasonable typical size (e.g. "salt to taste", "a bunch of parsley", "cooking spray").
- If a line can't be cleanly split (vague quantities, ranges, prep notes only), set quantity, unit, and gramsPerUnit to null and put the full original line as "item".

Ingredient lines:
${JSON.stringify(lines)}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return fallbackStructuredIngredients(lines)

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed) || parsed.length !== lines.length) {
      return fallbackStructuredIngredients(lines)
    }

    return parsed.map((entry, i) => ({
      quantity: typeof entry.quantity === 'number' ? entry.quantity : null,
      unit: typeof entry.unit === 'string' ? entry.unit : null,
      item: typeof entry.item === 'string' && entry.item ? entry.item : lines[i],
      raw: lines[i],
      gramsPerUnit: typeof entry.gramsPerUnit === 'number' ? entry.gramsPerUnit : null,
    }))
  } catch (err) {
    console.error('structureIngredients error:', err)
    return fallbackStructuredIngredients(lines)
  }
}

/**
 * Used if the structuring call fails outright — keeps ingredients fully
 * displayable (via "raw"/"item") even with no quantity/unit split, so a
 * flaky API call never loses data.
 */
function fallbackStructuredIngredients(lines: string[]): StructuredIngredient[] {
  return lines.map((line) => ({ quantity: null, unit: null, item: line, raw: line, gramsPerUnit: null }))
}

/**
 * Some sites state oven temperature as a bare number with no °C/°F
 * ("Heat oven to 200", "Bake at 425") — genuinely ambiguous. Rather than
 * guess blindly, this infers the unit from whichever measurement system
 * the rest of the recipe's ingredients use (grams/ml/kg → Celsius,
 * cups/oz/lb → Fahrenheit — a reliable signal in practice, since a recipe
 * rarely mixes systems for ingredients vs oven temp) and rewrites only
 * the ambiguous numbers with an explicit unit. Everything else in the
 * step text is left completely untouched. If the system can't be
 * confidently inferred, or the call fails, steps are returned unchanged
 * rather than risk mislabeling a temperature.
 */
async function clarifyOvenTemperatures(steps: string[], ingredients: string[]): Promise<string[]> {
  if (steps.length === 0) return steps

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Below are a recipe's ingredient lines and method steps. Some steps may mention an oven/grill temperature as a bare number with no unit (e.g. "Heat oven to 200", "Bake at 425"), which is ambiguous.

First, determine whether this recipe's ingredients use metric units (g, kg, ml, l) or US/imperial units (cups, oz, lb) — use that to infer whether bare oven temperatures are most likely Celsius or Fahrenheit.

Then, respond with ONLY a JSON array of strings (no markdown fences, no commentary) — the steps array, same length and order as the input, where:
- Any bare, unit-less oven/grill temperature number gets the inferred unit appended (e.g. "Heat oven to 200" → "Heat oven to 200°C").
- Temperatures that ALREADY specify a unit (200°C, 400F, etc.) are left completely unchanged.
- Every other word in every step is left EXACTLY as in the input — do not rephrase, correct, or reformat anything else.
- If you cannot confidently infer metric vs imperial from the ingredients, return the steps completely unchanged.

Ingredients:
${JSON.stringify(ingredients)}

Steps:
${JSON.stringify(steps)}`,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return steps

    const raw = textBlock.text.trim().replace(/^```json\s*|```$/g, '')
    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed) && parsed.length === steps.length && parsed.every((s) => typeof s === 'string')) {
      return parsed
    }
    return steps
  } catch (err) {
    console.error('clarifyOvenTemperatures error:', err)
    return steps
  }
}

/**
 * Scans all <script type="application/ld+json"> blocks on the page for a
 * schema.org Recipe object (handles @graph wrappers and arrays of objects
 * too) and normalizes it into { title, ingredients, steps, image, ...time/servings }.
 * Returns null if no usable Recipe JSON-LD is found.
 */
function extractRecipeFromJsonLd(html: string): RawParsedRecipe | null {
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
 * Converts a schema.org Recipe node into
 * { title, ingredients, steps, image, prepTimeMinutes, cookTimeMinutes, totalTimeMinutes, servings }.
 * Handles the common variations in how sites encode instructions
 * (plain strings, HowToStep objects, HowToSection groups), images
 * (plain string, array of strings, single ImageObject, array of ImageObjects),
 * durations (ISO 8601, e.g. "PT1H30M"), and yield (string, number, array,
 * or QuantitativeValue).
 */
function normalizeRecipeNode(node: Record<string, unknown>): RawParsedRecipe | null {
  const title = typeof node.name === 'string' ? node.name : ''

  const ingredients = Array.isArray(node.recipeIngredient)
    ? node.recipeIngredient.filter((i): i is string => typeof i === 'string')
    : Array.isArray(node.ingredients)
    ? node.ingredients.filter((i): i is string => typeof i === 'string')
    : []

  const steps = extractInstructionSteps(node.recipeInstructions)
  const image = extractJsonLdImage(node.image)

  const prepTimeMinutes = parseIsoDuration(node.prepTime)
  const cookTimeMinutes = parseIsoDuration(node.cookTime)
  const totalTimeMinutes = parseIsoDuration(node.totalTime)
  const servings = parseServings(node.recipeYield)

  // Require at least a title or some ingredients/steps to consider this a real hit
  if (!title && ingredients.length === 0 && steps.length === 0) {
    return null
  }

  return { title, ingredients, steps, image, prepTimeMinutes, cookTimeMinutes, totalTimeMinutes, servings }
}

/**
 * Parses a schema.org/ISO 8601 duration string (e.g. "PT15M", "PT1H30M",
 * "PT1H") into whole minutes. Returns null for anything unparseable or absent.
 */
function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/i)
  if (!match) return null
  const hours = match[1] ? parseInt(match[1], 10) : 0
  const minutes = match[2] ? parseInt(match[2], 10) : 0
  if (hours === 0 && minutes === 0) return null
  return hours * 60 + minutes
}

/**
 * schema.org "recipeYield" is inconsistent across sites: it can be a plain
 * number, a numeric string ("4"), a descriptive string ("Serves 4-6" or
 * "4 servings"), an array of any of those, or a QuantitativeValue object.
 * Pulls the first integer found in any of those shapes.
 */
function parseServings(value: unknown): number | null {
  if (typeof value === 'number') return Math.round(value) || null

  if (typeof value === 'string') {
    const match = value.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : null
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = parseServings(item)
      if (result !== null) return result
    }
    return null
  }

  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.value !== 'undefined') return parseServings(obj.value)
  }

  return null
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
