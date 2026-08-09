'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getCurrentPerson } from '@/lib/current-person'

/**
 * Phase 3A -- "kontrollierter Re-Login" (Master-Prompt §5): ein von Lumi Core
 * ausgestelltes Token funktioniert nicht gegen Travels eigene Datenbank
 * (unterschiedliche Supabase-Projekte, unterschiedliche JWT-Signierschlüssel).
 * Travels bestehender Login bleibt deshalb unangetastet -- dies ist ein
 * ZUSÄTZLICHER, bewusst separater Login gegen Lumi Core, nur zur
 * Identitäts-Verknüpfung. Schreibt bei Erfolg direkt die Bridge-Spalten aus
 * der Migration 20260809000001 -- kein manuelles SQL-Backfill nötig.
 */
export async function connectLumiCore(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const returnPath = '/family'

  const person = await getCurrentPerson()
  if (!person) {
    redirect(`${returnPath}?lumiCoreError=${encodeURIComponent('Keine Travel-Person für diesen Login gefunden.')}`)
  }

  if (!email || !password) {
    redirect(`${returnPath}?lumiCoreError=${encodeURIComponent('Bitte E-Mail und Passwort für Lumi Core eingeben.')}`)
  }

  const lumiCore = await createLumiCoreClient()
  const { data: authData, error: authError } = await lumiCore.auth.signInWithPassword({ email, password })
  if (authError || !authData.user) {
    redirect(`${returnPath}?lumiCoreError=${encodeURIComponent('Lumi-Core-Anmeldung fehlgeschlagen: E-Mail oder Passwort falsch.')}`)
  }

  const lumiCoreUserId = authData.user!.id

  const { data: member } = await lumiCore
    .from('household_members')
    .select('household_id')
    .eq('profile_id', lumiCoreUserId)
    .is('deleted_at', null)
    .maybeSingle()

  // Travels eigener Client (Travel-Session) -- persons/families sind
  // Travels eigene Tabellen, die Bridge-Spalten werden mit der bestehenden
  // Travel-RLS ("authenticated_only") geschrieben, unverändert gegenüber heute.
  const travel = await createClient()

  const { error: personError } = await travel
    .from('persons')
    .update({ lumi_core_profile_id: lumiCoreUserId })
    .eq('id', person.id)
  if (personError) {
    redirect(`${returnPath}?lumiCoreError=${encodeURIComponent('Verknüpfung konnte nicht gespeichert werden: ' + personError.message)}`)
  }

  if (member?.household_id) {
    await travel.from('families').update({ lumi_core_household_id: member.household_id }).eq('id', person.familyId)
  }

  revalidatePath(returnPath)
  redirect(`${returnPath}?lumiCoreConnected=1`)
}

/** Beendet ausschließlich die Lumi-Core-Session (lc-* Cookies) -- Travels
 *  eigene Session bleibt davon komplett unberührt. Löst NICHT die
 *  gespeicherte Verknüpfung (lumi_core_profile_id) auf. */
export async function disconnectLumiCoreSession() {
  const lumiCore = await createLumiCoreClient()
  await lumiCore.auth.signOut()
  revalidatePath('/family')
  redirect('/family')
}
