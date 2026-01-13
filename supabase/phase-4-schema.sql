-- =====================================================
-- CashBus Phase 4: Admin Interface & Workflow Engine
-- Database Schema Migration
-- Created: 2026-01-03
-- =====================================================

-- =====================================================
-- 1. WORKFLOWS TABLE
-- Stores workflow templates created by admin
-- =====================================================
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Workflow definition (JSON array of steps)
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Trigger configuration
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- manual, auto_on_claim, auto_on_incident
  trigger_conditions JSONB DEFAULT '{}'::jsonb, -- conditions to auto-start workflow

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- one default workflow per trigger type

  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,

  -- Stats
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0
);

-- Index for finding active workflows
CREATE INDEX idx_workflows_active ON workflows(is_active, trigger_type);
CREATE INDEX idx_workflows_default ON workflows(is_default, trigger_type);

-- =====================================================
-- 2. WORKFLOW_EXECUTIONS TABLE
-- Tracks individual workflow runs per claim
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Execution state
  status TEXT NOT NULL DEFAULT 'pending', -- pending, in_progress, completed, failed, cancelled
  current_step_index INTEGER DEFAULT 0,
  current_step_name TEXT,

  -- Step data
  steps_completed JSONB DEFAULT '[]'::jsonb, -- array of completed step results
  steps_remaining JSONB DEFAULT '[]'::jsonb, -- array of pending steps

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  execution_context JSONB DEFAULT '{}'::jsonb, -- variables passed between steps
  triggered_by UUID REFERENCES auth.users(id), -- admin who triggered (if manual)
  trigger_type TEXT, -- manual, automatic, scheduled

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for querying executions
CREATE INDEX idx_workflow_executions_claim ON workflow_executions(claim_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_next_retry ON workflow_executions(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- =====================================================
-- 3. WORKFLOW_STEP_DEFINITIONS TABLE
-- Reusable step templates
-- =====================================================
CREATE TABLE IF NOT EXISTS workflow_step_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Step identity
  step_type TEXT NOT NULL, -- data_verification, pdf_generation, email_send, status_update, approval_required, webhook_call
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- lucide icon name for UI

  -- Configuration schema (defines what params this step needs)
  config_schema JSONB DEFAULT '{}'::jsonb,
  default_config JSONB DEFAULT '{}'::jsonb,

  -- Execution settings
  timeout_seconds INTEGER DEFAULT 300, -- 5 minutes default
  requires_admin_approval BOOLEAN DEFAULT false,
  can_fail_silently BOOLEAN DEFAULT false, -- continue workflow even if step fails

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate common step types
INSERT INTO workflow_step_definitions (step_type, name, description, icon, default_config) VALUES
  ('data_verification', 'אימות נתונים', 'בדיקה אוטומטית של נתוני האירוע מול API משרד התחבורה', 'CheckCircle', '{"verify_gps": true, "verify_bus_line": true}'::jsonb),
  ('pdf_generation', 'יצירת מכתב התראה', 'יצירת PDF משפטי עם פרטי התביעה', 'FileText', '{"template": "warning_letter", "include_photos": true}'::jsonb),
  ('status_update', 'עדכון סטטוס', 'שינוי סטטוס התביעה ועדכון הלקוח', 'RefreshCw', '{"new_status": "submitted", "notify_customer": true}'::jsonb),
  ('email_send', 'שליחת אימייל', 'שליחת מייל ללקוח או לחברת האוטובוס', 'Mail', '{"to": "customer", "template": "claim_submitted"}'::jsonb),
  ('approval_required', 'דרוש אישור מנהל', 'עצירת הזרימה עד אישור ידני של מנהל', 'AlertCircle', '{"notify_admins": true}'::jsonb),
  ('compensation_calculation', 'חישוב פיצוי', 'חישוב אוטומטי של סכום הפיצוי לפי תקנה 428ז', 'Calculator', '{"include_damages": true}'::jsonb),
  ('webhook_call', 'קריאה לשירות חיצוני', 'שליחת נתונים לשירות חיצוני (CRM, חשבונאות וכו)', 'Zap', '{"url": "", "method": "POST"}'::jsonb)
ON CONFLICT DO NOTHING;

CREATE INDEX idx_step_definitions_active ON workflow_step_definitions(is_active, step_type);

-- =====================================================
-- 4. EXECUTION_LOGS TABLE
-- Detailed audit trail of all actions
-- =====================================================
CREATE TABLE IF NOT EXISTS execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  performed_by UUID REFERENCES auth.users(id), -- who performed the action (admin or system)

  -- Action details
  action_type TEXT NOT NULL, -- workflow_started, step_completed, step_failed, status_changed, approval_granted, etc.
  step_name TEXT,

  -- Details
  description TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb, -- structured data about the action

  -- Result
  success BOOLEAN DEFAULT true,
  error_message TEXT,

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX idx_execution_logs_execution ON execution_logs(workflow_execution_id);
CREATE INDEX idx_execution_logs_claim ON execution_logs(claim_id);
CREATE INDEX idx_execution_logs_performed_by ON execution_logs(performed_by);
CREATE INDEX idx_execution_logs_created_at ON execution_logs(created_at DESC);
CREATE INDEX idx_execution_logs_action_type ON execution_logs(action_type);

-- =====================================================
-- 5. ADMIN_SETTINGS TABLE
-- Global configuration and templates
-- =====================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Setting identity
  setting_key TEXT UNIQUE NOT NULL,
  setting_category TEXT NOT NULL, -- templates, notifications, system, automation

  -- Value
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate default settings
INSERT INTO admin_settings (setting_key, setting_category, setting_value, description) VALUES
  (
    'status_messages',
    'templates',
    '{
      "submitted": "התביעה שלך התקבלה ונמצאת בטיפול",
      "verified": "האירוע אומת מול נתוני משרד התחבורה",
      "rejected": "התביעה נדחתה - פרטים נוספים נשלחו למייל",
      "company_review": "מכתב ההתראה נשלח לחברת האוטובוס",
      "approved": "חברת האוטובוס אישרה את התביעה!",
      "in_court": "התביעה הועברה להליכים משפטיים",
      "settled": "הגענו להסדר עם החברה",
      "paid": "הפיצוי הועבר לחשבונך - מזל טוב!"
    }'::jsonb,
    'הודעות סטטוס המוצגות ללקוח'
  ),
  (
    'email_templates',
    'templates',
    '{
      "claim_submitted": {
        "subject": "התביעה שלך נקלטה במערכת CashBus",
        "body": "שלום {{customer_name}},\n\nהתביעה שלך נגד חברת {{bus_company}} בסך {{claim_amount}} ₪ התקבלה.\n\nמספר תביעה: {{claim_id}}\n\nנעדכן אותך בהמשך."
      },
      "warning_letter_sent": {
        "subject": "מכתב ההתראה נשלח לחברת האוטובוס",
        "body": "שלום {{customer_name}},\n\nמכתב התראה רשמי נשלח לחברת {{bus_company}}.\n\nהם מחויבים לענות תוך 7 ימים.\n\nנעדכן אותך בתגובתם."
      }
    }'::jsonb,
    'תבניות אימייל ללקוחות'
  ),
  (
    'pdf_templates',
    'templates',
    '{
      "warning_letter": {
        "header": "מכתב התראה לפי תקנה 428ז לתקנות השירותים הציבוריים",
        "footer": "במידה ולא תתקבל תשובה תוך 7 ימים, נאלץ לפנות לבית המשפט.",
        "include_company_logo": false,
        "include_incident_photos": true,
        "legal_citations": ["תקנה 428ז", "חוק השירותים הציבוריים"]
      }
    }'::jsonb,
    'תבניות PDF למכתבים משפטיים'
  ),
  (
    'automation_config',
    'automation',
    '{
      "auto_verify_incidents": true,
      "auto_generate_letters": false,
      "auto_send_emails": false,
      "require_admin_approval_above": 5000,
      "max_retry_attempts": 3,
      "retry_delay_minutes": 30
    }'::jsonb,
    'הגדרות אוטומציה כלליות'
  )
