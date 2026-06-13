// Lead detail page logic for crm/lead.html

const STAGE_ORDER = [
  'new_lead','contacted','appointment_scheduled','needs_reschedule',
  'application_started','application_submitted','policy_pending',
  'policy_issued','policy_delivered','pending_license','orphan',
  'archive_no_sale','archive_active_policyholder','archive_not_qualified',
];
const STAGE_TYPE = {
  new_lead:'active',contacted:'active',appointment_scheduled:'active',
  needs_reschedule:'active',application_started:'active',
  application_submitted:'active',policy_pending:'active',
  policy_issued:'active',policy_delivered:'active',
  pending_license:'holding',orphan:'holding',
  archive_no_sale:'archive',archive_active_policyholder:'archive',
  archive_not_qualified:'archive',
};

let leadData = null;
let leadId = null;
let currentStateInfo = null;   // cached /api/crm/state-info response for pending_license leads

// US state code → display name (for the License Decision fee line)
const STATE_NAMES = {
  AL:'Alabama', AK:'Alaska', AZ:'Arizona', AR:'Arkansas', CA:'California',
  CO:'Colorado', CT:'Connecticut', DE:'Delaware', FL:'Florida', GA:'Georgia',
  HI:'Hawaii', ID:'Idaho', IL:'Illinois', IN:'Indiana', IA:'Iowa', KS:'Kansas',
  KY:'Kentucky', LA:'Louisiana', ME:'Maine', MD:'Maryland', MA:'Massachusetts',
  MI:'Michigan', MN:'Minnesota', MS:'Mississippi', MO:'Missouri', MT:'Montana',
  NE:'Nebraska', NV:'Nevada', NH:'New Hampshire', NJ:'New Jersey', NM:'New Mexico',
  NY:'New York', NC:'North Carolina', ND:'North Dakota', OH:'Ohio', OK:'Oklahoma',
  OR:'Oregon', PA:'Pennsylvania', RI:'Rhode Island', SC:'South Carolina',
  SD:'South Dakota', TN:'Tennessee', TX:'Texas', UT:'Utah', VT:'Vermont',
  VA:'Virginia', WA:'Washington', DC:'Washington DC', WV:'West Virginia',
  WI:'Wisconsin', WY:'Wyoming',
};

// ── Helpers ───────────────────────────────────────────────────────
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, ok) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (ok === false ? 'toast-err' : 'toast-ok');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function formatPhone(p) {
  if (!p) return null;
  const d = String(p).replace(/\D/g,'');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0]==='1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return p;
}

