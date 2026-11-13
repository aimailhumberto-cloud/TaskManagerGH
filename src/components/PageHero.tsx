import React from 'react';

/** Franja azul con foto de marca que encabeza las pantallas de cuenta. */
export default function PageHero({ title, subtitle, eyebrow = 'S.M. JALEEL' }: { title: string; subtitle?: string; eyebrow?: string }) {
  return (
    <div className="grid overflow-hidden rounded-[24px] bg-[#0a3fbf] sm:grid-cols-[1.4fr_1fr]">
      <div className="p-6">
        <p className="text-[12px] font-semibold tracking-[0.08em] text-[#9fdcff]">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold text-white sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#dbeafe]">{subtitle}</p>}
      </div>
      <div className="relative hidden min-h-[120px] sm:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/smj-bebidas-hero.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 72%' }} />
        <div aria-hidden className="absolute inset-y-0 left-0 w-24" style={{ background: 'linear-gradient(90deg, #0a3fbf, rgba(10,63,191,0))' }} />
      </div>
    </div>
  );
}
