// Kanban board logic for crm/index.html

const STAGE_ORDER = [
  // Active pipeline
  { code: 'new_lead',               type: 'active'  },
  { code: 'contacted',              type: 'active'  },
  { code: 'appointment_scheduled',  type: 'active'  },
  { code: 'needs_reschedule',       type: 'active'  },
  { code: 'application_started',    type: 'active'  },
  { code: 'application_submitted',  type: 'active'  },
  { code: 'policy_pending',         type: 'active'  },
  { code: 'policy_issued',          type: 'active'  },
  { code: 'policy_delivered',       type: 'active'  },
  // Holding
  { code: 'pending_license',        type: 'holding' },
  { code: 'orphan',                 type: 'holding' },
  // Archive
  { code: 'archive_no_sale',              type: 'archive' },
  { code: 'archive_active_policyholder',  type: 'archive' },
  { code: 'archive_not_qualified',        type: 'archive' },
];

let allLeads = [];
let searchTerm = '';
let sortValue  = 'newest';
let sourceFilter = '';

// ── Toast ─────────────────────────────────────────────────────────
function showToast(msg, ok) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + (ok === false ? 'toast-err' : 'toast-ok');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}

// ── Day diff helper ───────────────────────────────────────────────
function daysSince(isoStr) {
  if (!isoStr) return null;
  const ms = Date.now() - new Date(isoStr).getTime();
  return Math.floor(ms / 86400000);
}

function formatPhone(p) {
  if (!p) return '—';
  const d = String(p).replace(/\D/g, '');
  if (d.length === 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
  return p;
}

function sourceLabel(src) {
  return crm.t('sources.' + src) || src;
}

// ── Card renderer ─────────────────────────────────────────────────
function renderCard(lead) {
  const days = daysSince(lead.created_at);
  const daysInStage = days !== null ? days : 0;
  const lastContact = lead.last_contacted_at
    ? daysSince(lead.last_contacted_at) + 'd'
    : crm.t('ui.never_contacted');

  const sourceClass = 'source-' + (lead.source_page || '').replace(/-/g, '-');
  const hasAppt = lead.next_appointment && !lead.appointment_outcome;
  const apptClass = hasAppt ? ' has-appointment' : '';

  const tags = [];
  if (lead.source_page) {
    tags.push(`<span class="card-tag tag-source">${sourceLabel(lead.source_page)}</span>`);
  }
  if (hasAppt) {
    const apptDate = new Date(lead.next_appointment).toLocaleDateString(
      crm.lang === 'en' ? 'en-US' : 'pt-BR',
      { month: 'short', day: 'numeric' }
    );
    tags.push(`<span class="card-tag tag-appt">📅 ${apptDate}</span>`);
  }
  if (!lead.last_contacted_at && daysInStage > 3) {
    tags.push(`<span class="card-tag tag-overdue">Sem contato</span>`);
  }

  const a = document.createElement('a');
  a.href = `lead.html?id=${lead.id}`;
  a.className = `lead-card ${sourceClass}${apptClass}`;
  a.innerHTML = `
    <div class="card-name">${escHtml(lead.name)}</div>
    <div class="card-phone">📱 ${formatPhone(lead.phone)}</div>
    ${tags.length ? `<div class="card-tags">${tags.join('')}</div>` : ''}
    <div class="card-meta">
      <span class="card-days">⏱ ${daysInStage}${crm.t('ui.days_in_stage')}</span>
      <span>${lastContact}</span>
    </div>`;
  return a;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Filter + group leads ──────────────────────────────────────────
function filteredLeads() {
  let list = allLeads;
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    list = list.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.phone || '').includes(q) ||
      (l.email || '').toLowerCase().includes(q)
    );
  }
  if (sourceFilter) {
    list = list.filter(l => l.source_page === sourceFilter);
  }
  return list;
}

function groupByStage(leads) {
  const map = {};
  for (const s of STAGE_ORDER) map[s.code] = [];
  for (const l of leads) {
    if (map[l.stage]) map[l.stage].push(l);
  }
  return map;
}

// ── Board renderer ────────────────────────────────────────────────
function renderBoard() {
  const root = document.getElementById('boardRoot');
  const leads = filteredLeads();
  const byStage = groupByStage(leads);

  // Sections
  const sections = [
    { label: crm.t('ui.section_pipeline'), types: ['active'] },
    { label: crm.t('ui.section_holding'),  types: ['holding'] },
    { label: crm.t('ui.section_archive'),  types: ['archive'] },
  ];

  root.innerHTML = '';

  for (const section of sections) {
    const stages = STAGE_ORDER.filter(s => section.types.includes(s.type));

    // Section label
    const labelEl = document.createElement('div');
    labelEl.className = 'board-section-label';
    labelEl.textContent = section.label;
    root.appendChild(labelEl);

    // Columns for this section
    const groupEl = document.createElement('div');
    groupEl.className = 'board-group';

    for (const { code, type } of stages) {
      const colLeads = byStage[code] || [];
      const col = document.createElement('div');
      col.className = 'board-col';

      const header = document.createElement('div');
      header.className = `col-header type-${type}`;
      header.innerHTML = `
        <span class="col-title">${crm.t('stages.' + code)}</span>
        <span class="col-count">${colLeads.length}</span>`;
      col.appendChild(header);

      const cards = document.createElement('div');
      cards.className = 'col-cards';

      if (colLeads.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'col-empty';
        empty.textContent = crm.t('ui.no_leads');
        cards.appendChild(empty);
      } else {
        for (const lead of colLeads) {
          cards.appendChild(renderCard(lead));
        }
      }

      col.appendChild(cards);
      groupEl.appendChild(col);
    }

    root.appendChild(groupEl);
  }
}

// ── Data loading ──────────────────────────────────────────────────
async function loadLeads() {
  const root = document.getElementById('boardRoot');
  root.innerHTML = `<div class="loading-state"><span class="spinner"></span><span>${crm.t('ui.loading')}</span></div>`;
  try {
    let url = `/api/crm/leads?limit=500&sort=${sortValue}`;
    const data = await crm.apiFetch(url);
    if (!Array.isArray(data)) throw new Error('Unexpected response');
    allLeads = data;
    renderBoard();
  } catch (e) {
    root.innerHTML = `<div class="error-state">${crm.t('ui.error_generic')}<br><small>${e.message}</small></div>`;
  }
}

// ── Filter handlers ───────────────────────────────────────────────
function onSearch(val) {
  searchTerm = val.trim();
  renderBoard();
}

function onSort(val) {
  sortValue = val;
  loadLeads();
}

function onSourceFilter(val) {
  sourceFilter = val;
  renderBoard();
}

// ── Lang change ───────────────────────────────────────────────────
crm.onLangChange = function () {
  document.documentElement.lang = crm.lang === 'en' ? 'en' : 'pt-BR';
  renderBoard();
};

// ── Init ──────────────────────────────────────────────────────────
crm.onAuthReady = function (user) {
  // Set active lang button state
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.classList.toggle('active', b.dataset.langBtn === crm.lang);
  });
  crm.applyI18n();   // translate static nav + toolbar on first load
  loadLeads();
};
