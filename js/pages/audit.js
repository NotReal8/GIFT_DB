// js/pages/audit.js
// Reads logs from: orgs/{org}/accounts/{account}/logs/{date}/entries/{auto-id}
// Fallback to old path: logs/{deviceId}/sessions/{auto-id}

const AUDIT_SHOW_KEYWORDS = [
  'MATCH','enrolled','ERROR','❌','✅','session','FAIL','present','absent',
  'KILL','kill','RESET','START','STOP','initialized','ready','ping','Attendance'
];

function _shouldShow(line) {
  return AUDIT_SHOW_KEYWORDS.some(k => line.includes(k));
}

function _lineClass(line) {
  if (line.includes('❌') || line.includes('ERROR') || line.includes('FAIL') || line.includes('💥')) return 'err';
  if (line.includes('✅') || line.includes('MATCH') || line.includes('present')) return 'ok';
  if (line.includes('⚠️') || line.includes('KILL') || line.includes('warn')) return 'warn';
  if (line.includes('[Beacon]') || line.includes('[Firebase]') || line.includes('[Attendance]')) return 'info';
  return 'normal';
}

function _appendLine(logEl, text, raw) {
  if (!raw && !_shouldShow(text)) return;
  const d = document.createElement('div');
  d.className = 'log-line ' + _lineClass(text);
  d.textContent = text;
  logEl.appendChild(d);
  logEl.scrollTop = logEl.scrollHeight;
}

function audit(container) {
  if (!currentUser?.org) {
    container.innerHTML = '<div class="page"><p style="color:var(--text-s)">Not signed in to an org.</p></div>';
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><div class="page-title">Audit Analytics</div>
          <div class="page-sub">Real-time logs per account · <strong style="color:var(--text-p)">${currentUser.org}</strong></div></div>
      </div>
      <div class="audit-filter-bar">
        <input id="audit-search" placeholder="Filter by account…" oninput="auditFilter()" />
        <span style="font-family:var(--mono);font-size:11px;color:var(--text-s)" id="audit-count">Loading…</span>
      </div>
      <div id="audit-grid" class="audit-grid">
        <div class="audit-loading">Connecting to Firestore…</div>
      </div>
    </div>`;

  const boxes = {};
  window._auditBoxes = boxes;

  const today = new Date().toISOString().substring(0, 10);

  function getOrCreateBox(acctName) {
    if (boxes[acctName]) return boxes[acctName];

    const box = document.createElement('div');
    box.className = 'audit-box';
    box.dataset.name = acctName.toLowerCase();
    box.innerHTML = `
      <div class="audit-box-header">
        <div class="audit-dot" id="dot-${CSS.escape(acctName)}"></div>
        <div class="audit-box-name">${acctName}</div>
        <div class="audit-box-meta" id="meta-${CSS.escape(acctName)}"></div>
        <button class="audit-raw-toggle" id="raw-${CSS.escape(acctName)}" onclick="auditToggleRaw('${acctName}')">raw</button>
      </div>
      <div class="audit-log" id="log-${CSS.escape(acctName)}"></div>`;

    const grid = document.getElementById('audit-grid');
    const placeholder = grid.querySelector('.audit-loading');
    if (placeholder) placeholder.remove();

    grid.appendChild(box);
    boxes[acctName] = { box, logEl: box.querySelector('.audit-log'), rawMode: false, lines: [] };
    return boxes[acctName];
  }

  // Listen to all accounts in org
  const unsubAccounts = db.collection('orgs').doc(currentUser.org)
    .collection('accounts')
    .onSnapshot(snap => {
      const countEl = document.getElementById('audit-count');
      if (countEl) countEl.textContent = snap.size + ' account(s)';

      snap.forEach(acctDoc => {
        const acctName = acctDoc.id;
        const data     = acctDoc.data();
        const entry    = getOrCreateBox(acctName);

        // Update last-seen meta
        const metaEl = document.getElementById('meta-' + CSS.escape(acctName));
        if (metaEl && data.last_seen) {
          const d = data.last_seen.toDate?.();
          if (d) metaEl.textContent = d.toLocaleTimeString();
        }

        if (entry.unsub) return; // already listening

        // Listen to today's log entries for this account
        const unsub = db.collection('orgs').doc(currentUser.org)
          .collection('accounts').doc(acctName)
          .collection('logs').doc(today)
          .collection('entries')
          .orderBy('flushed_at', 'desc').limit(10)
          .onSnapshot(entriesSnap => {
            const logEl = document.getElementById('log-' + CSS.escape(acctName));
            if (!logEl) return;

            const allLines = [];
            entriesSnap.docs.slice().reverse().forEach(e => {
              const lines = e.data().lines || [];
              allLines.push(...lines);
            });

            entry.lines = allLines;
            logEl.innerHTML = '';
            if (allLines.length === 0) {
              logEl.innerHTML = '<div class="audit-empty">No logs today.</div>';
            } else {
              allLines.slice(-200).forEach(line => _appendLine(logEl, line, entry.rawMode));
              logEl.scrollTop = logEl.scrollHeight;
            }

            const dot = document.getElementById('dot-' + CSS.escape(acctName));
            if (dot) { dot.style.background = 'var(--present)'; dot.classList.remove('offline'); }
          }, err => {
            console.error('[audit] log listener', acctName, err);
            // Try old path fallback
            _auditFallbackOldPath(acctName, entry);
          });

        entry.unsub = unsub;
        registerUnsub(unsub);
      });
    }, e => {
      console.error('[audit] accounts listener', e);
      const grid = document.getElementById('audit-grid');
      if (grid) grid.innerHTML = '<div class="audit-loading" style="color:var(--absent)">Failed: ' + e.message + '</div>';
    });

  registerUnsub(unsubAccounts);
}

function _auditFallbackOldPath(deviceId, entry) {
  const unsub = db.collection('logs').doc(deviceId).collection('sessions')
    .orderBy('flushed_at', 'desc').limit(8)
    .onSnapshot(snap => {
      const logEl = document.getElementById('log-' + CSS.escape(deviceId));
      if (!logEl) return;
      const allLines = [];
      snap.docs.slice().reverse().forEach(s => {
        allLines.push(...(s.data().lines || []));
      });
      entry.lines = allLines;
      logEl.innerHTML = '';
      if (!allLines.length) {
        logEl.innerHTML = '<div class="audit-empty">No logs yet.</div>';
      } else {
        allLines.slice(-200).forEach(line => _appendLine(logEl, line, entry.rawMode));
        logEl.scrollTop = logEl.scrollHeight;
      }
    }, () => {});
  registerUnsub(unsub);
}

function auditToggleRaw(acctName) {
  const boxes = window._auditBoxes;
  if (!boxes || !boxes[acctName]) return;
  const entry   = boxes[acctName];
  entry.rawMode = !entry.rawMode;
  const btn = document.getElementById('raw-' + CSS.escape(acctName));
  if (btn) btn.classList.toggle('active', entry.rawMode);
  const logEl = document.getElementById('log-' + CSS.escape(acctName));
  if (!logEl || !entry.lines) return;
  logEl.innerHTML = '';
  entry.lines.slice(-200).forEach(line => _appendLine(logEl, line, entry.rawMode));
}

function auditFilter() {
  const q = document.getElementById('audit-search').value.toLowerCase();
  document.querySelectorAll('.audit-box').forEach(box => {
    box.style.display = (!q || box.dataset.name.includes(q)) ? '' : 'none';
  });
}
