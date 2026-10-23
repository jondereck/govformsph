# Import Mismatch File Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kapag mag-i-import ang user, agad na makilala at ma-block ang maling file (hal. official CSC PDS PDF, random PDF, o JSON na hindi GovFormsPH backup) bago ma-restore sa IndexedDB, na may malinaw na mensahe kung ano ang tamang file.

**Architecture:** Hiwalay na `importValidation` module para sa file-kind sniffing (`%PDF`, non-text binary) at lightweight `PdsRecord` shape checks. `parseImportFile` sa `exportImport.ts` tatawag dito bago mag-return ng `success: true`. `ExportImportPage` magbabasa ng unang bytes ng file at magpapakita ng error banner (kasalukuyang walang UI kapag `success: false` at hindi encrypted).

**Tech Stack:** React 18, TypeScript, Vite 6, Vitest (bagong idadagdag), existing `exportImport.ts` / Dexie restore path.

## Global Constraints

- Walang bagong npm dependency maliban sa dev-only Vitest (`vitest` + `@vitest/coverage-v8` optional).
- Lahat ng validation client-side lang; walang upload sa server.
- Panatilihin ang existing export bundle format (`ExportBundle`, `single-form`, encrypted vault).
- UI copy: English primary (tulad ng app), optional secondary hint sa Tagalog sa error banner para sa PDS PDF case.
- `formVersion` na inaasahan: `'CS-Form-212-2026'` (mula sa `PdsMeta`).
- Huwag i-import ang record kung may critical missing keys — fail ang buong import preview, hindi partial silent corrupt data.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/utils/importValidation.ts` | **Create** — PDF/binary sniffing, `ImportFileKind`, `validatePdsRecord`, `validateImportRecords` |
| `src/utils/exportImport.ts` | **Modify** — `parseImportFile` accepts `ParseImportOptions`, calls validation, richer `error` / `errorCode` |
| `src/pages/ExportImportPage.tsx` | **Modify** — read file head + text, pass options, show mismatch error UI |
| `src/utils/importValidation.test.ts` | **Create** — Vitest unit tests |
| `vite.config.ts` | **Modify** — `test` config block |
| `package.json` | **Modify** — `"test": "vitest run"` script + devDependencies |

---

### Task 1: Vitest scaffolding

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/utils/importValidation.test.ts` (empty placeholder test first)

**Interfaces:**
- Consumes: none
- Produces: `npm run test` runs Vitest in Node

- [ ] **Step 1: Write the failing test**

Create `src/utils/importValidation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sniffFileKindFromHead } from './importValidation';

describe('sniffFileKindFromHead', () => {
  it('detects PDF from magic bytes', () => {
    const head = new TextEncoder().encode('%PDF-1.7');
    expect(sniffFileKindFromHead(head)).toBe('pdf');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm install -D vitest && npm run test`
Expected: FAIL — module `./importValidation` not found or export missing

- [ ] **Step 3: Add Vitest to project**

