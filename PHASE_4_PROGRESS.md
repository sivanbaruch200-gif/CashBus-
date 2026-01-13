# Phase 4: Admin Interface & Dynamic Automation Engine - Progress Report

**Status:** 🔄 In Progress (Step 1 Complete)
**Date:** 2026-01-03

---

## Overview

Phase 4 transforms CashBus into a fully automated legal-tech platform with an admin control system for managing claim workflows from incident report to compensation payment.

---

## ✅ STEP 1 COMPLETED: Database & Type Safety

### 1. Database Schema (`supabase/phase-4-schema.sql`)

Created comprehensive SQL migration with **6 new tables**, **11 views**, and **3 helper functions**:

#### **New Tables:**

| Table | Purpose | Key Features |
|-------|---------|--------------|
| `workflows` | Workflow templates created by admin | JSON steps, trigger config, execution stats |
| `workflow_executions` | Individual workflow runs per claim | Status tracking, retry logic, error handling |
| `workflow_step_definitions` | Reusable step templates | 7 pre-populated step types, config schemas |
| `execution_logs` | Audit trail of all actions | Every admin action logged automatically |
| `admin_settings` | Global configuration & templates | Status messages, email templates, PDF templates |
| `document_generations` | Track generated PDFs | File storage, delivery tracking, metadata |

#### **Pre-Populated Step Types:**

1. **אימות נתונים** (Data Verification) - GPS & Ministry API validation
2. **יצירת מכתב התראה** (PDF Generation) - Legal letter creation
3. **עדכון סטטוס** (Status Update) - Claim status & customer notification
4. **שליחת אימייל** (Email Send) - Customer/company email
5. **דרוש אישור מנהל** (Admin Approval Required) - Manual gate
6. **חישוב פיצוי** (Compensation Calculation) - Auto-calculate per תקנה 428ז
7. **קריאה לשירות חיצוני** (Webhook Call) - External integrations

#### **Helper Functions:**

```sql
-- Logging function (called from workflow engine)
log_workflow_action(execution_id, claim_id, action_type, description, details, success, error_message, performed_by, step_name)

-- Update workflow execution status
update_workflow_execution_status(execution_id, status, current_step_index, current_step_name, error_message)

-- Get next pending execution (for automation engine)
get_next_pending_execution()
```

#### **Row Level Security (RLS):**

- ✅ All tables have RLS enabled
- ✅ Admin-only access for workflow management
- ✅ Users can view their own executions and logs
- ✅ System can log all actions (audit trail)

#### **Views for Admin Dashboard:**

1. `workflow_execution_stats` - Execution statistics per workflow
2. `claims_with_workflow` - Claims with workflow status joined
3. `recent_admin_activity` - Last 100 admin actions

---

### 2. TypeScript Interfaces (`lib/supabase.ts`)

Added **7 new TypeScript interfaces** with full type safety:

```typescript
// Core workflow types
interface Workflow - Workflow template definition
interface WorkflowStep - Individual step in workflow
interface WorkflowExecution - Runtime execution state
interface WorkflowStepDefinition - Reusable step templates

// Supporting types
interface ExecutionLog - Audit trail entry
interface AdminSetting - System configuration
interface DocumentGeneration - PDF generation tracking

// Updated existing type
interface Claim - Added workflow-related fields:
  - current_workflow_execution_id
  - workflow_status
  - last_workflow_action_at
  - admin_notes
  - priority
```

---

### 3. Helper Functions (`lib/supabase.ts`)

Added **16 new helper functions** for workflow operations:

#### **Admin Management:**
- `isUserAdmin()` - Check if current user has admin privileges
- `getAllClaimsForAdmin(filters)` - Get all claims with filtering

#### **Workflow Management:**
- `getActiveWorkflows()` - Get all active workflows
- `getWorkflowById(id)` - Get specific workflow
- `createWorkflow(workflow)` - Create new workflow (admin only)
- `updateWorkflow(id, updates)` - Update workflow (admin only)
- `getWorkflowStepDefinitions()` - Get all step templates

