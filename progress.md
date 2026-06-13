# Alice Prata CRM — Project Progress

_This file is the canonical session-continuity record. Update it at the start of every session and after every major completed task. Written for future Claude Code sessions._

---

## Project Overview

Building a full CRM system for Alice Prata, a licensed life insurance agent serving Brazilian families in Tampa, FL. The project converts a static GitHub Pages site into an authenticated, data-driven CRM with a Kanban-style pipeline board.

**Audience:** Solo agent (Alice). No multi-user requirement. Firebase Auth locks the CRM to her account(s) only.

**Language:** PT-BR default throughout. EN secondary, toggleable. Never replace PT with EN as default.

---

## Current Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend (public) | Plain HTML/CSS/JS | No build tools. No frameworks. |
| Frontend (CRM) | Plain HTML/CSS/JS | Same. Firebase SDK via CDN compat. |
| API | Cloudflare Worker (vanilla JS) | `alice-prata-crm-api` |
| Database | Cloudflare D1 (SQLite) | Binding: `DB` |
| Auth | Firebase Authentication | Email/Password + Google Sign-In |
| Hosting | GitHub Pages | `farfromtimnah-hue.github.io/Alice-Prata/` |
| Repo | GitHub | `https://github.com/farfromtimnah-hue/Alice-Prata` |

---

## Confirmed Infrastructure Values

These are real, deployed values. Do not invent or guess alternatives.

```
Worker name:        alice-prata-crm-api
Worker URL:         https://alice-prata-crm-api.farfromtimnah.workers.dev
D1 database name:   alice-prata-crm
D1 database ID:     080cb251-6a0e-420d-9865-e2475d9858b5
D1 binding name:    DB
Firebase project:   alice-prata-crm
Firebase auth URL:  alice-prata-crm.firebaseapp.com
GitHub Pages base:  https://farfromtimnah-hue.github.io/Alice-Prata/
Working branch:     crm-build
Main branch:        main
Local clone:        /Users/nicolel/alice-prata/
```

**Firebase public config** (safe to include in client code):
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyDybZm3RIBLdP7UEvPFVIWLeKPI8AS7Ric",
  authDomain: "alice-prata-crm.firebaseapp.com",
  projectId: "alice-prata-crm",
  storageBucket: "alice-prata-crm.firebasestorage.app",
  messagingSenderId: "1073227541806",
  appId: "1:1073227541806:web:2882047315c1054a7e9ebf"
};
```

---

## File Map

```
/Users/nicolel/alice-prata/
├── alice-prata-logo.png          # Logo asset (used in CRM nav)
├── IMG_6138.jpeg                 # Alice photo (landing page)
├── landing-insurance.html        # Public form A — insurance inquiry
├── landing-resources.html        # Public form B — free resources
├── family-emergency-guide.html   # Public form C — emergency guide
├── will-kit.html                 # Internal tool (do not break)
├── carrier-reference.html        # Internal agent resource (do not break)
├── state-licensing.html          # Internal agent resource (do not break)
├── Minnect.html                  # Internal page (do not break)
├── js/
│   ├── firebase-config.js        # Shared Firebase public config
│   └── form-submit.js            # Shared fetch helper (window.submitToApi)
├── crm/
│   ├── login.html                # Firebase login page
│   ├── index.html                # Kanban board
│   ├── lead.html                 # Lead detail page (uses ?id=N)
│   ├── profile.html              # Agent profile + settings
│   ├── css/crm.css               # All CRM styles
│   └── js/
│       ├── auth.js               # Firebase auth guard + crm.apiFetch
│       ├── i18n.js               # Bilingual strings + crm.t()
│       ├── board.js              # Board data load + Kanban render
│       ├── lead.js               # Lead detail logic + modals
│       └── profile.js            # Profile/settings/carriers/states/referrals
└── worker/
    ├── wrangler.toml             # Worker config (D1 binding, env vars)
    ├── schema.sql                # D1 schema (run once; use IF NOT EXISTS)
    └── src/
        └── index.js              # Full Cloudflare Worker (~845 lines)
