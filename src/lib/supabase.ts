import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          icon: string;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          icon: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          icon?: string;
          sort_order?: number;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      menu_items: {
        Row: {
          id: string;
          name: string;
          description: string;
          base_price: number;
          category: string;
          popular: boolean;
          available: boolean;
          image_url: string | null;
          discount_price: number | null;
          discount_start_date: string | null;
          discount_end_date: string | null;
          discount_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description: string;
          base_price: number;
          category: string;
          popular?: boolean;
          available?: boolean;
          image_url?: string | null;
          discount_price?: number | null;
          discount_start_date?: string | null;
          discount_end_date?: string | null;
          discount_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          base_price?: number;
          category?: string;
          popular?: boolean;
          available?: boolean;
          image_url?: string | null;
          discount_price?: number | null;
          discount_start_date?: string | null;
          discount_end_date?: string | null;
          discount_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      variations: {
        Row: {
          id: string;
          menu_item_id: string;
          name: string;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          name: string;
          price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          name?: string;
          price?: number;
          created_at?: string;
        };
      };
      add_ons: {
        Row: {
          id: string;
          menu_item_id: string;
          name: string;
          price: number;
          category: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          menu_item_id: string;
          name: string;
          price: number;
          category: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          menu_item_id?: string;
          name?: string;
          price?: number;
          category?: string;
          created_at?: string;
        };
      };
      payment_methods: {
        Row: {
          id: string;
          name: string;
          account_number: string;
          account_name: string;
          qr_code_url: string;
          active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          account_number: string;
          account_name: string;
          qr_code_url: string;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          account_number?: string;
          account_name?: string;
          qr_code_url?: string;
          active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      site_settings: {
        Row: {
          id: string;
          value: string;
          type: string;
          description: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          value: string;
          type?: string;
          description?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          value?: string;
          type?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          customer_name: string;
          contact_number: string;
          service_type: string;
          address: string | null;
          landmark: string | null;
          pickup_time: string | null;
          party_size: number | null;
          dine_in_time: string | null;
          payment_method: string;
          reference_number: string | null;
          status: string;
          total: number;
          notes: string | null;
          customer_ip: string; // Stored as text, can be IP address or session identifier
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          order_number: string;
          customer_name: string;
          contact_number: string;
          service_type: string;
          address?: string | null;
          landmark?: string | null;
          pickup_time?: string | null;
          party_size?: number | null;
          dine_in_time?: string | null;
          payment_method: string;
          reference_number?: string | null;
          status?: string;
          total: number;
          notes?: string | null;
          customer_ip: string; // Stored as text, can be IP address or session identifier
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_name?: string;
          contact_number?: string;
          service_type?: string;
          address?: string | null;
          landmark?: string | null;
          pickup_time?: string | null;
          party_size?: number | null;
          dine_in_time?: string | null;
          payment_method?: string;
          reference_number?: string | null;
          status?: string;
          total?: number;
          notes?: string | null;
          customer_ip?: string;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          menu_item_id: string | null;
          menu_item_name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          selected_variation: any | null;
          selected_add_ons: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          menu_item_id?: string | null;
          menu_item_name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          selected_variation?: any | null;
          selected_add_ons?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          menu_item_id?: string | null;
          menu_item_name?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          selected_variation?: any | null;
          selected_add_ons?: any | null;
          created_at?: string;
        };
      };
      rate_limit_logs: {
        Row: {
          id: string;
          ip_address: string;
          action_type: string;
          timestamp: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          ip_address: string;
          action_type: string;
          timestamp?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          ip_address?: string;
          action_type?: string;
          timestamp?: string;
          expires_at?: string;
        };
      };
    };
  };
};