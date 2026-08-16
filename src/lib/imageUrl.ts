// src/lib/imageUrl.ts

// Some recipe sites embed a resize/quality query param in the image URL
// they expose via JSON-LD or og:image, meant for their own small thumbnail
// slots. When we display that same URL full-width in a hero image, it gets
// stretched past its native resolution and looks soft/blurry. This bumps
// known "resize=W,H" params up to a size that holds up at hero width,
// while leaving anything without that pattern untouched.
export function upgradeImageUrl(url: string | null): string | null {
  if (!url) return url

  // immediate.co.uk (BBC Good Food, olivemagazine, etc.) — ?resize=W,H
  if (url.includes('images.immediate.co.uk')) {
    return url.replace(/resize=\d+,\d+/, 'resize=1200,900')
  }

  // Generic ?w= / ?width= query params some CDNs use for thumbnails
  const widthParamMatch = url.match(/([?&])(w|width)=(\d+)/)
  if (widthParamMatch && parseInt(widthParamMatch[3], 10) < 800) {
    return url.replace(/([?&])(w|width)=\d+/, `$1$2=1200`)
  }

  return url
}