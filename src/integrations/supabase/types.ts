export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          apartment: string | null
          area: string | null
          building: string | null
          city: string | null
          country: string
          created_at: string
          delivery_instructions: string | null
          estate: string | null
          id: string
          is_default: boolean
          label: string | null
          landmark: string | null
          latitude: number | null
          line1: string
          line2: string | null
          location_source: string | null
          longitude: number | null
          phone: string | null
          place_id: string | null
          postal_code: string | null
          recipient_name: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          apartment?: string | null
          area?: string | null
          building?: string | null
          city?: string | null
          country?: string
          created_at?: string
          delivery_instructions?: string | null
          estate?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          latitude?: number | null
          line1: string
          line2?: string | null
          location_source?: string | null
          longitude?: number | null
          phone?: string | null
          place_id?: string | null
          postal_code?: string | null
          recipient_name?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          apartment?: string | null
          area?: string | null
          building?: string | null
          city?: string | null
          country?: string
          created_at?: string
          delivery_instructions?: string | null
          estate?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          landmark?: string | null
          latitude?: number | null
          line1?: string
          line2?: string | null
          location_source?: string | null
          longitude?: number | null
          phone?: string | null
          place_id?: string | null
          postal_code?: string | null
          recipient_name?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          granted_by: string | null
          id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          granted_by?: string | null
          id?: string
          permission: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          granted_by?: string | null
          id?: string
          permission?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          product_id: string
          quantity: number
          seller_id: string
          store_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          seller_id: string
          store_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          seller_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rules: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          effective_from: string
          id: string
          is_active: boolean
          percent: number
          scope: string
          seller_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          percent: number
          scope: string
          seller_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string
          id?: string
          is_active?: boolean
          percent?: number
          scope?: string
          seller_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_messages: {
        Row: {
          body: string
          consultation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          consultation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          consultation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_sessions: {
        Row: {
          consultation_id: string
          created_at: string
          ended_at: string | null
          id: string
          join_opens_at: string | null
          provider: string | null
          room_id: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          join_opens_at?: string | null
          provider?: string | null
          room_id?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          join_opens_at?: string | null
          provider?: string | null
          room_id?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_sessions_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          availability_id: string | null
          cancel_reason: string | null
          created_at: string
          customer_id: string
          customer_note: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          mode: string
          payment_status: string
          platform_amount: number
          price_charged: number
          professional_amount: number
          professional_id: string
          professional_note: string | null
          reference: string
          scheduled_at: string
          service_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          availability_id?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_id: string
          customer_note?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          mode: string
          payment_status?: string
          platform_amount?: number
          price_charged: number
          professional_amount?: number
          professional_id: string
          professional_note?: string | null
          reference: string
          scheduled_at: string
          service_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          availability_id?: string | null
          cancel_reason?: string | null
          created_at?: string
          customer_id?: string
          customer_note?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          mode?: string
          payment_status?: string
          platform_amount?: number
          price_charged?: number
          professional_amount?: number
          professional_id?: string
          professional_note?: string | null
          reference?: string
          scheduled_at?: string
          service_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_availability_id_fkey"
            columns: ["availability_id"]
            isOneToOne: false
            referencedRelation: "professional_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "health_professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "telehealth_services"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          assigned_at: string | null
          attempt_number: number
          code_attempts: number
          created_at: string
          delivered_at: string | null
          delivery_code: string | null
          delivery_verified_at: string | null
          distance_meters: number | null
          dropoff_latitude: number | null
          dropoff_longitude: number | null
          duration_seconds: number | null
          eta_at: string | null
          eta_updated_at: string | null
          expected_delivery_at: string | null
          expected_pickup_at: string | null
          failure_note: string | null
          failure_reason: string | null
          fee_total: number
          fulfillment_id: string | null
          id: string
          is_peak: boolean
          is_priority: boolean
          last_dispatch_at: string | null
          late_alert_sent_at: string | null
          location_accuracy: number | null
          location_updated_at: string | null
          milestone: string | null
          offer_round: number
          order_id: string
          picked_up_at: string | null
          pickup_code: string | null
          pickup_latitude: number | null
          pickup_longitude: number | null
          pickup_verified_at: string | null
          platform_amount: number
          platform_percent: number | null
          pricing_version_id: string | null
          priority: number
          priority_amount: number
          quote_id: string | null
          rider_amount: number
          rider_id: string | null
          rider_latitude: number | null
          rider_longitude: number | null
          rider_percent: number | null
          route_calculated_at: string | null
          routing_provider: string | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          attempt_number?: number
          code_attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_verified_at?: string | null
          distance_meters?: number | null
          dropoff_latitude?: number | null
          dropoff_longitude?: number | null
          duration_seconds?: number | null
          eta_at?: string | null
          eta_updated_at?: string | null
          expected_delivery_at?: string | null
          expected_pickup_at?: string | null
          failure_note?: string | null
          failure_reason?: string | null
          fee_total?: number
          fulfillment_id?: string | null
          id?: string
          is_peak?: boolean
          is_priority?: boolean
          last_dispatch_at?: string | null
          late_alert_sent_at?: string | null
          location_accuracy?: number | null
          location_updated_at?: string | null
          milestone?: string | null
          offer_round?: number
          order_id: string
          picked_up_at?: string | null
          pickup_code?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          pickup_verified_at?: string | null
          platform_amount?: number
          platform_percent?: number | null
          pricing_version_id?: string | null
          priority?: number
          priority_amount?: number
          quote_id?: string | null
          rider_amount?: number
          rider_id?: string | null
          rider_latitude?: number | null
          rider_longitude?: number | null
          rider_percent?: number | null
          route_calculated_at?: string | null
          routing_provider?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          attempt_number?: number
          code_attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_verified_at?: string | null
          distance_meters?: number | null
          dropoff_latitude?: number | null
          dropoff_longitude?: number | null
          duration_seconds?: number | null
          eta_at?: string | null
          eta_updated_at?: string | null
          expected_delivery_at?: string | null
          expected_pickup_at?: string | null
          failure_note?: string | null
          failure_reason?: string | null
          fee_total?: number
          fulfillment_id?: string | null
          id?: string
          is_peak?: boolean
          is_priority?: boolean
          last_dispatch_at?: string | null
          late_alert_sent_at?: string | null
          location_accuracy?: number | null
          location_updated_at?: string | null
          milestone?: string | null
          offer_round?: number
          order_id?: string
          picked_up_at?: string | null
          pickup_code?: string | null
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          pickup_verified_at?: string | null
          platform_amount?: number
          platform_percent?: number | null
          pricing_version_id?: string | null
          priority?: number
          priority_amount?: number
          quote_id?: string | null
          rider_amount?: number
          rider_id?: string | null
          rider_latitude?: number | null
          rider_longitude?: number | null
          rider_percent?: number | null
          route_calculated_at?: string | null
          routing_provider?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "delivery_pricing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "delivery_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string
          delivery_id: string
          expires_at: string | null
          id: string
          kind: string
          offer_round: number
          offered_at: string
          outcome: string
          pickup_distance_km: number | null
          reason: string | null
          resolved_at: string | null
          rider_id: string | null
          score: number | null
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string
          delivery_id: string
          expires_at?: string | null
          id?: string
          kind?: string
          offer_round?: number
          offered_at?: string
          outcome?: string
          pickup_distance_km?: number | null
          reason?: string | null
          resolved_at?: string | null
          rider_id?: string | null
          score?: number | null
        }
        Update: {
          assigned_by?: string | null
          created_at?: string
          delivery_id?: string
          expires_at?: string | null
          id?: string
          kind?: string
          offer_round?: number
          offered_at?: string
          outcome?: string
          pickup_distance_km?: number | null
          reason?: string | null
          resolved_at?: string | null
          rider_id?: string | null
          score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_assignments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_distance_bands: {
        Row: {
          base_fee: number
          created_at: string
          id: string
          is_active: boolean
          max_km: number | null
          min_km: number
          name: string
          per_km_fee: number
          pricing_version_id: string
          updated_at: string
        }
        Insert: {
          base_fee?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_km?: number | null
          min_km?: number
          name: string
          per_km_fee?: number
          pricing_version_id: string
          updated_at?: string
        }
        Update: {
          base_fee?: number
          created_at?: string
          id?: string
          is_active?: boolean
          max_km?: number | null
          min_km?: number
          name?: string
          per_km_fee?: number
          pricing_version_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_distance_bands_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "delivery_pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_offers: {
        Row: {
          created_at: string
          decline_reason: string | null
          delivery_id: string
          expires_at: string | null
          id: string
          offer_round: number
          pickup_distance_km: number | null
          responded_at: string | null
          rider_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decline_reason?: string | null
          delivery_id: string
          expires_at?: string | null
          id?: string
          offer_round?: number
          pickup_distance_km?: number | null
          responded_at?: string | null
          rider_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decline_reason?: string | null
          delivery_id?: string
          expires_at?: string | null
          id?: string
          offer_round?: number
          pickup_distance_km?: number | null
          responded_at?: string | null
          rider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_offers_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_peak_windows: {
        Row: {
          created_at: string
          days: number[]
          end_time: string
          id: string
          is_active: boolean
          label: string | null
          pricing_version_id: string
          rider_percent: number | null
          start_time: string
          surcharge_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          days?: number[]
          end_time: string
          id?: string
          is_active?: boolean
          label?: string | null
          pricing_version_id: string
          rider_percent?: number | null
          start_time: string
          surcharge_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          days?: number[]
          end_time?: string
          id?: string
          is_active?: boolean
          label?: string | null
          pricing_version_id?: string
          rider_percent?: number | null
          start_time?: string
          surcharge_percent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_peak_windows_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "delivery_pricing_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_pricing_versions: {
        Row: {
          base_fee: number
          created_at: string
          created_by: string | null
          delivery_enabled: boolean
          effective_from: string
          effective_to: string | null
          emergency_fee: number
          id: string
          is_active: boolean
          label: string | null
          late_threshold_minutes: number
          location_min_interval_seconds: number
          location_retention_days: number
          max_fee: number | null
          max_offer_rounds: number
          min_fee: number
          offer_timeout_seconds: number
          peak_rider_percent: number
          peak_surcharge_percent: number
          per_km_fee: number
          priority_enabled: boolean
          priority_fee: number
          quote_ttl_seconds: number
          regular_rider_percent: number
          updated_at: string
          version: number
        }
        Insert: {
          base_fee?: number
          created_at?: string
          created_by?: string | null
          delivery_enabled?: boolean
          effective_from?: string
          effective_to?: string | null
          emergency_fee?: number
          id?: string
          is_active?: boolean
          label?: string | null
          late_threshold_minutes?: number
          location_min_interval_seconds?: number
          location_retention_days?: number
          max_fee?: number | null
          max_offer_rounds?: number
          min_fee?: number
          offer_timeout_seconds?: number
          peak_rider_percent?: number
          peak_surcharge_percent?: number
          per_km_fee?: number
          priority_enabled?: boolean
          priority_fee?: number
          quote_ttl_seconds?: number
          regular_rider_percent?: number
          updated_at?: string
          version: number
        }
        Update: {
          base_fee?: number
          created_at?: string
          created_by?: string | null
          delivery_enabled?: boolean
          effective_from?: string
          effective_to?: string | null
          emergency_fee?: number
          id?: string
          is_active?: boolean
          label?: string | null
          late_threshold_minutes?: number
          location_min_interval_seconds?: number
          location_retention_days?: number
          max_fee?: number | null
          max_offer_rounds?: number
          min_fee?: number
          offer_timeout_seconds?: number
          peak_rider_percent?: number
          peak_surcharge_percent?: number
          per_km_fee?: number
          priority_enabled?: boolean
          priority_fee?: number
          quote_ttl_seconds?: number
          regular_rider_percent?: number
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      delivery_quotes: {
        Row: {
          address_id: string | null
          band_id: string | null
          base_amount: number
          created_at: string
          customer_id: string
          distance_amount: number
          distance_meters: number | null
          dropoff_latitude: number | null
          dropoff_longitude: number | null
          duration_seconds: number | null
          emergency_amount: number
          expires_at: string
          id: string
          is_emergency: boolean
          is_peak: boolean
          is_priority: boolean
          order_id: string | null
          peak_surcharge: number
          pickup_latitude: number | null
          pickup_longitude: number | null
          platform_amount: number
          platform_percent: number
          pricing_version_id: string | null
          priority_amount: number
          rider_amount: number
          rider_percent: number
          route_calculated_at: string | null
          routing_provider: string | null
          rule: string | null
          status: string
          store_id: string
          total_fee: number
          zone_id: string | null
        }
        Insert: {
          address_id?: string | null
          band_id?: string | null
          base_amount?: number
          created_at?: string
          customer_id: string
          distance_amount?: number
          distance_meters?: number | null
          dropoff_latitude?: number | null
          dropoff_longitude?: number | null
          duration_seconds?: number | null
          emergency_amount?: number
          expires_at: string
          id?: string
          is_emergency?: boolean
          is_peak?: boolean
          is_priority?: boolean
          order_id?: string | null
          peak_surcharge?: number
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          platform_amount?: number
          platform_percent: number
          pricing_version_id?: string | null
          priority_amount?: number
          rider_amount?: number
          rider_percent: number
          route_calculated_at?: string | null
          routing_provider?: string | null
          rule?: string | null
          status?: string
          store_id: string
          total_fee?: number
          zone_id?: string | null
        }
        Update: {
          address_id?: string | null
          band_id?: string | null
          base_amount?: number
          created_at?: string
          customer_id?: string
          distance_amount?: number
          distance_meters?: number | null
          dropoff_latitude?: number | null
          dropoff_longitude?: number | null
          duration_seconds?: number | null
          emergency_amount?: number
          expires_at?: string
          id?: string
          is_emergency?: boolean
          is_peak?: boolean
          is_priority?: boolean
          order_id?: string | null
          peak_surcharge?: number
          pickup_latitude?: number | null
          pickup_longitude?: number | null
          platform_amount?: number
          platform_percent?: number
          pricing_version_id?: string | null
          priority_amount?: number
          rider_amount?: number
          rider_percent?: number
          route_calculated_at?: string | null
          routing_provider?: string | null
          rule?: string | null
          status?: string
          store_id?: string
          total_fee?: number
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_quotes_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_quotes_band_id_fkey"
            columns: ["band_id"]
            isOneToOne: false
            referencedRelation: "delivery_distance_bands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_quotes_pricing_version_id_fkey"
            columns: ["pricing_version_id"]
            isOneToOne: false
            referencedRelation: "delivery_pricing_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_quotes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_quotes_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_status_history: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          delivery_id: string
          id: string
          latitude: number | null
          longitude: number | null
          new_status: string
          order_id: string | null
          previous_status: string | null
          reason: string | null
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          delivery_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          new_status: string
          order_id?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          delivery_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          new_status?: string
          order_id?: string | null
          previous_status?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_status_history_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          base_fee: number
          center_latitude: number | null
          center_longitude: number | null
          city: string | null
          country: string
          created_at: string
          id: string
          is_active: boolean
          min_fee: number
          name: string
          peak_multiplier: number
          per_km_fee: number
          polygon: Json | null
          radius_km: number | null
          state: string | null
          updated_at: string
        }
        Insert: {
          base_fee: number
          center_latitude?: number | null
          center_longitude?: number | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_fee?: number
          name: string
          peak_multiplier?: number
          per_km_fee?: number
          polygon?: Json | null
          radius_km?: number | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          base_fee?: number
          center_latitude?: number | null
          center_longitude?: number | null
          city?: string | null
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          min_fee?: number
          name?: string
          peak_multiplier?: number
          per_km_fee?: number
          polygon?: Json | null
          radius_km?: number | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      family_health_permissions: {
        Row: {
          created_at: string
          granted: boolean
          id: string
          member_id: string
          owner_id: string
          permission: string
        }
        Insert: {
          created_at?: string
          granted?: boolean
          id?: string
          member_id: string
          owner_id: string
          permission: string
        }
        Update: {
          created_at?: string
          granted?: boolean
          id?: string
          member_id?: string
          owner_id?: string
          permission?: string
        }
        Relationships: []
      }
      favorite_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          label: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          label: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          label?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      health_professionals: {
        Row: {
          bio: string | null
          consultation_modes: string[]
          created_at: string
          credentials: string | null
          document_paths: string[]
          full_name: string
          id: string
          is_active: boolean
          is_available_now: boolean
          license_number: string | null
          photo_path: string | null
          professional_type: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          specialties: string[]
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          bio?: string | null
          consultation_modes?: string[]
          created_at?: string
          credentials?: string | null
          document_paths?: string[]
          full_name: string
          id?: string
          is_active?: boolean
          is_available_now?: boolean
          license_number?: string | null
          photo_path?: string | null
          professional_type: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialties?: string[]
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          bio?: string | null
          consultation_modes?: string[]
          created_at?: string
          credentials?: string | null
          document_paths?: string[]
          full_name?: string
          id?: string
          is_active?: boolean
          is_available_now?: boolean
          license_number?: string | null
          photo_path?: string | null
          professional_type?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          specialties?: string[]
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      health_profiles: {
        Row: {
          allergies: string | null
          blood_type: string | null
          conditions: string | null
          created_at: string
          current_medications: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          notes: string | null
          preferred_store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allergies?: string | null
          blood_type?: string | null
          conditions?: string | null
          created_at?: string
          current_medications?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          notes?: string | null
          preferred_store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allergies?: string | null
          blood_type?: string | null
          conditions?: string | null
          created_at?: string
          current_medications?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          notes?: string | null
          preferred_store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_profiles_preferred_store_id_fkey"
            columns: ["preferred_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_batches: {
        Row: {
          alerted_at: string | null
          batch_number: string | null
          created_at: string
          expiry_date: string | null
          id: string
          note: string | null
          product_id: string
          quantity: number
          received_at: string
          seller_id: string
          store_id: string
          updated_at: string
        }
        Insert: {
          alerted_at?: string | null
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          note?: string | null
          product_id: string
          quantity?: number
          received_at?: string
          seller_id: string
          store_id: string
          updated_at?: string
        }
        Update: {
          alerted_at?: string | null
          batch_number?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          note?: string | null
          product_id?: string
          quantity?: number
          received_at?: string
          seller_id?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_batches_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          kind: string
          order_id: string | null
          product_id: string
          quantity_delta: number
          reason: string | null
          resulting_stock: number
          seller_id: string
          store_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind: string
          order_id?: string | null
          product_id: string
          quantity_delta: number
          reason?: string | null
          resulting_stock: number
          seller_id: string
          store_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          order_id?: string | null
          product_id?: string
          quantity_delta?: number
          reason?: string | null
          resulting_stock?: number
          seller_id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      late_delivery_events: {
        Row: {
          admin_note: string | null
          created_at: string
          delay_minutes: number
          delivery_id: string
          detected_at: string
          expected_at: string | null
          id: string
          order_id: string
          rider_id: string | null
          status: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          delay_minutes?: number
          delivery_id: string
          detected_at?: string
          expected_at?: string | null
          id?: string
          order_id: string
          rider_id?: string | null
          status?: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          delay_minutes?: number
          delivery_id?: string
          detected_at?: string
          expected_at?: string | null
          id?: string
          order_id?: string
          rider_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "late_delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "late_delivery_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          beneficiary_id: string | null
          created_at: string
          delivery_id: string | null
          fulfillment_id: string | null
          id: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          order_id: string | null
          payout_status: Database["public"]["Enums"]["payout_status"]
          percentage: number | null
          rule: string | null
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          created_at?: string
          delivery_id?: string | null
          fulfillment_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["ledger_kind"]
          order_id?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          percentage?: number | null
          rule?: string | null
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          created_at?: string
          delivery_id?: string | null
          fulfillment_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["ledger_kind"]
          order_id?: string | null
          payout_status?: Database["public"]["Enums"]["payout_status"]
          percentage?: number | null
          rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_doses: {
        Row: {
          acted_at: string | null
          created_at: string
          id: string
          medication_id: string
          note: string | null
          reminder_id: string | null
          scheduled_for: string
          status: string
          user_id: string
        }
        Insert: {
          acted_at?: string | null
          created_at?: string
          id?: string
          medication_id: string
          note?: string | null
          reminder_id?: string | null
          scheduled_for: string
          status?: string
          user_id: string
        }
        Update: {
          acted_at?: string | null
          created_at?: string
          id?: string
          medication_id?: string
          note?: string | null
          reminder_id?: string | null
          scheduled_for?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_doses_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "medication_reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_reminders: {
        Row: {
          created_at: string
          days_of_week: number[]
          enabled: boolean
          ends_on: string | null
          id: string
          medication_id: string
          starts_on: string
          times: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          ends_on?: string | null
          id?: string
          medication_id: string
          starts_on?: string
          times?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          ends_on?: string | null
          id?: string
          medication_id?: string
          starts_on?: string
          times?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_reminders_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          created_at: string
          dosage: string | null
          end_date: string | null
          frequency: string | null
          id: string
          instructions: string | null
          name: string
          notes: string | null
          prescriber: string | null
          product_id: string | null
          start_date: string | null
          status: string
          strength: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          name: string
          notes?: string | null
          prescriber?: string | null
          product_id?: string | null
          start_date?: string | null
          status?: string
          strength?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dosage?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          name?: string
          notes?: string | null
          prescriber?: string | null
          product_id?: string | null
          start_date?: string | null
          status?: string
          strength?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_fulfillments: {
        Row: {
          accepted_at: string | null
          created_at: string
          customer_note: string | null
          id: string
          is_emergency: boolean
          items_subtotal: number
          order_id: string
          platform_amount: number
          prescription_id: string | null
          ready_at: string | null
          rejection_note: string | null
          rejection_reason: string | null
          seller_amount: number
          seller_id: string
          status: Database["public"]["Enums"]["fulfillment_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          customer_note?: string | null
          id?: string
          is_emergency?: boolean
          items_subtotal?: number
          order_id: string
          platform_amount?: number
          prescription_id?: string | null
          ready_at?: string | null
          rejection_note?: string | null
          rejection_reason?: string | null
          seller_amount?: number
          seller_id: string
          status?: Database["public"]["Enums"]["fulfillment_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          customer_note?: string | null
          id?: string
          is_emergency?: boolean
          items_subtotal?: number
          order_id?: string
          platform_amount?: number
          prescription_id?: string | null
          ready_at?: string | null
          rejection_note?: string | null
          rejection_reason?: string | null
          seller_amount?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["fulfillment_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fulfillments_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_fulfillments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          fulfillment_id: string | null
          id: string
          order_id: string
          platform_unit_amount: number
          prescription_required: boolean
          product_id: string | null
          product_image_path: string | null
          product_name: string
          quantity: number
          seller_id: string
          seller_unit_price: number
          store_id: string | null
          unit_price: number
          variant_label: string | null
        }
        Insert: {
          created_at?: string
          fulfillment_id?: string | null
          id?: string
          order_id: string
          platform_unit_amount?: number
          prescription_required?: boolean
          product_id?: string | null
          product_image_path?: string | null
          product_name: string
          quantity: number
          seller_id: string
          seller_unit_price?: number
          store_id?: string | null
          unit_price: number
          variant_label?: string | null
        }
        Update: {
          created_at?: string
          fulfillment_id?: string | null
          id?: string
          order_id?: string
          platform_unit_amount?: number
          prescription_required?: boolean
          product_id?: string | null
          product_image_path?: string | null
          product_name?: string
          quantity?: number
          seller_id?: string
          seller_unit_price?: number
          store_id?: string | null
          unit_price?: number
          variant_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_role: string | null
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          order_id: string
          previous_status: Database["public"]["Enums"]["order_status"] | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_role?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_role?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          order_id?: string
          previous_status?: Database["public"]["Enums"]["order_status"] | null
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_id: string | null
          address_snapshot: Json | null
          cancelled_reason: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          delivery_fee: number
          delivery_is_peak: boolean
          delivery_platform_amount: number
          delivery_rider_amount: number
          delivery_rule: string | null
          emergency_surcharge: number
          id: string
          is_emergency: boolean
          order_number: string
          payment_status: string
          platform_product_amount: number
          points_discount: number
          points_redeemed: number
          priority: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          address_id?: string | null
          address_snapshot?: Json | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          delivery_fee?: number
          delivery_is_peak?: boolean
          delivery_platform_amount?: number
          delivery_rider_amount?: number
          delivery_rule?: string | null
          emergency_surcharge?: number
          id?: string
          is_emergency?: boolean
          order_number?: string
          payment_status?: string
          platform_product_amount?: number
          points_discount?: number
          points_redeemed?: number
          priority?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          address_id?: string | null
          address_snapshot?: Json | null
          cancelled_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          delivery_fee?: number
          delivery_is_peak?: boolean
          delivery_platform_amount?: number
          delivery_rider_amount?: number
          delivery_rule?: string | null
          emergency_surcharge?: number
          id?: string
          is_emergency?: boolean
          order_number?: string
          payment_status?: string
          platform_product_amount?: number
          points_discount?: number
          points_redeemed?: number
          priority?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          order_id: string
          provider: string
          provider_reference: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          order_id: string
          provider?: string
          provider_reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          order_id?: string
          provider?: string
          provider_reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_events: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          note: string | null
          payout_id: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payout_id: string
          status: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payout_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_events_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payout_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          paid_at: string | null
          payout_account_id: string | null
          reference: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payout_account_id?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          paid_at?: string | null
          payout_account_id?: string | null
          reference?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_payout_account_id_fkey"
            columns: ["payout_account_id"]
            isOneToOne: false
            referencedRelation: "payout_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      prescription_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          note: string | null
          prescription_id: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          note?: string | null
          prescription_id: string
          status: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          note?: string | null
          prescription_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_events_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string | null
          file_path: string
          file_type: string | null
          fulfilled_at: string | null
          id: string
          order_id: string | null
          patient_note: string | null
          prescriber_contact: string | null
          prescriber_name: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string | null
          file_path: string
          file_type?: string | null
          fulfilled_at?: string | null
          id?: string
          order_id?: string | null
          patient_note?: string | null
          prescriber_contact?: string | null
          prescriber_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string | null
          file_path?: string
          file_type?: string | null
          fulfilled_at?: string | null
          id?: string
          order_id?: string | null
          patient_note?: string | null
          prescriber_contact?: string | null
          prescriber_name?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string
          id: string
          path: string
          position: number
          product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          position?: number
          product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active_ingredient: string | null
          brand: string | null
          brand_name: string | null
          category_id: string | null
          created_at: string
          description: string | null
          dimensions: string | null
          dosage_form: string | null
          emergency_eligible: boolean
          generic_name: string | null
          id: string
          image_path: string | null
          instructions: string | null
          is_medication: boolean
          low_stock_threshold: number
          manufacturer: string | null
          min_age: number | null
          nafdac_number: string | null
          name: string
          pack_size: string | null
          platform_markup_percent: number
          prescription_required: boolean
          price: number
          reserved_quantity: number
          seller_id: string
          seller_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          storage_requirements: string | null
          store_id: string
          strength: string | null
          tags: string[]
          updated_at: string
          variant_label: string | null
          warnings: string | null
          weight_grams: number | null
        }
        Insert: {
          active_ingredient?: string | null
          brand?: string | null
          brand_name?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          dosage_form?: string | null
          emergency_eligible?: boolean
          generic_name?: string | null
          id?: string
          image_path?: string | null
          instructions?: string | null
          is_medication?: boolean
          low_stock_threshold?: number
          manufacturer?: string | null
          min_age?: number | null
          nafdac_number?: string | null
          name: string
          pack_size?: string | null
          platform_markup_percent?: number
          prescription_required?: boolean
          price: number
          reserved_quantity?: number
          seller_id: string
          seller_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          storage_requirements?: string | null
          store_id: string
          strength?: string | null
          tags?: string[]
          updated_at?: string
          variant_label?: string | null
          warnings?: string | null
          weight_grams?: number | null
        }
        Update: {
          active_ingredient?: string | null
          brand?: string | null
          brand_name?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          dimensions?: string | null
          dosage_form?: string | null
          emergency_eligible?: boolean
          generic_name?: string | null
          id?: string
          image_path?: string | null
          instructions?: string | null
          is_medication?: boolean
          low_stock_threshold?: number
          manufacturer?: string | null
          min_age?: number | null
          nafdac_number?: string | null
          name?: string
          pack_size?: string | null
          platform_markup_percent?: number
          prescription_required?: boolean
          price?: number
          reserved_quantity?: number
          seller_id?: string
          seller_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          storage_requirements?: string | null
          store_id?: string
          strength?: string | null
          tags?: string[]
          updated_at?: string
          variant_label?: string | null
          warnings?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_availability: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          is_booked: boolean
          mode: string
          professional_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          is_booked?: boolean
          mode?: string
          professional_id: string
          starts_at: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          is_booked?: boolean
          mode?: string
          professional_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "health_professionals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      refund_events: {
        Row: {
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          note: string | null
          refund_id: string
          status: string
        }
        Insert: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          note?: string | null
          refund_id: string
          status: string
        }
        Update: {
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          note?: string | null
          refund_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_events_refund_id_fkey"
            columns: ["refund_id"]
            isOneToOne: false
            referencedRelation: "refund_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_requests: {
        Row: {
          amount_approved: number | null
          amount_requested: number
          created_at: string
          customer_id: string
          decision_note: string | null
          destination: string
          details: string | null
          evidence_paths: string[]
          fulfillment_id: string | null
          id: string
          item_ids: string[]
          order_id: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          scope: string
          seller_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_approved?: number | null
          amount_requested: number
          created_at?: string
          customer_id: string
          decision_note?: string | null
          destination?: string
          details?: string | null
          evidence_paths?: string[]
          fulfillment_id?: string | null
          id?: string
          item_ids?: string[]
          order_id: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          seller_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_approved?: number | null
          amount_requested?: number
          created_at?: string
          customer_id?: string
          decision_note?: string | null
          destination?: string
          details?: string | null
          evidence_paths?: string[]
          fulfillment_id?: string | null
          id?: string
          item_ids?: string[]
          order_id?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          scope?: string
          seller_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_requests_fulfillment_id_fkey"
            columns: ["fulfillment_id"]
            isOneToOne: false
            referencedRelation: "order_fulfillments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolution_note: string | null
          resolved_by: string | null
          review_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolution_note?: string | null
          resolved_by?: string | null
          review_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_note?: string | null
          resolved_by?: string | null
          review_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_reports_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string | null
          product_id: string
          rating: number
          responded_at: string | null
          seller_response: string | null
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
          responded_at?: string | null
          seller_response?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
          responded_at?: string | null
          seller_response?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_applications: {
        Row: {
          city: string
          created_at: string
          document_paths: string[]
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          has_smartphone: boolean
          id: string
          phone: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
          vehicle_plate: string | null
          vehicle_type: string
        }
        Insert: {
          city: string
          created_at?: string
          document_paths?: string[]
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          has_smartphone?: boolean
          id?: string
          phone: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
          vehicle_type: string
        }
        Update: {
          city?: string
          created_at?: string
          document_paths?: string[]
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          has_smartphone?: boolean
          id?: string
          phone?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      rider_locations: {
        Row: {
          accuracy: number | null
          delivery_id: string | null
          id: string
          latitude: number
          longitude: number
          recorded_at: string
          rider_id: string
          speed_kmh: number | null
        }
        Insert: {
          accuracy?: number | null
          delivery_id?: string | null
          id?: string
          latitude: number
          longitude: number
          recorded_at?: string
          rider_id: string
          speed_kmh?: number | null
        }
        Update: {
          accuracy?: number | null
          delivery_id?: string | null
          id?: string
          latitude?: number
          longitude?: number
          recorded_at?: string
          rider_id?: string
          speed_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rider_locations_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      rider_profiles: {
        Row: {
          active_assignments: number
          break_until: string | null
          created_at: string
          is_available: boolean
          is_online: boolean
          is_suspended: boolean
          latitude: number | null
          location_accuracy: number | null
          location_updated_at: string | null
          longitude: number | null
          max_assignments: number
          service_city: string | null
          service_state: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_capacity: number | null
          vehicle_plate: string | null
          vehicle_type: string | null
          vehicle_verified_at: string | null
        }
        Insert: {
          active_assignments?: number
          break_until?: string | null
          created_at?: string
          is_available?: boolean
          is_online?: boolean
          is_suspended?: boolean
          latitude?: number | null
          location_accuracy?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          max_assignments?: number
          service_city?: string | null
          service_state?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_capacity?: number | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
          vehicle_verified_at?: string | null
        }
        Update: {
          active_assignments?: number
          break_until?: string | null
          created_at?: string
          is_available?: boolean
          is_online?: boolean
          is_suspended?: boolean
          latitude?: number | null
          location_accuracy?: number | null
          location_updated_at?: string | null
          longitude?: number | null
          max_assignments?: number
          service_city?: string | null
          service_state?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_capacity?: number | null
          vehicle_plate?: string | null
          vehicle_type?: string | null
          vehicle_verified_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      seller_applications: {
        Row: {
          address: string | null
          business_reg_number: string | null
          category_id: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          document_paths: string[]
          id: string
          logo_path: string | null
          operating_hours: Json | null
          pharmacy_license_expiry: string | null
          pharmacy_license_number: string | null
          pharmacy_name: string | null
          responsible_pharmacist_license: string | null
          responsible_pharmacist_name: string | null
          responsible_pharmacist_phone: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          store_id: string | null
          store_name: string
          store_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          business_reg_number?: string | null
          category_id?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          document_paths?: string[]
          id?: string
          logo_path?: string | null
          operating_hours?: Json | null
          pharmacy_license_expiry?: string | null
          pharmacy_license_number?: string | null
          pharmacy_name?: string | null
          responsible_pharmacist_license?: string | null
          responsible_pharmacist_name?: string | null
          responsible_pharmacist_phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_id?: string | null
          store_name: string
          store_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          business_reg_number?: string | null
          category_id?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          document_paths?: string[]
          id?: string
          logo_path?: string | null
          operating_hours?: Json | null
          pharmacy_license_expiry?: string | null
          pharmacy_license_number?: string | null
          pharmacy_name?: string | null
          responsible_pharmacist_license?: string | null
          responsible_pharmacist_name?: string | null
          responsible_pharmacist_phone?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_id?: string | null
          store_name?: string
          store_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_applications_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_applications_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          delivery_id: string | null
          id: string
          kind: string
          latitude: number | null
          longitude: number | null
          note: string | null
          rider_id: string
          status: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          kind: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          rider_id: string
          status?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          kind?: string
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          rider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_incidents_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accepts_emergency_orders: boolean
          address: string | null
          area: string | null
          category_id: string | null
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country: string
          cover_url: string | null
          created_at: string
          description: string | null
          expiry_alert_days: number
          id: string
          is_accepting_orders: boolean
          is_open: boolean
          latitude: number | null
          location_source: string | null
          location_verified_at: string | null
          logo_url: string | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          operating_hours: Json | null
          owner_id: string
          pending_changes: Json | null
          pharmacy_license_expiry: string | null
          pharmacy_license_number: string | null
          pickup_notes: string | null
          place_id: string | null
          postal_code: string | null
          rating_average: number | null
          responsible_pharmacist_license: string | null
          responsible_pharmacist_name: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["store_status"]
          store_type: string
          updated_at: string
          verification_note: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          accepts_emergency_orders?: boolean
          address?: string | null
          area?: string | null
          category_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          expiry_alert_days?: number
          id?: string
          is_accepting_orders?: boolean
          is_open?: boolean
          latitude?: number | null
          location_source?: string | null
          location_verified_at?: string | null
          logo_url?: string | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          operating_hours?: Json | null
          owner_id: string
          pending_changes?: Json | null
          pharmacy_license_expiry?: string | null
          pharmacy_license_number?: string | null
          pickup_notes?: string | null
          place_id?: string | null
          postal_code?: string | null
          rating_average?: number | null
          responsible_pharmacist_license?: string | null
          responsible_pharmacist_name?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          store_type?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          accepts_emergency_orders?: boolean
          address?: string | null
          area?: string | null
          category_id?: string | null
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          expiry_alert_days?: number
          id?: string
          is_accepting_orders?: boolean
          is_open?: boolean
          latitude?: number | null
          location_source?: string | null
          location_verified_at?: string | null
          logo_url?: string | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          operating_hours?: Json | null
          owner_id?: string
          pending_changes?: Json | null
          pharmacy_license_expiry?: string | null
          pharmacy_license_number?: string | null
          pickup_notes?: string | null
          place_id?: string | null
          postal_code?: string | null
          rating_average?: number | null
          responsible_pharmacist_license?: string | null
          responsible_pharmacist_name?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["store_status"]
          store_type?: string
          updated_at?: string
          verification_note?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          sender_id: string | null
          sender_role: string | null
          ticket_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string | null
          ticket_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          sender_id?: string | null
          sender_role?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: string
          contact_email: string | null
          contact_name: string | null
          created_at: string
          id: string
          order_id: string | null
          requester_role: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          requester_role?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          requester_role?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      telehealth_services: {
        Row: {
          duration_minutes: number
          id: string
          is_active: boolean
          key: string
          label: string
          mode: string
          platform_percent: number
          price: number
          professional_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          duration_minutes?: number
          id?: string
          is_active?: boolean
          key: string
          label: string
          mode: string
          platform_percent?: number
          price: number
          professional_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          duration_minutes?: number
          id?: string
          is_active?: boolean
          key?: string
          label?: string
          mode?: string
          platform_percent?: number
          price?: number
          professional_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vitals: {
        Row: {
          created_at: string
          id: string
          kind: string
          measured_at: string
          note: string | null
          unit: string
          user_id: string
          value_primary: number
          value_secondary: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          measured_at?: string
          note?: string | null
          unit: string
          user_id: string
          value_primary: number
          value_secondary?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          measured_at?: string
          note?: string | null
          unit?: string
          user_id?: string
          value_primary?: number
          value_secondary?: number | null
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          order_id: string | null
          points: number
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind: string
          order_id?: string | null
          points: number
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          order_id?: string | null
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          created_at: string
          id: string
          points_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_delivery_pricing: {
        Args: never
        Returns: {
          base_fee: number
          created_at: string
          created_by: string | null
          delivery_enabled: boolean
          effective_from: string
          effective_to: string | null
          emergency_fee: number
          id: string
          is_active: boolean
          label: string | null
          late_threshold_minutes: number
          location_min_interval_seconds: number
          location_retention_days: number
          max_fee: number | null
          max_offer_rounds: number
          min_fee: number
          offer_timeout_seconds: number
          peak_rider_percent: number
          peak_surcharge_percent: number
          per_km_fee: number
          priority_enabled: boolean
          priority_fee: number
          quote_ttl_seconds: number
          regular_rider_percent: number
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "delivery_pricing_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adherence_summary: {
        Args: { _owner_id?: string }
        Returns: {
          missed: number
          pending: number
          skipped: number
          taken: number
          window_label: string
        }[]
      }
      admin_review_application: {
        Args: {
          _application_id: string
          _decision: string
          _kind: string
          _note: string
        }
        Returns: undefined
      }
      admin_review_payout: {
        Args: {
          _note: string
          _payout_id: string
          _reference?: string
          _status: string
        }
        Returns: undefined
      }
      admin_review_professional: {
        Args: { _decision: string; _note?: string; _professional_id: string }
        Returns: undefined
      }
      admin_review_refund: {
        Args: {
          _amount: number
          _destination?: string
          _note: string
          _refund_id: string
          _status: string
        }
        Returns: undefined
      }
      admin_set_store_verification: {
        Args: { _note?: string; _status: string; _store_id: string }
        Returns: undefined
      }
      book_consultation: {
        Args: {
          _availability_id?: string
          _note?: string
          _professional_id: string
          _scheduled_at?: string
          _service_id: string
        }
        Returns: Json
      }
      cart_prescription_status: {
        Args: never
        Returns: {
          expires_at: string
          prescription_id: string
          prescription_status: string
          requires_prescription: boolean
          store_id: string
          store_name: string
        }[]
      }
      confirm_consultation_payment: {
        Args: {
          _consultation_id: string
          _provider: string
          _reference: string
        }
        Returns: undefined
      }
      confirm_order_payment: {
        Args: { _order_id: string; _provider: string; _reference: string }
        Returns: undefined
      }
      create_delivery_quote: {
        Args: {
          _address_id: string
          _distance_meters?: number
          _duration_seconds?: number
          _is_emergency?: boolean
          _priority?: boolean
          _provider?: string
          _store_id: string
        }
        Returns: Json
      }
      current_actor_role: { Args: never; Returns: string }
      customer_request_refund: {
        Args: {
          _amount: number
          _details: string
          _evidence: string[]
          _item_ids: string[]
          _order_id: string
          _reason: string
        }
        Returns: string
      }
      effective_commission_percent: {
        Args: { _category_id: string; _seller_id: string }
        Returns: number
      }
      emergency_eligibility: { Args: { _product_id: string }; Returns: Json }
      fail_order_payment: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      find_delivery_zone: {
        Args: { _city?: string; _lat: number; _lng: number; _state?: string }
        Returns: {
          base_fee: number
          center_latitude: number | null
          center_longitude: number | null
          city: string | null
          country: string
          created_at: string
          id: string
          is_active: boolean
          min_fee: number
          name: string
          peak_multiplier: number
          per_km_fee: number
          polygon: Json | null
          radius_km: number | null
          state: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "delivery_zones"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      flag_expiring_batches: { Args: never; Returns: number }
      flag_late_deliveries: { Args: never; Returns: number }
      geo_distance_km: {
        Args: { _lat1: number; _lat2: number; _lng1: number; _lng2: number }
        Returns: number
      }
      get_delivery_code: { Args: { _order_id: string }; Returns: string }
      get_pickup_code: { Args: { _order_id: string }; Returns: string }
      has_health_access: {
        Args: { _owner_id: string; _permission: string }
        Returns: boolean
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_peak_now: { Args: never; Returns: boolean }
      is_pharmacy_owner: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_audit: {
        Args: {
          _action: string
          _entity: string
          _entity_id: string
          _new?: Json
          _previous?: Json
          _reason?: string
        }
        Returns: undefined
      }
      log_dose: {
        Args: {
          _medication_id: string
          _note?: string
          _reminder_id?: string
          _scheduled_for: string
          _status: string
        }
        Returns: string
      }
      log_order_status: {
        Args: {
          _new: Database["public"]["Enums"]["order_status"]
          _note: string
          _order_id: string
        }
        Returns: undefined
      }
      my_balance: {
        Args: never
        Returns: {
          available: number
          lifetime: number
          paid_out: number
          pending: number
          requested: number
        }[]
      }
      notify_staff: {
        Args: { _body: string; _link: string; _title: string }
        Returns: undefined
      }
      peak_state: { Args: never; Returns: Json }
      pharmacy_review_prescription: {
        Args: {
          _decision: string
          _expires_at?: string
          _note?: string
          _prescription_id: string
        }
        Returns: undefined
      }
      place_order: {
        Args: {
          _address_id: string
          _customer_note?: string
          _is_emergency?: boolean
          _points_to_redeem?: number
        }
        Returns: Json
      }
      purge_rider_locations: { Args: never; Returns: number }
      quote_delivery_fee: { Args: { _city: string }; Returns: Json }
      raise_sos: {
        Args: {
          _delivery_id: string
          _kind: string
          _lat?: number
          _lng?: number
          _note: string
        }
        Returns: string
      }
      request_payout: {
        Args: { _account_id: string; _amount: number }
        Returns: string
      }
      rider_advance_delivery: {
        Args: { _delivery_id: string; _stage: string }
        Returns: undefined
      }
      rider_respond_to_offer: {
        Args: { _accept: boolean; _delivery_id: string }
        Returns: undefined
      }
      rider_share_location: {
        Args: {
          _accuracy?: number
          _delivery_id?: string
          _lat: number
          _lng: number
        }
        Returns: Json
      }
      rider_update_location: {
        Args: { _delivery_id: string; _lat: number; _lng: number }
        Returns: undefined
      }
      seller_adjust_stock: {
        Args: {
          _kind: string
          _new_stock: number
          _product_id: string
          _reason: string
        }
        Returns: undefined
      }
      seller_respond_to_order: {
        Args: {
          _accept: boolean
          _fulfillment_id: string
          _note?: string
          _reason?: string
        }
        Returns: undefined
      }
      seller_respond_to_review: {
        Args: { _response: string; _review_id: string }
        Returns: undefined
      }
      seller_set_fulfillment_status: {
        Args: {
          _fulfillment_id: string
          _status: Database["public"]["Enums"]["fulfillment_status"]
        }
        Returns: undefined
      }
      set_admin_permission: {
        Args: { _enabled: boolean; _permission: string; _user_id: string }
        Returns: undefined
      }
      set_admin_role: {
        Args: { _make_admin: boolean; _user_id: string }
        Returns: undefined
      }
      set_commission_rule: {
        Args: {
          _category_id?: string
          _percent: number
          _scope: string
          _seller_id?: string
        }
        Returns: string
      }
      set_consultation_status: {
        Args: { _consultation_id: string; _reason?: string; _status: string }
        Returns: undefined
      }
      set_feature_flag: {
        Args: { _enabled: boolean; _key: string }
        Returns: undefined
      }
      set_rider_status: {
        Args: { _available: boolean; _online: boolean }
        Returns: undefined
      }
      set_telehealth_price: {
        Args: {
          _is_active?: boolean
          _platform_percent?: number
          _price: number
          _service_id: string
        }
        Returns: undefined
      }
      sync_expired_stock: { Args: never; Returns: number }
      upload_prescription: {
        Args: {
          _file_path: string
          _file_type: string
          _note?: string
          _prescriber_contact?: string
          _prescriber_name?: string
          _store_id: string
        }
        Returns: string
      }
      verify_delivery: {
        Args: { _code: string; _delivery_id: string }
        Returns: undefined
      }
      verify_pickup: {
        Args: { _code: string; _delivery_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role:
        | "customer"
        | "seller"
        | "rider"
        | "admin"
        | "super_admin"
        | "health_professional"
      application_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "approved"
        | "rejected"
      fulfillment_status:
        | "pending"
        | "seller_reviewing"
        | "accepted"
        | "rejected"
        | "preparing"
        | "ready_for_pickup"
        | "picked_up"
        | "delivered"
        | "completed"
        | "cancelled"
      ledger_kind:
        | "seller_product_earning"
        | "platform_product_commission"
        | "rider_delivery_earning"
        | "platform_delivery_share"
        | "refund"
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "ready_for_pickup"
        | "in_transit"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "confirmed"
        | "seller_reviewing"
        | "accepted_by_seller"
        | "rider_assignment"
        | "rider_assigned"
        | "rider_en_route_to_seller"
        | "rider_arrived_at_seller"
        | "picked_up"
        | "out_for_delivery"
        | "rider_arrived_at_customer"
        | "delivery_verification"
        | "completed"
        | "seller_rejected"
        | "payment_failed"
        | "refund_pending"
        | "delivery_failed"
        | "disputed"
      payout_status: "pending" | "available" | "paid" | "withheld"
      product_status: "draft" | "active" | "out_of_stock" | "archived"
      store_status: "pending" | "approved" | "suspended"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "customer",
        "seller",
        "rider",
        "admin",
        "super_admin",
        "health_professional",
      ],
      application_status: [
        "draft",
        "submitted",
        "under_review",
        "approved",
        "rejected",
      ],
      fulfillment_status: [
        "pending",
        "seller_reviewing",
        "accepted",
        "rejected",
        "preparing",
        "ready_for_pickup",
        "picked_up",
        "delivered",
        "completed",
        "cancelled",
      ],
      ledger_kind: [
        "seller_product_earning",
        "platform_product_commission",
        "rider_delivery_earning",
        "platform_delivery_share",
        "refund",
      ],
      order_status: [
        "pending_payment",
        "paid",
        "preparing",
        "ready_for_pickup",
        "in_transit",
        "delivered",
        "cancelled",
        "refunded",
        "confirmed",
        "seller_reviewing",
        "accepted_by_seller",
        "rider_assignment",
        "rider_assigned",
        "rider_en_route_to_seller",
        "rider_arrived_at_seller",
        "picked_up",
        "out_for_delivery",
        "rider_arrived_at_customer",
        "delivery_verification",
        "completed",
        "seller_rejected",
        "payment_failed",
        "refund_pending",
        "delivery_failed",
        "disputed",
      ],
      payout_status: ["pending", "available", "paid", "withheld"],
      product_status: ["draft", "active", "out_of_stock", "archived"],
      store_status: ["pending", "approved", "suspended"],
    },
  },
} as const
