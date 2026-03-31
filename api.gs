/**
 * ============================================================
 *  WORKSHOP TICKET SCANNER — Web App API
 * ============================================================
 *  This Google Apps Script serves as the backend API for the
 *  scanner web app. It handles:
 *    - GET  requests: Look up a participant by Ticket ID
 *    - POST requests: Mark a participant as checked-in
 *
 *  DEPLOYMENT:
 *  1. Paste this code into the same Apps Script project
 *     (or a new file inside the same project).
 *  2. Deploy > New deployment > Web app
 *       Execute as: Me
 *       Who has access: Anyone
 *  3. Copy the Web App URL — use it in the scanner frontend.
 * ============================================================
 */

// ── Configuration (must match triggers.gs) ─────────────────────
const API_SHEET_NAME = "Form Responses 1";

const API_COL = {
  TIMESTAMP:      1,
  FULL_NAME:      2,
  EMAIL:          3,
  PHONE:          4,
  ORGANIZATION:   5,
  PAYMENT_STATUS: 6,
  TICKET_ID:      7,
  QR_SENT:        8,
  CHECKIN_STATUS:  9,
  CHECKIN_TIME:   10,
  CHECKED_IN_BY:  11
};

/**
 * GET handler — Looks up a participant by ticketId.
 * Usage: ?action=lookup&ticketId=WKSHP-0001
 */
function doGet(e) {
  const params = e.parameter;
  const action = params.action || "lookup";

  if (action === "lookup") {
    return lookupTicket(params.ticketId);
  }

  return jsonResponse({ status: "error", message: "Unknown action: " + action });
}

/**
 * POST handler — Updates check-in status.
 * Body: { action: "checkin", ticketId: "WKSHP-0001", volunteerName: "Alice" }
 */
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ status: "error", message: "Invalid JSON body." });
  }

  const action = body.action || "checkin";

  if (action === "checkin") {
    return checkinTicket(body.ticketId, body.volunteerName);
  }

  return jsonResponse({ status: "error", message: "Unknown action: " + action });
}

/**
 * Look up a ticket by ID and return participant info.
 */
function lookupTicket(ticketId) {
  if (!ticketId) {
    return jsonResponse({ status: "error", message: "Missing ticketId parameter." });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(API_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ status: "error", message: "Sheet not found." });
  }

  const data = sheet.getDataRange().getValues();

  // Search for the ticket (skip header row)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[API_COL.TICKET_ID - 1] === ticketId) {
      return jsonResponse({
        status: "success",
        data: {
          fullName:       row[API_COL.FULL_NAME - 1],
          email:          row[API_COL.EMAIL - 1],
          phone:          row[API_COL.PHONE - 1],
          organization:   row[API_COL.ORGANIZATION - 1],
          paymentStatus:  row[API_COL.PAYMENT_STATUS - 1],
          ticketId:       row[API_COL.TICKET_ID - 1],
          checkinStatus:  row[API_COL.CHECKIN_STATUS - 1] || "Not Yet",
          checkinTime:    row[API_COL.CHECKIN_TIME - 1] ? row[API_COL.CHECKIN_TIME - 1].toString() : "",
          checkedInBy:    row[API_COL.CHECKED_IN_BY - 1] || ""
        }
      });
    }
  }

  return jsonResponse({ status: "not_found", message: "Ticket ID '" + ticketId + "' not found." });
}

/**
 * Mark a ticket as checked-in.
 */
function checkinTicket(ticketId, volunteerName) {
  if (!ticketId) {
    return jsonResponse({ status: "error", message: "Missing ticketId." });
  }
  if (!volunteerName) {
    return jsonResponse({ status: "error", message: "Missing volunteerName." });
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(API_SHEET_NAME);
  if (!sheet) {
    return jsonResponse({ status: "error", message: "Sheet not found." });
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[API_COL.TICKET_ID - 1] === ticketId) {
      const sheetRow = i + 1; // 1-based

      // Check if already checked in
      const currentStatus = row[API_COL.CHECKIN_STATUS - 1];
      if (currentStatus === "Checked In") {
        return jsonResponse({
          status: "already_checked_in",
          message: "This ticket has already been checked in.",
          data: {
            fullName:      row[API_COL.FULL_NAME - 1],
            checkinTime:   row[API_COL.CHECKIN_TIME - 1] ? row[API_COL.CHECKIN_TIME - 1].toString() : "",
            checkedInBy:   row[API_COL.CHECKED_IN_BY - 1]
          }
        });
      }

      // Use LockService to prevent simultaneous writes to the same row
      const lock = LockService.getScriptLock();
      try {
        lock.waitLock(10000); // wait up to 10 seconds
      } catch (err) {
        return jsonResponse({ status: "error", message: "Server busy. Please try again." });
      }

      try {
        // Re-read the row to double-check (race condition guard)
        const freshStatus = sheet.getRange(sheetRow, API_COL.CHECKIN_STATUS).getValue();
        if (freshStatus === "Checked In") {
          return jsonResponse({
            status: "already_checked_in",
            message: "This ticket was just checked in by another volunteer.",
            data: {
              fullName:    row[API_COL.FULL_NAME - 1],
              checkinTime: sheet.getRange(sheetRow, API_COL.CHECKIN_TIME).getValue().toString(),
              checkedInBy: sheet.getRange(sheetRow, API_COL.CHECKED_IN_BY).getValue()
            }
          });
        }

        const now = new Date();
        sheet.getRange(sheetRow, API_COL.CHECKIN_STATUS).setValue("Checked In");
        sheet.getRange(sheetRow, API_COL.CHECKIN_TIME).setValue(now.toLocaleString());
        sheet.getRange(sheetRow, API_COL.CHECKED_IN_BY).setValue(volunteerName);
      } finally {
        lock.releaseLock();
      }

      return jsonResponse({
        status: "success",
        message: "Check-in successful!",
        data: {
          fullName:      row[API_COL.FULL_NAME - 1],
          organization:  row[API_COL.ORGANIZATION - 1],
          paymentStatus: row[API_COL.PAYMENT_STATUS - 1],
          ticketId:      ticketId
        }
      });
    }
  }

  return jsonResponse({ status: "not_found", message: "Ticket ID '" + ticketId + "' not found." });
}

/**
 * Utility: Return a JSON response from the web app.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
