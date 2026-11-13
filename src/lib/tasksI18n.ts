'use client';
import { useCallback } from 'react';
import { useUiLang } from './uiLang';
import { TASKS_EN } from '@/app/tasks/en';

/** Traductor de la pantalla de Tareas y sus ventanas: T('texto en español') devuelve el texto en el idioma elegido. */
export function useTasksT() {
  const { lang } = useUiLang();
  return useCallback((es: string) => (lang === 'en' ? TASKS_EN[es] ?? es : es), [lang]);
}
