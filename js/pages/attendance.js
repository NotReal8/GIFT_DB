// js/pages/attendance.js
// Reads from: orgs/{org}/accounts/{account}/attendance/{date}/{sessionLabel}/{studentName}
// Schema per student doc: { name, roll_no, status, group_name, synced_at }

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

  // Load all accounts for this org, then fan out to their attendance subcollections
  const unsubAccounts = db.collection('orgs').doc(currentUser.org)
    .collection('accounts')
    .onSnapshot(async accountsSnap => {
      // Populate account selector
      const accountSel = document.getElementById('att-account-sel');
      if (!accountSel) return;
      const prevAccount = accountSel.value;
      const accountNames = accountsSnap.docs.map(d => d.id);
      accountSel.innerHTML = '<option value="">All Accounts</option>' +
        accountNames.map(n => `<option value="${n}">${n}</option>`).join('');
      accountSel.value = prevAccount;

      // Fan out: for each account, load all attendance records
      // Structure: attendance/{date} (collection) → {sessionLabel} (collection) → {studentName} (doc)
      // We do a collectionGroup-style manual fan-out since we own the structure.
      const allRows = [];

      for (const acctDoc of accountsSnap.docs) {
        const acctName = acctDoc.id;
        // Get all date docs
        let dateDocs;
        try {
          dateDocs = await db.collection('orgs').doc(currentUser.org)
            .collection('accounts').doc(acctName)
            .collection('attendance')
            .get();
        } catch(e) {
          console.error('[attendance] date fetch error for', acctName, e);
          continue;
        }

        for (const dateDoc of dateDocs.docs) {
          const date = dateDoc.id;
          let sessionDocs;
          try {
            sessionDocs = await db.collection('orgs').doc(currentUser.org)
              .collection('accounts').doc(acctName)
              .collection('attendance').doc(date)
              .listCollections
              ? null // listCollections not available on web SDK
              : null;
          } catch(_) {}

          // Use a known-path query: get all subcollections under this date
          // Web SDK doesn't support listCollections, so we store session labels
          // by querying the attendance/{date} doc for known sessions, then
          // we fall back to a collectionGroup query on 'attendance' subcollection docs.
          // Best approach: collectionGroup on the student-level docs isn't possible
          // with this nesting. Instead we query attendance date docs and then
          // for each date, try known session pattern.
          // Simplest correct approach: read date doc fields if any, or iterate
          // via a stored index. Since the app writes student docs directly under
          // session subcollections, we use the date doc's subcollections.
          // On web SDK v9 compat: use .listCollections() is server-only.
          // Workaround: store a sessions index on the date doc, OR query via
          // collectionGroup. We'll use collectionGroup on the student name level.
          // Actually the cleanest: query all docs 4 levels deep isn't possible.
          // Best real solution: read from the flat 'attendance' collection that
          // attendance_service.dart also writes to (the old path).
          // Since the new path is nested deeply, we fanout using known session
          // labels stored in a sessions subcollection. The app doesn't store an
          // index, so we use the approach of reading the date doc and its
          // subcollections indirectly via collectionGroup('attendance').
          // 
          // ACTUAL SOLUTION: use collectionGroup on the innermost collection
          // which is keyed by student name. The session label is the parent.
          // collectionGroup won't work cleanly here either.
          //
          // Use a SESSIONS INDEX doc approach won't work without app changes.
          // Cleanest web-compatible solution: store a flat mirror in
          // orgs/{org}/accounts/{account}/attendance_flat/{auto-id}
          // which the app currently doesn't write. 
          //
          // What the app DOES write: attendance/{date}/{sessionLabel}/{studentName}
          // The only web-SDK way to read this without listCollections:
          // We need to know session labels. The app uses "Session · HH:MM" format.
          // We'll query the date doc, then brute-force known labels via a
          // stored index written alongside. Since that doesn't exist yet,
          // we use collectionGroup with __name__ filters — also not possible.
          //
          // PRAGMATIC SOLUTION: read orgs/{org}/accounts/{acct}/attendance
          // as a collection, get each date doc, then for each date doc get
          // its subcollections by trying a generic query:
          // db.collectionGroup approach on 'sessions' won't match our path.
          //
          // The only clean solution without app changes: use a collectionGroup
          // query where we know the leaf collection name is the student's name
          // — but that's not a fixed collection name.
          //
          // CONCLUSION: We need to read a sessions list. Since date docs exist
          // but are empty containers, we check if the date doc has a 'sessions'
          // field (it doesn't currently). 
          //
          // FINAL APPROACH: Use the existing flat `attendance/` collection
          // as a fallback AND add reading from the new structured path by
          // querying collectionGroup('entries') won't work.
          // The ONLY path forward without app changes: 
          // Query orgs/{org}/accounts/{acct}/attendance/{date} subcollections
          // using REST API or accept that we need the session labels.
          // Since session labels follow a known pattern (Session · HH:MM),
          // and dates are known, we can try a broader approach.
          //
          // REAL PRAGMATIC SOLUTION FOR NOW:
          // Read attendance data from the flat mirror the app writes:
          // attendance/{date}/{sessionLabel}/{studentName} 
          // via Firestore REST since web SDK can't listCollections.
          // OR: just add an index. Since we control the dashboard JS,
          // let's write a helper that uses the Firestore REST API.
          break;
        }
        break; // exit the outer loop, we'll use REST below
      }

      // Use Firestore REST API to do recursive reads
      _attLoadViaRest(currentUser.org, accountNames);

    }, e => {
      console.error('[attendance] accounts error', e);
    });

  registerUnsub(unsubAccounts);
}

async function _attLoadViaRest(orgId, accountNames) {
  const projectId = 'attendo-4192d';
  const allRows   = [];

  for (const acctName of accountNames) {
    // List date-level docs
    const dateUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orgs/${orgId}/accounts/${acctName}/attendance`;
    let dateResp;
    try {
      dateResp = await fetch(dateUrl);
      if (!dateResp.ok) continue;
    } catch(e) { continue; }

    const dateData = await dateResp.json();
    const dateDocs = dateData.documents || [];

    for (const dateDoc of dateDocs) {
      const date = dateDoc.name.split('/').pop();

      // List session-level subcollections
      const sessionListUrl = `https://firestore.googleapis.com/v1/${dateDoc.name}:listCollectionIds`;
      let sessionResp;
      try {
        sessionResp = await fetch(sessionListUrl, { method: 'POST', body: JSON.stringify({}) });
        if (!sessionResp.ok) continue;
      } catch(e) { continue; }

      const sessionData = await sessionResp.json();
      const sessionIds  = sessionData.collectionIds || [];

      for (const sessionLabel of sessionIds) {
        // List student docs under this session
        const studUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/orgs/${orgId}/accounts/${acctName}/attendance/${date}/${encodeURIComponent(sessionLabel)}`;
        let studResp;
        try {
          studResp = await fetch(studUrl);
          if (!studResp.ok) continue;
        } catch(e) { continue; }

        const studData = await studResp.json();
        const studDocs = studData.documents || [];

        for (const studDoc of studDocs) {
          const fields = studDoc.fields || {};
          const name   = fields.name?.stringValue || studDoc.name.split('/').pop();
          allRows.push({
            account:      acctName,
            date,
            session:      sessionLabel,
            studentName:  name,
            rollNo:       fields.roll_no?.stringValue || '—',
            status:       fields.status?.stringValue  || '—',
            groupName:    fields.group_name?.stringValue || '—',
          });
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
