import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { TRAVEL_RETURN_TO_COOKIE } from '@/lib/passkey-lumi-core-gate'

/**
 * §"App-like Lumi Travel", Passkey-Origin-Guard: nach erfolgreichem Login
 * (normales Lumi-Core-Passwort ODER der Passkey-Bridge-Flow über
 * /connect-lumi-core) prüfen, ob proxy.ts einen externen Rücksprungpfad zur
 * Lumi-Launcher-Origin hinterlegt hat (gesetzt, weil dieser Login-Vorgang
 * ursprünglich durch einen Aufruf über die fremde Host ausgelöst wurde,
 * siehe proxy.ts) -- falls ja, dorthin statt zum internen Standardziel
 * weiterleiten. Der Cookie ist einmalig gültig und wird in jedem Fall
 * gelöscht.
 */
export async function redirectAfterLogin(internalTarget: string): Promise<never> {
  const cookieStore = await cookies()
  const returnTo = cookieStore.get(TRAVEL_RETURN_TO_COOKIE)?.value
  if (returnTo) {
    cookieStore.delete(TRAVEL_RETURN_TO_COOKIE)
    redirect(returnTo)
  }
  redirect(internalTarget)
}
