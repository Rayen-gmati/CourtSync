import React from 'react';

export function BouncingBall({ className = '', size = 'md' }: { className?: string, size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16'
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      {/* The Ball */}
      <div className={`${s} relative animate-ball-bounce z-10`}>
        <div className="w-full h-full rounded-full bg-[var(--accent-ball)] overflow-hidden relative shadow-sm border border-[var(--border-strong)]">
          {/* Tennis ball curved lines */}
          <div className="absolute top-0 bottom-0 left-[-20%] w-[40%] rounded-r-full border-r-[1.5px] border-[var(--bg-card)]/60"></div>
          <div className="absolute top-0 bottom-0 right-[-20%] w-[40%] rounded-l-full border-l-[1.5px] border-[var(--bg-card)]/60"></div>
        </div>
      </div>

      {/* The Shadow */}
      <div className={`h-1.5 mt-1 bg-[var(--text-main)]/20 rounded-full animate-ball-shadow blur-[1px] ${
        size === 'sm' ? 'w-4' : size === 'lg' ? 'w-10' : 'w-6'
      }`}></div>
    </div>
  );
}
