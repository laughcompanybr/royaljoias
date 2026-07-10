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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          key: string
          stock_block_when_insufficient: boolean
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          key: string
          stock_block_when_insufficient?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          key?: string
          stock_block_when_insufficient?: boolean
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          actor: string | null
          changed_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Insert: {
          actor?: string | null
          changed_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          operation: string
          record_id: string
          table_name: string
        }
        Update: {
          actor?: string | null
          changed_at?: string
          id?: number
          new_data?: Json | null
          old_data?: Json | null
          operation?: string
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      client_attachments: {
        Row: {
          client_id: string
          company_id: string
          created_at: string
          filename: string | null
          id: string
          kind: string | null
          mime: string | null
          size: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          client_id: string
          company_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string | null
          mime?: string | null
          size?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          client_id?: string
          company_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string | null
          mime?: string | null
          size?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_attachments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          city: string | null
          company_id: string
          complement: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          district: string | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          number: string | null
          phone: string | null
          reference: string | null
          state: string | null
          street: string | null
          updated_at: string
          whatsapp: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          company_id?: string
          complement?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district?: string | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string
          complement?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          district?: string | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          number?: string | null
          phone?: string | null
          reference?: string | null
          state?: string | null
          street?: string | null
          updated_at?: string
          whatsapp?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: Json
          business_type: Database["public"]["Enums"]["business_type"]
          created_at: string
          description: string | null
          document: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          primary_color: string | null
          secondary_color: string | null
          segment: string | null
          status: string
          subscription_plan: string
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          address?: Json
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          description?: string | null
          document?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          segment?: string | null
          status?: string
          subscription_plan?: string
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          address?: Json
          business_type?: Database["public"]["Enums"]["business_type"]
          created_at?: string
          description?: string | null
          document?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          segment?: string | null
          status?: string
          subscription_plan?: string
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_modules: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          module: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_modules_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          base_salary: number | null
          commission_percent: number | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          notes: string | null
          phone: string | null
          role: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          base_salary?: number | null
          commission_percent?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          base_salary?: number | null
          commission_percent?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          incurred_at: string
          receipt_url: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incurred_at?: string
          receipt_url?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          incurred_at?: string
          receipt_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          amount: number
          category: string | null
          company_id: string
          created_at: string
          created_by: string | null
          description: string
          direction: Database["public"]["Enums"]["fin_direction"]
          due_date: string | null
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          receipt_url: string | null
          status: Database["public"]["Enums"]["fin_tx_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description: string
          direction: Database["public"]["Enums"]["fin_direction"]
          due_date?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["fin_tx_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          direction?: Database["public"]["Enums"]["fin_direction"]
          due_date?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          receipt_url?: string | null
          status?: Database["public"]["Enums"]["fin_tx_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          month: string
          notes: string | null
          orders_target: number
          profit_target: number
          sales_target: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          notes?: string | null
          orders_target?: number
          profit_target?: number
          sales_target?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          notes?: string | null
          orders_target?: number
          profit_target?: number
          sales_target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      order_attachments: {
        Row: {
          company_id: string
          created_at: string
          filename: string | null
          id: string
          kind: string | null
          mime: string | null
          order_id: string
          size: number | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          company_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string | null
          mime?: string | null
          order_id: string
          size?: number | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          filename?: string | null
          id?: string
          kind?: string | null
          mime?: string | null
          order_id?: string
          size?: number | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor: string | null
          company_id: string
          created_at: string
          id: string
          message: string | null
          meta: Json | null
          order_id: string
          type: string
        }
        Insert: {
          actor?: string | null
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json | null
          order_id: string
          type: string
        }
        Update: {
          actor?: string | null
          company_id?: string
          created_at?: string
          id?: string
          message?: string | null
          meta?: Json | null
          order_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name_snapshot: string
          order_id: string
          product_id: string | null
          quantity: number
          sku_snapshot: string | null
          unit_cost_price: number
          unit_sale_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name_snapshot: string
          order_id: string
          product_id?: string | null
          quantity?: number
          sku_snapshot?: string | null
          unit_cost_price?: number
          unit_sale_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name_snapshot?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          sku_snapshot?: string | null
          unit_cost_price?: number
          unit_sale_price?: number
          updated_at?: string
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
        ]
      }
      orders: {
        Row: {
          amount_received: number
          brand: string | null
          card_fee: number
          client_id: string | null
          commission: number
          company_id: string
          cost_price: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          employee_id: string | null
          expected_delivery: string | null
          id: string
          model: string | null
          notes: string | null
          order_number: number
          other_costs: number
          payment_method: string | null
          photo_path: string | null
          profit: number | null
          purchase_date: string | null
          quantity: number
          reference: string | null
          sale_price: number
          ship_city: string | null
          ship_complement: string | null
          ship_district: string | null
          ship_number: string | null
          ship_reference: string | null
          ship_state: string | null
          ship_street: string | null
          ship_zip: string | null
          shipping: number
          status: Database["public"]["Enums"]["order_status"]
          supplier_id: string | null
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          amount_received?: number
          brand?: string | null
          card_fee?: number
          client_id?: string | null
          commission?: number
          company_id?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string | null
          expected_delivery?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          order_number?: number
          other_costs?: number
          payment_method?: string | null
          photo_path?: string | null
          profit?: number | null
          purchase_date?: string | null
          quantity?: number
          reference?: string | null
          sale_price?: number
          ship_city?: string | null
          ship_complement?: string | null
          ship_district?: string | null
          ship_number?: string | null
          ship_reference?: string | null
          ship_state?: string | null
          ship_street?: string | null
          ship_zip?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          amount_received?: number
          brand?: string | null
          card_fee?: number
          client_id?: string | null
          commission?: number
          company_id?: string
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          employee_id?: string | null
          expected_delivery?: string | null
          id?: string
          model?: string | null
          notes?: string | null
          order_number?: number
          other_costs?: number
          payment_method?: string | null
          photo_path?: string | null
          profit?: number | null
          purchase_date?: string | null
          quantity?: number
          reference?: string | null
          sale_price?: number
          ship_city?: string | null
          ship_complement?: string | null
          ship_district?: string | null
          ship_number?: string | null
          ship_reference?: string | null
          ship_state?: string | null
          ship_street?: string | null
          ship_zip?: string | null
          shipping?: number
          status?: Database["public"]["Enums"]["order_status"]
          supplier_id?: string | null
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          card_fee: number
          card_fee_percent: number | null
          company_id: string
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["payment_direction"]
          employee_id: string | null
          id: string
          installments: number | null
          method: string | null
          notes: string | null
          order_id: string | null
          paid_at: string
          receipt_url: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          card_fee?: number
          card_fee_percent?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["payment_direction"]
          employee_id?: string | null
          id?: string
          installments?: number | null
          method?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          card_fee?: number
          card_fee_percent?: number | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["payment_direction"]
          employee_id?: string | null
          id?: string
          installments?: number | null
          method?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string
          receipt_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_movements: {
        Row: {
          actor: string | null
          created_at: string
          id: string
          order_id: string | null
          product_id: string
          qty: number
          qty_after: number
          reason: string | null
          type: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id: string
          qty: number
          qty_after: number
          reason?: string | null
          type: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          product_id?: string
          qty?: number
          qty_after?: number
          reason?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          cost_price: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          image_url: string | null
          min_stock: number
          name: string
          notes: string | null
          sale_price: number
          sku: string | null
          status: string
          stock_qty: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          status?: string
          stock_qty?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost_price?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          name?: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          status?: string
          stock_qty?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          theme: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          theme?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          theme?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          avg_delivery_days: number | null
          company: string | null
          company_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          instagram: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avg_delivery_days?: number | null
          company?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avg_delivery_days?: number | null
          company?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_product_stock: {
        Args: {
          _product_id: string
          _qty: number
          _reason: string
          _type: string
        }
        Returns: number
      }
      apply_order_stock_out: { Args: { _order_id: string }; Returns: undefined }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_company_admin: { Args: { _company_id: string }; Returns: boolean }
      is_company_member: { Args: { _company_id: string }; Returns: boolean }
      is_company_staff: { Args: { _company_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: { _user_id: string }; Returns: boolean }
      revert_order_stock: { Args: { _order_id: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "staff"
      business_type:
        | "watch_store"
        | "jewelry"
        | "technical_assistance"
        | "retail"
        | "service"
        | "office"
        | "health"
        | "restaurant"
        | "other"
      fin_direction: "in" | "out"
      fin_tx_status: "pending" | "paid" | "overdue" | "cancelled"
      order_status:
        | "new"
        | "awaiting_deposit"
        | "paid"
        | "purchasing"
        | "in_transit"
        | "received"
        | "ready_delivery"
        | "delivered"
        | "cancelled"
        | "partial_payment"
        | "separating"
        | "shipped"
      payment_direction: "in" | "out"
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
      app_role: ["admin", "staff"],
      business_type: [
        "watch_store",
        "jewelry",
        "technical_assistance",
        "retail",
        "service",
        "office",
        "health",
        "restaurant",
        "other",
      ],
      fin_direction: ["in", "out"],
      fin_tx_status: ["pending", "paid", "overdue", "cancelled"],
      order_status: [
        "new",
        "awaiting_deposit",
        "paid",
        "purchasing",
        "in_transit",
        "received",
        "ready_delivery",
        "delivered",
        "cancelled",
        "partial_payment",
        "separating",
        "shipped",
      ],
      payment_direction: ["in", "out"],
    },
  },
} as const
