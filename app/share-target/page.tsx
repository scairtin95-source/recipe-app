'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ShareTargetPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Different apps put the shared link in different fields — Instagram/
    // TikTok typically use "text" (sometimes with extra caption text
    // around the URL), browsers usually use "url" directly. Try both,
    // preferring an actual URL if one is found in either field.
    const sharedUrl = searchParams.get('url')
    const sharedText = searchParams.get('text')

    const urlPattern = /https?:\/\/[^\s]+/
    const extracted =
      (sharedUrl && urlPattern.test(sharedUrl) && sharedUrl) ||
      (sharedText && sharedText.match(urlPattern)?.[0]) ||
      ''

    if (extracted) {
      router.replace(`/add?url=${encodeURIComponent(extracted)}`)
    } else {
      // Nothing usable was shared — just send them to Add Recipe empty,
      // same as opening it normally.
      router.replace('/add')
    }
  }, [searchParams, router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDF8F5' }}>
      <p style={{ color: '#8a8378', fontFamily: 'var(--font-manrope)' }}>Opening…</p>
    </div>
  )
}