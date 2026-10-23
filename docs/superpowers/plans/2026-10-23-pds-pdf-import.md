# PDS PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to import a filled **CS Form No. 212 (Revised 2026) AcroForm PDF** (including PDFs exported from GovFormsPH or filled in Adobe/Preview) into a new editable `PdsRecord` on the Export & Import page, alongside existing JSON backup import.

**Architecture:** Reuse the existing export `fieldMap` (`src/pdfExport/fieldMap-csc2122016-c1.js`) in reverse: read AcroForm values with `pdf-lib`, map PDF field names → app data keys, then apply values through a new `setRecordValueByKey` helper (mirror of `getRecordValueByKey` in `exportPdsPage1.ts`). Route PDF bytes through a unified `parseImportBlob` entry point; keep JSON path unchanged. Show import preview with warnings for unsupported templates and non-importable assets (photo, drawn signatures).

**Tech Stack:** React 18, TypeScript, Vite, Dexie, `pdf-lib` (already installed), Vitest (to add for unit tests).

## Global Constraints

- Form version target: **`CS-Form-212-2026`** only (`PdsRecord.meta.formVersion`).
- Template field names must match `fieldMap.acroFields` in `src/pdfExport/fieldMap-csc2122016-c1.js` (prefixes `c1_`, `c2_`, `c3_`, `c4_`).
- All processing stays **client-side** in the browser; no uploads to a server.
- Date fields in app data use **`dd/mm/yyyy`** (`PersonalInfo.dateOfBirth`, children DOB, etc.).
- Work experience and L&D rows in the PDF are **sorted by export** before slot assignment; import reads PDF slots **in order** (slot 01 → first array item) without reconstructing sort order.
- **Not in scope:** flat/scanned PDFs (no AcroForm), password-protected PDFs, CSC 212 pre-2026 revisions, SALN PDF import, importing photo/signature/thumbmark images embedded as page drawings (only AcroForm text/checkbox/radio fields).
- Fix unrelated bug while touching field map if needed: `vocationalTrade_nameOfSchool` line uses invalid JS (`'c1_voc_name' ? 'c1_voc_name' : 'N/A'`) — correct to `'c1_voc_name'`.

---

## File structure (summary)

| File | Responsibility |
|------|------------------|
| `src/pdfImport/reverseFieldMap.ts` | Build `pdfFieldName → appDataKey` from `fieldMap.acroFields` |
| `src/pdfImport/normalizePdfText.ts` | Trim, date normalization to `dd/mm/yyyy` where possible |
| `src/pdfImport/setRecordValueByKey.ts` | Write one app key into a mutable `PdsRecord` |
| `src/pdfImport/importPdsFromPdf.ts` | Load PDF, read form fields, produce `PdsRecord` + warnings |
| `src/utils/exportImport.ts` | Add `parseImportBlob`, wire PDF branch |
| `src/pages/ExportImportPage.tsx` | Accept `.pdf`, use `ArrayBuffer`, show PDF-specific copy/warnings |
| `vitest.config.ts`, `package.json` | Test runner |
| `src/pdfImport/importPdsFromPdf.test.ts` | Round-trip and fixture tests |

---

### Task 1: Vitest test harness

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)
- Modify: `tsconfig.json` (include vitest types if needed)

**Interfaces:**
- Consumes: none
- Produces: `npm run test` runs Vitest in Node with `@/` or relative imports from `src/`

- [ ] **Step 1: Add Vitest dev dependency and script**

Modify `package.json`:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^3.0.5"
  }
}
```

Run: `npm install`

Expected: `package-lock.json` updated, `vitest` in `node_modules`.

- [ ] **Step 2: Create minimal Vitest config**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 3: Smoke test**

Create `src/pdfImport/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm run test`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/pdfImport/smoke.test.ts
git commit -m "chore: add vitest for pdf import tests"
```

---

### Task 2: Reverse field map