function relTime(isoStr) {
  if (!isoStr) return '—';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d atrás`;
  return new Date(isoStr).toLocaleDateString(crm.lang === 'en' ? 'en-US' : 'pt-BR', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stageTypeCss(stage) {
  const t = STAGE_TYPE[stage] || 'active';
  return `badge badge-stage-${t}`;
}

// ── Main render ───────────────────────────────────────────────────
function renderLead(data) {
  leadData = data;
  const phone = formatPhone(data.phone);
  const stageLabel = crm.t('stages.' + data.stage);
  const sourceLabel = crm.t('sources.' + data.source_page) || data.source_page;
  const stageType = STAGE_TYPE[data.stage] || 'active';
  const isArchived = stageType === 'archive';

  const html = `
    <button class="back-btn" onclick="history.back()">
      ← ${crm.lang === 'en' ? 'Back to board' : 'Voltar ao board'}
    </button>

    <div class="lead-header">
      <div>
        <div class="lead-name">${esc(data.name)}</div>
        <div class="lead-contacts">
          ${phone ? `<span class="contact-pill">📱 <a href="tel:${data.phone}">${phone}</a> · <a href="https://wa.me/${String(data.phone).replace(/\D/g,'')}" target="_blank">WhatsApp</a></span>` : ''}
          ${data.email ? `<span class="contact-pill">✉️ <a href="mailto:${esc(data.email)}">${esc(data.email)}</a></span>` : ''}
        </div>
        <div class="lead-badges">
          <span class="${stageTypeCss(data.stage)}">${stageLabel}</span>
          ${data.source_page ? `<span class="badge badge-source">${sourceLabel}</span>` : ''}
          ${data.kids ? `<span class="badge" style="background:rgba(201,162,74,0.12);color:#8B6914;">${crm.lang==='en'?'Children':'Filhos'}: ${data.kids}</span>` : ''}
          ${data.has_insurance ? `<span class="badge" style="background:rgba(91,155,213,0.12);color:#2563EB;">${crm.lang==='en'?'Insurance':'Seguro'}: ${data.has_insurance}</span>` : ''}
          ${data.licensed_state ? `<span class="badge" style="background:rgba(46,125,50,0.1);color:#2E7D32;">${data.licensed_state}</span>` : ''}
        </div>
      </div>

      <div class="lead-actions">
        <!-- Stage mover -->
        <div>
          <div class="fi-label" style="margin-top:0">${crm.lang==='en'?'Stage':'Estágio'}</div>
          <div class="stage-select-wrap">
            <select class="stage-select" id="stageSelect" onchange="moveStage(this.value)">
              ${STAGE_ORDER.map(s => `<option value="${s}" ${s===data.stage?'selected':''}>${crm.t('stages.'+s)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Contact log buttons -->
        <div>
          <div class="fi-label">${crm.lang==='en'?'Log contact':'Registrar contato'}</div>
          <div class="contact-log-row">
            ${['texted','emailed','voicemail','no_answer','someone_else'].map(m =>
              `<button class="contact-log-btn" data-method="${m}" onclick="logContact('${m}')">${crm.t('contact.'+m)}</button>`
            ).join('')}
          </div>
        </div>

        <!-- License decision (pending_license stage only) -->
        ${data.stage === 'pending_license' ? renderLicenseSection(data) : ''}

        <!-- Quick actions -->
        <div class="action-group">
          <button class="btn btn-secondary btn-sm" onclick="openApptModal()">📅 ${crm.t('ui.set_appointment')}</button>
          <button class="btn btn-secondary btn-sm" onclick="openPolicyModal()">📋 ${crm.lang==='en'?'Policy':'Apólice'}</button>
          ${!isArchived ? `<button class="btn btn-danger btn-sm" onclick="openArchiveModal()">📁 ${crm.t('ui.archive_lead')}</button>` : ''}
        </div>
      </div>
    </div>

    <div class="lead-sections">
      <div>
        <!-- Notes -->
        <div class="section-card">
          <div class="section-title">${crm.t('ui.notes')}</div>
          <div class="notes-list" id="notesList">${renderNotes(data.notes || [])}</div>
          <textarea class="note-input" id="noteInput" placeholder="${crm.t('ui.add_note')}"></textarea>
          <div class="flex gap-8">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;cursor:pointer;">
              <input type="checkbox" id="notePinCheck"/> ${crm.t('ui.pin_note')}
            </label>
            <button class="btn btn-primary btn-sm" onclick="addNote()">${crm.t('ui.save_note')}</button>
          </div>
        </div>

        <!-- Appointments -->
        ${renderAppointments(data.appointments || [])}

        <!-- Policies -->
        ${renderPolicies(data.policies || [])}
      </div>

      <div>
        <!-- Activity log -->
        <div class="section-card">
          <div class="section-title">${crm.t('ui.activity')}</div>
          <div class="activity-list" id="activityList">${renderActivity(data.activity || [])}</div>
        </div>

        <!-- Meta -->
        <div class="section-card">
          <div class="section-title">${crm.lang==='en'?'Details':'Detalhes'}</div>
          <div style="font-size:0.82rem;color:var(--ink-soft);display:flex;flex-direction:column;gap:6px;">
            <div>${crm.lang==='en'?'Created':'Criado em'}: ${relTime(data.created_at)}</div>
            <div>${crm.lang==='en'?'Last updated':'Atualizado'}: ${relTime(data.updated_at)}</div>
            ${data.last_contact_method ? `<div>${crm.lang==='en'?'Last contact':'Último contato'}: ${crm.t('contact.'+data.last_contact_method)} · ${relTime(data.last_contacted_at)}</div>` : ''}
            ${data.quiz_recommendation ? `<div>${crm.lang==='en'?'Quiz range':'Faixa quiz'}: ${esc(data.quiz_recommendation)}</div>` : ''}
            ${data.insurance_opt_in ? `<div>✓ ${crm.lang==='en'?'Insurance opt-in':'Interesse em seguro'}</div>` : ''}
            <div>ID: #${data.id}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('leadPage').innerHTML = html;

  if (data.stage === 'pending_license') loadStateInfo(data);
}

// ── License decision (pending_license) ─────────────────────────────
function renderLicenseSection(data) {
  const title = crm.lang === 'en' ? 'License Decision' : 'Decisão de Licença';
  const applyingLabel = crm.lang === 'en' ? 'Applying for License' : 'Solicitando Licença';
  const waitingLabel  = crm.lang === 'en' ? 'Waiting for More Interest' : 'Aguardando Mais Interesse';
  const status = data.pending_license_status;
  const loading = crm.lang === 'en' ? 'Loading state info…' : 'Carregando informações do estado…';
  return `
    <div class="license-decision" id="licenseDecision">
      <div class="fi-label">${title}</div>
      <div class="state-fee-box" id="stateFeeBox">
        <span class="text-muted" style="font-size:0.82rem;">${loading}</span>
      </div>
      <div class="contact-log-row" style="margin-top:8px;">
        <button class="contact-log-btn license-btn${status==='applying'?' active':''}" data-decision="applying" onclick="setLicenseDecision('applying')">${applyingLabel}</button>
        <button class="contact-log-btn license-btn${status==='waiting'?' active':''}" data-decision="waiting" onclick="setLicenseDecision('waiting')">${waitingLabel}</button>
      </div>
      <div class="license-info-panel${status==='applying'?'':' hidden'}" id="licenseInfoPanel"></div>
    </div>`;
}

async function loadStateInfo(data) {
  const box = document.getElementById('stateFeeBox');
  const code = (data.licensed_state || '').toUpperCase();
  currentStateInfo = null;
  if (!code) {
    if (box) box.innerHTML = `<span class="text-muted" style="font-size:0.82rem;">${crm.lang==='en'?'No state on file for this lead.':'Nenhum estado registrado para este lead.'}</span>`;
    return;
  }
  try {
    const info = await crm.apiFetch(`/api/crm/state-info/${code}`);
    if (!info || info.error) throw new Error('not found');
    currentStateInfo = info;
    const stateName = STATE_NAMES[code] || code;
    let html = `<div class="state-fee-line"><strong>${esc(stateName)}</strong> — $${info.fee}</div>`;
    if (Array.isArray(info.requirements) && info.requirements.length) {
      html += `<ul class="state-req-list">${info.requirements.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
    }
    if (box) box.innerHTML = html;
    // If the lead already chose "applying", build the info panel now.
    if (data.pending_license_status === 'applying') renderLicenseInfoPanel();
  } catch {
    if (box) box.innerHTML = `<span class="text-muted" style="font-size:0.82rem;">${esc(code)}${crm.lang==='en'?' — fee info unavailable':' — informação indisponível'}</span>`;
  }
}

function renderLicenseInfoPanel() {
  const panel = document.getElementById('licenseInfoPanel');
  if (!panel || !currentStateInfo) return;
  const info = currentStateInfo;
  const links = [];
  if (info.nipr)   links.push(`<a href="https://nipr.com" target="_blank" rel="noopener">NIPR ↗</a>`);
  if (info.sircon) links.push(`<a href="https://www.sircon.com" target="_blank" rel="noopener">Sircon ↗</a>`);
  if (info.url)    links.push(`<a href="${esc(info.url)}" target="_blank" rel="noopener">${esc(info.url.replace(/^https?:\/\//,''))} ↗</a>`);

  let html = `<div class="license-info-title">${crm.lang==='en'?'Where to apply':'Onde solicitar'}</div>`;
  if (links.length) html += `<div class="license-links">${links.join('')}</div>`;
  if (Array.isArray(info.requirements) && info.requirements.length) {
    html += `<div class="license-info-title" style="margin-top:10px;">${crm.lang==='en'?'Reminders':'Lembretes'}</div>`;
    html += `<ul class="state-req-list">${info.requirements.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`;
  }
  panel.innerHTML = html;
  panel.classList.remove('hidden');
}

async function setLicenseDecision(status) {
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/license-decision`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    if (leadData) {
      leadData.pending_license_status = status;
      leadData.pending_license_unread = 0;   // mark read
    }
    document.querySelectorAll('.license-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.decision === status));

    const panel = document.getElementById('licenseInfoPanel');
    if (status === 'applying') {
      renderLicenseInfoPanel();
    } else if (panel) {
      panel.classList.add('hidden');
      panel.innerHTML = '';
    }
    // Best-effort cross-page signal so the board re-checks the holding badge.
    try { localStorage.setItem('crm_holding_last_viewed', String(Date.now())); } catch (e) {}
    showToast(crm.t('ui.saved'));
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

function renderNotes(notes) {
  if (!notes.length) return `<div class="text-muted" style="font-size:0.82rem;padding:4px 0;">${crm.lang==='en'?'No notes yet.':'Nenhuma nota ainda.'}</div>`;
  return notes.map(n => `
    <div class="note-item ${n.is_pinned ? 'pinned' : ''}" data-note-id="${n.id}">
      <button class="note-pin-btn" onclick="togglePin(${n.id}, ${n.is_pinned ? 0 : 1})">${n.is_pinned ? '📌' : '·'}</button>
      <div class="note-content">${esc(n.content)}</div>
      <div class="note-meta">${relTime(n.created_at)}</div>
    </div>`).join('');
}

function renderActivity(items) {
  if (!items.length) return `<div class="text-muted" style="font-size:0.82rem;">${crm.lang==='en'?'No activity yet.':'Sem atividade ainda.'}</div>`;
  const outreachTypes = ['texted','emailed','voicemail','no_answer','someone_else'];
  const pipelineTypes = ['stage_changed','archived','unarchived'];
  return items.map(a => {
    const dotClass = outreachTypes.includes(a.action_type) ? 'outreach'
                   : pipelineTypes.includes(a.action_type) ? 'pipeline' : 'system';
    let text = '';
    if (a.action_type === 'stage_changed') {
      text = `${crm.t('stages.'+a.old_stage)} → ${crm.t('stages.'+a.new_stage)}`;
    } else if (outreachTypes.includes(a.action_type)) {
      text = crm.t('contact.'+a.action_type);
    } else {
      text = a.action_type.replace(/_/g,' ');
    }
    if (a.notes) text += ` · <span style="opacity:0.7">${esc(a.notes)}</span>`;
    return `
      <div class="activity-item">
        <div class="activity-dot ${dotClass}"></div>
        <div>
          <div class="activity-text">${text}</div>
          <div class="activity-time">${relTime(a.created_at)}</div>
        </div>
      </div>`;
  }).join('');
}

function renderAppointments(apts) {
  if (!apts.length) return '';
  const open = apts.filter(a => !a.outcome);
  const past = apts.filter(a => a.outcome);
  let html = `<div class="section-card"><div class="section-title">${crm.t('ui.appointments')}</div>`;
  for (const a of open) {
    const d = a.scheduled_at ? new Date(a.scheduled_at).toLocaleString(crm.lang==='en'?'en-US':'pt-BR',{dateStyle:'medium',timeStyle:'short'}) : '—';
    html += `<div class="appt-card">
      <div class="appt-date">📅 ${d}</div>
      <div class="appt-outcome" style="color:var(--terra);">${crm.lang==='en'?'Upcoming — log outcome below':'Próxima — registre o resultado abaixo'}</div>
      <div class="mt-8"><button class="btn btn-secondary btn-sm" onclick="openApptOutcomeModal()">Registrar resultado</button></div>
    </div>`;
  }
  for (const a of past.slice(0, 3)) {
    const d = a.scheduled_at ? new Date(a.scheduled_at).toLocaleDateString(crm.lang==='en'?'en-US':'pt-BR',{dateStyle:'medium'}) : '—';
    html += `<div class="appt-card" style="opacity:0.65;">
      <div class="appt-date" style="color:var(--ink-soft);">📅 ${d}</div>
      <div class="appt-outcome">${crm.t('ui.'+a.outcome) || a.outcome}${a.outcome_reason?' · '+esc(a.outcome_reason):''}</div>
    </div>`;
  }
  html += '</div>';
  return html;
}

function renderPolicies(pols) {
  if (!pols.length) return '';
  let html = `<div class="section-card"><div class="section-title">${crm.t('ui.policies')}</div>`;
  for (const p of pols) {
    html += `<div class="policy-card">
      <div class="policy-carrier">${esc(p.carrier||'—')}</div>
      <div class="policy-meta">${esc(p.policy_type||'')} ${p.coverage_amount?'· '+esc(p.coverage_amount):''} ${p.premium?'· '+esc(p.premium)+'/mo':''}</div>
      ${p.policy_number?`<div class="policy-meta"># ${esc(p.policy_number)}</div>`:''}
      <span class="policy-status status-${p.status||'pending'}">${p.status||'pending'}</span>
    </div>`;
  }
  html += '</div>';
  return html;
}

// ── Actions ───────────────────────────────────────────────────────
async function moveStage(newStage) {
  try {
    const data = await crm.apiFetch(`/api/crm/leads/${leadId}/stage`, {
      method: 'POST',
      body: JSON.stringify({ stage: newStage }),
    });
    if (data.requiresConfirmation) {
      if (confirm(data.message)) {
        await crm.apiFetch(`/api/crm/leads/${leadId}/stage`, {
          method: 'POST',
          body: JSON.stringify({ stage: newStage, confirmed: true }),
        });
        showToast(crm.t('ui.saved'));
        loadLead();
      } else {
        document.getElementById('stageSelect').value = leadData.stage;
      }
    } else {
      showToast(crm.t('ui.saved'));
      loadLead();
    }
  } catch {
    showToast(crm.t('ui.error_generic'), false);
    document.getElementById('stageSelect').value = leadData.stage;
  }
}

async function logContact(method) {
  document.querySelectorAll('.contact-log-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-method="${method}"]`)?.classList.add('active');
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/activity`, {
      method: 'POST',
      body: JSON.stringify({ action_type: method }),
    });
    showToast(crm.t('ui.sent'));
    setTimeout(() => {
      document.querySelector(`[data-method="${method}"]`)?.classList.remove('active');
      loadLead();
    }, 1500);
  } catch {
    showToast(crm.t('ui.error_generic'), false);
    document.querySelector(`[data-method="${method}"]`)?.classList.remove('active');
  }
}

async function addNote() {
  const content = document.getElementById('noteInput').value.trim();
  if (!content) return;
  const isPinned = document.getElementById('notePinCheck').checked ? 1 : 0;
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/note`, {
      method: 'POST',
      body: JSON.stringify({ content, is_pinned: isPinned }),
    });
    document.getElementById('noteInput').value = '';
    document.getElementById('notePinCheck').checked = false;
    showToast(crm.t('ui.saved'));
    loadLead();
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

