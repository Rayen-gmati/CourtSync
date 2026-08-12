'use client'

import { useEffect, useState } from 'react'

// Horloge partagée : recalcul toutes les `intervalMs` + au focus/visibility,
// pour que les statuts de séance passent de "prévue" → "en cours" → "faite"
// sans rechargement de la page.
export function useNow(intervalMs = 30000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const refresh = () => setNow(new Date())
    const id = setInterval(refresh, intervalMs)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      clearInterval(id)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [intervalMs])

  return now
}
