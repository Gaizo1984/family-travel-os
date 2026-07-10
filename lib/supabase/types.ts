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
        Row:    { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      persons: {
        Row: {
          id: string; family_id: string; name: string; initials: string
          color: string; birth_date: string | null; is_minor: boolean; created_at: string
        }
        Insert: {
          id?: string; family_id: string; name: string; initials: string
          color: string; birth_date?: string | null; is_minor?: boolean; created_at?: string
        }
        Update: {
          id?: string; family_id?: string; name?: string; initials?: string
          color?: string; birth_date?: string | null; is_minor?: boolean; created_at?: string
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
          gradient_to: string | null; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; slug: string; family_id: string; title: string; subtitle?: string | null
          status?: TripStatus; start_date?: string | null; end_date?: string | null
          cover_emoji?: string | null; gradient_from?: string | null; gradient_via?: string | null
          gradient_to?: string | null; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; slug?: string; family_id?: string; title?: string; subtitle?: string | null
          status?: TripStatus; start_date?: string | null; end_date?: string | null
          cover_emoji?: string | null; gradient_from?: string | null; gradient_via?: string | null
          gradient_to?: string | null; created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "trips_family_id_fkey"; columns: ["family_id"]; isOneToOne: false; referencedRelation: "families"; referencedColumns: ["id"] }
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
        }
        Insert: {
          id?: string; trip_id: string; title: string; location?: string | null
          start_date?: string | null; end_date?: string | null; nights?: number | null
          accommodation?: string | null; notes?: string | null; sort_order?: number; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; title?: string; location?: string | null
          start_date?: string | null; end_date?: string | null; nights?: number | null
          accommodation?: string | null; notes?: string | null; sort_order?: number; created_at?: string
        }
        Relationships: [
          { foreignKeyName: "stages_trip_id_fkey"; columns: ["trip_id"]; isOneToOne: false; referencedRelation: "trips"; referencedColumns: ["id"] }
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
      journey_events: {
        Row: {
          id: string; trip_id: string; stage_id: string | null; date: string; time: string | null
          category: string; title: string; location: string | null; notes: string | null
          status: string; created_at: string; updated_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; date: string; time?: string | null
          category: string; title: string; location?: string | null; notes?: string | null
          status?: string; created_at?: string; updated_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; date?: string; time?: string | null
          category?: string; title?: string; location?: string | null; notes?: string | null
          status?: string; created_at?: string; updated_at?: string
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
          currency: string; created_at: string
        }
        Insert: {
          id?: string; trip_id: string; stage_id?: string | null; booking_id?: string | null
          category: string; label: string; amount_planned?: number | null; amount_actual?: number | null
          currency?: string; created_at?: string
        }
        Update: {
          id?: string; trip_id?: string; stage_id?: string | null; booking_id?: string | null
          category?: string; label?: string; amount_planned?: number | null; amount_actual?: number | null
          currency?: string; created_at?: string
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
