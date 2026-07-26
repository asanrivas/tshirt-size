# Size Baju Family Day Form

A mobile-friendly form that lets each family member pick their name and
t-shirt size, and writes it straight into the "Size Baju" column of the
[Size Baju Family Haji Zakaria 2026](https://docs.google.com/spreadsheets/u/0/d/1d3KJ2U3I8AtFCjaT6EIYXcdiCBR7XstygaPII5Fc3cY)
Google Sheet — matched by name.

There are two ways to run it. Pick one.

## Option A: Vercel (hosted app, custom URL)

Files: `index.html`, `api/names.js`, `api/submit.js`, `lib/sheets.js`,
`package.json`.

The frontend is static HTML/JS; the two `/api` routes are Vercel
serverless functions that call the Google Sheets API directly using a
service account (no Google login needed by the people filling the form).

### 1. Create a Google service account

1. In the [Google Cloud Console](https://console.cloud.google.com/),
   create (or pick) a project, then enable the **Google Sheets API**.
2. **IAM & Admin > Service Accounts > Create service account.** Any name
   is fine (e.g. `tshirt-form`). No roles needed at the project level.
3. Open the new service account > **Keys > Add key > Create new key >
   JSON**. This downloads a JSON file — keep it private, it's a
   credential.
4. From that JSON, you'll need two values: `client_email` and
   `private_key`.

### 2. Share the Sheet with the service account

Open the Google Sheet, click **Share**, and add the service account's
`client_email` as an **Editor**. Without this the API calls will fail
with a permissions error.

### 3. Deploy to Vercel

1. Push this repo to GitHub (already done if you're reading this from
   the repo) and import it in [vercel.com](https://vercel.com/new).
2. In the project's **Settings > Environment Variables**, add:
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` — the `client_email` from the JSON key
   - `GOOGLE_PRIVATE_KEY` — the `private_key` from the JSON key, pasted
     as-is (Vercel's env var UI handles the embedded newlines fine)
   - `GOOGLE_SHEET_ID` — `1d3KJ2U3I8AtFCjaT6EIYXcdiCBR7XstygaPII5Fc3cY`
   - `GOOGLE_SHEET_TAB` — `List Family Haji Zakaria (Size Baju)` (only
     needed if you rename the tab; this is already the default)
3. Deploy. Vercel auto-detects the `api/` folder as serverless functions
   and serves `index.html` as the static site — no build step needed.
4. Share the resulting `https://<your-project>.vercel.app` URL.

See `.env.example` for the same variables, useful for local testing with
the [Vercel CLI](https://vercel.com/docs/cli) (`vercel dev`).

### How matching works

- `lib/sheets.js` scans the first 10 rows of the sheet tab for the row
  containing both `Nama` and `Size Baju` headers, so it keeps working
  even if rows are inserted above the table.
- `GET /api/names` returns the `Nama` column so the form can offer a
  dropdown instead of free-text name entry (family nicknames like
  "K.Ngah" or "Mak Long" are easy to mistype).
- `POST /api/submit` finds the row with a matching name and writes that
  row's `Size Baju` cell (and `CATATAN`, if a note was entered). It does
  not touch the `Dewasa` / `Kanak2` checkboxes — those are already set.

## Option B: Google Apps Script (no external hosting)

Files: `apps-script/Code.gs`, `apps-script/index.html`,
`apps-script/appsscript.json`.

Same form and matching logic, but bound directly to the Sheet and
running under your Google account — no service account, no hosting
provider, no environment variables. Trade-off: deploying/redeploying is
done by hand in the Apps Script editor rather than a `git push`.

1. Open the Google Sheet.
2. **Extensions > Apps Script**.
3. Delete the default `Code.gs` content and paste in
   `apps-script/Code.gs`.
4. **File > New > HTML file**, name it exactly `index`, and paste in
   `apps-script/index.html`.
5. Click the gear icon (**Project Settings**) and check "Show
   `appsscript.json` manifest file in editor". Open it and replace its
   contents with `apps-script/appsscript.json`.
6. **Deploy > New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
7. Click **Deploy**, authorize the script when prompted, and copy the
   web app URL to share.

If you edit the script later, use **Deploy > Manage deployments > New
version** so the live URL picks up the changes.
