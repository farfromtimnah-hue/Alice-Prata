# Alice Prata CRM — Project Rules for Claude Code

_Read this file at the start of every session before touching any code. These rules are non-negotiable unless Alice explicitly overrides them in conversation._

---

## Architecture Facts (Hard Values — Do Not Invent Alternatives)

```
Worker name:        alice-prata-crm-api
Worker URL:         https://alice-prata-crm-api.farfromtimnah.workers.dev
D1 database name:   alice-prata-crm
D1 database ID:     080cb251-6a0e-420d-9865-e2475d9858b5
D1 binding name:    DB              ← always env.DB in Worker code
Firebase project:   alice-prata-crm
Firebase app ID:    1:1073227541806:web:2882047315c1054a7e9ebf
Firebase config:    js/firebase-config.js  ← single source of truth
wrangler.toml:      worker/wrangler.toml
Schema:             worker/schema.sql (applied; use IF NOT EXISTS for any additions)
Working branch:     crm-build
Main branch:        main
Local path:         /Users/nicolel/alice-prata/
```

---

## Authentication Rules

1. **The Worker never stores Firebase credentials.** JWT verification uses the Google JWK public endpoint (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) and Web Crypto API (RSASSA-PKCS1-v1_5, SHA-256). No Firebase Admin SDK. No service account key.

2. **All CRM endpoints require a valid Firebase ID token.** The token is passed as `Authorization: Bearer <token>` in every protected request. `crm.apiFetch()` in `auth.js` handles this automatically.

3. **The CRM login page (`crm/login.html`) does NOT load `auth.js`.** It initializes Firebase directly. `auth.js` is only for authenticated CRM pages (index, lead, profile).

4. **`auth.js` hides the page body (`document.documentElement.style.visibility = 'hidden'`) until auth state resolves.** This prevents flash of protected content. Do not remove this pattern.

5. **`onAuthStateChanged` fires asynchronously.** Each page's JS sets `crm.onAuthReady` as a callback before auth fires. Board, lead, and profile JS files depend on this ordering — scripts load synchronously so the callback is always set before Firebase resolves.

6. **Never use `auth.currentUser` directly without checking for null.** Always use `crm.getIdToken()` which handles the null case.

7. **Token expiry:** Firebase ID tokens expire after 1 hour. `getIdToken(false)` returns a cached token; Firebase auto-refreshes. If a 401 is returned from the Worker, `crm.apiFetch` redirects to login.

---

## Database Rules

1. **D1 binding name is `DB` everywhere.** In Worker code: `env.DB`. In `wrangler.toml`: `binding = "DB"`. Never use a different name.

2. **All D1 queries use prepared statements with `.bind()`.** No string interpolation into SQL. No exceptions.

3. **Schema changes:** Always add new columns or tables using `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` or `CREATE TABLE IF NOT EXISTS`. Never rewrite schema.sql from scratch and re-run it (it uses `CREATE TABLE IF NOT EXISTS` / `INSERT OR IGNORE` for safety, but `ALTER TABLE` additions must be run separately via `wrangler d1 execute --remote`).

4. **Foreign keys:** `PRAGMA foreign_keys = ON` is set in schema.sql. Respect referential integrity. Leads deleted → cascade to activity_log, appointments, policies, notes. Lead deleted → SET NULL on submissions.lead_id and referral_contacts.from_lead_id.

5. **`referral_contacts.consent_granted`:** This column MUST be 1 before a referral contact can be used for outreach. The `GET /api/crm/referrals` endpoint enforces `WHERE consent_granted = 1`. Never bypass this filter. This is a business rule, not just a UI preference.

6. **`agent_profile` is a single-row table (id=1).** It was seeded with `INSERT OR IGNORE INTO agent_profile (id) VALUES (1)`. Always use `UPDATE ... WHERE id=1`. Never INSERT a second row.

7. **Timestamps** are stored as ISO-8601 strings using SQLite's `datetime('now')`. Never use Unix timestamps in D1.

8. **`submissions` table stores raw form payloads as JSON strings.** When reading back, parse with `JSON.parse()`. The Worker stores sanitized payloads, not raw user input.

