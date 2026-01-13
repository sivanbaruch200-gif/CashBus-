-- =====================================================
-- CashBus Phase 4: Admin Interface & Workflow Engine
-- Database Schema Migration (FULLY CORRECTED)
-- Created: 2026-01-03
-- Fixed: RLS policy references to use admin_users.id instead of user_id
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 0. UPDATE EXISTING TABLES FIRST
-- Add missing columns to existing tables before creating new ones
-- =====================================================

-- Add workflow-related columns to claims table
DO $$
BEGIN
  -- Add current_workflow_execution_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'current_workflow_execution_id'
  ) THEN
    ALTER TABLE public.claims ADD COLUMN current_workflow_execution_id UUID;
  END IF;

  -- Add workflow_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'workflow_status'
  ) THEN
    ALTER TABLE public.claims ADD COLUMN workflow_status TEXT DEFAULT 'not_started';
  END IF;

  -- Add workflow_status constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'claims' AND constraint_name = 'claims_workflow_status_check'
  ) THEN
    ALTER TABLE public.claims ADD CONSTRAINT claims_workflow_status_check
    CHECK (workflow_status IN ('not_started', 'in_progress', 'completed', 'failed'));
  END IF;

  -- Add last_workflow_action_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'last_workflow_action_at'
  ) THEN
    ALTER TABLE public.claims ADD COLUMN last_workflow_action_at TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Add admin_notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'admin_notes'
  ) THEN
    ALTER TABLE public.claims ADD COLUMN admin_notes TEXT;
  END IF;

  -- Add priority column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'claims' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.claims ADD COLUMN priority TEXT DEFAULT 'normal';
  END IF;

  -- Add priority constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'claims' AND constraint_name = 'claims_priority_check'
  ) THEN
    ALTER TABLE public.claims ADD CONSTRAINT claims_priority_check
    CHECK (priority IN ('urgent', 'high', 'normal', 'low'));
  END IF;
END $$;

-- =====================================================
-- 1. WORKFLOWS TABLE
-- Stores workflow templates created by admin
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Stats
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,
  failed_executions INTEGER DEFAULT 0
);

