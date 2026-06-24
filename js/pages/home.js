// js/pages/home.js
// Stats pulled from:
//   orgs/{org}/accounts/          — registered devices/accounts
//   orgs/{org}/accounts/{a}/students/ — enrolled students
//   pings/                        — app launches (org-filtered)
//   users/                        — last-seen (for device status)

function home(container) {
  const org  = currentUser?.org  || '—';
  const name = currentUser?.name || '—';

  container.innerHTML = `
    <div class="page">
      <div class="home-hero">
        <div class="home-eyebrow">Facial Recognition Attendance — ${org}</div>
        <div class="home-title">Good to see you,<br>${name}.</div>
        <div class="home-desc">Real-time oversight of attendance sessions, device health, and audit logs for your organization.</div>
        <div class="home-pills">
          <span class="home-pill active" id="hp-live">● Live</span>
          <span class="home-pill" id="hp-org">${org}</span>
          <span class="home-pill" id="hp-role">${currentUser?.role || '—'}</span>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card blue">
          <div class="stat-icon">👨‍🏫</div>
          <div class="stat-value" id="hs-accounts">—</div>
          <div class="stat-label">Registered Accounts</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">🎓</div>
          <div class="stat-value" id="hs-students">—</div>
          <div class="stat-label">Enrolled Students</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-icon">📅</div>
          <div class="stat-value" id="hs-pings">—</div>
          <div class="stat-label">Total App Launches</div>
        </div>
        <div class="stat-card violet">
          <div class="stat-icon">✅</div>
          <div class="stat-value" id="hs-active">—</div>
          <div class="stat-label">Active (30 min)</div>
        </div>
      </div>

      <div class="home-two-col">
        <div class="card">
          <div class="card-title">Recent App Launches</div>
          <div class="activity-feed" id="home-activity">
            <div style="color:var(--text-m);font-size:12px">Loading…</div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">Account Status</div>
          <div id="home-devices" style="display:flex;flex-direction:column;gap:10px">
            <div style="color:var(--text-m);font-size:12px">Loading…</div>
          </div>
        </div>
      </div>
    </div>`;

  const cutoff30 = new Date(Date.now() - 30 * 60000);

  // Accounts under this org
  const unsubAccounts = db.collection('orgs').doc(org)
    .collection('accounts')
    .onSnapshot(snap => {
      const el = document.getElementById('hs-accounts');
      if (el) el.textContent = snap.size;

      let active = 0;
      snap.forEach(d => {
        const ls = d.data().last_seen?.toDate?.();
        if (ls && ls > cutoff30) active++;
      });
      const actEl = document.getElementById('hs-active');
      if (actEl) actEl.textContent = active;

      // Device status list
      const devListEl = document.getElementById('home-devices');
      if (!devListEl) return;
      if (snap.empty) {
        devListEl.innerHTML = '<div style="color:var(--text-m);font-size:12px">No accounts registered.</div>';
        return;
      }
      devListEl.innerHTML = snap.docs.slice(0, 8).map(doc => {
        const d    = doc.data();
        const ls   = d.last_seen?.toDate?.();
        const mins = ls ? Math.round((Date.now() - ls) / 60000) : null;
        const online  = mins !== null && mins < 30;
        const timeStr = ls
          ? (mins < 60 ? `${mins}m ago` : ls.toLocaleDateString())
          : '—';
        return `
          <div style="display:flex;align-items:center;gap:10px">
            <div class="online-dot ${online ? 'on' : 'off'}"></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--text-p);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${doc.id}</div>
              <div style="font-size:11px;color:var(--text-s)">${d.device_brand || ''} ${d.device_model || ''} · ${d.role || d.account_role || '—'}</div>
            </div>
            <div style="font-size:11px;color:var(--text-m);white-space:nowrap">${timeStr}</div>
          </div>`;
      }).join('');

      // Count students across all accounts
      let totalStudents = 0;
      let pending = snap.size;
      if (pending === 0) {
        const sEl = document.getElementById('hs-students');
        if (sEl) sEl.textContent = 0;
        return;
      }
      snap.docs.forEach(acctDoc => {
        db.collection('orgs').doc(org)
          .collection('accounts').doc(acctDoc.id)
          .collection('students')
          .get()
          .then(s => {
            totalStudents += s.size;
            pending--;
            if (pending === 0) {
              const sEl = document.getElementById('hs-students');
              if (sEl) sEl.textContent = totalStudents;
            }
          })
          .catch(() => { pending--; });
      });
    }, e => console.error('[home] accounts', e));

  registerUnsub(unsubAccounts);

  // Ping count
  db.collection('pings').where('org_id', '==', org).get()
    .then(snap => {
      const el = document.getElementById('hs-pings');
      if (el) el.textContent = snap.size;
    })
    .catch(e => console.error('[home] pings', e));

  // Recent activity feed from pings
  const unsubPings = db.collection('pings')
    .where('org_id', '==', org)
    .orderBy('timestamp', 'desc').limit(8)
    .onSnapshot(snap => {
      const el = document.getElementById('home-activity');
      if (!el) return;
      if (snap.empty) {
        el.innerHTML = '<div style="color:var(--text-m);font-size:12px">No activity yet.</div>';
        return;
      }
      el.innerHTML = snap.docs.map(d => {
        const data = d.data();
        const ts   = data.timestamp?.toDate?.();
        const time = ts
          ? (Date.now() - ts < 3600000
              ? Math.round((Date.now() - ts) / 60000) + 'm ago'
              : ts.toLocaleString())
          : '—';
        return `
          <div class="activity-row">
            <div class="activity-dot"></div>
            <div class="activity-name">${data.account_name || '?'}</div>
            <div style="font-size:11px;color:var(--text-s);white-space:nowrap">${data.device_model || ''}</div>
            <div class="activity-time">${time}</div>
          </div>`;
      }).join('');
    }, e => console.error('[home] pings feed', e));

  registerUnsub(unsubPings);
}
