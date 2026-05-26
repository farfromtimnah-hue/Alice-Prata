// Profile / settings page logic for crm/profile.html

let profileData = {};
let statesData  = [];
let carriersData = [];

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
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

// ── Render ────────────────────────────────────────────────────────
function renderPage() {
  const p = profileData;
  const t = crm.t.bind(crm);

  const html = `
    <!-- Agent profile -->
    <div class="settings-section">
      <div class="settings-title">${t('ui.profile_title')}</div>
      <div class="fi-row">
        <div>
          <label class="fi-label">${crm.lang==='en'?'Full name':'Nome completo'}</label>
          <input class="fi" id="p_name" value="${esc(p.name)}" type="text"/>
        </div>
        <div>
          <label class="fi-label">Email</label>
          <input class="fi" id="p_email" value="${esc(p.email)}" type="email"/>
        </div>
      </div>
      <div class="fi-row">
        <div>
          <label class="fi-label">${crm.lang==='en'?'Phone / WhatsApp':'Telefone / WhatsApp'}</label>
          <input class="fi" id="p_phone" value="${esc(p.phone)}" type="tel"/>
        </div>
        <div>
          <label class="fi-label">${crm.lang==='en'?'Business name':'Nome da empresa'}</label>
          <input class="fi" id="p_business" value="${esc(p.business_name)}" type="text"/>
        </div>
      </div>
      <div class="fi-row">
        <div>
          <label class="fi-label">${crm.lang==='en'?'Manager name':'Nome do gerente'}</label>
          <input class="fi" id="p_mgr_name" value="${esc(p.manager_name)}" type="text"/>
        </div>
        <div>
          <label class="fi-label">${crm.lang==='en'?'Manager WhatsApp (for help button)':'WhatsApp do gerente (botão de ajuda)'}</label>
          <input class="fi" id="p_mgr_phone" value="${esc(p.manager_phone)}" type="tel"/>
        </div>
      </div>
      <div class="fi-row">
        <div>
          <label class="fi-label">${crm.lang==='en'?'License number':'Número de licença'}</label>
          <input class="fi" id="p_license" value="${esc(p.license_number)}" type="text"/>
        </div>
        <div>
          <label class="fi-label">NMLS</label>
          <input class="fi" id="p_nmls" value="${esc(p.nmls)}" type="text"/>
        </div>
      </div>
      <div style="margin-top:16px;">
        <button class="btn btn-primary" onclick="saveProfile()">${t('ui.save')}</button>
      </div>
    </div>

    <!-- Licensed states -->
    <div class="settings-section">
      <div class="settings-title">${t('ui.licensed_states')}</div>
      <p style="font-size:0.84rem;color:var(--ink-soft);margin-bottom:14px;">
        ${crm.lang==='en'
          ? 'Leads in states not listed here are automatically moved to "Pending License".'
          : 'Leads em estados não listados aqui são movidos automaticamente para "Aguardando Licença".'}
      </p>
      <div class="state-pills" id="statePills">${renderStatePills()}</div>
      <div class="flex gap-8" style="margin-top:8px;">
        <input class="fi" id="stateInput" type="text" maxlength="2" placeholder="${crm.lang==='en'?'State code, e.g. FL':'Código do estado, ex: FL'}" style="max-width:200px;text-transform:uppercase;"/>
        <input class="fi" id="stateNameInput" type="text" placeholder="${crm.lang==='en'?'State name (optional)':'Nome do estado (opcional)'}" style="max-width:200px;"/>
        <button class="btn btn-secondary" onclick="addState()">${t('ui.add_state')}</button>
      </div>
    </div>

    <!-- Carrier contacts -->
    <div class="settings-section">
      <div class="settings-title">${t('ui.carrier_contacts')}</div>
      <div id="carrierList">${renderCarrierList()}</div>
      <div style="margin-top:14px;">
        <button class="btn btn-secondary" onclick="openCarrierModal(null)">${t('ui.add_carrier')}</button>
      </div>
    </div>

    <!-- Referrals (consented) -->
    <div class="settings-section">
      <div class="settings-title">${crm.lang==='en'?'Consented Referrals':'Indicações com Consentimento'}</div>
      <p style="font-size:0.84rem;color:var(--ink-soft);margin-bottom:14px;">
        ${crm.lang==='en'
          ? 'US contacts from emergency guides where the submitter gave referral consent.'
          : 'Contatos dos EUA de guias de emergência onde o remetente deu consentimento de indicação.'}
      </p>
      <div id="referralList"><div class="loading-state" style="padding:20px;"><span class="spinner"></span></div></div>
    </div>
  `;

  document.getElementById('settingsPage').innerHTML = html;
  loadReferrals();
}

