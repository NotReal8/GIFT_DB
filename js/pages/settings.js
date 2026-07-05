// js/pages/settings.js
// Export/Import of orgs/{org} data as a single .xlsx workbook.
// Sheets: Accounts, Students, Attendance, PendingAccounts. Logs are not exported.

function settings(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-header"><div class="page-title">Settings</div></div>

      <div class="card" style="margin-bottom:20px">
        <div class="card-title">Export Organization Data</div>
        <p style="font-size:13px;color:var(--text-s);margin-bottom:14px">
          Downloads a local .xlsx copy of every account, student, and attendance record under
          <strong style="color:var(--text-p)">${currentUser?.org || '—'}</strong>. Read-only — nothing in the database is changed.
        </p>
        <button class="btn-sm" id="set-export-btn" onclick="settingsExport()">Export as Excel</button>
        <div id="set-export-status" style="margin-top:10px;font-family:var(--mono);font-size:11px;color:var(--text-s)"></div>
      </div>

      <div class="card">
        <div class="card-title">Import Organization Data</div>
        <p style="font-size:13px;color:var(--text-s);margin-bottom:14px">
          Upload a previously exported .xlsx file to write it back into
          <strong style="color:var(--text-p)">${currentUser?.org || '—'}</strong>.
        </p>

        <input type="file" id="set-import-file" accept=".xlsx" style="margin-bottom:14px" />

        <div class="kill-label" style="margin-top:6px">Write Mode</div>
        <div style="display:flex;flex-direction:column;gap:10px;margin:10px 0 16px">
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--text-p)">
            <input type="radio" name="set-mode" value="merge" checked style="width:auto;margin-top:3px" />
            <span><strong>Merge</strong> — rows in the file are written on top of existing data.
            Nothing already in the database is deleted. (Coexistence.)</span>
          </label>
          <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--text-p)">
            <input type="radio" name="set-mode" value="replace" style="width:auto;margin-top:3px" />
            <span><strong>Replace</strong> — for every account/collection present in the file,
            existing database records for that account are deleted first, then replaced with only what's in the file.
            (Complete replacement.)</span>
          </label>
        </div>

        <button class="btn-sm" id="set-preview-btn" onclick="settingsPreviewImport()">Load &amp; Preview File</button>

        <div id="set-preview" class="hidden" style="margin-top:16px">
          <div class="kill-label">Preview</div>
          <div id="set-preview-body" style="font-size:13px;color:var(--text-p);margin-bottom:12px"></div>
          <label style="display:flex;gap:8px;align-items:center;font-size:13px;color:var(--text-p);margin-bottom:12px">
            <input type="checkbox" id="set-confirm-check" style="width:auto" />
            I understand this will modify the live database for <strong style="color:var(--text-p)">${currentUser?.org || '—'}</strong>.
          </label>
          <button class="btn-sm danger" id="set-confirm-btn" onclick="settingsConfirmImport()" disabled>Write to Database</button>
        </div>

        <div id="set-import-status" style="margin-top:12px;font-family:var(--mono);font-size:11px;color:var(--text-s)"></div>
      </div>
    </div>`;

  const chk = document.getElementById('set-confirm-check');
  if (chk) chk.addEventListener('change', () => {
    document.getElementById('set-confirm-btn').disabled = !chk.checked;
  });
}

/* ───────────────────────── EXPORT ───────────────────────── */

async function settingsExport() {
  const org = currentUser?.org;
  if (!org) return;
  const statusEl = document.getElementById('set-export-status');
  const btn = document.getElementById('set-export-btn');
  btn.disabled = true;
  statusEl.textContent = 'Reading accounts…';

  try {
    const accountsSnap = await db.collection('orgs').doc(org).collection('accounts').get();

    const accountRows = [];
    const studentRows = [];
    const attendanceRows = [];

    let i = 0;
    for (const acctDoc of accountsSnap.docs) {
      i++;
      statusEl.textContent = `Reading account ${i}/${accountsSnap.size}: ${acctDoc.id}…`;
      const a = acctDoc.data();
      accountRows.push({
        account_id:   acctDoc.id,
        account_name: a.account_name || '',
        account_pass: a.account_pass || '',
        role:         a.role || a.account_role || '',
        org_id:       a.org_id || org,
        device_id:    a.device_id || '',
        device_brand: a.device_brand || '',
        device_model: a.device_model || '',
      });

      const studSnap = await db.collection('orgs').doc(org)
        .collection('accounts').doc(acctDoc.id)
        .collection('students').get();
      studSnap.forEach(sDoc => {
        const s = sDoc.data();
        studentRows.push({
          account_id:     acctDoc.id,
          student_doc_id: sDoc.id,
          name:           s.name || '',
          roll_no:        s.roll_no || '',
          sample_count:   s.sample_count ?? '',
          registered_at:  s.registered_at || '',
          embedding:      s.embedding || '',
          synced_at:      s.synced_at || '',
        });
      });

      const attSnap = await db.collection('orgs').doc(org)
        .collection('accounts').doc(acctDoc.id)
        .collection('attendance_flat').get();
      attSnap.forEach(dDoc => {
        const f = dDoc.data();
        attendanceRows.push({
          account_id:   acctDoc.id,
          doc_id:       dDoc.id,
          account:      f.account || acctDoc.id,
          date:         f.date || '',
          session:      f.session || '',
          student_name: f.student_name || '',
          roll_no:      f.roll_no || '',
          status:       f.status || '',
          group_name:   f.group_name || '',
          synced_at:    f.synced_at || '',
        });
      });
    }

    statusEl.textContent = 'Reading pending requests…';
    const pendingSnap = await db.collection('orgs').doc(org).collection('pending_accounts').get();
    const pendingRows = pendingSnap.docs.map(d => {
      const p = d.data();
      return {
        doc_id:       d.id,
        account_name: p.account_name || '',
        account_pass: p.account_pass || '',
        role:         p.role || '',
        device_id:    p.device_id || '',
        device_brand: p.device_brand || '',
        device_model: p.device_model || '',
        status:       p.status || '',
      };
    });

    statusEl.textContent = 'Building workbook…';
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accountRows), 'Accounts');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), 'Students');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(attendanceRows), 'Attendance');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendingRows), 'PendingAccounts');

    const fname = `gift-export-${org}-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, fname);

    statusEl.textContent = `Done — ${accountRows.length} accounts, ${studentRows.length} students, ${attendanceRows.length} attendance records, ${pendingRows.length} pending. Saved as ${fname}.`;
    console.log('[settings] export complete', fname);
  } catch (e) {
    console.error('[settings] export error', e);
    statusEl.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

/* ───────────────────────── IMPORT ───────────────────────── */

window._settingsImportData = null;

function settingsPreviewImport() {
  const fileInput = document.getElementById('set-import-file');
  const statusEl  = document.getElementById('set-import-status');
  const file = fileInput?.files?.[0];
  if (!file) { statusEl.textContent = 'Choose a .xlsx file first.'; return; }

  statusEl.textContent = 'Parsing file…';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const getSheet = (name) => {
        const ws = wb.Sheets[name];
        return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
      };

      const data = {
        accounts:   getSheet('Accounts'),
        students:   getSheet('Students'),
        attendance: getSheet('Attendance'),
        pending:    getSheet('PendingAccounts'),
      };
      window._settingsImportData = data;

      const acctSet = new Set(data.students.map(r => r.account_id).concat(data.attendance.map(r => r.account_id)));

      document.getElementById('set-preview').classList.remove('hidden');
      document.getElementById('set-preview-body').innerHTML = `
        Accounts: <strong>${data.accounts.length}</strong> ·
        Students: <strong>${data.students.length}</strong> (across ${acctSet.size} account(s)) ·
        Attendance: <strong>${data.attendance.length}</strong> ·
        Pending: <strong>${data.pending.length}</strong>`;
      document.getElementById('set-confirm-check').checked = false;
      document.getElementById('set-confirm-btn').disabled = true;
      statusEl.textContent = 'File parsed. Review the preview, choose a mode above, then confirm.';
    } catch (err) {
      console.error('[settings] parse error', err);
      statusEl.textContent = 'Error parsing file: ' + err.message;
    }
  };
  reader.readAsArrayBuffer(file);
}

