import { createClient } from '@supabase/supabase-js';

const url = typeof __SUPABASE_URL__ !== 'undefined' ? __SUPABASE_URL__ : undefined;
const anonKey = typeof __SUPABASE_ANON_KEY__ !== 'undefined' ? __SUPABASE_ANON_KEY__ : undefined;

export const SUPABASE_CONFIGURADO = Boolean(url && anonKey);

if (!SUPABASE_CONFIGURADO) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (ver .env.example).'
  );
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'chave-nao-configurada',
  { auth: { persistSession: true, autoRefreshToken: true } }
);


