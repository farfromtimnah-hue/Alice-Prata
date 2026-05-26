/**
 * Alice Prata CRM — Cloudflare Worker
 * Worker URL: https://alice-prata-crm-api.farfromtimnah.workers.dev
 * D1 Binding:  DB  (alice-prata-crm, 080cb251-6a0e-420d-9865-e2475d9858b5)
 *
 * Public endpoints (no auth):
 *   POST /api/submit/landing-insurance
 *   POST /api/submit/landing-resources
 *   POST /api/submit/emergency-guide
 *
 * Protected endpoints (Firebase JWT required):
 *   GET  /api/crm/leads
 *   GET  /api/crm/leads/:id
 *   POST /api/crm/leads/:id/stage
 *   POST /api/crm/leads/:id/activity
 *   POST /api/crm/leads/:id/note
 *   PATCH /api/crm/leads/:id/note/:nid
 *   GET  /api/crm/leads/:id/notes
 *   POST /api/crm/leads/:id/appointment
 *   POST /api/crm/leads/:id/policy
 *   POST /api/crm/leads/:id/archive
 *   GET  /api/crm/referrals
 *   GET  /api/crm/profile
 *   PATCH /api/crm/profile
 *   GET  /api/crm/licensed-states
 *   POST /api/crm/licensed-states
 *   DELETE /api/crm/licensed-states/:code
 *   GET  /api/crm/carriers
 *   POST /api/crm/carriers
 *   PATCH /api/crm/carriers/:id
 *   DELETE /api/crm/carriers/:id
 *   GET  /api/crm/stages
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // ── CORS ──────────────────────────────────────────────────────────────
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim());
    const corsOrigin = allowed.includes(origin) ? origin : allowed[0] || '*';

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
    };

    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    const err = (msg, status = 400) => json({ error: msg }, status);

    try {
      // ── PUBLIC FORM SUBMISSIONS ──────────────────────────────────────────
      if (method === 'POST' && path === '/api/submit/landing-insurance') {
        return await handleLandingInsurance(request, env, json, err);
      }
      if (method === 'POST' && path === '/api/submit/landing-resources') {
        return await handleLandingResources(request, env, json, err);
      }
      if (method === 'POST' && path === '/api/submit/emergency-guide') {
        return await handleEmergencyGuide(request, env, json, err);
      }

      // ── PROTECTED CRM ENDPOINTS ──────────────────────────────────────────
      if (path.startsWith('/api/crm/')) {
        const payload = await verifyFirebaseToken(request, env.FIREBASE_PROJECT_ID);
        if (!payload) return err('Unauthorized', 401);
        return await crmRouter(request, env, path, method, json, err, payload);
      }

      return err('Not found', 404);
    } catch (e) {
      console.error(e);
      return err('Internal server error', 500);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE JWT VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

let cachedKeys = null;
let cachedKeysExpiry = 0;

async function getFirebasePublicKeys() {
  if (cachedKeys && Date.now() < cachedKeysExpiry) return cachedKeys;
  const resp = await fetch(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
    { cf: { cacheTtl: 3600 } }
  );
  if (!resp.ok) throw new Error('Could not fetch Firebase public keys');
  const data = await resp.json();
  cachedKeys = data.keys;
  cachedKeysExpiry = Date.now() + 3600_000;
  return cachedKeys;
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function verifyFirebaseToken(request, projectId) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    if (!authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.slice(7).trim();
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(new TextDecoder().decode(b64urlDecode(headerB64)));
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;

    const keys = await getFirebasePublicKeys();
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk', jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['verify']
    );
    const sigBytes = b64urlDecode(sigB64);
    const dataBytes = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes, dataBytes);
    return valid ? payload : null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SANITIZATION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function sanitizeText(v, max = 500) {
  if (v == null) return null;
  return String(v).trim().slice(0, max) || null;
}

function sanitizePhone(v) {
  if (!v) return null;
  const digits = String(v).replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

function sanitizeEmail(v) {
  if (!v) return null;
  const s = String(v).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : null;
}

function now() {
  return new Date().toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC FORM HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async function handleLandingInsurance(request, env, json, err) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const name = sanitizeText(body.firstName || body.name);
  const lastName = sanitizeText(body.lastName);
  const fullName = lastName ? `${name} ${lastName}` : name;
  const phone = sanitizePhone(body.phone);
  const email = sanitizeEmail(body.email);

  if (!fullName || !phone) return err('Nome e telefone são obrigatórios.');

  // Spam guard: basic rate limit by phone (check last 10 minutes)
  const recent = await env.DB.prepare(
    `SELECT id FROM submissions WHERE source_page='landing-insurance' AND raw_payload LIKE ? AND submitted_at > datetime('now','-10 minutes')`
  ).bind(`%"phone":"${phone}"%`).first();
  if (recent) return json({ success: true, deduplicated: true });

  const payload = {
    firstName: sanitizeText(body.firstName),
    lastName: sanitizeText(body.lastName),
    phone,
    email,
    children: sanitizeText(body.children),
    hasInsurance: sanitizeText(body.hasInsurance),
    language: sanitizeText(body.language),
    quizRecommendation: sanitizeText(body.quiz_recommendation),
    pageLanguage: sanitizeText(body.page_language),
  };

  const lead = await env.DB.prepare(
    `INSERT INTO leads (name, phone, email, source_page, source_form, kids, has_insurance, language_pref, quiz_recommendation, created_at, updated_at)
     VALUES (?, ?, ?, 'landing-insurance', 'consultation-form', ?, ?, ?, ?, datetime('now'), datetime('now'))
     RETURNING id`
  ).bind(
    fullName, phone, email,
    sanitizeText(body.children),
    sanitizeText(body.hasInsurance),
    sanitizeText(body.language) || 'pt',
    sanitizeText(body.quiz_recommendation)
  ).first();

  await env.DB.prepare(
    `INSERT INTO submissions (lead_id, source_page, source_form, raw_payload) VALUES (?, 'landing-insurance', 'consultation-form', ?)`
  ).bind(lead.id, JSON.stringify(payload)).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'lead_created', ?)`
  ).bind(lead.id, `Formulário: landing-insurance`).run();

  return json({ success: true, lead_id: lead.id });
}

async function handleLandingResources(request, env, json, err) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const name = sanitizeText(body.firstName || body.name);
  const lastName = sanitizeText(body.lastName);
  const fullName = lastName ? `${name} ${lastName}` : name;
  const phone = sanitizePhone(body.phone);
  const email = sanitizeEmail(body.email);

  if (!fullName || !phone) return err('Nome e telefone são obrigatórios.');

  const recent = await env.DB.prepare(
    `SELECT id FROM submissions WHERE source_page='landing-resources' AND raw_payload LIKE ? AND submitted_at > datetime('now','-10 minutes')`
  ).bind(`%"phone":"${phone}"%`).first();
  if (recent) return json({ success: true, deduplicated: true });

  const insuranceOptIn = body.insuranceOptIn ? 1 : 0;

  const payload = {
    firstName: sanitizeText(body.firstName),
    lastName: sanitizeText(body.lastName),
    phone,
    email,
    insuranceOptIn,
    language: sanitizeText(body.language),
  };

  const lead = await env.DB.prepare(
    `INSERT INTO leads (name, phone, email, source_page, source_form, insurance_opt_in, language_pref, created_at, updated_at)
     VALUES (?, ?, ?, 'landing-resources', 'resources-form', ?, ?, datetime('now'), datetime('now'))
     RETURNING id`
  ).bind(fullName, phone, email, insuranceOptIn, sanitizeText(body.language) || 'pt').first();

  await env.DB.prepare(
    `INSERT INTO submissions (lead_id, source_page, source_form, raw_payload) VALUES (?, 'landing-resources', 'resources-form', ?)`
  ).bind(lead.id, JSON.stringify(payload)).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'lead_created', ?)`
  ).bind(lead.id, `Formulário: landing-resources`).run();

  return json({ success: true, lead_id: lead.id });
}

async function handleEmergencyGuide(request, env, json, err) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const name = sanitizeText(body.p_name || body.name);
  const phone = sanitizePhone(body.p_phone || body.phone);
  const email = sanitizeEmail(body.p_email || body.email);

  if (!name && !phone) return err('Nome ou telefone são obrigatórios.');

  const payload = {
    // Personal
    name,
    dob:     sanitizeText(body.p_dob),
    phone,
    email,
    address: sanitizeText(body.p_address),
    bloodType: sanitizeText(body.p_blood),
    doctor:  sanitizeText(body.p_doctor),
    health:  sanitizeText(body.p_health),
    // Financial
    bank:      sanitizeText(body.f_bank),
    will:      sanitizeText(body.f_will),
    attorney:  sanitizeText(body.f_attorney),
    accountant:sanitizeText(body.f_accountant),
    docs:      sanitizeText(body.f_docs),
    // Final wishes
    burial:    sanitizeText(body.r_burial),
    location:  sanitizeText(body.r_location),
    message:   sanitizeText(body.w_message, 2000),
    executor:  sanitizeText(body.w_executor),
    // Referral consent — KEY field
    referralConsent: body.r_consent === 'yes' ? 'yes' : 'no',
    // US contacts (raw)
    usContacts: extractContacts(body, 'uc', 5, false),
    // Intl contacts (raw)
    intlContacts: extractContacts(body, 'ic', 5, true),
    // Insurance policies (raw)
    insurances: extractInsurances(body, 5),
    // Medical (raw)
    medicalRaw: {
      dnr: sanitizeText(body.m_dnr),
      hospital: sanitizeText(body.m_hospital),
    },
  };

  const lead = await env.DB.prepare(
    `INSERT INTO leads (name, phone, email, source_page, source_form, created_at, updated_at)
     VALUES (?, ?, ?, 'emergency-guide', 'family-emergency-guide', datetime('now'), datetime('now'))
     RETURNING id`
  ).bind(name || 'Sem nome', phone || '', email).first();

  await env.DB.prepare(
    `INSERT INTO submissions (lead_id, source_page, source_form, raw_payload) VALUES (?, 'emergency-guide', 'family-emergency-guide', ?)`
  ).bind(lead.id, JSON.stringify(payload)).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'lead_created', ?)`
  ).bind(lead.id, `Formulário: family-emergency-guide`).run();

  // Save referral contacts ONLY if consent = yes
  // RULE: consent_granted is only 1 when referral_consent = 'yes'
  if (body.r_consent === 'yes' && Array.isArray(payload.usContacts)) {
    for (const c of payload.usContacts) {
      if (!c.name && !c.phone) continue;
      await env.DB.prepare(
        `INSERT INTO referral_contacts (from_lead_id, name, phone, email, relation, state, consent_granted, consent_source)
         VALUES (?, ?, ?, ?, ?, ?, 1, 'emergency-guide')`
      ).bind(lead.id, c.name || '', sanitizePhone(c.phone), c.email, c.relation, c.state).run();
    }
  } else if (Array.isArray(payload.usContacts)) {
    // Store contacts but consent_granted = 0 — not usable for outreach
    for (const c of payload.usContacts) {
      if (!c.name && !c.phone) continue;
      await env.DB.prepare(
        `INSERT INTO referral_contacts (from_lead_id, name, phone, email, relation, state, consent_granted, consent_source)
         VALUES (?, ?, ?, ?, ?, ?, 0, 'emergency-guide')`
      ).bind(lead.id, c.name || '', sanitizePhone(c.phone), c.email, c.relation, c.state).run();
    }
  }

  return json({ success: true, lead_id: lead.id });
}

function extractContacts(body, prefix, count, intl) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const c = {
      name:     sanitizeText(body[`${prefix}_${i}_name`]),
      relation: sanitizeText(body[`${prefix}_${i}_rel`]),
      phone:    sanitizePhone(body[`${prefix}_${i}_phone`]),
      email:    sanitizeEmail(body[`${prefix}_${i}_email`]),
    };
    if (intl) {
      c.country = sanitizeText(body[`${prefix}_${i}_country`]);
    } else {
      c.state = sanitizeText(body[`${prefix}_${i}_state`]);
    }
    if (c.name || c.phone) out.push(c);
  }
  return out;
}

function extractInsurances(body, count) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    const ins = {
      carrier:    sanitizeText(body[`ins_${i}_co`]),
      number:     sanitizeText(body[`ins_${i}_num`]),
      type:       sanitizeText(body[`ins_${i}_type`]),
      amount:     sanitizeText(body[`ins_${i}_amt`]),
      beneficiary:sanitizeText(body[`ins_${i}_ben`]),
      claimsPhone:sanitizePhone(body[`ins_${i}_phone`]),
    };
    if (ins.carrier || ins.number) out.push(ins);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// CRM ROUTER  (all routes require valid Firebase token)
// ═══════════════════════════════════════════════════════════════════════════

async function crmRouter(request, env, path, method, json, err, _authPayload) {
  const segments = path.split('/').filter(Boolean); // ['api','crm','leads','123','activity']
  const resource = segments[2]; // 'leads' | 'profile' | 'licensed-states' | 'carriers' | 'stages' | 'referrals'

  // ── STAGES ──────────────────────────────────────────────────────────────
  if (resource === 'stages' && method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM pipeline_stages ORDER BY sort_order'
    ).all();
    return json(results);
  }

  // ── LEADS ────────────────────────────────────────────────────────────────
  if (resource === 'leads') {
    const leadId = segments[3] ? parseInt(segments[3]) : null;
    const sub = segments[4]; // 'activity' | 'note' | 'notes' | 'stage' | 'appointment' | 'policy' | 'archive'

    if (!leadId) {
      // GET /api/crm/leads  — list / search
      if (method === 'GET') return await listLeads(request, env, json);
      return err('Method not allowed', 405);
    }

    if (!sub) {
      // GET /api/crm/leads/:id
      if (method === 'GET') return await getLead(leadId, env, json, err);
      return err('Method not allowed', 405);
    }

    if (sub === 'stage' && method === 'POST') return await moveStage(request, leadId, env, json, err);
    if (sub === 'activity' && method === 'POST') return await logActivity(request, leadId, env, json, err);
    if (sub === 'notes' && method === 'GET') return await getNotes(leadId, env, json);
    if (sub === 'note' && method === 'POST') return await addNote(request, leadId, env, json, err);
    if (sub === 'note' && method === 'PATCH') return await editNote(request, leadId, parseInt(segments[5]), env, json, err);
    if (sub === 'appointment' && method === 'POST') return await saveAppointment(request, leadId, env, json, err);
    if (sub === 'policy' && method === 'POST') return await savePolicy(request, leadId, env, json, err);
    if (sub === 'archive' && method === 'POST') return await archiveLead(request, leadId, env, json, err);

    return err('Not found', 404);
  }

  // ── REFERRALS (consented only) ───────────────────────────────────────────
  if (resource === 'referrals' && method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT rc.*, l.name as from_lead_name, l.phone as from_lead_phone
       FROM referral_contacts rc
       LEFT JOIN leads l ON l.id = rc.from_lead_id
       WHERE rc.consent_granted = 1
       ORDER BY rc.created_at DESC`
    ).all();
    return json(results);
  }

  // ── PROFILE ──────────────────────────────────────────────────────────────
  if (resource === 'profile') {
    if (method === 'GET') {
      const row = await env.DB.prepare('SELECT * FROM agent_profile WHERE id=1').first();
      return json(row || {});
    }
    if (method === 'PATCH') {
      let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const fields = ['name','email','phone','business_name','manager_name','manager_phone','nmls','license_number','language_pref'];
      const updates = [];
      const values = [];
      for (const f of fields) {
        if (body[f] !== undefined) { updates.push(`${f}=?`); values.push(sanitizeText(body[f], 200)); }
      }
      if (!updates.length) return json({ ok: true });
      updates.push(`updated_at=datetime('now')`);
      values.push(1);
      await env.DB.prepare(`UPDATE agent_profile SET ${updates.join(',')} WHERE id=?`).bind(...values).run();
      return json({ ok: true });
    }
  }

  // ── LICENSED STATES ──────────────────────────────────────────────────────
  if (resource === 'licensed-states') {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM licensed_states ORDER BY state_code').all();
      return json(results);
    }
    if (method === 'POST') {
      let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
      const code = sanitizeText(body.state_code, 2);
      const name = sanitizeText(body.state_name, 50);
      if (!code) return err('state_code required');
      await env.DB.prepare('INSERT OR IGNORE INTO licensed_states (state_code, state_name) VALUES (?,?)').bind(code.toUpperCase(), name || code).run();
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      const code = segments[3];
      if (!code) return err('state_code required');
      await env.DB.prepare('DELETE FROM licensed_states WHERE state_code=?').bind(code.toUpperCase()).run();
      return json({ ok: true });
    }
  }

  // ── CARRIERS ─────────────────────────────────────────────────────────────
  if (resource === 'carriers') {
    const carrierId = segments[3] ? parseInt(segments[3]) : null;

    if (!carrierId) {
      if (method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM carrier_contacts ORDER BY sort_order, name').all();
        return json(results);
      }
      if (method === 'POST') {
        let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
        const r = await env.DB.prepare(
          `INSERT INTO carrier_contacts (name, claims_phone, general_phone, email, underwriting_contact, policy_issue_contact, portal_url, notes, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`
        ).bind(
          sanitizeText(body.name), sanitizePhone(body.claims_phone), sanitizePhone(body.general_phone),
          sanitizeEmail(body.email), sanitizeText(body.underwriting_contact), sanitizeText(body.policy_issue_contact),
          sanitizeText(body.portal_url, 300), sanitizeText(body.notes, 500), body.sort_order || 0
        ).first();
        return json({ ok: true, id: r.id });
      }
    }

    if (carrierId) {
      if (method === 'PATCH') {
        let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
        const fields = ['name','claims_phone','general_phone','email','underwriting_contact','policy_issue_contact','portal_url','notes','sort_order'];
        const updates = []; const values = [];
        for (const f of fields) {
          if (body[f] !== undefined) {
            updates.push(`${f}=?`);
            values.push(f.includes('phone') ? sanitizePhone(body[f]) : f === 'email' ? sanitizeEmail(body[f]) : sanitizeText(body[f], 500));
          }
        }
        if (updates.length) {
          updates.push(`updated_at=datetime('now')`);
          values.push(carrierId);
          await env.DB.prepare(`UPDATE carrier_contacts SET ${updates.join(',')} WHERE id=?`).bind(...values).run();
        }
        return json({ ok: true });
      }
      if (method === 'DELETE') {
        await env.DB.prepare('DELETE FROM carrier_contacts WHERE id=?').bind(carrierId).run();
        return json({ ok: true });
      }
    }
  }

  return err('Not found', 404);
}

// ─────────────────────────────────────────────────────────────────────────
// LEAD HELPERS
// ─────────────────────────────────────────────────────────────────────────

async function listLeads(request, env, json) {
  const url = new URL(request.url);
  const q = url.searchParams;
  const stage = q.get('stage');
  const search = q.get('search');
  const source = q.get('source');
  const archiveType = q.get('archive_type');
  const sort = q.get('sort') || 'newest';
  const limit = Math.min(parseInt(q.get('limit') || '100'), 500);

  let where = [];
  let binds = [];

  if (stage) { where.push('l.stage=?'); binds.push(stage); }
  if (source) { where.push('l.source_page=?'); binds.push(source); }
  if (archiveType) { where.push('l.archive_type=?'); binds.push(archiveType); }
  if (search) {
    where.push('(l.name LIKE ? OR l.phone LIKE ? OR l.email LIKE ?)');
    const s = `%${search}%`;
    binds.push(s, s, s);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  let orderBy;
  switch (sort) {
    case 'oldest':       orderBy = 'l.created_at ASC'; break;
    case 'last_contact': orderBy = 'l.last_contacted_at ASC NULLS FIRST'; break;
    case 'appointment':  orderBy = 'apt.scheduled_at ASC NULLS LAST'; break;
    default:             orderBy = 'l.created_at DESC';
  }

  const { results } = await env.DB.prepare(
    `SELECT l.*,
       apt.scheduled_at as next_appointment,
       apt.outcome as appointment_outcome,
       (SELECT COUNT(*) FROM activity_log WHERE lead_id=l.id) as activity_count
     FROM leads l
     LEFT JOIN appointments apt ON apt.lead_id=l.id AND apt.outcome IS NULL
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ?`
  ).bind(...binds, limit).all();

  return json(results);
}

async function getLead(id, env, json, err) {
  const lead = await env.DB.prepare('SELECT * FROM leads WHERE id=?').bind(id).first();
  if (!lead) return err('Lead not found', 404);

  const [{ results: activity }, { results: notes }, { results: appointments }, { results: policies }, { results: submissions }] =
    await Promise.all([
      env.DB.prepare('SELECT * FROM activity_log WHERE lead_id=? ORDER BY created_at DESC LIMIT 50').bind(id).all(),
      env.DB.prepare('SELECT * FROM notes WHERE lead_id=? ORDER BY is_pinned DESC, created_at DESC').bind(id).all(),
      env.DB.prepare('SELECT * FROM appointments WHERE lead_id=? ORDER BY created_at DESC').bind(id).all(),
      env.DB.prepare('SELECT * FROM policies WHERE lead_id=? ORDER BY created_at DESC').bind(id).all(),
      env.DB.prepare('SELECT id, source_page, source_form, submitted_at FROM submissions WHERE lead_id=? ORDER BY submitted_at DESC').bind(id).all(),
    ]);

  return json({ ...lead, activity, notes, appointments, policies, submissions });
}

async function moveStage(request, leadId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const newStage = sanitizeText(body.stage);
  if (!newStage) return err('stage required');

  const valid = await env.DB.prepare('SELECT code FROM pipeline_stages WHERE code=?').bind(newStage).first();
  if (!valid) return err('Invalid stage code');

  const lead = await env.DB.prepare('SELECT stage FROM leads WHERE id=?').bind(leadId).first();
  if (!lead) return err('Lead not found', 404);

  const oldStage = lead.stage;

  // Guard: orphan warning (caller should confirm before sending)
  if (newStage === 'orphan' && !body.confirmed) {
    return json({ requiresConfirmation: true, message: 'Este lead não tem informações de contato utilizáveis. Confirmar?' });
  }

  const updates = ['stage=?', 'updated_at=datetime(\'now\')'];
  const values = [newStage];

  if (newStage.startsWith('archive_') && oldStage !== newStage) {
    updates.push('archived_at=datetime(\'now\')');
    const archiveTypeMap = {
      archive_no_sale: 'no_sale',
      archive_active_policyholder: 'active_policyholder',
      archive_not_qualified: 'not_qualified',
    };
    updates.push('archive_type=?');
    values.push(archiveTypeMap[newStage] || null);
    if (newStage === 'archive_active_policyholder') {
      updates.push('became_client_at=datetime(\'now\')');
    }
    if (body.archive_reason) { updates.push('archive_reason=?'); values.push(sanitizeText(body.archive_reason)); }
  }

  values.push(leadId);
  await env.DB.prepare(`UPDATE leads SET ${updates.join(',')} WHERE id=?`).bind(...values).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type, old_stage, new_stage, notes) VALUES (?, 'stage_changed', ?, ?, ?)`
  ).bind(leadId, oldStage, newStage, body.notes || null).run();

  return json({ ok: true });
}

async function logActivity(request, leadId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const validTypes = ['texted','emailed','voicemail','no_answer','someone_else'];
  const actionType = sanitizeText(body.action_type);
  if (!validTypes.includes(actionType)) return err('Invalid action_type');

  await env.DB.prepare(
    `UPDATE leads SET last_contact_method=?, last_contacted_at=datetime('now'), updated_at=datetime('now') WHERE id=?`
  ).bind(actionType, leadId).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, ?, ?)`
  ).bind(leadId, actionType, sanitizeText(body.notes, 500)).run();

  return json({ ok: true });
}

async function getNotes(leadId, env, json) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM notes WHERE lead_id=? ORDER BY is_pinned DESC, created_at DESC'
  ).bind(leadId).all();
  return json(results);
}

async function addNote(request, leadId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const content = sanitizeText(body.content, 5000);
  if (!content) return err('content required');
  const isPinned = body.is_pinned ? 1 : 0;

  const row = await env.DB.prepare(
    `INSERT INTO notes (lead_id, content, is_pinned) VALUES (?,?,?) RETURNING id`
  ).bind(leadId, content, isPinned).first();

  await env.DB.prepare(
    `UPDATE leads SET updated_at=datetime('now') WHERE id=?`
  ).bind(leadId).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type) VALUES (?, 'note_added')`
  ).bind(leadId).run();

  return json({ ok: true, id: row.id });
}

async function editNote(request, leadId, noteId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }
  const updates = []; const values = [];
  if (body.content !== undefined) { updates.push('content=?'); values.push(sanitizeText(body.content, 5000)); }
  if (body.is_pinned !== undefined) { updates.push('is_pinned=?'); values.push(body.is_pinned ? 1 : 0); }
  if (!updates.length) return json({ ok: true });
  updates.push(`updated_at=datetime('now')`);
  values.push(noteId, leadId);
  await env.DB.prepare(`UPDATE notes SET ${updates.join(',')} WHERE id=? AND lead_id=?`).bind(...values).run();
  return json({ ok: true });
}

async function saveAppointment(request, leadId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const validOutcomes = ['sale','no_sale','not_qualified','cut_short'];
  const outcome = body.outcome && validOutcomes.includes(body.outcome) ? body.outcome : null;

  if (outcome) {
    // Update existing open appointment
    await env.DB.prepare(
      `UPDATE appointments SET outcome=?, outcome_reason=?, outcome_at=datetime('now'), updated_at=datetime('now')
       WHERE lead_id=? AND outcome IS NULL`
    ).bind(outcome, sanitizeText(body.outcome_reason), leadId).run();

    // Auto-stage based on outcome
    let newStage = null;
    if (outcome === 'sale') newStage = 'application_started';
    if (outcome === 'cut_short') newStage = 'needs_reschedule';
    // no_sale / not_qualified → user must manually archive with reason

    if (newStage) {
      const lead = await env.DB.prepare('SELECT stage FROM leads WHERE id=?').bind(leadId).first();
      await env.DB.prepare(`UPDATE leads SET stage=?, updated_at=datetime('now') WHERE id=?`).bind(newStage, leadId).run();
      await env.DB.prepare(
        `INSERT INTO activity_log (lead_id, action_type, old_stage, new_stage, notes) VALUES (?, 'stage_changed', ?, ?, ?)`
      ).bind(leadId, lead?.stage, newStage, `Resultado da reunião: ${outcome}`).run();
    }

    await env.DB.prepare(
      `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'meeting_outcome', ?)`
    ).bind(leadId, `Resultado: ${outcome}${body.outcome_reason ? ' — ' + body.outcome_reason : ''}`).run();

  } else {
    // Create new appointment
    const scheduledAt = sanitizeText(body.scheduled_at);
    await env.DB.prepare(
      `INSERT INTO appointments (lead_id, scheduled_at) VALUES (?,?)`
    ).bind(leadId, scheduledAt).run();

    await env.DB.prepare(
      `UPDATE leads SET stage='appointment_scheduled', updated_at=datetime('now') WHERE id=? AND stage NOT IN ('appointment_scheduled')`
    ).bind(leadId).run();

    await env.DB.prepare(
      `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'appointment_set', ?)`
    ).bind(leadId, `Reunião: ${scheduledAt}`).run();
  }

  return json({ ok: true });
}

async function savePolicy(request, leadId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const existing = await env.DB.prepare('SELECT id FROM policies WHERE lead_id=? LIMIT 1').bind(leadId).first();
  if (existing) {
    const fields = ['carrier','policy_number','policy_type','coverage_amount','premium','effective_date','status','notes'];
    const updates = []; const values = [];
    for (const f of fields) {
      if (body[f] !== undefined) { updates.push(`${f}=?`); values.push(sanitizeText(body[f], 500)); }
    }
    if (updates.length) {
      updates.push(`updated_at=datetime('now')`);
      values.push(existing.id);
      await env.DB.prepare(`UPDATE policies SET ${updates.join(',')} WHERE id=?`).bind(...values).run();
    }
    await env.DB.prepare(
      `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'policy_updated', ?)`
    ).bind(leadId, `Status: ${body.status || 'atualizado'}`).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO policies (lead_id, carrier, policy_number, policy_type, coverage_amount, premium, effective_date, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).bind(
      leadId,
      sanitizeText(body.carrier), sanitizeText(body.policy_number), sanitizeText(body.policy_type),
      sanitizeText(body.coverage_amount), sanitizeText(body.premium), sanitizeText(body.effective_date),
      sanitizeText(body.status) || 'pending', sanitizeText(body.notes, 500)
    ).run();

    await env.DB.prepare(
      `INSERT INTO activity_log (lead_id, action_type, notes) VALUES (?, 'policy_created', ?)`
    ).bind(leadId, `Apólice criada: ${body.carrier || ''}`).run();
  }

  return json({ ok: true });
}

async function archiveLead(request, leadId, env, json, err) {
  let body; try { body = await request.json(); } catch { return err('Invalid JSON'); }

  const validTypes = ['no_sale', 'active_policyholder', 'not_qualified'];
  const archiveType = sanitizeText(body.archive_type);
  if (!validTypes.includes(archiveType)) return err('Invalid archive_type');
  if (!body.reason && archiveType !== 'active_policyholder') return err('reason required for archive');

  const stageMap = {
    no_sale: 'archive_no_sale',
    active_policyholder: 'archive_active_policyholder',
    not_qualified: 'archive_not_qualified',
  };

  const lead = await env.DB.prepare('SELECT stage FROM leads WHERE id=?').bind(leadId).first();
  if (!lead) return err('Lead not found', 404);

  const updates = [
    'stage=?', 'archive_type=?', 'archive_reason=?',
    'archived_at=datetime(\'now\')', 'updated_at=datetime(\'now\')'
  ];
  const values = [stageMap[archiveType], archiveType, sanitizeText(body.reason, 500)];

  if (archiveType === 'active_policyholder') {
    updates.push('became_client_at=datetime(\'now\')');
  }

  values.push(leadId);
  await env.DB.prepare(`UPDATE leads SET ${updates.join(',')} WHERE id=?`).bind(...values).run();

  await env.DB.prepare(
    `INSERT INTO activity_log (lead_id, action_type, old_stage, new_stage, notes) VALUES (?, 'archived', ?, ?, ?)`
  ).bind(leadId, lead.stage, stageMap[archiveType], `Arquivado como: ${archiveType}. Motivo: ${body.reason || '—'}`).run();

  return json({ ok: true });
}
