import Link from 'next/link'
import { Trash2, CheckCircle2 } from 'lucide-react'
import { AssignTripPicker } from './AssignTripPicker'
import type { TripPickerEntry } from '@/lib/lumi-trip-picker'
import type { SavedOptionStatus } from '@/lib/supabase/types'

/**
 * §Phase B "Gemerkt/Ausgewählt/Gebucht" (Nutzervorgabe): eine gemeinsame
 * Aktionszeile für Flüge UND Hotels (identisches Verhalten, nur die
 * durchgereichten Server Actions unterscheiden sich sonst hätte diese Logik
 * doppelt in app/(app)/discover/flights/page.tsx und app/(app)/hotels/page.tsx
 * gestanden). "booked" zeigt keine Auswahl-/Zuordnungs-Aktionen mehr (die
 * echte Buchung ist dann die Quelle der Wahrheit für Status/Preis) -- aber
 * SEHR WOHL eine Löschen-Aktion für die Merkliste-Zeile selbst (§Bugfix
 * "Gelöschte gebuchte Flüge blieben unter 'Bereits gebucht' bestehen":
 * fehlte hier zuvor, obwohl dieselbe Löschfunktion in der
 * Buchungsübersicht -- app/(app)/trips/[id]/bookings/page.tsx -- längst
 * für alle drei Status verfügbar ist; jetzt konsistent überall). Löscht
 * ausschließlich die Merkliste-Zeile, nie die echte Buchung selbst.
 */
export function SavedOptionStatusRow({
  id, status, tripId, tripTitle, tripSlug, adoptionUrl, bookingId,
  trips, returnTo, deleteAction, assignTripAction, markSelectedAction, unmarkSelectedAction,
}: {
  id: string
  status: SavedOptionStatus
  tripId: string | null
  tripTitle: string | null
  tripSlug: string | null
  /** Nur bei status === 'selected' benötigt -- Ziel-URL für "Zur Reise übernehmen" (siehe buildFlightAdoptionUrl/buildHotelAdoptionUrl). */
  adoptionUrl: string | null
  bookingId: string | null
  trips: TripPickerEntry[]
  returnTo: string
  deleteAction: (formData: FormData) => void
  assignTripAction: (formData: FormData) => void
  markSelectedAction: (formData: FormData) => void
  unmarkSelectedAction: (formData: FormData) => void
}) {
  if (status === 'booked') {
    return (
      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <div className="flex items-center gap-1.5" style={{ color: '#4C7A5D', fontSize: '0.68rem' }}>
          <CheckCircle2 size={12} strokeWidth={1.8} />
          {tripSlug && bookingId ? (
            <Link href={`/trips/${tripSlug}/bookings/${bookingId}`} style={{ color: '#4C7A5D', textDecoration: 'underline' }}>
              Gebucht -- zur Buchung →
            </Link>
          ) : (
            <span>Gebucht</span>
          )}
        </div>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            type="submit"
            className="flex items-center gap-1.5"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B5624A', fontSize: '0.68rem', padding: 0 }}
          >
            <Trash2 size={12} strokeWidth={1.8} />
            Nicht mehr merken
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 mt-2 flex-wrap">
      {status === 'saved' && !tripId && (
        <AssignTripPicker trips={trips} savedOptionId={id} assignAction={assignTripAction} returnTo={returnTo} />
      )}

      {status === 'saved' && tripId && (
        <>
          {tripTitle && <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>{tripTitle}</span>}
          <form action={markSelectedAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: '0.68rem', padding: 0 }}>
              Als ausgewählt markieren
            </button>
          </form>
        </>
      )}

      {status === 'selected' && (
        <>
          {tripTitle && <span style={{ color: 'var(--muted)', fontSize: '0.68rem' }}>{tripTitle}</span>}
          {adoptionUrl && (
            <Link href={adoptionUrl} style={{ color: 'var(--accent)', fontSize: '0.68rem', textDecoration: 'none' }}>
              Zur Reise übernehmen →
            </Link>
          )}
          <form action={unmarkSelectedAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="return_to" value={returnTo} />
            <button type="submit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.68rem', padding: 0 }}>
              Auswahl zurücknehmen
            </button>
          </form>
        </>
      )}

      <form action={deleteAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="return_to" value={returnTo} />
        <button
          type="submit"
          className="flex items-center gap-1.5"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B5624A', fontSize: '0.68rem', padding: 0 }}
        >
          <Trash2 size={12} strokeWidth={1.8} />
          Nicht mehr merken
        </button>
      </form>
    </div>
  )
}
