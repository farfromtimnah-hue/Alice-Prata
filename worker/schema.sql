-- Alice Prata CRM — D1 Schema
-- Run with: wrangler d1 execute alice-prata-crm --file=worker/schema.sql --remote
-- Binding name: DB
-- Database ID: 080cb251-6a0e-420d-9865-e2475d9858b5

PRAGMA foreign_keys = ON;

-- ─────────────────────────────────────────────────────────────
-- PIPELINE STAGES  (reference table, seeded below)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_stages (
  code       TEXT PRIMARY KEY,
  name_pt    TEXT NOT NULL,
  name_en    TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  type       TEXT NOT NULL CHECK(type IN ('active','holding','archive'))
);

-- ─────────────────────────────────────────────────────────────
-- LEADS  (normalized core record)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  phone                TEXT NOT NULL,        -- primary contact + WhatsApp (same number)
  email                TEXT,
  source_page          TEXT NOT NULL,        -- 'landing-insurance' | 'landing-resources' | 'emergency-guide' | 'referral'
  source_form          TEXT,                 -- additional form identifier if needed
  stage                TEXT NOT NULL DEFAULT 'new_lead' REFERENCES pipeline_stages(code),
  licensed_state       TEXT,                 -- US state (two-letter code)
  kids                 TEXT,                 -- 'yes_minor' | 'yes_adult' | 'no' | null
  has_insurance        TEXT,                 -- 'yes' | 'no' | 'unsure' | null
  insurance_opt_in     INTEGER DEFAULT 0,    -- from resources landing: interested in insurance?
  language_pref        TEXT DEFAULT 'pt',    -- 'pt' | 'en' | 'both'
  quiz_recommendation  TEXT,                 -- dollar range from landing quiz
  archive_type         TEXT CHECK(archive_type IN ('no_sale','active_policyholder','not_qualified') OR archive_type IS NULL),
  archive_reason       TEXT,
  archived_at          TEXT,                 -- ISO-8601
  became_client_at     TEXT,                 -- ISO-8601 (when policy delivered/active)
  last_contact_method  TEXT CHECK(last_contact_method IN ('texted','emailed','voicemail','no_answer','someone_else') OR last_contact_method IS NULL),
  last_contacted_at    TEXT,                 -- ISO-8601
  is_orphan            INTEGER DEFAULT 0,    -- 1 if missing usable contact info
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_stage   ON leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_phone   ON leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_name    ON leads(name);

-- ─────────────────────────────────────────────────────────────
-- SUBMISSIONS  (raw form payloads, one row per submission)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  source_page  TEXT NOT NULL,
  source_form  TEXT,
  raw_payload  TEXT NOT NULL,      -- JSON blob of all form fields
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_submissions_lead ON submissions(lead_id);

-- ─────────────────────────────────────────────────────────────
-- REFERRAL CONTACTS
-- Populated from Section 2 (US Contacts) of the emergency guide
-- when referral_consent = 'yes' and the specific contact is checked.
-- RULE: consent_granted must be 1 before this record is surfaced for outreach.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_contacts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  from_lead_id    INTEGER REFERENCES leads(id) ON DELETE SET NULL,  -- who provided this referral
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  relation        TEXT,
  state           TEXT,                    -- US state code
  consent_granted INTEGER NOT NULL DEFAULT 0,  -- MUST be 1 to use for outreach
  consent_source  TEXT DEFAULT 'emergency-guide',
  lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,  -- if they become a lead
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_referrals_consent ON referral_contacts(consent_granted);
CREATE INDEX IF NOT EXISTS idx_referrals_from    ON referral_contacts(from_lead_id);

