-- App Settings table - key/value store for system configuration
-- Used by admin settings page and backend services (e.g. admin email, notification preferences)

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write settings
CREATE POLICY "Admins can read settings"
  ON app_settings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can insert settings"
  ON app_settings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update settings"
  ON app_settings FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Server-side (service role) bypasses RLS, so backend workflows can always read settings

-- Seed default settings
INSERT INTO app_settings (key, value, description) VALUES
  ('admin_email', '"admin@cashbus.co.il"', 'כתובת מייל לקבלת התראות אדמין'),
  ('reminder_days', '7', 'מספר ימים לתזכורת אוטומטית'),
  ('max_claim_amount', '11000', 'סכום תביעה מקסימלי'),
  ('auto_approval', 'false', 'אישור אוטומטי לתביעות בסכום נמוך'),
  ('email_notifications', 'true', 'שליחת התראות במייל לאדמין'),
  ('system_language', '"he"', 'שפת המערכת')
ON CONFLICT (key) DO NOTHING;
