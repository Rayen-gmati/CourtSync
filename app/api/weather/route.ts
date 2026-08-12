import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DayWeather, WeatherByDate } from '@/lib/weather'

export const dynamic = 'force-dynamic'

// Cache en mémoire : l'API OpenWeatherMap n'est appelée qu'une fois par jour
// (plan gratuit). Les données sont rafraîchies si le cache a plus de 23 h
// ou s'il ne contient pas le jour courant.
const CACHE_TTL_MS = 23 * 60 * 60 * 1000

let weatherCache: { fetchedAt: number; days: WeatherByDate } | null = null

function pad(value: number) {
  return `${value}`.padStart(2, '0')
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isCacheFresh(cache: { fetchedAt: number; days: WeatherByDate }, now: Date) {
  if (now.getTime() - cache.fetchedAt > CACHE_TTL_MS) return false
  return Boolean(cache.days[localDateKey(now)])
}

type OwmSlot = {
  dt: number
  main: { temp: number }
  weather: Array<{ description: string; icon: string }>
  pop: number
  dt_txt: string
}

// Pour chaque jour, on retient le créneau 3 h le plus proche de midi :
// c'est le plus représentatif d'une journée d'entraînement.
function pickRepresentativeSlots(list: OwmSlot[]): DayWeather[] {
  const byDate = new Map<string, OwmSlot[]>()
  for (const slot of list) {
    const date = slot.dt_txt.slice(0, 10)
    const group = byDate.get(date) || []
    group.push(slot)
    byDate.set(date, group)
  }

  const days: DayWeather[] = []
  for (const [date, slots] of byDate) {
    const best = slots.reduce((closest, slot) => {
      const distance = (value: OwmSlot) => Math.abs(Number(value.dt_txt.slice(11, 13)) - 12)
      return distance(slot) < distance(closest) ? slot : closest
    }, slots[0])

    const entry = best.weather[0]
    if (!entry) continue

    days.push({
      date,
      time: best.dt_txt.slice(11, 16),
      description: entry.description,
      icon: entry.icon,
      temp: Math.round(best.main.temp),
      pop: best.pop || 0,
    })
  }

  return days.sort((a, b) => a.date.localeCompare(b.date))
}

async function fetchForecast(): Promise<WeatherByDate> {
  const apiKey = process.env.OPENWEATHER_API_KEY
  const lat = process.env.WEATHER_LAT || '36.8065'
  const lon = process.env.WEATHER_LON || '10.1815'

  if (!apiKey) {
    console.warn('Weather disabled: OPENWEATHER_API_KEY is not configured.')
    return {}
  }

  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=fr`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    console.error(`OpenWeatherMap error: HTTP ${response.status}`)
    return {}
  }

  const payload = (await response.json()) as { list?: OwmSlot[] }
  const days = pickRepresentativeSlots(payload.list || [])
  return Object.fromEntries(days.map((day) => [day.date, day]))
}

// L'authentification est exigée (coach OU parent) mais le rôle n'a pas
// d'importance : la météo est en lecture seule pour les deux interfaces.
async function isAuthenticated() {
  const token = cookies().get('auth_token')?.value
  if (!token) return false

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return !error && Boolean(data.user)
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 })
  }

  const now = new Date()

  try {
    if (!weatherCache || !isCacheFresh(weatherCache, now)) {
      const days = await fetchForecast()
      // On garde l'ancien cache si l'appel échoue (quota dépassé, API down).
      if (Object.keys(days).length > 0 || !weatherCache) {
        weatherCache = { fetchedAt: now.getTime(), days }
      }
    }

    const today = localDateKey(now)
    const days: WeatherByDate = {}
    for (const [date, value] of Object.entries(weatherCache?.days || {})) {
      // Le plan gratuit couvre ~5 jours : au-delà, rien n'est renvoyé.
      if (date >= today) days[date] = value
    }

    return NextResponse.json({ days })
  } catch (weatherError) {
    console.error('Weather fetch failed:', weatherError)
    return NextResponse.json({ days: {} })
  }
}
