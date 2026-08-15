'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../src/lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
}

interface PantryItem {
  id: number
  category: string
  name: string
  have_it: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
  'Baking': '🥖',
  'Spices & Herbs': '🌿',
  'Oils & Vinegars': '🫙',
  'Cold Storage': '🧊',
  'Meat & Seafood': '🥩',
  'Produce': '🥕',
  'Pantry Staples': '🥫',
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [adding, setAdding] = useState(false)

  async function loadItems() {
    setIsLoading(true)
    const { data } = await supabase
      .from('pantry_items')
      .select('id, category, name, have_it')
      .order('category')
      .order('name')
    if (data) setItems(data)
    setIsLoading(false)
  }

  useEffect(() => {
    loadItems()
  }, [])

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.name.toLowerCase().includes(q))
  }, [items, searchQuery])

  const grouped = useMemo(() => {
    const map: Record<string, PantryItem[]> = {}
    filteredItems.forEach((item) => {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    })
    return map
  }, [filteredItems])

  async function toggleItem(item: PantryItem) {
    const newValue = !item.have_it
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, have_it: newValue } : i)))
    await supabase.from('pantry_items').update({ have_it: newValue }).eq('id', item.id)
  }

  async function addItem() {
    if (!newName.trim() || !newCategory.trim()) return
    setAdding(true)
    const { error } = await supabase
      .from('pantry_items')
      .insert([{ name: newName.trim(), category: newCategory.trim(), have_it: true }])
    if (!error) {
      setNewName('')
      await loadItems()
    }
    setAdding(false)
  }

  const categories = Object.keys(grouped).sort()

  return (
    <div style={{ minHeight: '100vh', background: '#f4efe4', fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2.5rem 1.5rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-newsreader)', fontSize: '2.2rem', fontWeight: 700,
              color: '#2c2c2c', margin: '0 0 0.4rem'
            }}>
              Your Pantry
            </h1>
            <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: 0 }}>
              Keep track of your ingredients for your next culinary adventure.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search ingredients…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '0.65rem 1rem', fontSize: '0.9rem', minWidth: 260,
              border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
              background: '#fff', outline: 'none', fontFamily: 'var(--font-manrope)'
            }}
          />
        </div>

        {isLoading && <p style={{ color: '#8a8378', padding: '2rem 0' }}>Loading pantry…</p>}

        {!isLoading && categories.length === 0 && (
          <p style={{ color: '#8a8378', padding: '2rem 0' }}>
            Nothing here yet — add your first item below.
          </p>
        )}

        {!isLoading && categories.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '1.25rem', marginBottom: '3rem'
          }}>
            {categories.map((category) => {
              const catItems = grouped[category]
              return (
                <div key={category} style={{
                  background: '#fff', borderRadius: 16, overflow: 'hidden',
                  border: `1px solid ${COLORS.border}`, position: 'relative'
                }}>
                  <div style={{
                    height: 130, background: '#e8dcc4'
                  }} />
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', background: COLORS.secondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', position: 'absolute', top: 110, left: 16,
                    border: '3px solid #fff'
                  }}>
                    {CATEGORY_ICONS[category] || '🍽️'}
                  </div>
                  <div style={{ padding: '1.5rem 1.25rem 1.25rem' }}>
                    <h2 style={{
                      fontFamily: 'var(--font-newsreader)', fontSize: '1.15rem', fontWeight: 700,
                      color: '#2c2c2c', margin: '0 0 0.2rem'
                    }}>
                      {category}
                    </h2>
                    <p style={{ color: '#8a8378', fontSize: '0.8rem', margin: '0 0 1rem' }}>
                      {catItems.length} item{catItems.length === 1 ? '' : 's'}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                      {catItems.slice(0, 6).map((item) => (
                        <div key={item.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <span style={{
                            fontSize: '0.85rem',
                            color: item.have_it ? '#2c2c2c' : '#b0a89a',
                            textDecoration: item.have_it ? 'none' : 'line-through'
                          }}>
                            {item.name}
                          </span>
                          <button
                            onClick={() => toggleItem(item)}
                            aria-label={`Toggle ${item.name}`}
                            style={{
                              width: 38, height: 22, borderRadius: 999, border: 'none',
                              background: item.have_it ? COLORS.secondary : '#e0dbd2',
                              cursor: 'pointer', position: 'relative', flexShrink: 0
                            }}
                          >
                            <span style={{
                              position: 'absolute', top: 2,
                              left: item.have_it ? 18 : 2,
                              width: 18, height: 18, borderRadius: '50%',
                              background: '#fff', transition: 'left 0.15s'
                            }} />
                          </button>
                        </div>
                      ))}
                      {catItems.length > 6 && (
                        <p style={{ fontSize: '0.75rem', color: '#8a8378', margin: 0 }}>
                          +{catItems.length - 6} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Add item form */}
        <div style={{
          background: '#fff', borderRadius: 16, padding: '1.5rem',
          border: `1px solid ${COLORS.border}`, maxWidth: 520
        }}>
          <h3 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.1rem', margin: '0 0 1rem', color: '#2c2c2c' }}>
            Add an item
          </h3>
          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Ingredient name" value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{
                flex: '1 1 160px', padding: '0.6rem 0.8rem', fontSize: '0.85rem',
                border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
                outline: 'none', fontFamily: 'var(--font-manrope)'
              }}
            />
            <input
              type="text" placeholder="Category — e.g. Baking" value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              style={{
                flex: '1 1 160px', padding: '0.6rem 0.8rem', fontSize: '0.85rem',
                border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
                outline: 'none', fontFamily: 'var(--font-manrope)'
              }}
            />
            <button onClick={addItem} disabled={adding} style={{
              padding: '0.6rem 1.2rem', borderRadius: 10, border: 'none',
              background: COLORS.primary, color: '#fff', fontSize: '0.85rem',
              fontWeight: 600, cursor: 'pointer', opacity: adding ? 0.7 : 1
            }}>
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}
