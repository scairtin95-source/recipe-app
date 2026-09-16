'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const redirectTarget = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        setError(t('loginPage.incorrectCredentials'))
        return
      }
      router.replace(redirectTarget)
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message)
        return
      }
      if (data.session) {
        router.replace(redirectTarget)
      } else {
        setInfo(t('loginPage.checkEmailConfirm'))
        setMode('signin')
      }
    }
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
          {mode === 'signin' ? t('loginPage.welcomeBack') : t('loginPage.createAccountTitle')}
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#8a8378', margin: '0 0 1.5rem' }}>
          {mode === 'signin' ? t('loginPage.signInSubtitle') : t('loginPage.joinOliva')}
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
            fontSize: '0.9rem', marginBottom: '1rem', boxSizing: 'border-box', fontFamily: 'var(--font-manrope)',
            color: COLORS.text, background: '#fff'
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
          minLength={mode === 'signup' ? 6 : undefined}
          style={{
            width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, border: '1.5px solid #e5ddd3',
            fontSize: '0.9rem', marginBottom: '1.25rem', boxSizing: 'border-box', fontFamily: 'var(--font-manrope)',
            color: COLORS.text, background: '#fff'
          }}
        />

        {error && (
          <p style={{ fontSize: '0.8rem', color: COLORS.primary, margin: '0 0 1rem' }}>{error}</p>
        )}
        {info && (
          <p style={{ fontSize: '0.8rem', color: COLORS.secondary, margin: '0 0 1rem' }}>{info}</p>
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
          {loading
            ? t('loginPage.signingIn')
            : mode === 'signin' ? t('loginPage.signIn') : t('loginPage.createAccount')}
        </button>

        <p style={{ fontSize: '0.8rem', color: '#8a8378', margin: '1.1rem 0 0', textAlign: 'center' }}>
          {mode === 'signin' ? (
            <>
              {t('loginPage.dontHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setInfo(null) }}
                style={{ background: 'none', border: 'none', padding: 0, color: COLORS.secondary, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-manrope)' }}
              >
                {t('loginPage.signUp')}
              </button>
            </>
          ) : (
            <>
              {t('loginPage.alreadyHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => { setMode('signin'); setError(null); setInfo(null) }}
                style={{ background: 'none', border: 'none', padding: 0, color: COLORS.secondary, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-manrope)' }}
              >
                {t('loginPage.signIn')}
              </button>
            </>
          )}
        </p>
      </form>
    </div>
  )
}