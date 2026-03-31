# Workshop Registration App — Setup Guide

## What you'll have running in ~15 minutes

| File | Purpose |
|------|---------|
| `index.html` | Participant registration form + ticket display |
| `scanner.html` | Volunteer QR scanning & check-in tool |
| `Code.gs` | Google Apps Script (backend + email) |

---

## STEP 1 — Create the Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a new spreadsheet.
2. Rename the first tab to exactly: **`Registrations`**
3. In **Row 1**, add these headers exactly (A → I):

```
Timestamp | Full Name | Email | Phone | Organization / College | Ticket ID | Check-in Status | Check-in Time | Checked In By
```

4. Note the Spreadsheet URL — you'll need it soon.

---

## STEP 2 — Set Up Google Apps Script

1. In your Google Sheet, click **Extensions → Apps Script**.
2. Delete all existing code in the editor.
3. Open `Code.gs` from this package and **paste the entire contents** into the editor.
4. Edit the top configuration block to match your event:

```javascript
const EVENT_NAME   = 'Your Workshop Name';
const EVENT_DATE   = '14 June 2025';
const EVENT_VENUE  = 'Main Hall, Your College';
```

5. Click **Save** (floppy disk icon or Ctrl+S).

---

## STEP 3 — Deploy Apps Script as a Web App

1. Click **Deploy → New deployment**.
2. Click the ⚙ gear icon next to "Type" and select **Web app**.
3. Fill in:
   - **Description**: `Workshop Registration API`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. **Authorize** when prompted (you'll see a permissions dialog — click "Allow").
6. Copy the **Web app URL** — it looks like:
   `https://script.google.com/macros/s/AKfycb.../exec`

> ⚠️ Every time you edit `Code.gs` you must create a **New Deployment** (not "Manage deployments"). Editing without redeploying won't update the live URL.

---

## STEP 4 — Update the HTML files

Open both `index.html` and `scanner.html` in a text editor.

Find this line (near the top of the `<script>` section in each file):

```javascript
const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
```

Replace `YOUR_APPS_SCRIPT_URL_HERE` with the URL you copied in Step 3.

Also update the event details in `index.html`:

```javascript
const EVENT_NAME  = 'Your Workshop Name';
const EVENT_DATE  = '14 June 2025';
const EVENT_VENUE = 'Main Hall, Your College';
```

And the access code in `scanner.html` (default: `SCAN2025`):

```javascript
const ACCESS_CODE = 'SCAN2025';
```

---

## STEP 5 — Deploy on Vercel (free)

### Option A: Drag & Drop (fastest)

1. Go to [vercel.com](https://vercel.com) and sign up / log in with GitHub.
2. Click **Add New → Project → Browse** (or drag files).
3. Upload the folder containing `index.html` and `scanner.html`.
4. Click **Deploy**. Done — you get a live URL like `your-project.vercel.app`.

### Option B: Via GitHub

1. Create a new GitHub repository.
2. Push `index.html` and `scanner.html` to the repo.
3. On Vercel, import the GitHub repo.
4. Vercel auto-deploys on every push.

> **No `vercel.json` needed** — Vercel auto-serves static HTML files.

---

## STEP 6 — Test it end-to-end

1. Visit `your-project.vercel.app` → fill out the form → submit.
2. Check your Google Sheet — a new row should appear.
3. Check your email inbox — a styled ticket email should arrive.
4. Open `your-project.vercel.app/scanner.html` → enter access code (`SCAN2025`) and your name.
5. Scan the QR code on the ticket — you should see participant info in green.
6. Click "Check In" → status updates in the sheet.
7. Scan the same ticket again → it shows red (already checked in) with the time.

---

## Google Sheet Column Reference

| Column | Header | Notes |
|--------|--------|-------|
| A | Timestamp | Auto-set by Apps Script |
| B | Full Name | From form |
| C | Email | From form |
| D | Phone | From form |
| E | Organization / College | From form |
| F | Ticket ID | Auto-generated (WKSHP-0001 format) |
| G | Check-in Status | Default: "Not Yet" → "Yes" on check-in |
| H | Check-in Time | Set on check-in |
| I | Checked In By | Volunteer name set on check-in |

---

## Troubleshooting

### Registration says "Something went wrong"
- Make sure you deployed the Apps Script as a **New Deployment** (not edited existing).
- Make sure **Who has access** is set to **Anyone** (not "Anyone with Google account").
- Check the Apps Script execution log: **Executions** tab in Apps Script editor.

### Email not arriving
- Check spam folder.
- Apps Script uses your Gmail to send — confirm the Gmail account has no sending restrictions.
- MailApp has a daily limit of 100 emails for free accounts. For more, use GmailApp or a sending service.

### Scanner camera not working
- Browsers require **HTTPS** for camera access. Vercel provides this automatically.
- On iOS Safari, go to Settings → Safari → Camera and allow access.
- Use the manual entry field as a fallback.

### QR code blank/broken
- The QR code uses `api.qrserver.com` — it requires internet access.
- If the image doesn't load, check network connectivity.

---

## Customization

### Change ticket prefix
In `Code.gs`:
```javascript
const TICKET_PREFIX = 'WKSHP';  // change to e.g. 'CONF', 'HACK', 'FEST'
```

### Add more form fields
1. Add the HTML `<input>` in `index.html`.
2. Add the field to the `FIELDS` array and `payload` object in the script.
3. Add the column to `Code.gs` and update `COL` indices accordingly.
4. Add a new column to the Google Sheet.

### Change the access code
In `scanner.html`:
```javascript
const ACCESS_CODE = 'SCAN2025';  // change to something secret
```

---

## Tech Stack Summary

| Layer | Tool | Cost |
|-------|------|------|
| Frontend | HTML + CSS + Vanilla JS | Free |
| Hosting | Vercel | Free |
| Database | Google Sheets | Free |
| Backend/API | Google Apps Script | Free |
| QR Generation | api.qrserver.com | Free |
| QR Scanning | html5-qrcode (CDN) | Free |
| Email | Gmail via MailApp | Free (100/day) |
| Form persistence | localStorage | Free (built-in) |

**Total cost: $0.00**
