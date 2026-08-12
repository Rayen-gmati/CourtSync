import { popPercent, weatherKind, type DayWeather, type WeatherKind } from '@/lib/weather'

// Set SVG léger aligné sur le style trait de l'app (stroke currentColor).
function WeatherIcon({ kind }: { kind: WeatherKind }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'w-4 h-4',
    'aria-hidden': true,
  }

  switch (kind) {
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
      )
    case 'sun-cloud':
      return (
        <svg {...common}>
          <path d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41" />
          <path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" />
          <path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" />
        </svg>
      )
    case 'rain':
      return (
        <svg {...common}>
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M16 14v6M8 14v6M12 16v6" />
        </svg>
      )
    case 'storm':
      return (
        <svg {...common}>
          <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" />
          <path d="m13 12-3 5h4l-3 5" />
        </svg>
      )
    case 'snow':
      return (
        <svg {...common}>
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01" />
        </svg>
      )
    case 'fog':
      return (
        <svg {...common}>
          <path d="M3 9h18M3 13h18M3 17h12" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
        </svg>
      )
  }
}

// Indication météo discrète en coin de case jour : icône 16 px + badge de
// probabilité de pluie si > 30 %. Rien n'est rendu sans données (au-delà de
// 5 jours ou API indisponible).
export function WeatherBadge({ weather, className = '' }: { weather?: DayWeather; className?: string }) {
  if (!weather) return null

  const pop = popPercent(weather.pop)
  const description = weather.description.charAt(0).toUpperCase() + weather.description.slice(1)
  const tooltip = `${description} · ${weather.temp}°C · Probabilité de pluie : ${pop}%`

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 text-[var(--text-muted)]/80 ${className}`}
    >
      <WeatherIcon kind={weatherKind(weather.icon)} />
      {pop > 30 && (
        <span className="text-[10px] font-medium text-[#5b8db8] leading-none">{pop}%</span>
      )}
    </span>
  )
}