**Files:**
- Create: `src/pdfImport/reverseFieldMap.ts`
- Modify: `src/pdfExport/fieldMap-csc2122016-c1.js` (fix `vocationalTrade_nameOfSchool` value)
- Test: `src/pdfImport/reverseFieldMap.test.ts`

**Interfaces:**
- Consumes: `fieldMap` from `../pdfExport/fieldMap-csc2122016-c1.js`
- Produces: `buildReverseAcroFieldMap(): Map<string, string>` — PDF name → app data key

- [ ] **Step 1: Write failing test**

Create `src/pdfImport/reverseFieldMap.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildReverseAcroFieldMap } from './reverseFieldMap';

describe('buildReverseAcroFieldMap', () => {
  it('maps known PDF fields back to app keys', () => {
    const map = buildReverseAcroFieldMap();
    expect(map.get('c1_surname')).toBe('surname');
    expect(map.get('c1_firstname')).toBe('firstName');
    expect(map.get('c1_male')).toBe('sexAtBirth_male');
  });

  it('has no duplicate PDF field names', () => {
    const map = buildReverseAcroFieldMap();
    const pdfNames = [...map.keys()];
    expect(pdfNames.length).toBe(new Set(pdfNames).size);
  });
});
```

Run: `npm run test -- src/pdfImport/reverseFieldMap.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement reverse map**

Create `src/pdfImport/reverseFieldMap.ts`:

```typescript
import { fieldMap } from '../pdfExport/fieldMap-csc2122016-c1.js';

let cached: Map<string, string> | null = null;

export function buildReverseAcroFieldMap(): Map<string, string> {
  if (cached) return cached;
  const reverse = new Map<string, string>();
  const acro = fieldMap.acroFields as Record<string, string>;
  for (const [appKey, pdfName] of Object.entries(acro)) {
    if (!pdfName || typeof pdfName !== 'string') continue;
    reverse.set(pdfName, appKey);
  }
  cached = reverse;
  return reverse;
}
```

In `fieldMap-csc2122016-c1.js`, change line 124 from:

```javascript
vocationalTrade_nameOfSchool: 'c1_voc_name' ? 'c1_voc_name' : 'N/A',
```

to:

```javascript
vocationalTrade_nameOfSchool: 'c1_voc_name',
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/pdfImport/reverseFieldMap.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pdfImport/reverseFieldMap.ts src/pdfImport/reverseFieldMap.test.ts src/pdfExport/fieldMap-csc2122016-c1.js
git commit -m "feat(pdf-import): reverse acro field map from export fieldMap"
```

---

### Task 3: PDF text normalization

**Files:**
- Create: `src/pdfImport/normalizePdfText.ts`
- Test: `src/pdfImport/normalizePdfText.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `normalizePlainText(value: string): string`, `normalizeDateToDMY(value: string): string` (returns input if not parseable)

- [ ] **Step 1: Write failing tests**

Create `src/pdfImport/normalizePdfText.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalizePlainText, normalizeDateToDMY } from './normalizePdfText';

describe('normalizePlainText', () => {
  it('trims whitespace', () => {
    expect(normalizePlainText('  Cruz  ')).toBe('Cruz');
  });
});

describe('normalizeDateToDMY', () => {
  it('passes through dd/mm/yyyy', () => {
    expect(normalizeDateToDMY('15/03/1990')).toBe('15/03/1990');
  });

  it('converts yyyy-mm-dd to dd/mm/yyyy', () => {
    expect(normalizeDateToDMY('1990-03-15')).toBe('15/03/1990');
  });

  it('returns original when unknown', () => {
    expect(normalizeDateToDMY('March 15, 1990')).toBe('March 15, 1990');
  });
});
```

Run: `npm run test -- src/pdfImport/normalizePdfText.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement**

Create `src/pdfImport/normalizePdfText.ts`:

```typescript
export function normalizePlainText(value: string): string {
  return value.replace(/\u0000/g, '').trim();
}

