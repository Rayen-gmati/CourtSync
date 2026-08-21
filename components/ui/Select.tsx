import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', label, error, children, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block mb-1.5 text-sm font-medium text-[var(--text-muted)]">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={`w-full px-4 py-2.5 pr-10 min-h-[44px] text-base bg-[var(--bg-inset)] border border-transparent rounded-input text-[var(--text-main)] outline-none transition-all focus:border-[var(--accent-cta)] focus:ring-2 focus:ring-[var(--accent-cta)]/25 disabled:opacity-50 disabled:bg-[var(--bg-dim)] appearance-none cursor-pointer active:opacity-90 ${
              error ? 'border-[var(--accent-secondary-dark)] focus:border-[var(--accent-secondary-dark)] focus:ring-[var(--accent-secondary-dark)]/20' : ''
            } ${className}`}
            {...props}
          >
            {children}
          </select>
          <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
        {error && <p className="mt-1.5 text-sm text-[var(--accent-secondary-dark)]">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
