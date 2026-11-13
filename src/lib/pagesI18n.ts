'use client';
import { useCallback } from 'react';
import { useUiLang } from './uiLang';
import { PAGES_EN } from '@/app/pagesEn';

/** Traductor de las pantallas de cuenta: T('texto en español') devuelve el texto en el idioma elegido. */
export function usePagesT() {
  const { lang, setLang, locale } = useUiLang();
  const T = useCallback((es: string) => (lang === 'en' ? PAGES_EN[es] ?? es : es), [lang]);
  return { T, lang, setLang, locale };
}