export function normalizeDateToDMY(value: string): string {
  const trimmed = normalizePlainText(value);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return trimmed;
}
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/pdfImport/normalizePdfText.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pdfImport/normalizePdfText.ts src/pdfImport/normalizePdfText.test.ts
git commit -m "feat(pdf-import): normalize text and dates from PDF fields"
```

---

### Task 4: setRecordValueByKey (inverse writer)

**Files:**
- Create: `src/pdfImport/setRecordValueByKey.ts`
- Test: `src/pdfImport/setRecordValueByKey.test.ts`
- Reference: `src/pdfExport/exportPdsPage1.ts` (`getRecordValueByKey` switch cases for sex, civil status, citizenship, children, etc.)

**Interfaces:**
- Consumes: `PdsRecord` from `../types/pds`, `createNewPdsRecord` / empty helpers from `../db/defaultPdsData`
- Produces: `setRecordValueByKey(record: PdsRecord, appDataKey: string, rawValue: string | boolean): void` — mutates `record` in place

- [ ] **Step 1: Write failing tests (core personal + checkbox logic)**

Create `src/pdfImport/setRecordValueByKey.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { setRecordValueByKey } from './setRecordValueByKey';

describe('setRecordValueByKey', () => {
  it('sets personalInfo.surname', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'surname', 'Dela Cruz');
    expect(record.personalInfo.surname).toBe('Dela Cruz');
  });

  it('sets sex from checkbox keys', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'sexAtBirth_male', true);
    expect(record.personalInfo.sexAtBirth).toBe('Male');
    setRecordValueByKey(record, 'sexAtBirth_female', true);
    expect(record.personalInfo.sexAtBirth).toBe('Female');
  });

  it('sets civil status from checkbox keys', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'civilStatus_married', true);
    expect(record.personalInfo.civilStatus).toBe('Married');
  });

  it('sets child slot 01', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'children_01_fullName', 'Ana Maria');
    setRecordValueByKey(record, 'children_01_dateOfBirth', '01/01/2010');
    expect(record.familyBackground.children[0]?.fullName).toBe('Ana Maria');
    expect(record.familyBackground.children[0]?.dateOfBirth).toBe('01/01/2010');
  });
});
```

Run: `npm run test -- src/pdfImport/setRecordValueByKey.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement setRecordValueByKey**

Create `src/pdfImport/setRecordValueByKey.ts` with logic aligned to `getRecordValueByKey`:

- Text fields: route `residentialAddress_*`, `permanentAddress_*`, `spouse_*`, `father_*`, `mother_*`, education keys (`elementary_*`, `secondary_*`, etc.), direct `personalInfo` keys.
- Checkbox `true` for `sexAtBirth_*`, `civilStatus_*`, `citizenship_*`, `dualCitizenship_*` sets the corresponding enum on `personalInfo` (same labels as export).
- `backgroundQuestions_*_y` / `_n` / `_details` / `_dateFiled` / `_statusOfCase`: set `record.backgroundQuestions[questionKey].answer` to `'YES'|'NO'|'unanswered'` and detail fields (mirror export’s `backgroundQuestionKeyMap`).
- Indexed arrays: ensure slot exists (push `createEmptyChild()` / `createEmptyEligibility()` / etc.) before writing children, eligibility, work experience, trainings, voluntary work, references, otherInfo list slots.
- `workExperience_XX_isGovernmentService`: map `'Y'`/`'N'` to `true`/`false`.
- `workExperience_XX_inclusiveDatesTo` value `'PRESENT'`: set `isPresent: true` and clear `inclusiveDatesTo`.
- Date-like keys (`dateOfBirth`, `*_dateOfBirth`, `*_dateOfExamConferment`, etc.): pass through `normalizeDateToDMY`.
- Ignore keys with empty string / false checkbox.

