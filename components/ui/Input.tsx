import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block mb-1.5 text-sm font-medium text-[var(--text-muted)]">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-strong)] rounded-input text-[var(--text-main)] outline-none transition-all focus:border-[var(--accent-secondary)] focus:ring-2 focus:ring-[var(--accent-secondary)]/30 disabled:opacity-50 disabled:bg-[var(--bg-dim)] ${
            error ? 'border-[var(--accent-secondary-dark)] focus:border-[var(--accent-secondary-dark)] focus:ring-[var(--accent-secondary-dark)]/20' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-[var(--accent-secondary-dark)]">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