---

## Worker Code Rules

1. **No external libraries or npm packages.** The Worker uses vanilla JS. No `import` from npm. No `package.json` needed. Firebase SDK is not available in the Worker — JWT is verified manually.

2. **Sanitization before every D1 write.** Use `sanitizeText()`, `sanitizePhone()`, `sanitizeEmail()` for all user-supplied values. These are defined at the top of `worker/src/index.js`.

3. **Deduplication guard on public form submissions.** Check `submissions` table for the same phone + source within the last 10 minutes before creating a new lead. Return `{ success: true, deduplicated: true }` if duplicate. Do not return an error.

4. **CORS:** The `corsHeaders` object must be included in every response. The Worker reads `ALLOWED_ORIGINS` from env vars (set in `wrangler.toml`). Currently: `https://farfromtimnah-hue.github.io,http://localhost:8080`. Add `localhost:PORT` for local dev as needed.

5. **Public endpoints do not require auth.** `/api/submit/*` routes are called by public landing pages that have no Firebase session.

6. **Error responses:** Use the `err(msg, status)` helper. Never expose stack traces or internal DB errors to clients. The Worker has a top-level try/catch that returns a generic 500.

7. **Meeting outcome automation** lives in `saveAppointment()`:
   - `sale` → moves lead to `application_started`
   - `cut_short` → moves lead to `needs_reschedule`
   - `no_sale` / `not_qualified` → no auto-move; agent must manually archive

---

## Form Submission Rules

1. **Three public forms, three different payloads.** Do not assume they share fields.
   - `landing-insurance.html` → `POST /api/submit/landing-insurance` → fields: firstName, lastName, phone, email, kids (from `children` select), hasInsurance
   - `landing-resources.html` → `POST /api/submit/landing-resources` → fields: firstName, lastName, phone, email, insuranceOptIn (0 or 1)
   - `family-emergency-guide.html` → `POST /api/submit/emergency-guide` → flat field names matching form input IDs (p_name, p_phone, uc_1_name, r_consent, etc.)

2. **`phone` and WhatsApp are the same field.** The forms label it "WhatsApp" but it's stored in `leads.phone`. Never create a separate WhatsApp column. The phone number IS the WhatsApp number.

3. **Form submission JS uses `window.submitToApi(endpoint, payload)`** defined in `js/form-submit.js`. Both landing pages include this with `<script src="js/form-submit.js">`. The emergency guide also includes it.

4. **`js/form-submit.js` hardcodes the Worker URL.** If the Worker URL ever changes, update it there.

5. **Never redirect the user on form submission failure.** Show an error message in the current page. The success state hides the form and shows a confirmation.

---

## CRM UI Rules

1. **Language default is PT-BR.** The CRM stores language preference in `localStorage('crm_lang')`. Default when not set: `'pt'`. Never default to English.

2. **Bilingual strings live in `crm/js/i18n.js`** as `window.crm.strings.pt` and `window.crm.strings.en`. Use `crm.t('ui.key')` or `crm.t('stages.stage_code')`. Do not hardcode PT or EN strings in HTML templates in the JS files.

3. **The public pages have two different bilingual systems.** Do not unify them:
   - `landing-insurance.html` uses `.show-pt` / `.show-en` CSS classes + `body.lang-en`
   - `landing-resources.html` + `family-emergency-guide.html` use `[data-lang="en"] .en` / `.pt` CSS pattern + `body.dataset.lang`

4. **CRM pages load scripts in this order:**
   ```html
   <script src="firebase-app-compat.js">   <!-- Firebase App -->
   <script src="firebase-auth-compat.js">  <!-- Firebase Auth -->
   <script src="../js/firebase-config.js"> <!-- defines window.firebaseConfig -->
   <script src="js/i18n.js">              <!-- defines window.crm, crm.t, crm.setLang -->
   <script src="js/auth.js">              <!-- initializes Firebase, sets crm.apiFetch -->
   <script src="js/[page].js">            <!-- sets crm.onAuthReady, runs after auth -->
   ```
   Do not reorder these. Auth guard depends on Firebase SDK being loaded first.

