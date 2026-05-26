// CRM auth guard. Load after Firebase SDK + firebase-config.js.
// Hides page until Firebase confirms the session; redirects to login if unauthenticated.

(function () {
  const API = 'https://alice-prata-crm-api.farfromtimnah.workers.dev';

  // Hide body until auth is resolved to avoid flash of protected content.
  document.documentElement.style.visibility = 'hidden';

  if (!window.firebase) {
    console.error('[auth] Firebase SDK not loaded.');
    document.documentElement.style.visibility = '';
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
  }

  window.crm = window.crm || {};
  window.crm.firebaseAuth = firebase.auth();

  window.crm.firebaseAuth.onAuthStateChanged(function (user) {
    if (user) {
      document.documentElement.style.visibility = '';
      window.crm.currentUser = user;
      const emailEl = document.getElementById('navUserEmail');
      if (emailEl) emailEl.textContent = user.email || user.displayName || '';
      if (typeof window.crm.onAuthReady === 'function') window.crm.onAuthReady(user);
    } else {
      // Not authenticated — send to login
      window.location.href = 'login.html';
    }
  });

  window.crm.signOut = async function () {
    await window.crm.firebaseAuth.signOut();
    window.location.href = 'login.html';
  };

  window.crm.getIdToken = async function () {
    const user = window.crm.firebaseAuth.currentUser;
    if (!user) return null;
    return await user.getIdToken(/* forceRefresh= */ false);
  };

  // Authenticated fetch helper — automatically attaches Firebase token.
  // Returns parsed JSON or throws.
  window.crm.apiFetch = async function (endpoint, options) {
    options = options || {};
    const token = await window.crm.getIdToken();
    if (!token) { window.location.href = 'login.html'; return; }
    const res = await fetch(API + endpoint, {
      ...options,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      }, options.headers || {}),
    });
    if (res.status === 401) { window.location.href = 'login.html'; return; }
    return res.json();
  };
})();
