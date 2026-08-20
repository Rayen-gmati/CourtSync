import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  type?: 'entrainement' | 'echauffement' | 'match' | 'prevue' | 'faite' | 'annulee';
}

export function Badge({ type = 'entrainement', className = '', children, ...props }: BadgeProps) {
  const styles = {
    entrainement: { bg: 'bg-[var(--bg-green-muted)]', text: 'text-[var(--accent-primary)]', dot: 'bg-[var(--accent-primary)]' },
    echauffement: { bg: 'bg-[var(--bg-yellow-muted)]', text: 'text-[var(--accent-ball-dark)]', dot: 'bg-[var(--accent-ball)]' },
    match: { bg: 'bg-[var(--bg-clay-muted)]', text: 'text-[var(--accent-secondary-dark)]', dot: 'bg-[var(--accent-secondary)]' },
    prevue: { bg: 'bg-[var(--bg-neutral-muted)]', text: 'text-[var(--text-muted)]', dot: 'bg-[var(--text-muted)]' },
    faite: { bg: 'bg-[var(--bg-yellow-muted)]', text: 'text-[var(--accent-ball-dark)]', dot: 'bg-[var(--accent-ball)]' },
    annulee: { bg: 'bg-[var(--bg-clay-muted)]', text: 'text-[var(--accent-secondary-dark)]', dot: 'bg-[var(--accent-secondary-dark)]' },
  };

  const style = styles[type] || styles.entrainement;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${style.bg} ${style.text} ${className}`}
      {...props}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${style.dot}`}></span>
      {children || type}
    </span>
  );
}
