import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://juxjjoujtclxhbpjfzrc.supabase.co';
const supabaseAnonKey = 'sb_publishable_x_QZB1ynAqoE72rvYoRnFA_8EY1fBvS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
