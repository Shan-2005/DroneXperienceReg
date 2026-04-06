// ═══════════════════════════════════════════════════════════════
//  WORKSHOP REGISTRATION — Google Apps Script
//  Paste this entire file into your Apps Script editor and deploy
//  as a Web App (Execute as: Me, Access: Anyone)
//
//  IMPORTANT: After updating this code, you MUST re-deploy or run 
//  any function manually once to trigger the "Review Permissions" 
//  popup for Gmail access.
// ═══════════════════════════════════════════════════════════════

// ─── CONFIGURATION ─────────────────────────────────────────────
const SHEET_NAME    = 'Registrations';   
const EVENT_NAME    = 'DroneXperience Workshop';
const EVENT_DATE    = '20th - 21st April 2026';
const EVENT_VENUE   = 'TP2 - CLS 711';
const TICKET_PREFIX = 'DX';
const AMOUNT        = '₹600';

// Status Constants
const PENDING_APPROVAL_STATUS = 'PendingApproval';
const APPROVED_STATUS         = 'Approved';
const CHECKED_IN_STATUS      = 'Checked-In';
const SHEET_ID               = '1F1RBhjAv8OhSD2caT4DckocgnrkjRFHiM6-v-L1iKYA';

// ─── HYBRID SPREADSHEET ACCESSOR ──────────────────────────────────
function getSS() {
  try {
    return SpreadsheetApp.openById(SHEET_ID);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

// ─── FUZZY HEADER MAPPING ─────────────────────────────────────────
function getColMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 15)).getValues()[0];
  const map = {
    TIMESTAMP: 0, NAME: 1, EMAIL: 2, DEPT: 3, YEAR: 4, DEGREE: 5, REG_NO: 6,
    PHONE: 7, ORG: 8, TICKET_ID: 9, PAYMENT_REF: 10, SCREENSHOT: 11,
    STATUS: 12, CHECKIN_TIME: 13
  };
  
  headers.forEach((h, i) => {
    const text = String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (text.includes('stamp')) map.TIMESTAMP = i;
    else if (text === 'name') map.NAME = i;
    else if (text === 'email') map.EMAIL = i;
    else if (text === 'department' || text === 'dept') map.DEPT = i;
    else if (text === 'year') map.YEAR = i;
    else if (text === 'degree') map.DEGREE = i;
    else if (text.includes('regno') || text.includes('regno')) map.REG_NO = i;
    else if (text === 'phone' || text === 'mobile' || text === 'number') map.PHONE = i;
    else if (text === 'organization' || text === 'college' || text === 'org') map.ORG = i;
    else if (text.includes('ticketid')) map.TICKET_ID = i;
    else if (text.includes('payment') || text.includes('ref')) map.PAYMENT_REF = i;
    else if (text.includes('screenshot')) map.SCREENSHOT = i;
    else if (text === 'status') map.STATUS = i;
    else if (text.includes('checkintime') || (text.includes('checkin') && text.includes('time'))) map.CHECKIN_TIME = i;
  });
  return map;
}

// ─── STATUS NORMALIZER ───────────────────────────────────────────
function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// ─── CORS & RESPONSE HELPER ───────────────────────────────────────
function res(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ─── doGet — ticket lookup for scanner & Dashboard ───────────────
function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss     = getSS();
    const sheet  = ss.getSheetByName(SHEET_NAME);
    
    if (action === 'getPending') return getPendingApprovals(sheet);
    if (action === 'getAdminData') return getAdminDashboardData(sheet, e.parameter.user, e.parameter.pass);
    if (action === 'checkin') return handleCheckin(sheet, e.parameter); 
    if (action === 'approve') return approveParticipant(sheet, e.parameter);
    if (action === 'checkStatus') return handleCheckStatus(sheet, e.parameter);

    const ticketId = (e.parameter.ticketId || '').trim().toUpperCase();
    if (!ticketId) return res({ found: false, error: 'No ticketId' });

    const data = sheet.getDataRange().getValues();
    const COL  = getColMap(sheet);

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sheetTicketId = String(row[COL.TICKET_ID] || '').trim().toUpperCase();
      if (sheetTicketId === ticketId) {
        return res({
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
    return res({ found: false });
  } catch (err) {
    return res({ found: false, error: err.message });
  }
}

// ─── doPost — register or checkin ──────────────────────────────
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const ss     = getSS();
    const sheet  = ss.getSheetByName(SHEET_NAME);

    if (body.action === 'register') return handleRegister(sheet, body);
    if (body.action === 'checkin')  return handleCheckin(sheet, body);
    if (body.action === 'approve')  return approveParticipant(sheet, body);
    if (body.action === 'getAdminData') return getAdminDashboardData(sheet, body.user, body.pass);
    
    return res({ success: false, message: 'Unknown action' });
  } catch (err) {
    return res({ success: false, message: err.message });
  }
}

