import { NextResponse } from 'next/server'
import { requireCoach } from '@/lib/api-auth'
import { getEarningsSummary } from '@/lib/earnings'

// Résumé des gains du coach connecté : mois en cours + cumul à ce jour.
// Accès restreint au rôle coach (vérifié côté serveur, pas seulement côté front).
export async function GET() {
  const coach = await requireCoach()
  if (!coach) {
    return NextResponse.json({ error: 'Accès réservé aux coachs.' }, { status: 403 })
  }

  try {
    const summary = await getEarningsSummary(coach.id)
    return NextResponse.json(summary)
  } catch (summaryError) {
    console.error('Error computing earnings summary:', summaryError)
    return NextResponse.json({ error: 'Impossible de calculer les gains.' }, { status: 500 })
  }
}
