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
        <select
          ref={ref}
          className={`w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-input text-[var(--text-main)] outline-none transition-all focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary)]/30 disabled:opacity-50 disabled:bg-[var(--bg-dim)] appearance-none ${
            error ? 'border-[var(--accent-secondary-dark)] focus:border-[var(--accent-secondary-dark)] focus:ring-[var(--accent-secondary-dark)]/20' : ''
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="mt-1.5 text-sm text-[var(--accent-secondary-dark)]">{error}</p>}
      </div>
    );
  }
);
Select.displayName = 'Select';