```

---

## 14 Pipeline Stages (seeded in D1)

| Code | PT Name | Type |
|---|---|---|
| new_lead | Novo Lead | active |
| contacted | Contato Feito | active |
| appointment_scheduled | Reunião Marcada | active |
| needs_reschedule | Reagendar | active |
| application_started | Aplicação Iniciada | active |
| application_submitted | Aplicação Enviada | active |
| policy_pending | Apólice Pendente | active |
| policy_issued | Apólice Emitida | active |
| policy_delivered | Apólice Entregue | active |
| pending_license | Aguardando Licença | holding |
| orphan | Lead Órfão | holding |
| archive_no_sale | Arquivo — Sem Venda | archive |
| archive_active_policyholder | Arquivo — Segurado Ativo | archive |
| archive_not_qualified | Arquivo — Não Qualificado | archive |

---

## D1 Tables (all created, schema.sql applied 2026-05-26)

- `pipeline_stages` — 14 rows seeded
- `leads` — core lead record
- `submissions` — raw form payloads (one per submission)
- `referral_contacts` — from emergency guide; `consent_granted` column enforces outreach rules
- `activity_log` — immutable append-only event stream per lead
- `appointments` — scheduled + outcome tracking
- `policies` — carrier, number, type, coverage, premium, status
- `notes` — pinnable text notes per lead
- `agent_profile` — single row (id=1), seeded empty
- `licensed_states` — drives "Pending License" routing
- `carrier_contacts` — reused in policy cards + profile page

---

## Worker Endpoints

### Public (no auth)
```
POST /api/submit/landing-insurance
POST /api/submit/landing-resources
POST /api/submit/emergency-guide
```

### Protected (Firebase JWT required — Bearer token in Authorization header)
```
GET    /api/crm/leads                     list/search (stage, search, source, sort, limit)
GET    /api/crm/leads/:id                 full lead detail with activity, notes, appointments, policies
POST   /api/crm/leads/:id/stage           move stage (orphan guard: requiresConfirmation)
POST   /api/crm/leads/:id/activity        log outreach contact method
POST   /api/crm/leads/:id/note            add note
PATCH  /api/crm/leads/:id/note/:nid       edit/pin note
GET    /api/crm/leads/:id/notes           list notes
POST   /api/crm/leads/:id/appointment     create appointment OR log outcome
POST   /api/crm/leads/:id/policy          create or update policy
POST   /api/crm/leads/:id/archive         archive with type + reason
GET    /api/crm/referrals                 consented referrals only (consent_granted=1)
GET    /api/crm/profile                   agent profile
PATCH  /api/crm/profile                   update profile fields
GET    /api/crm/licensed-states           list
POST   /api/crm/licensed-states           add state
DELETE /api/crm/licensed-states/:code     remove state
GET    /api/crm/carriers                  list
POST   /api/crm/carriers                  add carrier
PATCH  /api/crm/carriers/:id              edit carrier
DELETE /api/crm/carriers/:id             delete carrier
GET    /api/crm/stages                    list all pipeline stages
```

### Key workflow automation (in Worker)
- Appointment outcome `sale` → auto-moves lead to `application_started`
- Appointment outcome `cut_short` → auto-moves lead to `needs_reschedule`
- `no_sale` / `not_qualified` → must manually archive via `/archive`
- Moving to `orphan` stage returns `requiresConfirmation: true` if `confirmed` not sent
- Moving to `archive_*` stages auto-sets `archived_at`, `archive_type`, `became_client_at` (for active_policyholder)

---

## Completed Tasks

### Session 1 (context window exhausted before this file was created)
- [x] Audited all existing HTML files
- [x] Identified the three public form sources and their fields
- [x] Identified bilingual patterns (two different CSS systems across pages — do not unify)
- [x] Created `worker/schema.sql` — complete D1 schema with all 11 tables
- [x] Created `worker/wrangler.toml` — Worker config
- [x] Created `worker/src/index.js` — full Cloudflare Worker (~845 lines)

### Session 3 (2026-05-26)
- [x] Rewrote `crm/css/crm.css` — dark glassmorphic premium design system (near-black base, frosted glass panels, warm accent `#c4876a`, backdrop-filter blur, all class names preserved)
- [x] Updated `claude-project-rules.md` — replaced old terracota palette with full dark glass token system
- [x] Updated `handoff.md` and `progress.md` to reflect Session 3 state
- [x] Visual QA pass across all four pages (login, board, lead detail, profile) at desktop and mobile (375px)
- [x] Fixed 6 issues found in QA:
  - Bug: nav overflows on mobile — added `@media (max-width:640px)` to hide email, hide nav-title, tighten gap
  - Bug: lead header grid not collapsing on mobile — added mobile override to stack `1fr` + clear `min-width`
  - Minor: sticky col-header offset was 3px short — corrected to `calc(var(--nav-h) + 56px)`; mobile gets `93px` for 2-row toolbar
  - Polish: Kanban column header tints too subtle — bumped active 8→12%, holding 7→10%, archive 12→16% opacity
  - Polish: board section label opacity raised 0.4 → 0.55 for legibility
  - Polish: column header border opacity bumped to match tint increase
