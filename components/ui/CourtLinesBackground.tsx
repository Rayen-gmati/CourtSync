import React from 'react'

export function CourtLinesBackground({ className = 'absolute inset-0' }: { className?: string }) {
  return (
    <div className={`${className} overflow-hidden pointer-events-none`} aria-hidden="true">
      <svg
        className="w-full h-full text-current opacity-[0.04] dark:opacity-[0.05]"
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Lignes de court de tennis */}
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="square">
          {/* Lignes extérieures */}
          <rect x="50" y="50" width="700" height="500" />
          {/* Lignes de simple */}
          <line x1="120" y1="50" x2="120" y2="550" />
          <line x1="680" y1="50" x2="680" y2="550" />
          {/* Filet */}
          <line x1="30" y1="300" x2="770" y2="300" strokeWidth="6" strokeDasharray="10 4" />
          {/* Lignes de service */}
          <line x1="120" y1="160" x2="680" y2="160" />
          <line x1="120" y1="440" x2="680" y2="440" />
          {/* Ligne médiane de service */}
          <line x1="400" y1="160" x2="400" y2="440" />
          {/* Marques de centre */}
          <line x1="400" y1="50" x2="400" y2="60" />
          <line x1="400" y1="540" x2="400" y2="550" />
        </g>
      </svg>
    </div>
  )
}
