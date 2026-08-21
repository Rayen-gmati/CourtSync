import React from 'react'

export function CourtLinesBackground({ className = 'absolute inset-0' }: { className?: string }) {
  return (
    <div className={`${className} overflow-hidden pointer-events-none`} aria-hidden="true">
      {/* Court en orientation portrait : vu depuis une extrémité, dans le
          sens de la longueur (filet horizontal au centre). `slice` remplit
          le conteneur sans déformation (rognage doux sur les bords). */}
      <svg
        className="w-full h-full text-current opacity-[0.04] dark:opacity-[0.05]"
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="square">
          {/* Lignes extérieures */}
          <rect x="80" y="40" width="440" height="720" />
          {/* Lignes de simple */}
          <line x1="135" y1="40" x2="135" y2="760" />
          <line x1="465" y1="40" x2="465" y2="760" />
          {/* Filet */}
          <line x1="50" y1="400" x2="550" y2="400" strokeWidth="6" strokeDasharray="10 4" />
          {/* Lignes de service */}
          <line x1="135" y1="220" x2="465" y2="220" />
          <line x1="135" y1="580" x2="465" y2="580" />
          {/* Ligne médiane de service */}
          <line x1="300" y1="220" x2="300" y2="580" />
          {/* Marques de centre */}
          <line x1="300" y1="40" x2="300" y2="52" />
          <line x1="300" y1="748" x2="300" y2="760" />
        </g>
      </svg>
    </div>
  )
}
