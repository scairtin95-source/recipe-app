'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const COLORS = {
  primary: '#9D3D2E',
  secondary: '#5C614D',
  neutral: '#FDF8F5',
}

export default function Nav() {
  const pathname = usePathname()

  const linkStyle = (active: boolean) => ({
    color: COLORS.neutral,
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontFamily: 'var(--font-manrope)',
    fontWeight: active ? 700 : 500,
    opacity: active ? 1 : 0.85,
    borderBottom: active ? `2px solid ${COLORS.neutral}` : '2px solid transparent',
    paddingBottom: '2px',
  })

  return (
    <header style={{
      background: COLORS.secondary,
      padding: '1.1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <Link href="/" style={{
        color: COLORS.neutral,
        fontSize: '1.5rem',
        fontWeight: 600,
        fontFamily: 'var(--font-newsreader)',
        textDecoration: 'none',
        letterSpacing: '0.01em',
      }}>
        The Olive Table
      </Link>

      <nav style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
        <Link href="/recipes" style={linkStyle(pathname === '/recipes')}>
          All Recipes
        </Link>
        <Link href="/collections" style={linkStyle(pathname === '/collections')}>
          Collections
        </Link>
        <Link href="/" style={{
          background: COLORS.primary,
          color: '#fff',
          padding: '0.5rem 1.2rem',
          borderRadius: 999,
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 600,
          fontFamily: 'var(--font-manrope)',
        }}>
          + Add Recipe
        </Link>
      </nav>
    </header>
  )
}