- [x] **iOS/Safari full hardening pass** — applied across ALL pages (CRM + public forms):
  - `crm/css/crm.css`: `-webkit-fill-available` on html/body; `100dvh` fallbacks; `env(safe-area-inset-*)` on nav, toolbar, board, modal, toast, login; modal becomes bottom sheet at ≤640px (`92dvh`, rounded top); all form controls at `1rem` (16px) to prevent iOS auto-zoom; `44×44px` touch targets on all interactive elements; `-webkit-appearance: none` and tap-highlight reset globally; `-webkit-overflow-scrolling: touch` on scroll containers
  - All 4 CRM HTML pages: `viewport-fit=cover`, `format-detection`, Apple PWA meta tags
  - `landing-insurance.html`: `viewport-fit=cover`, `format-detection`, safe-area on fixed lang-bar + hero offset + sticky-cta bottom, `-webkit-appearance` on inputs, 44px touch targets
  - `landing-resources.html`: same as insurance (same structure, hero uses 90px offset)
  - `family-emergency-guide.html`: `viewport-fit=cover`, `format-detection`, safe-area on sticky topbar, **CRITICAL: input.fi font-size bumped 0.92rem → 1rem** (was causing iOS auto-zoom), 44px touch targets, safe-area bottom on footer/print-cta
- [x] **Access control — allowlist enforcement**:
  - `crm/js/auth.js`: added `APPROVED_EMAILS` check; unapproved sessions signed out and redirected to `login.html?error=unauthorized` (page stays hidden throughout — no content flash)
  - `crm/login.html`: same allowlist check on login page itself (prevents double-navigation bounce); `?error=unauthorized` param shows clear error message and cleans URL; added `auth/invalid-credential` error code; subtitle updated to "acesso por convite"

