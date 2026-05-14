// js/pages/student-roster.js
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
      <div style="margin-bottom:16px">
        <input id="sr-search" placeholder="Search student…" oninput="srFilter()" style="max-width:300px" />
      </div>
      <div id="sr-grid" class="roster-grid">
        <div style="font-size:13px;color:var(--text-s)">Loading…</div>
      </div>
    </div>`;

  const unsub = db.collection('orgs').doc(currentUser.org)
    .collection('students')
    .orderBy('name')
    .onSnapshot(snap => {
      window._srStudents = snap.docs.map(d => d.data());
      document.getElementById('sr-count').textContent = snap.size + ' student(s)';
      srRender(window._srStudents);
    }, e => {
      console.error('[student-roster]', e);
      document.getElementById('sr-grid').innerHTML =
        `<div style="color:var(--red);font-size:13px">Error: ${e.message}</div>`;
    });

  registerUnsub(unsub);
}

function srFilter() {
  const q = document.getElementById('sr-search')?.value.toLowerCase() || '';
  const all = window._srStudents || [];
  srRender(q ? all.filter(s => s.name?.toLowerCase().includes(q)) : all);
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
          <div class="roster-meta">Registered ${reg}</div>
          <div class="roster-meta">${s.sample_count || 1} sample(s)</div>
        </div>
      </div>`;
  }).join('');
}
