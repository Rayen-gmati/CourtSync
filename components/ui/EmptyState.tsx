import React from 'react';
import { TennisServiceSilhouette } from './TennisServiceSilhouette';

export function EmptyState({ title, message, className = '' }: { title?: string, message?: string, className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
      <TennisServiceSilhouette className="w-32 h-32 mb-4 text-[var(--accent-primary)] opacity-10 dark:opacity-10" />
      {title && <h3 className="text-lg font-sora font-semibold text-[var(--text-main)] mb-1">{title}</h3>}
      {message && <p className="text-[var(--text-muted)] text-sm">{message}</p>}
    </div>
  );
}