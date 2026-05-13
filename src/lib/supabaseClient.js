import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juxjjoujtclxhbpjfzrc.supabase.co';
const supabaseAnonKey = 'sb_publishable_x_QZB1ynAqoE72rvYoRnFA_8EY1fBvS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Single-tab no-op lock. Supabase usa navigator.locks por defecto y
    // emite "Lock ... was released because another request stole it" cuando
    // hay competencia (multi-tab, StrictMode en dev, PWA + browser tab).
    // Para un gestor de contraseñas single-user esto es inocuo.
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
});