#### **Workflow Execution:**
- `startWorkflowExecution(claimId, workflowId)` - Start workflow for claim
- `getWorkflowExecution(executionId)` - Get execution by ID
- `getClaimWorkflowExecutions(claimId)` - Get all executions for claim

#### **Logging & Audit:**
- `logWorkflowAction(...)` - Log any workflow action
- `getClaimExecutionLogs(claimId)` - Get audit trail for claim

#### **Settings Management:**
- `getAdminSetting(key)` - Get setting by key
- `updateAdminSetting(key, value)` - Update setting (admin only)

#### **Document Generation:**
- `createDocumentGeneration(...)` - Record PDF generation

---

## 📋 Pre-Populated Default Settings

The schema includes production-ready default configurations:

### **Status Messages (Hebrew):**
```json
{
  "submitted": "התביעה שלך התקבלה ונמצאת בטיפול",
  "verified": "האירוע אומת מול נתוני משרד התחבורה",
  "rejected": "התביעה נדחתה - פרטים נוספים נשלחו למייל",
  "company_review": "מכתב ההתראה נשלח לחברת האוטובוס",
  "approved": "חברת האוטובוס אישרה את התביעה!",
  "in_court": "התביעה הועברה להליכים משפטיים",
  "settled": "הגענו להסדר עם החברה",
  "paid": "הפיצוי הועבר לחשבונך - מזל טוב!"
}
```

### **Email Templates:**
- `claim_submitted` - Claim received confirmation
- `warning_letter_sent` - Warning letter sent notification

### **PDF Template Configuration:**
- Warning letter header/footer
- Legal citations (תקנה 428ז)
- Photo inclusion settings

### **Automation Config:**
```json
{
  "auto_verify_incidents": true,
  "auto_generate_letters": false,
  "auto_send_emails": false,
  "require_admin_approval_above": 5000,
  "max_retry_attempts": 3,
  "retry_delay_minutes": 30
}
```

---

## 🔐 Security Features

1. **Row Level Security (RLS):** All tables protected
2. **Admin-Only Functions:** Workflow management restricted
3. **Audit Trail:** Every action logged with user ID, timestamp, IP
4. **Graceful Degradation:** Non-critical failures don't block workflows
5. **Retry Logic:** Failed steps retry up to 3 times with delays

---

## 📊 How to Run the Migration

### Step 1: Open Supabase SQL Editor
1. Go to https://app.supabase.com
2. Select your CashBus project
3. Click "SQL Editor" in left sidebar

### Step 2: Run the Migration
1. Copy contents of `supabase/phase-4-schema.sql`
2. Paste into SQL Editor
3. Click "Run" button
4. Wait for success message (should take 10-15 seconds)

### Step 3: Verify Installation
Run this query to check tables were created:
```sql
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
);
```

Should return 6 rows.

### Step 4: Check Pre-Populated Data
```sql
-- Should return 7 step definitions
SELECT COUNT(*) FROM workflow_step_definitions;

-- Should return 4 default settings
SELECT COUNT(*) FROM admin_settings;
```

---

## 🎯 Next Steps (Step 2: Admin Layout)

Now that the database is ready, we'll build:

1. **Admin Route Structure:**
   - `/admin` - Main dashboard
   - `/admin/workflows` - Workflow builder
   - `/admin/claims` - Claims management
   - `/admin/settings` - Configuration

2. **Admin Authentication:**
   - Middleware to check admin status
   - Redirect non-admins to dashboard

3. **Admin Layout Component:**
   - Sidebar navigation (orange accent)
   - Header with admin user info
   - Breadcrumbs
   - Consistent design with brand colors

4. **Basic Dashboard:**
   - Statistics cards (total claims, pending, approved)
   - Recent activity feed
   - Quick actions

---

## 📁 Files Created/Modified

### **New Files:**
- ✅ `supabase/phase-4-schema.sql` (500+ lines)
- ✅ `PHASE_4_PROGRESS.md` (this file)

