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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          counters_count: number | null
          created_at: string
          establishment_id: string
          id: string
          password_panel_enabled: boolean | null
          password_prefix: string | null
          settings: Json | null
          totem_enabled: boolean | null
          updated_at: string
        }
        Insert: {
          counters_count?: number | null
          created_at?: string
          establishment_id: string
          id?: string
          password_panel_enabled?: boolean | null
          password_prefix?: string | null
          settings?: Json | null
          totem_enabled?: boolean | null
          updated_at?: string
        }
        Update: {
          counters_count?: number | null
          created_at?: string
          establishment_id?: string
          id?: string
          password_panel_enabled?: boolean | null
          password_prefix?: string | null
          settings?: Json | null
          totem_enabled?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: true
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          establishment_id: string
          id: string
          new_values: Json | null
          old_values: Json | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          establishment_id: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          establishment_id?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      card_brands: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_brands_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_amount: number | null
          created_at: string
          difference_amount: number | null
          establishment_id: string
          expected_amount: number | null
          id: string
          is_admin_session: boolean
          notes: string | null
          opened_at: string
          opened_by: string
          opening_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string
          difference_amount?: number | null
          establishment_id: string
          expected_amount?: number | null
          id?: string
          is_admin_session?: boolean
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_amount?: number | null
          created_at?: string
          difference_amount?: number | null
          establishment_id?: string
          expected_amount?: number | null
          id?: string
          is_admin_session?: boolean
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          image_url: string | null
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          image_url?: string | null
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          image_url?: string | null
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_items: {
        Row: {
          combo_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          establishment_id: string
          id: string
          image_url: string | null
          name: string
          price: number
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          establishment_id: string
          id?: string
          image_url?: string | null
          name: string
          price: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          establishment_id?: string
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          description: string | null
          establishment_id: string
          id: string
          max_uses: number | null
          type: string
          updated_at: string | null
          uses_count: number | null
          valid_from: string
          valid_until: string
          value: number
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          description?: string | null
          establishment_id: string
          id?: string
          max_uses?: number | null
          type: string
          updated_at?: string | null
          uses_count?: number | null
          valid_from: string
          valid_until: string
          value: number
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          description?: string | null
          establishment_id?: string
          id?: string
          max_uses?: number | null
          type?: string
          updated_at?: string | null
          uses_count?: number | null
          valid_from?: string
          valid_until?: string
          value?: number
        }
        Relationships: []
      }
      customer_group_members: {
        Row: {
          created_at: string
          customer_id: string
          group_id: string
          id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          group_id: string
          id?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          group_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_group_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_groups: {
        Row: {
          active: boolean | null
          created_at: string
          description: string | null
          discount_percentage: number | null
          establishment_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          establishment_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          description?: string | null
          discount_percentage?: number | null
          establishment_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean | null
          address: string | null
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      establishments: {
        Row: {
          address: string | null
          admin_password_hash: string | null
          api_key: string | null
          created_at: string
          daily_goal: number | null
          email: string | null
          id: string
          monthly_goal: number | null
          name: string
          phone: string | null
          pix_bank_name: string | null
          pix_holder_name: string | null
          pix_key_locked: boolean | null
          pix_key_type: string | null
          pix_key_value: string | null
          settings: Json | null
          slug: string | null
          updated_at: string
          weekly_goal: number | null
        }
        Insert: {
          address?: string | null
          admin_password_hash?: string | null
          api_key?: string | null
          created_at?: string
          daily_goal?: number | null
          email?: string | null
          id?: string
          monthly_goal?: number | null
          name: string
          phone?: string | null
          pix_bank_name?: string | null
          pix_holder_name?: string | null
          pix_key_locked?: boolean | null
          pix_key_type?: string | null
          pix_key_value?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string
          weekly_goal?: number | null
        }
        Update: {
          address?: string | null
          admin_password_hash?: string | null
          api_key?: string | null
          created_at?: string
          daily_goal?: number | null
          email?: string | null
          id?: string
          monthly_goal?: number | null
          name?: string
          phone?: string | null
          pix_bank_name?: string | null
          pix_holder_name?: string | null
          pix_key_locked?: boolean | null
          pix_key_type?: string | null
          pix_key_value?: string | null
          settings?: Json | null
          slug?: string | null
          updated_at?: string
          weekly_goal?: number | null
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          amount: number
          card_brand_id: string | null
          cash_session_id: string | null
          category: string
          created_at: string
          created_by: string
          description: string
          due_date: string
          establishment_id: string
          id: string
          notes: string | null
          order_id: string | null
          payment_date: string | null
          payment_method_id: string | null
          status: string
          supplier_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          card_brand_id?: string | null
          cash_session_id?: string | null
          category: string
          created_at?: string
          created_by: string
          description: string
          due_date: string
          establishment_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          status?: string
          supplier_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          card_brand_id?: string | null
          cash_session_id?: string | null
          category?: string
          created_at?: string
          created_by?: string
          description?: string
          due_date?: string
          establishment_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_date?: string | null
          payment_method_id?: string | null
          status?: string
          supplier_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_card_brand_id_fkey"
            columns: ["card_brand_id"]
            isOneToOne: false
            referencedRelation: "card_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          active: boolean | null
          amount: number
          created_at: string
          establishment_id: string
          id: string
          name: string
          recurrence: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          amount: number
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          recurrence?: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          amount?: number
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          recurrence?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          establishment_id: string
          id: string
          key: string
          order_id: string | null
        }
        Insert: {
          created_at?: string | null
          establishment_id: string
          id?: string
          key: string
          order_id?: string | null
        }
        Update: {
          created_at?: string | null
          establishment_id?: string
          id?: string
          key?: string
          order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "idempotency_keys_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      ingredients: {
        Row: {
          active: boolean | null
          cost: number
          created_at: string
          establishment_id: string
          id: string
          name: string
          purchase_unit_measure: string | null
          quantity: number
          quantity_purchased: number | null
          total_cost: number | null
          unit_cost: number | null
          unit_measure: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          cost?: number
          created_at?: string
          establishment_id: string
          id?: string
          name: string
          purchase_unit_measure?: string | null
          quantity?: number
          quantity_purchased?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_measure: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          cost?: number
          created_at?: string
          establishment_id?: string
          id?: string
          name?: string
          purchase_unit_measure?: string | null
          quantity?: number
          quantity_purchased?: number | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_measure?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingredients_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          complements: Json | null
          created_at: string
          customizations: Json | null
          id: string
          notes: string | null
          order_id: string
          original_price: number | null
          product_id: string
          promotion_id: string | null
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          complements?: Json | null
          created_at?: string
          customizations?: Json | null
          id?: string
          notes?: string | null
          order_id: string
          original_price?: number | null
          product_id: string
          promotion_id?: string | null
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          complements?: Json | null
          created_at?: string
          customizations?: Json | null
          id?: string
          notes?: string | null
          order_id?: string
          original_price?: number | null
          product_id?: string
          promotion_id?: string | null
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
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
            foreignKeyName: "order_items_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string | null
          coupon_discount: number | null
          coupon_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_fee: number | null
          discount_amount: number | null
          establishment_id: string
          external_id: string | null
          id: string
          notes: string | null
          order_number: string
          order_type: string
          origin: string | null
          payment_method: string | null
          payment_status: string | null
          source_domain: string | null
          status: string
          subtotal: number
          table_number: string | null
          tax_amount: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          channel?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          discount_amount?: number | null
          establishment_id: string
          external_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          order_type?: string
          origin?: string | null
          payment_method?: string | null
          payment_status?: string | null
          source_domain?: string | null
          status?: string
          subtotal?: number
          table_number?: string | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          channel?: string | null
          coupon_discount?: number | null
          coupon_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_fee?: number | null
          discount_amount?: number | null
          establishment_id?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          order_type?: string
          origin?: string | null
          payment_method?: string | null
          payment_status?: string | null
          source_domain?: string | null
          status?: string
          subtotal?: number
          table_number?: string | null
          tax_amount?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      password_queue: {
        Row: {
          called_at: string | null
          cancelled_at: string | null
          completed_at: string | null
          counter_number: string | null
          created_at: string
          customer_name: string | null
          establishment_id: string
          id: string
          password_number: number
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          called_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          counter_number?: string | null
          created_at?: string
          customer_name?: string | null
          establishment_id: string
          id?: string
          password_number: number
          service_type?: string
          status?: string
          updated_at?: string
        }
        Update: {
          called_at?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          counter_number?: string | null
          created_at?: string
          customer_name?: string | null
          establishment_id?: string
          id?: string
          password_number?: number
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_queue_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          establishment_id: string
          id: string
          is_active: boolean
          name: string
          requires_card_brand: boolean
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          establishment_id: string
          id?: string
          is_active?: boolean
          name: string
          requires_card_brand?: boolean
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          establishment_id?: string
          id?: string
          is_active?: boolean
          name?: string
          requires_card_brand?: boolean
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_key_audit: {
        Row: {
          changed_at: string
          changed_by: string
          establishment_id: string
          id: string
          ip_address: string | null
          new_pix_key: string
          new_pix_key_type: string
          old_pix_key: string | null
          old_pix_key_type: string | null
          reason: string | null
          user_agent: string | null
        }
        Insert: {
          changed_at?: string
          changed_by: string
          establishment_id: string
          id?: string
          ip_address?: string | null
          new_pix_key: string
          new_pix_key_type: string
          old_pix_key?: string | null
          old_pix_key_type?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string
          establishment_id?: string
          id?: string
          ip_address?: string | null
          new_pix_key?: string
          new_pix_key_type?: string
          old_pix_key?: string | null
          old_pix_key_type?: string | null
          reason?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pix_key_audit_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      pix_payments: {
        Row: {
          amount: number
          created_at: string
          establishment_id: string
          expires_at: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          payer_document: string | null
          payer_name: string | null
          payment_id: string | null
          qr_code: string | null
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          establishment_id: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payer_document?: string | null
          payer_name?: string | null
          payment_id?: string | null
          qr_code?: string | null
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          establishment_id?: string
          expires_at?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          payer_document?: string | null
          payer_name?: string | null
          payment_id?: string | null
          qr_code?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_payments_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pix_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      printer_routing: {
        Row: {
          category_id: string | null
          created_at: string
          establishment_id: string
          id: string
          printer_id: string
          product_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          establishment_id: string
          id?: string
          printer_id: string
          product_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          establishment_id?: string
          id?: string
          printer_id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "printer_routing_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_printer_id_fkey"
            columns: ["printer_id"]
            isOneToOne: false
            referencedRelation: "printers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "printer_routing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      printers: {
        Row: {
          active: boolean | null
          bluetooth_address: string | null
          created_at: string
          establishment_id: string
          font_family: string | null
          font_size: number | null
          id: string
          ip_address: string | null
          location: string | null
          name: string
          paper_width: number | null
          port: number | null
          print_all: boolean | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          bluetooth_address?: string | null
          created_at?: string
          establishment_id: string
          font_family?: string | null
          font_size?: number | null
          id?: string
          ip_address?: string | null
          location?: string | null
          name: string
          paper_width?: number | null
          port?: number | null
          print_all?: boolean | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          bluetooth_address?: string | null
          created_at?: string
          establishment_id?: string
          font_family?: string | null
          font_size?: number | null
          id?: string
          ip_address?: string | null
          location?: string | null
          name?: string
          paper_width?: number | null
          port?: number | null
          print_all?: boolean | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "printers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complement_links: {
        Row: {
          complement_id: string
          created_at: string | null
          id: string
          product_id: string
        }
        Insert: {
          complement_id: string
          created_at?: string | null
          id?: string
          product_id: string
        }
        Update: {
          complement_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_complement_links_complement_id_fkey"
            columns: ["complement_id"]
            isOneToOne: false
            referencedRelation: "product_complements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complement_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complements: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          establishment_id: string
          id: string
          name: string
          price: number
          required: boolean | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          establishment_id: string
          id?: string
          name: string
          price: number
          required?: boolean | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          establishment_id?: string
          id?: string
          name?: string
          price?: number
          required?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_ingredients: {
        Row: {
          created_at: string
          id: string
          ingredient_id: string
          product_id: string
          quantity_used: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          ingredient_id: string
          product_id: string
          quantity_used?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          ingredient_id?: string
          product_id?: string
          quantity_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category_id: string | null
          created_at: string
          description: string | null
          establishment_id: string
          id: string
          image_url: string | null
          ingredients: Json | null
          is_combo: boolean | null
          name: string
          price: number
          profit_margin: number | null
          sku: string | null
          sort_order: number | null
          suggested_price: number | null
          tags: Json | null
          updated_at: string
          variable_cost: number | null
        }
        Insert: {
          active?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          establishment_id: string
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          is_combo?: boolean | null
          name: string
          price?: number
          profit_margin?: number | null
          sku?: string | null
          sort_order?: number | null
          suggested_price?: number | null
          tags?: Json | null
          updated_at?: string
          variable_cost?: number | null
        }
        Update: {
          active?: boolean | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          establishment_id?: string
          id?: string
          image_url?: string | null
          ingredients?: Json | null
          is_combo?: boolean | null
          name?: string
          price?: number
          profit_margin?: number | null
          sku?: string | null
          sort_order?: number | null
          suggested_price?: number | null
          tags?: Json | null
          updated_at?: string
          variable_cost?: number | null
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
            foreignKeyName: "products_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          establishment_id: string | null
          full_name: string | null
          id: string
          is_admin: boolean | null
          phone: string | null
          status: string | null
          trial_end_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          establishment_id?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          status?: string | null
          trial_end_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          establishment_id?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          phone?: string | null
          status?: string | null
          trial_end_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          active: boolean | null
          created_at: string | null
          description: string | null
          discount_type: string
          discount_value: number
          end_date: string
          end_time: string | null
          establishment_id: string
          id: string
          name: string
          start_date: string
          start_time: string | null
          target_id: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          discount_type: string
          discount_value: number
          end_date: string
          end_time?: string | null
          establishment_id: string
          id?: string
          name: string
          start_date: string
          start_time?: string | null
          target_id?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          description?: string | null
          discount_type?: string
          discount_value?: number
          end_date?: string
          end_time?: string | null
          establishment_id?: string
          id?: string
          name?: string
          start_date?: string
          start_time?: string | null
          target_id?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_order_items: {
        Row: {
          created_at: string
          id: string
          product_name: string
          quantity: number
          supplier_order_id: string
          supplier_product_id: string | null
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_name: string
          quantity: number
          supplier_order_id: string
          supplier_product_id?: string | null
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          product_name?: string
          quantity?: number
          supplier_order_id?: string
          supplier_product_id?: string | null
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplier_order_items_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "supplier_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_order_items_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_orders: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          delivery_status: string
          establishment_id: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          payment_date: string | null
          payment_due_date: string | null
          payment_method: string | null
          payment_status: string
          supplier_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          delivery_status?: string
          establishment_id: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          payment_date?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_status?: string
          supplier_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          delivery_status?: string
          establishment_id?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          payment_date?: string | null
          payment_due_date?: string | null
          payment_method?: string | null
          payment_status?: string
          supplier_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_orders_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_products: {
        Row: {
          active: boolean | null
          created_at: string
          delivery_days: number | null
          id: string
          ingredient_id: string | null
          min_order_quantity: number | null
          product_name: string
          supplier_id: string
          unit_measure: string
          unit_price: number
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          ingredient_id?: string | null
          min_order_quantity?: number | null
          product_name: string
          supplier_id: string
          unit_measure: string
          unit_price?: number
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          delivery_days?: number | null
          id?: string
          ingredient_id?: string | null
          min_order_quantity?: number | null
          product_name?: string
          supplier_id?: string
          unit_measure?: string
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_ingredient_id_fkey"
            columns: ["ingredient_id"]
            isOneToOne: false
            referencedRelation: "ingredients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean | null
          address: string | null
          cnpj: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          establishment_id: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          establishment_id: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          address?: string | null
          cnpj?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          establishment_id?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          message: string
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          message: string
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          message?: string
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          establishment_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          establishment_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          establishment_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_establishment_id_fkey"
            columns: ["establishment_id"]
            isOneToOne: false
            referencedRelation: "establishments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _establishment_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _establishment_id: string; _user_id: string }
        Returns: boolean
      }
      is_global_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operator" | "user"
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
      app_role: ["admin", "operator", "user"],
    },
  },
} as const
