'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { supabase } from '../src/lib/supabase'
import { useAuth } from '../src/lib/AuthContext'
import { useTranslation, Locale } from '../src/lib/i18n/LocaleContext'

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
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { locale, setLocale, t } = useTranslation()

  // Display name (nickname) editing state
  const [displayName, setDisplayName] = useState('')
  const [nicknameInput, setNicknameInput] = useState('')
  const [editingNickname, setEditingNickname] = useState(false)
  const [savingNickname, setSavingNickname] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.display_name) {
          setDisplayName(data.display_name)
          setNicknameInput(data.display_name)
        }
      })
  }, [user?.id])

  async function saveNickname() {
    if (!user?.id || !nicknameInput.trim()) return
    setSavingNickname(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: nicknameInput.trim() })
      .eq('user_id', user.id)
    setSavingNickname(false)
    if (!error) {
      setDisplayName(nicknameInput.trim())
      setEditingNickname(false)
    }
  }

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
    { href: '/', label: t('nav.home') },
    { href: '/recipes', label: t('nav.recipes') },
    { href: '/table', label: t('nav.table') },
    { href: '/about', label: t('nav.about') },
  ]

  const LANGUAGES: { code: Locale; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'ro', label: 'Română' },
    { code: 'ru', label: 'Русский' },
  ]

  const handleSignOut = async () => {
    setProfileOpen(false)
    setMenuOpen(false)
    await signOut()
    // AuthGuard picks up the cleared session and redirects to /login.
  }

  const handleLangSelect = (code: Locale) => {
    setLocale(code)
    setLangMenuOpen(false)
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
        position: 'sticky',
        top: 0,
        zIndex: 40,
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

        {/* Language switcher — shows the current language code, doubling as a status indicator */}
        <div style={{ position: 'relative' }}>
          <button
            aria-label={t('nav.language')}
            onClick={() => setLangMenuOpen((v) => !v)}
            style={{
              color: COLORS.text, display: 'flex', alignItems: 'center', gap: '0.2rem',
              cursor: 'pointer', background: 'none', border: 'none', padding: 0,
              fontFamily: 'var(--font-manrope)', fontSize: '0.85rem', fontWeight: 700,
            }}
          >
            {locale.toUpperCase()}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginTop: 1 }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {langMenuOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 0.6rem)', right: 0,
              background: '#fff', border: `1px solid ${COLORS.border}`, borderRadius: 12,
              boxShadow: '0 8px 20px rgba(0,0,0,0.08)', padding: '0.6rem', zIndex: 50,
              display: 'flex', flexWrap: 'wrap', gap: '0.4rem', maxWidth: 220,
            }}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangSelect(lang.code)}
                  style={{
                    padding: '0.3rem 0.6rem', borderRadius: 999, cursor: 'pointer',
                    fontFamily: 'var(--font-manrope)', fontSize: '0.75rem', fontWeight: 600,
                    border: `1px solid ${locale === lang.code ? COLORS.secondary : COLORS.border}`,
                    background: locale === lang.code ? COLORS.secondary : '#fff',
                    color: locale === lang.code ? COLORS.neutral : COLORS.text,
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

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
           {t('nav.addRecipe')}
        </Link>

        {/* Profile — desktop only, opens a small dropdown with nickname + sign out. Logged-out visitors get a plain Sign in link instead. */}
        <div className="oliva-desktop-links" style={{ position: 'relative' }}>
          {user ? (
          <>
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
              boxShadow: '0 8px 20px rgba(0,0,0,0.08)', padding: '0.75rem', minWidth: 220, zIndex: 50,
            }}>
              {user?.email && (
                <p style={{
                  fontSize: '0.75rem', color: '#8a8378', margin: '0 0 0.6rem',
                  fontFamily: 'var(--font-manrope)', wordBreak: 'break-all'
                }}>
                  Signed in as<br /><span style={{ color: COLORS.text, fontWeight: 600 }}>{user.email}</span>
                </p>
              )}

              {/* Nickname editor */}
              <div style={{ marginBottom: '0.6rem', paddingBottom: '0.6rem', borderBottom: `1px solid ${COLORS.border}` }}>
                {editingNickname ? (
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <input
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      autoFocus
                      style={{
                        flex: 1, minWidth: 0, padding: '0.35rem 0.5rem', borderRadius: 6,
                        border: `1.5px solid ${COLORS.border}`, fontFamily: 'var(--font-manrope)',
                        fontSize: '0.85rem', color: COLORS.text, outline: 'none',
                      }}
                    />
                    <button
                      onClick={saveNickname}
                      disabled={savingNickname || !nicknameInput.trim()}
                      style={{
                        padding: '0.35rem 0.6rem', borderRadius: 6, border: 'none',
                        background: COLORS.secondary, color: COLORS.neutral, fontSize: '0.8rem',
                        fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
                        opacity: savingNickname || !nicknameInput.trim() ? 0.6 : 1,
                      }}
                    >
                      {savingNickname ? '…' : t('nav.save') || 'Save'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setNicknameInput(displayName); setEditingNickname(true) }}
                    style={{
                      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                      fontFamily: 'var(--font-manrope)', textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '0.85rem', color: COLORS.text, fontWeight: 600 }}>
                      {displayName || '—'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: COLORS.secondary, textDecoration: 'underline' }}>
                      {t('nav.editNickname') || 'Edit'}
                    </span>
                  </button>
                )}
              </div>

              <Link
                href="/group-settings"
                onClick={() => setProfileOpen(false)}
                style={{
                  display: 'block', width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8,
                  color: COLORS.text, fontSize: '0.85rem', fontWeight: 600,
                  fontFamily: 'var(--font-manrope)', textAlign: 'left', textDecoration: 'none',
                  marginBottom: '0.25rem',
                }}
              >
                Group Settings
              </Link>

              <button
                onClick={handleSignOut}
                style={{
                  width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: 'none',
                  background: COLORS.neutral, color: COLORS.primary, fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'var(--font-manrope)', textAlign: 'left'
                }}
              >
                {t('nav.logOut')}
              </button>
            </div>
          )}
          </>
          ) : (
            <Link
              href="/login"
              style={{
                color: COLORS.text, fontSize: '0.9rem', fontWeight: 600,
                fontFamily: 'var(--font-manrope)', textDecoration: 'none',
              }}
            >
              {t('loginPage.signIn')}
            </Link>
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
            {user ? (
              <>
                {user?.email && (
                  <p style={{ fontSize: '0.8rem', color: '#8a8378', margin: '0 0 0.6rem', fontFamily: 'var(--font-manrope)' }}>
                    Signed in as <span style={{ color: COLORS.text, fontWeight: 600 }}>{user.email}</span>
                  </p>
                )}

                {/* Nickname editor (mobile) */}
                <div style={{ marginBottom: '0.75rem' }}>
                  {editingNickname ? (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <input
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        style={{
                          flex: 1, minWidth: 0, padding: '0.5rem 0.6rem', borderRadius: 8,
                          border: `1.5px solid ${COLORS.border}`, fontFamily: 'var(--font-manrope)',
                          fontSize: '0.9rem', color: COLORS.text, outline: 'none',
                        }}
                      />
                      <button
                        onClick={saveNickname}
                        disabled={savingNickname || !nicknameInput.trim()}
                        style={{
                          padding: '0.5rem 0.8rem', borderRadius: 8, border: 'none',
                          background: COLORS.secondary, color: COLORS.neutral, fontSize: '0.85rem',
                          fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-manrope)',
                          opacity: savingNickname || !nicknameInput.trim() ? 0.6 : 1,
                        }}
                      >
                        {savingNickname ? '…' : t('nav.save') || 'Save'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setNicknameInput(displayName); setEditingNickname(true) }}
                      style={{
                        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: 'none', border: `1.5px solid ${COLORS.border}`, borderRadius: 8,
                        padding: '0.5rem 0.75rem', cursor: 'pointer', fontFamily: 'var(--font-manrope)',
                      }}
                    >
                      <span style={{ fontSize: '0.9rem', color: COLORS.text, fontWeight: 600 }}>
                        {displayName || '—'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: COLORS.secondary, textDecoration: 'underline' }}>
                        {t('nav.editNickname') || 'Edit'}
                      </span>
                    </button>
                  )}
                </div>

                <Link
                  href="/group-settings"
                  onClick={() => setMenuOpen(false)}
                  style={{
                    display: 'block', width: '100%', padding: '0.6rem 0.9rem', borderRadius: 8,
                    border: `1.5px solid ${COLORS.border}`, background: '#fff',
                    color: COLORS.text, fontSize: '0.9rem', fontWeight: 600,
                    fontFamily: 'var(--font-manrope)', textAlign: 'left', textDecoration: 'none',
                    marginBottom: '0.6rem',
                  }}
                >
                  Group Settings
                </Link>

                <button
                  onClick={handleSignOut}
                  style={{
                    width: '100%', padding: '0.6rem 0.9rem', borderRadius: 8, border: `1.5px solid ${COLORS.border}`,
                    background: '#fff', color: COLORS.primary, fontSize: '0.9rem', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'var(--font-manrope)', textAlign: 'left'
                  }}
                >
                  {t('nav.logOut')}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block', width: '100%', padding: '0.6rem 0.9rem', borderRadius: 8,
                  background: COLORS.primary, color: '#fff', fontSize: '0.9rem', fontWeight: 600,
                  fontFamily: 'var(--font-manrope)', textAlign: 'center', textDecoration: 'none',
                }}
              >
                {t('loginPage.signIn')}
              </Link>
            )}
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