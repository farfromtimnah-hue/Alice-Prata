// Shared form submission helper for Alice Prata public forms.
// Included before each page's own <script> block.

window.CRM_API = 'https://alice-prata-crm-api.farfromtimnah.workers.dev';

// Posts data to a Worker endpoint. Returns { ok, data, error }.
window.submitToApi = async function(endpoint, payload) {
  try {
    const res = await fetch(window.CRM_API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};
