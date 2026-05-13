# GIFT Dashboard — Setup & Structure

## File Structure
```
gift-dashboard/
├── index.html               ← Single HTML entry point
├── assets/
│   └── logo.svg             ← App logo (4-square grid motif, replace with custom if needed)
├── css/
│   └── style.css            ← All styles (dark theme, CSS variables, all page layouts)
└── js/
    ├── firebase-config.js   ← Firebase init — REPLACE config values before deploying
    ├── auth.js              ← Sign in / Register / Sign out logic (validates against Firestore)
    ├── app.js               ← Router, sidebar toggle, Firestore listener cleanup
    └── pages/
        ├── home.js          ← Overview: live stats + recent pings
        ├── audit.js         ← Real-time log boxes per device (from logs/<deviceId>/sessions/)
        ├── attendance.js    ← Attendance table (reads from `attendance` Firestore collection)
        ├── teacher-roster.js← Teacher + student roster cards + settings stubs
        ├── student-roster.js← Placeholder
        ├── killswitch.js    ← Reads/writes config/kill_switch (same doc the mobile app listens to)
        ├── profile.js       ← Edit profile, writes to users/ and organizations/.../accounts/
        └── settings.js      ← Placeholder
```

## GitHub Pages Setup
1. Create a GitHub repo (e.g. `gift-dashboard`)
2. Push all files — **root must contain `index.html`**
3. Go to repo → Settings → Pages → Source: `main` branch, `/ (root)`
4. Site URL: `https://<your-username>.github.io/gift-dashboard/`
5. No build step needed — pure HTML/CSS/JS

## Before Deploying — Required Steps
### 1. Firebase Config (`js/firebase-config.js`)
Replace the placeholder values with your actual Firebase project config:
```js
apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId
```
Find these at: Firebase Console → Project Settings → Your apps → Web app

### 2. Firestore Security Rules
The dashboard reads several collections. Minimum rules to allow web reads:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated web users to read everything and write to specific paths
    match /users/{doc}         { allow read, write; }
    match /pings/{doc}         { allow read; }
    match /logs/{d}/sessions/{s} { allow read; }
    match /organizations/{org}/accounts/{acc} { allow read, write; }
    match /config/kill_switch  { allow read, write; }
    match /attendance/{doc}    { allow read, write; }
  }
}
```
**Note:** These are permissive. Tighten before production.

### 3. Attendance Sync
The mobile app writes attendance to SQLite (local). To see records on the web:
- **Option A (recommended):** In `attendance_service.dart` `saveSession()`, after `_db.insertRecords(records)`, also mirror each record to Firestore `attendance/` collection.
- **Option B:** Use the export/import via TransferService + manually upload JSON (not real-time).

## Custom Logo
Replace `assets/logo.svg` with your own SVG file and keep the filename, OR:
- Change `<link rel="icon" href="assets/logo.svg">` in index.html to point to a .png
- Change `<img src="assets/logo.svg">` references in index.html (2 places: auth box + sidebar)

## Firestore Collections Used
| Collection | Used By |
|---|---|
| `users/` | Teacher Roster, Home stats, Profile |
| `pings/` | Home recent pings |
| `logs/<deviceId>/sessions/` | Audit Analytics |
| `organizations/<org>/accounts/` | Auth (register/signin) |
| `config/kill_switch` | Kill Switch page |
| `attendance/` | Attendance Records |

## Notes
- Session is stored in `sessionStorage` — closes on tab close, user must re-login
- Password is stored in plain text in Firestore (mirrors mobile app behavior)
- All `console.log` / `console.error` debug statements are retained throughout
