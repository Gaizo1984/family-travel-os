'use client'

import { useEffect, useState } from 'react'
import { Fingerprint, Pencil, Trash2, Loader2, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type PasskeyEntry = { id: string; friendly_name?: string | null; created_at: string }

const PILL_ICON_BUTTON_STYLE: React.CSSProperties = {
  width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid rgba(184,154,94,0.3)', borderRadius: '20px', background: 'none',
  color: 'var(--accent)', cursor: 'pointer', padding: 0,
}

/**
 * Security Foundation 1B: Hinzufügen/Umbenennen/Entfernen von Passkeys für
 * den aktuell eingeloggten Nutzer — ausschließlich über
 * supabase.auth.registerPasskey()/passkey.list()/.update()/.delete(), kein
 * eigener WebAuthn-Code. Erfordert eine bestehende Session (nur unter
 * app/(app)/mehr/passkeys erreichbar, also bereits proxy.ts-geschützt).
 */
export function PasskeyManager() {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  async function loadPasskeys() {
    const supabase = createClient()
    const { data, error: listError } = await supabase.auth.passkey.list()
    if (listError) { setError('Passkeys konnten nicht geladen werden.'); return }
    setPasskeys((data ?? []) as PasskeyEntry[])
  }

  useEffect(() => {
    loadPasskeys()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleAdd() {
    setBusy(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: registerError } = await supabase.auth.registerPasskey()
      if (registerError) { setError('Passkey konnte nicht registriert werden.'); return }
      await loadPasskeys()
    } catch {
      setError('Passkey konnte nicht registriert werden.')
    } finally {
      setBusy(false)
    }
  }

  function startRename(entry: PasskeyEntry) {
    setRenamingId(entry.id)
    setRenameValue(entry.friendly_name ?? '')
  }

  async function saveRename(id: string) {
    const name = renameValue.trim()
    if (!name) { setRenamingId(null); return }
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.passkey.update({ passkeyId: id, friendlyName: name })
      setRenamingId(null)
      await loadPasskeys()
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Diesen Passkey wirklich entfernen?')) return
    setBusy(true)
    try {
      const supabase = createClient()
      await supabase.auth.passkey.delete({ passkeyId: id })
      await loadPasskeys()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg" style={{ background: 'rgba(181,98,74,0.12)', border: '1px solid rgba(181,98,74,0.3)', color: '#B5624A', fontSize: '0.75rem' }}>
          {error}
        </div>
      )}

      <button
        type="button" onClick={handleAdd} disabled={busy}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%',
          background: 'var(--foreground)', color: 'var(--surface)', border: 'none', borderRadius: '6px',
          padding: '13px 20px', fontSize: '0.7rem', letterSpacing: '0.1em', textTransform: 'uppercase',
          cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, minHeight: '44px', marginBottom: '24px',
          WebkitAppearance: 'none', appearance: 'none',
        }}
      >
        {busy ? <Loader2 size={15} strokeWidth={1.8} className="animate-spin" /> : <Fingerprint size={15} strokeWidth={1.6} />}
        Neuen Passkey registrieren
      </button>

      {passkeys === null ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>Wird geladen …</p>
      ) : passkeys.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>Noch keine Passkeys registriert.</p>
      ) : (
        <div className="space-y-2">
          {passkeys.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent-subtle)' }}
              >
                <Fingerprint size={16} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
              </div>
              <div className="flex-1 min-w-0">
                {renamingId === entry.id ? (
                  <input
                    autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
                    maxLength={120} aria-label="Name des Passkeys"
                    style={{
                      width: '100%', padding: '8px 10px', background: 'var(--background)',
                      border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--foreground)', fontSize: '0.85rem',
                    }}
                  />
                ) : (
                  <>
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
                      {entry.friendly_name || 'Passkey'}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>
                      Registriert am {new Date(entry.created_at).toLocaleDateString('de-DE')}
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {renamingId === entry.id ? (
                  <>
                    <button type="button" onClick={() => saveRename(entry.id)} aria-label="Speichern" style={PILL_ICON_BUTTON_STYLE}>
                      <Check size={14} strokeWidth={1.8} />
                    </button>
                    <button
                      type="button" onClick={() => setRenamingId(null)} aria-label="Abbrechen"
                      style={{ ...PILL_ICON_BUTTON_STYLE, color: 'var(--muted)', borderColor: 'var(--border)' }}
                    >
                      <X size={14} strokeWidth={1.8} />
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => startRename(entry)} aria-label="Umbenennen" style={PILL_ICON_BUTTON_STYLE}>
                      <Pencil size={13} strokeWidth={1.6} />
                    </button>
                    <button
                      type="button" onClick={() => handleDelete(entry.id)} aria-label="Entfernen"
                      style={{ ...PILL_ICON_BUTTON_STYLE, color: '#B5624A', borderColor: 'rgba(181,98,74,0.3)' }}
                    >
                      <Trash2 size={13} strokeWidth={1.6} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
