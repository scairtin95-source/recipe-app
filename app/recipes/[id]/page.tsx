'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'
import CookingMode from './CookingMode'
import { upgradeImageUrl } from '../../../src/lib/imageUrl'


const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

// A structured ingredient produced by the updated parser. Older recipes
// (parsed before this change) store plain strings instead — both shapes
// are supported everywhere below until the migration pass normalizes
// existing recipes.
interface StructuredIngredient {
  quantity: number | null
  unit: string | null
  item: string
  raw: string
  gramsPerUnit: number | null
}

type IngredientEntry = StructuredIngredient | string

function isStructured(entry: IngredientEntry): entry is StructuredIngredient {
  return typeof entry === 'object' && entry !== null && 'item' in entry
}

function parseIngredients(raw: string | null): IngredientEntry[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
        .map((entry): IngredientEntry | null => {
          if (typeof entry === 'string') return entry
          if (entry && typeof entry === 'object' && 'item' in entry) {
            return {
              quantity: typeof entry.quantity === 'number' ? entry.quantity : null,
              unit: entry.unit ?? null,
              item: String(entry.item ?? ''),
              raw: String(entry.raw ?? entry.item ?? ''),
              gramsPerUnit: typeof entry.gramsPerUnit === 'number' ? entry.gramsPerUnit : null,
            }
          }
          return null
        })
        .filter((entry): entry is IngredientEntry => entry !== null && entry !== '')
    }
  } catch {}
  return raw.split('\n').map((s) => s.trim()).filter(Boolean)
}

function parseList(raw: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {}
  return raw.split('\n').map(s => s.trim()).filter(Boolean)
}

// Legacy conversion — regex over raw ingredient/step text. Still used for
// steps (which are always plain text) and for any legacy ingredient lines
// that haven't been migrated to structured form yet.
function convertToImperial(text: string): string {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*ml/g, (_, n) => `${Math.round(parseFloat(n) * 0.034)} fl oz`)
    .replace(/(\d+(?:\.\d+)?)\s*l\b/g, (_, n) => `${Math.round(parseFloat(n) * 4.227)} cups`)
    .replace(/(\d+(?:\.\d+)?)\s*g\b/g, (_, n) => `${Math.round(parseFloat(n) * 0.035)} oz`)
    .replace(/(\d+(?:\.\d+)?)\s*kg/g, (_, n) => `${Math.round(parseFloat(n) * 2.205)} lbs`)
    .replace(/(\d+(?:\.\d+)?)\s*°C/g, (_, n) => `${Math.round(parseFloat(n) * 9/5 + 32)}°F`)
}

// Structured conversion — operates on the actual numeric quantity + unit
// rather than pattern-matching text, so it's exact regardless of how the
// original recipe phrased things.
const UNIT_CONVERSIONS: Record<string, { toUnit: string; factor: number }> = {
  ml: { toUnit: 'fl oz', factor: 0.034 },
  l: { toUnit: 'cups', factor: 4.227 },
  g: { toUnit: 'oz', factor: 0.035 },
  kg: { toUnit: 'lbs', factor: 2.205 },
}

function convertStructuredQuantity(
  quantity: number | null,
  unit: string | null,
  imperial: boolean
): { quantity: number | null; unit: string | null } {
  if (!imperial || quantity === null || !unit) return { quantity, unit }
  const key = unit.toLowerCase().replace(/\.$/, '')
  if (key === '°c' || key === 'c' || key === 'celsius') {
    return { quantity: Math.round(quantity * 9 / 5 + 32), unit: '°F' }
  }
  const conv = UNIT_CONVERSIONS[key]
  if (conv) {
    return { quantity: Math.round(quantity * conv.factor * 100) / 100, unit: conv.toUnit }
  }
  return { quantity, unit }
}

// Cooking measurements (cups, tbsp, tsp) are conventionally read as
// fractions, not decimals — "1½ cups" reads naturally, "1.5 cups" doesn't.
// Everything else (weights, volumes in ml/l, plain counts) is rounded to a
// clean decimal instead, since fractions of a gram aren't meaningful.
const FRACTION_UNITS = new Set(['cup', 'cups', 'tbsp', 'tablespoon', 'tsp', 'teaspoon'])
const NICE_FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'],
  [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞'],
]

function formatAsFraction(qty: number): string {
  if (qty <= 0) return '0'
  const whole = Math.floor(qty + 1e-6)
  const frac = qty - whole
  if (frac < 0.05) return String(whole || 0)
  let closest = NICE_FRACTIONS[0]
  let minDiff = Math.abs(frac - closest[0])
  for (const f of NICE_FRACTIONS) {
    const diff = Math.abs(frac - f[0])
    if (diff < minDiff) { minDiff = diff; closest = f }
  }
  // Fraction rounded up to a whole number (e.g. 0.96 → nearest is "1", not a fraction glyph)
  if (closest[0] >= 0.95) return String(whole + 1)
  return whole > 0 ? `${whole}${closest[1]}` : closest[1]
}

