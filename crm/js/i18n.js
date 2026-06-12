// Bilingual strings for the CRM. PT-BR is default.
window.crm = window.crm || {};

window.crm.lang = localStorage.getItem('crm_lang') || 'pt';

window.crm.strings = {
  pt: {
    // Stages
    stages: {
      new_lead:                  'Novo Lead',
      contacted:                 'Contato Feito',
      appointment_scheduled:     'Reunião Marcada',
      needs_reschedule:          'Reagendar',
      application_started:       'Aplicação Iniciada',
      application_submitted:     'Aplicação Enviada',
      policy_pending:            'Apólice Pendente',
      policy_issued:             'Apólice Emitida',
      policy_delivered:          'Apólice Entregue',
      pending_license:           'Aguardando Licença',
      orphan:                    'Lead Órfão',
      archive_no_sale:           'Arquivo — Sem Venda',
      archive_active_policyholder: 'Arquivo — Segurado Ativo',
      archive_not_qualified:     'Arquivo — Não Qualificado',
    },
    // Sources
    sources: {
      'landing-insurance':  'Seguro',
      'landing-resources':  'Recursos',
      'emergency-guide':    'Guia Emergência',
      'referral':           'Indicação',
    },
    // Contact methods
    contact: {
      texted:       'Mensagem enviada',
      emailed:      'Email enviado',
      voicemail:    'Recado de voz',
      no_answer:    'Sem resposta',
      someone_else: 'Atendeu outra pessoa',
    },
    // UI
    ui: {
      search:            'Buscar leads...',
      all_stages:        'Todos os estágios',
      active:            'Ativos',
      holding:           'Em espera',
      archive:           'Arquivo',
      add_note:          'Adicionar nota...',
      save_note:         'Salvar nota',
      set_appointment:   'Marcar reunião',
      move_stage:        'Mover estágio',
      log_contact:       'Registrar contato',
      archive_lead:      'Arquivar lead',
      loading:           'Carregando...',
      no_leads:          'Nenhum lead neste estágio',
      days_in_stage:     'd no estágio',
      last_contact:      'Último contato',
      never_contacted:   'Sem contato ainda',
      save:              'Salvar',
      cancel:            'Cancelar',
      confirm:           'Confirmar',
      error_generic:     'Algo deu errado. Tente novamente.',
      saved:             'Salvo!',
      sent:              'Enviado!',
      appointment_outcome: 'Resultado da reunião',
      sale:              'Venda',
      no_sale:           'Sem venda',
      not_qualified:     'Não qualificado',
      cut_short:         'Reunião interrompida',
      archive_reason:    'Motivo do arquivamento',
      pin_note:          'Fixar',
      unpin_note:        'Desafixar',
      section_pipeline:  'Pipeline Ativo',
      section_holding:   'Em Espera',
      section_archive:   'Arquivo',
      profile_title:     'Perfil da Agente',
      licensed_states:   'Estados Licenciados',
      carrier_contacts:  'Contatos de Seguradoras',
      add_state:         'Adicionar estado',
      add_carrier:       'Adicionar seguradora',
      sign_out:          'Sair',
      notes:             'Notas',
      activity:          'Atividade',
      appointments:      'Reuniões',
      policies:          'Apólices',
      submissions:       'Formulários',
      profile:           'Perfil',
      active_nav:        'Ativos',
      sort_newest:       'Mais recentes',
      sort_oldest:       'Mais antigos',
      sort_no_contact:   'Sem contato (primeiro)',
      all_sources:       'Todas as fontes',
    }
  },
  en: {
    stages: {
      new_lead:                  'New Lead',
      contacted:                 'Contacted',
      appointment_scheduled:     'Appointment Scheduled',
      needs_reschedule:          'Needs Reschedule',
      application_started:       'Application Started',
      application_submitted:     'Application Submitted',
      policy_pending:            'Policy Pending',
      policy_issued:             'Policy Issued',
      policy_delivered:          'Policy Delivered',
      pending_license:           'Pending License',
      orphan:                    'Orphan Lead',
      archive_no_sale:           'Archive — No Sale',
      archive_active_policyholder: 'Archive — Active Policyholder',
      archive_not_qualified:     'Archive — Not Qualified',
    },
    sources: {
      'landing-insurance':  'Insurance',
      'landing-resources':  'Resources',
      'emergency-guide':    'Emergency Guide',
      'referral':           'Referral',
    },
    contact: {
      texted:       'Texted',
      emailed:      'Emailed',
      voicemail:    'Left voicemail',
      no_answer:    'No answer',
      someone_else: 'Someone else answered',
    },
    ui: {
      search:            'Search leads...',
      all_stages:        'All stages',
      active:            'Active',
      holding:           'Holding',
      archive:           'Archive',
      add_note:          'Add a note...',
      save_note:         'Save note',
      set_appointment:   'Set appointment',
      move_stage:        'Move stage',
      log_contact:       'Log contact',
      archive_lead:      'Archive lead',
      loading:           'Loading...',
      no_leads:          'No leads in this stage',
      days_in_stage:     'd in stage',
      last_contact:      'Last contact',
      never_contacted:   'Never contacted',
      save:              'Save',
      cancel:            'Cancel',
      confirm:           'Confirm',
      error_generic:     'Something went wrong. Please try again.',
      saved:             'Saved!',
      sent:              'Sent!',
      appointment_outcome: 'Appointment outcome',
      sale:              'Sale',
      no_sale:           'No sale',
      not_qualified:     'Not qualified',
      cut_short:         'Cut short',
      archive_reason:    'Archive reason',
      pin_note:          'Pin',
      unpin_note:        'Unpin',
      section_pipeline:  'Active Pipeline',
      section_holding:   'Holding',
      section_archive:   'Archive',
      profile_title:     'Agent Profile',
      licensed_states:   'Licensed States',
      carrier_contacts:  'Carrier Contacts',
      add_state:         'Add state',
      add_carrier:       'Add carrier',
      sign_out:          'Sign out',
      notes:             'Notes',
      activity:          'Activity',
      appointments:      'Appointments',
      policies:          'Policies',
      submissions:       'Submissions',
      profile:           'Profile',
      active_nav:        'Active',
      sort_newest:       'Newest first',
      sort_oldest:       'Oldest first',
      sort_no_contact:   'No contact first',
      all_sources:       'All sources',
    }
  }
};

// t('ui.search') or t('stages.new_lead')
window.crm.t = function(key) {
  const parts = key.split('.');
  let obj = window.crm.strings[window.crm.lang];
  for (const p of parts) { obj = obj?.[p]; }
  if (obj === undefined) {
    // fallback to PT
    obj = window.crm.strings.pt;
    for (const p of parts) { obj = obj?.[p]; }
  }
  return obj || key;
};

// Apply data-i18n attributes to static elements (nav, toolbar, options).
// INPUT/TEXTAREA get their placeholder set; everything else (incl. OPTION) gets textContent.
window.crm.applyI18n = function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(function(el) {
    var key = el.getAttribute('data-i18n');
    var val = crm.t(key);
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
};

window.crm.setLang = function(lang) {
  window.crm.lang = lang;
  localStorage.setItem('crm_lang', lang);
  document.querySelectorAll('[data-lang-btn]').forEach(b => {
    b.classList.toggle('active', b.dataset.langBtn === lang);
  });
  if (typeof window.crm.onLangChange === 'function') window.crm.onLangChange(lang);
  window.crm.applyI18n();
};
