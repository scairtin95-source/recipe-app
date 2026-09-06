'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import { useTranslation } from '../../src/lib/i18n/LocaleContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  neutral: '#FDF8F5',
  text: '#2c2c2c',
}

export default function LoginPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError(t('loginPage.incorrectCredentials'))
      return
    }
    router.replace('/')
  }

  return (
    <div style={{
      minHeight: '100vh', background: COLORS.neutral, display: 'flex',
      alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-manrope)', padding: '1rem'
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff', border: '1px solid #eee3d8', borderRadius: 16,
        padding: '2.5rem', width: '100%', maxWidth: 380
      }}>
        <h1 style={{
          fontFamily: 'var(--font-newsreader)', fontSize: '1.6rem', fontWeight: 600,
          color: COLORS.text, margin: '0 0 0.4rem'
        }}>
          {t('loginPage.welcomeBack')}
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#8a8378', margin: '0 0 1.5rem' }}>
          {t('loginPage.signInSubtitle')}
        </p>

        <label style={{
          fontSize: '0.7rem', fontWeight: 700, color: COLORS.secondary,
          textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.3rem'
        }}>
          {t('loginPage.email')}
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
          style={{
            width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1.5px solid #e5ddd3',
            fontSize: '0.9rem', marginBottom: '1rem', boxSizing: 'border-box', fontFamily: 'var(--font-manrope)'
          }}
        />

        <label style={{
          fontSize: '0.7rem', fontWeight: 700, color: COLORS.secondary,
          textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.3rem'
        }}>
          {t('loginPage.password')}
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{
            width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1.5px solid #e5ddd3',
            fontSize: '0.9rem', marginBottom: '1.25rem', boxSizing: 'border-box', fontFamily: 'var(--font-manrope)'
          }}
        />

        {error && (
          <p style={{ fontSize: '0.8rem', color: COLORS.primary, margin: '0 0 1rem' }}>{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '0.75rem', borderRadius: 999, border: 'none',
            background: COLORS.primary, color: '#fff', fontSize: '0.95rem', fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font-manrope)',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? t('loginPage.signingIn') : t('loginPage.signIn')}
        </button>
      </form>
    </div>
  )
}