function formatDecimal(qty: number): string {
  const rounded = qty < 10 ? Math.round(qty * 100) / 100 : Math.round(qty * 10) / 10
  return String(rounded)
}

function formatQuantityForDisplay(qty: number, unit: string | null): string {
  if (unit && FRACTION_UNITS.has(unit.toLowerCase())) {
    return formatAsFraction(qty)
  }
  return formatDecimal(qty)
}

function formatIngredientLine(entry: IngredientEntry, imperial: boolean, scale: number): string {
  if (!isStructured(entry)) {
    // Legacy plain-text lines can't be scaled (no isolated quantity to
    // multiply) — shown as-is regardless of the scale factor.
    return imperial ? convertToImperial(entry) : entry
  }
  if (entry.quantity === null) {
    // No clean quantity at all — can't scale a vague amount like "a pinch"
    // or "to taste".
    return imperial ? convertToImperial(entry.raw || entry.item) : (entry.raw || entry.item)
  }
  const scaledQuantity = entry.quantity * scale
  if (!entry.unit) {
    // Countable item with no unit (e.g. "2 onions", "3 eggs") — scales
    // fine by simple multiplication, just has no unit to convert.
    return `${formatQuantityForDisplay(scaledQuantity, null)} ${entry.item}`.trim()
  }
  const { quantity, unit } = convertStructuredQuantity(scaledQuantity, entry.unit, imperial)
  if (quantity === null) return `${entry.item}`.trim()
  return `${formatQuantityForDisplay(quantity, unit)} ${unit} ${entry.item}`.trim()
}

function tagList(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

function decodeHtmlEntities(text: string | null): string {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseIntOrNull(value: string): number | null {
  const n = parseInt(value, 10)
  return isNaN(n) || n <= 0 ? null : n
}

// --- Edit-mode ingredient row helpers -------------------------------------
//
// Each row holds quantity/unit/item as separate editable fields so a
// structured ingredient never has to collapse into free text just to be
// edited. A row only "downgrades" to a legacy plain-string ingredient if
// its quantity field is left blank when saved.

interface EditIngredientRow {
  id: string
  quantity: string   // string for controlled input; '' means "no quantity"
  unit: string
  item: string
  gramsPerUnit: number | null
  originalUnit: string | null // used to decide whether gramsPerUnit is still valid
}

let rowIdCounter = 0
function newRowId(): string {
  rowIdCounter += 1
  return `row-${Date.now()}-${rowIdCounter}`
}

function ingredientToRow(entry: IngredientEntry): EditIngredientRow {
  if (isStructured(entry)) {
    return {
      id: newRowId(),
      quantity: entry.quantity !== null ? String(entry.quantity) : '',
      unit: entry.unit ?? '',
      item: entry.item,
      gramsPerUnit: entry.gramsPerUnit,
      originalUnit: entry.unit ?? null,
    }
  }
  return {
    id: newRowId(),
    quantity: '',
    unit: '',
    item: entry,
    gramsPerUnit: null,
    originalUnit: null,
  }
}

// Converts the edit rows back into IngredientEntry[] for saving. A row
// with a valid quantity becomes a structured entry (preserving
// gramsPerUnit if the unit wasn't changed); a row with a blank quantity
// becomes a plain string. Rows with no item text at all are dropped.
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
        const gramsPerUnit = unit === row.originalUnit ? row.gramsPerUnit : null
        return { quantity: qtyNum, unit, item, raw, gramsPerUnit }
      }
      return item
    })
}

function canonicalizeIngredient(entry: IngredientEntry): string {
  if (isStructured(entry)) {
    return JSON.stringify({
      q: entry.quantity,
      u: entry.unit ? entry.unit.toLowerCase().trim() : null,
      i: entry.item.trim().toLowerCase(),
    })
  }
  return JSON.stringify({ q: null, u: null, i: entry.trim().toLowerCase() })
}

function ingredientsEqual(a: IngredientEntry[], b: IngredientEntry[]): boolean {
  if (a.length !== b.length) return false
  return a.every((entry, i) => canonicalizeIngredient(entry) === canonicalizeIngredient(b[i]))
}

// The "missing image" fallback uses the actual Oliva logo mark rather than
// an emoji or generic icon — some browsers/OS combos (older Windows Chrome
// in particular) don't have a font covering newer emoji like 🫒 and render
// an empty box instead, while a real image file renders identically
// everywhere and doubles as a nice bit of branding on empty states.
function ImageOffIcon({ size = 40 }: { size?: number }) {
  return (
    <img
      src="/oliva-icon.png"
      alt=""
      style={{ width: size, height: size, objectFit: 'contain', opacity: 0.5 }}
    />
  )
}

// Below this size, an image is almost certainly a hotlink-protection
// placeholder rather than a real photo.
const BROKEN_IMAGE_THRESHOLD = 150

