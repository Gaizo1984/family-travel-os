'use server'

import { redirect } from 'next/navigation'

/**
 * §"Auswahl der zuletzt verwendeten Reise nur für diesen Nutzer bzw. diese
 * Familie speichern" (Nutzervorgabe, wörtlich): bewusst KEIN Cookie -- ein
 * Browser-Cookie würde bei mehreren Familienmitgliedern/Geräten falsch
 * geteilt oder verloren gehen. Stattdessen `families.last_lumi_trip_id`
 * (Migration 20260723000001), serverseitig über RLS an die eingeloggte
 * Familie gebunden, geräteübergreifend gültig.
 *
 * FINALER CUTOVER, bekannte Schema-Lücke: `last_lumi_trip_id` existiert
 * nur auf Travels eigener `families`-Tabelle (FK auf Travels eigene
 * `trips`-Tabelle) -- kein Gegenstück auf Lumi Cores `households`. Für
 * bereits migrierte Reisen wäre die ID zwar identisch (1:1-Kopie beim
 * Copy-Lauf), aber JEDE NACH DEM CUTOVER NEU angelegte Reise existiert
 * nur noch in Lumi Core mit einer frischen ID, die in Travels `trips`
 * gar nicht existiert -- ein Schreiben würde den FK verletzen bzw. auf
 * eine nicht existierende Zeile zeigen. Das "letzte Reise merken"-Komfort-
 * feature wird daher bewusst NICHT mehr geschrieben (kein Datenverlust,
 * nur ein Komfort-Feature, das bis zu einer echten Lumi-Core-Spalte
 * dafür ruht). Die eigentliche Reise-Suche läuft jetzt gegen `travel_trips`.
 */
export async function selectLumiBrainTrip(formData: FormData) {
  const familyId = String(formData.get('family_id') ?? '')
  const slug = String(formData.get('slug') ?? '').trim()
  const returnToBase = String(formData.get('return_to_base') ?? '').trim() || '/concierge'

  if (!familyId) redirect(returnToBase)

  if (!slug) {
    redirect(`${returnToBase}?scope=general`)
  }

  redirect(`${returnToBase}?trip=${encodeURIComponent(slug)}`)
}
