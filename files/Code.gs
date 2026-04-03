// ═══════════════════════════════════════════════════════════════
//  WORKSHOP REGISTRATION — Google Apps Script
//  Paste this entire file into your Apps Script editor and deploy
//  as a Web App (Execute as: Me, Access: Anyone)
// ═══════════════════════════════════════════════════════════════

// ─── CONFIGURATION ─────────────────────────────────────────────
const SHEET_NAME    = 'Registrations';   // tab name in your Google Sheet
const EVENT_NAME    = 'DroneXperience Workshop';
const EVENT_DATE    = '20th - 21st April 2026';
const EVENT_VENUE   = 'TP2 - CLS 711';
const TICKET_PREFIX = 'DX';
const AMOUNT        = '₹600';
const PENDING_APPROVAL_STATUS = 'PendingApproval';
const APPROVED_STATUS         = 'Approved';
// ─── HELPER: Dynamic Header Mapping ──────────────────────────────
function getColMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const map = {
    TICKET_ID:    9,  // default fallback (J)
    STATUS:       12, // default fallback (M)
    CHECKIN_TIME: 13, // default fallback (N)
    NAME:         1,  // default fallback (B)
    EMAIL:        2,  // default fallback (C)
    PHONE:        7,  // default fallback (H)
    ORG:          8,  // default fallback (I)
  };
  
  headers.forEach((h, i) => {
    const text = String(h).toLowerCase().trim();
    if (text.includes('ticket id')) map.TICKET_ID = i;
    else if (text === 'status') map.STATUS = i;
    else if (text.includes('check-in time')) map.CHECKIN_TIME = i;
    else if (text === 'name') map.NAME = i;
    else if (text === 'email') map.EMAIL = i;
    else if (text === 'phone' || text === 'mobile') map.PHONE = i;
    else if (text === 'organization' || text === 'college' || text === 'org') map.ORG = i;
  });
  return map;
}

const CHECKED_IN_STATUS = 'Checked-In';

// ─── CORS HELPER ────────────────────────────────────────────────
function corsOutput(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── doGet — ticket lookup for scanner ─────────────────────────
function doGet(e) {
  try {
    const action = e.parameter.action;
    
    if (action === 'getPending') {
      return getPendingApprovals();
    }
    if (action === 'getAdminData') {
      return getAdminDashboardData(e.parameter.user, e.parameter.pass);
    }
    if (action === 'checkin') {
      return handleCheckin(e.parameter); // Handles ticketId and volunteerName from parameters
    }
    if (action === 'approve') {
      return approveParticipant(e.parameter); // Handles ticketId and adminName from parameters
    }

    const ticketId = (e.parameter.ticketId || '').trim().toUpperCase();
    if (!ticketId) return corsOutput({ found: false, error: 'No ticketId provided' });

    const ss    = SpreadsheetApp.openById('1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA');
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data  = sheet.getDataRange().getValues();
    const COL   = getColMap(sheet);

    // Row 0 is header; search from row 1
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sheetTicketId = String(row[COL.TICKET_ID] || '').trim().toUpperCase();
      if (sheetTicketId === ticketId) {
        return corsOutput({
          found:       true,
          name:        row[COL.NAME],
          email:       row[COL.EMAIL],
          phone:       row[COL.PHONE],
          org:         row[COL.ORG],
          ticketId:    row[COL.TICKET_ID],
          checkedIn:   String(row[COL.STATUS]).trim(),
          checkinTime: row[COL.CHECKIN_TIME] ? String(row[COL.CHECKIN_TIME]) : '',
        });
      }
    }

    return corsOutput({ found: false });
  } catch (err) {
    return corsOutput({ found: false, error: err.message });
  }
}

// ─── doPost — register or checkin ──────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'register') {
      return handleRegister(body);
    } else if (action === 'checkin') {
      return handleCheckin(body);
    } else if (action === 'approve') {
      return approveParticipant(body);
    } else if (action === 'getAdminData') {
      return getAdminDashboardData(body.user, body.pass);
    } else {
      return corsOutput({ success: false, message: 'Unknown action' });
    }
  } catch (err) {
    return corsOutput({ success: false, message: err.message });
  }
}

