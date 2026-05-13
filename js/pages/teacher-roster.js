// js/pages/teacher-roster.js
function teacherRoster(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Teacher Roster</div>
          <div class="page-sub">Devices registered under <strong style="color:var(--text-p)">${currentUser?.org || '—'}</strong></div>
        </div>
        <span id="tr-count" class="audit-count-badge">Loading…</span>
      </div>
      <div id="tr-grid" class="roster-grid">
        <div style="font-size:13px;color:var(--text-s)">Loading…</div>
      </div>
    </div>`;

  const cutoff30 = new Date(Date.now() - 30 * 60000); // 30 min = "online"

  const unsub = orgQuery('users').onSnapshot(snap => {
    const countEl = document.getElementById('tr-count');
    const grid    = document.getElementById('tr-grid');
    if (!grid) return;

    if (countEl) countEl.textContent = snap.size + ' device(s)';

    if (snap.empty) {
      grid.innerHTML = '<div style="font-size:13px;color:var(--text-s)">No devices registered for this organization.</div>';
      return;
    }

    grid.innerHTML = snap.docs.map(doc => {
      const d      = doc.data();
      const name   = d.account_name || doc.id;
      const init   = name.charAt(0).toUpperCase();
      const ls     = d.last_seen?.toDate?.();
      const online = ls && ls > cutoff30;
      const timeStr = ls
        ? (Date.now() - ls < 3600000
            ? Math.round((Date.now() - ls) / 60000) + 'm ago'
            : ls.toLocaleString())
        : 'Never';

      return `
        <div class="roster-card ${online ? 'online' : 'offline'}">
          <div class="roster-avatar">${init}</div>
          <div class="roster-info">
            <div class="roster-name">${name}</div>
            <div class="roster-meta">${d.device_brand || ''} ${d.device_model || '—'}</div>
            <div class="roster-meta" style="margin-top:2px">
              <span class="online-dot ${online ? 'on' : 'off'}" style="display:inline-block;margin-right:5px"></span>
              ${online ? '<span style="color:var(--green)">Online</span>' : timeStr}
            </div>
          </div>
          <div class="roster-role">${d.account_role || d.role || '—'}</div>
        </div>`;
    }).join('');
  }, e => {
    console.error('[teacher-roster]', e);
    const grid = document.getElementById('tr-grid');
    if (grid) grid.innerHTML = `<div style="color:var(--red);font-size:13px">Error: ${e.message}</div>`;
  });

  registerUnsub(unsub);
}

function studentRoster(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-header"><div class="page-title">Student Roster</div></div>
      <div class="placeholder-hero">
        <div class="placeholder-icon">🎓</div>
        <div class="placeholder-title">Coming Soon</div>
        <div class="placeholder-sub">Student roster sync from the mobile app will be added in a future update.</div>
      </div>
    </div>`;
}

function settings(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-header"><div class="page-title">Settings</div></div>
      <div class="placeholder-hero">
        <div class="placeholder-icon">⚙️</div>
        <div class="placeholder-title">Coming Soon</div>
        <div class="placeholder-sub">Dashboard settings will be added in a future update.</div>
      </div>
    </div>`;
}
