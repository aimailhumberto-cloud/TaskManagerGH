/** Texto según el idioma de la pantalla (para código que corre en el navegador; el servidor usa reqLang.tr). */
export const trc = (es: string, en: string): string => (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? en : es);
