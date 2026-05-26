# Handoff — Alice Prata CRM

_Rewritten at the end of each major work block. Read this first when resuming._

---

## Just Completed (2026-05-26, Session 2)

Everything in the original build plan through Phase 6 is done and deployed:

- Full Cloudflare Worker live at `https://alice-prata-crm-api.farfromtimnah.workers.dev`
- D1 schema applied — 11 tables, 14 pipeline stages seeded, agent_profile initialized
- All three public forms wired to Worker (landing-insurance, landing-resources, emergency-guide)
- Full CRM shell: login, Kanban board, lead detail, profile/settings pages
- All code committed to `crm-build` branch and pushed to GitHub
- `progress.md`, `claude-project-rules.md`, `handoff.md` created (this session)

---

## Nothing Half-Done

No files were left in a partial state. Every file that was opened was fully written and committed.

---

## Open First Next Session

**`progress.md`** — verify it matches actual state, then pick the next pending task.

If the next task is a code change, also read **`claude-project-rules.md`** before touching any form submission, auth, routing, or D1 write path.

---

## Exact Next Task

**Step 1 (manual — Alice must do this herself):**
Go to Firebase Console → Authentication → Settings → Authorized domains.  
Add `farfromtimnah-hue.github.io`.  
Without this, Google Sign-In will fail on GitHub Pages.

**Step 2 (requires decision):**
Merge `crm-build` into `main` to make the CRM live on GitHub Pages.  
The board is at `crm/index.html`, login at `crm/login.html`.

**Step 3 (first new feature to build):**
Add a "New Lead" button to the CRM board that lets Alice manually add a lead from a phone call or in-person meeting. This requires:
- A new modal on `crm/index.html` with name, phone, email, source, state fields
- A new `POST /api/crm/leads` endpoint in the Worker
- After save, refresh the board and open the new lead's detail page

---

## Warnings / Gotchas

1. **Firebase authorized domain is NOT set yet.** Google Sign-In will fail on GitHub Pages until it is. Email/password login works on any domain.

2. **`crm-build` is not yet merged to `main`.** GitHub Pages still serves the old `main`. The CRM is not publicly accessible at the GitHub Pages URL yet.

3. **D1 schema is already applied to the live database.** Do not re-run `schema.sql` as a whole file. If you need to add a column, use a separate `ALTER TABLE` statement via `wrangler d1 execute --remote --command "ALTER TABLE ..."`.

4. **The Worker's `ALLOWED_ORIGINS` is set to GitHub Pages + localhost:8080.** If testing locally on a different port, either update wrangler.toml + redeploy, or test against the live Worker from the real GitHub Pages URL.

5. **`js/firebase-config.js` is the single source of Firebase config.** CRM pages reference it as `../js/firebase-config.js`. Public pages reference it as `js/firebase-config.js`. Do not duplicate the config inline.

6. **The emergency guide "Send to Alice" feature does NOT require the user to be authenticated.** It posts to a public endpoint. The guide is a public page.

---

_Last updated: 2026-05-26_
