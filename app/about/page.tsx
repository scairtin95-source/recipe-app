'use client'

import { useState } from 'react'
import { supabase } from '../../src/lib/supabase'
import { useTranslation } from '../../src/lib/i18n/LocaleContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
}

// Stable English keys stored in the DB regardless of UI language, so the
// `messages.subject` column stays consistent no matter what locale the
// person submitted the form in. Display labels are translated separately.
const SUBJECT_OPTIONS = [
  { value: 'Recipe Suggestion', labelKey: 'aboutPage.subjectRecipeSuggestion' },
  { value: 'Spotted an Error', labelKey: 'aboutPage.subjectSpottedError' },
  { value: 'General Feedback', labelKey: 'aboutPage.subjectGeneralFeedback' },
  { value: 'Just Saying Hello', labelKey: 'aboutPage.subjectSayingHello' },
]

export default function AboutPage() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('Recipe Suggestion')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState('')
  const [isError, setIsError] = useState(false)

  const inputStyle = {
    width: '100%', padding: '0.7rem 0.9rem', fontSize: '0.9rem',
    border: `1.5px solid ${COLORS.border}`, borderRadius: 10,
    background: COLORS.neutral, outline: 'none',
    fontFamily: 'var(--font-manrope)', color: '#2c2c2c',
    boxSizing: 'border-box' as const
  }

  const labelStyle = {
    display: 'block', fontSize: '0.85rem', fontWeight: 600,
    color: '#2c2c2c', marginBottom: '0.4rem', fontFamily: 'var(--font-manrope)'
  }

  const sendMessage = async () => {
    if (!name || !email || !message) {
      setStatus(t('aboutPage.fillFieldsError'))
      setIsError(true)
      return
    }
    setSending(true)
    const { error } = await supabase
      .from('messages')
      .insert([{ name, email, subject, message }])
    if (error) {
      setStatus(t('aboutPage.genericError'))
      setIsError(true)
    } else {
      setStatus(t('aboutPage.sentSuccess'))
      setIsError(false)
      setName(''); setEmail(''); setSubject('Recipe Suggestion'); setMessage('')
    }
    setSending(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4efe4', fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 1050, margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Our Story */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', alignItems: 'start', marginBottom: '4rem' }}>
          <div>
            <p style={{
              fontSize: '0.75rem', fontWeight: 700, color: COLORS.tertiary,
              textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.6rem'
            }}>
              {t('aboutPage.ourStoryLabel')}
            </p>
            <h1 style={{
              fontFamily: 'var(--font-newsreader)', fontSize: '2.4rem', fontWeight: 700,
              color: '#2c2c2c', lineHeight: 1.2, margin: '0 0 1.25rem'
            }}>
              {t('aboutPage.storyTitle')}
            </h1>
            <p style={{ color: '#4a4a4a', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.1rem' }}>
              {t('aboutPage.storyP1')}
            </p>
            <p style={{ color: '#4a4a4a', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '1.1rem' }}>
              {t('aboutPage.storyP2')}
            </p>
            <p style={{ color: '#4a4a4a', fontSize: '0.95rem', lineHeight: 1.7 }}>
              {t('aboutPage.storyP3')}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{
              gridColumn: '1', gridRow: '1 / 3', borderRadius: 16, overflow: 'hidden',
              background: '#e8dcc4', minHeight: 320
            }}>
              <img
                src="https://images.unsplash.com/photo-1543353071-873f17a7a088?w=600&q=80"
                alt="Olives and bread on a table"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{ borderRadius: 16, overflow: 'hidden', background: '#e8dcc4', minHeight: 150 }}>
              <img
                src="https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=600&q=80"
                alt="Handwritten recipe cards"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div style={{
              background: '#eae4d8', borderRadius: 16, padding: '1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 150
            }}>
              <p style={{
                fontFamily: 'var(--font-newsreader)', fontStyle: 'italic', fontSize: '1.05rem',
                color: '#3c3c3c', textAlign: 'center', lineHeight: 1.5, margin: 0
              }}>
                "{t('aboutPage.quote')}"
              </p>
            </div>
          </div>
        </div>

        {/* Get in Touch */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-newsreader)', fontSize: '2rem', fontWeight: 700,
            color: '#2c2c2c', margin: '0 0 0.5rem'
          }}>
            {t('aboutPage.getInTouch')}
          </h2>
          <p style={{ color: '#6a6a6a', fontSize: '0.95rem' }}>
            {t('aboutPage.getInTouchSubtitle')}
          </p>
        </div>

        <div style={{
          maxWidth: 720, margin: '0 auto', background: '#fff', borderRadius: 18,
          padding: '2rem', border: `1px solid ${COLORS.border}`
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>{t('aboutPage.nameLabel')}</label>
              <input type="text" placeholder={t('aboutPage.namePlaceholder')} value={name}
                onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>{t('aboutPage.emailLabel')}</label>
              <input type="email" placeholder="you@example.com" value={email}
                onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>{t('aboutPage.subjectLabel')}</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              {SUBJECT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={labelStyle}>{t('aboutPage.messageLabel')}</label>
            <textarea placeholder={t('aboutPage.messagePlaceholder')} value={message}
              onChange={(e) => setMessage(e.target.value)} rows={5}
              style={{ ...inputStyle, resize: 'vertical' as const }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem' }}>
            {status && (
              <span style={{ fontSize: '0.85rem', color: isError ? COLORS.primary : COLORS.secondary }}>
                {status}
              </span>
            )}
            <button onClick={sendMessage} disabled={sending} style={{
              padding: '0.7rem 1.5rem', borderRadius: 999, border: 'none',
              background: COLORS.secondary, color: '#fff', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
              opacity: sending ? 0.7 : 1
            }}>
              {sending ? t('aboutPage.sending') : t('aboutPage.sendMessage')}
            </button>
          </div>
        </div>

      </main>
    </div>
  )
}