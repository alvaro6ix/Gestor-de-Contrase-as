-- ========================================================
-- SCRIPT COMPLETO - EJECUTAR EN SUPABASE SQL EDITOR
-- ========================================================

-- 1. Tabla de contraseñas
CREATE TABLE IF NOT EXISTS passwords (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  email TEXT NOT NULL,
  password TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Historial de contraseñas (old + new)
CREATE TABLE IF NOT EXISTS password_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  password_id UUID REFERENCES passwords(id) ON DELETE CASCADE,
  old_password TEXT NOT NULL,
  new_password TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Compartidos internos
CREATE TABLE IF NOT EXISTS shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  password_id UUID REFERENCES passwords(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_by_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Log de compartidos (whatsapp, email, etc.)
CREATE TABLE IF NOT EXISTS share_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  password_id UUID REFERENCES passwords(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  shared_with TEXT NOT NULL,
  shared_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- RLS (Seguridad)
-- =====================
ALTER TABLE passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_logs ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas
DROP POLICY IF EXISTS "own_passwords_select" ON passwords;
DROP POLICY IF EXISTS "own_passwords_insert" ON passwords;
DROP POLICY IF EXISTS "own_passwords_update" ON passwords;
DROP POLICY IF EXISTS "own_passwords_delete" ON passwords;
DROP POLICY IF EXISTS "shared_passwords_select" ON passwords;
DROP POLICY IF EXISTS "own_history_select" ON password_history;
DROP POLICY IF EXISTS "own_history_insert" ON password_history;
DROP POLICY IF EXISTS "own_shares_select" ON shares;
DROP POLICY IF EXISTS "own_shares_insert" ON shares;
DROP POLICY IF EXISTS "own_shares_delete" ON shares;
DROP POLICY IF EXISTS "own_logs_select" ON share_logs;
DROP POLICY IF EXISTS "own_logs_insert" ON share_logs;

-- passwords: propias
CREATE POLICY "own_passwords_select" ON passwords FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_passwords_insert" ON passwords FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_passwords_update" ON passwords FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own_passwords_delete" ON passwords FOR DELETE USING (auth.uid() = user_id);

-- passwords: compartidas con el usuario actual (usando jwt email)
CREATE POLICY "shared_passwords_select" ON passwords FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM shares
    WHERE shares.password_id = passwords.id
      AND shares.shared_with_email = (auth.jwt() ->> 'email')
  ));

-- password_history
CREATE POLICY "own_history_select" ON password_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM passwords WHERE passwords.id = password_history.password_id AND passwords.user_id = auth.uid()));
CREATE POLICY "own_history_insert" ON password_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM passwords WHERE passwords.id = password_history.password_id AND passwords.user_id = auth.uid()));

-- shares
CREATE POLICY "own_shares_select" ON shares FOR SELECT USING (auth.uid() = shared_by_user_id);
CREATE POLICY "own_shares_insert" ON shares FOR INSERT WITH CHECK (auth.uid() = shared_by_user_id);
CREATE POLICY "own_shares_delete" ON shares FOR DELETE USING (auth.uid() = shared_by_user_id);

-- share_logs
CREATE POLICY "own_logs_select" ON share_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_logs_insert" ON share_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================
-- Storage bucket para iconos
-- =====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('password-icons', 'password-icons', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view icons" ON storage.objects
  FOR SELECT USING (bucket_id = 'password-icons');

CREATE POLICY "Authenticated users can upload icons" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'password-icons' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete own icons" ON storage.objects
  FOR DELETE USING (bucket_id = 'password-icons' AND auth.uid()::text = (storage.foldername(name))[1]);
