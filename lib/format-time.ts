// Affichage des créneaux horaires : la base stocke des TIME (« HH:MM:SS »)
// mais l'interface ne doit montrer que « HH:MM ». Cette fonction tronque
// UNIQUEMENT le rendu utilisateur — le stockage et les valeurs transmises
// à la base restent inchangés.

export function formatTime(value: string | null | undefined): string {
  if (!value) return ''
  const match = value.match(/^(\d{1,2}:\d{2})/)
  return match ? match[1] : value
}
