'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

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

  return (
    <header style={{
      background: COLORS.neutral,
      borderBottom: `1px solid ${COLORS.border}`,
      padding: '0.9rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      {/* Logo mark + wordmark */}
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        textDecoration: 'none'
      }}>
        <svg width="30" height="30" viewBox="0 0 30 30" style={{ flexShrink: 0 }}>
          <circle cx="15" cy="15" r="13.5" fill="none" stroke={COLORS.secondary} strokeWidth="1" />
          <circle cx="15" cy="15" r="11.5" fill="none" stroke={COLORS.secondary} strokeWidth="1" />
          <ellipse cx="15" cy="17" rx="3.5" ry="4.5" fill={COLORS.secondary} />
        </svg>
        <span style={{
          color: COLORS.text, fontSize: '1.15rem', fontWeight: 700,
          fontFamily: 'var(--font-newsreader)'
        }}>
          The Olive Table
        </span>
      </Link>

      {/* Center nav links */}
      <nav style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
        <Link href="/" style={linkStyle(pathname === '/')}>Home</Link>
        <Link href="/recipes" style={linkStyle(pathname === '/recipes')}>Recipes</Link>
        <Link href="/pantry" style={linkStyle(pathname === '/pantry')}>Pantry</Link>
        <Link href="/about" style={linkStyle(pathname === '/about')}>About</Link>
      </nav>

      {/* Right side actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/recipes" aria-label="Search" style={{ color: COLORS.text, display: 'flex' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>

        <Link href="/" style={{
          background: COLORS.secondary,
          color: COLORS.neutral,
          padding: '0.5rem 1.2rem',
          borderRadius: 999,
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 600,
          fontFamily: 'var(--font-manrope)',
        }}>
          Add Recipe
        </Link>

        <div aria-label="Profile" style={{ color: COLORS.text, display: 'flex', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="9" r="3.2" />
            <path d="M5.5 19.5c1.5-3 4-4.2 6.5-4.2s5 1.2 6.5 4.2" />
          </svg>
        </div>
      </div>
    </header>
  )
}