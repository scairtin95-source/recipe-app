import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const LANGUAGE_NAMES: Record<string, string> = {
  es: 'Spanish',
  ro: 'Romanian',
  ru: 'Russian',
}

export async function POST(req: Request) {
  try {
    const { locale, title, ingredients, steps } = await req.json()
    const languageName = LANGUAGE_NAMES[locale]
    if (!languageName) {
      return Response.json({ error: 'Unsupported locale' }, { status: 400 })
    }

    const prompt = `Translate the following recipe into ${languageName}. Respond with ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:
{"title": string, "ingredients": string[], "steps": string[]}

Rules:
- Keep the "ingredients" and "steps" arrays the exact same length and order as given below — one translated entry per input entry.
- Do not add, remove, or change any numbers, quantities, or units — only translate the descriptive/ingredient text itself.
- Use natural culinary language a native speaker would use, not a literal word-for-word translation.

Title: ${title}

Ingredients:
${JSON.stringify(ingredients)}

Steps:
${JSON.stringify(steps)}`

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b: any) => b.type === 'text') as any
    const raw = textBlock?.text || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!parsed.title || !Array.isArray(parsed.ingredients) || !Array.isArray(parsed.steps)) {
      return Response.json({ error: 'Malformed translation response' }, { status: 500 })
    }

    return Response.json(parsed)
  } catch (err) {
    console.error('translate-recipe error:', err)
    return Response.json({ error: 'Translation failed' }, { status: 500 })
  }
}