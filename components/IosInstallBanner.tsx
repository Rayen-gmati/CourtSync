'use client'

// Bandeau discret expliquant l'installation sur iOS Safari
// (Partager → Sur l'écran d'accueil), affiché une seule fois.
// Limitation Apple : aucun prompt automatique possible sur iOS.

import { useEffect, useState } from 'react'

const DISMISS_KEY = 'courtsync-ios-install-hint-dismissed'

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const nav = window.navigator as Navigator & { standalone?: boolean }
      const isIos = /iPhone|iPad|iPod/.test(nav.userAgent)
      const isSafari = /Safari/.test(nav.userAgent) && !/CriOS|FxiOS|EdgiOS|Chrome/.test(nav.userAgent)
      const isStandalone =
        Boolean(nav.standalone) || window.matchMedia('(display-mode: standalone)').matches
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1'

      if (isIos && isSafari && !isStandalone && !dismissed) {
        setVisible(true)
      }
    } catch {
      // Aucun bandeau en cas de doute : jamais bloquant.
    }
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // localStorage indisponible : on masque simplement le bandeau.
    }
    setVisible(false)
  }

  return (
    <div
      role="status"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] inset-x-4 z-50 rounded-card border border-[var(--border-strong)] bg-[var(--bg-card)] shadow-2xl p-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-xl" aria-hidden="true">📲</span>
        <div className="flex-1">
          <p className="text-sm font-sora font-semibold text-[var(--text-main)]">Installer CourtSync</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Touchez <span className="font-semibold">Partager</span> puis{' '}
            <span className="font-semibold">Sur l’écran d’accueil</span> pour utiliser CourtSync comme une application.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-dim)] transition"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
