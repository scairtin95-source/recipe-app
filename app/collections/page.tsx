'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../src/lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

interface Collection {
  id: number
  name: string
  created_at: string
}

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  async function loadCollections() {
    setIsLoading(true)
    const { data: cols } = await supabase
      .from('collections')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })

    if (cols) {
      setCollections(cols)
      const { data: links } = await supabase
        .from('collection_recipes')
        .select('collection_id')

      if (links) {
        const countMap: Record<number, number> = {}
        links.forEach((row: any) => {
          countMap[row.collection_id] = (countMap[row.collection_id] || 0) + 1
        })
        setCounts(countMap)
      }
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadCollections()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1rem' }}>

        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem', fontWeight: 600, color: '#2c2c2c', margin: 0,
            fontFamily: 'var(--font-newsreader)'
          }}>
            Collections
          </h1>
        </div>

        {isLoading && <p style={{ color: '#8a8378', textAlign: 'center', padding: '3rem' }}>Loading collections…</p>}

        {!isLoading && collections.length === 0 && (
          <p style={{ color: '#8a8378', textAlign: 'center', padding: '3rem' }}>
            No collections yet.
          </p>
        )}

        {!isLoading && collections.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '1.25rem'
          }}>
            {collections.map((c) => (
              <Link key={c.id} href={`/collections/${c.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: '1.5rem',
                  border: '1px solid #eee3d8', cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 10px 28px rgba(93,54,30,0.1)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = 'none'
                  }}
                >
                  <h2 style={{
                    fontSize: '1.2rem', fontWeight: 600, color: '#2c2c2c', margin: '0 0 0.4rem',
                    fontFamily: 'var(--font-newsreader)'
                  }}>
                    {c.name}
                  </h2>
                  <p style={{ fontSize: '0.85rem', color: '#8a8378', margin: 0 }}>
                    {counts[c.id] || 0} recipe{counts[c.id] === 1 ? '' : 's'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}