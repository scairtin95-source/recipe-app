import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { source_url } = await request.json();

  if (!source_url) {
    return NextResponse.json({ image: null, error: 'No URL provided' }, { status: 400 });
  }

  try {
    const pageRes = await fetch(source_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RecipeApp/1.0)' },
    });
    const html = await pageRes.text();

    const jsonLdMatches = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];

    for (const match of jsonLdMatches) {
      try {
        const parsed = JSON.parse(match[1]);
        const items = Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed];

        for (const item of items) {
          if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
            let image = item.image;
            if (Array.isArray(image)) image = image[0];
            if (image && typeof image === 'object') image = image.url;
            if (image) {
              return NextResponse.json({ image });
            }
          }
        }
      } catch {
        continue;
      }
    }

    const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    if (ogMatch) {
      return NextResponse.json({ image: ogMatch[1] });
    }

    return NextResponse.json({ image: null });
  } catch (error) {
    console.error('Image fetch error:', error);
    return NextResponse.json({ image: null, error: 'Fetch failed' }, { status: 500 });
  }
}