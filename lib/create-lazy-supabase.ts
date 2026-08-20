import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js'

// Fabrique un client Supabase PARESSEUX : la lecture des variables d'env et
// le throw éventuel n'arrivent qu'au premier usage réel, jamais à l'import.
//
// Pourquoi : `next build` (notamment sur Vercel) importe les modules de
// routes pour collecter les page data. Un throw au niveau module (clé
// service_role absente de l'environnement de build) cassait le build alors
// que le secret n'est nécessaire qu'au runtime. Avec ce proxy, le build
// passe sans secret et une requête sans configuration renvoie une erreur
// claire au premier accès.

export function createLazySupabaseClient(
  readConfig: () => { url: string | undefined; key: string | undefined },
  missingMessage: string,
  options?: SupabaseClientOptions<string>
): SupabaseClient {
  let client: SupabaseClient | null = null

  const resolve = (): SupabaseClient => {
    if (!client) {
      const { url, key } = readConfig()
      if (!url || !key) {
        throw new Error(missingMessage)
      }
      client = createClient(url, key, options) as SupabaseClient
    }
    return client
  }

  return new Proxy({} as SupabaseClient, {
    get(_target, prop) {
      const value = Reflect.get(resolve(), prop)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(resolve()) : value
    },
  })
}