ON CONFLICT (setting_key) DO NOTHING;

CREATE INDEX idx_admin_settings_category ON admin_settings(setting_category);
CREATE INDEX idx_admin_settings_active ON admin_settings(is_active);

-- =====================================================
-- 6. DOCUMENT_GENERATIONS TABLE
-- Track all generated PDFs
-- =====================================================
CREATE TABLE IF NOT EXISTS document_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relations
  claim_id UUID REFERENCES claims(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES workflow_executions(id) ON DELETE SET NULL,

  -- Document info
  document_type TEXT NOT NULL, -- warning_letter, formal_claim, court_filing
  template_used TEXT NOT NULL,

  -- File storage
  file_path TEXT, -- path in Supabase Storage
  file_url TEXT, -- public URL
  file_size_bytes INTEGER,

  -- Generation details
  generated_by UUID REFERENCES auth.users(id),
  generation_method TEXT DEFAULT 'automatic', -- automatic, manual

  -- Content
  document_data JSONB DEFAULT '{}'::jsonb, -- data used to populate template

  -- Status
  status TEXT DEFAULT 'generated', -- generated, sent, delivered, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_generations_claim ON document_generations(claim_id);
CREATE INDEX idx_document_generations_status ON document_generations(status);
CREATE INDEX idx_document_generations_type ON document_generations(document_type);

-- =====================================================
-- 7. UPDATE EXISTING CLAIMS TABLE
-- Add workflow-related fields
-- =====================================================
ALTER TABLE claims
ADD COLUMN IF NOT EXISTS current_workflow_execution_id UUID REFERENCES workflow_executions(id),
ADD COLUMN IF NOT EXISTS workflow_status TEXT DEFAULT 'not_started', -- not_started, in_progress, completed, failed
ADD COLUMN IF NOT EXISTS last_workflow_action_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_notes TEXT,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal'; -- urgent, high, normal, low

CREATE INDEX IF NOT EXISTS idx_claims_workflow_execution ON claims(current_workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_claims_workflow_status ON claims(workflow_status);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON claims(priority);

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generations ENABLE ROW LEVEL SECURITY;

-- Admin-only access policies
-- (Assumes admin users are in admin_users table from Phase 1)

-- Workflows: Admin can CRUD, users can read active ones
CREATE POLICY "Admins can manage workflows"
  ON workflows FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view active workflows"
  ON workflows FOR SELECT
  USING (is_active = true);

-- Workflow executions: Admin full access, users can view their own
CREATE POLICY "Admins can manage workflow executions"
  ON workflow_executions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their own workflow executions"
  ON workflow_executions FOR SELECT
  USING (user_id = auth.uid());

-- Step definitions: Admin full access, users read-only
CREATE POLICY "Admins can manage step definitions"
  ON workflow_step_definitions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view active step definitions"
  ON workflow_step_definitions FOR SELECT
  USING (is_active = true);

-- Execution logs: Admin full access, users can view logs for their claims
CREATE POLICY "Admins can view all execution logs"
  ON execution_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view logs for their own claims"
  ON execution_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.id = execution_logs.claim_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert execution logs"
  ON execution_logs FOR INSERT
  WITH CHECK (true); -- Allow system to log everything

-- Admin settings: Admin-only
CREATE POLICY "Admins can manage settings"
  ON admin_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view active settings"
  ON admin_settings FOR SELECT
  USING (is_active = true);

-- Document generations: Admin full access, users can view their own
CREATE POLICY "Admins can manage document generations"
  ON document_generations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view their own documents"
  ON document_generations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM claims c
      WHERE c.id = document_generations.claim_id
      AND c.user_id = auth.uid()
    )
  );

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function to log execution events (callable from workflow engine)
CREATE OR REPLACE FUNCTION log_workflow_action(
  p_workflow_execution_id UUID,
  p_claim_id UUID,
  p_action_type TEXT,
  p_description TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_success BOOLEAN DEFAULT true,
  p_error_message TEXT DEFAULT NULL,
  p_performed_by UUID DEFAULT NULL,
  p_step_name TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO execution_logs (
    workflow_execution_id,
    claim_id,
    action_type,
    description,
    details,
    success,
    error_message,
    performed_by,
    step_name
  ) VALUES (
    p_workflow_execution_id,
    p_claim_id,
    p_action_type,
    p_description,
    p_details,
    p_success,
    p_error_message,
    COALESCE(p_performed_by, auth.uid()),
    p_step_name
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update workflow execution status
CREATE OR REPLACE FUNCTION update_workflow_execution_status(
  p_execution_id UUID,
  p_status TEXT,
  p_current_step_index INTEGER DEFAULT NULL,
  p_current_step_name TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE workflow_executions
  SET
    status = p_status,
    current_step_index = COALESCE(p_current_step_index, current_step_index),
    current_step_name = COALESCE(p_current_step_name, current_step_name),
    error_message = p_error_message,
    updated_at = NOW(),
    completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
  WHERE id = p_execution_id;

  -- Update claim workflow status
  UPDATE claims
  SET
    workflow_status = CASE
      WHEN p_status = 'completed' THEN 'completed'
      WHEN p_status = 'failed' THEN 'failed'
      WHEN p_status = 'cancelled' THEN 'not_started'
      ELSE 'in_progress'
    END,
    last_workflow_action_at = NOW()
  WHERE current_workflow_execution_id = p_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get next pending workflow execution (for automation engine)
CREATE OR REPLACE FUNCTION get_next_pending_execution()
RETURNS TABLE (
  execution_id UUID,
  workflow_id UUID,
  claim_id UUID,
  current_step_index INTEGER,
  steps_remaining JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    we.id as execution_id,
    we.workflow_id,
    we.claim_id,
    we.current_step_index,
    we.steps_remaining
  FROM workflow_executions we
  WHERE we.status = 'in_progress'
    AND (we.next_retry_at IS NULL OR we.next_retry_at <= NOW())
  ORDER BY we.started_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Prevent concurrent processing
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 10. TRIGGERS FOR AUTO-UPDATE
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_executions_updated_at BEFORE UPDATE ON workflow_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_generations_updated_at BEFORE UPDATE ON document_generations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. VIEWS FOR ADMIN DASHBOARD
-- =====================================================

-- View: Workflow execution statistics
CREATE OR REPLACE VIEW workflow_execution_stats AS
SELECT
  w.id as workflow_id,
  w.name as workflow_name,
  COUNT(we.id) as total_executions,
  COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN we.status = 'in_progress' THEN 1 END) as in_progress_count,
  AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) as avg_duration_seconds,
  MAX(we.completed_at) as last_execution
FROM workflows w
LEFT JOIN workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name;

-- View: Claims with workflow status
CREATE OR REPLACE VIEW claims_with_workflow AS
SELECT
  c.*,
  we.status as execution_status,
  we.current_step_name,
  we.error_message as execution_error,
  w.name as workflow_name,
  p.full_name as customer_name,
  p.phone as customer_phone
FROM claims c
LEFT JOIN workflow_executions we ON c.current_workflow_execution_id = we.id
LEFT JOIN workflows w ON we.workflow_id = w.id
LEFT JOIN profiles p ON c.user_id = p.id;

-- View: Recent admin activity
CREATE OR REPLACE VIEW recent_admin_activity AS
SELECT
  el.id,
  el.action_type,
  el.description,
  el.created_at,
  el.success,
  p.full_name as performed_by_name,
  c.id as claim_id,
  c.claim_amount
FROM execution_logs el
LEFT JOIN profiles p ON el.performed_by = p.id
LEFT JOIN claims c ON el.claim_id = c.id
ORDER BY el.created_at DESC
LIMIT 100;

-- =====================================================
-- SCHEMA COMPLETE!
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Final comment
COMMENT ON TABLE workflows IS 'Phase 4: Workflow templates for claim automation';
COMMENT ON TABLE workflow_executions IS 'Phase 4: Individual workflow runs per claim';
COMMENT ON TABLE workflow_step_definitions IS 'Phase 4: Reusable workflow step templates';
COMMENT ON TABLE execution_logs IS 'Phase 4: Audit trail of all workflow actions';
COMMENT ON TABLE admin_settings IS 'Phase 4: System configuration and templates';
COMMENT ON TABLE document_generations IS 'Phase 4: Tracking generated PDF documents';