// ─── REGISTER ───────────────────────────────────────────────────
function handleRegister(sheet, body) {
  const { name, email, phone, org, regno, degree, dept, year, paymentRef, screenshot } = body;

  if (!name || !email) return res({ success: false, message: 'Name and Email are required' });

  // Generate ticket ID
  const lastRow   = sheet.getLastRow();
  const ticketId  = `${TICKET_PREFIX}-${String(Math.max(lastRow, 1)).padStart(4, '0')}`;
  
  const timestamp = new Date();
  let screenshotUrl = '';
  
  if (screenshot && screenshot.startsWith('data:image')) {
    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(screenshot.split(',')[1]), screenshot.split(';')[0].split(':')[1], `payment_${ticketId}.jpg`);
      const folder = getOrCreateFolder('DroneXperience_Screenshots');
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      screenshotUrl = file.getUrl();
    } catch (err) { screenshotUrl = 'Upload error: ' + err.message; }
  }

  sheet.appendRow([timestamp, name, email, dept || '', year || '', degree || '', regno || '', phone, org, ticketId, paymentRef || '', screenshotUrl, PENDING_APPROVAL_STATUS, '', '']);
  return res({ success: true, ticketId });
}


// ─── APPROVE PARTICIPANT ────────────────────────────────────────
function approveParticipant(sheet, body) {
  const ticketId = (body.ticketId || '').trim().toUpperCase();
  if (!ticketId) return res({ success: false, message: 'Missing ticketId' });

  const data = sheet.getDataRange().getValues();
  const COL  = getColMap(sheet);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL.TICKET_ID] || '').trim().toUpperCase() === ticketId) {
      if (norm(row[COL.STATUS]) !== norm(PENDING_APPROVAL_STATUS)) {
        return res({ success: false, message: 'Already processed (' + row[COL.STATUS] + ')' });
      }

      const email = String(row[COL.EMAIL] || '').trim();
      const name  = String(row[COL.NAME] || '').trim();

      if (!email || !email.includes('@')) {
        return res({ success: false, message: 'Invalid or missing email address for this participant.' });
      }

      try {
        // We update the sheet first so the record shows we ATTEMPTED approval
        sheet.getRange(i + 1, COL.STATUS + 1).setValue(APPROVED_STATUS);
        SpreadsheetApp.flush();
        
        // Then send email
        sendTicketEmail(email, name, ticketId, EVENT_NAME, EVENT_DATE, EVENT_VENUE);
        
        return res({ success: true, message: 'Approved and Email Sent' });
      } catch (err) {
        // If email fails, we might want to revert the status or at least let the admin know
        // For now, we revert it to "Email Error" or similar so they can try again or fix the account
        sheet.getRange(i + 1, COL.STATUS + 1).setValue('Email Error');
        console.error('Email failed for ' + email + ': ' + err.message);
        return res({ success: false, message: 'Status updated to Approved, but Email Failed: ' + err.message });
      }
    }
  }
  return res({ success: false, message: 'Ticket not found' });
}

