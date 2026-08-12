// Palette de teintes douces pour les périodes d'entraînement.
// Cohérente avec la charte CourtSync (vert court, terre battue, jaune citron)
// tout en restant suffisamment distincte pour repérer chaque période.
export const PERIOD_PALETTE = [
  '#1E5631', // vert court
  '#C1502E', // terre battue
  '#8A9A1B', // olive citron
  '#4E7A9B', // bleu ardoise
  '#7B5EA6', // violet doux
  '#B0567B', // rose framboise
  '#2F8F83', // vert d'eau
  '#A9713A', // caramel
  '#5C6B62', // ardoise verte
  '#9C3E22', // brun terre
]

// Hash djb2 déterministe : mêmes entrées → même couleur, pour toujours.
export function hashString(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash
}

// Couleur déterministe (hash du seed) dans la palette, en garantissant
// qu'elle diffère de celle de la période précédente (`previousColor`).
export function pickPeriodColor(seed: string, previousColor: string | null): string {
  let index = hashString(seed) % PERIOD_PALETTE.length
  if (previousColor && PERIOD_PALETTE[index].toLowerCase() === previousColor.toLowerCase()) {
    index = (index + 1) % PERIOD_PALETTE.length
  }
  return PERIOD_PALETTE[index]
}

// Couleur de repli pour une ligne sans couleur stockée (pré-migration).
export function fallbackPeriodColor(id: string): string {
  return PERIOD_PALETTE[hashString(id) % PERIOD_PALETTE.length]
}

export function periodColor(period: { id: string; color: string | null }): string {
  return period.color || fallbackPeriodColor(period.id)
}

export function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// amount < 0 : fonce vers le noir (texte mode clair) ; amount > 0 : éclaircit vers le blanc (mode sombre).
export function shadeHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const target = amount < 0 ? 0 : 255
  const weight = Math.min(Math.abs(amount), 1)
  const channel = (value: number) => Math.round(value + (target - value) * weight)
  const r = channel((num >> 16) & 255)
  const g = channel((num >> 8) & 255)
  const b = channel(num & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
