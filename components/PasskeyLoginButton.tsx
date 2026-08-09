'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PASSKEY_PENDING_LC_COOKIE, LUMI_CORE_GATE_PATH } from '@/lib/passkey-lumi-core-gate'

/**
 * Security Foundation 1B: Login per Passkey (discoverable credential, kein
 * E-Mail/Benutzername nötig) über Supabase Auths natives WebAuthn-Beta.
 * Läuft zwingend clientseitig (navigator.credentials.get() ist eine
 * Browser-API). Bei Erfolg volle Seitennavigation statt nur Client-State --
 * proxy.ts/Server Components müssen den echten, frisch gesetzten
 * Session-Cookie in einem neuen Request sehen, nicht nur den Client-State.
 * Fehler blockieren nie das bestehende Passwort-Formular darunter.
 *
 * §Passkey/Lumi-Core-Gate (Cutover-Vorbereitung): Passkey authentifiziert
 * NUR gegen Travel, Lumi Core hat kein eigenes Passkey/WebAuthn. Direkt
 * nach Erfolg wird ein reiner Marker-Cookie gesetzt (keine Zugangsdaten,
 * kein Secret) und statt auf "/" auf das Lumi-Core-Gate navigiert --
 * proxy.ts erzwingt diesen Zwischenstopp auch bei direkter Navigation,
 * bis eine echte, separate Lumi-Core-Sitzung besteht.
 */
export function PasskeyLoginButton() {
  const [supported, setSupported] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'PublicKeyCredential' in window)
  }, [])

  async function handleClick() {
    setPending(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPasskey()
      if (signInError) {
        setError('Passkey-Anmeldung fehlgeschlagen. Bitte mit Passwort anmelden.')
        setPending(false)
        return
      }
      // Reiner Marker (kein Secret) -- proxy.ts erzwingt anhand dessen das
      // Lumi-Core-Gate, bis eine echte, separate Sitzung besteht.
      document.cookie = `${PASSKEY_PENDING_LC_COOKIE}=1; path=/; max-age=600; samesite=lax`
      window.location.assign(LUMI_CORE_GATE_PATH)
    } catch {
      setError('Passkey-Anmeldung fehlgeschlagen. Bitte mit Passwort anmelden.')
      setPending(false)
    }
  }

  if (!supported) return null

  return (
    <div className="mb-5">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)',
          borderRadius: '8px', padding: '13px 20px', fontSize: '0.78rem', letterSpacing: '0.04em',
          cursor: pending ? 'default' : 'pointer', opacity: pending ? 0.75 : 1, minHeight: '44px',
          WebkitAppearance: 'none', appearance: 'none',
        }}
      >
        {pending
          ? <Loader2 size={16} strokeWidth={1.8} className="animate-spin" />
          : <Fingerprint size={16} strokeWidth={1.6} style={{ color: 'var(--accent)' }} />}
        {pending ? 'Wird angemeldet …' : 'Mit Passkey anmelden'}
      </button>
      {error && (
        <p className="mt-2 text-center" style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{error}</p>
      )}
      <div className="flex items-center gap-3 mt-5" aria-hidden="true">
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
        <span style={{ color: 'var(--muted)', fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>oder</span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      </div>
    </div>
  )
}
