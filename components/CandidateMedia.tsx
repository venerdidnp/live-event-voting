'use client';

import React from 'react';

interface CandidateMediaProps {
  photoData?: string | null;
  name: string;
  number?: string | number;
  className?: string;
  theme?: string | null;
}

export function CandidateMedia({
  photoData,
  name,
  number,
  className = '',
}: CandidateMediaProps) {
  if (photoData && photoData.startsWith('data:image/')) {
    return (
      <img
        src={photoData}
        alt={name}
        className={`w-full h-full object-cover ${className}`}
      />
    );
  }

  // High quality generic SVG costume avatar if no photo uploaded
  const numStr = String(number || '01');
  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#003E85] via-[#006FD6] to-[#0F172A] text-white p-4 relative overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-400/20 via-transparent to-transparent pointer-events-none" />
      <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-2 shadow-inner">
        <svg
          className="w-8 h-8 text-sky-200"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
      <span className="text-xs font-extrabold tracking-wider uppercase text-sky-200">
        No. {numStr}
      </span>
      <span className="text-[11px] font-semibold text-white/90 truncate max-w-[90%] mt-0.5 text-center">
        {name}
      </span>
    </div>
  );
}
