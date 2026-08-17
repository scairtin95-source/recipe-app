'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    // Keeps state in sync across sign-in, sign-out, and token refresh —
    // without this, logging out in one tab wouldn't update the UI here.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading, signOut }}>
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
const PUBLIC_PATHS = ['/login']

// Wraps the whole app. While the session is being checked, shows a blank
// loading state rather than briefly flashing protected content. Once
// checked, logged-out visitors on a protected path get redirected to
// /login; everyone else sees children as normal.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user && !PUBLIC_PATHS.includes(pathname)) {
      router.replace('/login')
    }
  }, [loading, user, pathname, router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FDF8F5' }}>
        <p style={{ color: '#8a8378', fontFamily: 'var(--font-manrope)' }}>Loading…</p>
      </div>
    )
  }

  if (!user && !PUBLIC_PATHS.includes(pathname)) {
    // Redirect is already in flight from the effect above — render
    // nothing so protected content never flashes on screen first.
    return null
  }

  return <>{children}</>
}