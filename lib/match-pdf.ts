// Export PDF one-page d'une fiche match (design system CourtSync : vert foncé + jaune citron).
// jspdf est importé dynamiquement : la lib (~150 kB) n'est téléchargée
// qu'au clic sur « Exporter », pas dans le bundle initial des dashboards.
import {
  MatchDetailsRow,
  MATCH_RESULT_LABELS,
  breakConversionPercent,
  computeMatchResult,
  formatScore,
  sanitizeFileName,
  setsWon,
  winnersErrorsRatio,
} from '@/lib/match-stats'

const GREEN: [number, number, number] = [30, 77, 43]
const LEMON: [number, number, number] = [201, 214, 66]
const CREAM: [number, number, number] = [244, 241, 234]
const INK: [number, number, number] = [35, 42, 38]
const MUTED: [number, number, number] = [110, 118, 110]

type ExportContext = {
  row: MatchDetailsRow
  playerName: string
  sessionDate: string
  lastEditedName: string | null
}

export async function exportMatchPdf({ row, playerName, sessionDate, lastEditedName }: ExportContext) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14

  // Bandeau d'en-tête vert foncé.
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setFillColor(...LEMON)
  doc.rect(0, 30, pageWidth, 1.6, 'F')
  doc.setTextColor(...LEMON)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text('CourtSync', margin, 13)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Fiche de match', pageWidth - margin, 13, { align: 'right' })
  doc.setFontSize(9)
  doc.text(sessionDate, pageWidth - margin, 19, { align: 'right' })

  // Titre : joueur vs adversaire + résultat.
  let y = 44
  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(`${playerName}  vs  ${row.adversaire || 'Adversaire à préciser'}`, margin, y)

  const result = computeMatchResult(row.sets, row.result_override)
  if (result) {
    const label = MATCH_RESULT_LABELS[result]
    const isWin = result === 'victoire'
    doc.setFillColor(...(isWin ? GREEN : result === 'defaite' ? [176, 96, 62] : MUTED) as [number, number, number])
    doc.roundedRect(pageWidth - margin - 34, y - 6, 34, 9, 2, 2, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.text(label, pageWidth - margin - 17, y, { align: 'center' })
  }

  y += 7
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  const contextBits = [row.tournament_name, row.round, row.surface].filter(Boolean).join('  ·  ')
  if (contextBits) doc.text(contextBits, margin, y)

  // Score set par set en grand sur bandeau crème.
  y += 6
  doc.setFillColor(...CREAM)
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'F')
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(formatScore(row.sets), pageWidth / 2, y + 11, { align: 'center', charSpace: 1 })
  const { player, opponent } = setsWon(row.sets)
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.setFont('helvetica', 'normal')
  doc.text(`Sets : ${player} - ${opponent}`, pageWidth / 2, y + 18, { align: 'center' })

  // Grille des statistiques.
  y += 32
  doc.setTextColor(...GREEN)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Statistiques clés', margin, y)
  y += 4

  const ratio = winnersErrorsRatio(row.winners, row.direct_errors)
  const breakPercent = breakConversionPercent(row.break_points_won, row.break_points_total)
  const stats: Array<[string, string]> = [
    ['Aces', String(row.aces)],
    ['Doubles fautes', String(row.double_faults)],
    ['Première balle', row.first_serve_percent === null || row.first_serve_percent === undefined ? '—' : `${row.first_serve_percent} %`],
    ['Winners', String(row.winners)],
    ['Erreurs directes', String(row.direct_errors)],
    ['Ratio winners / erreurs', ratio ?? '—'],
    ['Balles de break', `${row.break_points_won} / ${row.break_points_total}`],
    ['Breaks convertis', breakPercent === null ? '—' : `${breakPercent} %`],
  ]

  const colWidth = (pageWidth - margin * 2 - 8) / 2
  let cursorY = y + 2
  stats.forEach(([label, value], index) => {
    const col = index % 2
    const x = margin + col * (colWidth + 8)
    if (col === 0 && index > 0) cursorY += 10
    doc.setFillColor(...CREAM)
    doc.roundedRect(x, cursorY, colWidth, 8, 1.5, 1.5, 'F')
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(label, x + 3, cursorY + 5.4)
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text(value, x + colWidth - 3, cursorY + 5.4, { align: 'right' })
  })
  y = cursorY + 14

  // Notes.
  if (row.notes) {
    doc.setTextColor(...GREEN)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('Notes', margin, y)
    y += 5
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    const lines = doc.splitTextToSize(row.notes, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 5 + 6
  }

  // Pied de page : traçabilité + date d'export.
  const footerY = pageHeight - 12
  doc.setDrawColor(...LEMON)
  doc.setLineWidth(0.6)
  doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4)
  doc.setTextColor(...MUTED)
  doc.setFontSize(8.5)
  const edited = row.last_edited_at
    ? `Dernière modification par ${lastEditedName || 'un utilisateur'} le ${new Date(row.last_edited_at).toLocaleDateString('fr-FR')}`
    : ''
  doc.text(edited, margin, footerY)
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')} — CourtSync`, pageWidth - margin, footerY, { align: 'right' })

  const fileName = `Match_${sanitizeFileName(playerName) || 'Joueur'}_${sanitizeFileName(row.adversaire) || 'Adversaire'}_${sanitizeFileName(sessionDate)}.pdf`
  doc.save(fileName)
}
