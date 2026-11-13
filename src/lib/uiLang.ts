'use client';
import { useCallback, useEffect, useState } from 'react';

export type UiLang = 'es' | 'en';
const KEY = 'cerebro_lang'; // la misma preferencia que usa el mapa del Cerebro
const read = (): UiLang => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'; } catch { return 'es'; } };

/** Idioma de la interfaz (español o inglés), compartido por todas las pantallas y recordado en el navegador. */
export function useUiLang() {
  const [lang, setLangState] = useState<UiLang>('es');
  useEffect(() => { setLangState(read()); const on = () => setLangState(read()); window.addEventListener('ui-lang', on); window.addEventListener('storage', on); return () => { window.removeEventListener('ui-lang', on); window.removeEventListener('storage', on); }; }, []);
  const setLang = useCallback((l: UiLang) => { try { localStorage.setItem(KEY, l); } catch {} setLangState(l); window.dispatchEvent(new Event('ui-lang')); }, []);
  const L = useCallback((es: string, en: string) => (lang === 'en' ? en : es), [lang]);
  return { lang, setLang, L, locale: lang === 'en' ? 'en-US' : 'es-PA' };
}