async function togglePin(noteId, newPinVal) {
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/note/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: newPinVal }),
    });
    loadLead();
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── Appointment modal ─────────────────────────────────────────────
function openApptModal() {
  document.getElementById('apptModalTitle').textContent = crm.t('ui.set_appointment');
  document.getElementById('apptModalBody').innerHTML = `
    <label class="fi-label">${crm.lang==='en'?'Date and time':'Data e horário'}</label>
    <input class="fi" type="datetime-local" id="apptDateTime"/>`;
  document.getElementById('apptSaveBtn').onclick = saveAppointment;
  document.getElementById('apptModal').classList.remove('hidden');
}

function openApptOutcomeModal() {
  document.getElementById('apptModalTitle').textContent = crm.t('ui.appointment_outcome');
  document.getElementById('apptModalBody').innerHTML = `
    <label class="fi-label">Resultado</label>
    <select class="fi" id="apptOutcome">
      <option value="sale">${crm.t('ui.sale')}</option>
      <option value="no_sale">${crm.t('ui.no_sale')}</option>
      <option value="not_qualified">${crm.t('ui.not_qualified')}</option>
      <option value="cut_short">${crm.t('ui.cut_short')}</option>
    </select>
    <label class="fi-label mt-8">${crm.lang==='en'?'Notes (optional)':'Observações (opcional)'}</label>
    <input class="fi" type="text" id="apptOutcomeReason"/>`;
  document.getElementById('apptSaveBtn').onclick = saveApptOutcome;
  document.getElementById('apptModal').classList.remove('hidden');
}

