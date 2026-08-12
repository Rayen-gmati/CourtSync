import React from 'react'

export function TennisServiceSilhouette({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none text-current ${className}`}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-10 dark:opacity-[0.07]">
        {/* Tête */}
        <circle cx="100" cy="40" r="10" />
        {/* Corps */}
        <path d="M100 50 C95 70 85 90 90 110" />
        {/* Bras gauche (lance la balle) */}
        <path d="M100 55 C80 50 60 40 50 25" />
        {/* Balle */}
        <circle cx="45" cy="15" r="3" fill="currentColor" />
        {/* Bras droit (avec raquette) */}
        <path d="M100 65 C120 70 140 85 135 110" />
        {/* Raquette */}
        <path d="M135 110 L150 140" />
        <ellipse cx="158" cy="155" rx="12" ry="18" transform="rotate(-30 158 155)" />
        <path d="M148 145 L168 165 M152 165 L162 145" strokeWidth="1" strokeOpacity="0.5" />
        {/* Jambe gauche */}
        <path d="M90 110 C80 135 70 160 80 180" />
        <path d="M80 180 L70 185" />
        {/* Jambe droite */}
        <path d="M90 110 C105 130 115 150 110 175" />
        <path d="M110 175 L125 180" />
      </g>
    </svg>
  )
}