// Below this width or height, a real photo exists but doesn't have enough
// resolution to fill the hero container edge-to-edge without visible
// upscaling/blur. Rather than stretch it, it's shown at native size,
// centered, letterboxed on the surrounding placeholder background.
// Thresholds approximate the hero's typical rendered size (~700px wide,
// fixed 280px tall) rather than measuring the live container — a
// borderline image might letterbox on desktop when it would've fit fine
// on a narrower mobile layout, but erring toward letterbox over blur is
// the safer trade either way.
const LOW_RES_WIDTH_THRESHOLD = 700
const LOW_RES_HEIGHT_THRESHOLD = 280

// Renders a recipe image with graceful fallback — handles both genuinely
// broken URLs (onError, e.g. Facebook/Instagram hotlink protection
// blocking the request) and "hotlink protection" placeholder images some
// sites serve instead of the real photo, which load successfully but are
// suspiciously small (caught via onLoad). "compact" is a plain icon for
// small card thumbnails; "full" (used on the recipe detail hero) shows an
// explanatory message too, since there's enough room for it there. Photos
// that load fine but are too low-res to fill the hero without blurring are
// letterboxed at native size instead of stretched.
function RecipeImage({
  src, alt, size = 48, variant = 'compact'
}: { src: string | null; alt: string; size?: number; variant?: 'compact' | 'full' }) {
  const [broken, setBroken] = useState(false)
  const [lowRes, setLowRes] = useState(false)
  const failed = !src || broken

  if (failed && variant === 'full') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', padding: '1rem', textAlign: 'center' }}>
        <ImageOffIcon size={44} />
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: COLORS.secondary, fontFamily: 'var(--font-manrope)' }}>
          {src ? "Photo couldn't be loaded" : 'No photo for this one yet'}
        </p>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#8a8378', fontFamily: 'var(--font-manrope)', maxWidth: 260 }}>
          {src
            ? "The original source is blocking this image from loading here."
            : 'This recipe was saved without a photo.'}
        </p>
      </div>
    )
  }

  if (failed) {
    return <ImageOffIcon size={size} />
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setBroken(true)}
      onLoad={(e) => {
        const img = e.currentTarget
        if (img.naturalWidth < BROKEN_IMAGE_THRESHOLD || img.naturalHeight < BROKEN_IMAGE_THRESHOLD) {
          setBroken(true)
          return
        }
        // Only letterbox on the full hero — compact card thumbnails are
        // small enough that native resolution basically never falls short.
        if (variant === 'full' && (img.naturalWidth < LOW_RES_WIDTH_THRESHOLD || img.naturalHeight < LOW_RES_HEIGHT_THRESHOLD)) {
          setLowRes(true)
        }
      }}
      style={
        lowRes
          ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }
          : { width: '100%', height: '100%', objectFit: 'cover' }
      }
    />
  )
}

