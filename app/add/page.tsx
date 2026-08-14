'use client'

import { useState } from 'react'
import { supabase } from '../../src/lib/supabase'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

interface StructuredIngredient {
  quantity: number | null
  unit: string | null
  item: string
  raw: string
}

function parseList(raw: any): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

// Formats structured ingredients (or plain strings) into readable
// "quantity unit item" lines for the preview card and the editable textarea.
function formatIngredientLines(entries: StructuredIngredient[] | string[]): string[] {
  return entries.map((entry) => {
    if (typeof entry === 'string') return entry
    if (entry.quantity !== null && entry.unit) {
      return `${entry.quantity} ${entry.unit} ${entry.item}`.trim()
    }
    return entry.raw || entry.item || ''
  }).filter(Boolean)
}

function tagList(tags: string): string[] {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch {
    return url
  }
}

function formatMinutesShort(mins: number | null): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  // structuredIngredients holds the parser's { quantity, unit, item, raw }
  // objects, kept intact for saving so the recipe detail page's unit-aware
  // conversion works. ingredientsText is the editable plain-text mirror
  // shown in the manual-edit textarea. If the person edits that text by
  // hand, ingredientsEdited flips true and the save falls back to a plain
  // string array (same format legacy recipes already use) rather than
  // trying to guess new quantity/unit splits from freehand edits.
  const [structuredIngredients, setStructuredIngredients] = useState<StructuredIngredient[] | null>(null)
  const [ingredientsText, setIngredientsText] = useState('')
  const [ingredientsEdited, setIngredientsEdited] = useState(false)

  const [steps, setSteps] = useState('')
  const [tags, setTags] = useState('')
  const [image, setImage] = useState('')

  const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | null>(null)
  const [cookTimeMinutes, setCookTimeMinutes] = useState<number | null>(null)
  const [totalTimeMinutes, setTotalTimeMinutes] = useState<number | null>(null)
  const [servings, setServings] = useState<number | null>(null)

  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'input' | 'preview' | 'edit'>('input')

  const resetAll = () => {
    setUrl(''); setTitle('')
    setStructuredIngredients(null); setIngredientsText(''); setIngredientsEdited(false)
    setSteps(''); setTags(''); setImage('')
    setPrepTimeMinutes(null); setCookTimeMinutes(null); setTotalTimeMinutes(null); setServings(null)
    setMessage('')
    setMode('input')
  }

  const parseRecipe = async () => {
    if (!url) { setMessage('Please enter a URL'); return }
    setParsing(true)
    const res = await fetch('/api/parse-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    const data = await res.json()
    if (data.title) setTitle(data.title)
    if (Array.isArray(data.ingredients)) {
      setStructuredIngredients(data.ingredients)
      setIngredientsText(formatIngredientLines(data.ingredients).join('\n'))
      setIngredientsEdited(false)
    }
    if (Array.isArray(data.steps)) setSteps(data.steps.join('\n'))
    if (data.image) setImage(data.image)
    setPrepTimeMinutes(typeof data.prepTimeMinutes === 'number' ? data.prepTimeMinutes : null)
    setCookTimeMinutes(typeof data.cookTimeMinutes === 'number' ? data.cookTimeMinutes : null)
    setTotalTimeMinutes(typeof data.totalTimeMinutes === 'number' ? data.totalTimeMinutes : null)
    setServings(typeof data.servings === 'number' ? data.servings : null)
    setMessage('')
    setParsing(false)
    if (data.title) setMode('preview')
  }

  const saveRecipe = async () => {
    if (!title) { setMessage('Please enter a title'); return }
    setSaving(true)

    // Use the parser's structured data as-is if the ingredients text
    // hasn't been hand-edited; otherwise save whatever's in the textarea
    // as a plain string array (legacy-compatible format).
    const ingredientsToSave =
      structuredIngredients && !ingredientsEdited
        ? JSON.stringify(structuredIngredients)
        : JSON.stringify(parseList(ingredientsText))

    const { error } = await supabase
      .from('recipes')
      .insert([{
        title,
        ingredients: ingredientsToSave,
        steps,
        tags,
        source_url: url,
        image,
        prep_time_minutes: prepTimeMinutes,
        cook_time_minutes: cookTimeMinutes,
        total_time_minutes: totalTimeMinutes,
        servings,
      }])
    if (error) {
      setMessage('Error saving: ' + error.message)
      setSaving(false)
    } else {
      addIngredientsToPantry(ingredientsText)
      resetAll()
      setMessage('Recipe saved!')
      setSaving(false)
    }
  }

  const addIngredientsToPantry = async (rawIngredients: string) => {
    const lines = parseList(rawIngredients)
    if (lines.length === 0) return

    try {
      const res = await fetch('/api/extract-pantry-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: lines }),
      })
      const json = await res.json()
      const items = json.items || []
      if (items.length === 0) return

      const { data: existing } = await supabase.from('pantry_items').select('name')
      const existingNames = new Set(
        (existing || []).map((i: any) => i.name.trim().toLowerCase())
      )

      const newItems = items.filter(
        (item: any) => !existingNames.has(item.name.trim().toLowerCase())
      )

      if (newItems.length > 0) {
        await supabase.from('pantry_items').insert(
          newItems.map((item: any) => ({
            name: item.name,
            category: item.category,
            have_it: false,
          }))
        )
      }
    } catch (err) {
      console.error('addIngredientsToPantry error:', err)
    }
  }

  const inputStyle = {
    padding: '0.7rem 1rem', fontSize: '0.95rem',
    border: '1.5px solid #e5ddd3', borderRadius: 10,
    background: '#fff', outline: 'none',
    fontFamily: 'var(--font-manrope)', color: '#2c2c2c',
    width: '100%', boxSizing: 'border-box' as const
  }

  const ingredientPreview =
    structuredIngredients && !ingredientsEdited
      ? formatIngredientLines(structuredIngredients)
      : parseList(ingredientsText)
  const previewTags = tagList(tags)

  const metaSummary = [
    formatMinutesShort(prepTimeMinutes) && `Prep ${formatMinutesShort(prepTimeMinutes)}`,
    formatMinutesShort(cookTimeMinutes) && `Cook ${formatMinutesShort(cookTimeMinutes)}`,
    servings && `Serves ${servings}`,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>


      <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '2.2rem', fontWeight: 600, color: '#2c2c2c', margin: '0 0 0.5rem',
            fontFamily: 'var(--font-newsreader)'
          }}>
            Add a recipe
          </h2>
          <p style={{ color: '#8a8378', fontSize: '0.95rem', margin: 0 }}>
            Paste a link and we'll read the recipe off the page
          </p>
        </div>

        {/* URL + Parse/Clear */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input
            type="text" placeholder="Paste a recipe URL…" value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={mode !== 'input'}
            style={{ ...inputStyle, flex: 1, opacity: mode !== 'input' ? 0.7 : 1 }}
          />
          {mode === 'input' ? (
            <button onClick={parseRecipe} disabled={parsing} style={{
              padding: '0.7rem 1.3rem', borderRadius: 10, border: 'none',
              background: COLORS.secondary, color: '#fff', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
              whiteSpace: 'nowrap', opacity: parsing ? 0.7 : 1
            }}>
              {parsing ? 'Parsing…' : 'Parse'}
            </button>
          ) : (
            <button onClick={resetAll} style={{
              padding: '0.7rem 1.3rem', borderRadius: 10, border: '1.5px solid #e5ddd3',
              background: '#fff', color: '#5a5a5a', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
              whiteSpace: 'nowrap'
            }}>
              Clear
            </button>
          )}
        </div>

        {mode === 'input' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: '#8a8378' }}>
              <span>Try:</span>
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: '#fff', border: '1px solid #e5ddd3' }}>
                a food blog link
              </span>
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: '#fff', border: '1px solid #e5ddd3' }}>
                an Instagram caption
              </span>
            </div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <button
                onClick={() => setMode('edit')}
                style={{
                  background: 'transparent', border: 'none', color: COLORS.primary,
                  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'underline', fontFamily: 'var(--font-manrope)'
                }}
              >
                Or enter a recipe manually →
              </button>
            </div>
          </>
        )}

        {/* PREVIEW CARD */}
        {mode === 'preview' && (
          <div style={{
            background: '#fff', borderRadius: 18, padding: '1.5rem',
            border: '1px solid #eee3d8', marginTop: '1.5rem',
            display: 'flex', gap: '1.5rem'
          }}>
            <div style={{ width: 180, minWidth: 180, height: 180, borderRadius: 14, overflow: 'hidden', background: '#f1e9dd' }}>
              {image ? (
                <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>🫒</div>
              )}
            </div>

            <div style={{ flex: 1 }}>
              {url && (
                <p style={{ fontSize: '0.8rem', color: '#8a8378', margin: '0 0 0.4rem' }}>
                  ↗ {getDomain(url)}
                </p>
              )}
              <h3 style={{
                fontFamily: 'var(--font-newsreader)', fontSize: '1.35rem', fontWeight: 600,
                color: '#2c2c2c', margin: '0 0 0.4rem', lineHeight: 1.3
              }}>
                {title}
              </h3>

              {metaSummary && (
                <p style={{ fontSize: '0.8rem', color: COLORS.secondary, fontWeight: 600, margin: '0 0 0.9rem' }}>
                  {metaSummary}
                </p>
              )}

              {ingredientPreview.length > 0 && (
                <>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.4rem' }}>
                    Ingredients Preview
                  </p>
                  <ul style={{ margin: '0 0 0.9rem', padding: '0 0 0 1.1rem', fontSize: '0.85rem', color: '#3c3c3c', lineHeight: 1.7 }}>
                    {ingredientPreview.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
                    {ingredientPreview.length > 5 && (
                      <li style={{ color: '#8a8378', listStyle: 'none', marginLeft: '-1.1rem' }}>
                        …and {ingredientPreview.length - 5} more items
                      </li>
                    )}
                  </ul>
                </>
              )}

              {previewTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  {previewTags.map((tag, i) => (
                    <span key={i} style={{
                      fontSize: '0.75rem', padding: '0.2rem 0.7rem', borderRadius: 999,
                      background: '#efe6d8', color: COLORS.tertiary, fontWeight: 500
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={saveRecipe} disabled={saving} style={{
                  padding: '0.65rem 1.2rem', borderRadius: 999, border: 'none',
                  background: COLORS.secondary, color: '#fff', fontSize: '0.9rem',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
                  opacity: saving ? 0.7 : 1
                }}>
                  {saving ? 'Saving…' : '♡ Looks good, save it!'}
                </button>
                <button onClick={() => setMode('edit')} style={{
                  padding: '0.65rem 1.2rem', borderRadius: 999, border: '1.5px solid #d8cfc0',
                  background: '#fff', color: '#3c3c3c', fontSize: '0.9rem',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)'
                }}>
                  ✎ Manual Edit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MANUAL EDIT FORM */}
        {mode === 'edit' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>

            {image && (
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #eee3d8', height: 200 }}>
                <img src={image} alt="Recipe preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}

            <input
              type="text" placeholder="Recipe title" value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-newsreader)', fontSize: '1.1rem' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="number" placeholder="Prep (min)" value={prepTimeMinutes ?? ''}
                onChange={(e) => setPrepTimeMinutes(e.target.value ? Number(e.target.value) : null)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number" placeholder="Cook (min)" value={cookTimeMinutes ?? ''}
                onChange={(e) => setCookTimeMinutes(e.target.value ? Number(e.target.value) : null)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number" placeholder="Total (min)" value={totalTimeMinutes ?? ''}
                onChange={(e) => setTotalTimeMinutes(e.target.value ? Number(e.target.value) : null)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                type="number" placeholder="Servings" value={servings ?? ''}
                onChange={(e) => setServings(e.target.value ? Number(e.target.value) : null)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.4rem' }}>
                Ingredients
              </label>
              <textarea
                placeholder="One ingredient per line…" value={ingredientsText}
                onChange={(e) => { setIngredientsText(e.target.value); setIngredientsEdited(true) }}
                rows={6} style={{ ...inputStyle, resize: 'vertical' as const }}
              />
              {structuredIngredients && !ingredientsEdited && (
                <p style={{ fontSize: '0.75rem', color: '#8a8378', margin: '0.4rem 0 0' }}>
                  Quantities were parsed automatically — editing this text will save it as plain lines instead.
                </p>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.4rem' }}>
                Method
              </label>
              <textarea
                placeholder="One step per line…" value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={8} style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            <input
              type="text" placeholder="Tags — e.g. breakfast, healthy, quick" value={tags}
              onChange={(e) => setTags(e.target.value)}
              style={inputStyle}
            />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={saveRecipe} disabled={saving} style={{
                flex: 1, padding: '0.85rem', borderRadius: 999, border: 'none',
                background: COLORS.primary, color: '#fff', fontSize: '1rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
                opacity: saving ? 0.7 : 1
              }}>
                {saving ? 'Saving…' : 'Save Recipe'}
              </button>
              <button onClick={() => setMode(title || url ? 'preview' : 'input')} style={{
                padding: '0.85rem 1.3rem', borderRadius: 999, border: '1.5px solid #d8cfc0',
                background: '#fff', color: '#3c3c3c', fontSize: '0.95rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)'
              }}>
                Back
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <p style={{
            marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 10,
            background: message.includes('Error') ? '#fbeae7' : '#eef0e8',
            color: message.includes('Error') ? COLORS.primary : COLORS.secondary,
            fontFamily: 'var(--font-manrope)', fontSize: '0.9rem'
          }}>
            {message}
          </p>
        )}

      </main>
    </div>
  )
}
