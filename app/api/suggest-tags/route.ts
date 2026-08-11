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
        model: 'claude-sonnet-4-6',
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
    const tags = data.content?.[0]?.text?.trim() || '';

    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Tag suggestion error:', error);
    return NextResponse.json({ tags: '' }, { status: 500 });
  }
}