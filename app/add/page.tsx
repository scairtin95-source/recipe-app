'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '../../src/lib/AuthContext'
import { useTranslation } from '../../src/lib/i18n/LocaleContext'

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
  gramsPerUnit?: number | null
}

type IngredientEntry = StructuredIngredient | string

function isStructuredEntry(entry: IngredientEntry): entry is StructuredIngredient {
  return typeof entry === 'object' && entry !== null && 'item' in entry
}

interface EditIngredientRow {
  id: string
  quantity: string
  unit: string
  item: string
  gramsPerUnit: number | null
}

let rowIdCounter = 0
function newRowId(): string {
  rowIdCounter += 1
  return `row-${Date.now()}-${rowIdCounter}`
}

function ingredientToRow(entry: IngredientEntry): EditIngredientRow {
  if (isStructuredEntry(entry)) {
    return {
      id: newRowId(),
      quantity: entry.quantity !== null ? String(entry.quantity) : '',
      unit: entry.unit ?? '',
      item: entry.item,
      gramsPerUnit: entry.gramsPerUnit ?? null,
    }
  }
  return { id: newRowId(), quantity: '', unit: '', item: entry, gramsPerUnit: null }
}

function rowsToIngredients(rows: EditIngredientRow[]): IngredientEntry[] {
  return rows
    .filter((row) => row.item.trim() !== '')
    .map((row): IngredientEntry => {
      const trimmedQty = row.quantity.trim()
      const qtyNum = trimmedQty === '' ? NaN : parseFloat(trimmedQty)
      const unit = row.unit.trim() || null
      const item = row.item.trim()

      if (trimmedQty !== '' && !isNaN(qtyNum)) {
        const raw = `${trimmedQty}${unit ? ' ' + unit : ''} ${item}`.trim()
        return { quantity: qtyNum, unit, item, raw, gramsPerUnit: row.gramsPerUnit }
      }
      return item
    })
}

// Formats structured ingredients (or plain strings) into readable
// "quantity unit item" lines for the preview card and pantry extraction.
function formatIngredientLines(entries: IngredientEntry[]): string[] {
  return entries.map((entry) => {
    if (typeof entry === 'string') return entry
    if (entry.quantity !== null && entry.unit) {
      return `${entry.quantity} ${entry.unit} ${entry.item}`.trim()
    }
    return entry.raw || entry.item || ''
  }).filter(Boolean)
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

async function uploadImageFile(file: File, keyPrefix: string): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${keyPrefix}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('recipe-images').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) {
    console.error('uploadImageFile error:', error)
    return null
  }
  const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
  return data.publicUrl
}

function formatMinutesShort(mins: number | null, minLabel: string, hrLabel: string): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins} ${minLabel}`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} ${hrLabel} ${rest} ${minLabel}` : `${hours} ${hrLabel}`
}

