// js/pages/teacher-roster.js
function teacherRoster(container) {
  if (!currentUser?.org) {
    container.innerHTML = '<div class="page"><p style="color:var(--text-s)">Not signed in to an org.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Teacher Roster</div>
          <div class="page-sub">All accounts under <strong style="color:var(--text-p)">${currentUser.org}</strong></div>
        </div>
        <span id="tr-count" class="audit-count-badge">Loading…</span>
      </div>
      <div id="tr-grid" class="roster-grid">
        <div style="font-size:13px;color:var(--text-s)">Loading…</div>
      </div>
    </div>`;

  const unsub = db.collection('orgs').doc(currentUser.org)
    .collection('accounts')
    .onSnapshot(snap => {
      const countEl = document.getElementById('tr-count');
      const grid    = document.getElementById('tr-grid');
      if (!grid) return;

      if (countEl) countEl.textContent = snap.size + ' account(s)';

      if (snap.empty) {
        grid.innerHTML = '<div style="font-size:13px;color:var(--text-s)">No accounts found for this organization.</div>';
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
              <div class="roster-meta">Role: ${d.role || d.account_role || '—'}</div>
              <div class="roster-meta">${d.device_brand || ''} ${d.device_model || '—'}</div>
            </div>
            <div class="roster-role">${d.role || d.account_role || '—'}</div>
          </div>`;
      }).join('');
    }, e => {
      console.error('[teacher-roster]', e);
      const grid = document.getElementById('tr-grid');
      if (grid) grid.innerHTML = `<div style="color:var(--red);font-size:13px">Error: ${e.message}</div>`;
    });

  registerUnsub(unsub);
}
