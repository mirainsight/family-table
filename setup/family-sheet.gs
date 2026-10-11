/**
 * Backing store for the family table.
 *
 * Every value this script handles is ciphertext produced in a family member's
 * browser from the family passcode. The script cannot read a note or a photo,
 * and neither can anyone who opens the sheet.
 *
 * Saves need a write token, which the page derives from the passcode. The
 * first save this script ever receives sets the token; after that only a
 * browser that knows the passcode can add, change or remove a row.
 *
 * To deploy:
 *   1. Make a Google Sheet. Extensions > Apps Script.
 *   2. Replace everything in Code.gs with this file, and save.
 *   3. Deploy > New deployment > Web app.
 *        Execute as:      Me
 *        Who has access:  Anyone
 *   4. Copy the /exec URL into endpoint in config.js.
 *
 * Re-deploying after an edit needs Deploy > Manage deployments > edit >
 * Version: New version, or the old code keeps serving.
 *
 * To change the passcode: delete every row under the header in the "notes"
 * tab, then Project Settings > Script Properties > delete WRITE_TOKEN. The
 * next save sets the new one. (The notes need loading again afterwards.)
 */

var SHEET_NAME = 'notes';
var MAX_VALUE = 45000;   // a cell holds 50,000 characters; sealed photos run to about 25,000
var MAX_ROWS = 500;

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['key', 'sealed', 'updated']);
  }
  return sh;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rowFor_(sh, key) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var keys = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) return i + 2;
  }
  return -1;
}

/* Trust on first use: whoever saves first chose the passcode. */
function tokenOk_(token) {
  if (!/^[0-9a-f]{64}$/.test(token)) return false;
  var props = PropertiesService.getScriptProperties();
  var saved = props.getProperty('WRITE_TOKEN');
  if (!saved) {
    props.setProperty('WRITE_TOKEN', token);
    return true;
  }
  return saved === token;
}

function doGet() {
  var sh = sheet_();
  var last = sh.getLastRow();
  var rows = [];
  if (last > 1) {
    sh.getRange(2, 1, last - 1, 2).getValues().forEach(function (r) {
      if (r[0]) rows.push({ k: String(r[0]), v: String(r[1]) });
    });
  }
  return json_({ rows: rows });
}

function doPost(e) {
  /* One writer at a time, so two people saving at once cannot land on the
     same row number and clobber each other. */
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'busy' });
  }

  try {
    var body = JSON.parse(e.postData.contents);
    if (!tokenOk_(String(body.t || ''))) return json_({ ok: false, error: 'denied' });

    var key = String(body.k || '');
    if (!/^[pdf]:[A-Za-z0-9_-]{1,40}$/.test(key)) return json_({ ok: false, error: 'bad key' });

    var sh = sheet_();
    var at = rowFor_(sh, key);

    if (body.op === 'del') {
      if (at > 0) sh.deleteRow(at);
      return json_({ ok: true });
    }

    var value = String(body.v || '');
    if (!value || value.length > MAX_VALUE) return json_({ ok: false, error: 'bad value' });
    if (at < 0 && sh.getLastRow() > MAX_ROWS) return json_({ ok: false, error: 'full' });

    if (at > 0) sh.getRange(at, 2, 1, 2).setValues([[value, new Date()]]);
    else sh.appendRow([key, value, new Date()]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