-- ─────────────────────────────────────────────────────────────
-- ACTIVITY LOG  (immutable event stream per lead)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id      INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  action_type  TEXT NOT NULL,
  -- action_type values:
  --   outreach:  'texted' | 'emailed' | 'voicemail' | 'no_answer' | 'someone_else'
  --   pipeline:  'stage_changed' | 'archived' | 'unarchived'
  --   content:   'note_added' | 'note_pinned'
  --   meetings:  'appointment_set' | 'appointment_changed' | 'meeting_outcome'
  --   policies:  'policy_created' | 'policy_updated'
  --   system:    'lead_created' | 'referral_linked'
  notes        TEXT,
  old_stage    TEXT,
  new_stage    TEXT,
  created_by   TEXT,       -- agent email
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_lead    ON activity_log(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_type    ON activity_log(action_type);

-- ─────────────────────────────────────────────────────────────
-- APPOINTMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id         INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  scheduled_at    TEXT,               -- ISO-8601
  outcome         TEXT CHECK(outcome IN ('sale','no_sale','not_qualified','cut_short') OR outcome IS NULL),
  outcome_reason  TEXT,
  outcome_at      TEXT,               -- ISO-8601
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_lead ON appointments(lead_id);

-- ─────────────────────────────────────────────────────────────
-- POLICIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policies (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id          INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  carrier          TEXT,
  policy_number    TEXT,
  policy_type      TEXT,
  coverage_amount  TEXT,
  premium          TEXT,
  effective_date   TEXT,
  status           TEXT DEFAULT 'pending' CHECK(status IN ('pending','issued','delivered')),
  notes            TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_policies_lead ON policies(lead_id);

-- ─────────────────────────────────────────────────────────────
-- NOTES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id     INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_pinned   INTEGER DEFAULT 0,
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_lead ON notes(lead_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- AGENT PROFILE  (single row, id=1)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_profile (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  name            TEXT,
  email           TEXT,
  phone           TEXT,
  business_name   TEXT,
  manager_name    TEXT,
  manager_phone   TEXT,    -- used for "Ask for help" WhatsApp button
  nmls            TEXT,
  license_number  TEXT,
  language_pref   TEXT DEFAULT 'pt',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────
-- LICENSED STATES
-- Used to route leads: if lead's state not in this table -> Pending License
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licensed_states (
  state_code  TEXT PRIMARY KEY,
  state_name  TEXT NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────
-- CARRIER CONTACTS  (reused in policy cards)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carrier_contacts (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  name                 TEXT NOT NULL,
  claims_phone         TEXT,
  general_phone        TEXT,
  email                TEXT,
  underwriting_contact TEXT,
  policy_issue_contact TEXT,
  portal_url           TEXT,
  notes                TEXT,
  sort_order           INTEGER DEFAULT 0,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────────────────────────

INSERT OR IGNORE INTO pipeline_stages VALUES
  ('new_lead',                 'Novo Lead',               'New Lead',                1, 'active'),
  ('contacted',                'Contato Feito',            'Contacted',               2, 'active'),
  ('appointment_scheduled',    'Reunião Marcada',          'Appointment Scheduled',   3, 'active'),
  ('needs_reschedule',         'Reagendar',                'Needs Reschedule',        4, 'active'),
  ('application_started',      'Aplicação Iniciada',       'Application Started',     5, 'active'),
  ('application_submitted',    'Aplicação Enviada',        'Application Submitted',   6, 'active'),
  ('policy_pending',           'Apólice Pendente',         'Policy Pending',          7, 'active'),
  ('policy_issued',            'Apólice Emitida',          'Policy Issued',           8, 'active'),
  ('policy_delivered',         'Apólice Entregue',         'Policy Delivered',        9, 'active'),
  ('pending_license',          'Aguardando Licença',       'Pending License',        10, 'holding'),
  ('orphan',                   'Lead Órfão',               'Orphan Lead',            11, 'holding'),
  ('archive_no_sale',          'Arquivo — Sem Venda',      'Archive — No Sale',      12, 'archive'),
  ('archive_active_policyholder','Arquivo — Segurado Ativo','Archive — Active Policyholder',13,'archive'),
  ('archive_not_qualified',    'Arquivo — Não Qualificado','Archive — Not Qualified',14, 'archive');

INSERT OR IGNORE INTO agent_profile (id) VALUES (1);