function formatMinutes(mins: number | null | undefined): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`
}

// Shared input style for the edit form
const editInputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.7rem', borderRadius: 8,
  border: '1.5px solid #e5ddd3', fontFamily: 'var(--font-manrope)',
  fontSize: '0.9rem', color: '#2c2c2c', background: '#fff', boxSizing: 'border-box'
}

const editLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem', fontWeight: 700, color: COLORS.tertiary,
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem', display: 'block'
}

export default function RecipePage() {
  const { id } = useParams()
  const [recipe, setRecipe] = useState<any>(null)
  const [imperial, setImperial] = useState(false)
  const [scale, setScale] = useState(1)
  const [collections, setCollections] = useState<{ id: number; name: string }[]>([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [cookingMode, setCookingMode] = useState(false)

  const [estimatingCalories, setEstimatingCalories] = useState(false)
  const [calorieNote, setCalorieNote] = useState<string | null>(null)

  // Edit mode state
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editImage, setEditImage] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editIngredientRows, setEditIngredientRows] = useState<EditIngredientRow[]>([])
  const [originalIngredientsSnapshot, setOriginalIngredientsSnapshot] = useState<IngredientEntry[]>([])
  const [editStepsText, setEditStepsText] = useState('')
  const [editPrepTime, setEditPrepTime] = useState('')
  const [editCookTime, setEditCookTime] = useState('')
  const [editTotalTime, setEditTotalTime] = useState('')
  const [editServings, setEditServings] = useState('')

  useEffect(() => {
    const fetchRecipe = async () => {
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('id', id)
        .single()
      setRecipe(data)
    }
    fetchRecipe()
  }, [id])

  useEffect(() => {
    const fetchCollections = async () => {
      const { data } = await supabase.from('collections').select('id, name').order('name')
      if (data) setCollections(data)
    }
    fetchCollections()
  }, [])

  const addToCollection = async () => {
    if (!selectedCollection || !recipe) return
    const { error } = await supabase
      .from('collection_recipes')
      .insert([{ collection_id: Number(selectedCollection), recipe_id: Number(recipe.id) }])
    if (error) {
      setAddStatus('Error adding')
    } else {
      setAddStatus('Added!')
      setSelectedCollection('')
    }
  }

  const estimateCalories = async () => {
    if (!recipe) return

    // Estimating without a known serving count would silently divide the
    // WHOLE recipe's calories by 1 and label it "per serving" — badly
    // misleading for anything but a single-portion recipe. Ask instead of
    // guessing, and save the answer so the Servings badge is fixed too.
    let servingsToUse = recipe.servings ?? null
    if (!servingsToUse) {
      const input = window.prompt(
        "This recipe doesn't have a servings count yet, so a calorie estimate would be misleading (it'd show the whole recipe's total, not a per-serving figure).\n\nHow many servings does this recipe make?"
      )
      const parsed = input ? parseInt(input, 10) : NaN
      if (!input || isNaN(parsed) || parsed <= 0) {
        setCalorieNote('Estimate cancelled — a valid servings count is needed first.')
        return
      }
      servingsToUse = parsed
      await supabase.from('recipes').update({ servings: parsed }).eq('id', recipe.id)
      setRecipe((prev: any) => ({ ...prev, servings: parsed }))
    }

    const parsedIngredients = parseIngredients(recipe.ingredients)

    // Only structured entries carry quantity/unit — legacy plain-string
    // ingredients get passed through with nulls, which the API will
    // simply skip rather than guess at.
    const apiIngredients: StructuredIngredient[] = parsedIngredients.map((entry) =>
      isStructured(entry)
        ? entry
        : { quantity: null, unit: null, item: entry, raw: entry, gramsPerUnit: null }
    )

    if (apiIngredients.length === 0) {
      setCalorieNote('No ingredients to estimate from.')
      return
    }

    setEstimatingCalories(true)
    setCalorieNote(null)

    try {
      const res = await fetch('/api/estimate-calories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredients: apiIngredients, servings: servingsToUse }),
      })
      const result = await res.json()

      if (result.estimatedCaloriesPerServing == null) {
        setCalorieNote(result.error || "Couldn't estimate calories for this recipe.")
      } else {
        await supabase
          .from('recipes')
          .update({
            estimated_calories_per_serving: result.estimatedCaloriesPerServing,
            estimated_protein_g_per_serving: result.estimatedProteinGPerServing,
            estimated_fat_g_per_serving: result.estimatedFatGPerServing,
            estimated_carbs_g_per_serving: result.estimatedCarbsGPerServing,
          })
          .eq('id', recipe.id)

        setRecipe((prev: any) => ({
          ...prev,
          estimated_calories_per_serving: result.estimatedCaloriesPerServing,
          estimated_protein_g_per_serving: result.estimatedProteinGPerServing,
          estimated_fat_g_per_serving: result.estimatedFatGPerServing,
          estimated_carbs_g_per_serving: result.estimatedCarbsGPerServing,
        }))

        const parts = [`Based on ${result.matchedCount} of ${result.totalCount} ingredients`]
        if (!result.servingsWasKnown) parts.push('servings unknown — treated as 1')
        setCalorieNote(parts.join(' · '))
      }
    } catch (err) {
      console.error('estimateCalories error:', err)
      setCalorieNote('Something went wrong estimating calories.')
    }

    setEstimatingCalories(false)
  }

  // Populates the edit form from the currently loaded recipe and switches
  // into edit mode. Scale is reset to 1x since ingredient amounts shown
  // while editing are always the base (unscaled) quantities.
  const startEdit = () => {
    if (!recipe) return
    const currentIngredients = parseIngredients(recipe.ingredients)
    const currentSteps = parseList(recipe.steps)

    setEditTitle(decodeHtmlEntities(recipe.title))
    setEditImage(recipe.image || '')
    setEditTags(tagList(recipe.tags).join(', '))
    setEditIngredientRows(currentIngredients.map(ingredientToRow))
    setOriginalIngredientsSnapshot(currentIngredients)
    setEditStepsText(currentSteps.join('\n'))
    setEditPrepTime(recipe.prep_time_minutes ? String(recipe.prep_time_minutes) : '')
    setEditCookTime(recipe.cook_time_minutes ? String(recipe.cook_time_minutes) : '')
    setEditTotalTime(recipe.total_time_minutes ? String(recipe.total_time_minutes) : '')
    setEditServings(recipe.servings ? String(recipe.servings) : '')
    setScale(1)
    setEditMode(true)
  }

  const cancelEdit = () => {
    setEditMode(false)
  }

  const addIngredientRow = () => {
    setEditIngredientRows((prev) => [
      ...prev,
      { id: newRowId(), quantity: '', unit: '', item: '', gramsPerUnit: null, originalUnit: null },
    ])
  }

  const removeIngredientRow = (rowId: string) => {
    setEditIngredientRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  const updateIngredientRow = (rowId: string, patch: Partial<EditIngredientRow>) => {
    setEditIngredientRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...patch } : r)))
  }

  const saveEdit = async () => {
    if (!recipe) return
    setSaving(true)

    const newIngredients = rowsToIngredients(editIngredientRows)
    const newStepLines = editStepsText.split('\n').map(s => s.trim()).filter(Boolean)
    const ingredientsChanged = !ingredientsEqual(originalIngredientsSnapshot, newIngredients)

    const updateObj: any = {
      title: editTitle.trim() || recipe.title,
      image: editImage.trim() || null,
      tags: editTags.split(',').map(t => t.trim()).filter(Boolean).join(', '),
      ingredients: JSON.stringify(newIngredients),
      steps: JSON.stringify(newStepLines),
      prep_time_minutes: parseIntOrNull(editPrepTime),
      cook_time_minutes: parseIntOrNull(editCookTime),
      total_time_minutes: parseIntOrNull(editTotalTime),
      servings: parseIntOrNull(editServings),
    }

    // Ingredients changed → the existing calorie/macro estimate no longer
    // reflects what's actually in the recipe, so clear it rather than
    // leave a stale, now-inaccurate figure displayed.
    if (ingredientsChanged) {
      updateObj.estimated_calories_per_serving = null
      updateObj.estimated_protein_g_per_serving = null
      updateObj.estimated_fat_g_per_serving = null
      updateObj.estimated_carbs_g_per_serving = null
    }

    const { error } = await supabase.from('recipes').update(updateObj).eq('id', recipe.id)

    if (error) {
      console.error('saveEdit error:', error)
      alert('Something went wrong saving your changes. Please try again.')
    } else {
      setRecipe((prev: any) => ({ ...prev, ...updateObj }))
      if (ingredientsChanged) setCalorieNote(null)
      setEditMode(false)
    }

    setSaving(false)
  }

  if (!recipe) return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#8a8378', fontFamily: 'var(--font-manrope)' }}>Loading…</p>
    </div>
  )

  const ingredients = parseIngredients(recipe.ingredients)
  const steps = parseList(recipe.steps)

  const prepTime = formatMinutes(recipe.prep_time_minutes)
  const cookTime = formatMinutes(recipe.cook_time_minutes)
  const totalTime = formatMinutes(recipe.total_time_minutes)
  const servings = recipe.servings ?? null
  const calories = recipe.estimated_calories_per_serving ?? null
  const proteinG = recipe.estimated_protein_g_per_serving ?? null
  const fatG = recipe.estimated_fat_g_per_serving ?? null
  const carbsG = recipe.estimated_carbs_g_per_serving ?? null

  const metaBadges: { label: string; value: string }[] = []
  if (prepTime) metaBadges.push({ label: 'Prep', value: prepTime })
  if (cookTime) metaBadges.push({ label: 'Cook', value: cookTime })
  if (totalTime) metaBadges.push({ label: 'Total', value: totalTime })
  if (servings) metaBadges.push({ label: 'Servings', value: String(servings) })
  if (calories) metaBadges.push({ label: 'Calories', value: `~${calories} / serving` })

  // Flat text lines for Cooking Mode, which expects string[] — derived
  // from the same structured/legacy data so both views always agree.
  const ingredientLines = ingredients.map((entry) => formatIngredientLine(entry, imperial, scale))

  // Live change-detection while editing, used to show the "estimate will
  // be cleared" hint before the person actually hits Save.
  const editIngredientsChanged = editMode
    ? !ingredientsEqual(originalIngredientsSnapshot, rowsToIngredients(editIngredientRows))
    : false

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '2.5rem 1rem' }}>

        {/* Image */}
        <div style={{ width: '100%', height: 280, overflow: 'hidden', borderRadius: 16, marginBottom: '1.5rem', border: '1px solid #eee3d8', background: '#f1e9dd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RecipeImage src={upgradeImageUrl(editMode ? editImage : recipe.image)} alt={decodeHtmlEntities(recipe.title)} variant="full" />
        </div>

        {/* Title row + Edit toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: editMode ? '1rem' : '0.5rem' }}>
          {editMode ? (
            <div style={{ flex: 1 }}>
              <label style={editLabelStyle}>Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ ...editInputStyle, fontSize: '1.3rem', fontFamily: 'var(--font-newsreader)', fontWeight: 600 }}
              />
            </div>
          ) : (
            <h1 style={{
              fontSize: '2rem', fontWeight: 600, color: '#2c2c2c', margin: 0, lineHeight: 1.3,
              fontFamily: 'var(--font-newsreader)'
            }}>
              {decodeHtmlEntities(recipe.title)}
            </h1>
          )}

          {!editMode && (
            <button
              onClick={startEdit}
              style={{
                flexShrink: 0, padding: '0.4rem 0.9rem', borderRadius: 8, border: '1.5px solid #eee3d8',
                background: '#fff', color: COLORS.secondary, fontSize: '0.8rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-manrope)', whiteSpace: 'nowrap'
              }}
            >
              ✎ Edit recipe
            </button>
          )}
        </div>

        {editMode ? (
          <>
            {/* Image URL */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={editLabelStyle}>Image URL</label>
              <input
                type="text"
                value={editImage}
                onChange={(e) => setEditImage(e.target.value)}
                placeholder="https://…"
                style={editInputStyle}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={editLabelStyle}>Tags (comma separated)</label>
              <input
                type="text"
                value={editTags}
                onChange={(e) => setEditTags(e.target.value)}
                placeholder="breakfast, healthy, quick"
                style={editInputStyle}
              />
            </div>

            {/* Time + servings row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={editLabelStyle}>Prep (min)</label>
                <input type="number" min={0} value={editPrepTime} onChange={(e) => setEditPrepTime(e.target.value)} style={editInputStyle} />
              </div>
              <div>
                <label style={editLabelStyle}>Cook (min)</label>
                <input type="number" min={0} value={editCookTime} onChange={(e) => setEditCookTime(e.target.value)} style={editInputStyle} />
              </div>
              <div>
                <label style={editLabelStyle}>Total (min)</label>
                <input type="number" min={0} value={editTotalTime} onChange={(e) => setEditTotalTime(e.target.value)} style={editInputStyle} />
              </div>
              <div>
                <label style={editLabelStyle}>Servings</label>
                <input type="number" min={0} value={editServings} onChange={(e) => setEditServings(e.target.value)} style={editInputStyle} />
              </div>
            </div>

            {/* Ingredients editor — per-row quantity/unit/item so
                structured ingredients never have to collapse into free
                text just to be edited. Only rows left with a blank
                quantity become plain legacy strings. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #eee3d8' }}>
                <label style={editLabelStyle}>Ingredients</label>
                <p style={{ fontSize: '0.72rem', color: '#8a8378', margin: '0 0 0.85rem', lineHeight: 1.5 }}>
                  Leave quantity blank for vague lines like "salt to taste." Otherwise, quantity + unit stay structured so scaling and unit conversion keep working.
                </p>

                <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.35rem', padding: '0 0.1rem' }}>
                  <span style={{ width: 55, fontSize: '0.65rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase' }}>Qty</span>
                  <span style={{ width: 70, fontSize: '0.65rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase' }}>Unit</span>
                  <span style={{ flex: 1, fontSize: '0.65rem', fontWeight: 700, color: '#8a8378', textTransform: 'uppercase' }}>Ingredient</span>
                </div>

                {editIngredientRows.map((row) => (
                  <div key={row.id} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      step="any"
                      placeholder="—"
                      value={row.quantity}
                      onChange={(e) => updateIngredientRow(row.id, { quantity: e.target.value })}
                      style={{ ...editInputStyle, width: 55, padding: '0.4rem 0.5rem' }}
                    />
                    <input
                      type="text"
                      placeholder="unit"
                      value={row.unit}
                      onChange={(e) => updateIngredientRow(row.id, { unit: e.target.value })}
                      style={{ ...editInputStyle, width: 70, padding: '0.4rem 0.5rem' }}
                    />
                    <input
                      type="text"
                      placeholder="ingredient"
                      value={row.item}
                      onChange={(e) => updateIngredientRow(row.id, { item: e.target.value })}
                      style={{ ...editInputStyle, flex: 1, padding: '0.4rem 0.5rem' }}
                    />
                    <button
                      onClick={() => removeIngredientRow(row.id)}
                      title="Remove ingredient"
                      style={{
                        flexShrink: 0, width: 28, height: 28, borderRadius: 6, border: '1.5px solid #eee3d8',
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
                    marginTop: '0.5rem', padding: '0.4rem 0.8rem', borderRadius: 8, border: '1.5px dashed #d8cfc0',
                    background: 'transparent', color: COLORS.secondary, fontSize: '0.8rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-manrope)'
                  }}
                >
                  + Add ingredient
                </button>
              </div>

              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #eee3d8' }}>
                <label style={editLabelStyle}>Method (one step per line)</label>
                <textarea
                  value={editStepsText}
                  onChange={(e) => setEditStepsText(e.target.value)}
                  rows={16}
                  style={{ ...editInputStyle, resize: 'vertical', lineHeight: 1.6 }}
                />
              </div>
            </div>

            {editIngredientsChanged && (
              <p style={{ fontSize: '0.75rem', color: '#8a8378', fontStyle: 'italic', margin: '-1rem 0 1rem' }}>
                Ingredients changed — the saved calorie estimate will be cleared so it doesn't show a stale figure.
              </p>
            )}

            {/* Save / Cancel */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <button
                onClick={saveEdit}
                disabled={saving}
                style={{
                  padding: '0.7rem 1.4rem', borderRadius: 999, border: 'none',
                  background: COLORS.primary, color: '#fff', fontSize: '0.9rem', fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-manrope)',
                  opacity: saving ? 0.6 : 1
                }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                onClick={cancelEdit}
                disabled={saving}
                style={{
                  padding: '0.7rem 1.4rem', borderRadius: 999, border: '1.5px solid #eee3d8',
                  background: '#fff', color: COLORS.secondary, fontSize: '0.9rem', fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font-manrope)'
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            {recipe.source_url && (
              <a href={recipe.source_url} target="_blank" style={{
                display: 'inline-block',
                color: COLORS.primary,
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontFamily: 'var(--font-manrope)',
                fontWeight: 600,
                marginBottom: '1rem'
              }}>
                View original ↗
              </a>
            )}

            {/* Meta badges: prep/cook/total time, servings, calories — only
                rendered once the parser/migration has populated them */}
            {metaBadges.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.5rem' }}>
                {metaBadges.map((badge) => (
                  <div key={badge.label} style={{
                    background: '#fff', border: '1px solid #eee3d8', borderRadius: 10,
                    padding: '0.5rem 0.9rem', display: 'flex', flexDirection: 'column', gap: '0.1rem'
                  }}>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, color: COLORS.tertiary,
                      textTransform: 'uppercase', letterSpacing: '0.06em'
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2c2c2c' }}>
                      {badge.value}
                    </span>
                  </div>
                ))}
                {calories !== null && (
                  <span style={{
                    alignSelf: 'center', fontSize: '0.7rem', color: '#8a8378', fontStyle: 'italic'
                  }}>
                    estimate
                  </span>
                )}
              </div>
            )}

            {/* Macro breakdown — only shown once an estimate exists, sits
                right under the badge row */}
            {(proteinG !== null || fatG !== null || carbsG !== null) && (
              <p style={{ fontSize: '0.8rem', color: '#8a8378', margin: '0 0 0.5rem' }}>
                {[
                  proteinG !== null && `Protein ${proteinG}g`,
                  carbsG !== null && `Carbs ${carbsG}g`,
                  fatG !== null && `Fat ${fatG}g`,
                ].filter(Boolean).join(' · ')}
              </p>
            )}

            {/* Estimate calories button — only shown when we don't already
                have a figure, and there's at least one ingredient to work from */}
            {calories === null && ingredients.length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <button
                  onClick={estimateCalories}
                  disabled={estimatingCalories}
                  style={{
                    padding: '0.45rem 0.9rem', borderRadius: 8, border: '1.5px solid #eee3d8',
                    background: '#fff', color: COLORS.secondary, fontSize: '0.8rem', fontWeight: 600,
                    cursor: estimatingCalories ? 'default' : 'pointer', fontFamily: 'var(--font-manrope)',
                    opacity: estimatingCalories ? 0.6 : 1
                  }}
                >
                  {estimatingCalories ? 'Estimating…' : '🔥 Estimate calories'}
                </button>
                {calorieNote && (
                  <p style={{ fontSize: '0.75rem', color: '#8a8378', margin: '0.4rem 0 0' }}>
                    {calorieNote}
                  </p>
                )}
              </div>
            )}

            {/* Add to Collection */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem',
              background: '#fff', border: '1px solid #eee3d8', borderRadius: 12, padding: '0.75rem 1rem'
            }}>
              <span style={{ fontSize: '0.85rem', color: COLORS.secondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Add to collection:
              </span>
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                style={{
                  flex: 1, padding: '0.4rem 0.6rem', borderRadius: 8,
                  border: '1.5px solid #e5ddd3', fontFamily: 'var(--font-manrope)',
                  fontSize: '0.85rem', color: '#2c2c2c', background: '#fff'
                }}
              >
                <option value="">Select a collection…</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button
                onClick={addToCollection}
                disabled={!selectedCollection}
                style={{
                  padding: '0.4rem 1rem', borderRadius: 8, border: 'none',
                  background: COLORS.secondary, color: '#fff', fontSize: '0.85rem',
                  fontWeight: 600, cursor: selectedCollection ? 'pointer' : 'not-allowed',
                  opacity: selectedCollection ? 1 : 0.5, fontFamily: 'var(--font-manrope)'
                }}
              >
                Add
              </button>
              {addStatus && (
                <span style={{ fontSize: '0.8rem', color: COLORS.secondary, whiteSpace: 'nowrap' }}>
                  {addStatus}
                </span>
              )}
            </div>

            <button
              onClick={() => setCookingMode(true)}
              style={{
                display: 'block', width: '100%', padding: '0.85rem',
                borderRadius: 999, border: 'none', background: COLORS.primary,
                color: '#fff', fontSize: '0.95rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-manrope)',
                marginBottom: '1.5rem'
              }}
            >
              Start Cooking Mode
            </button>

            {/* Tags */}
            {tagList(recipe.tags).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1.5rem' }}>
                {tagList(recipe.tags).map((tag, i) => (
                  <span key={i} style={{
                    fontSize: '0.8rem', padding: '0.25rem 0.75rem', borderRadius: 999,
                    background: '#efe6d8', color: COLORS.tertiary,
                    fontFamily: 'var(--font-manrope)', fontWeight: 500
                  }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Units toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', fontFamily: 'var(--font-manrope)' }}>
              <span style={{ fontSize: '0.85rem', color: COLORS.secondary, fontWeight: 500 }}>Units:</span>
              <button
                onClick={() => setImperial(false)}
                style={{
                  padding: '0.3rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 500,
                  background: !imperial ? COLORS.secondary : '#efe6d8',
                  color: !imperial ? '#fff' : COLORS.secondary
                }}>
                Metric
              </button>
              <button
                onClick={() => setImperial(true)}
                style={{
                  padding: '0.3rem 0.9rem', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: '0.85rem', fontWeight: 500,
                  background: imperial ? COLORS.secondary : '#efe6d8',
                  color: imperial ? '#fff' : COLORS.secondary
                }}>
                Imperial
              </button>
            </div>

            {/* Scale control — only affects ingredient quantities, never
                method steps, time, or temperature (those don't scale linearly).
                Hidden entirely in edit mode — editing always shows base 1x amounts. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '2rem', fontFamily: 'var(--font-manrope)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', color: COLORS.secondary, fontWeight: 500 }}>Scale:</span>
              {[0.5, 1, 2, 3].map((mult) => (
                <button
                  key={mult}
                  onClick={() => setScale(mult)}
                  style={{
                    padding: '0.3rem 0.8rem', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 500,
                    background: scale === mult ? COLORS.secondary : '#efe6d8',
                    color: scale === mult ? '#fff' : COLORS.secondary
                  }}>
                  {mult}×
                </button>
              ))}
              <input
                type="number"
                min={0.1}
                step={0.25}
                value={scale}
                onChange={(e) => {
                  const val = parseFloat(e.target.value)
                  if (!isNaN(val) && val > 0) setScale(val)
                }}
                style={{
                  width: 70, padding: '0.3rem 0.6rem', borderRadius: 8,
                  border: '1.5px solid #e5ddd3', fontFamily: 'var(--font-manrope)',
                  fontSize: '0.85rem', color: '#2c2c2c', background: '#fff'
                }}
              />
              {servings && (
                <span style={{ fontSize: '0.8rem', color: '#8a8378' }}>
                  ≈ {Math.round(servings * scale)} servings
                </span>
              )}
            </div>

            {scale !== 1 && (
              <p style={{ fontSize: '0.75rem', color: '#8a8378', fontStyle: 'italic', margin: '-1.25rem 0 2rem' }}>
                Cook time and oven temperature aren't adjusted automatically — a larger or smaller batch may need more or less time in the oven or on the stove.
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem' }}>

              {/* Ingredients */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #eee3d8' }}>
                <h2 style={{
                  fontSize: '0.85rem', fontWeight: 600, color: COLORS.tertiary,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '1rem', fontFamily: 'var(--font-manrope)', margin: '0 0 1rem'
                }}>
                  Ingredients
                </h2>
                <ul style={{ margin: 0, padding: '0 0 0 1.2rem', listStyle: 'disc' }}>
                  {ingredientLines.length > 0 ? ingredientLines.map((line, i) => (
                    <li key={i} style={{ fontSize: '0.9rem', color: '#3c3c3c', lineHeight: 1.8, marginBottom: '0.25rem' }}>
                      {line}
                    </li>
                  )) : <li style={{ color: '#8a8378', fontSize: '0.9rem' }}>No ingredients saved.</li>}
                </ul>
              </div>

              {/* Method */}
              <div style={{ background: '#fff', borderRadius: 16, padding: '1.5rem', border: '1px solid #eee3d8' }}>
                <h2 style={{
                  fontSize: '0.85rem', fontWeight: 600, color: COLORS.tertiary,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '1rem', fontFamily: 'var(--font-manrope)', margin: '0 0 1rem'
                }}>
                  Method
                </h2>
                <ol style={{ margin: 0, padding: '0 0 0 1.5rem', listStyleType: 'decimal' }}>
                  {steps.length > 0 ? steps.map((step, i) => (
                    <li key={i} style={{ fontSize: '0.9rem', color: '#3c3c3c', lineHeight: 1.8, marginBottom: '0.75rem' }}>
                      {imperial ? convertToImperial(step) : step}
                    </li>
                  )) : <li style={{ color: '#8a8378', fontSize: '0.9rem' }}>No steps saved.</li>}
                </ol>
              </div>

            </div>
          </>
        )}
      </main>

      {cookingMode && (
        <CookingMode
          title={decodeHtmlEntities(recipe.title)}
          image={recipe.image}
          ingredients={ingredientLines}
          steps={steps}
          onClose={() => setCookingMode(false)}
        />
      )}
    </div>
  )
}