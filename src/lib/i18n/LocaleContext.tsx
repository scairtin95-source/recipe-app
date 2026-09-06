'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/lib/supabase';

import en from './locales/en.json';
import es from './locales/es.json';
import ro from './locales/ro.json';
import ru from './locales/ru.json';

export type Locale = 'en' | 'es' | 'ro' | 'ru';
const DICTIONARIES: Record<Locale, any> = { en, es, ro, ru };
const SUPPORTED_LOCALES: Locale[] = ['en', 'es', 'ro', 'ru'];

function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language.slice(0, 2) as Locale;
  return SUPPORTED_LOCALES.includes(lang) ? lang : 'en';
}

function getNested(obj: any, path: string): string {
  return path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? path;
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string) => string;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = user?.user_metadata?.preferred_locale as Locale | undefined;
    if (stored && SUPPORTED_LOCALES.includes(stored)) {
      setLocaleState(stored);
    } else {
      setLocaleState(detectBrowserLocale());
    }
  }, [user]);

  const setLocale = async (newLocale: Locale) => {
    setLocaleState(newLocale);
    if (user) {
      await supabase.auth.updateUser({ data: { preferred_locale: newLocale } });
    }
  };

  const t = (key: string) => getNested(DICTIONARIES[locale], key);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useTranslation must be used within LocaleProvider');
  return ctx;
}