In `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

In `vite.config.ts`, extend config:

```typescript
/// <reference types="vitest/config" />
export default defineConfig({
  // ...existing...
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Run test again (still fails on missing module)**

Run: `npm run test`
Expected: FAIL on missing `importValidation.ts`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/utils/importValidation.test.ts
git commit -m "chore: add vitest for import validation tests"
```

---

### Task 2: File kind sniffing (PDF vs JSON text)

**Files:**
- Create: `src/utils/importValidation.ts`
- Modify: `src/utils/importValidation.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `export type ImportFileKind = 'pdf' | 'json_text' | 'unknown_binary'`
  - `export function sniffFileKindFromHead(head: Uint8Array, fileName?: string): ImportFileKind`
  - `export function userMessageForFileKind(kind: ImportFileKind): string`

- [ ] **Step 1: Write the failing tests**

Append to `importValidation.test.ts`:

```typescript
it('detects PDF from .pdf extension when head is empty', () => {
  expect(sniffFileKindFromHead(new Uint8Array(0), 'pds.pdf')).toBe('pdf');
});

it('treats UTF-8 JSON prefix as json_text', () => {
  const head = new TextEncoder().encode('{"source":"GovFormsPH"');
  expect(sniffFileKindFromHead(head)).toBe('json_text');
});

it('flags unknown binary (ZIP/office)', () => {
  const head = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
  expect(sniffFileKindFromHead(head)).toBe('unknown_binary');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test`
Expected: FAIL — functions not implemented

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/importValidation.ts`:

```typescript
export type ImportFileKind = 'pdf' | 'json_text' | 'unknown_binary';

function startsWithPdfMagic(head: Uint8Array): boolean {
  return (
    head.length >= 4 &&
    head[0] === 0x25 && // %
    head[1] === 0x50 && // P
    head[2] === 0x44 && // D
    head[3] === 0x46    // F
  );
}

function looksLikeJsonTextPrefix(head: Uint8Array): boolean {
  const sample = new TextDecoder('utf-8', { fatal: false }).decode(head.slice(0, 32)).trimStart();
  return sample.startsWith('{') || sample.startsWith('[');
}

export function sniffFileKindFromHead(head: Uint8Array, fileName?: string): ImportFileKind {
  const lower = (fileName ?? '').toLowerCase();
  if (startsWithPdfMagic(head) || lower.endsWith('.pdf')) {
    return 'pdf';
  }
  if (looksLikeJsonTextPrefix(head)) {
    return 'json_text';
  }
  // Non-printable in first bytes → likely not our JSON backup
  if (head.length > 0 && !looksLikeJsonTextPrefix(head)) {
    const hasNull = head.some((b) => b === 0);
    if (hasNull || !head.every((b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e))) {
      return 'unknown_binary';
    }
  }
  return 'json_text';
}

export function userMessageForFileKind(kind: ImportFileKind): string {
  switch (kind) {
    case 'pdf':
      return (
        'Mukhang PDF file ito (hal. official CS Form 212 / PDS template), hindi GovFormsPH backup. ' +
        'Import ang .json backup mula sa Export & Import — hindi ang printed/filled PDF.'
      );
    case 'unknown_binary':
      return 'Hindi JSON backup ang file na ito. Piliin ang GovFormsPH .json o encrypted vault export.';
    default:
      return '';
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/importValidation.ts src/utils/importValidation.test.ts
git commit -m "feat: sniff import file kind (PDF vs JSON)"
```

---

### Task 3: PdsRecord shape validation

**Files:**
- Modify: `src/utils/importValidation.ts`
- Modify: `src/utils/importValidation.test.ts`
- Reference: `src/types/pds.ts`, `src/db/defaultPdsData.ts` (`createNewPdsRecord`)

**Interfaces:**
- Consumes: `PdsRecord` type from `../types/pds`
- Produces:
  - `export interface RecordValidationIssue { index: number; field: string; message: string }`
  - `export function validatePdsRecord(record: unknown, index?: number): RecordValidationIssue[]`
  - `export function validateImportRecords(records: unknown[]): { ok: boolean; issues: RecordValidationIssue[] }`

- [ ] **Step 1: Write the failing tests**

```typescript
import { createNewPdsRecord } from '../db/defaultPdsData';
import { validateImportRecords } from './importValidation';

describe('validateImportRecords', () => {
  it('accepts a fresh empty PdsRecord', () => {
    const result = validateImportRecords([createNewPdsRecord()]);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects object missing meta.formVersion', () => {
    const bad = { personalInfo: {} };
    const result = validateImportRecords([bad]);
    expect(result.ok).toBe(false);
    expect(result.issues[0].field).toContain('meta');
  });

  it('rejects wrong formVersion', () => {
    const record = createNewPdsRecord();
    record.meta.formVersion = 'CS-Form-212-2017' as any;
    const result = validateImportRecords([record]);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- validateImportRecords`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Add to `importValidation.ts`:

```typescript
import type { PdsRecord } from '../types/pds';

export interface RecordValidationIssue {
  index: number;
  field: string;
  message: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validatePdsRecord(record: unknown, index = 0): RecordValidationIssue[] {
  const issues: RecordValidationIssue[] = [];
  if (!isPlainObject(record)) {
    issues.push({ index, field: 'record', message: 'Each entry must be a JSON object.' });
    return issues;
  }

  const meta = record.meta;
  if (!isPlainObject(meta)) {
    issues.push({ index, field: 'meta', message: 'Missing meta block.' });
  } else {
    if (meta.formVersion !== 'CS-Form-212-2026') {
      issues.push({
        index,
        field: 'meta.formVersion',
        message: `Unsupported or missing form version (expected CS-Form-212-2026).`,
      });
    }
    if (typeof meta.createdAt !== 'string' || typeof meta.updatedAt !== 'string') {
      issues.push({ index, field: 'meta.timestamps', message: 'meta.createdAt and meta.updatedAt must be strings.' });
    }
  }

  if (!isPlainObject(record.personalInfo)) {
    issues.push({ index, field: 'personalInfo', message: 'Missing personalInfo section.' });
  } else {
    for (const key of ['surname', 'firstName'] as const) {
      if (typeof record.personalInfo[key] !== 'string') {
        issues.push({ index, field: `personalInfo.${key}`, message: 'Required string field missing.' });
      }
    }
  }

  const arrayFields = [
    'eligibility',
    'workExperience',
    'trainings',
    'voluntaryWork',
    'references',
  ] as const;
  for (const key of arrayFields) {
    if (!Array.isArray(record[key])) {
      issues.push({ index, field: key, message: 'Expected an array.' });
    }
  }

  if (!isPlainObject(record.declaration)) {
    issues.push({ index, field: 'declaration', message: 'Missing declaration section.' });
  }

  return issues;
}

export function validateImportRecords(records: unknown[]): { ok: boolean; issues: RecordValidationIssue[] } {
  const issues = records.flatMap((r, i) => validatePdsRecord(r, i));
  return { ok: issues.length === 0, issues };
}
```

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/importValidation.ts src/utils/importValidation.test.ts
git commit -m "feat: validate PdsRecord shape on import"
```

---

### Task 4: Wire validation into `parseImportFile`

**Files:**
- Modify: `src/utils/exportImport.ts`
- Create: `src/utils/exportImport.test.ts`

**Interfaces:**
- Consumes: `sniffFileKindFromHead`, `userMessageForFileKind`, `validateImportRecords` from `./importValidation`
- Produces:
  - `export type ImportErrorCode = 'wrong_file_pdf' | 'wrong_file_binary' | 'invalid_json' | 'unrecognized_structure' | 'invalid_records' | 'decrypt_failed' | 'password_required'`
  - `export interface ParseImportOptions { fileName?: string; fileHead?: Uint8Array }`
  - Updated return type of `parseImportFile` includes optional `errorCode?: ImportErrorCode` and `validationIssues?`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/exportImport.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseImportFile } from './exportImport';
import { createNewPdsRecord } from '../db/defaultPdsData';

describe('parseImportFile mismatch detection', () => {
  it('rejects PDF magic without parsing as JSON', async () => {
    const pdfSnippet = '%PDF-1.4 fake';
    const head = new TextEncoder().encode(pdfSnippet);
    const result = await parseImportFile(pdfSnippet, undefined, {
      fileName: 'CS-Form-212-2026.pdf',
      fileHead: head,
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('wrong_file_pdf');
  });

  it('rejects JSON array of non-Pds objects', async () => {
    const json = JSON.stringify([{ foo: 'bar' }]);
    const result = await parseImportFile(json);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('invalid_records');
  });

  it('accepts single-form export', async () => {
    const record = createNewPdsRecord();
    const json = JSON.stringify({
      version: '1.0',
      source: 'GovFormsPH',
      type: 'single-form',
      record,
    });
    const result = await parseImportFile(json);
    expect(result.success).toBe(true);
    expect(result.records).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- exportImport`
Expected: FAIL — wrong signature or no errorCode

- [ ] **Step 3: Implement changes in `exportImport.ts`**

Add imports and extend `parseImportFile`:

```typescript
import {
  sniffFileKindFromHead,
  userMessageForFileKind,
  validateImportRecords,
  type RecordValidationIssue,
} from './importValidation';

export type ImportErrorCode =
  | 'wrong_file_pdf'
  | 'wrong_file_binary'
  | 'invalid_json'
  | 'unrecognized_structure'
  | 'invalid_records'
  | 'decrypt_failed'
  | 'password_required';

export interface ParseImportOptions {
  fileName?: string;
  fileHead?: Uint8Array;
}

// Extend parseImportFile return type with errorCode?, validationIssues?

export async function parseImportFile(
  fileContent: string,
  passphrase?: string,
  options: ParseImportOptions = {}
): Promise<{
  success: boolean;
  records: PdsRecord[];
  salnRecords: SalnRecord[];
  settings?: AppSettings;
  isEncrypted: boolean;
  requiresPassword?: boolean;
  error?: string;
  errorCode?: ImportErrorCode;
  validationIssues?: RecordValidationIssue[];
}> {
  const head = options.fileHead ?? new TextEncoder().encode(fileContent.slice(0, 8));
  const kind = sniffFileKindFromHead(head, options.fileName);
  if (kind === 'pdf') {
    return {
      success: false,
      records: [],
      salnRecords: [],
      isEncrypted: false,
      errorCode: 'wrong_file_pdf',
      error: userMessageForFileKind('pdf'),
    };
  }
  if (kind === 'unknown_binary') {
    return {
      success: false,
      records: [],
      salnRecords: [],
      isEncrypted: false,
      errorCode: 'wrong_file_binary',
      error: userMessageForFileKind('unknown_binary'),
    };
  }

  // ... existing try/catch JSON parse ...
  // On JSON.parse catch: errorCode: 'invalid_json'

  // After extracting records array (all branches), before success:true:
  const validation = validateImportRecords(records);
  if (!validation.ok) {
    return {
      success: false,
      records: [],
      salnRecords: [],
      isEncrypted: false,
      errorCode: 'invalid_records',
      error: 'Backup JSON was readable but does not contain valid GovFormsPH PDS record(s).',
      validationIssues: validation.issues,
    };
  }

  // Map existing encrypt errors to errorCode: 'password_required' | 'decrypt_failed'
  // Map unrecognized structure to errorCode: 'unrecognized_structure'
}
```

Apply `validateImportRecords` only to PDS `records` (not SALN in this pass — SALN validation is out of scope unless empty import; still import SALN as today when PDS valid).

- [ ] **Step 4: Run tests**

Run: `npm run test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportImport.ts src/utils/exportImport.test.ts
git commit -m "feat: block mismatched import files in parseImportFile"
```

---

### Task 5: Export/Import page — read file head + error UI

**Files:**
- Modify: `src/pages/ExportImportPage.tsx`

**Interfaces:**
- Consumes: `parseImportFile(text, passphrase, { fileName, fileHead })`
- Produces: User-visible error card when `importPreview.success === false`

- [ ] **Step 1: Manual test checklist (no automated UI test yet)**

Document expected behavior:
- Select `public/pdf-templates/csc212-2026/pds.pdf` → red/amber error, no Confirm button
- Select valid `pds-*.json` export → existing success preview

- [ ] **Step 2: Update `handleFileSelect`**

Replace `file.text()`-only flow:

```typescript
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setImportFileName(file.name);
  setImportSuccessMessage(null);

  const buffer = await file.arrayBuffer();
  const fileHead = new Uint8Array(buffer.slice(0, 16));
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);

  setImportFileContent(text);

  const parsed = await parseImportFile(text, importPassphrase, {
    fileName: file.name,
    fileHead,
  });
  setImportPreview(parsed);
};
```

- [ ] **Step 3: Add error banner JSX**

After the encrypted-password block, add:

```tsx
{importPreview && !importPreview.success && !importPreview.requiresPassword && (
  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 space-y-2">
    <p className="text-xs font-bold text-rose-900 dark:text-rose-200">Hindi valid na backup file</p>
    <p className="text-xs text-rose-800 dark:text-rose-300">{importPreview.error}</p>
    {importPreview.errorCode === 'wrong_file_pdf' && (
      <p className="text-[10px] text-rose-700/90 dark:text-rose-300/90">
        Tip: Gamitin ang <strong>Export Backup</strong> dito sa app para gumawa ng .json, o i-import ang dating na-export na file — hindi ang CSC PDF template.
      </p>
    )}
    {importPreview.validationIssues && importPreview.validationIssues.length > 0 && (
      <ul className="text-[10px] font-mono text-rose-700 dark:text-rose-300 list-disc pl-4 max-h-24 overflow-y-auto">
        {importPreview.validationIssues.slice(0, 5).map((issue, i) => (
          <li key={i}>
            Record {issue.index + 1}: {issue.field} — {issue.message}
          </li>
        ))}
      </ul>
    )}
  </div>
)}
```

- [ ] **Step 4: Update drop zone helper text**

Change line ~207 to clarify:

```tsx
Select a <code>.json</code> GovFormsPH backup — not a filled PDS PDF.
```

- [ ] **Step 5: Run build + manual smoke**

Run: `npm run build`
Expected: PASS

Run: `npm run dev` and test PDF + JSON in browser.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ExportImportPage.tsx
git commit -m "fix: show clear error when import file is PDF or invalid backup"
```

---

### Task 6: Regression tests for encrypted path (optional hardening)

**Files:**
- Modify: `src/utils/exportImport.test.ts`

**Interfaces:**
- Consumes: existing `encryptData` / `exportAllData` patterns
- Produces: test ensuring encrypted bundle still requires password before record validation

- [ ] **Step 1: Write test**

```typescript
it('returns password_required before validating records when encrypted', async () => {
  const bundle = {
    version: '1.0',
    source: 'GovFormsPH',
    isEncrypted: true,
    formsCount: 1,
    data: 'cipher',
  };
  const result = await parseImportFile(JSON.stringify(bundle));
  expect(result.requiresPassword).toBe(true);
  expect(result.errorCode).toBe('password_required');
});
```

- [ ] **Step 2–4: Implement errorCode on existing branches, run tests, commit**

Run: `npm run test`
Expected: PASS

```bash
git commit -am "test: cover encrypted import password gate"
```

---

## Self-Review (plan author checklist)

**1. Spec coverage**

| Requirement | Task |
|-------------|------|
| Detect official PDS PDF / any PDF at import | Task 2 + 4 + 5 |
| Clear user message (EN + TL hint) | Task 2, 5 |
| Reject invalid JSON / wrong structure | Task 4 |
| Reject JSON that is not GovFormsPH PDS records | Task 3 + 4 |
| Do not break encrypted import | Task 4 + 6 |
| Show errors in UI (current gap) | Task 5 |

**2. Placeholder scan:** No TBD/TODO steps; commands and code blocks are concrete.

**3. Type consistency:** `parseImportFile` third arg `ParseImportOptions` used consistently; `validationIssues` matches `RecordValidationIssue[]`.

**Gaps (explicitly out of scope for this plan):** PDF *data extraction* (OCR/fillable import from CSC PDF); SALN record validation; importing old CS-Form-212-2017 JSON without migration.

---

## Spec coverage answer (user question)

**Oo, pwede** — sa import phase pa lang, basahin ang unang bytes at filename: kung `%PDF` o `.pdf`, huwag subukang i-parse bilang JSON; ipakita ang mensahe na ang **PDS PDF template/filled PDF ay hindi backup file**. Valid backup lang ang GovFormsPH `.json` (o encrypted vault na JSON wrapper).