5. **`crm.onAuthReady`** is the entry point for all page logic. It is called by `auth.js` once Firebase confirms the session. Set it in each page's JS file (board.js, lead.js, profile.js).

6. **`crm.apiFetch(endpoint, options)`** is the only way CRM pages should call the API. It attaches the Firebase token automatically and handles 401 → redirect to login.

7. **Color palette (do not deviate):**
   ```css
   --terra-deep: #8C3E2A   /* primary headings, buttons, stage headers */
   --terra:      #B5553F   /* hover states, accents */
   --terra-light:#C76A4F   /* gradients */
   --sand:       #E8D5B7   /* borders, backgrounds */
   --sand-light: #F4E6CD   /* section backgrounds */
   --sand-cream: #FAF3E5   /* page background */
   --ink:        #1A1208   /* text */
   --ink-soft:   #6B4A3A   /* muted text */
   --ochre:      #C9A24A   /* holding stage headers, optional badges */
   ```

---

## CRM Workflow Business Rules

1. **Leads only enter the system via public forms** (currently). There is no "add lead" button in the CRM yet. When one is added, it must use the `POST /api/crm/leads` endpoint (not yet built) and follow the same sanitization rules.

2. **Archiving requires a reason** (except `active_policyholder`). The Worker enforces this: `if (!body.reason && archiveType !== 'active_policyholder') return err('reason required for archive')`.

3. **Moving a lead to `orphan` stage requires confirmation.** The Worker returns `{ requiresConfirmation: true }` and the UI must ask the user to confirm before resending with `{ confirmed: true }`.

4. **`pending_license` stage** is for leads whose state is not in the agent's `licensed_states` table. The Worker does NOT auto-route on form submission yet — this is a pending feature.

5. **Contact log methods:** `texted`, `emailed`, `voicemail`, `no_answer`, `someone_else`. These update `leads.last_contact_method` and `leads.last_contacted_at` in addition to writing to `activity_log`.

6. **Activity log is immutable.** Never delete or edit `activity_log` rows. Only INSERT.

7. **Notes can be pinned/unpinned** (PATCH endpoint). Pinned notes appear first in the list.

---

## Design Direction Rules

1. **No frameworks, no build tools.** All pages are plain HTML with inline or linked CSS/JS. No React, Vue, Svelte, webpack, Vite, etc.

2. **No Bootstrap or external UI libraries.** All CSS is custom, in `crm/css/crm.css` or inline in public page `<style>` tags.

3. **Firebase SDK is loaded from Google's CDN** using the compat (v8 API) version at `https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js`. Do not use the modular (v9+) ES module API — it requires a bundler.

4. **Public pages must not break existing layout.** The CSS in `landing-insurance.html`, `landing-resources.html`, and `family-emergency-guide.html` is embedded in `<style>` tags. Do not move it to external files. Do not restructure the HTML layout.

5. **The logo file is `alice-prata-logo.png`** in the repo root. Public pages reference it as `alice-prata-logo.png`. CRM pages reference it as `../alice-prata-logo.png`.

---

## Contact Priority Rules

1. **Phone is primary contact method.** It is also the WhatsApp number. Always show phone first.
2. **Email is secondary.** It is optional on all three forms.
3. **The `leads.phone` column stores the WhatsApp number.** Do not create a separate WhatsApp field.
4. **Quick-log buttons** in the CRM (texted, emailed, voicemail, no_answer, someone_else) map to the `action_type` values in `activity_log`. They also update `leads.last_contact_method`.

---

## Security Rules

1. **No secrets in client-side code.** Firebase public web config values are safe. Firebase Admin SDK, D1 connection strings, and any private API keys must never appear in client code.

2. **Firebase project ID is not sensitive** and is stored in `wrangler.toml` as a `[vars]` entry, not a secret.

3. **ALLOWED_ORIGINS controls CORS.** Do not set `Access-Control-Allow-Origin: *` on the Worker. The current allowed origins are `https://farfromtimnah-hue.github.io` and `http://localhost:8080`.

