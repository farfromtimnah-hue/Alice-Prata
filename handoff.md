# Handoff — Alice Prata CRM

_Rewritten at the end of each major work block. Read this first when resuming._

---

## Just Completed (2026-05-26, Session 3)

**`crm/css/crm.css` fully redesigned** — dark glassmorphic premium system:
- Base: near-black `#0f0e0d` warm atmospheric background
- 4-level frosted surface hierarchy (`rgba(255,255,255,0.03–0.13)`)
- Nav: `backdrop-filter: blur(20px)` on translucent dark bar, `border-bottom: 1px solid rgba(255,255,255,0.07)`
- Cards: subtle top-edge inner glow `inset 0 1px 0 rgba(255,255,255,0.06)`
- Kanban column headers: barely-there color tints (no solid fills)
- Login: full frosted glass card on atmospheric dark with radial accents
- Modals: near-black frosted backdrop `blur(24px)`, overlay `blur(6px)`
- Inputs: `rgba(0,0,0,0.28)` dark fill, terracotta glow on focus
- Accent: muted clay `#c4876a` — buttons, focus rings, section titles, active nav — <10% surface
- All class names preserved; logic unchanged

`claude-project-rules.md` updated with the full dark glass design token system.

---

## Nothing Half-Done

CSS rewrite is complete. All class names that existed before still exist. No JS, HTML, or Worker files were modified in Session 3.

---

## Open First Next Session

**`progress.md`** — verify it matches actual state, then pick the next pending task.

Also read **`claude-project-rules.md`** before touching any form submission, auth, routing, or D1 write path. The Design Direction section now contains the dark glass palette.

---

## Exact Next Task

**Step 1 (manual — Alice must do this):**
Firebase Console → Authentication → Settings → Authorized domains → add `farfromtimnah-hue.github.io`.
Required for Google Sign-In on GitHub Pages.

**Step 2 (requires decision):**
Merge `crm-build` into `main` to make the CRM live on GitHub Pages.
CRM board lives at `crm/index.html`, login at `crm/login.html`.

**Step 3 (first new feature to build):**
Add a "New Lead" button to the CRM board for manually adding a lead from a phone call or in-person meeting:
- New modal on `crm/index.html` with name, phone, email, source (dropdown), state fields
- New `POST /api/crm/leads` endpoint in `worker/src/index.js` (sanitize all fields, INSERT lead + activity_log row, return `{ id }`)
- After save: refresh board and open the new lead's detail page

---

## Warnings / Gotchas

1. **Firebase authorized domain is NOT set yet.** Google Sign-In fails on GitHub Pages until it is. Email/password login works on any domain.

2. **`crm-build` is not yet merged to `main`.** GitHub Pages still serves old `main`.

3. **D1 schema is already applied.** Do not re-run `schema.sql` as a whole file. Add columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` via `wrangler d1 execute --remote --command "..."`.

4. **Worker `ALLOWED_ORIGINS`** is `https://farfromtimnah-hue.github.io,http://localhost:8080`. Change in `wrangler.toml` + redeploy if testing on a different local port.

5. **`js/firebase-config.js` is the single source of Firebase config.** CRM pages reference it as `../js/firebase-config.js`. Do not duplicate inline.

6. **The emergency guide "Send to Alice" feature does NOT require auth.** It posts to a public endpoint.

7. **crm.css is now a dark glassmorphic system.** Do NOT introduce old terracota/sand variables (`--terra-deep`, `--sand-cream`, etc.) — they no longer exist. Use the token system in `claude-project-rules.md`.

---

_Last updated: 2026-05-26, Session 3_
