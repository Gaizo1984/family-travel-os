'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getFamily } from '@/lib/family'

function appendError(returnTo: string, error: string): string {
  const separator = returnTo.includes('?') ? '&' : '?'
  return `${returnTo}${separator}error=${encodeURIComponent(error)}`
}

/**
 * §Bugfix "Markierung erst nach Verlassen/Wiederkommen sichtbar" (Live-Test-
 * Feedback): jedes Häkchen redirectet auf exakt dieselbe URL, auf der es
 * schon steht (mehrere Formulare auf einer Seite, `return_to` = aktuelle
 * Länderliste inkl. Such-/Kontinentfilter) -- genau das Szenario, in dem
 * Next.js' Router Cache einen "Redirect zur bereits angezeigten Route" ohne
 * frischen Refetch bedienen kann, obwohl die Daten server-seitig längst
 * aktuell sind (bereits als bekanntes Muster in lib/actions/memories.ts
 * dokumentiert). Revalidiert deshalb explizit alle Stellen, die
 * person_country_visits anzeigen (Länderliste, Weltkarte, Dashboard).
 */
function revalidateCountryVisitViews(): void {
  revalidatePath('/family/world/countries')
  revalidatePath('/family/world')
  revalidatePath('/')
}

/**
 * §"manuelle Markierungen sind frei an- und abwählbar, keine doppelten
 * Länder pro Person" (Nutzervorgabe): `ON CONFLICT DO NOTHING` -- ist das
 * Land für diese Person bereits vermerkt (egal ob 'trip' oder bereits
 * 'manual'), passiert nichts, kein Duplikat, keine Herabstufung eines
 * bereits reise-bestätigten Landes.
 */
export async function addManualCountryVisit(formData: FormData): Promise<void> {
  const personId = String(formData.get('person_id') ?? '')
  const countryCode = String(formData.get('country_code') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/family/world/countries')
  if (!personId || !countryCode) redirect(appendError(returnTo, 'Person und Land werden benötigt.'))

  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  const { data: person } = await supabase.from('persons').select('id').eq('id', personId).eq('family_id', familyId).maybeSingle()
  if (!person) redirect(appendError(returnTo, 'Person nicht gefunden.'))

  const { error } = await supabase.from('person_country_visits').upsert(
    { person_id: personId, country_code: countryCode, source: 'manual' },
    { onConflict: 'person_id,country_code', ignoreDuplicates: true },
  )
  if (error) redirect(appendError(returnTo, 'Speichern fehlgeschlagen: ' + error.message))

  revalidateCountryVisitViews()
  redirect(returnTo)
}

/**
 * §"Reise-/Travel-History-Besuche bleiben schreibgeschützt und dürfen über
 * die Checkliste nicht entfernt werden" (Nutzervorgabe, wörtlich): das
 * `source='manual'`-Filter IST die vollständige Absicherung -- ein
 * Löschversuch für eine `source='trip'`-Zeile trifft schlicht keine Zeile,
 * kein gesonderter Vorab-Check nötig.
 */
export async function removeManualCountryVisit(formData: FormData): Promise<void> {
  const personId = String(formData.get('person_id') ?? '')
  const countryCode = String(formData.get('country_code') ?? '')
  const returnTo = String(formData.get('return_to') ?? '/family/world/countries')
  if (!personId || !countryCode) redirect(appendError(returnTo, 'Person und Land werden benötigt.'))

  const { id: familyId } = await getFamily()
  const supabase = await createClient()

  const { data: person } = await supabase.from('persons').select('id').eq('id', personId).eq('family_id', familyId).maybeSingle()
  if (!person) redirect(appendError(returnTo, 'Person nicht gefunden.'))

  await supabase.from('person_country_visits').delete()
    .eq('person_id', personId).eq('country_code', countryCode).eq('source', 'manual')

  revalidateCountryVisitViews()
  redirect(returnTo)
}
