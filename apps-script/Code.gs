/**
 * T-Shirt size collection web app.
 *
 * This script is bound to the "SIZE BAJU FAMILY DAY..." Google Sheet
 * (Extensions > Apps Script). It serves a mobile-friendly form and writes
 * the selected size into the "Size Baju" column for the matching name.
 */

// Name of the sheet tab to update. Falls back to the active sheet if not found.
const SHEET_NAME = 'List Family Haji Zakaria (Size Baju)';

// Header text we look for (case-insensitive) to locate each column.
const HEADER_NAMA = 'nama';
const HEADER_SIZE = 'size baju';
const HEADER_CATATAN = 'catatan';
const HEADER_PAID_TSHIRT = 'dah bayar tshirt';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('T-Shirt Size Form')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

/**
 * Scans the first few rows for the header row (the row containing "Nama"
 * and "Size Baju"), and returns its 1-indexed row number plus a map of
 * column letters -> 1-indexed column numbers.
 */
function findHeader_(sheet) {
  const maxScanRows = Math.min(10, sheet.getLastRow());
  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, maxScanRows, lastCol).getValues();

  for (let r = 0; r < values.length; r++) {
    const row = values[r].map(function (v) { return String(v).trim().toLowerCase(); });
    const namaCol = row.indexOf(HEADER_NAMA);
    const sizeCol = row.indexOf(HEADER_SIZE);
    if (namaCol !== -1 && sizeCol !== -1) {
      return {
        headerRow: r + 1,
        namaCol: namaCol + 1,
        sizeCol: sizeCol + 1,
        catatanCol: row.indexOf(HEADER_CATATAN) + 1, // 0 (falsy) if not found
        paidTshirtCol: row.indexOf(HEADER_PAID_TSHIRT) + 1
      };
    }
  }
  throw new Error('Could not find a header row with "Nama" and "Size Baju" columns.');
}

/**
 * Returns the list of names in the Nama column, for populating the
 * form's dropdown so people pick their existing row instead of typing
 * a name that might not match. Each entry also flags whether that row's
 * Size Baju is already filled (a "sudah diisi" indicator) and whether
 * Dah Bayar TShirt is checked (a "sudah bayar" money indicator).
 */
function getNames() {
  const sheet = getSheet_();
  const header = findHeader_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow <= header.headerRow) return [];

  const numRows = lastRow - header.headerRow;
  const namaValues = sheet.getRange(header.headerRow + 1, header.namaCol, numRows, 1).getValues();
  const sizeValues = sheet.getRange(header.headerRow + 1, header.sizeCol, numRows, 1).getValues();
  const paidValues = header.paidTshirtCol
    ? sheet.getRange(header.headerRow + 1, header.paidTshirtCol, numRows, 1).getValues()
    : null;

  const result = [];
  for (let i = 0; i < namaValues.length; i++) {
    const name = String(namaValues[i][0]).trim();
    if (!name) continue;
    result.push({
      name: name,
      filled: String(sizeValues[i][0]).trim().length > 0,
      paid: paidValues ? paidValues[i][0] === true : false
    });
  }
  return result;
}

/**
 * Finds the row matching `name` and writes `size` into Size Baju
 * (and `catatan`, if provided, into CATATAN).
 */
function submitSize(name, size, catatan) {
  name = (name || '').trim();
  size = (size || '').trim();
  catatan = (catatan || '').trim();

  if (!name) throw new Error('Please choose a name.');
  if (!size) throw new Error('Please select a size.');

  const sheet = getSheet_();
  const header = findHeader_(sheet);
  const lastRow = sheet.getLastRow();

  const namaValues = sheet
    .getRange(header.headerRow + 1, header.namaCol, lastRow - header.headerRow, 1)
    .getValues();

  for (let i = 0; i < namaValues.length; i++) {
    const cellName = String(namaValues[i][0]).trim();
    if (cellName && cellName.toLowerCase() === name.toLowerCase()) {
      const row = header.headerRow + 1 + i;
      sheet.getRange(row, header.sizeCol).setValue(size);
      if (catatan && header.catatanCol) {
        sheet.getRange(row, header.catatanCol).setValue(catatan);
      }
      return { status: 'updated', name: cellName, size: size };
    }
  }

  throw new Error('Could not find "' + name + '" in the Nama column.');
}