// ─── CHECK STATUS ───────────────────────────────────────────────
function handleCheckStatus(sheet, params) {
  const ticketId = (params.ticketId || '').trim().toUpperCase();
  if (!ticketId) return res({ success: false, message: 'Missing Ticket ID' });

  const data = sheet.getDataRange().getValues();
  const COL  = getColMap(sheet);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL.TICKET_ID] || '').trim().toUpperCase() === ticketId) {
      return res({ 
        success: true, 
        name: row[COL.NAME],
        status: row[COL.STATUS],
        found: true 
      });
    }
  }
  return res({ success: true, found: false, message: 'Ticket ID not found' });
}

// ─── GET PENDING LIST ───────────────────────────────────────────
function getPendingApprovals(sheet) {
  const data = sheet.getDataRange().getValues();
  const COL  = getColMap(sheet);
  const pending = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (norm(row[COL.STATUS]) === norm(PENDING_APPROVAL_STATUS)) {
      pending.push({ timestamp: row[COL.TIMESTAMP], name: row[COL.NAME], email: row[COL.EMAIL], phone: row[COL.PHONE], org: row[COL.ORG], ticketId: row[COL.TICKET_ID], paymentRef: row[COL.PAYMENT_REF], screenshot: row[COL.SCREENSHOT], dept: row[COL.DEPT], year: row[COL.YEAR], degree: row[COL.DEGREE], regno: row[COL.REG_NO] });
    }
  }
  return res({ success: true, pending });
}

// ─── DRIVE HELPER ───────────────────────────────────────────────
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}

// ─── CHECK IN ───────────────────────────────────────────────────
function handleCheckin(sheet, body) {
  const ticketId = (body.ticketId || '').trim().toUpperCase();
  if (!ticketId) return res({ success: false, message: 'Missing ticketId' });

  const data = sheet.getDataRange().getValues();
  const COL  = getColMap(sheet);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[COL.TICKET_ID] || '').trim().toUpperCase() === ticketId) {
      if (norm(row[COL.STATUS]) === norm(CHECKED_IN_STATUS)) return res({ success: false, reason: 'already_checked_in', time: String(row[COL.CHECKIN_TIME]) });

      sheet.getRange(i + 1, COL.STATUS + 1).setValue(CHECKED_IN_STATUS);
      sheet.getRange(i + 1, COL.CHECKIN_TIME + 1).setValue(new Date());
      SpreadsheetApp.flush(); 
      return res({ success: true });
    }
  }
  return res({ success: false, reason: 'not_found', message: 'Ticket ID not found' });
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
function getAdminDashboardData(sheet, user, pass) {
  const u = (user || '').trim().toLowerCase();
  const p = (pass || '').trim().toLowerCase();
  if (u !== 'hexaadmin' || p !== 'password') return res({ success: false, message: 'Invalid Username or Password' });

  const data = sheet.getDataRange().getValues();
  const COL  = getColMap(sheet);
  const members = [];
  let stats = { total: 0, pending: 0, approved: 0, checkedIn: 0 };

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[COL.STATUS] || '').trim();
    const normalized = norm(status);
    
    stats.total++;
    if (normalized === norm(PENDING_APPROVAL_STATUS)) stats.pending++;
    else if (normalized === norm(APPROVED_STATUS)) stats.approved++;
    else if (normalized === norm(CHECKED_IN_STATUS)) stats.checkedIn++;

    members.push({ timestamp: row[COL.TIMESTAMP], name: row[COL.NAME], email: row[COL.EMAIL], phone: row[COL.PHONE], org: row[COL.ORG], ticketId: row[COL.TICKET_ID], status: status, dept: row[COL.DEPT] || '', year: row[COL.YEAR] || '', degree: row[COL.DEGREE] || '', regno: row[COL.REG_NO] || '', paymentRef: row[COL.PAYMENT_REF] || '', screenshot: row[COL.SCREENSHOT] || '' });
  }
  return res({ success: true, stats, members: members.reverse() });
}
