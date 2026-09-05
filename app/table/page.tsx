'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '../../src/lib/AuthContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
}

interface Member {
  user_id: string
  display_name: string
}

interface SharedRecipe {
  id: number
  title: string
  image: string | null
  tags: string | null
  user_id: string
  is_private: boolean
}

function tagList(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

export default function TablePage() {
  const [members, setMembers] = useState<Member[]>([])
  const [recipes, setRecipes] = useState<SharedRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

   useEffect(() => {
    async function load() {
      const [{ data: memberData }, { data: recipeData }] = await Promise.all([
        supabase.from('table_members').select('user_id, display_name'),
        // RLS scopes this to "my own recipes + non-private recipes from
        // fellow Table members" — but RLS still lets the owner see their
        // OWN recipes even if private (necessary, so you never lose access
        // to your own data). Filter those out client-side so "private"
        // also hides a recipe from your own Table view, not just others'.
        supabase.from('recipes').select('id, title, image, tags, user_id, is_private').order('created_at', { ascending: false }),
      ])
      if (memberData) setMembers(memberData)
      if (recipeData) setRecipes(recipeData.filter((r) => !(r.is_private && r.user_id === user?.id)))
      setLoading(false)
    }
    load()
  }, [user])

  const nameFor = (userId: string) => members.find((m) => m.user_id === userId)?.display_name || 'Someone'

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '2.2rem', fontWeight: 700, color: '#2c2c2c', margin: '0 0 0.4rem' }}>
          The Table
        </h1>
        <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          Recipes shared by everyone at the table: {members.map((m) => m.display_name).join(', ') || '…'}
        </p>

        {loading && <p style={{ color: '#8a8378' }}>Loading…</p>}

        {!loading && recipes.length === 0 && (
          <p style={{ color: '#8a8378' }}>No shared recipes yet.</p>
        )}

        {!loading && recipes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {recipes.map((r) => (
              <Link key={r.id} href={`/recipes/${r.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
                  <div style={{ height: 140, background: '#f1e9dd' }}>
                    {r.image && (
                      <img src={r.image} alt={r.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div style={{ padding: '0.9rem' }}>
                    <p style={{
                      fontSize: '0.7rem', fontWeight: 700, color: COLORS.tertiary,
                      textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.3rem'
                    }}>
                      {nameFor(r.user_id)}
                    </p>
                    <h3 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1rem', fontWeight: 600, color: '#2c2c2c', margin: '0 0 0.4rem' }}>
                      {r.title}
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {tagList(r.tags).slice(0, 3).map((tag, i) => (
                        <span key={i} style={{ fontSize: '0.7rem', padding: '0.15rem 0.6rem', borderRadius: 999, background: '#efe6d8', color: COLORS.tertiary }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}