'use client'

import { useState } from 'react'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
}

interface CookingModeProps {
  title: string
  image: string | null
  ingredients: string[]
  steps: string[]
  onClose: () => void
}

export default function CookingMode({ title, image, ingredients, steps, onClose }: CookingModeProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [checked, setChecked] = useState<Record<number, boolean>>({})

  const toggleIngredient = (i: number) => {
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }))
  }

  const progress = ((stepIndex + 1) / steps.length) * 100
  const isLast = stepIndex === steps.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '1rem'
    }}>
      <div style={{
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
        background: COLORS.neutral, borderRadius: 18, fontFamily: 'var(--font-manrope)'
      }}>

        {/* Header */}
        <div style={{ background: COLORS.secondary, padding: '1rem 1.2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.7rem', alignItems: 'center' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                overflow: 'hidden', background: '#f1e9dd',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem'
              }}>
                {image ? (
                  <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : '🫒'}
              </div>
              <div>
                <p style={{
                  fontFamily: 'var(--font-newsreader)', color: COLORS.neutral,
                  fontSize: '0.95rem', fontWeight: 600, margin: 0, lineHeight: 1.2
                }}>
                  {title}
                </p>
                <span style={{ color: '#d8dcc9', fontSize: '0.75rem' }}>
                  Step {stepIndex + 1} of {steps.length}
                </span>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'transparent', border: 'none', color: COLORS.neutral,
              fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1, flexShrink: 0
            }}>
              ×
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '0.5rem 1.1rem 0' }}>
          <div style={{ height: 4, background: '#e5ddd3', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: COLORS.primary, transition: 'width 0.2s' }} />
          </div>
        </div>

        {/* Step text */}
        <div style={{ padding: '1.7rem 1.5rem 0.5rem', minHeight: 130, display: 'flex', alignItems: 'center' }}>
          <p style={{
            fontFamily: 'var(--font-newsreader)', fontSize: '1.35rem', lineHeight: 1.5,
            color: '#2c2c2c', margin: 0
          }}>
            {steps[stepIndex] || 'No step text available.'}
          </p>
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '0.6rem', padding: '0.5rem 1.5rem 1.25rem' }}>
          <button
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            disabled={stepIndex === 0}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: 999, border: '1.5px solid #d8cfc0',
              background: '#fff', color: '#3c3c3c', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-manrope)', opacity: stepIndex === 0 ? 0.4 : 1
            }}
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (isLast) { onClose() } else { setStepIndex((i) => i + 1) }
            }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: 999, border: 'none',
              background: COLORS.secondary, color: '#fff', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-manrope)'
            }}
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </div>

        {/* Ingredients checklist */}
        {ingredients.length > 0 && (
          <div style={{ borderTop: '1px solid #eee3d8', padding: '1rem 1.5rem 1.4rem' }}>
            <p style={{
              fontSize: '0.7rem', fontWeight: 600, color: COLORS.tertiary,
              textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 0.6rem'
            }}>
              Ingredients
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {ingredients.map((item, i) => (
                <label key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  fontSize: '0.9rem', cursor: 'pointer',
                  color: checked[i] ? '#8a8378' : '#3c3c3c',
                  textDecoration: checked[i] ? 'line-through' : 'none'
                }}>
                  <input
                    type="checkbox"
                    checked={!!checked[i]}
                    onChange={() => toggleIngredient(i)}
                    style={{ width: 16, height: 16, accentColor: COLORS.secondary }}
                  />
                  {item}
                </label>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}