Use `normalizePlainText` for string values.

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/pdfImport/setRecordValueByKey.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pdfImport/setRecordValueByKey.ts src/pdfImport/setRecordValueByKey.test.ts
git commit -m "feat(pdf-import): setRecordValueByKey for acro field values"
```

---

### Task 5: importPdsFromPdf core parser

**Files:**
- Create: `src/pdfImport/importPdsFromPdf.ts`
- Test: `src/pdfImport/importPdsFromPdf.test.ts`
- Read: `public/pdf-templates/csc212-2026/pds.pdf` in tests via `fs.readFileSync`

**Interfaces:**
- Consumes: `buildReverseAcroFieldMap`, `setRecordValueByKey`, `createNewPdsRecord`, `pdf-lib` (`PDFDocument`, form field getters)
- Produces:

```typescript
export type PdfImportResult = {
  success: boolean;
  record?: PdsRecord;
  warnings: string[];
  error?: string;
  matchedFieldCount: number;
  templateHint?: 'CS-Form-212-2026' | 'unknown';
};

export async function importPdsFromPdf(bytes: ArrayBuffer | Uint8Array): Promise<PdfImportResult>;
```

- [ ] **Step 1: Write failing round-trip test**

Create `src/pdfImport/importPdsFromPdf.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { fieldMap } from '../pdfExport/fieldMap-csc2122016-c1.js';
import { importPdsFromPdf } from './importPdsFromPdf';

const templatePath = path.join(process.cwd(), 'public/pdf-templates/csc212-2026/pds.pdf');

