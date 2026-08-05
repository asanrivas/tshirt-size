const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'List Family Haji Zakaria (Size Baju)';

const HEADER_NAMA = 'nama';
const HEADER_SIZE = 'size baju';
const HEADER_CATATAN = 'catatan';
const HEADER_KETUA = 'ketua_family';
const HEADER_FAMILY_ID = 'family_id';
const HEADER_TOTAL_TSHIRT = 'total tshirt perfamily';
const HEADER_TOTAL_MAKANAN = 'total makanan perfamily';
const HEADER_PAID_TSHIRT = 'dah bayar tshirt';

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

/**
 * Prefer GOOGLE_PRIVATE_KEY_BASE64 when set: a base64 string has no
 * newlines, quotes, or escape sequences for a paste into an env var UI
 * to mangle, so it sidesteps the PEM-formatting issues normalizePrivateKey
 * works around.
 */
function resolvePrivateKey() {
  if (process.env.GOOGLE_PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.GOOGLE_PRIVATE_KEY_BASE64.trim(), 'base64').toString('utf8');
  }
  if (process.env.GOOGLE_PRIVATE_KEY) {
    return normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  }
  return null;
}

function getSheetsClient() {
  const privateKey = resolvePrivateKey();
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !privateKey) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY (or GOOGLE_PRIVATE_KEY_BASE64) environment variables.'
    );
  }
  if (!SHEET_ID) {
    throw new Error('Missing GOOGLE_SHEET_ID environment variable.');
  }

  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    privateKey,
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
        catatanCol: row.indexOf(HEADER_CATATAN) + 1, // 0 (falsy) if absent
        ketuaCol: row.indexOf(HEADER_KETUA) + 1,
        familyIdCol: row.indexOf(HEADER_FAMILY_ID) + 1,
        totalTshirtCol: row.indexOf(HEADER_TOTAL_TSHIRT) + 1,
        totalMakananCol: row.indexOf(HEADER_TOTAL_MAKANAN) + 1,
        paidTshirtCol: row.indexOf(HEADER_PAID_TSHIRT) + 1
      };
    }
  }
  throw new Error('Could not find a header row with "Nama" and "Size Baju" columns.');
}

/**
 * Names in the Nama column, for populating the form's dropdown so people
 * pick their existing row instead of typing a name that might not match.
 * Each entry also flags whether that row's Size Baju is already filled
 * (a "sudah diisi" indicator) and whether Dah Bayar TShirt is checked
 * (a "sudah bayar" money indicator).
 */
async function getNames() {
  const sheets = getSheetsClient();
  const header = await findHeader(sheets);
  const namaCol = colToLetter(header.namaCol);
  const sizeCol = colToLetter(header.sizeCol);

  const requests = [
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TAB}'!${namaCol}${header.headerRow + 1}:${namaCol}`
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TAB}'!${sizeCol}${header.headerRow + 1}:${sizeCol}`
    })
  ];
  if (header.paidTshirtCol) {
    const paidCol = colToLetter(header.paidTshirtCol);
    requests.push(
      sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `'${SHEET_TAB}'!${paidCol}${header.headerRow + 1}:${paidCol}`
      })
    );
  }

  const [namaRes, sizeRes, paidRes] = await Promise.all(requests);

  const namaRows = namaRes.data.values || [];
  const sizeRows = sizeRes.data.values || [];
  const paidRows = (paidRes && paidRes.data.values) || [];

  return namaRows
    .map((r, i) => ({
      name: String(r[0] || '').trim(),
      filled: Boolean(String((sizeRows[i] || [])[0] || '').trim()),
      paid: String((paidRows[i] || [])[0] || '').trim().toUpperCase() === 'TRUE'
    }))
    .filter((entry) => entry.name);
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

/**
 * Per-family T-Shirt + Makanan totals, one row per family (the row where
 * ketua_family is truthy). Reads the columns already computed by the
 * spreadsheet's own SUMPRODUCT formulas rather than recalculating them here.
 */
async function getFamilyReport() {
  const sheets = getSheetsClient();
  const header = await findHeader(sheets);
  if (!header.ketuaCol || !header.totalTshirtCol || !header.totalMakananCol) {
    throw new Error('Sheet is missing ketua_family / Total Tshirt perfamily / Total Makanan perfamily columns.');
  }

  const namaCol = colToLetter(header.namaCol);
  const ketuaCol = colToLetter(header.ketuaCol);
  const familyIdCol = header.familyIdCol ? colToLetter(header.familyIdCol) : null;
  const tshirtCol = colToLetter(header.totalTshirtCol);
  const makananCol = colToLetter(header.totalMakananCol);

  const firstCol = [namaCol, ketuaCol, familyIdCol, tshirtCol, makananCol]
    .filter(Boolean)
    .sort()[0];
  const lastCol = [namaCol, ketuaCol, familyIdCol, tshirtCol, makananCol]
    .filter(Boolean)
    .sort()
    .slice(-1)[0];

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `'${SHEET_TAB}'!${firstCol}${header.headerRow + 1}:${lastCol}`
  });
  const rows = res.data.values || [];

  const colIndex = (letter) => letter.charCodeAt(0) - firstCol.charCodeAt(0);
  const namaIdx = colIndex(namaCol);
  const ketuaIdx = colIndex(ketuaCol);
  const familyIdIdx = familyIdCol ? colIndex(familyIdCol) : -1;
  const tshirtIdx = colIndex(tshirtCol);
  const makananIdx = colIndex(makananCol);

  const parseNum = (v) => {
    const n = parseFloat(String(v || '').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const isTruthy = (v) => {
    const s = String(v || '').trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  };

  const familyRows = rows
    .filter((r) => isTruthy(r[ketuaIdx]))
    .map((r) => ({
      familyId: familyIdIdx !== -1 ? String(r[familyIdIdx] || '').trim() : '',
      ketua: String(r[namaIdx] || '').trim(),
      tshirt: parseNum(r[tshirtIdx]),
      makanan: parseNum(r[makananIdx]),
      total: parseNum(r[tshirtIdx]) + parseNum(r[makananIdx])
    }))
    .sort((a, b) => a.familyId.localeCompare(b.familyId, undefined, { numeric: true }));

  const grandTotal = familyRows.reduce(
    (acc, f) => ({
      tshirt: acc.tshirt + f.tshirt,
      makanan: acc.makanan + f.makanan,
      total: acc.total + f.total
    }),
    { tshirt: 0, makanan: 0, total: 0 }
  );

  return { families: familyRows, grandTotal };
}

module.exports = { getNames, submitSize, getFamilyReport };
