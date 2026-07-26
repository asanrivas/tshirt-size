# Size Baju Family Day Form

A mobile-friendly form that lets each family member pick their name and
t-shirt size, and writes it straight into the "Size Baju" column of the
[Size Baju Family Haji Zakaria 2026](https://docs.google.com/spreadsheets/u/0/d/1d3KJ2U3I8AtFCjaT6EIYXcdiCBR7XstygaPII5Fc3cY)
Google Sheet — no separate database, API keys, or backend needed.

It's built as a Google Apps Script **bound** to that sheet, so it runs
under your own Google account.

## Files

- `Code.gs` — server-side logic: serves the form, looks up the matching
  row by name, and writes the size (and optional notes) back to the sheet.
- `index.html` — the mobile-friendly form UI.
- `appsscript.json` — Apps Script project manifest.

## How matching works

- The script scans the first 10 rows of the sheet's "List Family Haji
  Zakaria (Size Baju)" tab for the row containing both `Nama` and `Size
  Baju` headers, so it keeps working even if rows are inserted above it.
- The form's name dropdown is populated live from the `Nama` column, so
  people pick their existing row instead of typing a name that might not
  match (nicknames like "K.Ngah" or "Mak Long" are easy to mistype).
- On submit, it finds the row with a matching name and sets that row's
  `Size Baju` cell. If a note is entered, it also sets the `CATATAN` cell.
- It does **not** touch the `Dewasa` / `Kanak2` checkboxes — those are
  already filled in.

## Setup (one-time)

1. Open the Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste in this repo's `Code.gs`.
4. **File > New > HTML file**, name it exactly `index`, and paste in this
   repo's `index.html`.
5. Click the gear icon (**Project Settings**) and check "Show
   `appsscript.json` manifest file in editor". Open it and replace its
   contents with this repo's `appsscript.json`.
6. **Deploy > New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with the link** (or "Anyone within
     [your org]" if you'd rather restrict it to family with a Google
     Workspace account)
7. Click **Deploy**, authorize the script when prompted, and copy the
   web app URL.
8. Share that URL with the family (e.g. via WhatsApp) — it opens as a
   mobile-friendly page.

## Updating after changes

If you edit `Code.gs` or `index.html` later, go back to **Deploy >
Manage deployments**, edit the existing deployment, and select
**New version** so the live URL picks up the changes.