export default function Home() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')

  // Ingredients are now always structured rows (Qty / Unit / Ingredient),
  // matching the recipe detail page's edit form — both a URL parse and
  // manual entry populate the same row editor, so there's no separate
  // "freeform text" fallback path anymore.
  const [ingredientRows, setIngredientRows] = useState<EditIngredientRow[]>([])

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
  const [isError, setIsError] = useState(false)
  const [mode, setMode] = useState<'input' | 'preview' | 'edit'>('input')
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const sharedUrl = searchParams.get('url')
    if (sharedUrl) {
      setUrl(sharedUrl)
    }
  }, [searchParams])

  useEffect(() => {
    if (url && mode === 'input' && searchParams.get('url')) {
      parseRecipe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const resetAll = () => {
    setUrl(''); setTitle('')
    setIngredientRows([])
    setSteps(''); setTags(''); setImage('')
    setPrepTimeMinutes(null); setCookTimeMinutes(null); setTotalTimeMinutes(null); setServings(null)
    setMessage(''); setIsError(false)
    setMode('input')
  }

  const addIngredientRow = () => {
    setIngredientRows((prev) => [
      ...prev,
      { id: newRowId(), quantity: '', unit: '', item: '', gramsPerUnit: null },
    ])
  }

  const removeIngredientRow = (rowId: string) => {
    setIngredientRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const updateIngredientRow = (rowId: string, patch: Partial<EditIngredientRow>) => {
    setIngredientRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingImage(true)
    const uploadedUrl = await uploadImageFile(file, 'new-recipe')
    if (uploadedUrl) {
      setImage(uploadedUrl)
    } else {
      setMessage(t('addRecipePage.uploadFailedAlert'))
      setIsError(true)
    }
    setUploadingImage(false)
  }

  const parseRecipe = async () => {
    if (!url) { setMessage(t('addRecipePage.enterUrlError')); setIsError(true); return }
    setParsing(true)
    const res = await fetch('/api/parse-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    })
    const data = await res.json()
    if (data.title) setTitle(data.title)
    if (Array.isArray(data.ingredients)) {
      setIngredientRows(data.ingredients.map(ingredientToRow))
    }
    if (Array.isArray(data.steps)) setSteps(data.steps.join('\n'))
    if (data.image) setImage(data.image)
    setPrepTimeMinutes(typeof data.prepTimeMinutes === 'number' ? data.prepTimeMinutes : null)
    setCookTimeMinutes(typeof data.cookTimeMinutes === 'number' ? data.cookTimeMinutes : null)
    setTotalTimeMinutes(typeof data.totalTimeMinutes === 'number' ? data.totalTimeMinutes : null)
    setServings(typeof data.servings === 'number' ? data.servings : null)
    setMessage('')
    setIsError(false)
    setParsing(false)
    if (data.title) setMode('preview')

    if (data.title && Array.isArray(data.ingredients)) {
      const ingredientLines = formatIngredientLines(data.ingredients).join('\n')
      fetch('/api/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title, ingredients: ingredientLines }),
      })
        .then((r) => r.json())
        .then((tagResult) => {
          if (tagResult.tags) setTags(tagResult.tags)
        })
        .catch((err) => console.error('suggest-tags error:', err))
    }
  }

  const saveRecipe = async () => {
    if (!title) { setMessage(t('addRecipePage.enterTitleError')); setIsError(true); return }
    if (!user) { setMessage(t('addRecipePage.loginRequiredError')); setIsError(true); return }
    setSaving(true)

    const ingredientsToSave = rowsToIngredients(ingredientRows)

    const { error } = await supabase
      .from('recipes')
      .insert([{
        title,
        ingredients: JSON.stringify(ingredientsToSave),
        steps,
        tags,
        source_url: url,
        image,
        prep_time_minutes: prepTimeMinutes,
        cook_time_minutes: cookTimeMinutes,
        total_time_minutes: totalTimeMinutes,
        servings,
        user_id: user.id,
      }])
    if (error) {
      setMessage(`${t('addRecipePage.savingErrorPrefix')} ${error.message}`)
      setIsError(true)
      setSaving(false)
    } else {
      addIngredientsToPantry(formatIngredientLines(ingredientsToSave).join('\n'))
      resetAll()
      setMessage(t('addRecipePage.recipeSaved'))
      setIsError(false)
      setSaving(false)
    }
  }

  const addIngredientsToPantry = async (rawIngredients: string) => {
    if (!user) return
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
            user_id: user.id,
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

  const ingredientPreview = formatIngredientLines(rowsToIngredients(ingredientRows))
  const previewTags = tagList(tags)

  const minLabel = t('recipeDetail.minutesShort')
  const hrLabel = t('recipeDetail.hoursShort')
  const metaSummary = [
    formatMinutesShort(prepTimeMinutes, minLabel, hrLabel) && `${t('addRecipePage.prepShort')} ${formatMinutesShort(prepTimeMinutes, minLabel, hrLabel)}`,
    formatMinutesShort(cookTimeMinutes, minLabel, hrLabel) && `${t('addRecipePage.cookShort')} ${formatMinutesShort(cookTimeMinutes, minLabel, hrLabel)}`,
    servings && `${t('addRecipePage.servesShort')} ${servings}`,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>


      <main style={{ maxWidth: 640, margin: '0 auto', padding: '3rem 1rem' }}>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{
            fontSize: '2.2rem', fontWeight: 600, color: '#2c2c2c', margin: '0 0 0.5rem',
            fontFamily: 'var(--font-newsreader)'
          }}>
            {t('addRecipePage.heading')}
          </h2>
          <p style={{ color: '#8a8378', fontSize: '0.95rem', margin: 0 }}>
            {t('addRecipePage.subtitle')}
          </p>
        </div>

        {/* URL + Parse/Clear */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
          <input
            type="text" placeholder={t('addRecipePage.urlPlaceholder')} value={url}
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
              {parsing ? t('addRecipePage.parsing') : t('addRecipePage.parse')}
            </button>
          ) : (
            <button onClick={resetAll} style={{
              padding: '0.7rem 1.3rem', borderRadius: 10, border: '1.5px solid #e5ddd3',
              background: '#fff', color: '#5a5a5a', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
              whiteSpace: 'nowrap'
            }}>
              {t('addRecipePage.clear')}
            </button>
          )}
        </div>

        {mode === 'input' && (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', fontSize: '0.85rem', color: '#8a8378' }}>
              <span>{t('addRecipePage.tryLabel')}</span>
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: '#fff', border: '1px solid #e5ddd3' }}>
                {t('addRecipePage.tryFoodBlog')}
              </span>
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: 999, background: '#fff', border: '1px solid #e5ddd3' }}>
                {t('addRecipePage.tryInstagram')}
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
                {t('addRecipePage.manualEntryLink')}
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
                    {t('addRecipePage.ingredientsPreviewLabel')}
                  </p>
                  <ul style={{ margin: '0 0 0.9rem', padding: '0 0 0 1.1rem', fontSize: '0.85rem', color: '#3c3c3c', lineHeight: 1.7 }}>
                    {ingredientPreview.slice(0, 5).map((item, i) => <li key={i}>{item}</li>)}
                    {ingredientPreview.length > 5 && (
                      <li style={{ color: '#8a8378', listStyle: 'none', marginLeft: '-1.1rem' }}>
                        {t('addRecipePage.andPrefix')} {ingredientPreview.length - 5} {t('addRecipePage.moreItemsSuffix')}
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
                  {saving ? t('addRecipePage.saving') : `♡ ${t('addRecipePage.saveGood')}`}
                </button>
                <button onClick={() => setMode('edit')} style={{
                  padding: '0.65rem 1.2rem', borderRadius: 999, border: '1.5px solid #d8cfc0',
                  background: '#fff', color: '#3c3c3c', fontSize: '0.9rem',
                  fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)'
                }}>
                  ✎ {t('addRecipePage.manualEdit')}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  padding: '0.4rem 0.8rem', borderRadius: 8, border: '1.5px dashed #d8cfc0',
                  background: 'transparent', color: COLORS.secondary, fontSize: '0.8rem', fontWeight: 600,
                  cursor: uploadingImage ? 'default' : 'pointer', fontFamily: 'var(--font-manrope)'
                }}
              >
                {uploadingImage ? t('addRecipePage.uploading') : `📷 ${t('addRecipePage.uploadPhoto')}`}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
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

            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                style={{
                  padding: '0.4rem 0.8rem', borderRadius: 8, border: '1.5px dashed #d8cfc0',
                  background: 'transparent', color: COLORS.secondary, fontSize: '0.8rem', fontWeight: 600,
                  cursor: uploadingImage ? 'default' : 'pointer', fontFamily: 'var(--font-manrope)'
                }}
              >
                {uploadingImage ? t('addRecipePage.uploading') : `📷 ${t('addRecipePage.uploadPhoto')}`}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </div>

            <input
              type="text" placeholder={t('addRecipePage.titlePlaceholder')} value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ ...inputStyle, fontFamily: 'var(--font-newsreader)', fontSize: '1.1rem' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <input
                type="number" placeholder={t('addRecipePage.prepPlaceholder')} value={prepTimeMinutes ?? ''}
                onChange={(e) => setPrepTimeMinutes(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              />
              <input
                type="number" placeholder={t('addRecipePage.cookPlaceholder')} value={cookTimeMinutes ?? ''}
                onChange={(e) => setCookTimeMinutes(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              />
              <input
                type="number" placeholder={t('addRecipePage.totalPlaceholder')} value={totalTimeMinutes ?? ''}
                onChange={(e) => setTotalTimeMinutes(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              />
              <input
                type="number" placeholder={t('addRecipePage.servingsPlaceholder')} value={servings ?? ''}
                onChange={(e) => setServings(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.4rem' }}>
                {t('addRecipePage.ingredientsLabel')}
              </label>

              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem', padding: '0 0.1rem' }}>
                <span style={{ width: 55, fontSize: '0.65rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase' }}>{t('recipeDetail.qtyColumn')}</span>
                <span style={{ width: 70, fontSize: '0.65rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase' }}>{t('recipeDetail.unitColumn')}</span>
                <span style={{ flex: 1, fontSize: '0.65rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase' }}>{t('recipeDetail.ingredientColumn')}</span>
              </div>

              {ingredientRows.map((row) => (
                <div key={row.id} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="number" step="any" placeholder={t('recipeDetail.qtyPlaceholder')}
                    value={row.quantity}
                    onChange={(e) => updateIngredientRow(row.id, { quantity: e.target.value })}
                    style={{ ...inputStyle, width: 55, padding: '0.4rem 0.5rem' }}
                  />
                  <input
                    type="text" placeholder={t('recipeDetail.unitPlaceholder')}
                    value={row.unit}
                    onChange={(e) => updateIngredientRow(row.id, { unit: e.target.value })}
                    style={{ ...inputStyle, width: 70, padding: '0.4rem 0.5rem' }}
                  />
                  <input
                    type="text" placeholder={t('recipeDetail.ingredientPlaceholder')}
                    value={row.item}
                    onChange={(e) => updateIngredientRow(row.id, { item: e.target.value })}
                    style={{ ...inputStyle, flex: 1, minWidth: 0, padding: '0.4rem 0.5rem' }}
                  />
                  <button
                    onClick={() => removeIngredientRow(row.id)}
                    title={t('recipeDetail.removeIngredient')}
                    style={{
                      flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: '1.5px solid #e5ddd3',
                      background: '#fff', color: COLORS.primary, fontSize: '0.9rem', fontWeight: 600,
                      cursor: 'pointer', lineHeight: 1
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                onClick={addIngredientRow}
                style={{
                  marginTop: '0.25rem', padding: '0.4rem 0.8rem', borderRadius: 8, border: '1.5px dashed #d8cfc0',
                  background: 'transparent', color: COLORS.secondary, fontSize: '0.8rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-manrope)'
                }}
              >
                + {t('recipeDetail.addIngredient')}
              </button>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: '0.4rem' }}>
                {t('addRecipePage.methodLabel')}
              </label>
              <textarea
                placeholder={t('addRecipePage.methodPlaceholder')} value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={8} style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>

            <input
              type="text" placeholder={t('addRecipePage.tagsPlaceholder')} value={tags}
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
                {saving ? t('addRecipePage.saving') : t('addRecipePage.saveRecipe')}
              </button>
              <button onClick={() => setMode(title || url ? 'preview' : 'input')} style={{
                padding: '0.85rem 1.3rem', borderRadius: 999, border: '1.5px solid #d8cfc0',
                background: '#fff', color: '#3c3c3c', fontSize: '0.95rem',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)'
              }}>
                {t('addRecipePage.back')}
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <p style={{
            marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: 10,
            background: isError ? '#fbeae7' : '#eef0e8',
            color: isError ? COLORS.primary : COLORS.secondary,
            fontFamily: 'var(--font-manrope)', fontSize: '0.9rem'
          }}>
            {message}
          </p>
        )}

      </main>
    </div>
  )
}