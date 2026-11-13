'use client';
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { writeLangCookie } from './langCookie';

export type UiLang = 'es' | 'en';
const KEY = 'cerebro_lang'; // la misma preferencia que usa el mapa del Cerebro
const read = (): UiLang | null => { try { const v = localStorage.getItem(KEY); return v === 'en' || v === 'es' ? v : null; } catch { return null; } };

/** El servidor da el idioma inicial (cookie): así la primera pantalla ya sale en el idioma correcto, sin saltar de español a inglés. */
const Initial = createContext<UiLang>('es');
export function UiLangProvider({ initial, children }: { initial: UiLang; children: ReactNode }) { return createElement(Initial.Provider, { value: initial }, children); }

/** Idioma de la interfaz (español o inglés), compartido por todas las pantallas y recordado en el navegador y en una cookie. */
export function useUiLang() {
  const initial = useContext(Initial);
  const [lang, setLangState] = useState<UiLang>(initial);
  useEffect(() => {
    // Quien ya tenía el idioma guardado solo en el navegador (antes de la cookie) lo conserva y la cookie se pone aquí.
    const sync = () => { const v = read(); if (v) { writeLangCookie(v); setLangState(v); } };
    sync(); window.addEventListener('ui-lang', sync); window.addEventListener('storage', sync);
    return () => { window.removeEventListener('ui-lang', sync); window.removeEventListener('storage', sync); };
  }, []);
  const setLang = useCallback((l: UiLang) => {
    try { localStorage.setItem(KEY, l); } catch {}
    writeLangCookie(l); setLangState(l); try { document.documentElement.lang = l; } catch {}
    window.dispatchEvent(new Event('ui-lang'));
  }, []);
  const L = useCallback((es: string, en: string) => (lang === 'en' ? en : es), [lang]);
  return { lang, setLang, L, locale: lang === 'en' ? 'en-US' : 'es-PA' };
}
