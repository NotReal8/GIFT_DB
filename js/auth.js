// js/auth.js
// Sign-in queries: orgs/{org}/accounts where account_name+account_pass+role match
// (unchanged — app already writes to this path via beacon_service.dart ping())

let currentUser = null; // { name, org, role, docId }

function togglePw(id, btn) {
  const el = document.getElementById(id);
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

async function handleSignIn() {
  const errEl = document.getElementById('si-error');
  errEl.classList.add('hidden');

  const org  = document.getElementById('si-org').value.trim();
  const user = document.getElementById('si-user').value.trim();
  const pass = document.getElementById('si-pass').value.trim();
  const role = document.getElementById('si-role').value;

  if (!org || !user || !pass) {
    errEl.textContent = 'All fields are required.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('si-btn');
  btn.disabled = true;
  btn.textContent = 'Verifying…';

  console.log('[Auth] sign-in attempt — org:', org, 'user:', user, 'role:', role);

  try {
    // Query orgs/{org}/accounts for matching credentials + role
    const snap = await db
      .collection('orgs').doc(org)
      .collection('accounts')
      .where('account_name', '==', user)
      .where('account_pass', '==', pass)
      .where('role',         '==', role)
      .get();

    console.log('[Auth] query returned', snap.size, 'doc(s)');

    if (snap.empty) {
      const snapNoRole = await db
        .collection('orgs').doc(org)
        .collection('accounts')
        .where('account_name', '==', user)
        .where('account_pass', '==', pass)
        .get();

      errEl.textContent = snapNoRole.empty
        ? 'Invalid organization, username, or password.'
        : 'Credentials correct but role does not match. Check your role selection.';
      errEl.classList.remove('hidden');
      console.log('[Auth] sign-in failed');
      return;
    }

    const docSnap = snap.docs[0];
    const data    = docSnap.data();
    currentUser   = {
      name:  data.account_name,
      org:   org,
      role:  data.role || role,
      docId: docSnap.id,
    };

    // Update last_seen
    await db.collection('orgs').doc(org)
      .collection('accounts').doc(docSnap.id)
      .update({ last_seen: firebase.firestore.FieldValue.serverTimestamp() });

    // Mirror to users/ for audit page device status
    await db.collection('users').doc(docSnap.id).set({
      account_name: currentUser.name,
      account_role: currentUser.role,
      org_id:       org,
      last_seen:    firebase.firestore.FieldValue.serverTimestamp(),
      device_brand: 'web',
      device_model: 'dashboard',
    }, { merge: true });

    console.log('[Auth] sign-in success —', currentUser);
    sessionStorage.setItem('gift_user', JSON.stringify(currentUser));
    _enterApp();

  } catch (e) {
    console.error('[Auth] error:', e);
    errEl.textContent = 'Error: ' + e.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enter Dashboard';
  }
}

function _enterApp() {
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('topbar-user').textContent = currentUser.name;
  document.getElementById('topbar-role').textContent = currentUser.role;
  console.log('[Auth] app entered, org-scope:', currentUser.org);
  navigateTo('home', document.querySelector('.nav-item[data-page="home"]'));
  _watchKillBadge();
}

function signOut() {
  console.log('[Auth] signing out');
  currentUser = null;
  sessionStorage.removeItem('gift_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-overlay').classList.remove('hidden');
  document.getElementById('page-container').innerHTML = '';
  ['si-org','si-user','si-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function _watchKillBadge() {
  db.collection('config').doc('kill_switch').onSnapshot(snap => {
    const data   = snap.exists ? snap.data() : {};
    const active = data.active !== false;
    const hasKilledDevices  = (data.killed_devices  || []).length > 0;
    const hasKilledAccounts = (data.killed_accounts || []).length > 0;
    const badge = document.getElementById('kill-badge');
    if (badge) {
      badge.classList.toggle('hidden', active && !hasKilledDevices && !hasKilledAccounts);
    }
  }, e => console.error('[Auth] kill badge watch error:', e));
}

function initAuth() {
  const saved = sessionStorage.getItem('gift_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      console.log('[Auth] session restored:', currentUser);
      _enterApp();
      return;
    } catch(e) {
      console.warn('[Auth] session parse failed:', e);
    }
  }
  document.getElementById('auth-overlay').classList.remove('hidden');
}

// Org-scoped helpers
function orgQuery(collection) {
  if (!currentUser?.org) return db.collection(collection);
  return db.collection(collection).where('org_id', '==', currentUser.org);
}

function orgAccountsRef() {
  return db.collection('orgs').doc(currentUser.org).collection('accounts');
}