// ─── REGISTER ───────────────────────────────────────────────────
function handleRegister(body) {
  const { name, email, phone, org, regno, degree, dept, year, eventName, eventDate, eventVenue, paymentRef, screenshot } = body;

  if (!name || !email || !phone || !org || !regno || !degree || !dept || !year) {
    return corsOutput({ success: false, message: 'Missing required fields' });
  }

  const ss    = SpreadsheetApp.openById('1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA');
  const sheet = ss.getSheetByName(SHEET_NAME);

  // Generate official ticket ID (sequential)
  const lastRow   = sheet.getLastRow();
  const count     = Math.max(lastRow, 1);
  const ticketNum = String(count).padStart(4, '0');
  const ticketId  = `${TICKET_PREFIX}-${ticketNum}`;

  const timestamp = new Date();

  // Save payment screenshot to Google Drive (if provided)
  let screenshotUrl = '';
  if (screenshot && screenshot.startsWith('data:image')) {
    try {
      const base64Data   = screenshot.split(',')[1];
      const contentType  = screenshot.split(';')[0].split(':')[1];
      const blob         = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, `payment_${ticketId}.jpg`);
      const folder       = getOrCreateFolder('DroneXperience_Screenshots');
      const file         = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      screenshotUrl = file.getUrl();
    } catch (err) {
      screenshotUrl = 'Upload failed: ' + err.message;
    }
  }

  // Append row to sheet
  sheet.appendRow([
    timestamp,
    name,
    email,
    dept || '',
    year || '',
    degree || '',
    regno || '',
    phone,
    org,
    ticketId,
    paymentRef || '',   // provisional ID used in payment note
    screenshotUrl,      // Drive link to screenshot
    'PendingApproval', // Initial Status
    '',                 // Check-in Time
    '',                 // Checked In By
  ]);

  return corsOutput({ success: true, ticketId });
}

// ─── APPROVE PARTICIPANT ────────────────────────────────────────
function approveParticipant(body) {
  const { ticketId, adminName } = body;
  if (!ticketId) return corsOutput({ success: false, message: 'Missing ticketId' });

  const ss    = SpreadsheetApp.openById('1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA');
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL.TICKET_ID]).trim().toUpperCase() === ticketId.trim().toUpperCase()) {
      
      if (row[COL.STATUS] !== 'PendingApproval') {
        return corsOutput({ success: false, message: 'Already approved or checked in' });
      }

      const sheetRow = i + 1;
      sheet.getRange(sheetRow, COL.STATUS + 1).setValue(APPROVED_STATUS);
      
      // Send the actual ticket email ONLY now
      sendTicketEmail(row[COL.EMAIL], row[COL.NAME], ticketId, EVENT_NAME, EVENT_DATE, EVENT_VENUE);
      
      return corsOutput({ success: true });
    }
  }
  return corsOutput({ success: false, message: 'Ticket not found' });
}

// ─── GET PENDING LIST ───────────────────────────────────────────
function getPendingApprovals() {
  const ss    = SpreadsheetApp.openById('1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA');
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();
  const pending = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[COL.STATUS] === 'PendingApproval') {
      pending.push({
        timestamp:  row[COL.TIMESTAMP],
        name:       row[COL.NAME],
        email:      row[COL.EMAIL],
        phone:      row[COL.PHONE],
        org:        row[COL.ORG],
        ticketId:   row[COL.TICKET_ID],
        paymentRef: row[COL.PAYMENT_REF],
        screenshot: row[COL.SCREENSHOT],
        dept:       row[COL.DEPT] || '',
        year:       row[COL.YEAR] || '',
        degree:     row[COL.DEGREE] || '',
        regno:      row[COL.REG_NO] || ''
      });
    }
  }
  return corsOutput({ success: true, pending });
}

// ─── DRIVE HELPER ───────────────────────────────────────────────
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ─── CHECK IN ───────────────────────────────────────────────────
function handleCheckin(body) {
  const ticketId = (body.ticketId || '').trim().toUpperCase();
  
  if (!ticketId) return corsOutput({ success: false, message: 'Missing ticketId' });

  try {
    const ss    = SpreadsheetApp.openById('1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA');
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return corsOutput({ success: false, message: `Sheet ${SHEET_NAME} not found` });

    const data  = sheet.getDataRange().getValues();
    const COL   = getColMap(sheet);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sheetTicketId = String(row[COL.TICKET_ID] || '').trim().toUpperCase();
      
      if (sheetTicketId === ticketId) {
        if (String(row[COL.STATUS]).trim().toLowerCase() === CHECKED_IN_STATUS.toLowerCase()) {
          return corsOutput({
            success:  false,
            reason:   'already_checked_in',
            time:     String(row[COL.CHECKIN_TIME]),
          });
        }

        // Update the sheet (sheet rows are 1-indexed)
        const sheetRow = i + 1;
        const now = new Date();
        
        // Update values
        sheet.getRange(sheetRow, COL.STATUS + 1).setValue(CHECKED_IN_STATUS);
        sheet.getRange(sheetRow, COL.CHECKIN_TIME + 1).setValue(now);
        
        // Force flush for immediate persistence
        SpreadsheetApp.flush(); 

        return corsOutput({ success: true });
      }
    }
    return corsOutput({ success: false, reason: 'not_found', message: 'Ticket ID not found' });
  } catch (err) {
    return corsOutput({ success: false, message: 'Server Error: ' + err.toString() });
  }
}

