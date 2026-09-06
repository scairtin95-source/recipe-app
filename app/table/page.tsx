'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '../../src/lib/AuthContext'
import { useTranslation } from '../../src/lib/i18n/LocaleContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
}

const CUISINE_TAGS = ['spanish', 'italian', 'french', 'mediterranean', 'mexican', 'indian', 'romanian']
const COURSE_TAGS = ['dinner', 'soup', 'pasta', 'salad', 'appetizer', 'breakfast', 'dessert']
const STYLE_TAGS = ['vegetarian', 'healthy', 'quick', 'seafood']

const CARD_COLORS = ['#b5543a', '#9d5a4a', '#7a8a3f', '#c9a876', '#6b5d8a', '#5c614d', '#8f5a3c']

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
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const [browseOpen, setBrowseOpen] = useState(false)
  const { user } = useAuth()
  const { t } = useTranslation()

   useEffect(() => {
    async function load() {
      const [{ data: memberData }, { data: recipeData }] = await Promise.all([
        supabase.from('table_members').select('user_id, display_name'),
        supabase.from('recipes').select('id, title, image, tags, user_id, is_private').order('created_at', { ascending: false }),
      ])
      if (memberData) setMembers(memberData)
      if (recipeData) setRecipes(recipeData.filter((r) => !(r.is_private && r.user_id === user?.id)))
      setLoading(false)
    }
    load()
  }, [user])

  function toggleTag(tag: string) {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function clearTags() {
    setActiveTags([])
  }

  function imageForTag(tag: string): string | null {
    const matches = recipes.filter((r) =>
      tagList(r.tags).some((t) => t.toLowerCase() === tag.toLowerCase()) && r.image
    )
    if (matches.length === 0) return null
    const stable = matches.find((r) => !r.image!.includes('cdninstagram.com'))
    return (stable ?? matches[0]).image
  }

  function countForTag(tag: string): number {
    return recipes.filter((r) =>
      tagList(r.tags).some((t) => t.toLowerCase() === tag.toLowerCase())
    ).length
  }

  function tagLabel(tag: string): string {
    return t(`tags.${tag}`)
  }

  const cuisineCards = useMemo(
    () => CUISINE_TAGS.map((tag) => ({ tag, image: imageForTag(tag), count: countForTag(tag) }))
      .filter((c) => c.count > 0),
    [recipes]
  )

  const courseCards = useMemo(
    () => COURSE_TAGS.map((tag) => ({ tag, image: imageForTag(tag), count: countForTag(tag) }))
      .filter((c) => c.count > 0),
    [recipes]
  )

  const styleCards = useMemo(
    () => STYLE_TAGS.map((tag) => ({ tag, count: countForTag(tag) }))
      .filter((c) => c.count > 0),
    [recipes]
  )

  const filteredRecipes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const activeTagsLower = activeTags.map((t) => t.toLowerCase())

    return recipes.filter((recipe) => {
      const titleMatch = recipe.title?.toLowerCase().includes(query)
      const tagsMatch = recipe.tags?.toLowerCase().includes(query)
      const passesSearch = !query || titleMatch || tagsMatch

      const recipeTagsLower = tagList(recipe.tags).map((t) => t.toLowerCase())
      const passesTagFilter =
        activeTagsLower.length === 0 ||
        activeTagsLower.every((tag) => recipeTagsLower.includes(tag))

      return passesSearch && passesTagFilter
    })
  }, [recipes, searchQuery, activeTags])

  const nameFor = (userId: string) => members.find((m) => m.user_id === userId)?.display_name || t('tablePage.someone')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '2.2rem', fontWeight: 700, color: '#2c2c2c', margin: '0 0 0.4rem' }}>
          {t('nav.table')}
        </h1>
        <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
          {t('tablePage.subtitlePrefix')} {members.map((m) => m.display_name).join(', ') || '…'}
        </p>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('recipesPage.searchPlaceholder')}
          style={{
            width: '100%', padding: '0.75rem 1.1rem', fontSize: '1rem',
            border: `1.5px solid ${COLORS.border}`, borderRadius: 12,
            marginBottom: '1rem', background: '#fff',
            outline: 'none', boxSizing: 'border-box',
            fontFamily: 'var(--font-manrope)', color: '#2c2c2c'
          }}
        />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '0.75rem', marginBottom: browseOpen ? '1.75rem' : '1.5rem'
        }}>
          <button
            onClick={() => setBrowseOpen((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, color: COLORS.secondary,
              fontFamily: 'var(--font-manrope)'
            }}
          >
            {browseOpen ? t('recipesPage.hideCategories') : t('recipesPage.browseByCategory')}
            <span>{browseOpen ? '▴' : '▾'}</span>
          </button>

          {!browseOpen && activeTags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', color: '#8a8378' }}>{t('recipesPage.filteredByPrefix')}</span>
              {activeTags.map((tag) => (
                <span key={tag} style={{
                  fontSize: '0.75rem', padding: '0.2rem 0.65rem', borderRadius: 999,
                  background: '#efe6d8', color: COLORS.tertiary, fontWeight: 600
                }}>
                  {tagLabel(tag)}
                </span>
              ))}
              <button
                onClick={clearTags}
                style={{
                  fontSize: '0.8rem', color: COLORS.primary, background: 'none', border: 'none',
                  cursor: 'pointer', fontWeight: 600, textDecoration: 'underline', fontFamily: 'var(--font-manrope)'
                }}
              >
                {t('recipesPage.clearFilters')}
              </button>
            </div>
          )}
        </div>

        {browseOpen && (
          <>
            {cuisineCards.length > 0 && (
              <div style={{ marginBottom: '1.75rem' }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 600, color: COLORS.tertiary,
                  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.6rem'
                }}>
                  {t('recipesPage.cuisine')}
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {cuisineCards.map((c, i) => {
                    const isActive = activeTags.includes(c.tag)
                    return (
                      <button
                        key={c.tag}
                        onClick={() => toggleTag(c.tag)}
                        style={{
                          minWidth: 130, height: 140, borderRadius: 14, position: 'relative',
                          overflow: 'hidden', flexShrink: 0, border: isActive ? `2.5px solid ${COLORS.primary}` : 'none',
                          cursor: 'pointer', padding: 0, background: CARD_COLORS[i % CARD_COLORS.length]
                        }}
                      >
                        {c.image && (
                          <img
                            src={c.image}
                            alt={c.tag}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.65))' }} />
                        <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12, textAlign: 'left' }}>
                          <p style={{ color: '#fdf8f5', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                            {tagLabel(c.tag)}
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {courseCards.length > 0 && (
              <div style={{ marginBottom: '1.75rem' }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 600, color: COLORS.tertiary,
                  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.6rem'
                }}>
                  {t('recipesPage.course')}
                </p>
                <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '4px' }}>
                  {courseCards.map((c, i) => {
                    const isActive = activeTags.includes(c.tag)
                    return (
                      <button
                        key={c.tag}
                        onClick={() => toggleTag(c.tag)}
                        style={{
                          minWidth: 105, height: 105, borderRadius: 14, position: 'relative',
                          overflow: 'hidden', flexShrink: 0, border: isActive ? `2.5px solid ${COLORS.primary}` : 'none',
                          cursor: 'pointer', padding: 0, background: CARD_COLORS[(i + 3) % CARD_COLORS.length]
                        }}
                      >
                        {c.image && (
                          <img
                            src={c.image}
                            alt={c.tag}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        )}
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(0,0,0,0.6))' }} />
                        <p style={{
                          position: 'absolute', bottom: 8, left: 10, color: '#fdf8f5',
                          fontSize: '0.8rem', fontWeight: 600, margin: 0
                        }}>
                          {tagLabel(c.tag)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {styleCards.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <p style={{
                  fontSize: '0.7rem', fontWeight: 600, color: COLORS.tertiary,
                  textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.6rem'
                }}>
                  {t('recipesPage.style')}
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                  {styleCards.map((c, i) => {
                    const isActive = activeTags.includes(c.tag)
                    return (
                      <button
                        key={c.tag}
                        onClick={() => toggleTag(c.tag)}
                        style={{
                          padding: '0.5rem 1.1rem', borderRadius: 999, border: 'none',
                          background: CARD_COLORS[i % CARD_COLORS.length], color: '#fdf8f5',
                          fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                          opacity: isActive ? 1 : 0.75,
                          outline: isActive ? `2.5px solid ${COLORS.primary}` : 'none',
                          outlineOffset: '2px'
                        }}
                      >
                        {tagLabel(c.tag)} · {c.count}
                      </button>
                    )
                  })}
                  {activeTags.length > 0 && (
                    <button
                      onClick={clearTags}
                      style={{
                        fontSize: '0.8rem', padding: '0.35rem 0.9rem', borderRadius: 999,
                        border: 'none', background: 'transparent', color: COLORS.primary,
                        fontFamily: 'var(--font-manrope)', fontWeight: 600, cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {t('recipesPage.clearFilters')}
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {loading && <p style={{ color: '#8a8378' }}>{t('tablePage.loading')}</p>}

        {!loading && recipes.length === 0 && (
          <p style={{ color: '#8a8378' }}>{t('tablePage.noSharedRecipes')}</p>
        )}

        {!loading && recipes.length > 0 && filteredRecipes.length === 0 && (
          <p style={{ color: '#8a8378' }}>
            {t('recipesPage.noMatches')}{searchQuery ? ` "${searchQuery}"` : ''}{activeTags.length > 0 ? ` ${t('recipesPage.withSelectedTags')}` : ''}.
          </p>
        )}

        {!loading && filteredRecipes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {filteredRecipes.map((r) => (
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