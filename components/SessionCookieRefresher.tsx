'use client'

// Synchronise le cookie HttpOnly `auth_token` avec la session supabase-js.
//
// Problème corrigé (B2) : le cookie était posé une seule fois à la connexion
// avec le token initial (~1 h de validité). supabase-js rafraîchit bien sa
// session en localStorage, mais les routes API (/api/earnings/*, /api/weather)
// lisaient le cookie périmé → 401 après ~1 h jusqu'à re-connexion.
//
// Solution : à chaque TOKEN_REFRESHED / SIGNED_IN (et au montage si une
// session restaurée existe), on re-publie le nouveau access_token vers
// /api/auth/session, qui repose les cookies HttpOnly côté serveur.

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export function SessionCookieRefresher() {
  useEffect(() => {
    let active = true

    const syncCookie = async (accessToken?: string | null) => {
      if (!accessToken) return
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken }),
        })
      } catch {
        // Réseau indisponible : le prochain événement retentera.
      }
    }

    // Session restaurée depuis localStorage (page recharge après expiration
    // du cookie) : on resynchronise immédiatement.
    supabase.auth.getSession().then(({ data }) => {
      if (active) syncCookie(data.session?.access_token)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        syncCookie(session?.access_token)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  return null
}
