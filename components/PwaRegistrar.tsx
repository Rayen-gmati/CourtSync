'use client'

// Enregistrement du service worker (production uniquement, pour éviter
// la mise en cache des assets de dev).

import { useEffect } from 'react'

export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Échec silencieux : l'app reste pleinement utilisable sans SW.
      })
    })
  }, [])

  return null
}
