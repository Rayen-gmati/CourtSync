import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-auth'
import { getEarningsHistory } from '@/lib/earnings'

// Historique des gains groupé par mois puis par joueur (séances "faites"
// uniquement, statut calculé à la volée). Accès restreint au rôle coach.
export async function GET() {
  const coach = await requireCoach()
  if (!coach) {
    return NextResponse.json({ error: 'Accès réservé aux coachs.' }, { status: 403 })
  }

  try {
    const history = await getEarningsHistory(coach.id)
    return NextResponse.json(history)
  } catch (historyError) {
    console.error('Error computing earnings history:', historyError)
    return NextResponse.json({ error: 'Impossible de calculer l’historique des gains.' }, { status: 500 })
  }
}