-- Index for finding active workflows
CREATE INDEX IF NOT EXISTS idx_workflows_active ON public.workflows(is_active, trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflows_default ON public.workflows(is_default, trigger_type);

-- =====================================================
-- 2. WORKFLOW_EXECUTIONS TABLE
-- Tracks individual workflow runs per claim
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workflow_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE SET NULL,
  claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
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
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  next_retry_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  execution_context JSONB DEFAULT '{}'::jsonb, -- variables passed between steps
  triggered_by UUID REFERENCES auth.users(id), -- admin who triggered (if manual)
  trigger_type TEXT, -- manual, automatic, scheduled

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_claim ON public.workflow_executions(claim_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON public.workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON public.workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_next_retry ON public.workflow_executions(next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Now add foreign key constraint to claims table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'claims_current_workflow_execution_id_fkey'
    AND table_name = 'claims'
  ) THEN
    ALTER TABLE public.claims
    ADD CONSTRAINT claims_current_workflow_execution_id_fkey
    FOREIGN KEY (current_workflow_execution_id) REFERENCES public.workflow_executions(id);
  END IF;
END $$;

-- =====================================================
-- 3. WORKFLOW_STEP_DEFINITIONS TABLE
-- Reusable step templates
-- =====================================================
CREATE TABLE IF NOT EXISTS public.workflow_step_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-populate common step types (only if table is empty)
INSERT INTO public.workflow_step_definitions (step_type, name, description, icon, default_config)
SELECT * FROM (VALUES
  ('data_verification', 'אימות נתונים', 'בדיקה אוטומטית של נתוני האירוע מול API משרד התחבורה', 'CheckCircle', '{"verify_gps": true, "verify_bus_line": true}'::jsonb),
  ('pdf_generation', 'יצירת מכתב התראה', 'יצירת PDF משפטי עם פרטי התביעה', 'FileText', '{"template": "warning_letter", "include_photos": true}'::jsonb),
  ('status_update', 'עדכון סטטוס', 'שינוי סטטוס התביעה ועדכון הלקוח', 'RefreshCw', '{"new_status": "submitted", "notify_customer": true}'::jsonb),
  ('email_send', 'שליחת אימייל', 'שליחת מייל ללקוח או לחברת האוטובוס', 'Mail', '{"to": "customer", "template": "claim_submitted"}'::jsonb),
  ('approval_required', 'דרוש אישור מנהל', 'עצירת הזרימה עד אישור ידני של מנהל', 'AlertCircle', '{"notify_admins": true}'::jsonb),
  ('compensation_calculation', 'חישוב פיצוי', 'חישוב אוטומטי של סכום הפיצוי לפי תקנה 428ז', 'Calculator', '{"include_damages": true}'::jsonb),
  ('webhook_call', 'קריאה לשירות חיצוני', 'שליחת נתונים לשירות חיצוני (CRM, חשבונאות וכו)', 'Zap', '{"url": "", "method": "POST"}'::jsonb)
) AS v(step_type, name, description, icon, default_config)
WHERE NOT EXISTS (SELECT 1 FROM public.workflow_step_definitions LIMIT 1);

CREATE INDEX IF NOT EXISTS idx_step_definitions_active ON public.workflow_step_definitions(is_active, step_type);

-- =====================================================
-- 4. EXECUTION_LOGS TABLE
-- Detailed audit trail of all actions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.execution_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE CASCADE,
  claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_execution_logs_execution ON public.execution_logs(workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_claim ON public.execution_logs(claim_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_performed_by ON public.execution_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON public.execution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_execution_logs_action_type ON public.execution_logs(action_type);

-- =====================================================
-- 5. ADMIN_SETTINGS TABLE
-- Global configuration and templates
-- =====================================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Setting identity
  setting_key TEXT UNIQUE NOT NULL,
  setting_category TEXT NOT NULL, -- templates, notifications, system, automation

  -- Value
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pre-populate default settings (only if they don't exist)
INSERT INTO public.admin_settings (setting_key, setting_category, setting_value, description)
SELECT * FROM (VALUES
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
) AS v(setting_key, setting_category, setting_value, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_settings WHERE setting_key = v.setting_key
);

CREATE INDEX IF NOT EXISTS idx_admin_settings_category ON public.admin_settings(setting_category);
CREATE INDEX IF NOT EXISTS idx_admin_settings_active ON public.admin_settings(is_active);

-- =====================================================
-- 6. DOCUMENT_GENERATIONS TABLE
-- Track all generated PDFs
-- =====================================================
CREATE TABLE IF NOT EXISTS public.document_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Relations
  claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
  workflow_execution_id UUID REFERENCES public.workflow_executions(id) ON DELETE SET NULL,

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
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_generations_claim ON public.document_generations(claim_id);
CREATE INDEX IF NOT EXISTS idx_document_generations_status ON public.document_generations(status);
CREATE INDEX IF NOT EXISTS idx_document_generations_type ON public.document_generations(document_type);

-- =====================================================
-- 7. ADD INDEXES TO CLAIMS FOR WORKFLOW QUERIES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_claims_workflow_execution ON public.claims(current_workflow_execution_id);
CREATE INDEX IF NOT EXISTS idx_claims_workflow_status ON public.claims(workflow_status);
CREATE INDEX IF NOT EXISTS idx_claims_priority ON public.claims(priority);

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_generations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts on re-run)
DROP POLICY IF EXISTS "Admins can manage workflows" ON public.workflows;
DROP POLICY IF EXISTS "Users can view active workflows" ON public.workflows;
DROP POLICY IF EXISTS "Admins can manage workflow executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Users can view their own workflow executions" ON public.workflow_executions;
DROP POLICY IF EXISTS "Admins can manage step definitions" ON public.workflow_step_definitions;
DROP POLICY IF EXISTS "Users can view active step definitions" ON public.workflow_step_definitions;
DROP POLICY IF EXISTS "Admins can view all execution logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Users can view logs for their own claims" ON public.execution_logs;
DROP POLICY IF EXISTS "System can insert execution logs" ON public.execution_logs;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Users can view active settings" ON public.admin_settings;
DROP POLICY IF EXISTS "Admins can manage document generations" ON public.document_generations;
DROP POLICY IF EXISTS "Users can view their own documents" ON public.document_generations;

-- CORRECTED: Workflows policies - admin_users.id is the primary key
CREATE POLICY "Admins can manage workflows"
  ON public.workflows FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view active workflows"
  ON public.workflows FOR SELECT
  USING (is_active = true);

-- CORRECTED: Workflow executions policies
CREATE POLICY "Admins can manage workflow executions"
  ON public.workflow_executions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view their own workflow executions"
  ON public.workflow_executions FOR SELECT
  USING (user_id = auth.uid());

-- CORRECTED: Step definitions policies
CREATE POLICY "Admins can manage step definitions"
  ON public.workflow_step_definitions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view active step definitions"
  ON public.workflow_step_definitions FOR SELECT
  USING (is_active = true);

-- CORRECTED: Execution logs policies
CREATE POLICY "Admins can view all execution logs"
  ON public.execution_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view logs for their own claims"
  ON public.execution_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = execution_logs.claim_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert execution logs"
  ON public.execution_logs FOR INSERT
  WITH CHECK (true); -- Allow system to log everything

-- CORRECTED: Admin settings policies
CREATE POLICY "Admins can manage settings"
  ON public.admin_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view active settings"
  ON public.admin_settings FOR SELECT
  USING (is_active = true);

-- CORRECTED: Document generations policies
CREATE POLICY "Admins can manage document generations"
  ON public.document_generations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
  );

CREATE POLICY "Users can view their own documents"
  ON public.document_generations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.claims c
      WHERE c.id = document_generations.claim_id
      AND c.user_id = auth.uid()
    )
  );

-- =====================================================
-- 9. HELPER FUNCTIONS
-- =====================================================

-- Function to log execution events (callable from workflow engine)
CREATE OR REPLACE FUNCTION public.log_workflow_action(
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
  INSERT INTO public.execution_logs (
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
CREATE OR REPLACE FUNCTION public.update_workflow_execution_status(
  p_execution_id UUID,
  p_status TEXT,
  p_current_step_index INTEGER DEFAULT NULL,
  p_current_step_name TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE public.workflow_executions
  SET
    status = p_status,
    current_step_index = COALESCE(p_current_step_index, current_step_index),
    current_step_name = COALESCE(p_current_step_name, current_step_name),
    error_message = p_error_message,
    updated_at = NOW(),
    completed_at = CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
  WHERE id = p_execution_id;

  -- Update claim workflow status
  UPDATE public.claims
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
CREATE OR REPLACE FUNCTION public.get_next_pending_execution()
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
  FROM public.workflow_executions we
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

-- Triggers for updated_at (reuse existing function)
DROP TRIGGER IF EXISTS update_workflows_updated_at ON public.workflows;
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON public.workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_workflow_executions_updated_at ON public.workflow_executions;
CREATE TRIGGER update_workflow_executions_updated_at BEFORE UPDATE ON public.workflow_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings;
CREATE TRIGGER update_admin_settings_updated_at BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_document_generations_updated_at ON public.document_generations;
CREATE TRIGGER update_document_generations_updated_at BEFORE UPDATE ON public.document_generations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 11. VIEWS FOR ADMIN DASHBOARD
-- =====================================================

-- Drop views if they exist (for clean re-run)
DROP VIEW IF EXISTS public.workflow_execution_stats;
DROP VIEW IF EXISTS public.claims_with_workflow;
DROP VIEW IF EXISTS public.recent_admin_activity;

-- View: Workflow execution statistics
CREATE VIEW public.workflow_execution_stats AS
SELECT
  w.id as workflow_id,
  w.name as workflow_name,
  COUNT(we.id) as total_executions,
  COUNT(CASE WHEN we.status = 'completed' THEN 1 END) as completed_count,
  COUNT(CASE WHEN we.status = 'failed' THEN 1 END) as failed_count,
  COUNT(CASE WHEN we.status = 'in_progress' THEN 1 END) as in_progress_count,
  AVG(EXTRACT(EPOCH FROM (we.completed_at - we.started_at))) as avg_duration_seconds,
  MAX(we.completed_at) as last_execution
FROM public.workflows w
LEFT JOIN public.workflow_executions we ON w.id = we.workflow_id
GROUP BY w.id, w.name;

-- View: Claims with workflow status
CREATE VIEW public.claims_with_workflow AS
SELECT
  c.*,
  we.status as execution_status,
  we.current_step_name,
  we.error_message as execution_error,
  w.name as workflow_name,
  p.full_name as customer_name,
  p.phone as customer_phone
FROM public.claims c
LEFT JOIN public.workflow_executions we ON c.current_workflow_execution_id = we.id
LEFT JOIN public.workflows w ON we.workflow_id = w.id
LEFT JOIN public.profiles p ON c.user_id = p.id;

-- View: Recent admin activity
CREATE VIEW public.recent_admin_activity AS
SELECT
  el.id,
  el.action_type,
  el.description,
  el.created_at,
  el.success,
  p.full_name as performed_by_name,
  c.id as claim_id,
  c.claim_amount
FROM public.execution_logs el
LEFT JOIN public.profiles p ON el.performed_by = p.id
LEFT JOIN public.claims c ON el.claim_id = c.id
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

-- Final comments
COMMENT ON TABLE public.workflows IS 'Phase 4: Workflow templates for claim automation';
COMMENT ON TABLE public.workflow_executions IS 'Phase 4: Individual workflow runs per claim';
COMMENT ON TABLE public.workflow_step_definitions IS 'Phase 4: Reusable workflow step templates';
COMMENT ON TABLE public.execution_logs IS 'Phase 4: Audit trail of all workflow actions';
COMMENT ON TABLE public.admin_settings IS 'Phase 4: System configuration and templates';
COMMENT ON TABLE public.document_generations IS 'Phase 4: Tracking generated PDF documents';

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify the migration succeeded
-- =====================================================

-- 1. Check all tables were created
SELECT 'Tables created:' as check_name, COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'workflows',
  'workflow_executions',
  'workflow_step_definitions',
  'execution_logs',
  'admin_settings',
  'document_generations'
);

-- 2. Check step definitions populated
SELECT 'Step definitions:' as check_name, COUNT(*) as count
FROM public.workflow_step_definitions;

-- 3. Check admin settings populated
SELECT 'Admin settings:' as check_name, COUNT(*) as count
FROM public.admin_settings;

-- 4. Check RLS enabled
SELECT 'RLS enabled on:' as check_name, COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'workflows',
  'workflow_executions',
  'execution_logs'
)
AND rowsecurity = true;

-- 5. Check views created
SELECT 'Views created:' as check_name, COUNT(*) as count
FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN (
  'workflow_execution_stats',
  'claims_with_workflow',
  'recent_admin_activity'
);

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Phase 4 Schema Migration Complete!';
  RAISE NOTICE '📊 6 new tables created';
  RAISE NOTICE '🔧 7 step definitions pre-populated';
  RAISE NOTICE '⚙️ 4 admin settings configured';
  RAISE NOTICE '🔐 RLS policies enabled';
  RAISE NOTICE '📈 3 dashboard views created';
  RAISE NOTICE '✨ Ready for admin interface!';
END $$;
