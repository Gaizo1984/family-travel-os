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
