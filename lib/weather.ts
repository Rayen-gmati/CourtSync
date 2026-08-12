export type DayWeather = {
  date: string
  time: string
  description: string
  icon: string
  temp: number
  pop: number
}

export type WeatherByDate = Record<string, DayWeather>

export type WeatherKind = 'sun' | 'sun-cloud' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog'

// Mapping des codes icône OpenWeatherMap vers le set SVG custom de l'app.
export function weatherKind(iconCode: string): WeatherKind {
  const prefix = iconCode.slice(0, 2)
  switch (prefix) {
    case '01':
      return 'sun'
    case '02':
      return 'sun-cloud'
    case '03':
    case '04':
      return 'cloud'
    case '09':
    case '10':
      return 'rain'
    case '11':
      return 'storm'
    case '13':
      return 'snow'
    case '50':
      return 'fog'
    default:
      return 'cloud'
  }
}

export function popPercent(pop: number) {
  return Math.round(Math.min(Math.max(pop, 0), 1) * 100)
}
