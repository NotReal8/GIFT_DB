// js/pages/attendance.js
// Reads from: orgs/{org}/accounts/{account}/attendance_flat/{doc}
// Schema: { account, date, session, student_name, roll_no, status, group_name, synced_at }

function attendance(container) {
  if (!currentUser?.org) {
    container.innerHTML = '<div class="page"><p style="color:var(--text-s)">Not signed in to an org.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><div class="page-title">Attendance Records</div>
          <div class="page-sub">Live from <strong style="color:var(--text-p)">${currentUser.org}</strong> · all accounts</div></div>
      </div>
      <div class="att-controls">
        <select id="att-account-sel" onchange="attApplyFilter()"><option value="">All Accounts</option></select>
        <select id="att-date-sel"    onchange="attApplyFilter()"><option value="">All Dates</option></select>
        <select id="att-session-sel" onchange="attApplyFilter()"><option value="">All Sessions</option></select>
        <select id="att-group-sel"   onchange="attApplyFilter()"><option value="">All Groups</option></select>
        <input  id="att-search"      placeholder="Search student…" oninput="attApplyFilter()" />
        <span style="font-family:var(--mono);font-size:11px;color:var(--text-s)" id="att-count"></span>
      </div>
      <div class="stat-grid" style="margin-bottom:16px">
        <div class="stat-card green"><div class="stat-value" id="att-present">—</div><div class="stat-label">Present</div></div>
        <div class="stat-card"><div class="stat-value" id="att-absent">—</div><div class="stat-label">Absent</div></div>
        <div class="stat-card blue"><div class="stat-value" id="att-rate">—</div><div class="stat-label">Rate</div></div>
        <div class="stat-card amber"><div class="stat-value" id="att-total">—</div><div class="stat-label">Total Records</div></div>
      </div>
      <div class="att-table-wrap">
        <table>
          <thead><tr>
            <th>Student</th><th>Roll No</th><th>Date</th><th>Session</th><th>Group</th><th>Account</th><th>Status</th>
          </tr></thead>
          <tbody id="att-body"><tr><td colspan="7" style="color:var(--text-s);text-align:center;padding:32px">Loading…</td></tr></tbody>
        </table>
      </div>
    </div>`;

  window._attAllRows = [];
  window._attUnsubs = window._attUnsubs || [];
  window._attUnsubs.forEach(u => { try { u(); } catch(_) {} });
  window._attUnsubs = [];

  // Listen to all accounts, then fan out to their attendance_flat subcollections
  const unsubAccounts = db.collection('orgs').doc(currentUser.org)
    .collection('accounts')
    .onSnapshot(snap => {
      const accountSel = document.getElementById('att-account-sel');
      if (!accountSel) return;
      const prevAccount = accountSel.value;
      const accountNames = snap.docs.map(d => d.id);
      accountSel.innerHTML = '<option value="">All Accounts</option>' +
        accountNames.map(n => `<option value="${n}">${n}</option>`).join('');
      accountSel.value = prevAccount;

      // Cancel old per-account listeners
      window._attUnsubs.forEach(u => { try { u(); } catch(_) {} });
      window._attUnsubs = [];

      const rowsByAccount = {};

      snap.docs.forEach(acctDoc => {
        const acctName = acctDoc.id;
        rowsByAccount[acctName] = [];

        const unsub = db.collection('orgs').doc(currentUser.org)
          .collection('accounts').doc(acctName)
          .collection('attendance_flat')
          .onSnapshot(flatSnap => {
            rowsByAccount[acctName] = flatSnap.docs.map(d => {
              const f = d.data();
              return {
                account:     acctName,
                date:        f.date        || '—',
                session:     f.session     || '—',
                studentName: f.student_name || '—',
                rollNo:      f.roll_no     || '—',
                status:      f.status      || '—',
                groupName:   f.group_name  || '—',
              };
            });

            const all = Object.values(rowsByAccount).flat();
            all.sort((a, b) => b.date.localeCompare(a.date) || a.studentName.localeCompare(b.studentName));
            window._attAllRows = all;

            const countEl = document.getElementById('att-count');
            if (countEl) countEl.textContent = all.length + ' records';

            _attPopulateFilters(all);
            attApplyFilter();
          }, e => console.error('[attendance] attendance_flat error for', acctName, e));

        window._attUnsubs.push(unsub);
        registerUnsub(unsub);
      });
    }, e => console.error('[attendance] accounts error', e));

  registerUnsub(unsubAccounts);
}

function _attPopulateFilters(rows) {
  const dates    = [...new Set(rows.map(r => r.date))].sort().reverse();
  const sessions = [...new Set(rows.map(r => r.session))].sort();
  const groups   = [...new Set(rows.map(r => r.groupName))].sort();

  const dateSel    = document.getElementById('att-date-sel');
  const sessionSel = document.getElementById('att-session-sel');
  const groupSel   = document.getElementById('att-group-sel');
  if (!dateSel) return;

  const prevDate    = dateSel.value;
  const prevSession = sessionSel.value;
  const prevGroup   = groupSel.value;

  dateSel.innerHTML    = '<option value="">All Dates</option>'    + dates.map(d => `<option value="${d}">${d}</option>`).join('');
  sessionSel.innerHTML = '<option value="">All Sessions</option>' + sessions.map(s => `<option value="${s}">${s}</option>`).join('');
  groupSel.innerHTML   = '<option value="">All Groups</option>'   + groups.map(g => `<option value="${g}">${g}</option>`).join('');

  dateSel.value    = prevDate;
  sessionSel.value = prevSession;
  groupSel.value   = prevGroup;
}

function attApplyFilter() {
  const rows    = window._attAllRows || [];
  const account = document.getElementById('att-account-sel')?.value || '';
  const date    = document.getElementById('att-date-sel')?.value    || '';
  const session = document.getElementById('att-session-sel')?.value || '';
  const group   = document.getElementById('att-group-sel')?.value   || '';
  const search  = (document.getElementById('att-search')?.value     || '').toLowerCase();

  const filtered = rows.filter(r =>
    (!account || r.account    === account) &&
    (!date    || r.date       === date)    &&
    (!session || r.session    === session) &&
    (!group   || r.groupName  === group)   &&
    (!search  || r.studentName.toLowerCase().includes(search))
  );

  const present = filtered.filter(r => r.status === 'present').length;
  const absent  = filtered.filter(r => r.status === 'absent').length;
  const total   = filtered.length;
  const rate    = total ? Math.round(present / total * 100) + '%' : '—';

  const setEl = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  setEl('att-present', present);
  setEl('att-absent',  absent);
  setEl('att-rate',    rate);
  setEl('att-total',   total);

  const body = document.getElementById('att-body');
  if (!body) return;

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="7" style="color:var(--text-s);text-align:center;padding:32px">No records found.</td></tr>';
    return;
  }

  body.innerHTML = filtered.slice(0, 500).map(r => `
    <tr>
      <td>${r.studentName}</td>
      <td style="font-family:var(--mono);font-size:11px">${r.rollNo}</td>
      <td>${r.date}</td>
      <td style="font-size:12px">${r.session}</td>
      <td>${r.groupName}</td>
      <td style="font-size:12px;color:var(--text-s)">${r.account}</td>
      <td><span class="badge ${r.status}">${r.status}</span></td>
    </tr>`).join('');

  if (filtered.length > 500) {
    body.innerHTML += `<tr><td colspan="7" style="color:var(--text-s);text-align:center;padding:10px;font-family:var(--mono);font-size:11px">Showing 500 of ${filtered.length}</td></tr>`;
  }
}
