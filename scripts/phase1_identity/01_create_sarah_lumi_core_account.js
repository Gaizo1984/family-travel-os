/**
 * Einmaliges Ops-Skript (kein App-Code). Sarah hat sich zwischenzeitlich
 * bereits SELBST einen echten Lumi-Core-Auth-User angelegt
 * (sarah.zelt@gmx.de, geprüft: existiert bereits, hat nur eine leere
 * profiles-Zeile, ist noch KEINEM household_member zugeordnet, keine
 * zweite Household angelegt). Dieses Skript legt daher KEINEN neuen
 * Auth-User an -- es verknüpft nur den bereits vorhandenen Auth-User mit
 * ihrer BEREITS BESTEHENDEN household_members-Zeile. Kein neuer
 * household_member wird angelegt. Marcel wird nicht angefasst.
 *
 * Zusaetzlich: spiegelt die Verknuepfung auf Travels eigener persons-Zeile
 * (persons.lumi_core_profile_id), exakt das gleiche Bridge-Feld, das
 * lib/actions/lumi-core.ts::connectLumiCore() bereits fuer Marcel schreibt --
 * gleiche Semantik, hier nur administrativ statt durch Sarahs eigenen
 * "Verbinden"-Klick ausgefuehrt, weil das Konto neu angelegt wird.
 *
 * Standardmaessig Dry Run (nur Praeflug + Ausgabe). --execute fuer echte
 * Ausfuehrung.
 */
const fs = require('fs')
const path = require('path')
function loadEnvFile(p) {
  const env = {}
  fs.readFileSync(p, 'utf-8').split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  })
  return env
}
try {
  const local = loadEnvFile(path.join(__dirname, '.env'))
  for (const [k, v] of Object.entries(local)) if (!process.env[k]) process.env[k] = v
} catch { /* optional */ }

const { createClient } = require('@supabase/supabase-js')
const travel = createClient(process.env.TRAVEL_SUPABASE_URL, process.env.TRAVEL_SERVICE_ROLE_KEY)
const lumiCore = createClient(process.env.LUMI_CORE_SUPABASE_URL, process.env.LUMI_CORE_SERVICE_ROLE_KEY)

const EXECUTE = process.argv.includes('--execute')

const SARAH_TRAVEL_PERSON_ID = '10000000-0000-0000-0000-000000000002'
const SARAH_HOUSEHOLD_MEMBER_ID = '193bec37-90bb-4105-bd90-c594ad72d854'
const SARAH_EMAIL = 'sarah.zelt@gmx.de'

async function main() {
  // Praeflug: household_member existiert, ist Sarah, profile_id ist NULL.
  const { data: member, error: memberErr } = await lumiCore
    .from('household_members')
    .select('id, name, profile_id, deleted_at')
    .eq('id', SARAH_HOUSEHOLD_MEMBER_ID)
    .single()
  if (memberErr) throw new Error(`household_member-Lookup fehlgeschlagen: ${memberErr.message}`)
  if (member.name !== 'Sarah') throw new Error(`ABBRUCH: erwartet Name "Sarah", tatsaechlich "${member.name}"`)
  if (member.deleted_at !== null) throw new Error(`ABBRUCH: household_member ist als geloescht markiert`)
  if (member.profile_id !== null) throw new Error(`ABBRUCH: profile_id bereits gesetzt (${member.profile_id}) -- kein Overwrite`)

  // Praeflug: Travel-Person existiert, ist Sarah, lumi_core_profile_id ist NULL.
  const { data: person, error: personErr } = await travel
    .from('persons')
    .select('id, name, lumi_core_profile_id')
    .eq('id', SARAH_TRAVEL_PERSON_ID)
    .single()
  if (personErr) throw new Error(`Travel persons-Lookup fehlgeschlagen: ${personErr.message}`)
  if (person.name !== 'Sarah') throw new Error(`ABBRUCH: erwartet Travel-Person "Sarah", tatsaechlich "${person.name}"`)
  if (person.lumi_core_profile_id !== null) throw new Error(`ABBRUCH: lumi_core_profile_id bereits gesetzt (${person.lumi_core_profile_id})`)

  // Praeflug: es MUSS bereits genau 1 Lumi-Core-Auth-User mit dieser E-Mail
  // existieren (Sarahs Eigenregistrierung), und der darf noch KEINEM
  // household_member zugeordnet sein.
  const { data: existingUsers, error: listErr } = await lumiCore.auth.admin.listUsers()
  if (listErr) throw new Error(`Auth-User-Liste fehlgeschlagen: ${listErr.message}`)
  const matches = existingUsers.users.filter((u) => u.email === SARAH_EMAIL)
  if (matches.length !== 1) {
    throw new Error(`ABBRUCH: erwartet genau 1 bestehenden Lumi-Core-Auth-User mit ${SARAH_EMAIL}, gefunden ${matches.length}`)
  }
  const newUserId = matches[0].id

  const { data: hmByAuthId } = await lumiCore.from('household_members').select('id').eq('profile_id', newUserId)
  if (hmByAuthId && hmByAuthId.length > 0) {
    throw new Error(`ABBRUCH: Auth-User ${newUserId} ist bereits mit household_member(n) verknuepft: ${hmByAuthId.map((r) => r.id).join(', ')}`)
  }

  console.log('Praeflug bestanden:')
  console.log(`  Bestehender Lumi-Core-Auth-User gefunden: ${newUserId} (${SARAH_EMAIL})`)
  console.log(`  household_member "Sarah" (${SARAH_HOUSEHOLD_MEMBER_ID}): profile_id aktuell NULL`)
  console.log(`  Travel-Person "Sarah" (${SARAH_TRAVEL_PERSON_ID}): lumi_core_profile_id aktuell NULL`)
  console.log(`  Auth-User ist noch keinem household_member zugeordnet`)

  if (!EXECUTE) {
    console.log('\nDRY RUN -- 0 Zeilen geschrieben.')
    return
  }

  const { error: updHmErr } = await lumiCore
    .from('household_members')
    .update({ profile_id: newUserId })
    .eq('id', SARAH_HOUSEHOLD_MEMBER_ID)
  if (updHmErr) throw new Error(`household_members-Update fehlgeschlagen: ${updHmErr.message}`)
  console.log(`[OK] household_members.profile_id gesetzt fuer Sarah`)

  const { error: updPersonErr } = await travel
    .from('persons')
    .update({ lumi_core_profile_id: newUserId })
    .eq('id', SARAH_TRAVEL_PERSON_ID)
  if (updPersonErr) throw new Error(`persons-Update fehlgeschlagen: ${updPersonErr.message}`)
  console.log(`[OK] persons.lumi_core_profile_id gespiegelt fuer Sarah (Travel-Bridge, gleiche Semantik wie connectLumiCore())`)

  console.log('\n=== SARAH LUMI CORE ACCOUNT COMPLETE ===')
  console.log(`Verknuepfter (bereits bestehender) Auth-User: ${newUserId}`)
  console.log(`Neue Auth-User angelegt: 0`)
  console.log(`household_members.profile_id gesetzt: 1`)
  console.log(`persons.lumi_core_profile_id gesetzt: 1`)
  console.log(`Neue household_members-Zeilen angelegt: 0`)
  console.log(`Marcel veraendert: 0`)
}
main().catch((e) => { console.error('ABBRUCH:', e.message); process.exit(1) })
