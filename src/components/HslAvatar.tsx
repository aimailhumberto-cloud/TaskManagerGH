"use client";

import React, { useState, useEffect } from 'react';

interface HslAvatarProps {
  id?: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  'data-testid'?: string;
}

export default function HslAvatar({
  id,
  name,
  avatarUrl,
  size = 10,
  className = '',
  'data-testid': dataTestId,
}: HslAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  // Reset imgFailed if avatarUrl changes
  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const showImage = avatarUrl && avatarUrl.trim() !== '' && !imgFailed;

  let initials = '?';
  const trimmed = name.trim();
  if (trimmed) {
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      initials = (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    } else {
      initials = trimmed.substring(0, 2).toUpperCase();
    }
  }

  // Dynamic HSL Hashing
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  const s = 65; // stable, beautiful saturation
  const l = 45; // stable, legible lightness
  const backgroundColor = `hsl(${h}, ${s}%, ${l}%)`;

  // Tailwind size mappings
  const sizeMap: Record<number, string> = {
    4: 'w-4 h-4 text-[8px]',
    5: 'w-5 h-5 text-[10px]',
    6: 'w-6 h-6 text-[11px]',
    8: 'w-8 h-8 text-[13px]',
    10: 'w-10 h-10 text-sm',
    12: 'w-12 h-12 text-base',
    16: 'w-16 h-16 text-xl',
  };

  const sizeClass = sizeMap[size] || `w-10 h-10 text-sm`;

  if (showImage) {
    return (
      <div
        id={id}
        data-testid={dataTestId}
        className={`relative rounded-full overflow-hidden flex-shrink-0 border border-primary-200/50 ${sizeClass} ${className}`}
      >
        <img
          src={avatarUrl!}
          alt={name}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      id={id}
      data-testid={dataTestId}
      className={`relative rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-white tracking-wider select-none border border-primary-200/50 ${sizeClass} ${className}`}
      style={{ backgroundColor }}
    >
      {initials}
    </div>
  );
}