4. **Referral contacts with `consent_granted = 0` must never be surfaced for outreach.** The API endpoint enforces this. Do not add any endpoint that returns unconsented referrals.

5. **The CRM is not publicly accessible** — all `/api/crm/*` routes return 401 without a valid Firebase token. Do not add unauthenticated CRM routes.

---

## Do Not Assume

- **Do not assume the Worker URL is correct** without checking `worker/wrangler.toml`. It has been stable but confirm before coding against it.
- **Do not assume schema changes are safe to re-run.** `schema.sql` uses `CREATE TABLE IF NOT EXISTS` and `INSERT OR IGNORE` which are idempotent for the seed data, but `ALTER TABLE` statements must be run separately.
- **Do not assume the three public forms have the same fields.** They do not. Always check the HTML before writing a form handler.
- **Do not assume the bilingual system is consistent across pages.** There are two different CSS patterns. Read the specific page before editing lang toggle logic.
- **Do not assume all leads have both phone and email.** Email is optional. Phone is required but the Worker accepts a lead with `phone = ''` from the emergency guide (since the guide doesn't require it).
- **Do not assume `crm.onAuthReady` has been called** from within the auth.js onAuthStateChanged callback — it's called by auth.js. Each page's JS must set `crm.onAuthReady` before Firebase auth resolves (which it always does because auth is async and scripts load synchronously before it fires).
- **Do not assume `localStorage` is available** in all contexts. The CRM uses `localStorage` for lang preference and the guide uses it for auto-save. Handle errors gracefully.
- **Do not assume the D1 limit of 500 leads is sufficient forever.** The Worker caps `limit` at 500. If the lead count grows past that, pagination must be added.
- **Do not assume all environment variables are set.** `FIREBASE_PROJECT_ID` and `ALLOWED_ORIGINS` are in `wrangler.toml` as `[vars]`. No other secrets are currently set.

---

## Before Editing Critical Logic

### Before changing any form submission path (`/api/submit/*`):
1. Read the full `handleLanding*` or `handleEmergencyGuide` function in `worker/src/index.js`
2. Check the deduplication guard — it queries `submissions` by phone + source + 10-minute window
3. Check what fields the corresponding HTML form actually sends (read the HTML)
4. Verify `sanitizePhone()` behavior: strips non-digits, rejects < 7 or > 15 digits
5. Test after deploy: submit the form and check D1 for a new `leads` row and `submissions` row

### Before changing Firebase auth logic (`crm/js/auth.js`, `crm/login.html`):
1. Verify the Firebase SDK compat version is still being used (not modular)
2. Check that `firebase.apps.length` guard prevents double-initialization
3. Verify `onAuthStateChanged` still calls `crm.onAuthReady` when user is present
4. Verify redirect target (`login.html`) is reachable from the current page's directory (relative URL)

### Before changing Worker JWT verification (`verifyFirebaseToken` in `worker/src/index.js`):
1. Do not touch the JWK URL — it is the correct Google endpoint for Firebase tokens
2. Do not change the algorithm (`RSASSA-PKCS1-v1_5`, `SHA-256`) — these are what Firebase uses
3. Do not remove the `exp`, `aud`, or `iss` checks — these are required security validations
4. The `cachedKeys` / `cachedKeysExpiry` pattern is intentional — keys are cached 1 hour in memory

### Before changing D1 write paths (any endpoint that runs INSERT or UPDATE):
1. Verify all user-supplied values pass through `sanitizeText()`, `sanitizePhone()`, or `sanitizeEmail()`
2. Verify the query uses `.bind()` — never string interpolation
3. Verify the `updated_at=datetime('now')` is included in UPDATE statements on `leads`
4. For stage changes: verify `activity_log` gets a corresponding `stage_changed` row

### Before changing the referral consent logic:
1. The rule is absolute: `consent_granted = 1` only when `r_consent === 'yes'`
2. Even if consent is not given, contacts are still stored with `consent_granted = 0` (for the lead's own emergency guide record)
3. The `GET /api/crm/referrals` endpoint must always include `WHERE consent_granted = 1`
4. No UI should ever display consent_granted=0 contacts in the referrals view

---

_Last updated: 2026-05-26_
