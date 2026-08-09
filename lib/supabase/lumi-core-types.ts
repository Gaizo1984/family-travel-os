// Schlanker, rein lesender Ausschnitt aus lumi-assistance/lib/supabase/types.ts
// -- Travel liest nur, was für die Phase-3A-Identitäts-Brücke nötig ist.
// Gleiches Database-Format wie die Supabase-CLI, damit ein Ersatz durch
// `npx supabase gen types typescript ...` später ohne Folgeänderungen
// möglich ist.

export type MemberRole = 'adult' | 'child' | 'assistant'
export type AppModule = 'assistance' | 'travel' | 'finance' | 'tax'
export type AppAccessLevel = 'none' | 'member' | 'admin'

interface TableDef<Row, Insert, Update = Partial<Insert>> {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export interface LumiCoreDatabase {
  public: {
    Tables: {
      profiles: TableDef<
        { id: string; display_name: string | null; avatar_emoji: string | null; created_at: string },
        { id: string; display_name?: string | null; avatar_emoji?: string | null; created_at?: string }
      >
      households: TableDef<
        { id: string; name: string; created_by_profile_id: string | null; created_at: string },
        { id?: string; name: string; created_by_profile_id?: string | null; created_at?: string }
      >
      household_members: TableDef<
        {
          id: string; household_id: string; profile_id: string | null; name: string
          role: MemberRole; color: string; avatar_emoji: string | null; avatar_storage_path: string | null
          birth_date: string | null; is_minor: boolean; created_at: string; deleted_at: string | null
        },
        {
          id?: string; household_id: string; profile_id?: string | null; name: string
          role?: MemberRole; color: string; avatar_emoji?: string | null; avatar_storage_path?: string | null
          birth_date?: string | null; is_minor?: boolean; created_at?: string; deleted_at?: string | null
        }
      >
      household_member_app_access: TableDef<
        {
          id: string; household_member_id: string; module: AppModule; access_level: AppAccessLevel
          granted_by: string | null; created_at: string; updated_at: string
        },
        {
          id?: string; household_member_id: string; module: AppModule; access_level?: AppAccessLevel
          granted_by?: string | null; created_at?: string; updated_at?: string
        }
      >
      // Nur lesend benoetigt: bruecke Travels persons.id (legacy) <->
      // household_members.id (Lumi Core), siehe lib/household-identity.ts.
      travel_person_migration_map: TableDef<
        { id: string; travel_person_id: string; household_member_id: string; travel_person_name: string; created_at: string },
        { id?: string; travel_person_id: string; household_member_id: string; travel_person_name: string; created_at?: string }
      >
      // Phase 3 (Fachdaten-Cutover-Vorbereitung, erste Gruppe): exakte
      // Spaltenform wie in 02_copy_engine.js (bereits real migriert, 1:1
      // Uebernahme der Ziel-Spalten).
      travel_trips: TableDef<
        {
          id: string; household_id: string; slug: string; title: string; subtitle: string | null; status: string
          start_date: string | null; end_date: string | null; cover_emoji: string | null
          gradient_from: string | null; gradient_via: string | null; gradient_to: string | null
          budget_amount: number | null; budget_currency: string | null; cover_photo_id: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; slug: string; title: string; subtitle?: string | null; status?: string
          start_date?: string | null; end_date?: string | null; cover_emoji?: string | null
          gradient_from?: string | null; gradient_via?: string | null; gradient_to?: string | null
          budget_amount?: number | null; budget_currency?: string | null; cover_photo_id?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_stages: TableDef<
        {
          id: string; trip_id: string; title: string; location: string | null; start_date: string | null; end_date: string | null
          nights: number | null; accommodation: string | null; notes: string | null; sort_order: number
          country_code: string | null; cover_photo_id: string | null; is_transit: boolean; created_at: string
        },
        {
          id?: string; trip_id: string; title: string; location?: string | null; start_date?: string | null; end_date?: string | null
          nights?: number | null; accommodation?: string | null; notes?: string | null; sort_order?: number
          country_code?: string | null; cover_photo_id?: string | null; is_transit?: boolean; created_at?: string
        }
      >
      travel_trip_members: TableDef<
        { trip_id: string; household_member_id: string; role: string | null },
        { trip_id: string; household_member_id: string; role?: string | null }
      >
      travel_bookings: TableDef<
        {
          id: string; trip_id: string; stage_id: string | null; type: string; title: string; provider: string | null
          booking_reference: string | null; status: string; payment_status: string | null; amount: number | null
          currency: string | null; start_datetime: string | null; end_datetime: string | null
          details: unknown; notes: string | null; participant_household_member_ids: string[] | null
          created_at: string; updated_at: string
        },
        {
          id?: string; trip_id: string; stage_id?: string | null; type: string; title: string; provider?: string | null
          booking_reference?: string | null; status?: string; payment_status?: string | null; amount?: number | null
          currency?: string | null; start_datetime?: string | null; end_datetime?: string | null
          details?: unknown; notes?: string | null; participant_household_member_ids?: string[] | null
          created_at?: string; updated_at?: string
        }
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
