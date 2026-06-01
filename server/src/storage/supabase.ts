import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.COZE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.COZE_SUPABASE_ANON_KEY || '';

let mockSupabase: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseServiceKey);
}

export function getSupabaseClient(token?: string): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  
  if (token) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export function getSupabaseUrl() {
  return supabaseUrl;
}

export function getSupabaseAnonKey() {
  return supabaseAnonKey;
}
