import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juxjjoujtclxhbpjfzrc.supabase.co';
const supabaseAnonKey = 'sb_publishable_x_QZB1ynAqoE72rvYoRnFA_8EY1fBvS';

// Cliente con configuración por defecto. El warning "Lock ... released because
// another request stole it" en consola es inocuo y NO debe silenciarse — el
// lock no-op que intenté antes rompía el refresh de tokens.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
