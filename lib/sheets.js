const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'List Family Haji Zakaria (Size Baju)';

const HEADER_NAMA = 'nama';
const HEADER_SIZE = 'size baju';
const HEADER_CATATAN = 'catatan';

/**
 * Env var UIs (Vercel included) are inconsistent about how a pasted
 * multi-line PEM key ends up stored: sometimes with literal "\n"
 * sequences, sometimes with real newlines, and it's an easy mistake to
 * paste the wrapping quotes from .env.example in as literal characters.
 * Normalize all of those instead of being fragile to one exact format.
 */
function normalizePrivateKey(raw) {
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  return key.replace(/\\n/g, '\n');
}

function getSheetsClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY environment variables.');
  }
  if (!SHEET_ID) {
    throw new Error('Missing GOOGLE_SHEET_ID environment variable.');
  }

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  return google.sheets({ version: 'v4', auth });
}

function colToLetter(col) {
  let letter = '';
  while (col > 0) {
    const rem = (col - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    col = Math.floor((col - 1) / 26);
  }
  return letter;
}

/**
 * Scans the first 10 rows for the row containing both "Nama" and
 * "Size Baju" headers (case-insensitive), so this keeps working even if
 * rows are inserted above the table.
 */
async function findHeader(sheets) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_TAB}'!A1:Z10`
  });
  const rows = res.data.values || [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r].map((v) => String(v || '').trim().toLowerCase());
    const namaCol = row.indexOf(HEADER_NAMA);
    const sizeCol = row.indexOf(HEADER_SIZE);
    if (namaCol !== -1 && sizeCol !== -1) {
      return {
        headerRow: r + 1, // 1-indexed sheet row
        namaCol: namaCol + 1, // 1-indexed sheet column
        sizeCol: sizeCol + 1,
        catatanCol: row.indexOf(HEADER_CATATAN) + 1 // 0 (falsy) if absent
      };
    }
  }
  throw new Error('Could not find a header row with "Nama" and "Size Baju" columns.');
}

/**
 * Names in the Nama column, for populating the form's dropdown so people
 * pick their existing row instead of typing a name that might not match.
 */
async function getNames() {
  const sheets = getSheetsClient();
  const header = await findHeader(sheets);
  const col = colToLetter(header.namaCol);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_TAB}'!${col}${header.headerRow + 1}:${col}`
  });
  const rows = res.data.values || [];
  return rows.map((r) => String(r[0] || '').trim()).filter(Boolean);
}

/**
 * Finds the row matching `name` and writes `size` into Size Baju
 * (and `catatan`, if provided, into CATATAN).
 */
async function submitSize(name, size, catatan) {
  name = (name || '').trim();
  size = (size || '').trim();
  catatan = (catatan || '').trim();

  if (!name) throw new Error('Please choose a name.');
  if (!size) throw new Error('Please select a size.');

  const sheets = getSheetsClient();
  const header = await findHeader(sheets);
  const namaCol = colToLetter(header.namaCol);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_TAB}'!${namaCol}${header.headerRow + 1}:${namaCol}`
  });
  const rows = res.data.values || [];

  const idx = rows.findIndex((r) => String(r[0] || '').trim().toLowerCase() === name.toLowerCase());
  if (idx === -1) {
    throw new Error(`Could not find "${name}" in the Nama column.`);
  }
  const rowNumber = header.headerRow + 1 + idx;

  const data = [
    {
      range: `'${SHEET_TAB}'!${colToLetter(header.sizeCol)}${rowNumber}`,
      values: [[size]]
    }
  ];
  if (catatan && header.catatanCol) {
    data.push({
      range: `'${SHEET_TAB}'!${colToLetter(header.catatanCol)}${rowNumber}`,
      values: [[catatan]]
    });
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'USER_ENTERED', data }
  });

  return { status: 'updated', name, size };
}

module.exports = { getNames, submitSize };