### Session 2 (2026-05-26)
- [x] Created `js/firebase-config.js` — shared Firebase public config
- [x] Created `js/form-submit.js` — shared `window.submitToApi()` helper
- [x] Updated `landing-insurance.html` — real fetch to `/api/submit/landing-insurance`
- [x] Updated `landing-resources.html` — real fetch to `/api/submit/landing-resources`
- [x] Updated `family-emergency-guide.html` — "Send to Alice" button with `collectGuidePayload()` + Worker POST
- [x] Created `crm/css/crm.css` — full CRM stylesheet (terracota palette, Trello-like)
- [x] Created `crm/js/i18n.js` — bilingual strings + `crm.t()` + `crm.setLang()`
- [x] Created `crm/js/auth.js` — Firebase auth guard + `crm.apiFetch()` + `crm.getIdToken()`
- [x] Created `crm/login.html` — Firebase Email/Password + Google Sign-In
- [x] Created `crm/index.html` + `crm/js/board.js` — Kanban board with 14 columns, search, sort, source filter
- [x] Created `crm/lead.html` + `crm/js/lead.js` — Lead detail: contact log, stage mover, notes, appointments, policies, archive modal
- [x] Created `crm/profile.html` + `crm/js/profile.js` — Agent profile, licensed states, carrier contacts, consented referrals
- [x] Applied D1 schema to live database (`wrangler d1 execute --remote` — 26 queries, 67 rows written)
- [x] Deployed Worker to Cloudflare (`wrangler deploy` — version bb9b4821)
- [x] Committed all files to `crm-build` branch and pushed to GitHub
- [x] Created `progress.md`, `claude-project-rules.md`, `handoff.md` (this session)

---

## Completed Tasks (continued)

### Session 4 (2026-06-13) — Pending License Workflow + Board Tabs
- [x] **D1 migration** — added `pending_license_status` (NULL|'applying'|'waiting') and `pending_license_unread` (0/1) columns to `leads`. Applied to live D1 (`migrations/2026-06-13_pending_license.sql`); also reflected in `worker/schema.sql`.
- [x] **STATE_LICENSING_DATA** constant in `worker/src/index.js` — all 50 states + DC with non-resident fee, special requirements, and NIPR/Sircon routing (sourced from `state-licensing.html`). Special requirements only for CA, GA, NY; NY routes direct to dfs.ny.gov (no NIPR/Sircon).
- [x] **Worker API**:
  - `GET /api/crm/state-info/:stateCode` — returns fee/requirements/nipr/sircon/url; 404 if unknown.
  - `POST /api/crm/leads/:id/license-decision` — sets `pending_license_status`, clears unread, logs `license_decision` activity, returns updated lead.
  - `licensed-states` POST now auto-promotes any `pending_license` leads whose `licensed_state` matches the newly added state → `new_lead` (clears pending fields, logs activity), and returns `promoted_leads` count.
  - Deployed (`wrangler deploy`, version `c17aeb01-...`).
- [x] **Board tab system** (`board.js` + `crm.css`) — Active / Holding / Archive tabs replace the vertical scroll-through sections. Each tab shows a lead-count badge; Holding shows a red "New/Nova" badge when any `pending_license` lead is unread. `clearPendingBadge()` stores `crm_holding_last_viewed` in localStorage on Holding click; badge re-evaluates against DB on each board load.
- [x] **Pending license decision UI** (`lead.js` + `crm.css`) — for `pending_license` leads, a "License Decision" section under the contact-log buttons: shows "{State} — $fee" + requirements (only if any), two decision buttons (pre-selected from `pending_license_status`). "Applying" reveals an info panel with NIPR/Sircon/state-URL links + requirement reminders; "Waiting" hides it. Both clear the unread flag.
- [x] **NPN rename** — `NMLS` field relabeled to `NPN (National Producer Number)` in `profile.js` (input id `p_npn`). Value still persists in the existing `nmls` DB column (no column migration scoped).
- [x] **Auto-promotion feedback** — `addState()` shows a toast "{n} lead(s) moved to active pipeline!" when the API returns `promoted_leads > 0`.
- [x] **Horizontal scroll** — `.board-scroll` columns container set to `display:flex; flex-direction:row; overflow-x:auto; -webkit-overflow-scrolling:touch`; `.board-col` keeps `flex-shrink:0`. No color/size/padding changes.
- [x] i18n: added `tab_active`, `tab_holding`, `tab_archive`, `badge_unread` (PT + EN).

---

## Pending Tasks

### Deployment
- [ ] **Merge `crm-build` into `main`** so GitHub Pages serves the CRM
- [ ] **Add `farfromtimnah-hue.github.io` to Firebase authorized domains** (Firebase Console → Authentication → Settings → Authorized domains) — required for Google Sign-In to work

