import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js'

// Fabrique un client Supabase PARESSEUX : l'absence de variable d'env ne casse
// pas le build (l'erreur n'arrive qu'au premier usage), MAIS une valeur
// PRÉSENTE et MALFORMÉE (préfixe « KEY= », guillemets, espaces, non-JWT)
// déclenche une erreur immédiate et claire — y compris pendant `next build`,
// puisqu'un .env pollué ne doit jamais produire un 401 silencieux en prod.
//
// Sécurité : les messages d'erreur ne contiennent JAMAIS la valeur complète
// des clés — uniquement le nom de la variable, la longueur et le défaut
// détecté.

const JWT_SHAPE = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

function keyProblems(value: string): string[] {
  const problems: string[] = []
  if (/^KEY=/i.test(value)) problems.push('préfixe littéral « KEY= » collé devant le JWT')
  if (value.includes('=') || value.includes(' ') || value.includes('\n')) {
    problems.push('caractères parasites (« = », espace ou retour à la ligne)')
  }
  if (value.charAt(0) === '"' || value.charAt(0) === "'") problems.push('guillemets englobants')
  if (!value.startsWith('eyJ')) problems.push('ne commence pas par « eyJ »')
  else if (!JWT_SHAPE.test(value)) {
    problems.push('structure JWT attendue : 3 segments base64url séparés par « . »')
  }
  return problems
}

function assertEnvShape(
  names: { url: string; key: string },
  cfg: { url: string | undefined; key: string | undefined }
): void {
  if (cfg.url && !/^https:\/\/[a-z0-9.-]+$/i.test(cfg.url)) {
    throw new Error(
      `[env] ${names.url} est malformée : URL https:// attendue, sans espace ni guillemets ` +
        `(longueur reçue : ${cfg.url.length}). La valeur complète n’est volontairement pas affichée.`
    )
  }
  if (cfg.key) {
    const problems = keyProblems(cfg.key)
    if (problems.length > 0) {
      throw new Error(
        `[env] ${names.key} est malformée : ${problems.join(' ; ')}. ` +
          `Longueur reçue : ${cfg.key.length}. Une clé Supabase valide commence par « eyJ » ` +
          `et ne contient ni préfixe, ni guillemets, ni espace. ` +
          `La valeur complète n’est volontairement pas affichée.`
      )
    }
  }
}

export function createLazySupabaseClient(
  readConfig: () => { url: string | undefined; key: string | undefined },
  missingMessage: string,
  options?: SupabaseClientOptions<string>,
  names: { url: string; key: string } = {
    url: 'NEXT_PUBLIC_SUPABASE_URL',
    key: 'SUPABASE key',
  }
): SupabaseClient {
  // Fail-fast au chargement du module (donc aussi pendant `next build`) si une
  // valeur présente est malformée. L'absence, elle, reste paresseuse.
  assertEnvShape(names, readConfig())

  let client: SupabaseClient | null = null

  const resolve = (): SupabaseClient => {
    if (!client) {
      const cfg = readConfig()
      assertEnvShape(names, cfg)
      if (!cfg.url || !cfg.key) {
        throw new Error(missingMessage)
      }
      client = createClient(cfg.url, cfg.key, options) as SupabaseClient
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
