// « Se souvenir de moi » : choix du stockage de la session supabase-js.
// - coché   → localStorage   (session conservée après fermeture du navigateur)
// - décoché → sessionStorage (session limitée à l'onglet / au navigateur ouvert)
//
// L'adaptateur est passé à createClient via `auth.storage` (supabase-js v2) :
// le client l'utilise de façon synchrone pour lire/écrire sa session.
// Les cookies HttpOnly posés par /api/auth/session restent, eux, des cookies
// de session (supprimés à la fermeture du navigateur) dans les deux cas.

const CHOICE_KEY = 'courtsync-remember-me'
const SUPABASE_SESSION_KEY = /^sb-.*-auth-token$/

function target(): Storage {
  try {
    return sessionStorage.getItem(CHOICE_KEY) === '0' ? sessionStorage : localStorage
  } catch {
    return localStorage
  }
}

function clearSupabaseSessions(storage: Storage): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (key && SUPABASE_SESSION_KEY.test(key)) doomed.push(key)
    }
    doomed.forEach((key) => storage.removeItem(key))
  } catch {
    // stockage indisponible : rien à nettoyer
  }
}

export const rememberStorage = {
  getItem(key: string): string | null {
    try {
      return sessionStorage.getItem(key) ?? localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      target().setItem(key, value)
    } catch {
      // stockage indisponible (navigation privée) : session en mémoire seule
    }
  },
  removeItem(key: string): void {
    try {
      sessionStorage.removeItem(key)
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  },
}

// À appeler AVANT signInWithPassword : mémorise le choix et purge les sessions
// Supabase de l'autre stockage pour qu'une session antérieure ne ressuscite
// pas contre le choix exprimé (ex: ancien login « souvenir » alors que
// l'utilisateur décoche la case).
export function setRememberMe(remember: boolean): void {
  try {
    if (remember) {
      localStorage.setItem(CHOICE_KEY, '1')
      sessionStorage.removeItem(CHOICE_KEY)
      clearSupabaseSessions(sessionStorage)
    } else {
      sessionStorage.setItem(CHOICE_KEY, '0')
      localStorage.removeItem(CHOICE_KEY)
      clearSupabaseSessions(localStorage)
    }
  } catch {
    // ignore
  }
}
