'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../src/lib/supabase'
import { useAuth } from '../../src/lib/AuthContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
  text: '#2c2c2c',
}

export default function OnboardingPage() {
  const { user, refreshGroups } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose')
  const [groupName, setGroupName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const [inviteInput, setInviteInput] = useState('')
  const [joinError, setJoinError] = useState('')

  async function handleCreateGroup() {
    if (!user?.id || !groupName.trim()) return
    setCreating(true)
    setCreateError('')

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .insert({ name: groupName.trim(), created_by: user.id })
      .select('id')
      .single()

    if (groupError || !group) {
      setCreateError(groupError?.message || 'Something went wrong creating the group.')
      setCreating(false)
      return
    }

    const { error: memberError } = await supabase
      .from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'owner' })

    if (memberError) {
      setCreateError(memberError.message)
      setCreating(false)
      return
    }

    await refreshGroups()
    router.push('/')
  }

  function handleJoinNavigate() {
    setJoinError('')
    const trimmed = inviteInput.trim()
    if (!trimmed) return

    // Accept either a bare token or a full pasted link (…/join/<token>)
    const parts = trimmed.split('/join/')
    const token = parts.length > 1 ? parts[1] : trimmed

    if (!token) {
      setJoinError('That doesn\u2019t look like a valid invite link or code.')
      return
    }

    router.push(`/join/${token}`)
  }

  return (
    <div style={{
      minHeight: '100vh', background: COLORS.neutral, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1.5rem',
      fontFamily: 'var(--font-manrope)',
    }}>
      <div style={{
        maxWidth: 420, width: '100%', background: '#fff', borderRadius: 16,
        border: `1px solid ${COLORS.border}`, padding: '2rem',
      }}>
        <h1 style={{
          fontFamily: 'var(--font-newsreader)', fontSize: '1.6rem', fontWeight: 700,
          color: COLORS.text, margin: '0 0 0.5rem',
        }}>
          Welcome to Oliva
        </h1>
        <p style={{ color: '#6a6a6a', fontSize: '0.9rem', margin: '0 0 1.75rem' }}>
          You're not part of a group yet. Create one, or join one with an invite.
        </p>

        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => setMode('create')}
              style={{
                padding: '0.85rem 1rem', borderRadius: 10, border: 'none',
                background: COLORS.secondary, color: COLORS.neutral,
                fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-manrope)',
              }}
            >
              Create a group
            </button>
            <button
              onClick={() => setMode('join')}
              style={{
                padding: '0.85rem 1rem', borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`, background: '#fff',
                color: COLORS.text, fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-manrope)',
              }}
            >
              Join with an invite
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: COLORS.text, marginBottom: '0.4rem' }}>
              Group name
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. The Olive Table"
              autoFocus
              style={{
                width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`, fontSize: '0.95rem',
                color: COLORS.text, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-manrope)', marginBottom: '1rem',
              }}
            />
            {createError && (
              <p style={{ color: COLORS.primary, fontSize: '0.85rem', margin: '0 0 1rem' }}>{createError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                onClick={() => setMode('choose')}
                style={{
                  flex: 1, padding: '0.7rem 1rem', borderRadius: 10,
                  border: `1.5px solid ${COLORS.border}`, background: '#fff',
                  color: COLORS.text, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-manrope)',
                }}
              >
                Back
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={creating || !groupName.trim()}
                style={{
                  flex: 1, padding: '0.7rem 1rem', borderRadius: 10, border: 'none',
                  background: COLORS.secondary, color: COLORS.neutral,
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: creating || !groupName.trim() ? 'default' : 'pointer',
                  opacity: creating || !groupName.trim() ? 0.6 : 1,
                  fontFamily: 'var(--font-manrope)',
                }}
              >
                {creating ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: COLORS.text, marginBottom: '0.4rem' }}>
              Invite link or code
            </label>
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Paste an invite link or code"
              autoFocus
              style={{
                width: '100%', padding: '0.7rem 0.9rem', borderRadius: 10,
                border: `1.5px solid ${COLORS.border}`, fontSize: '0.95rem',
                color: COLORS.text, outline: 'none', boxSizing: 'border-box',
                fontFamily: 'var(--font-manrope)', marginBottom: '1rem',
              }}
            />
            {joinError && (
              <p style={{ color: COLORS.primary, fontSize: '0.85rem', margin: '0 0 1rem' }}>{joinError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.6rem' }}>
              <button
                onClick={() => setMode('choose')}
                style={{
                  flex: 1, padding: '0.7rem 1rem', borderRadius: 10,
                  border: `1.5px solid ${COLORS.border}`, background: '#fff',
                  color: COLORS.text, fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-manrope)',
                }}
              >
                Back
              </button>
              <button
                onClick={handleJoinNavigate}
                disabled={!inviteInput.trim()}
                style={{
                  flex: 1, padding: '0.7rem 1rem', borderRadius: 10, border: 'none',
                  background: COLORS.secondary, color: COLORS.neutral,
                  fontSize: '0.9rem', fontWeight: 600,
                  cursor: !inviteInput.trim() ? 'default' : 'pointer',
                  opacity: !inviteInput.trim() ? 0.6 : 1,
                  fontFamily: 'var(--font-manrope)',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}