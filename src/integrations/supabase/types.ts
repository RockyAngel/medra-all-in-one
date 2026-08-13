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
          city: string | null
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          line1: string
          line2: string | null
          phone: string | null
          recipient_name: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1: string
          line2?: string | null
          phone?: string | null
          recipient_name?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          line1?: string
          line2?: string | null
          phone?: string | null
          recipient_name?: string | null
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
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
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          assigned_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_code: string | null
          delivery_verified_at: string | null
          expected_delivery_at: string | null
          fee_total: number
          id: string
          is_peak: boolean
          late_alert_sent_at: string | null
          location_updated_at: string | null
          order_id: string
          picked_up_at: string | null
          pickup_code: string | null
          pickup_verified_at: string | null
          platform_amount: number
          rider_amount: number
          rider_id: string | null
          rider_latitude: number | null
          rider_longitude: number | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_verified_at?: string | null
          expected_delivery_at?: string | null
          fee_total?: number
          id?: string
          is_peak?: boolean
          late_alert_sent_at?: string | null
          location_updated_at?: string | null
          order_id: string
          picked_up_at?: string | null
          pickup_code?: string | null
          pickup_verified_at?: string | null
          platform_amount?: number
          rider_amount?: number
          rider_id?: string | null
          rider_latitude?: number | null
          rider_longitude?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_code?: string | null
          delivery_verified_at?: string | null
          expected_delivery_at?: string | null
          fee_total?: number
          id?: string
          is_peak?: boolean
          late_alert_sent_at?: string | null
          location_updated_at?: string | null
          order_id?: string
          picked_up_at?: string | null
          pickup_code?: string | null
          pickup_verified_at?: string | null
          platform_amount?: number
          rider_amount?: number
          rider_id?: string | null
          rider_latitude?: number | null
          rider_longitude?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_offers: {
        Row: {
          created_at: string
          delivery_id: string
          id: string
          responded_at: string | null
          rider_id: string
          status: string
        }
        Insert: {
          created_at?: string
          delivery_id: string
          id?: string
          responded_at?: string | null
          rider_id: string
          status?: string
        }
        Update: {
          created_at?: string
          delivery_id?: string
          id?: string
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
      delivery_zones: {
        Row: {
          base_fee: number
          city: string | null
          created_at: string
          id: string
          is_active: boolean
          min_fee: number
          name: string
          peak_multiplier: number
          per_km_fee: number
          updated_at: string
        }
        Insert: {
          base_fee: number
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_fee?: number
          name: string
          peak_multiplier?: number
          per_km_fee?: number
          updated_at?: string
        }
        Update: {
          base_fee?: number
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          min_fee?: number
          name?: string
          peak_multiplier?: number
          per_km_fee?: number
          updated_at?: string
        }
        Relationships: []
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
          id: string
          items_subtotal: number
          order_id: string
          platform_amount: number
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
          id?: string
          items_subtotal?: number
          order_id: string
          platform_amount?: number
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
          id?: string
          items_subtotal?: number
          order_id?: string
          platform_amount?: number
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
          id: string
          order_number: string
          payment_status: string
          platform_product_amount: number
          points_discount: number
          points_redeemed: number
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
          id?: string
          order_number?: string
          payment_status?: string
          platform_product_amount?: number
          points_discount?: number
          points_redeemed?: number
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
          id?: string
          order_number?: string
          payment_status?: string
          platform_product_amount?: number
          points_discount?: number
          points_redeemed?: number
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
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          name: string
          platform_markup_percent: number
          price: number
          seller_id: string
          seller_price: number | null
          sku: string | null
          status: Database["public"]["Enums"]["product_status"]
          stock_quantity: number
          store_id: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name: string
          platform_markup_percent?: number
          price: number
          seller_id: string
          seller_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          name?: string
          platform_markup_percent?: number
          price?: number
          seller_id?: string
          seller_price?: number | null
          sku?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          stock_quantity?: number
          store_id?: string
          updated_at?: string
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
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          order_id: string | null
          product_id: string
          rating: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          order_id?: string | null
          product_id: string
          rating: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          order_id?: string | null
          product_id?: string
          rating?: number
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
      rider_profiles: {
        Row: {
          active_assignments: number
          created_at: string
          is_available: boolean
          is_online: boolean
          max_assignments: number
          service_city: string | null
          updated_at: string
          user_id: string
          vehicle_type: string | null
        }
        Insert: {
          active_assignments?: number
          created_at?: string
          is_available?: boolean
          is_online?: boolean
          max_assignments?: number
          service_city?: string | null
          updated_at?: string
          user_id: string
          vehicle_type?: string | null
        }
        Update: {
          active_assignments?: number
          created_at?: string
          is_available?: boolean
          is_online?: boolean
          max_assignments?: number
          service_city?: string | null
          updated_at?: string
          user_id?: string
          vehicle_type?: string | null
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
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["application_status"]
          store_id: string | null
          store_name: string
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
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_id?: string | null
          store_name: string
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
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          store_id?: string | null
          store_name?: string
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
          category_id: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          rating_average: number | null
          slug: string
          status: Database["public"]["Enums"]["store_status"]
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          rating_average?: number | null
          slug: string
          status?: Database["public"]["Enums"]["store_status"]
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          rating_average?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["store_status"]
          updated_at?: string
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
      confirm_order_payment: {
        Args: { _order_id: string; _provider: string; _reference: string }
        Returns: undefined
      }
      current_actor_role: { Args: never; Returns: string }
      fail_order_payment: {
        Args: { _order_id: string; _reason: string }
        Returns: undefined
      }
      flag_late_deliveries: { Args: never; Returns: number }
      get_delivery_code: { Args: { _order_id: string }; Returns: string }
      get_pickup_code: { Args: { _order_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_peak_now: { Args: never; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      log_order_status: {
        Args: {
          _new: Database["public"]["Enums"]["order_status"]
          _note: string
          _order_id: string
        }
        Returns: undefined
      }
      notify_staff: {
        Args: { _body: string; _link: string; _title: string }
        Returns: undefined
      }
      place_order: {
        Args: { _address_id: string; _points_to_redeem?: number }
        Returns: Json
      }
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
      rider_advance_delivery: {
        Args: { _delivery_id: string; _stage: string }
        Returns: undefined
      }
      rider_respond_to_offer: {
        Args: { _accept: boolean; _delivery_id: string }
        Returns: undefined
      }
      rider_update_location: {
        Args: { _delivery_id: string; _lat: number; _lng: number }
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
      seller_set_fulfillment_status: {
        Args: {
          _fulfillment_id: string
          _status: Database["public"]["Enums"]["fulfillment_status"]
        }
        Returns: undefined
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
      app_role: "customer" | "seller" | "rider" | "admin" | "super_admin"
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
      app_role: ["customer", "seller", "rider", "admin", "super_admin"],
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
