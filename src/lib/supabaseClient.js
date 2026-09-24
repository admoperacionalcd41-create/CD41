import { createClient } from '@supabase/supabase-js';

// URL e chave pública (anon) do projeto Supabase — configurados como
// variáveis de ambiente (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), nunca
// direto no código. A chave "anon" é feita pra ser pública (o Vite a embute
// no bundle do navegador); quem protege os dados de verdade são as regras
// de RLS (Row Level Security) configuradas no banco, não o sigilo dela.
//
// Em desenvolvimento local, copie .env.example para .env e preencha os dois
// valores (Supabase → Project Settings → API). Sem eles, o app mostra uma
// tela avisando que o Supabase ainda não foi configurado, em vez de quebrar
// com um erro confuso.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
