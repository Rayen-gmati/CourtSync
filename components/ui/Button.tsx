import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost';
  isLoading?: boolean;
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  isLoading,
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center px-4 py-2 min-h-[44px] text-sm font-medium transition-all duration-150 rounded-full active:scale-[0.97] active:opacity-90 disabled:opacity-50 disabled:pointer-events-none";

  const variants = {
    primary: "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)]",
    accent: "bg-[var(--accent-cta)] text-[var(--text-main)] hover:bg-[var(--accent-cta-hover)] font-semibold",
    secondary: "bg-[var(--bg-inset)] hover:bg-[var(--bg-neutral-muted)] text-[var(--text-main)] border border-transparent",
    ghost: "bg-transparent text-[var(--accent-primary)] hover:underline",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <svg className="w-5 h-5 mr-2 animate-spin-ring text-current opacity-70" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
}
