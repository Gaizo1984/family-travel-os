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
        { id: string; name: string; created_by_profile_id: string | null; created_at: string; last_lumi_trip_id: string | null },
        { id?: string; name: string; created_by_profile_id?: string | null; created_at?: string; last_lumi_trip_id?: string | null }
      >
      // Generischer, App-uebergreifender Einstellungs-Container pro Household
      // (bereits Teil des Lumi-Core-Kernschemas) -- Travel nutzt settings fuer
      // 'travel_content_style_preference' (lib/actions/family-content-style.ts)
      // und 'travel_exceptional_hotel_criteria' (lib/actions/family-preferences.ts),
      // statt eigene Spalten/Tabellen anzulegen (siehe lib/family-dna.ts).
      app_preferences: TableDef<
        { id: string; household_id: string; settings: Record<string, unknown>; created_at: string; updated_at: string },
        { id?: string; household_id: string; settings?: Record<string, unknown>; created_at?: string; updated_at?: string }
      >
      // Schema-Luecken-Schliessung (FINALER CUTOVER, Nachtrag): Travel-
      // spezifische Personen-Profilfelder ohne Lumi-Core-Aequivalent, siehe
      // Migration lumi_core_schema_gap_closure.sql.
      travel_household_member_profiles: TableDef<
        {
          id: string; household_id: string; household_member_id: string
          role_label: string | null; description: string | null
          interest_tags: string[]; travel_needs: string[]
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; household_member_id: string
          role_label?: string | null; description?: string | null
          interest_tags?: string[]; travel_needs?: string[]
          created_at?: string; updated_at?: string
        }
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

      // ── Phase 3, Gruppe 1: Documents / Insurance / Journey / Packing ──────
      travel_trip_days: TableDef<
        { id: string; trip_id: string; stage_id: string | null; date: string; title: string | null; day_plan: unknown; created_at: string },
        { id?: string; trip_id: string; stage_id?: string | null; date: string; title?: string | null; day_plan?: unknown; created_at?: string }
      >
      travel_budget_items: TableDef<
        {
          id: string; trip_id: string; stage_id: string | null; booking_id: string | null; category: string; label: string
          amount_planned: number | null; amount_actual: number | null; currency: string | null
          storage_bucket: string | null; storage_path: string | null; details: unknown; created_at: string
        },
        {
          id?: string; trip_id: string; stage_id?: string | null; booking_id?: string | null; category: string; label: string
          amount_planned?: number | null; amount_actual?: number | null; currency?: string | null
          storage_bucket?: string | null; storage_path?: string | null; details?: unknown; created_at?: string
        }
      >
      travel_trip_exchange_rates: TableDef<
        { trip_id: string; currency: string; rate: number; source: string | null; updated_at: string },
        { trip_id: string; currency: string; rate: number; source?: string | null; updated_at?: string }
      >
      travel_documents: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; household_member_id: string | null; booking_id: string | null
          doc_type: string; label: string | null; expires_at: string | null; storage_provider: string | null
          storage_bucket: string | null; storage_path: string | null; details: unknown; notes: string | null
          journey_event_id: string | null; created_at: string
        },
        {
          id?: string; household_id: string; trip_id?: string | null; household_member_id?: string | null; booking_id?: string | null
          doc_type: string; label?: string | null; expires_at?: string | null; storage_provider?: string | null
          storage_bucket?: string | null; storage_path?: string | null; details?: unknown; notes?: string | null
          journey_event_id?: string | null; created_at?: string
        }
      >
      travel_document_trips: TableDef<
        { document_id: string; trip_id: string },
        { document_id: string; trip_id: string }
      >
      travel_journey_events: TableDef<
        {
          id: string; trip_id: string; stage_id: string | null; date: string; time: string | null; category: string
          title: string; location: string | null; notes: string | null; status: string | null; metadata: unknown
          participant_household_member_ids: string[] | null; created_at: string; updated_at: string
        },
        {
          id?: string; trip_id: string; stage_id?: string | null; date: string; time?: string | null; category: string
          title: string; location?: string | null; notes?: string | null; status?: string | null; metadata?: unknown
          participant_household_member_ids?: string[] | null; created_at?: string; updated_at?: string
        }
      >
      travel_insurance_policies: TableDef<
        {
          id: string; household_id: string; label: string; provider: string | null; policy_type: string | null
          reference_number: string | null; valid_from: string | null; valid_to: string | null
          emergency_contact: string | null; notes: string | null; storage_bucket: string | null; storage_path: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; label: string; provider?: string | null; policy_type?: string | null
          reference_number?: string | null; valid_from?: string | null; valid_to?: string | null
          emergency_contact?: string | null; notes?: string | null; storage_bucket?: string | null; storage_path?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_insurance_policy_persons: TableDef<
        { policy_id: string; household_member_id: string },
        { policy_id: string; household_member_id: string }
      >
      travel_insurance_policy_trips: TableDef<
        { policy_id: string; trip_id: string },
        { policy_id: string; trip_id: string }
      >
      travel_packing_luggage: TableDef<
        {
          id: string; trip_id: string; household_member_id: string | null; label: string
          allowed_weight_grams: number | null; sort_order: number; created_at: string; updated_at: string
        },
        {
          id?: string; trip_id: string; household_member_id?: string | null; label: string
          allowed_weight_grams?: number | null; sort_order?: number; created_at?: string; updated_at?: string
        }
      >
      travel_packing_items: TableDef<
        {
          id: string; trip_id: string; household_member_id: string | null; luggage_id: string | null
          label: string; category: string | null; quantity: number; status: string; priority: string | null
          luggage_assignment: string | null; needs_check: boolean; is_last_minute: boolean
          weight_grams: number | null; reasoning: string | null; source: string | null; source_key: string | null
          note: string | null; sort_order: number; created_at: string; updated_at: string
        },
        {
          id?: string; trip_id: string; household_member_id?: string | null; luggage_id?: string | null
          label: string; category?: string | null; quantity?: number; status?: string; priority?: string | null
          luggage_assignment?: string | null; needs_check?: boolean; is_last_minute?: boolean
          weight_grams?: number | null; reasoning?: string | null; source?: string | null; source_key?: string | null
          note?: string | null; sort_order?: number; created_at?: string; updated_at?: string
        }
      >
      travel_packing_list_drafts: TableDef<
        { id: string; trip_id: string; household_id: string; items: unknown; created_at: string },
        { id?: string; trip_id: string; household_id: string; items: unknown; created_at?: string }
      >
      travel_journal_entries: TableDef<
        {
          id: string; trip_id: string; trip_day_id: string | null; author_household_member_id: string | null
          date: string; title: string | null; content: string; location: string | null; visibility: string | null
          created_at: string
        },
        {
          id?: string; trip_id: string; trip_day_id?: string | null; author_household_member_id?: string | null
          date: string; title?: string | null; content: string; location?: string | null; visibility?: string | null
          created_at?: string
        }
      >
      travel_trip_debriefs: TableDef<
        { id: string; household_id: string; trip_id: string; status: string; current_step: string | null; answers: unknown; created_at: string; updated_at: string },
        { id?: string; household_id: string; trip_id: string; status?: string; current_step?: string | null; answers?: unknown; created_at?: string; updated_at?: string }
      >

      // ── Phase 3, Gruppe 2: History / Memories / Preferences ────────────────
      travel_preference_categories: TableDef<
        { id: string; household_id: string; category_key: string; weight: number; note: string | null; created_at: string; updated_at: string },
        { id?: string; household_id: string; category_key: string; weight?: number; note?: string | null; created_at?: string; updated_at?: string }
      >
      travel_past_trips: TableDef<
        {
          id: string; household_id: string; country_or_region: string; country_code: string | null; year: number | null
          places: string | null; duration_days: number | null; photo_storage_path: string | null; note: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; country_or_region: string; country_code?: string | null; year?: number | null
          places?: string | null; duration_days?: number | null; photo_storage_path?: string | null; note?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_past_trip_travelers: TableDef<
        { past_trip_id: string; household_member_id: string },
        { past_trip_id: string; household_member_id: string }
      >
      travel_person_country_visits: TableDef<
        {
          id: string; household_member_id: string; country_code: string; source: string | null
          trip_id: string | null; first_visited_at: string | null; created_at: string; updated_at: string
        },
        {
          id?: string; household_member_id: string; country_code: string; source?: string | null
          trip_id?: string | null; first_visited_at?: string | null; created_at?: string; updated_at?: string
        }
      >
      travel_memories: TableDef<
        {
          id: string; household_id: string; household_member_id: string | null; trip_id: string | null
          memory_type: string; category: string | null; structured_value: unknown; summary: string
          source: string | null; status: string; priority: string | null; valid_until: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; household_member_id?: string | null; trip_id?: string | null
          memory_type: string; category?: string | null; structured_value?: unknown; summary: string
          source?: string | null; status?: string; priority?: string | null; valid_until?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_memory_photos: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; past_trip_id: string | null; stage_id: string | null
          uploaded_by_household_member_id: string | null; storage_path: string; taken_at: string | null
          caption: string | null; is_highlight: boolean; phash: string | null; quality_score: number | null
          analyzed_at: string | null; is_duplicate_of: string | null; is_selected: boolean; sort_order: number
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; trip_id?: string | null; past_trip_id?: string | null; stage_id?: string | null
          uploaded_by_household_member_id?: string | null; storage_path: string; taken_at?: string | null
          caption?: string | null; is_highlight?: boolean; phash?: string | null; quality_score?: number | null
          analyzed_at?: string | null; is_duplicate_of?: string | null; is_selected?: boolean; sort_order?: number
          created_at?: string; updated_at?: string
        }
      >
      travel_memory_videos: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; uploaded_by_household_member_id: string | null
          storage_path: string; thumbnail_storage_path: string | null; duration_seconds: number | null
          taken_at: string | null; caption: string | null; is_highlight: boolean; created_at: string
          temporary: boolean; expires_at: string | null; retained_as_memory: boolean
        },
        {
          id?: string; household_id: string; trip_id?: string | null; uploaded_by_household_member_id?: string | null
          storage_path: string; thumbnail_storage_path?: string | null; duration_seconds?: number | null
          taken_at?: string | null; caption?: string | null; is_highlight?: boolean; created_at?: string
          temporary?: boolean; expires_at?: string | null; retained_as_memory?: boolean
        }
      >

      // ── Phase 3, Gruppe 3: Content Studio / Reels / Concierge / Planning ──
      travel_content_projects: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; stage_id: string | null; title: string; status: string
          project_type: string; content_date: string | null; language: string | null; tonality: string | null
          output_format: string | null; content_focus: string | null; custom_focus: string | null; mood: string[] | null
          hint_text: string | null; reel_style: string | null; reel_duration_seconds: number | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; trip_id?: string | null; stage_id?: string | null; title: string; status?: string
          project_type: string; content_date?: string | null; language?: string | null; tonality?: string | null
          output_format?: string | null; content_focus?: string | null; custom_focus?: string | null; mood?: string[] | null
          hint_text?: string | null; reel_style?: string | null; reel_duration_seconds?: number | null
          created_at?: string; updated_at?: string
        }
      >
      travel_content_ideas: TableDef<
        {
          id: string; household_id: string; project_id: string | null; trip_id: string | null; source_input_text: string | null
          source_media_storage_path: string | null; content_goal: string | null; suggestions: unknown
          chosen_index: number | null; is_favorite: boolean; reasoning: string | null; status: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; project_id?: string | null; trip_id?: string | null; source_input_text?: string | null
          source_media_storage_path?: string | null; content_goal?: string | null; suggestions?: unknown
          chosen_index?: number | null; is_favorite?: boolean; reasoning?: string | null; status?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_content_drafts: TableDef<
        {
          id: string; idea_id: string | null; project_id: string | null; draft_type: string; structure: unknown
          visibility: string | null; instagram_ready: boolean; scheduled_at: string | null; posted_at: string | null
          storage_path: string | null; notes: string | null; created_at: string; updated_at: string
        },
        {
          id?: string; idea_id?: string | null; project_id?: string | null; draft_type: string; structure?: unknown
          visibility?: string | null; instagram_ready?: boolean; scheduled_at?: string | null; posted_at?: string | null
          storage_path?: string | null; notes?: string | null; created_at?: string; updated_at?: string
        }
      >
      travel_content_project_photos: TableDef<
        {
          id: string; project_id: string; storage_path: string; phash: string | null; quality_score: number | null
          is_duplicate_of: string | null; is_selected: boolean; categories: unknown; reasoning: string | null
          recommendation: string | null; temporary: boolean; expires_at: string | null; retained_as_memory: boolean
          memory_photo_id: string | null; vacation_post_marked_at: string | null; vacation_post_score: number | null
          vacation_post_reasoning: string | null; vacation_post_rank: number | null; vacation_post_pinned: boolean
          analyzed_at: string | null; created_at: string
        },
        {
          id?: string; project_id: string; storage_path: string; phash?: string | null; quality_score?: number | null
          is_duplicate_of?: string | null; is_selected?: boolean; categories?: unknown; reasoning?: string | null
          recommendation?: string | null; temporary?: boolean; expires_at?: string | null; retained_as_memory?: boolean
          memory_photo_id?: string | null; vacation_post_marked_at?: string | null; vacation_post_score?: number | null
          vacation_post_reasoning?: string | null; vacation_post_rank?: number | null; vacation_post_pinned?: boolean
          analyzed_at?: string | null; created_at?: string
        }
      >
      travel_content_photo_analyses: TableDef<
        {
          id: string; household_id: string; project_id: string | null; trip_id: string | null; caption: string | null
          hashtags: unknown; hook: string | null; story_structure: unknown; reel_order: unknown
          music_suggestions: unknown; photobook_chapters: unknown; travel_diary: unknown; status: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; project_id?: string | null; trip_id?: string | null; caption?: string | null
          hashtags?: unknown; hook?: string | null; story_structure?: unknown; reel_order?: unknown
          music_suggestions?: unknown; photobook_chapters?: unknown; travel_diary?: unknown; status?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_content_reel_media_items: TableDef<
        { id: string; project_id: string; source_type: string; source_id: string; sort_order: number; created_at: string },
        { id?: string; project_id: string; source_type: string; source_id: string; sort_order?: number; created_at?: string }
      >
      travel_content_reel_renders: TableDef<
        {
          id: string; draft_id: string; quality: string; status: string; provider: string | null
          provider_job_id: string | null; progress_percent: number | null; attempt_count: number; max_attempts: number
          output_storage_path: string | null; output_duration_seconds: number | null; error_message: string | null
          requested_at: string; completed_at: string | null
          aws_bucket_name: string | null; aws_function_name: string | null; cost_estimate_usd: number | null
          output_size_bytes: number | null; render_duration_seconds: number | null
        },
        {
          id?: string; draft_id: string; quality: string; status?: string; provider?: string | null
          provider_job_id?: string | null; progress_percent?: number | null; attempt_count?: number; max_attempts?: number
          output_storage_path?: string | null; output_duration_seconds?: number | null; error_message?: string | null
          requested_at?: string; completed_at?: string | null
          aws_bucket_name?: string | null; aws_function_name?: string | null; cost_estimate_usd?: number | null
          output_size_bytes?: number | null; render_duration_seconds?: number | null
        }
      >
      travel_content_strategies: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; for_date: string; content_type: string
          reasoning: string | null; storyline: string | null; shotlist: unknown; best_time: string | null
          effort: string | null; created_at: string
        },
        {
          id?: string; household_id: string; trip_id?: string | null; for_date: string; content_type: string
          reasoning?: string | null; storyline?: string | null; shotlist?: unknown; best_time?: string | null
          effort?: string | null; created_at?: string
        }
      >
      travel_trip_idea_sessions: TableDef<
        {
          id: string; household_id: string; input_text: string | null; clarifying_answers: unknown; status: string
          traveler_household_member_ids: string[] | null; travel_date_mode: string | null
          travel_start_date: string | null; travel_end_date: string | null; travel_period_text: string | null
          nights_min: number | null; nights_max: number | null; climate_preference: string | null
          trip_type_preference: string | null; rain_risk_tolerant: boolean | null; max_stopovers: number | null
          stopover_preference: string | null; budget_min: number | null; budget_max: number | null
          excluded_destinations: unknown; avoid_past_destinations: boolean | null; excluded_trip_types: unknown
          excluded_climates: unknown; departure_city: string | null; created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; input_text?: string | null; clarifying_answers?: unknown; status?: string
          traveler_household_member_ids?: string[] | null; travel_date_mode?: string | null
          travel_start_date?: string | null; travel_end_date?: string | null; travel_period_text?: string | null
          nights_min?: number | null; nights_max?: number | null; climate_preference?: string | null
          trip_type_preference?: string | null; rain_risk_tolerant?: boolean | null; max_stopovers?: number | null
          stopover_preference?: string | null; budget_min?: number | null; budget_max?: number | null
          excluded_destinations?: unknown; avoid_past_destinations?: boolean | null; excluded_trip_types?: unknown
          excluded_climates?: unknown; departure_city?: string | null; created_at?: string; updated_at?: string
        }
      >
      travel_trip_ideas: TableDef<
        {
          id: string; session_id: string | null; household_id: string; origin: string | null; destination: string
          route_summary: string | null; best_season: string | null; duration_days_min: number | null
          duration_days_max: number | null; reasoning: string | null; budget_range_min: number | null
          budget_range_max: number | null; budget_currency: string | null; includes_flights: boolean | null
          is_chosen: boolean; is_favorite: boolean; chosen_variant_type: string | null; converted_trip_id: string | null
          development_notes: string | null; hotel_shortlist: unknown; hotel_shortlist_updated_at: string | null
          budget_breakdown: unknown; budget_breakdown_updated_at: string | null; variants: unknown
          variants_generated_at: string | null; flight_search_key: string | null; flight_options_updated_at: string | null
          created_at: string; updated_at: string
        },
        {
          id?: string; session_id?: string | null; household_id: string; origin?: string | null; destination: string
          route_summary?: string | null; best_season?: string | null; duration_days_min?: number | null
          duration_days_max?: number | null; reasoning?: string | null; budget_range_min?: number | null
          budget_range_max?: number | null; budget_currency?: string | null; includes_flights?: boolean | null
          is_chosen?: boolean; is_favorite?: boolean; chosen_variant_type?: string | null; converted_trip_id?: string | null
          development_notes?: string | null; hotel_shortlist?: unknown; hotel_shortlist_updated_at?: string | null
          budget_breakdown?: unknown; budget_breakdown_updated_at?: string | null; variants?: unknown
          variants_generated_at?: string | null; flight_search_key?: string | null; flight_options_updated_at?: string | null
          created_at?: string; updated_at?: string
        }
      >
      travel_saved_flight_options: TableDef<
        {
          id: string; household_id: string; route_key: string; origin_codes: string[]; destination_code: string
          option_id: string; flight_option: unknown; found_departure_date: string
          found_return_date: string | null; search_key: string | null; adults: number | null; children: number | null
          infants: number | null; status: string; trip_id: string | null; booking_id: string | null; created_at: string
        },
        {
          id?: string; household_id: string; route_key: string; origin_codes: string[]; destination_code: string
          option_id: string; flight_option: unknown; found_departure_date: string
          found_return_date?: string | null; search_key?: string | null; adults?: number | null; children?: number | null
          infants?: number | null; status?: string; trip_id?: string | null; booking_id?: string | null; created_at?: string
        }
      >
      travel_saved_hotel_options: TableDef<
        {
          id: string; household_id: string; search_key: string; destination: string; option_id: string
          hotel_option: unknown; status: string; trip_id: string | null; booking_id: string | null; created_at: string
        },
        {
          id?: string; household_id: string; search_key: string; destination: string; option_id: string
          hotel_option: unknown; status?: string; trip_id?: string | null; booking_id?: string | null; created_at?: string
        }
      >
      travel_concierge_messages: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; for_date: string | null; question_key: string | null
          question_text: string | null; answer_title: string | null; answer_body: string | null; actions: unknown
          context_fingerprint: string | null; created_at: string
        },
        {
          id?: string; household_id: string; trip_id?: string | null; for_date?: string | null; question_key?: string | null
          question_text?: string | null; answer_title?: string | null; answer_body?: string | null; actions?: unknown
          context_fingerprint?: string | null; created_at?: string
        }
      >

      // ── 12 Cache-/Usage-Tabellen (FINALER CUTOVER, Nachtrag) ──
      // Leer neu angelegt in Lumi Core (siehe lumi_core_travel_cache_tables.sql),
      // keine Altdaten aus Travel uebernommen -- alle regenerieren sich
      // selbst beim naechsten Aufruf des jeweiligen Providers/der Analyse.
      travel_flight_search_cache: TableDef<
        {
          id: string; household_id: string; search_key: string; origin_codes: string[]; destination_code: string
          departure_date: string; return_date: string | null; adults: number; children: number; infants: number
          is_sandbox_data: boolean; results: unknown; search_started_at: string | null; created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; search_key: string; origin_codes: string[]; destination_code: string
          departure_date: string; return_date?: string | null; adults: number; children?: number; infants?: number
          is_sandbox_data?: boolean; results?: unknown; search_started_at?: string | null; created_at?: string; updated_at?: string
        }
      >
      travel_flight_search_usage: TableDef<
        { id: string; household_id: string; month_key: string; search_count: number; updated_at: string },
        { id?: string; household_id: string; month_key: string; search_count?: number; updated_at?: string }
      >
      travel_hotel_search_cache: TableDef<
        {
          id: string; household_id: string; search_key: string; destination: string; is_below_standard: boolean
          results: unknown; created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; search_key: string; destination: string; is_below_standard?: boolean
          results?: unknown; created_at?: string; updated_at?: string
        }
      >
      travel_day_plan_cache: TableDef<
        { id: string; household_id: string; trip_id: string; date: string | null; mode: string; plan: unknown; updated_at: string },
        { id?: string; household_id: string; trip_id: string; date?: string | null; mode: string; plan: unknown; updated_at?: string }
      >
      travel_category_places_cache: TableDef<
        {
          id: string; household_id: string; trip_id: string; category: string; origin_key: string
          origin_label: string; results: unknown; updated_at: string
        },
        {
          id?: string; household_id: string; trip_id: string; category: string; origin_key: string
          origin_label: string; results: unknown; updated_at?: string
        }
      >
      travel_today_recommendations: TableDef<
        {
          id: string; household_id: string; trip_id: string | null; for_date: string; day_style: string | null
          highlight_title: string | null; day_summary: string; recommendation: unknown; alternative: unknown
          created_at: string
        },
        {
          id?: string; household_id: string; trip_id?: string | null; for_date: string; day_style?: string | null
          highlight_title?: string | null; day_summary: string; recommendation: unknown; alternative?: unknown
          created_at?: string
        }
      >
      travel_trip_hints: TableDef<
        {
          id: string; household_id: string; trip_id: string; booking_id: string | null; document_id: string | null
          journey_event_id: string | null; hint_type: string; priority: string; title: string; reasoning: string
          relevant_at: string | null; action_label: string; action_href: string; status: string
          content_hash: string; dedupe_key: string; created_at: string; updated_at: string; dismissed_at: string | null
        },
        {
          id?: string; household_id: string; trip_id: string; booking_id?: string | null; document_id?: string | null
          journey_event_id?: string | null; hint_type: string; priority: string; title: string; reasoning: string
          relevant_at?: string | null; action_label: string; action_href: string; status?: string
          content_hash: string; dedupe_key: string; created_at?: string; updated_at?: string; dismissed_at?: string | null
        }
      >
      travel_concierge_category_suggestions: TableDef<
        {
          id: string; household_id: string; trip_id: string; category: string; question_text: string
          title: string; body: string; event_title: string; updated_at: string; created_at: string
        },
        {
          id?: string; household_id: string; trip_id: string; category: string; question_text: string
          title: string; body: string; event_title: string; updated_at?: string; created_at?: string
        }
      >
      travel_trip_idea_comparisons: TableDef<
        { id: string; household_id: string; idea_ids: string[]; comparison_key: string; scores: unknown; created_at: string },
        { id?: string; household_id: string; idea_ids: string[]; comparison_key: string; scores: unknown; created_at?: string }
      >
      travel_lumi_brain_usage: TableDef<
        { id: string; household_id: string; month_key: string; question_count: number; updated_at: string },
        { id?: string; household_id: string; month_key: string; question_count?: number; updated_at?: string }
      >
      travel_reel_render_usage: TableDef<
        { id: string; household_id: string; month_key: string; render_count: number; updated_at: string },
        { id?: string; household_id: string; month_key: string; render_count?: number; updated_at?: string }
      >
      travel_ai_generation_jobs: TableDef<
        {
          id: string; household_id: string; kind: string; status: string; error_message: string | null
          redirect_path: string | null; created_at: string; updated_at: string
        },
        {
          id?: string; household_id: string; kind: string; status?: string; error_message?: string | null
          redirect_path?: string | null; created_at?: string; updated_at?: string
        }
      >
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