// ─── EMAIL ──────────────────────────────────────────────────────
function sendTicketEmail(email, name, ticketId, eventName, eventDate, eventVenue) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(ticketId)}&color=000000&bgcolor=ffffff`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#121212;font-family:'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#121212;padding:40px 10px;">
    <tr><td align="center">
      <table width="100%" style="max-width:500px;background-color:#1e1e1e;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.4);" cellpadding="0" cellspacing="0">
        
        <!-- Teal Branding Header -->
        <tr>
          <td align="center" style="background:linear-gradient(135deg, #00897b 0%, #005c4b 100%);padding:45px 30px 40px;">
            <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0.8);">✦ OFFICIAL ENTRY PASS</p>
            <h1 style="margin:0;font-size:32px;font-weight:800;color:#ffffff;line-height:1.2;">${eventName}</h1>
            <p style="margin:15px 0 0;font-size:14px;color:rgba(255,255,255,0.9);font-weight:500;">${eventDate} &nbsp;•&nbsp; ${eventVenue}</p>
          </td>
        </tr>

        <!-- Personalization Section -->
        <tr>
          <td style="padding:40px 35px 30px;background-color:#1e1e1e;">
            <h2 style="margin:0 0 15px;font-size:20px;font-weight:600;color:#ffffff;">Hello <span style="color:#00897b;">${name}</span>,</h2>
            <p style="margin:0;font-size:15px;color:#a1a1aa;line-height:1.6;">
              Your registration is confirmed! Please find your ticket below. 
              Present this QR code at the entrance for check-in.
            </p>
          </td>
        </tr>

        <!-- Ticket QR Section -->
        <tr>
          <td align="center" style="padding:0 35px 45px;">
            <div style="background-color:#27272a;padding:30px;border-radius:20px;display:inline-block;border:1px solid #3f3f46;">
              <div style="background-color:#ffffff;padding:12px;border-radius:12px;display:inline-block;">
                <img src="${qrUrl}" width="180" height="180" style="display:block;" alt="Ticket QR">
              </div>
              <div style="margin-top:20px;">
                <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#71717a;text-transform:uppercase;">Ticket ID</p>
                <p style="margin:0;font-size:20px;font-weight:800;color:#00897b;font-family:monospace;">${ticketId}</p>
              </div>
            </div>
          </td>
        </tr>

        <!-- Footer Footer -->
        <tr>
          <td align="center" style="padding:0 30px 40px;border-top:1px solid #27272a;">
            <p style="margin:30px 0 0;font-size:12px;color:#52525b;line-height:1.5;">
              This is an automated ticket. Please do not share this QR code.<br>
              &copy; 2026 DroneXperience
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  GmailApp.sendEmail(email, `Your Ticket for ${eventName} — ${ticketId}`, `Hello ${name}, your ticket is confirmed. ID: ${ticketId}`, {
    htmlBody: htmlBody,
    name: "DroneXperience"
  });
}

// ─── ADMIN DASHBOARD DATA ───────────────────────────────────────
function getAdminDashboardData(user, pass) {
  const u = (user || '').trim().toLowerCase();
  const p = (pass || '').trim().toLowerCase();

  console.log('Login Attempt:', { receivedUser: u, receivedPass: p });

  if (u !== 'hexaadmin' || p !== 'password') {
    return corsOutput({ success: false, message: 'Invalid Username or Password' });
  }

  const ss    = SpreadsheetApp.openById('1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA');
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data  = sheet.getDataRange().getValues();

  const members = [];
  let total     = 0;
  let pending   = 0;
  let approved  = 0;
  let checkedIn = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[COL.STATUS]).trim();
    
    total++;
    if (status === 'PendingApproval') pending++;
    else if (status === 'Approved')   approved++;
    else if (status === 'Yes')        checkedIn++;

    members.push({
      timestamp:  row[COL.TIMESTAMP],
      name:       row[COL.NAME],
      email:      row[COL.EMAIL],
      phone:      row[COL.PHONE],
      org:        row[COL.ORG],
      ticketId:   row[COL.TICKET_ID],
      paymentRef: row[COL.PAYMENT_REF],
      screenshot: row[COL.SCREENSHOT],
      status:     status,
      dept:       row[COL.DEPT] || '',
      year:       row[COL.YEAR] || '',
      degree:     row[COL.DEGREE] || '',
      regno:      row[COL.REG_NO] || ''
    });
  }

  return corsOutput({
    success: true,
    stats: { total, pending, approved, checkedIn },
    members: members.reverse() // Newest first
  });
}
