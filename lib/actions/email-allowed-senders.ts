'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createLumiCoreClient } from '@/lib/supabase/lumi-core-server'
import { getFamily } from '@/lib/family'

const LIST_PATH = '/mehr/reise-postfach/erlaubte-absender'

/**
 * §Reise-Postfach, Schritt 1 ("Whitelist-Verwaltung"): dieselbe Absicherung
 * wie lib/tax/member-validation.ts::isValidHouseholdMember in Lumi Tax --
 * ein household_member_id kommt aus einem Formularfeld und hat zwar einen
 * FK auf household_members(id), aber keinen Constraint, der sicherstellt,
 * dass diese Person auch zum EIGENEN Haushalt gehört (RLS prüft nur
 * travel_email_allowed_senders.household_id selbst, nicht wessen
 * household_members-Zeile household_member_id referenziert). Bisher gab es
 * in diesem Repo keinen vergleichbaren Schreibpfad mit fremd wählbarer
 * Personen-ID (Teilnehmer-Auswahl läuft z. B. über Checkboxen aus einer
 * bereits serverseitig gefilterten Liste) -- hier ist es ein einzelnes
 * Text-/Select-Feld, deshalb dieselbe explizite Prüfung wie in Lumi Tax.
 */
async function isOwnHouseholdMember(
  lumiCore: Awaited<ReturnType<typeof createLumiCoreClient>>,
  householdId: string,
  householdMemberId: string,
): Promise<boolean> {
  const { data } = await lumiCore
    .from('household_members')
    .select('id')
    .eq('id', householdMemberId)
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .maybeSingle()
  return data !== null
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase()
}

export async function addAllowedSender(formData: FormData) {
  const householdMemberId = String(formData.get('household_member_id') ?? '').trim()
  const email = normalizeEmail(String(formData.get('email') ?? ''))

  if (!householdMemberId)
    redirect(`${LIST_PATH}?error=${encodeURIComponent('Bitte eine Person auswählen.')}`)
  if (!email || !email.includes('@') || email.length < 5)
    redirect(`${LIST_PATH}?error=${encodeURIComponent('Bitte eine gültige E-Mail-Adresse angeben.')}`)

  const lumiCore = await createLumiCoreClient()
  const { id: householdId } = await getFamily()

  if (!(await isOwnHouseholdMember(lumiCore, householdId, householdMemberId)))
    redirect(`${LIST_PATH}?error=${encodeURIComponent('Diese Person gehört nicht zu diesem Haushalt.')}`)

  const { error } = await lumiCore.from('travel_email_allowed_senders').insert({
    household_id: householdId,
    household_member_id: householdMemberId,
    email,
    active: true,
  })

  if (error) {
    // §Nutzervorgabe ("nur ausdrücklich freigegebene Adressen"): der
    // Unique-Index auf (household_id, lower(email)) verhindert doppelte
    // Einträge für dieselbe Adresse -- statt eines rohen DB-Fehlers eine
    // verständliche Meldung.
    const message = error.code === '23505'
      ? 'Diese E-Mail-Adresse ist bereits in der Liste.'
      : 'Speicherfehler: ' + error.message
    redirect(`${LIST_PATH}?error=${encodeURIComponent(message)}`)
  }

  revalidatePath(LIST_PATH)
  redirect(LIST_PATH)
}

export async function toggleAllowedSenderActive(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const currentlyActive = String(formData.get('currently_active') ?? '') === 'true'

  const lumiCore = await createLumiCoreClient()
  const { id: householdId } = await getFamily()

  const { error } = await lumiCore
    .from('travel_email_allowed_senders')
    .update({ active: !currentlyActive })
    .eq('id', id)
    .eq('household_id', householdId)

  if (error)
    redirect(`${LIST_PATH}?error=${encodeURIComponent('Speicherfehler: ' + error.message)}`)

  revalidatePath(LIST_PATH)
  redirect(LIST_PATH)
}

export async function deleteAllowedSender(formData: FormData) {
  const id = String(formData.get('id') ?? '')

  const lumiCore = await createLumiCoreClient()
  const { id: householdId } = await getFamily()

  const { error } = await lumiCore
    .from('travel_email_allowed_senders')
    .delete()
    .eq('id', id)
    .eq('household_id', householdId)

  if (error)
    redirect(`${LIST_PATH}?error=${encodeURIComponent('Löschfehler: ' + error.message)}`)

  revalidatePath(LIST_PATH)
  redirect(LIST_PATH)
}
