/**
 * Reine Konstanten, importierbar sowohl von proxy.ts (Middleware-Runtime,
 * keine next/headers-Importe erlaubt) als auch von Server Actions/Client
 * Components -- daher eine eigene, minimale Datei ohne Abhängigkeiten.
 *
 * PASSKEY_PENDING_LC_COOKIE: gesetzt von PasskeyLoginButton.tsx direkt nach
 * einem erfolgreichen Travel-Passkey-Login (Travel hat kein eigenes
 * Passkey/WebAuthn-Äquivalent in Lumi Core). Erzwingt in proxy.ts einen
 * Zwischenstopp auf /connect-lumi-core, bis eine ECHTE, separate
 * Lumi-Core-Sitzung besteht -- kein automatischer/stiller Login, keine
 * übertragenen Zugangsdaten. Wird von establishLumiCoreSession() nach
 * erfolgreichem Lumi-Core-Login wieder gelöscht.
 */
export const PASSKEY_PENDING_LC_COOKIE = 'passkey-pending-lc'
export const LUMI_CORE_GATE_PATH = '/connect-lumi-core'

/**
 * §"App-like Lumi Travel", Passkey-Origin-Guard: proxy.ts schickt eine
 * Passkey-sensitive Seite (/login), die über eine fremde Host (Lumi
 * Launcher) angefragt wurde, auf Travels echte Origin -- die ursprüngliche
 * externe Ziel-URL (auf der Launcher-Origin) wird in diesem kurzlebigen
 * Cookie zwischengespeichert, NICHT nur als Query-Param durchgereicht, da
 * sie mehrere unabhängige Weiterleitungen überleben muss (Login ->
 * ggf. /connect-lumi-core -> establishLumiCoreSession). Der Cookie lebt nur
 * auf Travels eigener Domain, wird nach erfolgreichem Login gelöscht.
 */
export const TRAVEL_RETURN_TO_COOKIE = 'travel-return-to'