function renderStatePills() {
  if (!statesData.length) return `<span style="font-size:0.82rem;color:var(--ink-soft);opacity:0.6;">${crm.lang==='en'?'No states added yet.':'Nenhum estado adicionado ainda.'}</span>`;
  return statesData.map(s => `
    <div class="state-pill">
      <span>${esc(s.state_code)}${s.state_name ? ' — ' + esc(s.state_name) : ''}</span>
      <button onclick="removeState('${esc(s.state_code)}')" title="Remover">✕</button>
    </div>`).join('');
}

function renderCarrierList() {
  if (!carriersData.length) return `<div style="font-size:0.82rem;color:var(--ink-soft);opacity:0.6;padding:8px 0;">${crm.lang==='en'?'No carriers yet.':'Nenhuma seguradora ainda.'}</div>`;
  return carriersData.map(c => `
    <div class="carrier-row">
      <div>
        <div class="carrier-name">${esc(c.name)}</div>
        <div class="carrier-meta">
          ${c.claims_phone ? `📞 ${esc(c.claims_phone)}` : ''}
          ${c.general_phone ? ` · ${esc(c.general_phone)}` : ''}
          ${c.portal_url ? ` · <a href="${esc(c.portal_url)}" target="_blank">${crm.lang==='en'?'Portal':'Portal'} ↗</a>` : ''}
        </div>
      </div>
      <div class="flex gap-8">
        <button class="btn btn-secondary btn-sm" onclick="openCarrierModal(${c.id})">${crm.lang==='en'?'Edit':'Editar'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCarrier(${c.id})">✕</button>
      </div>
    </div>`).join('');
}