async function settingsConfirmImport() {
  const org = currentUser?.org;
  const data = window._settingsImportData;
  const statusEl = document.getElementById('set-import-status');
  const confirmBtn = document.getElementById('set-confirm-btn');
  if (!org || !data) return;

  const mode = document.querySelector('input[name="set-mode"]:checked')?.value || 'merge';
  confirmBtn.disabled = true;
  statusEl.textContent = `Writing to database (${mode} mode)…`;

  try {
    const orgRef = db.collection('orgs').doc(org);

    // ── Accounts (org-level collection) ──
    if (mode === 'replace' && data.accounts.length) {
      const existing = await orgRef.collection('accounts').get();
      for (const d of existing.docs) await d.ref.delete();
    }
    for (const row of data.accounts) {
      if (!row.account_id) continue;
      await orgRef.collection('accounts').doc(String(row.account_id)).set({
        account_name: row.account_name || '',
        account_pass: row.account_pass || '',
        role:         row.role || '',
        org_id:       org,
        device_id:    row.device_id || '',
        device_brand: row.device_brand || '',
        device_model: row.device_model || '',
        last_seen:    firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: mode === 'merge' });
    }

    // ── Students (grouped by account_id) ──
    const studentsByAcct = _settingsGroupBy(data.students, 'account_id');
    for (const acctId of Object.keys(studentsByAcct)) {
      const studRef = orgRef.collection('accounts').doc(acctId).collection('students');
      if (mode === 'replace') {
        const existing = await studRef.get();
        for (const d of existing.docs) await d.ref.delete();
      }
      for (const row of studentsByAcct[acctId]) {
        const docId = row.student_doc_id || row.name;
        if (!docId) continue;
        await studRef.doc(String(docId)).set({
          name:          row.name || '',
          roll_no:       row.roll_no || '',
          sample_count:  row.sample_count || 1,
          registered_at: row.registered_at || '',
          embedding:     row.embedding || '',
          synced_at:     row.synced_at || '',
        }, { merge: mode === 'merge' });
      }
    }

    // ── Attendance (grouped by account_id) ──
    const attByAcct = _settingsGroupBy(data.attendance, 'account_id');
    for (const acctId of Object.keys(attByAcct)) {
      const attRef = orgRef.collection('accounts').doc(acctId).collection('attendance_flat');
      if (mode === 'replace') {
        const existing = await attRef.get();
        for (const d of existing.docs) await d.ref.delete();
      }
      for (const row of attByAcct[acctId]) {
        const docId = row.doc_id;
        const ref = docId ? attRef.doc(String(docId)) : attRef.doc();
        await ref.set({
          account:      row.account || acctId,
          date:         row.date || '',
          session:      row.session || '',
          student_name: row.student_name || '',
          roll_no:      row.roll_no || '',
          status:       row.status || '',
          group_name:   row.group_name || '',
          synced_at:    row.synced_at || '',
        }, { merge: mode === 'merge' });
      }
    }

    // ── Pending accounts (org-level collection) ──
    if (mode === 'replace' && data.pending.length) {
      const existing = await orgRef.collection('pending_accounts').get();
      for (const d of existing.docs) await d.ref.delete();
    }
    for (const row of data.pending) {
      const docId = row.doc_id || row.account_name;
      if (!docId) continue;
      await orgRef.collection('pending_accounts').doc(String(docId)).set({
        account_name: row.account_name || '',
        account_pass: row.account_pass || '',
        role:         row.role || '',
        device_id:    row.device_id || '',
        device_brand: row.device_brand || '',
        device_model: row.device_model || '',
        status:       row.status || 'pending',
      }, { merge: mode === 'merge' });
    }

    statusEl.textContent = `Import complete (${mode} mode).`;
    console.log('[settings] import complete', mode);
  } catch (e) {
    console.error('[settings] import error', e);
    statusEl.textContent = 'Error: ' + e.message;
  }
}

function _settingsGroupBy(rows, key) {
  const out = {};
  rows.forEach(r => {
    const k = r[key];
    if (!k) return;
    (out[k] = out[k] || []).push(r);
  });
  return out;
}