async function saveAppointment() {
  const dt = document.getElementById('apptDateTime')?.value;
  if (!dt) return;
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/appointment`, {
      method: 'POST',
      body: JSON.stringify({ scheduled_at: new Date(dt).toISOString() }),
    });
    closeModal('apptModal');
    showToast(crm.t('ui.saved'));
    loadLead();
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

async function saveApptOutcome() {
  const outcome = document.getElementById('apptOutcome').value;
  const reason  = document.getElementById('apptOutcomeReason')?.value.trim();
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/appointment`, {
      method: 'POST',
      body: JSON.stringify({ outcome, outcome_reason: reason }),
    });
    closeModal('apptModal');
    showToast(crm.t('ui.saved'));
    loadLead();
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── Archive modal ─────────────────────────────────────────────────
function openArchiveModal() {
  document.getElementById('archiveModal').classList.remove('hidden');
}

async function doArchive() {
  const type   = document.getElementById('archiveType').value;
  const reason = document.getElementById('archiveReason').value.trim();
  if (type !== 'active_policyholder' && !reason) {
    showToast(crm.lang==='en'?'Please add an archive reason.':'Informe o motivo do arquivamento.', false);
    return;
  }
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ archive_type: type, reason }),
    });
    closeModal('archiveModal');
    showToast(crm.t('ui.saved'));
    loadLead();
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── Policy modal ──────────────────────────────────────────────────
function openPolicyModal() {
  // Pre-fill from existing policy if any
  const pol = (leadData?.policies || [])[0];
  if (pol) {
    document.getElementById('pol_carrier').value  = pol.carrier || '';
    document.getElementById('pol_number').value   = pol.policy_number || '';
    document.getElementById('pol_type').value     = pol.policy_type || '';
    document.getElementById('pol_coverage').value = pol.coverage_amount || '';
    document.getElementById('pol_premium').value  = pol.premium || '';
    document.getElementById('pol_effective').value= pol.effective_date ? pol.effective_date.slice(0,10) : '';
    document.getElementById('pol_status').value   = pol.status || 'pending';
    document.getElementById('pol_notes').value    = pol.notes || '';
  }
  document.getElementById('policyModal').classList.remove('hidden');
}

