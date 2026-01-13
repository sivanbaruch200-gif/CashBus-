# Phase 4 SQL Migration - Quick Start Guide

**Created:** 2026-01-03

---

## 📋 What This Migration Does

Creates the complete database infrastructure for Phase 4 (Admin Interface & Workflow Automation):

✅ 6 new tables for workflow management
✅ 7 pre-configured workflow step types
✅ 4 default admin settings (status messages, templates)
✅ 3 helper functions for automation
✅ 3 dashboard views
✅ Complete Row Level Security (RLS) policies
✅ Automatic audit logging triggers

---

## 🚀 How to Run (3 Minutes)

### Step 1: Open Supabase Dashboard
1. Go to: https://app.supabase.com
2. Select your **CashBus** project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New Query"** button

### Step 2: Copy the Migration
1. Open the file: `supabase/phase-4-schema.sql`
2. **Select ALL** content (Ctrl+A or Cmd+A)
3. **Copy** it (Ctrl+C or Cmd+C)

### Step 3: Execute the Migration
1. **Paste** into the SQL Editor (Ctrl+V or Cmd+V)
2. Click **"Run"** button (or press F5)
3. Wait 10-15 seconds for completion
4. ✅ You should see: **"Success. No rows returned"**

### Step 4: Verify Installation
Copy and run this verification query:

```sql
-- Check that all 6 tables were created
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'workflows',
  'workflow_executions',
  'workflow_step_definitions',
  'execution_logs',
  'admin_settings',
  'document_generations'
)
ORDER BY table_name;
```

**Expected result:** 6 rows (table names listed alphabetically)

---

## ✅ Verification Checklist

After running the migration, verify these results:

### 1. Tables Created (6 total)
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'workflow%' OR table_name IN ('execution_logs', 'admin_settings', 'document_generations');
```
**Expected:** 6

### 2. Step Definitions Pre-Populated (7 types)
```sql
SELECT step_type, name FROM workflow_step_definitions ORDER BY step_type;
```
**Expected:** 7 rows with Hebrew names:
- approval_required → דרוש אישור מנהל
- compensation_calculation → חישוב פיצוי
- data_verification → אימות נתונים
- email_send → שליחת אימייל
- pdf_generation → יצירת מכתב התראה
- status_update → עדכון סטטוס
- webhook_call → קריאה לשירות חיצוני

### 3. Admin Settings Pre-Populated (4 settings)
```sql
SELECT setting_key, setting_category FROM admin_settings ORDER BY setting_key;
```
**Expected:** 4 rows:
- automation_config (automation)
- email_templates (templates)
- pdf_templates (templates)
- status_messages (templates)

### 4. Views Created (3 total)
```sql
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
AND table_name IN ('workflow_execution_stats', 'claims_with_workflow', 'recent_admin_activity');
```
**Expected:** 3 rows

### 5. RLS Policies Enabled
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('workflows', 'workflow_executions', 'execution_logs');
```
**Expected:** 3 rows, all with `rowsecurity = true`

---

## 🔍 Inspect the Data

### View Pre-Configured Status Messages (Hebrew)
```sql
SELECT setting_value->'submitted' as submitted_message,
       setting_value->'verified' as verified_message,
       setting_value->'paid' as paid_message
FROM admin_settings
WHERE setting_key = 'status_messages';
```

### View Automation Configuration
```sql
SELECT setting_value
FROM admin_settings
WHERE setting_key = 'automation_config';
```

### List All Available Workflow Steps
```sql
SELECT
  step_type,
  name,
  description,
  icon,
  requires_admin_approval
FROM workflow_step_definitions
ORDER BY name;
```

---

## 🛠️ Troubleshooting

### Problem: "relation already exists" error
**Solution:** Some tables already exist. Run this to drop old tables first:
```sql
DROP TABLE IF EXISTS document_generations CASCADE;
DROP TABLE IF EXISTS execution_logs CASCADE;
DROP TABLE IF EXISTS workflow_executions CASCADE;
DROP TABLE IF EXISTS workflows CASCADE;
DROP TABLE IF EXISTS workflow_step_definitions CASCADE;
DROP TABLE IF EXISTS admin_settings CASCADE;
```
Then re-run the migration.

### Problem: "permission denied" error
**Solution:** Make sure you're logged in as the project owner in Supabase dashboard.

### Problem: "function already exists" error
**Solution:** Functions use `CREATE OR REPLACE`, so this shouldn't happen. If it does:
```sql
DROP FUNCTION IF EXISTS log_workflow_action CASCADE;
DROP FUNCTION IF EXISTS update_workflow_execution_status CASCADE;
DROP FUNCTION IF EXISTS get_next_pending_execution CASCADE;
```

### Problem: Migration runs but no tables appear
**Solution:** Check you're looking at the correct project. Refresh the Supabase dashboard (Ctrl+R).

---

## 📊 What Gets Created

### Tables (6):
1. **workflows** - Workflow templates created by admin
2. **workflow_executions** - Individual workflow runs per claim
3. **workflow_step_definitions** - Reusable step templates (7 pre-configured)
4. **execution_logs** - Complete audit trail of all actions
5. **admin_settings** - System configuration and templates
6. **document_generations** - Track generated PDF documents

### Functions (3):
1. **log_workflow_action()** - Log any workflow event (used by automation engine)
2. **update_workflow_execution_status()** - Update execution state
3. **get_next_pending_execution()** - Get next workflow to process (for background jobs)

### Views (3):
1. **workflow_execution_stats** - Workflow performance statistics
2. **claims_with_workflow** - Claims with workflow status joined
3. **recent_admin_activity** - Last 100 admin actions for dashboard

### Triggers (4):
- Auto-update `updated_at` timestamp on:
  - workflows
  - workflow_executions
  - admin_settings
  - document_generations

### Indexes (13+):
- Optimized queries for:
  - Finding active workflows
  - Filtering claims by status/company
  - Audit trail searches
  - Workflow execution status checks

---

## 🎯 After Migration Success

Once verified, you can:

1. ✅ Start building admin UI (routes, components)
2. ✅ Create workflows from the admin panel
3. ✅ Execute workflows on claims
4. ✅ View audit logs
5. ✅ Configure system settings

---

## 📞 Need Help?

If migration fails or verification doesn't match expected results:

1. **Check Supabase Dashboard logs** (Logs → Postgres Logs)
2. **Copy error message** exactly
3. **Share with developer** along with which verification step failed
4. **Do NOT retry** migration multiple times (creates duplicates)

---

## ✅ Success Indicators

You'll know the migration succeeded when:

- ✅ SQL Editor shows: "Success. No rows returned"
- ✅ All 6 verification checks pass
- ✅ 7 step definitions visible in `workflow_step_definitions` table
- ✅ 4 settings visible in `admin_settings` table
- ✅ No error messages in Supabase logs

---

## 🚀 Next Step

After successful migration, inform the developer you're ready for:

**Phase 4 - Step 2: Admin Layout & Routes**

The database is now ready to support:
- Admin dashboard
- Workflow builder UI
- Claim management interface
- Automation engine execution

---

**File:** `supabase/phase-4-schema.sql`
**Size:** 500+ lines of SQL
**Execution Time:** 10-15 seconds
**Risk Level:** Low (creates new tables, doesn't modify existing data)
**Rollback:** Safe to drop tables and retry if needed

---

**Created:** 2026-01-03
**Author:** Claude Code
**For:** CashBus Phase 4 Migration
