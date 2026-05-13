// js/pages/home.js
function home(container) {
  const org = currentUser?.org || '—';
  const name = currentUser?.name || '—';

  container.innerHTML = `
    <div class="page">

      <!-- Hero -->
      <div class="home-hero">
        <div class="home-eyebrow">Facial Recognition Attendance — ${org}</div>
        <div class="home-title">Good to see you,<br>${name}.</div>
        <div class="home-desc">
          Real-time oversight of attendance sessions, device health, and audit logs
          for your organization.
        </div>
        <div class="home-pills">
          <span class="home-pill active" id="hp-live">● Live</span>
          <span class="home-pill" id="hp-org">${org}</span>
          <span class="home-pill" id="hp-role">${currentUser?.role || '—'}</span>
        </div>
      </div>

      <!-- Stats -->
      <div class="stat-grid">
        <div class="stat-card blue">
          <div class="stat-icon">👨‍🏫</div>
          <div class="stat-value" id="hs-devices">—</div>
          <div class="stat-label">Registered Devices</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-value" id="hs-active">—</div>
          <div class="stat-label">Active (7 days)</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon">📅</div>
          <div class="stat-value" id="hs-pings">—</div>
          <div class="stat-label">Total App Launches</div>
        </div>
        <div class="stat-card violet">
          <div class="stat-icon">🏢</div>
          <div class="stat-value">${org}</div>
          <div class="stat-label">Organization</div>
        </div>
      </div>

      <!-- Two column: activity + device status -->
      <div class="home-two-col">

        <div class="card">
          <div class="card-title">Recent Activity</div>
          <div class="activity-feed" id="home-activity">
            <div style="color:var(--text-m);font-size:12px">Loading…</div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">Device Status</div>
          <div id="home-devices" style="display:flex;flex-direction:column;gap:10px">
            <div style="color:var(--text-m);font-size:12px">Loading…</div>
          </div>
        </div>

      </div>
    </div>`;

  // Org-scoped stats — users in this org
  const unsub1 = orgQuery('users').onSnapshot(snap => {
    const devEl = document.getElementById('hs-devices');
    if (devEl) devEl.textContent = snap.size;

    // Active in 7 days
    const cutoff = new Date(Date.now() - 7 * 864e5);
    let active = 0;
    snap.forEach(d => {
      const ls = d.data().last_seen?.toDate?.();
      if (ls && ls > cutoff) active++;
    });
    const actEl = document.getElementById('hs-active');
    if (actEl) actEl.textContent = active;

    // Device status list
    const devListEl = document.getElementById('home-devices');
    if (!devListEl) return;
    if (snap.empty) { devListEl.innerHTML = '<div style="color:var(--text-m);font-size:12px">No devices registered.</div>'; return; }

    devListEl.innerHTML = snap.docs.slice(0, 8).map(doc => {
      const d    = doc.data();
      const ls   = d.last_seen?.toDate?.();
      const mins = ls ? Math.round((Date.now() - ls) / 60000) : null;
      const online = mins !== null && mins < 30;
      const timeStr = ls ? (mins < 60 ? `${mins}m ago` : ls.toLocaleDateString()) : '—';
      return `
        <div style="display:flex;align-items:center;gap:10px">
          <div class="online-dot ${online ? 'on' : 'off'}"></div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--text-p);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.account_name || doc.id}</div>
            <div style="font-size:11px;color:var(--text-s)">${d.device_brand || ''} ${d.device_model || ''}</div>
          </div>
          <div style="font-size:11px;color:var(--text-m);white-space:nowrap">${timeStr}</div>
        </div>`;
    }).join('');
  }, e => console.error('[home] users', e));

  registerUnsub(unsub1);

  // Ping count (global — pings don't have org_id in current schema)
  db.collection('pings').get().then(snap => {
    const el = document.getElementById('hs-pings');
    if (el) el.textContent = snap.size;
  }).catch(e => console.error('[home] pings count', e));

  // Recent activity feed — org-scoped pings
  const unsub2 = db.collection('pings')
    .orderBy('timestamp', 'desc').limit(8)
    .onSnapshot(snap => {
      const el = document.getElementById('home-activity');
      if (!el) return;
      if (snap.empty) { el.innerHTML = '<div style="color:var(--text-m);font-size:12px">No activity yet.</div>'; return; }

      // Filter to current org
      const orgDocs = snap.docs.filter(d => !currentUser?.org || d.data().org_id === currentUser.org);
      if (orgDocs.length === 0) { el.innerHTML = '<div style="color:var(--text-m);font-size:12px">No activity for this org.</div>'; return; }

      el.innerHTML = orgDocs.map(d => {
        const data = d.data();
        const ts   = data.timestamp?.toDate?.();
        const time = ts ? (Date.now() - ts < 3600000 ? Math.round((Date.now() - ts) / 60000) + 'm ago' : ts.toLocaleString()) : '—';
        return `
          <div class="activity-row">
            <div class="activity-dot"></div>
            <div class="activity-name">${data.account_name || '?'}</div>
            <div style="font-size:11px;color:var(--text-s);white-space:nowrap">${data.device_model || ''}</div>
            <div class="activity-time">${time}</div>
          </div>`;
      }).join('');
    }, e => console.error('[home] activity', e));

  registerUnsub(unsub2);
}
