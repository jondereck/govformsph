# PDS PDF Import Design

**Date:** 2026-10-23  
**Status:** Draft for implementation planning  
**App:** GovFormsPH (offline CS Form No. 212 / PDS builder)

## Problem

Export & Import today restores **GovFormsPH JSON backups only** (`.json` / encrypted vault). Users who already have a filled **official Personal Data Sheet file** — the CS Form 212 fillable PDF (`pds.pdf`) — cannot load it. They have to retype.

JSON single-form export (`pds-<surname>-<date>.json`) already imports. This spec adds the **official fillable PDS PDF**, not a second JSON format.

## Goal

On the Export & Import page, a user can select a filled **CS Form No. 212 (Revised 2026) fillable PDF**. GovFormsPH reads its AcroForm fields in the browser, maps them onto a new `PdsRecord`, and restores that draft into IndexedDB so the user can edit, print, or export as usual.

## In scope

- Client-side import of a filled official CS Form 212 Revised 2026 AcroForm PDF.
- Reuse the existing `fieldMap.acroFields` table in `src/pdfExport/fieldMap-csc2122016-c1.js` (same names export already writes).
- Inverse of `getRecordValueByKey` so mapped keys round-trip: set then get returns the same value for supported keys.
- Detect JSON vs PDF from the selected file; keep current JSON / encrypted-vault restore unchanged.
- Preview before restore: person name, imported field count, explicit limitations.
- PDF import always **merges a new PDS draft**. It must not offer Replace-all (that mode is for full JSON backups).
- Vitest unit tests for mapping, PDF field extraction, template detection, and import routing.

## Out of scope

- OCR / scanned photos / printed PDFs / flattened PDFs (including PDFs produced by the current GovFormsPH print/export, which calls `form.flatten()`).
- Excel, Word, or agency-custom PDS templates.
- CS Form 212 Revised 2017 or other revisions.
- SALN PDF import.
- Work Experience Sheet duties (`wesDetails`) — those fields are not on the PDS PDF.
- Passport photo, signature, and thumbmark images (drawn on the page, not reliable AcroForm values).
- Changing PDF export to skip flattening so GovFormsPH-printed PDFs can round-trip. That is a separate feature.

## User-visible flow

1. User opens Export & Import.
2. Import dropzone accepts `.pdf` in addition to `.json` / `.vault`.
3. If the file is a PDF:
   - Load bytes with `pdf-lib` in the browser (no network).
   - If the PDF is password-encrypted: error, ask the user to unlock it in another app first.
   - If there is no AcroForm: error explaining flattened/scanned files cannot be imported; JSON backup or retyping is required.
   - If AcroForm exists but sentinel fields `c1_surname`, `c1_firstname`, and `c1_birthdate` are missing: error that this is not a recognized CS Form 212 (Revised 2026) template.
   - If the template is recognized but every mapped field is empty: error that the PDF looks blank.
   - Otherwise show preview and **Create PDS draft from PDF**.
4. Restore uses existing `restoreRecords(..., 'merge')` so other drafts stay.

## Mapping rules

- Start from `createNewPdsRecord()`.
- For each `appDataKey → pdfFieldName` in `fieldMap.acroFields`, if the PDF has that field and a non-empty value, call `setRecordValueByKey(record, appDataKey, value)`.
- Do **not** rewrite `fieldMap` entries in this feature, even if names look swapped or truncated (`c2_work_status_01` vs salary, `c1_children_dob_0`, `c2_cse_0`). Import must follow the same table export uses.
- Checkbox groups (sex, civil status, citizenship, dual-citizenship mode, background Y/N): only apply **checked = true**. Unchecked does not clear a value already set by a sibling checkbox.
- Background Y and N: `*_y` checked → `answer === true`; `*_n` checked → `answer === false`.
- Work experience `inclusiveDatesTo` of `PRESENT` / `Present` / `present` → `isPresent: true` and empty `inclusiveDatesTo`.
- Work experience `isGovernmentService`: `Y` / `Yes` / `YES` → `true`; `N` / `No` / `NO` → `false`.
- `declaration_dateAndPlaceOfIssuance`: split on the first comma into `dateOfIssuance` and `placeOfIssuance`.
- Dates: if the string is `yyyy-mm-dd`, convert with `formatDateToDMY`. Other strings are stored as-is (user can fix in the editor).
- Indexed rows (`children_01_…`, `eligibility_07_…`, etc.) grow the array to that index using the existing empty-row factories. After mapping, drop trailing fully empty extra rows, keeping at least one empty row when the list is used as a dynamic editor list (same as a new draft).
- Education PDF keys without an index (`college_nameOfSchool`, …) write `education.college[0]` (and the same for vocational). Extra college/graduate rows beyond what the PDF template maps are not invented.
- After address mapping, if every permanent-address field equals the corresponding residential field and at least one residential field is non-empty, set `sameAsResidentialAddress: true`.
- Default `personalInfo.citizenship` stays `'Filipino'` unless the PDF checks dual citizenship.

## Warnings always shown on a successful PDF preview

1. Photo, signature, and thumbmark are not imported.
2. Work Experience Sheet duties are not on the PDS PDF.
3. Review every section before using the draft for an official submission.

## Privacy

No upload, no new network calls, no new third-party services. Parsing stays in the browser with the existing `pdf-lib` dependency.

## Success criteria

- A filled official CS Form 212 (Revised 2026) fillable PDF creates one new PDS draft whose personal info, family, education (mapped rows), eligibility, work experience (mapped rows), L&D, voluntary work, other info, background questions, references, and government-ID text match the PDF fields in `fieldMap.acroFields`.
- Existing JSON backup import still works, including encrypted vaults.
- Flattened / scanned PDFs fail with a clear error, not a corrupt draft.
- All new behavior is covered by Vitest tests listed in the implementation plan.
