import React from 'react';
import { ICON_PATHS, TYPE_ICON } from './bubbleArt';

/** Icono de línea del tipo de ficha: el mismo dibujo que llevan las burbujas del mapa. */
export function TypeIcon({ type, size = 18, className = '' }: { type: string; size?: number; className?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={`cerebro-type-icon shrink-0 ${className}`}>
      <path d={ICON_PATHS[TYPE_ICON[type] || 'file'] || ICON_PATHS.file} />
    </svg>
  );
}
