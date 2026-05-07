import { createClient } from '@supabase/supabase-js';

// Fallback vacío para que el build no falle si las env vars no están disponibles
// en tiempo de compilación. En runtime siempre deben estar presentes.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
