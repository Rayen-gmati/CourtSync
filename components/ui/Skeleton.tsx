import React from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-[var(--bg-dim)] rounded-lg overflow-hidden relative ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[var(--bg-card)]/40 to-transparent"></div>
    </div>
  );
}
