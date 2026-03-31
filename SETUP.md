# 🎟️ Workshop Ticket Scanner — Setup Guide

A complete system for workshop ticket registration, QR code generation, and venue check-in scanning.

---

## Architecture Overview

```
Google Form → Google Sheet (DB) ← Apps Script (Trigger: Ticket + Email)
                                 ← Apps Script (Web App API)
                                 ← Scanner Web App (HTML/JS)
```

---

## Step 1: Create the Google Form

Create a Google Form with these fields (in this exact order):

| # | Field                     | Type         |
|---|---------------------------|--------------|
| 1 | Full Name                 | Short text   |
| 2 | Email Address             | Short text   |
| 3 | Phone Number              | Short text   |
| 4 | Organization / College    | Short text   |
| 5 | Payment Status            | Dropdown: `Paid`, `Unpaid` |

**Link the form to a Google Sheet:**
1. In the Form editor, go to the **Responses** tab.
2. Click the **Google Sheets** icon → "Create a new spreadsheet".

---

## Step 2: Prepare the Google Sheet

The form auto-creates columns A–F. You need to **manually add 5 more column headers** in the first row:

| Column | Header              | Notes                     |
|--------|---------------------|---------------------------|
| A      | Timestamp           | Auto from Form            |
| B      | Full Name           | Auto from Form            |
| C      | Email Address       | Auto from Form            |
| D      | Phone Number        | Auto from Form            |
| E      | Organization / College | Auto from Form          |
| F      | Payment Status      | Auto from Form            |
| **G**  | **Unique Ticket ID**| Add manually              |
| **H**  | **QR Code Sent?**   | Add manually              |
| **I**  | **Check-in Status** | Add manually              |
| **J**  | **Check-in Time**   | Add manually              |
| **K**  | **Checked In By**   | Add manually              |

> ⚠️ The column order must match exactly, or update `COL` constants in the scripts.

---

## Step 3: Add Google Apps Script Code

1. In your Google Sheet, go to **Extensions → Apps Script**.
2. Delete any existing code in `Code.gs`.
3. Create **two files**:

### File 1: `triggers.gs`
- Copy the entire contents of `triggers.gs` from this project.
- Update the constants at the top:
  ```javascript
  const SHEET_NAME    = "Form Responses 1";  // Your sheet tab name
  const TICKET_PREFIX = "WKSHP";
  const EVENT_NAME    = "Your Workshop Name";
  const EVENT_DATE    = "April 15, 2026";
  const EVENT_VENUE   = "Your Venue";
  const EVENT_TIME    = "10:00 AM – 4:00 PM";
  const ORGANIZER_NAME = "Your Org Name";
  ```

### File 2: `api.gs`
- Create a new script file (click `+` → Script → name it `api`).
- Copy the entire contents of `api.gs` from this project.
- Ensure `API_SHEET_NAME` matches your sheet tab name.

---

## Step 4: Set Up the Form Submit Trigger

1. In Apps Script, click the **⏰ Triggers** icon (left sidebar).
2. Click **+ Add Trigger**:
   - Function: `onFormSubmit`
   - Event source: `From spreadsheet`
   - Event type: `On form submit`
3. Click **Save** and authorize the script.

**Test it:** Submit a test response via the form. Check:
- Column G should have a Ticket ID (e.g., `WKSHP-0001`)
- Column H should say `Yes`
- You should receive the ticket email

---

## Step 5: Deploy the Web App API

1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon ⚙️ → Select **Web app**.
3. Configure:
   - **Description:** `Ticket Scanner API`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. **Copy the Web App URL** — you'll need it in the next step.

> Each time you update the script, create a **New deployment** or update the existing one.

---

## Step 6: Configure & Deploy the Scanner Web App

1. Open `index.html` and update the `CONFIG` object:
   ```javascript
   const CONFIG = {
     API_URL: "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec",
     ACCESS_CODE: "scan2026",  // Change this to your preferred code
     SCAN_COOLDOWN_MS: 3000,
   };
   ```

2. **Deploy the HTML file** — choose one of these options:

   | Option              | How                                                       |
   |---------------------|-----------------------------------------------------------|
   | **GitHub Pages**    | Push to a repo → enable GitHub Pages                      |
   | **Netlify**         | Drag-and-drop the file at [app.netlify.com/drop](https://app.netlify.com/drop) |
   | **Vercel**          | `npx vercel --yes` in the project folder                   |
   | **Google Drive**    | Upload as HTML, use Google Sites to embed                  |
   | **Local (testing)** | Just open `index.html` in a browser                        |

---

## Step 7: Test the Full Flow

1. **Submit a form response** → Verify ticket email arrives with QR code.
2. **Open the scanner** on your phone → Enter access code → Enter volunteer name.
3. **Scan the QR code** from the email (or type the Ticket ID manually).
4. **Confirm check-in** → Verify the Google Sheet updates correctly.
5. **Re-scan the same QR** → Should show "Already Checked In" with details.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Email not sending | Check Apps Script execution log; ensure Gmail quota not exceeded |
| API returns error | Verify the Web App URL ends with `/exec`; re-deploy if needed |
| Camera not working | Ensure HTTPS; check browser permissions; use manual entry |
| CORS errors | GAS Web Apps handle CORS automatically; ensure "Anyone" access |
| Wrong columns | Verify column order matches `COL` constants in both `.gs` files |
| Ticket ID missing | Check that the trigger is set to `onFormSubmit`, not `onEdit` |

---

## File Structure

```
DroneXperience/
├── triggers.gs     ← Paste into Apps Script (ticket generation + email)
├── api.gs          ← Paste into Apps Script (scanner API)
├── index.html      ← Scanner web app (deploy to hosting)
└── SETUP.md        ← This file
```

---

## Security Notes

- The **access code** is a simple barrier — not enterprise-grade auth.
- The **GAS Web App** is public ("Anyone") so the scanner can reach it without login.
- For better security, consider adding a secret API key as a query parameter.
- `LockService` in `api.gs` prevents race conditions during simultaneous check-ins.
