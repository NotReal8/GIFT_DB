// js/pages/student-roster.js
// Reads from: orgs/{org}/accounts/{account}/students/{name}
// Schema: { name, roll_no, sample_count, registered_at, embedding (b64), synced_at }

function studentRoster(container) {
  if (!currentUser?.org) {
    container.innerHTML = '<div class="page"><p style="color:var(--text-s)">Not signed in to an org.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div>
          <div class="page-title">Student Roster</div>
          <div class="page-sub">Students registered under <strong style="color:var(--text-p)">${currentUser.org}</strong></div>
        </div>
        <span id="sr-count" class="audit-count-badge">Loading…</span>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <select id="sr-account-sel" onchange="srFilter()" style="width:auto;min-width:180px">
          <option value="">All Accounts</option>
        </select>
        <input id="sr-search" placeholder="Search student…" oninput="srFilter()" style="max-width:260px" />
      </div>
      <div id="sr-grid" class="roster-grid">
        <div style="font-size:13px;color:var(--text-s)">Loading…</div>
      </div>
    </div>`;

  window._srAllStudents = [];

  // Listen to all accounts, then fan-out to their students subcollection
  const unsubAccounts = db.collection('orgs').doc(currentUser.org)
    .collection('accounts')
    .onSnapshot(snap => {
      const accountSel = document.getElementById('sr-account-sel');
      if (!accountSel) return;
      const prev = accountSel.value;
      const names = snap.docs.map(d => d.id);
      accountSel.innerHTML = '<option value="">All Accounts</option>' +
        names.map(n => `<option value="${n}">${n}</option>`).join('');
      accountSel.value = prev;

      // Clear existing student listeners before re-attaching
      if (window._srStudentUnsubs) {
        window._srStudentUnsubs.forEach(u => { try { u(); } catch(_) {} });
      }
      window._srStudentUnsubs = [];

      // Per-account student listener
      const studentsByAccount = {};

      snap.docs.forEach(acctDoc => {
        const acctName = acctDoc.id;
        studentsByAccount[acctName] = [];

        const unsub = db.collection('orgs').doc(currentUser.org)
          .collection('accounts').doc(acctName)
          .collection('students')
          .orderBy('name')
          .onSnapshot(studSnap => {
            studentsByAccount[acctName] = studSnap.docs.map(d => ({
              ...d.data(),
              _account: acctName,
            }));
            // Flatten all accounts into one list
            const all = Object.values(studentsByAccount).flat();
            all.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            window._srAllStudents = all;
            const countEl = document.getElementById('sr-count');
            if (countEl) countEl.textContent = all.length + ' student(s)';
            srFilter();
          }, e => {
            console.error('[student-roster] students error for', acctName, e);
          });

        window._srStudentUnsubs.push(unsub);
        registerUnsub(unsub);
      });
    }, e => {
      console.error('[student-roster] accounts error', e);
      const grid = document.getElementById('sr-grid');
      if (grid) grid.innerHTML = `<div style="color:var(--red);font-size:13px">Error: ${e.message}</div>`;
    });

  registerUnsub(unsubAccounts);
}

function srFilter() {
  const q    = (document.getElementById('sr-search')?.value || '').toLowerCase();
  const acct = document.getElementById('sr-account-sel')?.value || '';
  const all  = window._srAllStudents || [];
  const filtered = all.filter(s =>
    (!acct || s._account === acct) &&
    (!q    || (s.name || '').toLowerCase().includes(q))
  );
  srRender(filtered);
}

function srRender(students) {
  const grid = document.getElementById('sr-grid');
  if (!grid) return;
  if (!students.length) {
    grid.innerHTML = '<div style="font-size:13px;color:var(--text-s)">No students found.</div>';
    return;
  }
  grid.innerHTML = students.map(s => {
    const init = (s.name || '?').charAt(0).toUpperCase();
    const reg  = s.registered_at
      ? new Date(s.registered_at).toLocaleDateString()
      : '—';
    return `
      <div class="roster-card online">
        <div class="roster-avatar" style="background:var(--green-dim);border-color:var(--green-border);color:var(--green)">${init}</div>
        <div class="roster-info">
          <div class="roster-name">${s.name || '—'}</div>
          <div class="roster-meta">Roll: ${s.roll_no || '—'} · ${s.sample_count || 1} sample(s)</div>
          <div class="roster-meta">Registered ${reg}</div>
          <div class="roster-meta" style="font-size:10px;color:var(--text-m)">${s._account}</div>
        </div>
      </div>`;
  }).join('');
}
