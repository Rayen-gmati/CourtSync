import React from 'react';

export function CourtDivider({ label, className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center gap-4 py-8 ${className}`}>
      <div className="flex-1 h-px bg-[var(--border-strong)]"></div>

      <div className="flex items-center gap-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-ball)]"></div>
        {label && (
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest">
            {label}
          </span>
        )}
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-ball)]"></div>
      </div>

      <div className="flex-1 h-px bg-[var(--border-strong)]"></div>
    </div>
  );
}
