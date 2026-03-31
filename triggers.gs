// ═══════════════════════════════════════════════════════════════
//  DRONEXPERIENCE — SPREADSHEET TRIGGERS (DROPDOWN EDITION)
// ═══════════════════════════════════════════════════════════════

/**
 * Detects dropdown/chip selection in the Status column.
 * Renamed to handleApproval to avoid conflicts with simple triggers.
 */
function handleApproval(e) {
  const range = e.range;
  const sheet = range.getSheet();
  
  const COL_STATUS = 9; // Column I (Status)
  
  if (sheet.getName() !== SHEET_NAME) return;
  if (range.getColumn() !== COL_STATUS) return;
  
  const newValue = String(e.value).trim();
  const oldValue = String(e.oldValue).trim();
  
  // 🎟️ TRIGGER: If selection contains "Approve" (case-insensitive)
  const isApproving = newValue.toLowerCase().includes('approve');
  
  if (isApproving) {
    // Safety check: Don't re-send if it's already 'Not Yet' or 'Yes'
    if (oldValue.toLowerCase().includes('not yet') || oldValue.toLowerCase().includes('yes')) {
      return; 
    }

    const row = range.getRow();
    const data = sheet.getRange(row, 1, 1, 11).getValues()[0];
    
    const COL = { NAME: 1, EMAIL: 2, TICKET_ID: 5 };
    const ticketId = data[COL.TICKET_ID];
    const email    = data[COL.EMAIL];
    const name     = data[COL.NAME];

    if (!ticketId || !email) return;

    try {
      // Set to 'Approved' (Standard scanning status)
      sheet.getRange(row, COL_STATUS).setValue(APPROVED_STATUS);
      
      // Send the QR Ticket email (Calls from Code.gs)
      sendTicketEmail(email, name, ticketId, EVENT_NAME, EVENT_DATE, EVENT_VENUE);
      
      SpreadsheetApp.getActiveSpreadsheet().toast(`🎟️ Ticket sent to ${name}`, 'Success!');
    } catch (err) {
      SpreadsheetApp.getUi().alert('Email Error: ' + err.message);
    }
  }
}