async function savePolicy() {
  const body = {
    carrier:         document.getElementById('pol_carrier').value.trim(),
    policy_number:   document.getElementById('pol_number').value.trim(),
    policy_type:     document.getElementById('pol_type').value.trim(),
    coverage_amount: document.getElementById('pol_coverage').value.trim(),
    premium:         document.getElementById('pol_premium').value.trim(),
    effective_date:  document.getElementById('pol_effective').value || null,
    status:          document.getElementById('pol_status').value,
    notes:           document.getElementById('pol_notes').value.trim(),
  };
  try {
    await crm.apiFetch(`/api/crm/leads/${leadId}/policy`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    closeModal('policyModal');
    showToast(crm.t('ui.saved'));
    loadLead();
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── Data load ─────────────────────────────────────────────────────
async function loadLead() {
  try {
    const data = await crm.apiFetch(`/api/crm/leads/${leadId}`);
    if (!data || data.error) {
      document.getElementById('leadPage').innerHTML = `<div class="error-state">Lead não encontrado.</div>`;
      return;
    }
    renderLead(data);
  } catch (e) {
    document.getElementById('leadPage').innerHTML = `<div class="error-state">${crm.t('ui.error_generic')}</div>`;
  }
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

crm.onLangChange = function () {
  document.documentElement.lang = crm.lang === 'en' ? 'en' : 'pt-BR';
  if (leadData) renderLead(leadData);
};

crm.onAuthReady = function () {
  const params = new URLSearchParams(location.search);
  leadId = parseInt(params.get('id'));
  if (!leadId) {
    document.getElementById('leadPage').innerHTML = `<div class="error-state">ID inválido.</div>`;
    return;
  }
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.classList.toggle('active', b.dataset.langBtn === crm.lang);
  });
  crm.applyI18n();   // translate static nav on first load
  loadLead();
};
