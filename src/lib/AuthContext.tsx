'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  hasGroup: boolean | null // null = not yet checked
  groupIds: string[]
  refreshGroups: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasGroup, setHasGroup] = useState<boolean | null>(null)
  const [groupIds, setGroupIds] = useState<string[]>([])

  const checkGroups = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', userId)
    if (error) {
      // Fetch failed (e.g. no network) — keep whatever group state we
      // already knew rather than concluding "no group," which would
      // incorrectly bounce an offline user to /onboarding.
      return
    }
    setGroupIds(data?.map((r) => r.group_id) ?? [])
    setHasGroup((data?.length ?? 0) > 0)
  }, [])

  const refreshGroups = useCallback(async () => {
    if (session?.user?.id) await checkGroups(session.user.id)
  }, [session?.user?.id, checkGroups])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session?.user?.id) checkGroups(session.user.id)
    })

    // Keeps state in sync across sign-in, sign-out, and token refresh —
    // without this, logging out in one tab wouldn't update the UI here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
      if (session?.user?.id) {
        checkGroups(session.user.id)
      } else {
        setHasGroup(null)
        setGroupIds([])
      }
    })

    return () => subscription.unsubscribe()
  }, [checkGroups])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut, hasGroup, groupIds, refreshGroups }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Only /login is reachable while logged out. Add more paths here later
// (e.g. a public shared-recipe view) if Oliva ever needs one.
const PUBLIC_PATHS = ['/login', '/']
function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/join/') || pathname.startsWith('/recipes/')
}
// Reachable even without a group — the onboarding flow itself, and the
// invite-join page (which is how a user gets their first group).
const GROUP_EXEMPT_PATHS = ['/onboarding']
const GROUP_EXEMPT_PREFIXES = ['/join/']

// Wraps the whole app. While the session is being checked, shows a blank
// loading state rather than briefly flashing protected content. Once
// checked, logged-out visitors on a protected path get redirected to
// /login; logged-in visitors with no group get redirected to /onboarding
// (unless already on an exempt path); everyone else sees children as normal.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, hasGroup } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const isGroupExempt =
    GROUP_EXEMPT_PATHS.includes(pathname) ||
    GROUP_EXEMPT_PREFIXES.some((p) => pathname.startsWith(p))

  useEffect(() => {
    if (loading) return
    if (!user && !isPublicPath(pathname)) {
      router.replace('/login')
      return
    }
    if (user && hasGroup === false && !isGroupExempt) {
      router.replace('/onboarding')
    }
  }, [loading, user, hasGroup, pathname, isGroupExempt, router])

  if (loading || (user && hasGroup === null && !isGroupExempt)) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDF8F5' }}>
        <p style={{ color: '#8a8378', fontFamily: 'var(--font-manrope)' }}>Loading…</p>
      </div>
    )
  }

  if (!user && !isPublicPath(pathname)) {
    // Redirect is already in flight from the effect above — render
    // nothing so protected content never flashes on screen first.
    return null
  }

  if (user && hasGroup === false && !isGroupExempt) {
    // Redirect to /onboarding is in flight — render nothing.
    return null
  }

  return <>{children}</>
}