### Known gaps / not yet built
- [ ] `docs/PITFALLS.md` — reference doc for common D1/Worker/form mistakes (mentioned in original spec)
- [ ] Lead creation from within the CRM (currently leads only come from public forms)
- [ ] Bulk search/filter view (currently board filters client-side; no server-side pagination UI beyond limit param)
- [ ] Print-optimized lead card / export
- [ ] Orphan lead detection automation (currently manual — agent sets `is_orphan` or moves to orphan stage)
- [ ] Referral contact → lead linking (`referral_contacts.lead_id` column exists but no UI to link)
- [ ] Email/phone de-dupe warning when a phone number already exists in leads
- [ ] Quiz recommendation field surfaced in lead creation UI (currently only set from form payloads)
- [ ] Licensed state auto-routing: when a lead comes in from a state not in `licensed_states`, auto-move to `pending_license` (currently schema supports this but Worker doesn't auto-route on submission)

### Testing not yet done
- [ ] End-to-end form submission test (submit landing-insurance form → verify lead appears in CRM board)
- [ ] Firebase Google Sign-In on GitHub Pages (requires authorized domain step above)
- [ ] CRM board rendering on mobile
- [ ] **Authenticated UI test of Session 4 work** — tabs, holding badge, license-decision section, and auto-promotion were not verified in a live logged-in browser (preview is auth-gated). Syntax-checked + endpoints confirmed reachable (401, not 404).

### Known issues / discovered during Session 4
- **NPN stored in `nmls` column** — the UI now says NPN but the value persists in the legacy `agent_profile.nmls` column and is sent over the wire as `nmls`. A future cleanup could migrate the column + worker whitelist to `npn` for full consistency.
- **Cross-page holding badge** — the board badge is driven by `pending_license_unread` in the DB (authoritative). `lead.js` writes `crm_holding_last_viewed` to localStorage as a best-effort signal, but the badge truly refreshes only on the next board load (board and lead are separate pages). Acceptable, but not a live push.
- **Auto-promotion uses `licensed_state`** — auto-promotion matches `leads.licensed_state` (case-insensitive) against the newly added state code. Leads in `pending_license` without a `licensed_state` set will not be auto-promoted. The existing schema gap (no auto-route INTO `pending_license` on submission) is still open (see above).
- **state-info has no state name** — `GET /api/crm/state-info/:code` returns fee/requirements/routing only; the display name comes from a `STATE_NAMES` map in `lead.js`. Keep the two in sync if states change.

---

## Blockers / Open Questions

1. **Firebase authorized domain** — Google Sign-In will fail on GitHub Pages until `farfromtimnah-hue.github.io` is added to Firebase Console → Authentication → Settings → Authorized domains. Email/password login will still work.

2. **`crm-build` not yet merged to `main`** — GitHub Pages currently serves old `main` branch. CRM is not publicly accessible yet.

3. **No lead creation from CRM UI** — leads only enter via the three public forms. If Alice needs to manually add a lead (referral call, in-person meeting), there's no "Add lead" button in the CRM yet.

---

## Last Known Working State (2026-05-26)

- Worker deployed and responding: `curl -X OPTIONS https://alice-prata-crm-api.farfromtimnah.workers.dev/api/submit/landing-insurance` returns 204 with correct CORS headers
- D1 database: 11 tables, 14 pipeline stages, 1 agent_profile row (empty)
- All code committed to `crm-build` (HEAD: `95f6aa1` — iOS hardening public pages)
- `crm-build` NOT yet pushed to remote after Session 3 work — push before merging to main

---

## Last Updated

2026-06-13, end of Session 4 (pending license workflow, board tabs, NPN rename, auto-promotion, horizontal scroll). Worker deployed (version `c17aeb01-...`); D1 migration applied to live DB; all changes committed + pushed to `main`.
