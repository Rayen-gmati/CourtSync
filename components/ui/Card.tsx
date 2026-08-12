import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive = false, className = '', children, ...props }: CardProps) {
  const baseStyles = "bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-card shadow-card";
  const interactiveStyles = interactive ? "transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5 cursor-pointer hover:border-[var(--border-strong)]" : "";

  return (
    <div className={`${baseStyles} ${interactiveStyles} ${className}`} {...props}>
      {children}
    </div>
  );
}
