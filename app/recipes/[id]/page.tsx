'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'
import CookingMode from './CookingMode'


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

function formatIngredientLine(entry: IngredientEntry, imperial: boolean): string {
  if (!isStructured(entry)) {
    return imperial ? convertToImperial(entry) : entry
  }
  if (entry.quantity === null || !entry.unit) {
    // No clean quantity/unit split available — fall back to the raw text,
    // still passed through the legacy converter in case it contains units.
    return imperial ? convertToImperial(entry.raw || entry.item) : (entry.raw || entry.item)
  }
  const { quantity, unit } = convertStructuredQuantity(entry.quantity, entry.unit, imperial)
  return `${quantity} ${unit} ${entry.item}`.trim()
}

function tagList(tags: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

function formatMinutes(mins: number | null | undefined): string | null {
  if (!mins || mins <= 0) return null
  if (mins < 60) return `${mins} min`
  const hours = Math.floor(mins / 60)
  const rest = mins % 60
  return rest > 0 ? `${hours} hr ${rest} min` : `${hours} hr`
}

export default function RecipePage() {
  const { id } = useParams()
  const [recipe, setRecipe] = useState<any>(null)
  const [imperial, setImperial] = useState(false)
  const [collections, setCollections] = useState<{ id: number; name: string }[]>([])
  const [selectedCollection, setSelectedCollection] = useState('')
  const [addStatus, setAddStatus] = useState('')
  const [cookingMode, setCookingMode] = useState(false)

  const [estimatingCalories, setEstimatingCalories] = useState(false)
  const [calorieNote, setCalorieNote] = useState<string | null>(null)

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
        body: JSON.stringify({ ingredients: apiIngredients, servings: recipe.servings ?? null }),
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
  const ingredientLines = ingredients.map((entry) => formatIngredientLine(entry, imperial))

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>

      <main style={{ maxWidth: 780, margin: '0 auto', padding: '2.5rem 1rem' }}>

        {/* Image — contained, not full width */}
        {recipe.image && (
          <div style={{ width: '100%', height: 280, overflow: 'hidden', borderRadius: 16, marginBottom: '1.5rem', border: '1px solid #eee3d8' }}>
            <img src={recipe.image} alt={recipe.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Title */}
        <h1 style={{
          fontSize: '2rem', fontWeight: 600, color: '#2c2c2c', marginBottom: '0.5rem', lineHeight: 1.3,
          fontFamily: 'var(--font-newsreader)'
        }}>
          {recipe.title}
        </h1>

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
      </main>

      {cookingMode && (
        <CookingMode
          title={recipe.title}
          image={recipe.image}
          ingredients={ingredientLines}
          steps={steps}
          onClose={() => setCookingMode(false)}
        />
      )}
    </div>
  )
}
