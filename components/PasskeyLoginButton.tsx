'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/**
 * Security Foundation 1B: Login per Passkey (discoverable credential, kein
 * E-Mail/Benutzername nötig) über Supabase Auths natives WebAuthn-Beta.
 * Läuft zwingend clientseitig (navigator.credentials.get() ist eine
 * Browser-API). Bei Erfolg volle Seitennavigation statt nur Client-State --
 * proxy.ts/Server Components müssen den echten, frisch gesetzten
 * Session-Cookie in einem neuen Request sehen, nicht nur den Client-State.
 * Fehler blockieren nie das bestehende Passwort-Formular darunter.
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
      window.location.assign('/')
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