describe('importPdsFromPdf', () => {
  it('imports surname and firstName from a filled template PDF', async () => {
    const templateBytes = fs.readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    form.getTextField(fieldMap.acroFields.surname).setText('Reyes');
    form.getTextField(fieldMap.acroFields.firstName).setText('Juan');
    const filled = await pdfDoc.save();

    const result = await importPdsFromPdf(filled);
    expect(result.success).toBe(true);
    expect(result.record?.personalInfo.surname).toBe('Reyes');
    expect(result.record?.personalInfo.firstName).toBe('Juan');
    expect(result.matchedFieldCount).toBeGreaterThan(0);
  });

  it('returns error for non-PDF bytes', async () => {
    const result = await importPdsFromPdf(new TextEncoder().encode('not a pdf'));
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
```

Run: `npm run test -- src/pdfImport/importPdsFromPdf.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement importPdsFromPdf**

Create `src/pdfImport/importPdsFromPdf.ts`:

```typescript
import { PDFDocument, PDFCheckBox, PDFTextField, PDFRadioGroup, PDFDropdown } from 'pdf-lib';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { buildReverseAcroFieldMap } from './reverseFieldMap';
import { setRecordValueByKey } from './setRecordValueByKey';
import { normalizePlainText } from './normalizePdfText';
import type { PdfImportResult } from './types'; // inline types in same file if preferred

const TEMPLATE_PROBE_FIELDS = ['c1_surname', 'c1_firstname', 'pds'];

export async function importPdsFromPdf(bytes: ArrayBuffer | Uint8Array): Promise<PdfImportResult> {
  const warnings: string[] = [];
  let matchedFieldCount = 0;

  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();
    const reverse = buildReverseAcroFieldMap();
    const record = createNewPdsRecord('Imported from PDS PDF');
    record.meta.title = 'Imported from PDS PDF';

    const probeHits = TEMPLATE_PROBE_FIELDS.filter((name) => {
      try {
        form.getField(name);
        return true;
      } catch {
        return false;
      }
    }).length;

    const templateHint = probeHits >= 2 ? 'CS-Form-212-2026' : 'unknown';
    if (templateHint === 'unknown') {
      warnings.push(
        'This PDF does not look like CS Form 212 (Revised 2026). Import may be incomplete or empty.'
      );
    }

    const fields = form.getFields();
    for (const field of fields) {
      const pdfName = field.getName();
      const appKey = reverse.get(pdfName);
      if (!appKey) continue;

      let raw: string | boolean = '';
      if (field instanceof PDFCheckBox) {
        raw = field.isChecked();
      } else if (field instanceof PDFTextField) {
        raw = normalizePlainText(field.getText() ?? '');
      } else if (field instanceof PDFRadioGroup) {
        raw = normalizePlainText(field.getSelected() ?? '');
      } else if (field instanceof PDFDropdown) {
        raw = normalizePlainText(field.getSelected()?.[0] ?? '');
      } else {
        continue;
      }

      if (raw === '' || raw === false) continue;
      setRecordValueByKey(record, appKey, raw);
      matchedFieldCount++;
    }

    if (matchedFieldCount === 0) {
      return {
        success: false,
        warnings,
        matchedFieldCount: 0,
        templateHint,
        error:
          'No recognized PDS form fields found. Use a fillable CS Form 212 (2026) PDF or a GovFormsPH JSON backup.',
      };
    }

    warnings.push(
      'Photo, signature, and thumbmark are not imported from PDF (they are drawn on the page, not AcroForm fields). Re-add them in the form editor.'
    );
    warnings.push(
      'Work experience and training rows import in PDF slot order, which may differ from how GovFormsPH sorts them when exporting.'
    );

    record.meta.updatedAt = new Date().toISOString();

    return { success: true, record, warnings, matchedFieldCount, templateHint };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to read PDF.';
    return {
      success: false,
      warnings,
      matchedFieldCount: 0,
      error: message,
    };
  }
}
```

(Co-locate `PdfImportResult` type in this file and export it.)

- [ ] **Step 3: Run tests**

Run: `npm run test -- src/pdfImport/importPdsFromPdf.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/pdfImport/importPdsFromPdf.ts src/pdfImport/importPdsFromPdf.test.ts
git commit -m "feat(pdf-import): parse CS Form 212 PDF into PdsRecord"
```

---

### Task 6: Unified import API (JSON + PDF)

**Files:**
- Modify: `src/utils/exportImport.ts`
- Test: `src/utils/exportImport.test.ts` (optional thin test for routing)

**Interfaces:**
- Consumes: `importPdsFromPdf`, existing `parseImportFile`
- Produces:

```typescript
export type ImportPreview = {
  success: boolean;
  records: PdsRecord[];
  salnRecords: SalnRecord[];
  settings?: AppSettings;
  isEncrypted: boolean;
  requiresPassword?: boolean;
  error?: string;
  sourceType?: 'json' | 'pdf';
  warnings?: string[];
};

export async function parseImportBlob(
  file: File,
  passphrase?: string
): Promise<ImportPreview>;
```

- [ ] **Step 1: Write failing test for PDF routing**

Create `src/utils/exportImport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('parseImportBlob', () => {
  it('detects PDF by mime or extension', async () => {
    const { parseImportBlob } = await import('./exportImport');
    const templatePath = path.join(process.cwd(), 'public/pdf-templates/csc212-2026/pds.pdf');
    const bytes = fs.readFileSync(templatePath);
    const file = new File([bytes], 'pds.pdf', { type: 'application/pdf' });
    const result = await parseImportBlob(file);
    expect(result.sourceType).toBe('pdf');
    expect(result.records.length).toBeLessThanOrEqual(1);
  });
});
```

Run: `npm run test -- src/utils/exportImport.test.ts`
Expected: FAIL

- [ ] **Step 2: Implement parseImportBlob in exportImport.ts**

Add at top:

```typescript
import { importPdsFromPdf } from '../pdfImport/importPdsFromPdf';
```

Add function:

```typescript
function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

export async function parseImportBlob(file: File, passphrase?: string): Promise<ImportPreview> {
  if (isPdfFile(file)) {
    const bytes = await file.arrayBuffer();
    const pdfResult = await importPdsFromPdf(bytes);
    if (!pdfResult.success || !pdfResult.record) {
      return {
        success: false,
        records: [],
        salnRecords: [],
        isEncrypted: false,
        sourceType: 'pdf',
        warnings: pdfResult.warnings,
        error: pdfResult.error,
      };
    }
    return {
      success: true,
      records: [pdfResult.record],
      salnRecords: [],
      isEncrypted: false,
      sourceType: 'pdf',
      warnings: pdfResult.warnings,
    };
  }

  const text = await file.text();
  const jsonResult = await parseImportFile(text, passphrase);
  return { ...jsonResult, sourceType: 'json' };
}
```

Export `ImportPreview` type (extend existing inline return type of `parseImportFile`).

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: all PASS

- [ ] **Step 4: Commit**

```bash
git add src/utils/exportImport.ts src/utils/exportImport.test.ts
git commit -m "feat: parseImportBlob routes JSON backups and PDS PDF"
```

---

### Task 7: Export & Import UI

**Files:**
- Modify: `src/pages/ExportImportPage.tsx`

**Interfaces:**
- Consumes: `parseImportBlob` instead of reading `file.text()` + `parseImportFile` directly
- Produces: UI accepting `.pdf`, showing warnings list when `importPreview.warnings` present

- [ ] **Step 1: Switch file handling to parseImportBlob**

Replace state `importFileContent: string | null` with `importFile: File | null`.

Update `handleFileSelect`:

```typescript
import { parseImportBlob, restoreRecords, triggerDownload, exportAllData } from '../utils/exportImport';

const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setImportFileName(file.name);
  setImportFile(file);
  setImportSuccessMessage(null);
  const parsed = await parseImportBlob(file, importPassphrase);
  setImportPreview(parsed);
};
```

Update `handleDecryptAttempt` to only run when `importPreview?.sourceType !== 'pdf'` and `importFile` is set — re-read JSON via `parseImportBlob` (PDF ignores passphrase).

Clear `importFile` on successful import instead of `importFileContent`.

- [ ] **Step 2: Update file input accept and helper copy**

Change:

```tsx
accept=".json,.vault,.pdf,application/json,application/pdf"
```

Update paragraph (~line 206–228):

- Mention filled **CS Form 212 (2026) PDF** and GovFormsPH JSON backups.
- Note: scanned/flat PDFs not supported.

- [ ] **Step 3: Render warnings block**

After successful preview, if `importPreview.warnings?.length`:

```tsx
<ul className="text-[11px] text-amber-800 dark:text-amber-200 list-disc pl-4 space-y-1">
  {importPreview.warnings.map((w) => (
    <li key={w}>{w}</li>
  ))}
</ul>
```

Show badge **PDF import** when `importPreview.sourceType === 'pdf'`.

- [ ] **Step 4: Manual test**

Run: `npm run dev`
Steps:
1. Open Export & Import.
2. Import `public/pdf-templates/csc212-2026/pds.pdf` (blank) → expect error or zero fields message.
3. Fill a form in app, export PDF from form editor, import that PDF → expect preview with 1 form and surname populated.
4. JSON backup import still works.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: success, no TS errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ExportImportPage.tsx
git commit -m "feat(ui): import filled PDS PDF on export-import page"
```

---

### Task 8: Documentation

**Files:**
- Modify: `README.md` (Client-Side Export & Import bullet)

- [ ] **Step 1: Document PDF import**

Under **Client-Side Export & Import**, add:

```markdown
- Import a filled **CS Form 212 (Revised 2026) AcroForm PDF** (including PDFs saved from GovFormsPH) to start editing in the app.
- JSON backup import unchanged; encrypted vault unchanged.
- Scanned/flat PDFs and older CSC form revisions are not supported for PDF import.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document PDS PDF import"
```

---

## Self-review (plan author checklist)

**1. Spec coverage**

| Requirement | Task |
|-------------|------|
| Import same PDS PDF file (AcroForm) | Tasks 5–7 |
| Reuse existing field map / pdf-lib | Tasks 2, 5 |
| JSON import unchanged | Task 6 |
| User warnings (limitations) | Tasks 5, 7 |
| Offline/client-only | All tasks |
| CS-Form-212-2026 | Global constraints + template probe |

**Gaps (explicitly out of scope):** SALN PDF, pre-2026 PDS, encrypted PDF, image extraction for photo/signature.

**2. Placeholder scan:** No TBD/TODO steps; commands and code samples included.

**3. Type consistency:** `parseImportBlob` → `ImportPreview`; `importPdsFromPdf` → `PdfImportResult`; `setRecordValueByKey(record, appDataKey, rawValue)` used consistently.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-23-pds-pdf-import.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
