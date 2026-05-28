export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "customer" | "cleaner" | "admin" | "dispatcher" | "finance";
          full_name: string;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "customer" | "cleaner" | "admin" | "dispatcher" | "finance";
          full_name: string;
          phone?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      service_addons: {
        Row: {
          id: string;
          service_slug: string;
          key: string;
          label: string;
          description: string | null;
          price_cents: number;
          duration_minutes: number;
          workload_weight: number;
          active: boolean;
          sort_order: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          slug: string | null;
          title: string | null;
          name: string | null;
          category: string | null;
          description: string | null;
          default_duration_minutes: number;
          base_price_cents: number;
          currency: string;
          active: boolean;
          min_hours: number;
          requires_team: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      service_equipment_options: {
        Row: {
          id: string;
          service_slug: string;
          key: string;
          label: string;
          description: string | null;
          price_cents: number;
          included_items: string[];
          active: boolean;
          sort_order: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      cleaner_quantity_rules: {
        Row: {
          id: string;
          service_slug: string;
          min_cleaners: number;
          max_cleaners: number;
          included_cleaners: number;
          extra_cleaner_price_cents: number;
          recommended_workload_minutes_per_cleaner: number;
          active: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      regular_cleaning_pricing_rules: {
        Row: {
          id: string;
          bedrooms: number;
          bathrooms: number;
          base_price_cents: number;
          estimated_minutes: number;
          active: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          auth_user_id: string | null;
          full_name: string;
          email: string;
          email_normalized: string | null;
          phone: string;
          phone_normalized: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          full_name: string;
          email: string;
          email_normalized?: string | null;
          phone: string;
          phone_normalized?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["customers"]["Insert"]>;
        Relationships: [];
      };
      cleaners: {
        Row: {
          id: string;
          auth_user_id: string | null;
          auth_email: string | null;
          full_name: string | null;
          display_name: string | null;
          photo_url: string | null;
          rating: number;
          experience_years: number;
          available: boolean;
          active: boolean;
          equipment_eligible: boolean;
          service_slugs: string[];
          suburbs: string[];
          tenure_months: number;
          phone: string | null;
          created_by_admin_id: string | null;
          password_set_at: string | null;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id?: string | null;
          auth_email?: string | null;
          full_name?: string | null;
          display_name?: string | null;
          photo_url?: string | null;
          rating?: number;
          experience_years?: number;
          available?: boolean;
          active?: boolean;
          equipment_eligible?: boolean;
          service_slugs?: string[];
          suburbs?: string[];
          tenure_months?: number;
          phone?: string | null;
          created_by_admin_id?: string | null;
          password_set_at?: string | null;
          last_login_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cleaners"]["Insert"]>;
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          checkout_session_id: string | null;
          recurring_series_id: string | null;
          occurrence_index: number | null;
          occurrence_count: number | null;
          occurrence_date: string | null;
          recurrence_frequency: string | null;
          recurrence_weekdays: number[];
          per_occurrence_total_cents: number | null;
          series_total_cents: number | null;
          customer_id: string | null;
          service_slug: string;
          booking_date: string;
          booking_time: string;
          address: string;
          suburb: string;
          property_type: string;
          bedrooms: number;
          bathrooms: number;
          extra_rooms: number;
          customer_notes: string | null;
          access_notes: string | null;
          estimated_minutes: number | null;
          selected_addons: Json;
          equipment_option: string;
          cleaner_count: number;
          selected_cleaner_id: string | null;
          base_price_cents: number;
          addons_total_cents: number;
          equipment_total_cents: number;
          extra_cleaners_total_cents: number;
          final_total_cents: number;
          payment_status: string;
          booking_status: string;
          pricing_snapshot: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          checkout_session_id?: string | null;
          recurring_series_id?: string | null;
          occurrence_index?: number | null;
          occurrence_count?: number | null;
          occurrence_date?: string | null;
          recurrence_frequency?: string | null;
          recurrence_weekdays?: number[];
          per_occurrence_total_cents?: number | null;
          series_total_cents?: number | null;
          customer_id?: string;
          service_slug: string;
          booking_date: string;
          booking_time: string;
          address: string;
          suburb: string;
          property_type: string;
          bedrooms: number;
          bathrooms: number;
          extra_rooms?: number;
          customer_notes?: string | null;
          access_notes?: string | null;
          estimated_minutes?: number | null;
          selected_addons: Json;
          equipment_option: string;
          cleaner_count: number;
          selected_cleaner_id?: string | null;
          base_price_cents: number;
          addons_total_cents: number;
          equipment_total_cents: number;
          extra_cleaners_total_cents: number;
          final_total_cents: number;
          payment_status: string;
          booking_status: string;
          pricing_snapshot: Json;
        };
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
        Relationships: [];
      };
      booking_recurring_series: {
        Row: {
          id: string;
          checkout_session_id: string | null;
          service_slug: string;
          customer_id: string | null;
          frequency: string;
          selected_weekdays: number[];
          start_date: string;
          time_window: string;
          occurrence_count: number;
          per_occurrence_total_cents: number;
          series_total_cents: number;
          payment_status: string;
          status: string;
          recurrence_config: Json;
          pricing_snapshot: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          checkout_session_id?: string | null;
          service_slug?: string;
          customer_id?: string | null;
          frequency: string;
          selected_weekdays?: number[];
          start_date: string;
          time_window: string;
          occurrence_count: number;
          per_occurrence_total_cents: number;
          series_total_cents: number;
          payment_status?: string;
          status?: string;
          recurrence_config: Json;
          pricing_snapshot: Json;
        };
        Update: Partial<Database["public"]["Tables"]["booking_recurring_series"]["Insert"]>;
        Relationships: [];
      };
      booking_addons: {
        Row: {
          id: string;
          booking_id: string;
          addon_key: string;
          label: string;
          price_cents: number;
        };
        Insert: {
          booking_id: string;
          addon_key: string;
          label: string;
          price_cents: number;
        };
        Update: Partial<Database["public"]["Tables"]["booking_addons"]["Insert"]>;
        Relationships: [];
      };
      booking_equipment: {
        Row: {
          id: string;
          booking_id: string;
          equipment_key: string;
          label: string;
          price_cents: number;
          included_items: string[];
        };
        Insert: {
          booking_id: string;
          equipment_key: string;
          label: string;
          price_cents: number;
          included_items: string[];
        };
        Update: Partial<Database["public"]["Tables"]["booking_equipment"]["Insert"]>;
        Relationships: [];
      };
      booking_cleaners: {
        Row: {
          id: string;
          booking_id: string;
          cleaner_id: string | null;
          cleaner_count: number;
          is_preferred: boolean;
          status: string;
          earning_cents: number | null;
          eligible_value_cents: number | null;
          earning_rate_percent: number | null;
          earning_rule: string | null;
          offered_at: string | null;
          accepted_at: string | null;
          started_at: string | null;
          completed_at: string | null;
          declined_at: string | null;
          decline_reason: string | null;
          offer_expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          cleaner_id?: string | null;
          cleaner_count: number;
          is_preferred: boolean;
          status: string;
          earning_cents?: number | null;
          eligible_value_cents?: number | null;
          earning_rate_percent?: number | null;
          earning_rule?: string | null;
          offered_at?: string | null;
          accepted_at?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          declined_at?: string | null;
          decline_reason?: string | null;
          offer_expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["booking_cleaners"]["Insert"]>;
        Relationships: [];
      };
      cleaner_availability: {
        Row: {
          id: string;
          cleaner_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          timezone: string;
          created_at: string;
        };
        Insert: {
          cleaner_id: string;
          day_of_week: number;
          start_time: string;
          end_time: string;
          timezone?: string;
        };
        Update: Partial<Database["public"]["Tables"]["cleaner_availability"]["Insert"]>;
        Relationships: [];
      };
      cleaner_time_off: {
        Row: {
          id: string;
          cleaner_id: string;
          start_at: string;
          end_at: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          cleaner_id: string;
          start_at: string;
          end_at: string;
          reason?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["cleaner_time_off"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          checkout_session_id: string | null;
          status: string;
          provider: string;
          provider_ref: string | null;
          provider_reference: string | null;
          idempotency_key: string;
          amount_cents: number;
          currency: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          booking_id: string;
          checkout_session_id?: string | null;
          status: string;
          provider: string;
          provider_ref?: string | null;
          provider_reference?: string | null;
          idempotency_key: string;
          amount_cents: number;
          currency: string;
          metadata: Json;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      upsert_customer_identity: {
        Args: {
          p_auth_user_id?: string | null;
          p_full_name: string;
          p_email: string;
          p_phone: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