### **Modified Files:**
- ✅ `lib/supabase.ts` (+400 lines)
  - Added 7 new TypeScript interfaces
  - Added 16 helper functions
  - Updated Claim interface with workflow fields

---

## 🔍 Architecture Highlights

### **Workflow Execution Flow:**

```
1. Admin creates Workflow template (e.g., "Standard Claim Process")
   ↓
2. Workflow triggered manually or automatically when claim created
   ↓
3. WorkflowExecution record created, linked to Claim
   ↓
4. Automation engine processes steps sequentially:
   - Data verification → PDF generation → Email send → Status update
   ↓
5. Each step logged to execution_logs (audit trail)
   ↓
6. If step fails: retry up to 3 times, then mark execution as failed
   ↓
7. Claim status updated throughout process
   ↓
8. Admin can view logs, intervene, or manually approve steps
```

### **Key Design Decisions:**

1. **JSON-based Workflow Steps:** Flexible, no schema changes needed for new step types
2. **Execution Locks:** `FOR UPDATE SKIP LOCKED` prevents concurrent processing
3. **Graceful Failures:** Optional steps can fail without blocking workflow
4. **Audit Everything:** Every action creates an execution log entry
5. **Idempotent Steps:** Steps can be retried safely
6. **Admin Override:** Workflows can be paused for manual approval

---

## 💡 Example Workflow Definition

Here's what a workflow looks like in the database:

```json
{
  "name": "תהליך תביעה סטנדרטי",
  "description": "תהליך אוטומטי לטיפול בתביעות עד 5,000 ₪",
  "trigger_type": "auto_on_claim",
  "trigger_conditions": {
    "max_claim_amount": 5000,
    "bus_companies": ["אגד", "דן", "קווים"]
  },
  "steps": [
    {
      "id": "step-1",
      "step_type": "data_verification",
      "name": "אימות נתוני האירוע",
      "config": {
        "verify_gps": true,
        "verify_bus_line": true
      }
    },
    {
      "id": "step-2",
      "step_type": "compensation_calculation",
      "name": "חישוב פיצוי",
      "config": {
        "include_damages": true
      }
    },
    {
      "id": "step-3",
      "step_type": "pdf_generation",
      "name": "יצירת מכתב התראה",
      "config": {
        "template": "warning_letter",
        "include_photos": true
      }
    },
    {
      "id": "step-4",
      "step_type": "status_update",
      "name": "עדכון לקוח",
      "config": {
        "new_status": "company_review",
        "notify_customer": true
      }
    }
  ]
}
```

---

## ✅ Testing Checklist (Before Phase 5)

After completing admin UI (Step 2), test:

- [ ] SQL migration runs successfully
- [ ] All 6 tables created with correct schema
- [ ] RLS policies working (non-admins can't access workflows)
- [ ] Helper functions callable from TypeScript
- [ ] Step definitions pre-populated (7 types)
- [ ] Admin settings pre-populated (4 settings)
- [ ] Views return correct data
- [ ] Admin user can create workflow
- [ ] Regular user cannot create workflow
- [ ] Workflow execution can be started
- [ ] Execution logs created automatically

---

## 📈 Progress Summary

| Task | Status | Time |
|------|--------|------|
| Database schema design | ✅ Complete | - |
| SQL migration file | ✅ Complete | - |
| TypeScript interfaces | ✅ Complete | - |
| Helper functions | ✅ Complete | - |
| Documentation | ✅ Complete | - |
| **Total Progress** | **25%** | **Step 1/4** |

---

## 🚀 What's Next

**Ready to proceed to Step 2: Admin Layout & Routes**

Once user approves, we'll create:
1. Admin authentication middleware
2. Admin layout component with sidebar
3. Main dashboard page with statistics
4. Navigation between admin routes

**Estimated completion:** Step 2 (Admin Layout) = 25%, Step 3 (Workflow Engine) = 30%, Step 4 (PDF Generator) = 20%

---

**Created:** 2026-01-03
**Last Updated:** 2026-01-03
**Version:** 1.0 (Step 1 Complete)
