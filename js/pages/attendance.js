// js/pages/attendance.js
// Path: orgs/{org}/accounts/{account}/attendance/{date}/{sessionLabel}/{studentName}
// Student doc fields: name, roll_no, status, group_name, synced_at

function attendance(container) {
  if (!currentUser?.org) {
    container.innerHTML = '<div class="page"><p style="color:var(--text-s)">Not signed in to an org.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><div class="page-title">Attendance Records</div>
          <div class="page-sub">All accounts under <strong style="color:var(--text-p)">${currentUser.org}</strong></div></div>
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

  // Step 1: get all accounts
  db.collection('orgs').doc(currentUser.org)
    .collection('accounts')
    .get()
    .then(accountsSnap => {
      const accountNames = accountsSnap.docs.map(d => d.id);

      // Populate account filter
      const accountSel = document.getElementById('att-account-sel');
      if (accountSel) {
        accountSel.innerHTML = '<option value="">All Accounts</option>' +
          accountNames.map(n => `<option value="${n}">${n}</option>`).join('');
      }

      _attLoadAll(currentUser.org, accountNames);
    })
    .catch(e => console.error('[attendance] accounts fetch error', e));
}

async function _attLoadAll(orgId, accountNames) {
  const projectId = firebaseConfig.projectId;
  const allRows   = [];

  for (const acctName of accountNames) {
    // Get date-level docs
    let dateDocs;
    try {
      const snap = await db.collection('orgs').doc(orgId)
        .collection('accounts').doc(acctName)
        .collection('attendance')
        .get();
      dateDocs = snap.docs;
    } catch(e) {
      console.error('[attendance] date fetch error', acctName, e);
      continue;
    }

    for (const dateDoc of dateDocs) {
      const date = dateDoc.id;

      // Use REST to list session subcollections under this date doc
      let sessionIds;
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orgs/${orgId}/accounts/${acctName}/attendance/${date}:listCollectionIds`;
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const data = await resp.json();
        sessionIds = data.collectionIds || [];
      } catch(e) {
        console.error('[attendance] listCollectionIds error', acctName, date, e);
        continue;
      }

      for (const sessionLabel of sessionIds) {
        // Get student docs under this session
        try {
          const snap = await db.collection('orgs').doc(orgId)
            .collection('accounts').doc(acctName)
            .collection('attendance').doc(date)
            .collection(sessionLabel)
            .get();

          snap.docs.forEach(studDoc => {
            const f = studDoc.data();
            allRows.push({
              account:     acctName,
              date,
              session:     sessionLabel,
              studentName: f.name || studDoc.id,
              rollNo:      f.roll_no    || '—',
              status:      f.status     || '—',
              groupName:   f.group_name || '—',
            });
          });
        } catch(e) {
          console.error('[attendance] student fetch error', acctName, date, sessionLabel, e);
        }
      }
    }
  }

  window._attAllRows = allRows;
  _attPopulateFilters(allRows);
  attApplyFilter();
}

function _attPopulateFilters(rows) {
  const dates    = [...new Set(rows.map(r => r.date))].sort().reverse();
  const sessions = [...new Set(rows.map(r => r.session))].sort();
  const groups   = [...new Set(rows.map(r => r.groupName).filter(g => g !== '—'))].sort();

  const dateSel    = document.getElementById('att-date-sel');
  const sessionSel = document.getElementById('att-session-sel');
  const groupSel   = document.getElementById('att-group-sel');
  if (!dateSel) return;

  dateSel.innerHTML    = '<option value="">All Dates</option>'    + dates.map(d => `<option value="${d}">${d}</option>`).join('');
  sessionSel.innerHTML = '<option value="">All Sessions</option>' + sessions.map(s => `<option value="${s}">${s}</option>`).join('');
  groupSel.innerHTML   = '<option value="">All Groups</option>'   + groups.map(g => `<option value="${g}">${g}</option>`).join('');
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
  setEl('att-count',   total + ' records');

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
