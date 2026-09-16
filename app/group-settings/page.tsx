'use client'

import { useEffect, useState } from 'react'
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

interface GroupRow {
  id: string
  name: string
  role: string
}

interface MemberRow {
  user_id: string
  display_name: string
}

export default function GroupSettingsPage() {
  const { user, groupIds } = useAuth()

  const [groups, setGroups] = useState<GroupRow[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [members, setMembers] = useState<MemberRow[]>([])
  const [nameInput, setNameInput] = useState('')
  const [savingName, setSavingName] = useState(false)

  const [inviteLink, setInviteLink] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user?.id || groupIds.length === 0) return

    async function loadGroups() {
      const { data: groupRows } = await supabase
        .from('groups')
        .select('id, name')
        .in('id', groupIds)

      const { data: memberRows } = await supabase
        .from('group_members')
        .select('group_id, role')
        .eq('user_id', user!.id)

      if (groupRows) {
        const withRole: GroupRow[] = groupRows.map((g) => ({
          id: g.id,
          name: g.name,
          role: memberRows?.find((m) => m.group_id === g.id)?.role || 'member',
        }))
        setGroups(withRole)
        if (!selectedGroupId && withRole.length > 0) {
          setSelectedGroupId(withRole[0].id)
        }
      }
    }
    loadGroups()
  }, [user?.id, groupIds])

  useEffect(() => {
    if (!selectedGroupId) return
    setInviteLink('')
    setCopied(false)

    const group = groups.find((g) => g.id === selectedGroupId)
    setNameInput(group?.name || '')

    async function loadMembers() {
      const { data: memberIds } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', selectedGroupId)

      if (!memberIds || memberIds.length === 0) {
        setMembers([])
        return
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', memberIds.map((m) => m.user_id))

      setMembers(profiles || [])
    }
    loadMembers()
  }, [selectedGroupId, groups])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)
  const isOwner = selectedGroup?.role === 'owner'

  async function handleRenameGroup() {
    if (!selectedGroupId || !nameInput.trim()) return
    setSavingName(true)
    const { error } = await supabase
      .from('groups')
      .update({ name: nameInput.trim() })
      .eq('id', selectedGroupId)
    setSavingName(false)
    if (!error) {
      setGroups((prev) => prev.map((g) => g.id === selectedGroupId ? { ...g, name: nameInput.trim() } : g))
    }
  }

  async function handleCreateInvite() {
    if (!selectedGroupId || !user?.id) return
    setCreatingInvite(true)

    const { data, error } = await supabase
      .from('group_invites')
      .insert({ group_id: selectedGroupId, created_by: user.id })
      .select('token')
      .single()

    setCreatingInvite(false)
    if (!error && data) {
      setInviteLink(`${window.location.origin}/join/${data.token}`)
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (groups.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: COLORS.neutral, padding: '2.5rem 1.5rem', fontFamily: 'var(--font-manrope)' }}>
        <p style={{ color: '#8a8378' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: COLORS.neutral, fontFamily: 'var(--font-manrope)' }}>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '2.5rem 1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-newsreader)', fontSize: '1.8rem', fontWeight: 700, color: COLORS.text, margin: '0 0 1.5rem' }}>
          Group Settings
        </h1>

        {groups.length > 1 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.4rem' }}>
              Group
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              style={{
                width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8,
                border: `1.5px solid ${COLORS.border}`, fontSize: '0.9rem',
                fontFamily: 'var(--font-manrope)', color: COLORS.text, background: '#fff',
              }}
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '1.5rem', marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
            Group name
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={!isOwner}
              style={{
                flex: 1, padding: '0.6rem 0.8rem', borderRadius: 8,
                border: `1.5px solid ${COLORS.border}`, fontSize: '0.9rem',
                fontFamily: 'var(--font-manrope)', color: COLORS.text,
                background: isOwner ? '#fff' : '#f5f2ec',
              }}
            />
            {isOwner && (
              <button
                onClick={handleRenameGroup}
                disabled={savingName || !nameInput.trim() || nameInput.trim() === selectedGroup?.name}
                style={{
                  padding: '0.6rem 1rem', borderRadius: 8, border: 'none',
                  background: COLORS.secondary, color: COLORS.neutral,
                  fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-manrope)',
                  opacity: savingName || !nameInput.trim() || nameInput.trim() === selectedGroup?.name ? 0.5 : 1,
                }}
              >
                {savingName ? '…' : 'Save'}
              </button>
            )}
          </div>
          {!isOwner && (
            <p style={{ fontSize: '0.75rem', color: '#8a8378', margin: '0.5rem 0 0' }}>
              Only the group owner can rename this group.
            </p>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '1.5rem', marginBottom: '1.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
            Members
          </label>
          {members.map((m) => (
            <p key={m.user_id} style={{ fontSize: '0.9rem', color: COLORS.text, margin: '0.3rem 0' }}>
              {m.display_name}
            </p>
          ))}
        </div>

        {isOwner && (
          <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${COLORS.border}`, padding: '1.5rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 700, color: COLORS.tertiary, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.5rem' }}>
              Invite someone
            </label>
            {inviteLink ? (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  readOnly
                  value={inviteLink}
                  style={{
                    flex: 1, padding: '0.6rem 0.8rem', borderRadius: 8,
                    border: `1.5px solid ${COLORS.border}`, fontSize: '0.85rem',
                    fontFamily: 'var(--font-manrope)', color: COLORS.text, background: '#f5f2ec',
                  }}
                />
                <button
                  onClick={copyLink}
                  style={{
                    padding: '0.6rem 1rem', borderRadius: 8, border: 'none',
                    background: COLORS.secondary, color: COLORS.neutral,
                    fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'var(--font-manrope)', whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleCreateInvite}
                disabled={creatingInvite}
                style={{
                  padding: '0.6rem 1.2rem', borderRadius: 8, border: 'none',
                  background: COLORS.secondary, color: COLORS.neutral,
                  fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-manrope)',
                  opacity: creatingInvite ? 0.6 : 1,
                }}
              >
                {creatingInvite ? 'Generating…' : 'Generate invite link'}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}