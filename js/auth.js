// js/auth.js
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
  btn.textContent = 'Signing in…';

  console.log('[Auth] sign-in attempt — org:', org, 'user:', user, 'role:', role);

  try {
    const now = firebase.firestore.FieldValue.serverTimestamp();

    // Register/update web account under orgs/{org}/accounts/{user}
    await db.collection('orgs').doc(org)
      .collection('accounts').doc(user)
      .set({
        account_name: user,
        account_pass: pass,
        role:         role,
        org_id:       org,
        device_id:    'web-dashboard',
        device_brand: 'web',
        device_model: 'dashboard',
        last_seen:    now,
      }, { merge: true });

    console.log('[Auth] account registered/updated at orgs/' + org + '/accounts/' + user);

    currentUser = { name: user, org: org, role: role, docId: user };

    // Mirror to users/ for audit + roster
    await db.collection('users').doc(user).set({
      account_name: user,
      account_role: role,
      org_id:       org,
      last_seen:    now,
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
    console.log('[Auth] kill badge update — active:', active);
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

function orgQuery(collection) {
  if (!currentUser?.org) return db.collection(collection);
  return db.collection(collection).where('org_id', '==', currentUser.org);
}

function orgAccountsRef() {
  return db.collection('orgs').doc(currentUser.org).collection('accounts');
}
