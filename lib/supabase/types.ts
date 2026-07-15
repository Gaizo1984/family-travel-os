export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type BookingType     = 'flight' | 'accommodation' | 'rental_car' | 'transfer' | 'activity'
                             | 'restaurant' | 'train' | 'ferry' | 'insurance' | 'other'
export type BookingStatus   = 'pending' | 'confirmed' | 'cancelled' | 'reserved'
export type PaymentStatus   = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type TripStatus      = 'planned' | 'active' | 'completed' | 'archived'
export type TaskStatus      = 'open' | 'done' | 'snoozed'
export type JournalVis      = 'family' | 'private'
export type StorageProvider = 'supabase_storage' | 'azure_blob' | 'onedrive_sharepoint'

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string; name: string; created_at: string
          content_style_preference: Json | null; exceptional_hotel_criteria: string[]
        }
        Insert: {
          id?: string; name: string; created_at?: string
          content_style_preference?: Json | null; exceptional_hotel_criteria?: string[]
        }
        Update: {
          id?: string; name?: string; created_at?: string
          content_style_preference?: Json | null; exceptional_hotel_criteria?: string[]
        }
        Relationships: []
      }
      persons: {
        Row: {
          id: string; family_id: string; name: string; initials: string
          color: string; birth_date: string | null; is_minor: boolean; created_at: string
          photo_storage_path: string | null; description: string | null; role_label: string | null
          interest_tags: string[]; travel_needs: string[]
        }
        Insert: {
          id?: string; family_id: string; name: string; initials: string
          color: string; birth_date?: string | null; is_minor?: boolean; created_at?: string
          photo_storage_path?: string | null; description?: string | null; role_label?: string | null
          interest_tags?: string[]; travel_needs?: string[]
        }
        Update: {
          id?: string; family_id?: string; name?: string; initials?: string
          color?: string; birth_date?: string | null; is_minor?: boolean; created_at?: string
          photo_storage_path?: string | null; description?: string | null; role_label?: string | null
          interest_tags?: string[]; travel_needs?: string[]
        }
        Relationships: [
          { foreignKeyName: "persons_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      trips: {
        Row: {
          id: string; slug: string; family_id: string; title: string; subtitle: string | null
          status: TripStatus; start_date: string | null; end_date: string | null
          cover_emoji: string | null; gradient_from: string | null; gradient_via: string | null
          gradient_to: string | null; budget_amount: number | null; budget_currency: string
          cover_photo_id: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; slug: string; family_id: string; title: string; subtitle?: string | null
          status?: TripStatus; start_date?: string | null; end_date?: string | null
          cover_emoji?: string | null; gradient_from?: string | null; gradient_via?: string | null
          gradient_to?: string | null; budget_amount?: number | null; budget_currency?: string
          cover_photo_id?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; slug?: string; family_id?: string; title?: string; subtitle?: string | null
          status?: TripStatus; start_date?: string | null; end_date?: string | null
          cover_emoji?: string | null; gradient_from?: string | null; gradient_via?: string | null
          gradient_to?: string | null; budget_amount?: number | null; budget_currency?: string
          cover_photo_id?: string | null
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "trips_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "trips_cover_photo_id_fkey"; columns: ["cover_photo_id"]; isOneToOne: false; referencedRelation: "memory_photos"; referencedColumns: ["id"] }
        ]
      }
      trip_members: {
        Row:    { trip_id: string; person_id: string; role: string | null }
        Insert: { trip_id: string; person_id: string; role?: string | null }
        Update: { trip_id?: string; person_id?: string; role?: string | null }
        Relationships: [
          { foreignKeyName: "trip_members_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] },
          { foreignKeyName: "trip_members_person_id_fkey"; columns: ["person_id"]; isOneToOne: false; referencedRelation: "persons"; referencedColumns: ["id"] }
        ]
      }
      stages: {
        Row: {
          id: string; trip_id: string; title: string; location: string | null
          start_date: string | null; end_date: string | null; nights: number | null
          accommodation: string | null; notes: string | null; sort_order: number; created_at: string
          country_code: string | null; cover_photo_id: string | null; is_transit: boolean
        }
        Insert: {
          id?: string; trip_id: string; title: string; location?: string | null
          start_date?: string | null; end_date?: string | null; nights?: number | null
          accommodation?: string | null; notes?: string | null; sort_order?: number; created_at?: string
          country_code?: string | null; cover_photo_id?: string | null; is_transit?: boolean
        }
        Update: {
          id?: string; trip_id?: string; title?: string; location?: string | null
          start_date?: string | null; end_date?: string | null; nights?: number | null
          accommodation?: string | null; notes?: string | null; sort_order?: number; created_at?: string
          country_code?: string | null; cover_photo_id?: string | null; is_transit?: boolean
        }
        Relationships: [
          { foreignKeyName: "stages_trip_id_fkey"; columns: ["trip_id"]; isOneToOne: false; referencedRelation: "trips"; referencedColumns: ["id"] },
          { foreignKeyName: "stages_cover_photo_id_fkey"; columns: ["cover_photo_id"]; isOneToOne: false; referencedRelation: "memory_photos"; referencedColumns: ["id"] }
        ]
      }
      trip_days: {
        Row: {
          id: string; trip_id: string; stage_id: string | null; date: string
          title: string | null; day_plan: Json | null; created_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; date: string
          title?: string | null; day_plan?: Json | null; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; date?: string
          title?: string | null; day_plan?: Json | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "trip_days_trip_id_fkey";   columns: ["trip_id"];  isOneToOne: false; referencedRelation: "trips";  referencedColumns: ["id"] },
          { foreignKeyName: "trip_days_stage_id_fkey";  columns: ["stage_id"]; isOneToOne: false; referencedRelation: "stages"; referencedColumns: ["id"] }
        ]
      }
      bookings: {
        Row: {
          id: string; trip_id: string; stage_id: string | null; type: BookingType; title: string
          provider: string | null; booking_reference: string | null; status: BookingStatus
          payment_status: PaymentStatus
          amount: number | null; currency: string; start_datetime: string | null
          end_datetime: string | null; details: Json | null; notes: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; type: BookingType; title: string
          provider?: string | null; booking_reference?: string | null; status?: BookingStatus
          payment_status?: PaymentStatus
          amount?: number | null; currency?: string; start_datetime?: string | null
          end_datetime?: string | null; details?: Json | null; notes?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; type?: BookingType; title?: string
          provider?: string | null; booking_reference?: string | null; status?: BookingStatus
          payment_status?: PaymentStatus
          amount?: number | null; currency?: string; start_datetime?: string | null
          end_datetime?: string | null; details?: Json | null; notes?: string | null
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "bookings_trip_id_fkey";  columns: ["trip_id"];  isOneToOne: false; referencedRelation: "trips";  referencedColumns: ["id"] },
          { foreignKeyName: "bookings_stage_id_fkey"; columns: ["stage_id"]; isOneToOne: false; referencedRelation: "stages"; referencedColumns: ["id"] }
        ]
      }
      trip_exchange_rates: {
        Row:    { trip_id: string; currency: string; rate: number; source: string; updated_at: string }
        Insert: { trip_id: string; currency: string; rate: number; source?: string; updated_at?: string }
        Update: { trip_id?: string; currency?: string; rate?: number; source?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "trip_exchange_rates_trip_id_fkey"; columns: ["trip_id"]; isOneToOne: false; referencedRelation: "trips"; referencedColumns: ["id"] }
        ]
      }
      journey_events: {
        Row: {
          id: string; trip_id: string; stage_id: string | null; date: string; time: string | null
          category: string; title: string; location: string | null; notes: string | null
          status: string; metadata: Json | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; date: string; time?: string | null
          category: string; title: string; location?: string | null; notes?: string | null
          status?: string; metadata?: Json | null; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; date?: string; time?: string | null
          category?: string; title?: string; location?: string | null; notes?: string | null
          status?: string; metadata?: Json | null; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "journey_events_trip_id_fkey";  columns: ["trip_id"];  isOneToOne: false; referencedRelation: "trips";  referencedColumns: ["id"] },
          { foreignKeyName: "journey_events_stage_id_fkey"; columns: ["stage_id"]; isOneToOne: false; referencedRelation: "stages"; referencedColumns: ["id"] }
        ]
      }
      budget_items: {
        Row: {
          id: string; trip_id: string; stage_id: string | null; booking_id: string | null
          category: string; label: string; amount_planned: number | null; amount_actual: number | null
          currency: string; storage_bucket: string | null; storage_path: string | null
          details: Json | null; created_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; booking_id?: string | null
          category: string; label: string; amount_planned?: number | null; amount_actual?: number | null
          currency?: string; storage_bucket?: string | null; storage_path?: string | null
          details?: Json | null; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; booking_id?: string | null
          category?: string; label?: string; amount_planned?: number | null; amount_actual?: number | null
          currency?: string; storage_bucket?: string | null; storage_path?: string | null
          details?: Json | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "budget_items_trip_id_fkey";    columns: ["trip_id"];    isOneToOne: false; referencedRelation: "trips";    referencedColumns: ["id"] },
          { foreignKeyName: "budget_items_stage_id_fkey";   columns: ["stage_id"];   isOneToOne: false; referencedRelation: "stages";   referencedColumns: ["id"] },
          { foreignKeyName: "budget_items_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "bookings"; referencedColumns: ["id"] }
        ]
      }
      documents: {
        Row: {
          id: string; trip_id: string | null; person_id: string | null; booking_id: string | null
          doc_type: string; label: string | null; expires_at: string | null
          storage_provider: StorageProvider; storage_bucket: string; storage_path: string
          details: Json | null; notes: string | null; created_at: string
        }
        Insert: {
          id?: string; trip_id?: string | null; person_id?: string | null; booking_id?: string | null
          doc_type: string; label?: string | null; expires_at?: string | null
          storage_provider?: StorageProvider; storage_bucket: string; storage_path: string
          details?: Json | null; notes?: string | null; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string | null; person_id?: string | null; booking_id?: string | null
          doc_type?: string; label?: string | null; expires_at?: string | null
          storage_provider?: StorageProvider; storage_bucket?: string; storage_path?: string
          details?: Json | null; notes?: string | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "documents_trip_id_fkey";    columns: ["trip_id"];    isOneToOne: false; referencedRelation: "trips";    referencedColumns: ["id"] },
          { foreignKeyName: "documents_person_id_fkey";  columns: ["person_id"];  isOneToOne: false; referencedRelation: "persons";  referencedColumns: ["id"] },
          { foreignKeyName: "documents_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "bookings"; referencedColumns: ["id"] }
        ]
      }
      document_trips: {
        Row:    { document_id: string; trip_id: string }
        Insert: { document_id: string; trip_id: string }
        Update: { document_id?: string; trip_id?: string }
        Relationships: [
          { foreignKeyName: "document_trips_document_id_fkey"; columns: ["document_id"]; isOneToOne: false; referencedRelation: "documents"; referencedColumns: ["id"] },
          { foreignKeyName: "document_trips_trip_id_fkey";     columns: ["trip_id"];     isOneToOne: false; referencedRelation: "trips";     referencedColumns: ["id"] }
        ]
      }
      insurance_policies: {
        Row: {
          id: string; family_id: string; label: string; provider: string | null
          policy_type: string | null; reference_number: string | null
          valid_from: string | null; valid_to: string | null
          emergency_contact: string | null; notes: string | null
          storage_bucket: string | null; storage_path: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; label: string; provider?: string | null
          policy_type?: string | null; reference_number?: string | null
          valid_from?: string | null; valid_to?: string | null
          emergency_contact?: string | null; notes?: string | null
          storage_bucket?: string | null; storage_path?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; label?: string; provider?: string | null
          policy_type?: string | null; reference_number?: string | null
          valid_from?: string | null; valid_to?: string | null
          emergency_contact?: string | null; notes?: string | null
          storage_bucket?: string | null; storage_path?: string | null
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "insurance_policies_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      insurance_policy_persons: {
        Row:    { policy_id: string; person_id: string }
        Insert: { policy_id: string; person_id: string }
        Update: { policy_id?: string; person_id?: string }
        Relationships: [
          { foreignKeyName: "insurance_policy_persons_policy_id_fkey"; columns: ["policy_id"]; isOneToOne: false; referencedRelation: "insurance_policies"; referencedColumns: ["id"] },
          { foreignKeyName: "insurance_policy_persons_person_id_fkey"; columns: ["person_id"]; isOneToOne: false; referencedRelation: "persons"; referencedColumns: ["id"] }
        ]
      }
      insurance_policy_trips: {
        Row:    { policy_id: string; trip_id: string }
        Insert: { policy_id: string; trip_id: string }
        Update: { policy_id?: string; trip_id?: string }
        Relationships: [
          { foreignKeyName: "insurance_policy_trips_policy_id_fkey"; columns: ["policy_id"]; isOneToOne: false; referencedRelation: "insurance_policies"; referencedColumns: ["id"] },
          { foreignKeyName: "insurance_policy_trips_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      packing_items: {
        Row: {
          id: string; trip_id: string; person_id: string | null; label: string
          category: string | null; is_packed: boolean; is_essential: boolean; created_at: string
        }
        Insert: {
          id?: string; trip_id: string; person_id?: string | null; label: string
          category?: string | null; is_packed?: boolean; is_essential?: boolean; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; person_id?: string | null; label?: string
          category?: string | null; is_packed?: boolean; is_essential?: boolean; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "packing_items_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] },
          { foreignKeyName: "packing_items_person_id_fkey"; columns: ["person_id"]; isOneToOne: false; referencedRelation: "persons"; referencedColumns: ["id"] }
        ]
      }
      tasks: {
        Row: {
          id: string; trip_id: string; stage_id: string | null; title: string
          hint: string | null; context: string | null; status: TaskStatus; due_date: string | null
          assigned_to: string | null; created_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; title: string
          hint?: string | null; context?: string | null; status?: TaskStatus; due_date?: string | null
          assigned_to?: string | null; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; title?: string
          hint?: string | null; context?: string | null; status?: TaskStatus; due_date?: string | null
          assigned_to?: string | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "tasks_trip_id_fkey";  columns: ["trip_id"];  isOneToOne: false; referencedRelation: "trips";  referencedColumns: ["id"] },
          { foreignKeyName: "tasks_stage_id_fkey"; columns: ["stage_id"]; isOneToOne: false; referencedRelation: "stages"; referencedColumns: ["id"] }
        ]
      }
      journal_entries: {
        Row: {
          id: string; trip_id: string; trip_day_id: string | null; author_id: string | null
          date: string | null; title: string; content: string | null; location: string | null
          visibility: JournalVis; created_at: string
        }
        Insert: {
          id?: string; trip_id: string; trip_day_id?: string | null; author_id?: string | null
          date?: string | null; title: string; content?: string | null; location?: string | null
          visibility?: JournalVis; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; trip_day_id?: string | null; author_id?: string | null
          date?: string | null; title?: string; content?: string | null; location?: string | null
          visibility?: JournalVis; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "journal_entries_trip_id_fkey";     columns: ["trip_id"];     isOneToOne: false; referencedRelation: "trips";     referencedColumns: ["id"] },
          { foreignKeyName: "journal_entries_trip_day_id_fkey"; columns: ["trip_day_id"]; isOneToOne: false; referencedRelation: "trip_days"; referencedColumns: ["id"] },
          { foreignKeyName: "journal_entries_author_id_fkey";   columns: ["author_id"];   isOneToOne: false; referencedRelation: "persons";   referencedColumns: ["id"] }
        ]
      }
      family_preference_categories: {
        Row: {
          id: string; family_id: string; category_key: string; weight: number
          note: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; category_key: string; weight?: number
          note?: string | null; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; category_key?: string; weight?: number
          note?: string | null; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "family_preference_categories_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      past_trips: {
        Row: {
          id: string; family_id: string; country_or_region: string; country_code: string | null
          year: number; places: string | null; duration_days: number | null
          photo_storage_path: string | null; note: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; country_or_region: string; country_code?: string | null
          year: number; places?: string | null; duration_days?: number | null
          photo_storage_path?: string | null; note?: string | null; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; country_or_region?: string; country_code?: string | null
          year?: number; places?: string | null; duration_days?: number | null
          photo_storage_path?: string | null; note?: string | null; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "past_trips_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      past_trip_travelers: {
        Row:    { past_trip_id: string; person_id: string }
        Insert: { past_trip_id: string; person_id: string }
        Update: { past_trip_id?: string; person_id?: string }
        Relationships: [
          { foreignKeyName: "past_trip_travelers_past_trip_id_fkey"; columns: ["past_trip_id"]; isOneToOne: false; referencedRelation: "past_trips"; referencedColumns: ["id"] },
          { foreignKeyName: "past_trip_travelers_person_id_fkey";    columns: ["person_id"];    isOneToOne: false; referencedRelation: "persons";    referencedColumns: ["id"] }
        ]
      }
      content_projects: {
        Row: {
          id: string; family_id: string; trip_id: string | null; title: string
          status: string; project_type: string; created_at: string; updated_at: string
          content_date: string | null; stage_id: string | null; language: string | null; tonality: string | null
          output_format: string | null
          content_focus: string | null; custom_focus: string | null; mood: string[] | null; hint_text: string | null
        }
        Insert: {
          id?: string; family_id: string; trip_id?: string | null; title: string
          status?: string; project_type?: string; created_at?: string; updated_at?: string
          content_date?: string | null; stage_id?: string | null; language?: string | null; tonality?: string | null
          output_format?: string | null
          content_focus?: string | null; custom_focus?: string | null; mood?: string[] | null; hint_text?: string | null
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string | null; title?: string
          status?: string; project_type?: string; created_at?: string; updated_at?: string
          content_date?: string | null; stage_id?: string | null; language?: string | null; tonality?: string | null
          output_format?: string | null
          content_focus?: string | null; custom_focus?: string | null; mood?: string[] | null; hint_text?: string | null
        }
        Relationships: [
          { foreignKeyName: "content_projects_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "content_projects_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] },
          { foreignKeyName: "content_projects_stage_id_fkey";  columns: ["stage_id"];  isOneToOne: false; referencedRelation: "stages"; referencedColumns: ["id"] }
        ]
      }
      today_recommendations: {
        Row: {
          id: string; family_id: string; trip_id: string | null; for_date: string
          day_style: string | null; highlight_title: string | null
          day_summary: string; recommendation: Json; alternative: Json | null; created_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id?: string | null; for_date: string
          day_style?: string | null; highlight_title?: string | null
          day_summary: string; recommendation: Json; alternative?: Json | null; created_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string | null; for_date?: string
          day_style?: string | null; highlight_title?: string | null
          day_summary?: string; recommendation?: Json; alternative?: Json | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "today_recommendations_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "today_recommendations_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      content_strategies: {
        Row: {
          id: string; family_id: string; trip_id: string | null; for_date: string
          content_type: string; reasoning: string; storyline: string; shotlist: Json
          best_time: string | null; effort: string | null; created_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id?: string | null; for_date: string
          content_type: string; reasoning: string; storyline: string; shotlist: Json
          best_time?: string | null; effort?: string | null; created_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string | null; for_date?: string
          content_type?: string; reasoning?: string; storyline?: string; shotlist?: Json
          best_time?: string | null; effort?: string | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "content_strategies_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "content_strategies_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      concierge_messages: {
        Row: {
          id: string; family_id: string; trip_id: string | null; for_date: string
          question_key: string; question_text: string; answer_title: string; answer_body: string
          actions: Json; context_fingerprint: string | null; created_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id?: string | null; for_date: string
          question_key: string; question_text: string; answer_title: string; answer_body: string
          actions?: Json; context_fingerprint?: string | null; created_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string | null; for_date?: string
          question_key?: string; question_text?: string; answer_title?: string; answer_body?: string
          actions?: Json; context_fingerprint?: string | null; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "concierge_messages_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "concierge_messages_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      concierge_category_suggestions: {
        Row: {
          id: string; family_id: string; trip_id: string; category: string
          question_text: string; title: string; body: string; event_title: string
          updated_at: string; created_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id: string; category: string
          question_text: string; title: string; body: string; event_title: string
          updated_at?: string; created_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string; category?: string
          question_text?: string; title?: string; body?: string; event_title?: string
          updated_at?: string; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "concierge_category_suggestions_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "concierge_category_suggestions_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      dev_test_runs: {
        Row: {
          id: string; module_key: string; success: boolean
          summary: string | null; error_message: string | null; result: Json | null; ran_at: string
        }
        Insert: {
          id?: string; module_key: string; success: boolean
          summary?: string | null; error_message?: string | null; result?: Json | null; ran_at?: string
        }
        Update: {
          id?: string; module_key?: string; success?: boolean
          summary?: string | null; error_message?: string | null; result?: Json | null; ran_at?: string
        }
        Relationships: []
      }
      category_places_cache: {
        Row: {
          id: string; family_id: string; trip_id: string; category: string
          origin_key: string; origin_label: string; results: Json; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id: string; category: string
          origin_key: string; origin_label: string; results: Json; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string; category?: string
          origin_key?: string; origin_label?: string; results?: Json; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "category_places_cache_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "category_places_cache_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      day_plan_cache: {
        Row: {
          id: string; family_id: string; trip_id: string; mode: string
          plan: Json; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id: string; mode: string
          plan: Json; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string; mode?: string
          plan?: Json; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "day_plan_cache_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "day_plan_cache_trip_id_fkey";   columns: ["trip_id"];   isOneToOne: false; referencedRelation: "trips";   referencedColumns: ["id"] }
        ]
      }
      content_ideas: {
        Row: {
          id: string; family_id: string; project_id: string | null; trip_id: string | null
          source_input_text: string | null; source_media_storage_path: string | null
          content_goal: string | null; suggestions: Json; chosen_index: number | null
          status: string; is_favorite: boolean; reasoning: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; project_id?: string | null; trip_id?: string | null
          source_input_text?: string | null; source_media_storage_path?: string | null
          content_goal?: string | null; suggestions: Json; chosen_index?: number | null
          status?: string; is_favorite?: boolean; reasoning?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; project_id?: string | null; trip_id?: string | null
          source_input_text?: string | null; source_media_storage_path?: string | null
          content_goal?: string | null; suggestions?: Json; chosen_index?: number | null
          status?: string; is_favorite?: boolean; reasoning?: string | null
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "content_ideas_family_id_fkey";  columns: ["family_id"];  isOneToOne: false; referencedRelation: "families";         referencedColumns: ["id"] },
          { foreignKeyName: "content_ideas_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "content_projects"; referencedColumns: ["id"] },
          { foreignKeyName: "content_ideas_trip_id_fkey";    columns: ["trip_id"];    isOneToOne: false; referencedRelation: "trips";             referencedColumns: ["id"] }
        ]
      }
      content_drafts: {
        Row: {
          id: string; idea_id: string | null; project_id: string; draft_type: string
          structure: Json; visibility: string; scheduled_at: string | null; posted_at: string | null
          storage_path: string | null; notes: string | null; instagram_ready: boolean
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; idea_id?: string | null; project_id: string; draft_type: string
          structure: Json; visibility?: string; scheduled_at?: string | null; posted_at?: string | null
          storage_path?: string | null; notes?: string | null; instagram_ready?: boolean
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; idea_id?: string | null; project_id?: string; draft_type?: string
          structure?: Json; visibility?: string; scheduled_at?: string | null; posted_at?: string | null
          storage_path?: string | null; notes?: string | null; instagram_ready?: boolean
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "content_drafts_idea_id_fkey";    columns: ["idea_id"];    isOneToOne: false; referencedRelation: "content_ideas";    referencedColumns: ["id"] },
          { foreignKeyName: "content_drafts_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "content_projects"; referencedColumns: ["id"] }
        ]
      }
      memory_photos: {
        Row: {
          id: string; family_id: string; trip_id: string | null; uploaded_by_person_id: string | null
          storage_path: string; taken_at: string | null; caption: string | null
          is_highlight: boolean; created_at: string
          phash: string | null; quality_score: number | null; analyzed_at: string | null
          is_duplicate_of: string | null; is_selected: boolean
          stage_id: string | null; sort_order: number; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; trip_id?: string | null; uploaded_by_person_id?: string | null
          storage_path: string; taken_at?: string | null; caption?: string | null
          is_highlight?: boolean; created_at?: string
          phash?: string | null; quality_score?: number | null; analyzed_at?: string | null
          is_duplicate_of?: string | null; is_selected?: boolean
          stage_id?: string | null; sort_order?: number; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; trip_id?: string | null; uploaded_by_person_id?: string | null
          storage_path?: string; taken_at?: string | null; caption?: string | null
          is_highlight?: boolean; created_at?: string
          phash?: string | null; quality_score?: number | null; analyzed_at?: string | null
          is_duplicate_of?: string | null; is_selected?: boolean
          stage_id?: string | null; sort_order?: number; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "memory_photos_family_id_fkey";             columns: ["family_id"];             isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] },
          { foreignKeyName: "memory_photos_trip_id_fkey";               columns: ["trip_id"];               isOneToOne: false; referencedRelation: "trips";    referencedColumns: ["id"] },
          { foreignKeyName: "memory_photos_uploaded_by_person_id_fkey"; columns: ["uploaded_by_person_id"]; isOneToOne: false; referencedRelation: "persons";  referencedColumns: ["id"] },
          { foreignKeyName: "memory_photos_is_duplicate_of_fkey";       columns: ["is_duplicate_of"];       isOneToOne: false; referencedRelation: "memory_photos"; referencedColumns: ["id"] },
          { foreignKeyName: "memory_photos_stage_id_fkey";              columns: ["stage_id"];              isOneToOne: false; referencedRelation: "stages"; referencedColumns: ["id"] }
        ]
      }
      content_project_photos: {
        Row: {
          id: string; project_id: string; storage_path: string; phash: string | null
          quality_score: number | null; is_duplicate_of: string | null; is_selected: boolean
          analyzed_at: string | null; created_at: string
          categories: string[]; reasoning: string | null; recommendation: string | null
          temporary: boolean; expires_at: string | null; retained_as_memory: boolean; memory_photo_id: string | null
        }
        Insert: {
          id?: string; project_id: string; storage_path: string; phash?: string | null
          quality_score?: number | null; is_duplicate_of?: string | null; is_selected?: boolean
          analyzed_at?: string | null; created_at?: string
          categories?: string[]; reasoning?: string | null; recommendation?: string | null
          temporary?: boolean; expires_at?: string | null; retained_as_memory?: boolean; memory_photo_id?: string | null
        }
        Update: {
          id?: string; project_id?: string; storage_path?: string; phash?: string | null
          quality_score?: number | null; is_duplicate_of?: string | null; is_selected?: boolean
          analyzed_at?: string | null; created_at?: string
          categories?: string[]; reasoning?: string | null; recommendation?: string | null
          temporary?: boolean; expires_at?: string | null; retained_as_memory?: boolean; memory_photo_id?: string | null
        }
        Relationships: [
          { foreignKeyName: "content_project_photos_project_id_fkey";      columns: ["project_id"];      isOneToOne: false; referencedRelation: "content_projects";       referencedColumns: ["id"] },
          { foreignKeyName: "content_project_photos_is_duplicate_of_fkey"; columns: ["is_duplicate_of"]; isOneToOne: false; referencedRelation: "content_project_photos"; referencedColumns: ["id"] },
          { foreignKeyName: "content_project_photos_memory_photo_id_fkey"; columns: ["memory_photo_id"]; isOneToOne: false; referencedRelation: "memory_photos"; referencedColumns: ["id"] }
        ]
      }
      content_photo_analyses: {
        Row: {
          id: string; family_id: string; project_id: string | null; trip_id: string | null
          caption: string | null; hashtags: string[]; hook: string | null
          story_structure: Json | null; reel_order: Json | null
          music_suggestions: string[]; photobook_chapters: Json | null; travel_diary: string | null
          status: string; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; project_id?: string | null; trip_id?: string | null
          caption?: string | null; hashtags?: string[]; hook?: string | null
          story_structure?: Json | null; reel_order?: Json | null
          music_suggestions?: string[]; photobook_chapters?: Json | null; travel_diary?: string | null
          status?: string; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; project_id?: string | null; trip_id?: string | null
          caption?: string | null; hashtags?: string[]; hook?: string | null
          story_structure?: Json | null; reel_order?: Json | null
          music_suggestions?: string[]; photobook_chapters?: Json | null; travel_diary?: string | null
          status?: string; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "content_photo_analyses_family_id_fkey";  columns: ["family_id"];  isOneToOne: false; referencedRelation: "families";         referencedColumns: ["id"] },
          { foreignKeyName: "content_photo_analyses_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "content_projects"; referencedColumns: ["id"] },
          { foreignKeyName: "content_photo_analyses_trip_id_fkey";    columns: ["trip_id"];    isOneToOne: false; referencedRelation: "trips";             referencedColumns: ["id"] }
        ]
      }
      trip_idea_sessions: {
        Row: {
          id: string; family_id: string; input_text: string; clarifying_answers: Json | null
          traveler_ids: string[] | null
          travel_date_mode: string; travel_start_date: string | null; travel_end_date: string | null
          travel_period_text: string | null; nights_min: number | null; nights_max: number | null
          climate_preference: string | null; trip_type_preference: string | null; rain_risk_tolerant: boolean | null
          max_stopovers: number | null; stopover_preference: string | null
          budget_min: number | null; budget_max: number | null
          excluded_destinations: string[] | null; avoid_past_destinations: boolean
          excluded_trip_types: string[] | null; excluded_climates: string[] | null
          departure_city: string | null
          status: string; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; input_text: string; clarifying_answers?: Json | null
          traveler_ids?: string[] | null
          travel_date_mode?: string; travel_start_date?: string | null; travel_end_date?: string | null
          travel_period_text?: string | null; nights_min?: number | null; nights_max?: number | null
          climate_preference?: string | null; trip_type_preference?: string | null; rain_risk_tolerant?: boolean | null
          max_stopovers?: number | null; stopover_preference?: string | null
          budget_min?: number | null; budget_max?: number | null
          excluded_destinations?: string[] | null; avoid_past_destinations?: boolean
          excluded_trip_types?: string[] | null; excluded_climates?: string[] | null
          departure_city?: string | null
          status?: string; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; input_text?: string; clarifying_answers?: Json | null
          traveler_ids?: string[] | null
          travel_date_mode?: string; travel_start_date?: string | null; travel_end_date?: string | null
          travel_period_text?: string | null; nights_min?: number | null; nights_max?: number | null
          climate_preference?: string | null; trip_type_preference?: string | null; rain_risk_tolerant?: boolean | null
          max_stopovers?: number | null; stopover_preference?: string | null
          budget_min?: number | null; budget_max?: number | null
          excluded_destinations?: string[] | null; avoid_past_destinations?: boolean
          excluded_trip_types?: string[] | null; excluded_climates?: string[] | null
          departure_city?: string | null
          status?: string; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "trip_idea_sessions_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      trip_ideas: {
        Row: {
          id: string; session_id: string | null; family_id: string; origin: string
          destination: string; route_summary: string | null; best_season: string | null
          duration_days_min: number | null; duration_days_max: number | null; reasoning: string | null
          budget_range_min: number | null; budget_range_max: number | null; budget_currency: string
          includes_flights: boolean | null; is_chosen: boolean; converted_trip_id: string | null
          development_notes: string | null
          hotel_shortlist: Json | null; hotel_shortlist_updated_at: string | null
          flight_search_key: string | null; flight_options_updated_at: string | null
          budget_breakdown: Json | null; budget_breakdown_updated_at: string | null
          variants: Json | null; variants_generated_at: string | null
          is_favorite: boolean; chosen_variant_type: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; session_id?: string | null; family_id: string; origin?: string
          destination: string; route_summary?: string | null; best_season?: string | null
          duration_days_min?: number | null; duration_days_max?: number | null; reasoning?: string | null
          budget_range_min?: number | null; budget_range_max?: number | null; budget_currency?: string
          includes_flights?: boolean | null; is_chosen?: boolean; converted_trip_id?: string | null
          development_notes?: string | null
          hotel_shortlist?: Json | null; hotel_shortlist_updated_at?: string | null
          flight_search_key?: string | null; flight_options_updated_at?: string | null
          budget_breakdown?: Json | null; budget_breakdown_updated_at?: string | null
          variants?: Json | null; variants_generated_at?: string | null
          is_favorite?: boolean; chosen_variant_type?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; session_id?: string | null; family_id?: string; origin?: string
          destination?: string; route_summary?: string | null; best_season?: string | null
          duration_days_min?: number | null; duration_days_max?: number | null; reasoning?: string | null
          budget_range_min?: number | null; budget_range_max?: number | null; budget_currency?: string
          includes_flights?: boolean | null; is_chosen?: boolean; converted_trip_id?: string | null
          development_notes?: string | null
          hotel_shortlist?: Json | null; hotel_shortlist_updated_at?: string | null
          flight_search_key?: string | null; flight_options_updated_at?: string | null
          budget_breakdown?: Json | null; budget_breakdown_updated_at?: string | null
          variants?: Json | null; variants_generated_at?: string | null
          is_favorite?: boolean; chosen_variant_type?: string | null
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "trip_ideas_session_id_fkey";        columns: ["session_id"];        isOneToOne: false; referencedRelation: "trip_idea_sessions"; referencedColumns: ["id"] },
          { foreignKeyName: "trip_ideas_family_id_fkey";         columns: ["family_id"];         isOneToOne: false; referencedRelation: "families";            referencedColumns: ["id"] },
          { foreignKeyName: "trip_ideas_converted_trip_id_fkey"; columns: ["converted_trip_id"]; isOneToOne: false; referencedRelation: "trips";                referencedColumns: ["id"] }
        ]
      }
      trip_idea_comparisons: {
        Row: {
          id: string; family_id: string; idea_ids: string[]; comparison_key: string
          scores: Json; created_at: string
        }
        Insert: {
          id?: string; family_id: string; idea_ids: string[]; comparison_key: string
          scores: Json; created_at?: string
        }
        Update: {
          id?: string; family_id?: string; idea_ids?: string[]; comparison_key?: string
          scores?: Json; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "trip_idea_comparisons_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      flight_search_cache: {
        Row: {
          id: string; family_id: string; search_key: string
          origin_codes: string[]; destination_code: string
          departure_date: string; return_date: string | null
          adults: number; children: number; infants: number
          is_sandbox_data: boolean; results: Json
          search_started_at: string | null
          created_at: string; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; search_key: string
          origin_codes: string[]; destination_code: string
          departure_date: string; return_date?: string | null
          adults: number; children?: number; infants?: number
          is_sandbox_data?: boolean; results?: Json
          search_started_at?: string | null
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; search_key?: string
          origin_codes?: string[]; destination_code?: string
          departure_date?: string; return_date?: string | null
          adults?: number; children?: number; infants?: number
          is_sandbox_data?: boolean; results?: Json
          search_started_at?: string | null
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "flight_search_cache_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
      flight_search_usage: {
        Row: {
          id: string; family_id: string; month_key: string; search_count: number; updated_at: string
        }
        Insert: {
          id?: string; family_id: string; month_key: string; search_count?: number; updated_at?: string
        }
        Update: {
          id?: string; family_id?: string; month_key?: string; search_count?: number; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "flight_search_usage_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: {
      booking_type:   BookingType
      booking_status: BookingStatus
      trip_status:    TripStatus
      task_status:    TaskStatus
      journal_vis:    JournalVis
    }
    CompositeTypes: { [_ in never]: never }
  }
}
