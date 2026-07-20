'use client'

import { useRef } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

/**
 * §"Suchfeld" (Nutzervorgabe) für die Länder-Checkliste: schreibt den
 * Suchtext in die URL (`?q=...`), damit er beim Ankreuzen eines Landes (echte
 * Formular-Weiterleitung, siehe app/(app)/family/world/countries/page.tsx)
 * über `return_to` erhalten bleibt -- kein lokaler Client-State, der beim
 * nächsten Toggle verloren ginge. Leicht entprellt, damit nicht bei jedem
 * Tastendruck ein neuer Server-Request losgeht.
 */
export function CountryVisitSearchBar({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set('q', value)
      else params.delete('q')
      router.replace(`${pathname}?${params.toString()}`)
    }, 300)
  }

  return (
    <div className="relative">
      <Search size={13} strokeWidth={1.6} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
      <input
        type="search"
        defaultValue={defaultValue}
        onChange={onChange}
        placeholder="Land suchen …"
        style={{
          width: '100%', padding: '10px 14px 10px 36px', background: 'var(--surface)',
          border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--foreground)',
          fontSize: '0.82rem', fontWeight: 300, outline: 'none',
        }}
      />
    </div>
  )
}
