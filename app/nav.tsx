'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '../src/lib/AuthContext'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  tertiary: '#765A05',
  neutral: '#FDF8F5',
  border: '#EAE2D6',
  text: '#2c2c2c',
}

export default function Nav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const { user, signOut } = useAuth()

  // The login page has its own centered layout — no header needed there.
  if (pathname === '/login') return null

  const linkStyle = (active: boolean) => ({
    color: COLORS.text,
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-manrope)',
    fontWeight: active ? 700 : 500,
    opacity: active ? 1 : 0.75,
    borderBottom: active ? `2px solid ${COLORS.secondary}` : '2px solid transparent',
    paddingBottom: '2px',
  })

  const mobileLinkStyle = (active: boolean) => ({
    color: COLORS.text,
    textDecoration: 'none',
    fontSize: '1rem',
    fontFamily: 'var(--font-manrope)',
    fontWeight: active ? 700 : 500,
    padding: '0.85rem 1.25rem',
    borderBottom: `1px solid ${COLORS.border}`,
    display: 'block',
  })

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/recipes', label: 'Recipes' },
    { href: '/pantry', label: 'Pantry' },
    { href: '/about', label: 'About' },
  ]

  const handleSignOut = async () => {
    setProfileOpen(false)
    setMenuOpen(false)
    await signOut()
    // AuthGuard picks up the cleared session and redirects to /login.
  }

  return (
    <header
      className="oliva-header"
      style={{
        background: COLORS.neutral,
        borderBottom: `1px solid ${COLORS.border}`,
        padding: '0.9rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
      }}
    >
      {/* Logo mark + wordmark */}
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        textDecoration: 'none', flexShrink: 0,
      }}>
        <Image
          src="/oliva-icon.png"
          alt="Oliva"
          width={56}
          height={56}
          style={{ flexShrink: 0, objectFit: 'contain', width: 56, height: 56 }}
          unoptimized
          priority
        />
        <span style={{
          color: COLORS.text, fontSize: '1.15rem', fontWeight: 700,
          fontFamily: 'var(--font-newsreader)', whiteSpace: 'nowrap',
        }}>
          Oliva
        </span>
      </Link>

      {/* Center nav links — hidden on mobile */}
      <nav className="oliva-desktop-links" style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
        {navLinks.map((link) => (
          <Link key={link.href} href={link.href} style={linkStyle(pathname === link.href)}>
            {link.label}
          </Link>
        ))}
      </nav>

      {/* Right side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
        <Link href="/recipes" aria-label="Search" style={{ color: COLORS.text, display: 'flex' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>

        <Link href="/add" className="oliva-add-recipe" style={{
          background: COLORS.secondary,
          color: COLORS.neutral,
          padding: '0.5rem 1.2rem',
          borderRadius: 999,
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 600,
          fontFamily: 'var(--font-manrope)',
          whiteSpace: 'nowrap',
        }}>
          Add Recipe
        </Link>

        {/* Profile — desktop only, opens a small dropdown with sign out */}
        <div className="oliva-desktop-links" style={{ position: 'relative' }}>
          <button
            aria-label="Profile"
            onClick={() => setProfileOpen((v) => !v)}
            style={{ color: COLORS.text, display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="9" r="3.2" />
              <path d="M5.5 19.5c1.5-3 4-4.2 6.5-4.2s5 1.2 6.5 4.2" />
            </svg>
          </button>

          {profileOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 0.6rem)', right: 0,
              background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12,
              boxShadow: '0 8px 20px rgba(0,0,0,0.08)', padding: '0.75rem', minWidth: 200, zIndex: 50,
            }}>
              {user?.email && (
                <p style={{
                  fontSize: '0.75rem', color: '#8a8378', margin: '0 0 0.6rem',
                  fontFamily: 'var(--font-manrope)', wordBreak: 'break-all'
                }}>
                  Signed in as<br /><span style={{ color: COLORS.text, fontWeight: 600 }}>{user.email}</span>
                </p>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: 'none',
                  background: COLORS.neutral, color: COLORS.primary, fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-manrope)', textAlign: 'left'
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>

        {/* Hamburger — visible on mobile only */}
        <button
          className="oliva-hamburger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((v) => !v)}
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            padding: '0.25rem',
            cursor: 'pointer',
            color: COLORS.text,
          }}
        >
          {menuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div
          className="oliva-mobile-menu"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: COLORS.neutral,
            borderBottom: `1px solid ${COLORS.border}`,
            boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
            zIndex: 50,
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={mobileLinkStyle(pathname === link.href)}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div style={{ padding: '0.85rem 1.25rem' }}>
            {user?.email && (
              <p style={{ fontSize: '0.8rem', color: '#8a8378', margin: '0 0 0.6rem', fontFamily: 'var(--font-manrope)' }}>
                Signed in as <span style={{ color: COLORS.text, fontWeight: 600 }}>{user.email}</span>
              </p>
            )}
            <button
              onClick={handleSignOut}
              style={{
                width: '100%', padding: '0.6rem 0.9rem', borderRadius: 8, border: `1.5px solid ${COLORS.border}`,
                background: '#fff', color: COLORS.primary, fontSize: '0.9rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-manrope)', textAlign: 'left'
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 768px) {
          .oliva-header {
            padding: 0.75rem 1.25rem !important;
          }
          .oliva-desktop-links {
            display: none !important;
          }
          .oliva-hamburger {
            display: flex !important;
            align-items: center;
          }
          .oliva-add-recipe {
            padding: 0.45rem 0.85rem !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>
    </header>
  )
}