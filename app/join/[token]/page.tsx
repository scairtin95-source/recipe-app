'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../src/lib/supabase'
import { useAuth } from '../../../src/lib/AuthContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
  text: '#2c2c2c',
}

export default function JoinPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { user, loading: authLoading, refreshGroups } = useAuth()

  const [status, setStatus] = useState<'idle' | 'joining' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [groupName, setGroupName] = useState('')

  async function handleJoin() {
    setStatus('joining')
    setErrorMsg('')

    const { data, error } = await supabase.rpc('redeem_invite', { invite_token: params.token })

    if (error) {
      setStatus('error')
      if (error.message.includes('invite_not_found')) {
        setErrorMsg('This invite link is invalid.')
      } else if (error.message.includes('invite_expired')) {
        setErrorMsg('This invite link has expired.')
      } else if (error.message.includes('invite_exhausted')) {
        setErrorMsg('This invite link has already been used the maximum number of times.')
      } else {
        setErrorMsg('Something went wrong. Please try again.')
      }
      return
    }

    const joined = data?.[0]
    setGroupName(joined?.out_group_name || '')
    setStatus('success')
    await refreshGroups()
  }

  // If not logged in, send to login first — they'll land back here after
  // AuthGuard lets them through, since /join/ is a group-exempt prefix.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?redirect=/join/${params.token}`)
    }
  }, [authLoading, user, params.token, router])

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: COLORS.neutral }}>
        <p style={{ color: '#8a8378', fontFamily: 'var(--font-manrope)' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh', background: COLORS.neutral, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      fontFamily: 'var(--font-manrope)',
    }}>
      <div style={{
        maxWidth: 400, width: '100%', background: '#fff', borderRadius: 16,
        border: `1px solid ${COLORS.border}`, padding: '2rem', textAlign: 'center',
      }}>
        {status === 'idle' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.4rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.75rem' }}>
              You've been invited
            </h1>
            <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
              Join this group to see and share recipes together.
            </p>
            <button
              onClick={handleJoin}
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: 'none',
                background: COLORS.secondary, color: COLORS.neutral,
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-manrope)',
              }}
            >
              Join group
            </button>
          </>
        )}

        {status === 'joining' && (
          <p style={{ color: '#8a8378' }}>Joining…</p>
        )}

        {status === 'success' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.4rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.75rem' }}>
              Welcome{groupName ? ` to ${groupName}` : ''}!
            </h1>
            <button
              onClick={() => router.push('/')}
              style={{
                width: '100%', padding: '0.75rem 1rem', borderRadius: 10, border: 'none',
                background: COLORS.secondary, color: COLORS.neutral,
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-manrope)',
              }}
            >
              Go to Oliva
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.3rem', fontWeight: 700, color: COLORS.primary, margin: '0 0 0.75rem' }}>
              Couldn't join
            </h1>
            <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: 0 }}>{errorMsg}</p>
          </>
        )}
      </div>
    </div>
  )
}