// ── Profile save ──────────────────────────────────────────────────
async function saveProfile() {
  const body = {
    name:          document.getElementById('p_name').value.trim(),
    email:         document.getElementById('p_email').value.trim(),
    phone:         document.getElementById('p_phone').value.trim(),
    business_name: document.getElementById('p_business').value.trim(),
    manager_name:  document.getElementById('p_mgr_name').value.trim(),
    manager_phone: document.getElementById('p_mgr_phone').value.trim(),
    license_number:document.getElementById('p_license').value.trim(),
    nmls:          document.getElementById('p_nmls').value.trim(),
  };
  try {
    await crm.apiFetch('/api/crm/profile', { method: 'PATCH', body: JSON.stringify(body) });
    showToast(crm.t('ui.saved'));
    profileData = { ...profileData, ...body };
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── States ────────────────────────────────────────────────────────
async function addState() {
  const code = document.getElementById('stateInput').value.trim().toUpperCase().slice(0,2);
  const name = document.getElementById('stateNameInput').value.trim();
  if (!code || code.length !== 2) {
    showToast(crm.lang==='en'?'Enter a 2-letter state code.':'Digite um código de estado com 2 letras.', false);
    return;
  }
  try {
    await crm.apiFetch('/api/crm/licensed-states', {
      method: 'POST',
      body: JSON.stringify({ state_code: code, state_name: name || code }),
    });
    document.getElementById('stateInput').value = '';
    document.getElementById('stateNameInput').value = '';
    if (!statesData.find(s => s.state_code === code)) {
      statesData.push({ state_code: code, state_name: name || code });
    }
    document.getElementById('statePills').innerHTML = renderStatePills();
    showToast(crm.t('ui.saved'));
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

async function removeState(code) {
  if (!confirm(crm.lang==='en'?`Remove ${code}?`:`Remover ${code}?`)) return;
  try {
    await crm.apiFetch(`/api/crm/licensed-states/${code}`, { method: 'DELETE' });
    statesData = statesData.filter(s => s.state_code !== code);
    document.getElementById('statePills').innerHTML = renderStatePills();
    showToast(crm.t('ui.saved'));
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── Carriers ──────────────────────────────────────────────────────
function openCarrierModal(id) {
  const carrier = id ? carriersData.find(c => c.id === id) : null;
  document.getElementById('carrierId').value   = id || '';
  document.getElementById('carrierModalTitle').textContent = carrier
    ? (crm.lang==='en'?'Edit Carrier':'Editar Seguradora')
    : crm.t('ui.add_carrier');
  document.getElementById('c_name').value    = esc(carrier?.name || '');
  document.getElementById('c_claims').value  = esc(carrier?.claims_phone || '');
  document.getElementById('c_general').value = esc(carrier?.general_phone || '');
  document.getElementById('c_email').value   = esc(carrier?.email || '');
  document.getElementById('c_portal').value  = esc(carrier?.portal_url || '');
  document.getElementById('c_notes').value   = esc(carrier?.notes || '');
  document.getElementById('carrierModal').classList.remove('hidden');
}

async function saveCarrier() {
  const id   = document.getElementById('carrierId').value;
  const body = {
    name:          document.getElementById('c_name').value.trim(),
    claims_phone:  document.getElementById('c_claims').value.trim(),
    general_phone: document.getElementById('c_general').value.trim(),
    email:         document.getElementById('c_email').value.trim(),
    portal_url:    document.getElementById('c_portal').value.trim(),
    notes:         document.getElementById('c_notes').value.trim(),
  };
  if (!body.name) {
    showToast(crm.lang==='en'?'Carrier name is required.':'Nome da seguradora é obrigatório.', false);
    return;
  }
  try {
    if (id) {
      await crm.apiFetch(`/api/crm/carriers/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      const idx = carriersData.findIndex(c => c.id === parseInt(id));
      if (idx >= 0) carriersData[idx] = { ...carriersData[idx], ...body };
    } else {
      const res = await crm.apiFetch('/api/crm/carriers', { method: 'POST', body: JSON.stringify(body) });
      if (res?.id) carriersData.push({ id: res.id, ...body });
    }
    closeModal('carrierModal');
    document.getElementById('carrierList').innerHTML = renderCarrierList();
    showToast(crm.t('ui.saved'));
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

async function deleteCarrier(id) {
  if (!confirm(crm.lang==='en'?'Delete this carrier?':'Excluir esta seguradora?')) return;
  try {
    await crm.apiFetch(`/api/crm/carriers/${id}`, { method: 'DELETE' });
    carriersData = carriersData.filter(c => c.id !== id);
    document.getElementById('carrierList').innerHTML = renderCarrierList();
    showToast(crm.t('ui.saved'));
  } catch {
    showToast(crm.t('ui.error_generic'), false);
  }
}

// ── Referrals ─────────────────────────────────────────────────────
async function loadReferrals() {
  try {
    const data = await crm.apiFetch('/api/crm/referrals');
    const el = document.getElementById('referralList');
    if (!el) return;
    if (!data || !data.length) {
      el.innerHTML = `<div style="font-size:0.82rem;color:var(--ink-soft);opacity:0.6;">${crm.lang==='en'?'No consented referrals yet.':'Nenhuma indicação com consentimento ainda.'}</div>`;
      return;
    }
    el.innerHTML = data.map(r => `
      <div class="carrier-row">
        <div>
          <div class="carrier-name">${esc(r.name)} ${r.relation ? `<span style="font-weight:400;color:var(--ink-soft)">(${esc(r.relation)})</span>` : ''}</div>
          <div class="carrier-meta">
            ${r.phone ? `📱 ${esc(r.phone)}` : ''}
            ${r.email ? ` · ${esc(r.email)}` : ''}
            ${r.from_lead_name ? ` · ${crm.lang==='en'?'From':'De'}: ${esc(r.from_lead_name)}` : ''}
          </div>
        </div>
        ${r.lead_id
          ? `<a href="lead.html?id=${r.lead_id}" class="btn btn-secondary btn-sm">${crm.lang==='en'?'View lead':'Ver lead'}</a>`
          : `<span style="font-size:0.78rem;color:var(--ink-soft);">${crm.lang==='en'?'Not yet a lead':'Ainda não é lead'}</span>`}
      </div>`).join('');
  } catch {
    const el = document.getElementById('referralList');
    if (el) el.innerHTML = `<div style="font-size:0.82rem;color:#c0392b;">${crm.t('ui.error_generic')}</div>`;
  }
}

// ── Modal close on overlay ────────────────────────────────────────
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// ── Lang change ───────────────────────────────────────────────────
crm.onLangChange = function () {
  document.documentElement.lang = crm.lang === 'en' ? 'en' : 'pt-BR';
  renderPage();
};

// ── Init ──────────────────────────────────────────────────────────
crm.onAuthReady = async function () {
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.classList.toggle('active', b.dataset.langBtn === crm.lang);
  });
  try {
    const [profile, states, carriers] = await Promise.all([
      crm.apiFetch('/api/crm/profile'),
      crm.apiFetch('/api/crm/licensed-states'),
      crm.apiFetch('/api/crm/carriers'),
    ]);
    profileData  = profile  || {};
    statesData   = Array.isArray(states)   ? states   : [];
    carriersData = Array.isArray(carriers) ? carriers : [];
    renderPage();
  } catch {
    document.getElementById('settingsPage').innerHTML =
      `<div class="error-state">${crm.t('ui.error_generic')}</div>`;
  }
};
