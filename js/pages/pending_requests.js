// js/pages/pending-requests.js
// Reads/writes orgs/{org}/pending_accounts/{name}

function pendingRequests(container) {
  if (!currentUser?.org) {
    container.innerHTML = '<div class="page"><p style="color:var(--text-s)">Not signed in to an org.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><div class="page-title">Pending Requests</div>
          <div class="page-sub">New account requests for <strong style="color:var(--text-p)">${currentUser.org}</strong></div></div>
        <span id="pr-count" class="audit-count-badge">Loading…</span>
      </div>
      <div id="pr-grid" class="roster-grid">
        <div style="font-size:13px;color:var(--text-s)">Loading…</div>
      </div>
    </div>`;

  const unsub = db.collection('orgs').doc(currentUser.org)
    .collection('pending_accounts')
    .where('status', '==', 'pending')
    .onSnapshot(snap => {
      const countEl = document.getElementById('pr-count');
      const grid    = document.getElementById('pr-grid');
      if (!grid) return;

      if (countEl) countEl.textContent = snap.size + ' pending';

      if (snap.empty) {
        grid.innerHTML = '<div style="font-size:13px;color:var(--text-s)">No pending requests.</div>';
        return;
      }

      grid.innerHTML = snap.docs.map(doc => {
        const d    = doc.data();
        const name = d.account_name || doc.id;
        const init = name.charAt(0).toUpperCase();
        return `
          <div class="roster-card online">
            <div class="roster-avatar">${init}</div>
            <div class="roster-info">
              <div class="roster-name">${name}</div>
              <div class="roster-meta">Role: ${d.role || '—'}</div>
              <div class="roster-meta">${d.device_brand || ''} ${d.device_model || ''}</div>
            </div>
            <div style="display:flex;gap:6px">
              <button class="btn-sm" onclick="prApprove('${doc.id}')">Accept</button>
              <button class="btn-sm danger" onclick="prReject('${doc.id}')">Reject</button>
            </div>
          </div>`;
      }).join('');
    }, e => {
      console.error('[pending-requests]', e);
      const grid = document.getElementById('pr-grid');
      if (grid) grid.innerHTML = `<div style="color:var(--red);font-size:13px">Error: ${e.message}</div>`;
    });

  registerUnsub(unsub);
}

async function prApprove(docId) {
  const org     = currentUser.org;
  const pendRef = db.collection('orgs').doc(org).collection('pending_accounts').doc(docId);
  const snap    = await pendRef.get();
  if (!snap.exists) return;
  const d = snap.data();

  await db.collection('orgs').doc(org).collection('accounts').doc(docId).set({
    account_name:    d.account_name || docId,
    account_pass:    d.account_pass || '',
    role:            d.role || 'Teacher',
    org_id:          org,
    device_id:       d.device_id || '',
    device_brand:    d.device_brand || '',
    device_model:    d.device_model || '',
    last_seen:       firebase.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  await pendRef.set({ status: 'approved' }, { merge: true });
  console.log('[pending-requests] approved', docId);
}

async function prReject(docId) {
  const org = currentUser.org;
  await db.collection('orgs').doc(org).collection('pending_accounts').doc(docId)
    .set({ status: 'rejected' }, { merge: true });
  console.log('[pending-requests] rejected', docId);
}
