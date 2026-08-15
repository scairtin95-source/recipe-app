import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { title, ingredients } = await request.json();

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
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
      }),
    });

    const data = await response.json();

    // Anthropic's API can return a 200-with-error-body in some cases, or
    // a non-2xx status — either way, log the actual response so failures
    // are visible instead of silently producing empty tags.
    if (!response.ok) {
      console.error('suggest-tags: Anthropic API error', response.status, JSON.stringify(data));
      return NextResponse.json({ tags: '', debugError: data }, { status: 200 });
    }

    const tags = data.content?.[0]?.text?.trim() || '';

    if (!tags) {
      console.error('suggest-tags: got 200 but no usable text in response', JSON.stringify(data));
    }

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Tag suggestion error:', error);
    return NextResponse.json({ tags: '' }, { status: 500 });
  }
}
