# Fillable PDS PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user restore one CS Form 212 (Revised 2026) draft by uploading the fillable PDS PDF itself on Export & Import, instead of only a GovFormsPH JSON backup.

**Architecture:** Reuse the existing AcroForm map in `src/pdfExport/fieldMap-csc2122016-c1.js`. Load the uploaded PDF with `pdf-lib` (already a dependency), read field values, write them into a blank `PdsRecord` through `setRecordValueByKey` (the inverse of `getRecordValueByKey` in `src/pdfExport/exportPdsPage1.ts`), then feed that record into the existing `restoreRecords(..., 'merge')` path. Detection rejects flattened print PDFs, scans, and unknown templates with fixed copy. No OCR, no new server, no new PDF library.

**Tech Stack:** React 18, TypeScript, Vite 6, pdf-lib 1.17, Dexie, Vitest (new, Node environment), Tailwind, lucide-react.

## Global Constraints

- Client-side only: PDF bytes never leave the browser; no new network calls, telemetry, or cloud parse APIs.
- Import only fillable CS Form 212 (Revised 2026) PDFs whose AcroForm field names match `public/pdf-templates/csc212-2026/pds.pdf` / `fieldMap.acroFields`.
- Do not OCR scanned PDFs. Do not parse Excel/Word PDS files. Do not import SALN PDFs. Do not add a 2017 field-name map.
- Do not change `generatePdsPage1Pdf` flattening. GovFormsPH Print/PDF output stays print-ready and cannot round-trip through this importer.
- Photo, signature, thumbmark, and Work Experience Sheet duties are not imported (they are drawn on the page or live outside the PDS AcroForm).
- PDF import always creates a **new** `PdsRecord` (merge). It must not offer Replace-all.
- Use the field map as-is, including known truncated names (`c1_children_dob_0`, `c2_cse_0`) so import stays symmetric with export.
- Zero emoji UI icons. Conventional Commits. Do not hand-edit `CHANGELOG.md` or `package.json` version.
- Node 18+; Vitest tests run in Node and load the real template from `public/pdf-templates/csc212-2026/pds.pdf`.

## File Structure

| File | Responsibility |
|---|---|
| `vitest.config.ts` | Node test runner for `src/**/*.test.ts`. |
| `package.json` | Add `vitest` devDependency and `test` / `test:watch` scripts. |
| `src/pdfMap/appDataKeyMaps.ts` | Shared appDataKey lookup tables used by get and set. |
| `src/pdfExport/exportPdsPage1.ts` | Keep `getRecordValueByKey`; switch its inline maps to the shared file. |
| `src/pdfImport/pdsImportMessages.ts` | Exact user-facing error and warning strings. |
| `src/pdfImport/readPdsAcroFields.ts` | Read every AcroForm field into `Map<string, string \| boolean>`. |
| `src/pdfImport/setRecordValueByKey.ts` | Inverse of `getRecordValueByKey`. |
| `src/pdfImport/importPdsPdf.ts` | Detect template, apply map, compact empty rows, return success or typed failure. |
| `src/utils/exportImport.ts` | Add `ImportPreview` fields and `parseImportSource(file, passphrase)`. |
| `src/pages/exportImportUi.ts` | File-input accept string, drop-zone hint, PDF merge-only helper. |
| `src/pages/ExportImportPage.tsx` | Accept `.pdf`, show errors/warnings, force merge for PDF. |
| `README.md` | Document fillable PDS PDF import and its limits. |
| `CONTRIBUTING.md` | Add `pdfImport/` to the architecture tree. |

Test files (colocated, included by existing `tsconfig.json` `"include": ["src"]`):

- `src/pdfImport/readPdsAcroFields.test.ts`
- `src/pdfImport/setRecordValueByKey.test.ts`
- `src/pdfImport/importPdsPdf.test.ts`
- `src/utils/exportImport.parseImportSource.test.ts`
- `src/pages/exportImportUi.test.ts`

Out of scope (do not create): OCR, unflattened PDF export, SALN PDF import, Excel import, Dashboard-page import button.

---

### Task 1: Vitest + AcroForm field reader

**Files:**
- Create: `vitest.config.ts`
- Create: `src/pdfImport/readPdsAcroFields.ts`
- Create: `src/pdfImport/readPdsAcroFields.test.ts`
- Modify: `package.json` (devDependency `vitest` and scripts only; do not bump `version`)

**Interfaces:**
- Consumes: `pdf-lib` `PDFDocument`, `PDFForm`, `PDFTextField`, `PDFCheckBox`, `PDFRadioGroup`, `PDFDropdown`; template file `public/pdf-templates/csc212-2026/pds.pdf`
- Produces: `readPdsAcroFieldValues(form: PDFForm): Map<string, string | boolean>`

- [ ] **Step 1: Add Vitest and write the failing reader test**

Install Vitest (Vite 6 compatible):

```bash
npm install -D vitest@^3.2.0
```

Add scripts to `package.json` next to the existing `"preview"` script:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Create `src/pdfImport/readPdsAcroFields.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { readPdsAcroFieldValues } from './readPdsAcroFields';

function loadTemplateBytes(): Uint8Array {
  return new Uint8Array(
    readFileSync(path.resolve(process.cwd(), 'public/pdf-templates/csc212-2026/pds.pdf')),
  );
}

describe('readPdsAcroFieldValues', () => {
  it('reads text and checkbox values from a filled unflattened PDS PDF', async () => {
    const pdf = await PDFDocument.load(loadTemplateBytes());
    const form = pdf.getForm();
    form.getTextField('c1_surname').setText('DELA CRUZ');
    form.getTextField('c1_firstname').setText('JUAN');
    form.getCheckBox('c1_male').check();
    const bytes = await pdf.save();

    const loaded = await PDFDocument.load(bytes);
    const values = readPdsAcroFieldValues(loaded.getForm());

    expect(values.get('c1_surname')).toBe('DELA CRUZ');
    expect(values.get('c1_firstname')).toBe('JUAN');
    expect(values.get('c1_male')).toBe(true);
    expect(values.get('c1_female')).toBe(false);
  });

  it('returns an empty map when the form has no fields', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const values = readPdsAcroFieldValues(pdf.getForm());
    expect(values.size).toBe(0);
  });

  it('skips unsupported field types without throwing', async () => {
    const pdf = await PDFDocument.load(loadTemplateBytes());
    const form = pdf.getForm();
    const values = readPdsAcroFieldValues(form);
    expect(values.size).toBeGreaterThan(50);
    expect([...values.keys()].every((name) => typeof name === 'string')).toBe(true);
    const sample = form.getField('c1_surname');
    expect(sample instanceof PDFTextField || sample instanceof PDFCheckBox).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/pdfImport/readPdsAcroFields.test.ts
```

Expected: FAIL with `Cannot find module './readPdsAcroFields'` (or equivalent "failed to resolve").

- [ ] **Step 3: Write the reader**

Create `src/pdfImport/readPdsAcroFields.ts`:

```ts
import {
  PDFCheckBox,
  PDFDropdown,
  PDFForm,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';

/**
 * Reads every AcroForm field that pdf-lib can extract.
 * Text / dropdown / radio → string (empty string if unset).
 * Checkbox → boolean.
 * Other field types are skipped.
 */
export function readPdsAcroFieldValues(form: PDFForm): Map<string, string | boolean> {
  const values = new Map<string, string | boolean>();

  for (const field of form.getFields()) {
    const name = field.getName();
    try {
      if (field instanceof PDFTextField) {
        values.set(name, field.getText() ?? '');
      } else if (field instanceof PDFCheckBox) {
        values.set(name, field.isChecked());
      } else if (field instanceof PDFRadioGroup) {
        values.set(name, field.getSelected() ?? '');
      } else if (field instanceof PDFDropdown) {
        const selected = field.getSelected();
        values.set(name, Array.isArray(selected) ? selected[0] ?? '' : selected ?? '');
      }
    } catch {
      // Skip fields whose value stream pdf-lib cannot read.
    }
  }

  return values;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npx vitest run src/pdfImport/readPdsAcroFields.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/pdfImport/readPdsAcroFields.ts src/pdfImport/readPdsAcroFields.test.ts
git commit -m "feat(pds): add vitest and AcroForm field reader"
```

---

### Task 2: Shared appDataKey maps + inverse setter

**Files:**
- Create: `src/pdfMap/appDataKeyMaps.ts`
- Create: `src/pdfImport/setRecordValueByKey.ts`
- Create: `src/pdfImport/setRecordValueByKey.test.ts`
- Modify: `src/pdfExport/exportPdsPage1.ts` (replace the three inline lookup objects with imports from `appDataKeyMaps.ts`; do not change `getRecordValueByKey` behavior)

**Interfaces:**
- Consumes: `PdsRecord` from `src/types/pds.ts`; empty-row factories from `src/db/defaultPdsData.ts`; `getRecordValueByKey` from `src/pdfExport/exportPdsPage1.ts`
- Produces:
  - `setRecordValueByKey(record: PdsRecord, key: string, value: string | boolean): void`
  - Exported maps: `CIVIL_STATUS_CHECKBOX_KEYS`, `BACKGROUND_QUESTION_KEY_MAP`, `BACKGROUND_QUESTION_DETAILS_KEY_MAP`, `OTHER_INFO_LIST_KEYS`

- [ ] **Step 1: Write the failing setter tests**

Create `src/pdfImport/setRecordValueByKey.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { getRecordValueByKey } from '../pdfExport/exportPdsPage1';
import { setRecordValueByKey } from './setRecordValueByKey';

describe('setRecordValueByKey', () => {
  it('round-trips personal info text and checkbox keys through getRecordValueByKey', () => {
    const record = createNewPdsRecord();
    record.personalInfo.citizenship = '';

    setRecordValueByKey(record, 'surname', 'DELA CRUZ');
    setRecordValueByKey(record, 'firstName', 'JUAN');
    setRecordValueByKey(record, 'residentialAddress_barangay', 'SAN ANTONIO');
    setRecordValueByKey(record, 'sexAtBirth_male', true);
    setRecordValueByKey(record, 'civilStatus_married', true);
    setRecordValueByKey(record, 'citizenship_dual', true);
    setRecordValueByKey(record, 'dualCitizenship_byBirth', true);
    setRecordValueByKey(record, 'dualCitizenshipCountry', 'USA');

    expect(getRecordValueByKey(record, 'surname')).toBe('DELA CRUZ');
    expect(getRecordValueByKey(record, 'firstName')).toBe('JUAN');
    expect(getRecordValueByKey(record, 'residentialAddress_barangay')).toBe('SAN ANTONIO');
    expect(getRecordValueByKey(record, 'sexAtBirth_male')).toBe(true);
    expect(getRecordValueByKey(record, 'sexAtBirth_female')).toBe(false);
    expect(getRecordValueByKey(record, 'civilStatus_married')).toBe(true);
    expect(getRecordValueByKey(record, 'citizenship_dual')).toBe(true);
    expect(getRecordValueByKey(record, 'dualCitizenship_byBirth')).toBe(true);
    expect(getRecordValueByKey(record, 'dualCitizenshipCountry')).toBe('USA');
  });

  it('grows and fills indexed children, work, and background-question rows', () => {
    const record = createNewPdsRecord();

    setRecordValueByKey(record, 'children_02_fullName', 'ANA DELA CRUZ');
    setRecordValueByKey(record, 'children_02_dateOfBirth', '01/02/2010');
    setRecordValueByKey(record, 'workExperience_01_positionTitle', 'Analyst');
    setRecordValueByKey(record, 'workExperience_01_inclusiveDatesTo', 'PRESENT');
    setRecordValueByKey(record, 'workExperience_01_isGovernmentService', 'Y');
    setRecordValueByKey(record, 'backgroundQuestions_34a_y', true);
    setRecordValueByKey(record, 'backgroundQuestions_34a_details', 'Cousin in HR');
    setRecordValueByKey(record, 'backgroundQuestions_39_y', true);
    setRecordValueByKey(record, 'backgroundQuestions_39_details', 'Canada');
    setRecordValueByKey(record, 'declaration_dateAndPlaceOfIssuance', '01/03/2024, Quezon City');

    expect(record.familyBackground.children[1].fullName).toBe('ANA DELA CRUZ');
    expect(record.workExperience[0].isPresent).toBe(true);
    expect(record.workExperience[0].inclusiveDatesTo).toBe('');
    expect(record.workExperience[0].isGovernmentService).toBe(true);
    expect(record.backgroundQuestions.relatedWithinThirdDegree.answer).toBe(true);
    expect(record.backgroundQuestions.relatedWithinThirdDegree.details).toBe('Cousin in HR');
    expect(record.backgroundQuestions.immigrantOrPermanentResidentAbroad.country).toBe('Canada');
    expect(record.declaration.dateOfIssuance).toBe('01/03/2024');
    expect(record.declaration.placeOfIssuance).toBe('Quezon City');
  });

  it('ignores false checkboxes so an unset box does not clear a previously set status', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'civilStatus_married', true);
    setRecordValueByKey(record, 'civilStatus_single', false);
    expect(record.personalInfo.civilStatus).toBe('Married');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/pdfImport/setRecordValueByKey.test.ts
```

Expected: FAIL with `Cannot find module './setRecordValueByKey'`.

- [ ] **Step 3: Extract shared maps and implement the setter**

Create `src/pdfMap/appDataKeyMaps.ts`:

```ts
import { CivilStatus, PdsRecord } from '../types/pds';

export const CIVIL_STATUS_CHECKBOX_KEYS: Record<string, CivilStatus[]> = {
  civilStatus_single: ['Single'],
  civilStatus_married: ['Married'],
  civilStatus_widowed: ['Widow/er'],
  civilStatus_separated: ['Separated'],
  civilStatus_others: ['Others', 'Solo Parent'],
};

export const BACKGROUND_QUESTION_KEY_MAP: Record<string, keyof PdsRecord['backgroundQuestions']> = {
  '34a': 'relatedWithinThirdDegree',
  '34b': 'relatedWithinFourthDegreeLGU',
  '35a': 'foundGuiltyOfAdminOffense',
  '35b': 'criminallyChargedInCourt',
  '36': 'convictedOfCrimeOrViolation',
  '37': 'separatedFromService',
  '38a': 'candidateInNationalLocalElection',
  '38b': 'resignedToCampaignForCandidate',
  '39': 'immigrantOrPermanentResidentAbroad',
  '40a': 'indigenousGroupMember',
  '40b': 'personWithDisability',
  '40c': 'soloParent',
};

export const BACKGROUND_QUESTION_DETAILS_KEY_MAP: Record<string, string> = {
  immigrantOrPermanentResidentAbroad: 'country',
  indigenousGroupMember: 'specify',
  personWithDisability: 'pwdIdNo',
  soloParent: 'soloParentIdNo',
};

export const OTHER_INFO_LIST_KEYS: Record<string, keyof PdsRecord['otherInfo']> = {
  hobbies: 'specialSkillsHobbies',
  distinction: 'nonAcademicDistinctions',
  membership: 'membershipInAssociations',
};
```

In `src/pdfExport/exportPdsPage1.ts`, add this import after the existing `fieldMap` import:

```ts
import {
  BACKGROUND_QUESTION_DETAILS_KEY_MAP,
  BACKGROUND_QUESTION_KEY_MAP,
  CIVIL_STATUS_CHECKBOX_KEYS,
  OTHER_INFO_LIST_KEYS,
} from '../pdfMap/appDataKeyMaps';
```

Replace the local `civilStatusCheckboxKeys` object inside `getRecordValueByKey` with `CIVIL_STATUS_CHECKBOX_KEYS` (same key names, same values). Replace the local `backgroundQuestionKeyMap` with `BACKGROUND_QUESTION_KEY_MAP`. Replace the local `backgroundQuestionDetailsKeyMap` with `BACKGROUND_QUESTION_DETAILS_KEY_MAP`. Replace the local `otherInfoListKeys` with `OTHER_INFO_LIST_KEYS`. Do not change any branch logic.

Create `src/pdfImport/setRecordValueByKey.ts`:

```ts
import {
  createEmptyChild,
  createEmptyEducationEntry,
  createEmptyEligibility,
  createEmptyReference,
  createEmptyTraining,
  createEmptyVoluntaryWork,
  createEmptyWorkExperience,
} from '../db/defaultPdsData';
import {
  BACKGROUND_QUESTION_DETAILS_KEY_MAP,
  BACKGROUND_QUESTION_KEY_MAP,
  CIVIL_STATUS_CHECKBOX_KEYS,
  OTHER_INFO_LIST_KEYS,
} from '../pdfMap/appDataKeyMaps';
import { Address, PdsRecord } from '../types/pds';

function asText(value: string | boolean): string {
  return typeof value === 'boolean' ? '' : value;
}

function ensureIndex<T>(list: T[], index: number, factory: () => T): T {
  while (list.length <= index) {
    list.push(factory());
  }
  return list[index];
}

function emptyAddress(): Address {
  return {
    houseBlockLot: '',
    street: '',
    subdivisionVillage: '',
    barangay: '',
    cityMunicipality: '',
    province: '',
    zipCode: '',
  };
}

function splitDateAndPlace(raw: string): { dateOfIssuance: string; placeOfIssuance: string } {
  const trimmed = raw.trim();
  const comma = trimmed.indexOf(',');
  if (comma === -1) {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return { dateOfIssuance: trimmed, placeOfIssuance: '' };
    }
    return { dateOfIssuance: '', placeOfIssuance: trimmed };
  }
  return {
    dateOfIssuance: trimmed.slice(0, comma).trim(),
    placeOfIssuance: trimmed.slice(comma + 1).trim(),
  };
}

function parseGovernmentService(value: string | boolean): boolean | null {
  if (typeof value === 'boolean') return value ? true : false;
  const token = value.trim().toUpperCase();
  if (token === 'Y' || token === 'YES') return true;
  if (token === 'N' || token === 'NO') return false;
  return null;
}

export function setRecordValueByKey(
  record: PdsRecord,
  key: string,
  value: string | boolean,
): void {
  const p = record.personalInfo;

  switch (key) {
    case 'sexAtBirth_male':
      if (value === true) p.sexAtBirth = 'Male';
      return;
    case 'sexAtBirth_female':
      if (value === true) p.sexAtBirth = 'Female';
      return;
    case 'citizenship_filipino':
      if (value === true) p.citizenship = 'Filipino';
      return;
    case 'citizenship_dual':
      if (value === true) p.citizenship = 'Dual Citizenship';
      return;
    case 'dualCitizenship_byBirth':
      if (value === true) p.dualCitizenshipMode = 'by birth';
      return;
    case 'dualCitizenship_byNaturalization':
      if (value === true) p.dualCitizenshipMode = 'by naturalization';
      return;
    case 'signature':
    case 'signature_page4':
      return;
    case 'declaration_dateAndPlaceOfIssuance': {
      const split = splitDateAndPlace(asText(value));
      record.declaration.dateOfIssuance = split.dateOfIssuance;
      record.declaration.placeOfIssuance = split.placeOfIssuance;
      return;
    }
    default:
      if (key in CIVIL_STATUS_CHECKBOX_KEYS) {
        if (value === true) {
          p.civilStatus = CIVIL_STATUS_CHECKBOX_KEYS[key][0];
        }
        return;
      }
  }

  if (key.startsWith('declaration_') || key.startsWith('declaration.')) {
    const subKey = key.replace(/^declaration[_.]/, '') as keyof PdsRecord['declaration'];
    if (subKey === 'idPhoto' || subKey === 'signature' || subKey === 'rightThumbmark') return;
    if (subKey in record.declaration) {
      (record.declaration as unknown as Record<string, unknown>)[subKey] = asText(value);
    }
    return;
  }

  if (key in p && typeof (p as unknown as Record<string, unknown>)[key] !== 'object') {
    (p as unknown as Record<string, unknown>)[key] = asText(value);
    return;
  }

  if (key.startsWith('residentialAddress_') || key.startsWith('residentialAddress.')) {
    if (!p.residentialAddress) p.residentialAddress = emptyAddress();
    const subKey = key.replace(/^residentialAddress[_.]/, '') as keyof Address;
    (p.residentialAddress as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }

  if (key.startsWith('permanentAddress_') || key.startsWith('permanentAddress.')) {
    if (!p.permanentAddress) p.permanentAddress = emptyAddress();
    const subKey = key.replace(/^permanentAddress[_.]/, '') as keyof Address;
    (p.permanentAddress as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }

  const family = record.familyBackground;
  if (key.startsWith('spouse_') || key.startsWith('spouse.')) {
    const subKey = key.replace(/^spouse[_.]/, '');
    (family.spouse as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('father_') || key.startsWith('father.')) {
    const subKey = key.replace(/^father[_.]/, '');
    (family.father as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('mother_') || key.startsWith('mother.')) {
    const subKey = key.replace(/^mother[_.]/, '');
    (family.mother as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }

  const childMatch = key.match(/^children_(\d{2})_(fullName|dateOfBirth)$/);
  if (childMatch) {
    const child = ensureIndex(family.children, parseInt(childMatch[1], 10) - 1, createEmptyChild);
    (child as unknown as Record<string, string>)[childMatch[2]] = asText(value);
    return;
  }

  const eligibilityMatch = key.match(
    /^eligibility_(\d{2})_(careerServiceRA1080OrSpecialLaw|rating|dateOfExamConferment|placeOfExamConferment|licenseNumber|licenseValidityDate)$/,
  );
  if (eligibilityMatch) {
    const entry = ensureIndex(
      record.eligibility,
      parseInt(eligibilityMatch[1], 10) - 1,
      createEmptyEligibility,
    );
    (entry as unknown as Record<string, string>)[eligibilityMatch[2]] = asText(value);
    return;
  }

  const workExperienceMatch = key.match(
    /^workExperience_(\d{2})_(inclusiveDatesFrom|inclusiveDatesTo|positionTitle|departmentAgencyOfficeCompany|monthlySalary|salaryJobPayGradeStepIncrement|statusOfAppointment|isGovernmentService)$/,
  );
  if (workExperienceMatch) {
    const entry = ensureIndex(
      record.workExperience,
      parseInt(workExperienceMatch[1], 10) - 1,
      createEmptyWorkExperience,
    );
    const subKey = workExperienceMatch[2];
    if (subKey === 'inclusiveDatesTo') {
      const text = asText(value).trim();
      if (/^present$/i.test(text)) {
        entry.isPresent = true;
        entry.inclusiveDatesTo = '';
      } else {
        entry.isPresent = false;
        entry.inclusiveDatesTo = text;
      }
      return;
    }
    if (subKey === 'isGovernmentService') {
      entry.isGovernmentService = parseGovernmentService(value);
      return;
    }
    (entry as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }

  const trainingMatch = key.match(
    /^trainings_(\d{2})_(title|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|typeOfLD|conductedSponsoredBy)$/,
  );
  if (trainingMatch) {
    const entry = ensureIndex(
      record.trainings,
      parseInt(trainingMatch[1], 10) - 1,
      createEmptyTraining,
    );
    (entry as unknown as Record<string, string>)[trainingMatch[2]] = asText(value);
    return;
  }

  const voluntaryWorkMatch = key.match(
    /^voluntaryWork_(\d{2})_(organizationNameAddress|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|positionNatureOfWork)$/,
  );
  if (voluntaryWorkMatch) {
    const entry = ensureIndex(
      record.voluntaryWork,
      parseInt(voluntaryWorkMatch[1], 10) - 1,
      createEmptyVoluntaryWork,
    );
    (entry as unknown as Record<string, string>)[voluntaryWorkMatch[2]] = asText(value);
    return;
  }

  const otherInfoMatch = key.match(/^otherInfo_(hobbies|distinction|membership)_(\d{2})$/);
  if (otherInfoMatch) {
    const listKey = OTHER_INFO_LIST_KEYS[otherInfoMatch[1]];
    const list = record.otherInfo[listKey];
    const index = parseInt(otherInfoMatch[2], 10) - 1;
    while (list.length <= index) list.push('');
    list[index] = asText(value);
    return;
  }

  const backgroundQuestionMatch = key.match(
    /^backgroundQuestions_(34a|34b|35a|35b|36|37|38a|38b|39|40a|40b|40c)_(y|n|details|dateFiled|statusOfCase)$/,
  );
  if (backgroundQuestionMatch) {
    const questionKey = BACKGROUND_QUESTION_KEY_MAP[backgroundQuestionMatch[1]];
    const question = record.backgroundQuestions[questionKey] as unknown as Record<string, unknown>;
    const suffix = backgroundQuestionMatch[2];
    if (suffix === 'y') {
      if (value === true) question.answer = true;
      return;
    }
    if (suffix === 'n') {
      if (value === true) question.answer = false;
      return;
    }
    if (suffix === 'dateFiled' || suffix === 'statusOfCase') {
      question[suffix] = asText(value);
      return;
    }
    const detailsKey = BACKGROUND_QUESTION_DETAILS_KEY_MAP[questionKey] ?? 'details';
    question[detailsKey] = asText(value);
    return;
  }

  const referenceMatch = key.match(/^references_(\d{2})_(name|officeResidentialAddress|contactNoOrEmail)$/);
  if (referenceMatch) {
    const entry = ensureIndex(
      record.references,
      parseInt(referenceMatch[1], 10) - 1,
      createEmptyReference,
    );
    (entry as unknown as Record<string, string>)[referenceMatch[2]] = asText(value);
    return;
  }

  const edu = record.education;
  if (key.startsWith('elementary_') || key.startsWith('elementary.')) {
    const subKey = key.replace(/^elementary[_.]/, '');
    (edu.elementary as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('secondary_') || key.startsWith('secondary.')) {
    const subKey = key.replace(/^secondary[_.]/, '');
    (edu.secondary as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('vocationalTrade_') || key.startsWith('vocationalTrade.')) {
    const subKey = key.replace(/^vocationalTrade[_.]/, '');
    const entry = ensureIndex(edu.vocationalTrade, 0, createEmptyEducationEntry);
    (entry as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('college_') || key.startsWith('college.')) {
    const subKey = key.replace(/^college[_.]/, '');
    const entry = ensureIndex(edu.college, 0, createEmptyEducationEntry);
    (entry as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('graduateStudies_') || key.startsWith('graduateStudies.')) {
    const subKey = key.replace(/^graduateStudies[_.]/, '');
    const entry = ensureIndex(edu.graduateStudies, 0, createEmptyEducationEntry);
    (entry as unknown as Record<string, string>)[subKey] = asText(value);
    return;
  }
}
```

- [ ] **Step 4: Run setter tests and the reader tests**

Run:

```bash
npx vitest run src/pdfImport/setRecordValueByKey.test.ts src/pdfImport/readPdsAcroFields.test.ts
```

Expected: PASS (all tests in both files).

Then typecheck:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/pdfMap/appDataKeyMaps.ts src/pdfImport/setRecordValueByKey.ts src/pdfImport/setRecordValueByKey.test.ts src/pdfExport/exportPdsPage1.ts
git commit -m "feat(pds): add inverse appDataKey setter for PDF import"
```

---

### Task 3: Detect template and assemble a PdsRecord

**Files:**
- Create: `src/pdfImport/pdsImportMessages.ts`
- Create: `src/pdfImport/importPdsPdf.ts`
- Create: `src/pdfImport/importPdsPdf.test.ts`

**Interfaces:**
- Consumes: `readPdsAcroFieldValues(form: PDFForm): Map<string, string | boolean>`; `setRecordValueByKey(record: PdsRecord, key: string, value: string | boolean): void`; `fieldMap.acroFields` from `src/pdfExport/fieldMap-csc2122016-c1.js`; `createNewPdsRecord()` from `src/db/defaultPdsData.ts`
- Produces:
  - `export type PdsImportErrorCode = 'INVALID_PDF' | 'FLATTENED_OR_SCANNED' | 'UNKNOWN_TEMPLATE' | 'NO_DATA'`
  - `export type PdsImportResult = { ok: true; record: PdsRecord; matchedFieldCount: number; filledFieldCount: number; warnings: string[] } | { ok: false; code: PdsImportErrorCode; message: string }`
  - `export async function importPdsPdf(bytes: ArrayBuffer | Uint8Array): Promise<PdsImportResult>`
  - Constants: `MIN_MAPPED_FIELD_HITS = 50`, `PDS_IMPORT_ERRORS`, `PDS_IMPORT_WARNINGS`

- [ ] **Step 1: Write failing importPdsPdf tests**

Create `src/pdfImport/importPdsPdf.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { importPdsPdf } from './importPdsPdf';
import { PDS_IMPORT_ERRORS, PDS_IMPORT_WARNINGS } from './pdsImportMessages';

function loadTemplateBytes(): Uint8Array {
  return new Uint8Array(
    readFileSync(path.resolve(process.cwd(), 'public/pdf-templates/csc212-2026/pds.pdf')),
  );
}

async function fillUnflattened(values: Record<string, string | boolean>): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(loadTemplateBytes());
  const form = pdf.getForm();
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'boolean') {
      const box = form.getCheckBox(name);
      if (value) box.check();
      else box.uncheck();
    } else {
      form.getTextField(name).setText(value);
    }
  }
  return pdf.save();
}

describe('importPdsPdf', () => {
  it('imports filled personal, family, and question fields from an unflattened PDS PDF', async () => {
    const bytes = await fillUnflattened({
      c1_surname: 'DELA CRUZ',
      c1_firstname: 'JUAN',
      c1_male: true,
      c1_married: true,
      c1_children_name_01: 'ANA DELA CRUZ',
      c1_children_dob_01: '01/02/2010',
      c4_34a_y: true,
      c4_34a_details: 'Cousin in HR',
      c4_govid: 'PhilID',
      c4_idno: '1234',
    });

    const result = await importPdsPdf(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.record.personalInfo.surname).toBe('DELA CRUZ');
    expect(result.record.personalInfo.firstName).toBe('JUAN');
    expect(result.record.personalInfo.sexAtBirth).toBe('Male');
    expect(result.record.personalInfo.civilStatus).toBe('Married');
    expect(result.record.familyBackground.children[0].fullName).toBe('ANA DELA CRUZ');
    expect(result.record.backgroundQuestions.relatedWithinThirdDegree.answer).toBe(true);
    expect(result.record.declaration.governmentIssuedId).toBe('PhilID');
    expect(result.warnings).toContain(PDS_IMPORT_WARNINGS.imagesAndWes);
  });

  it('rejects a PDF with no AcroForm fields (flattened print or scan)', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const result = await importPdsPdf(bytes);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('FLATTENED_OR_SCANNED');
    expect(result.message).toBe(PDS_IMPORT_ERRORS.FLATTENED_OR_SCANNED);
  });

  it('rejects a PDF that is not the 2026 PDS template', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const form = pdf.getForm();
    form.createTextField('unrelated');
    const bytes = await pdf.save();
    const result = await importPdsPdf(bytes);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('UNKNOWN_TEMPLATE');
  });

  it('rejects an empty but recognized PDS template', async () => {
    const result = await importPdsPdf(loadTemplateBytes());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('NO_DATA');
    expect(result.message).toBe(PDS_IMPORT_ERRORS.NO_DATA);
  });

  it('rejects bytes that are not a PDF', async () => {
    const result = await importPdsPdf(new TextEncoder().encode('not a pdf'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('INVALID_PDF');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/pdfImport/importPdsPdf.test.ts
```

Expected: FAIL with `Cannot find module './importPdsPdf'`.

- [ ] **Step 3: Implement detection, mapping, and compacting**

Create `src/pdfImport/pdsImportMessages.ts`:

```ts
export const MIN_MAPPED_FIELD_HITS = 50;

export const PDS_IMPORT_ERRORS = {
  INVALID_PDF: 'This file is not a readable PDF.',
  FLATTENED_OR_SCANNED:
    'This PDF has no fillable form fields. Scanned copies and GovFormsPH print PDFs cannot be imported. Use a fillable CS Form 212 (Revised 2026) PDF, or import a JSON backup.',
  UNKNOWN_TEMPLATE:
    'This PDF is not a CS Form 212 (Revised 2026) fillable form that GovFormsPH recognizes. Field names did not match the official template.',
  NO_DATA: 'This PDS PDF is fillable, but no filled values were found.',
} as const;

export const PDS_IMPORT_WARNINGS = {
  imagesAndWes:
    'Passport photo, signature, thumbmark, and Work Experience Sheet duties are not stored in the PDS form fields. Re-add them in the editor after import.',
} as const;
```

Create `src/pdfImport/importPdsPdf.ts`:

```ts
import { PDFDocument } from 'pdf-lib';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { fieldMap } from '../pdfExport/fieldMap-csc2122016-c1.js';
import { Address, ChildItem, PdsRecord } from '../types/pds';
import { MIN_MAPPED_FIELD_HITS, PDS_IMPORT_ERRORS, PDS_IMPORT_WARNINGS } from './pdsImportMessages';
import { readPdsAcroFieldValues } from './readPdsAcroFields';
import { setRecordValueByKey } from './setRecordValueByKey';

export type PdsImportErrorCode = keyof typeof PDS_IMPORT_ERRORS;

export type PdsImportResult =
  | {
      ok: true;
      record: PdsRecord;
      matchedFieldCount: number;
      filledFieldCount: number;
      warnings: string[];
    }
  | {
      ok: false;
      code: PdsImportErrorCode;
      message: string;
    };

const acroFields: Record<string, string> = fieldMap.acroFields;

function addressesEqual(a: Address, b: Address): boolean {
  return (
    a.houseBlockLot === b.houseBlockLot &&
    a.street === b.street &&
    a.subdivisionVillage === b.subdivisionVillage &&
    a.barangay === b.barangay &&
    a.cityMunicipality === b.cityMunicipality &&
    a.province === b.province &&
    a.zipCode === b.zipCode
  );
}

function isFilledAddress(a: Address): boolean {
  return Object.values(a).some((part) => part.trim() !== '');
}

function compactBy<T>(items: T[], isFilled: (item: T) => boolean, fallback: T[]): T[] {
  const filled = items.filter(isFilled);
  return filled.length > 0 ? filled : fallback;
}

function isFilledChild(child: ChildItem): boolean {
  return Boolean(child.fullName.trim() || child.dateOfBirth.trim());
}

function compactRecord(record: PdsRecord, blank: PdsRecord): void {
  record.familyBackground.children = compactBy(
    record.familyBackground.children,
    isFilledChild,
    blank.familyBackground.children,
  );
  record.eligibility = compactBy(
    record.eligibility,
    (row) =>
      Boolean(
        row.careerServiceRA1080OrSpecialLaw.trim() ||
          row.rating.trim() ||
          row.dateOfExamConferment.trim() ||
          row.placeOfExamConferment.trim() ||
          row.licenseNumber.trim() ||
          row.licenseValidityDate.trim(),
      ),
    blank.eligibility,
  );
  record.workExperience = compactBy(
    record.workExperience,
    (row) =>
      Boolean(
        row.positionTitle.trim() ||
          row.departmentAgencyOfficeCompany.trim() ||
          row.inclusiveDatesFrom.trim() ||
          row.inclusiveDatesTo.trim() ||
          row.isPresent,
      ),
    blank.workExperience,
  );
  record.trainings = compactBy(
    record.trainings,
    (row) => Boolean(row.title.trim() || row.conductedSponsoredBy.trim()),
    blank.trainings,
  );
  record.voluntaryWork = compactBy(
    record.voluntaryWork,
    (row) => Boolean(row.organizationNameAddress.trim() || row.positionNatureOfWork.trim()),
    blank.voluntaryWork,
  );
  record.references = compactBy(
    record.references,
    (row) => Boolean(row.name.trim() || row.officeResidentialAddress.trim() || row.contactNoOrEmail.trim()),
    blank.references,
  );
  record.otherInfo.specialSkillsHobbies = compactBy(
    record.otherInfo.specialSkillsHobbies,
    (item) => item.trim() !== '',
    blank.otherInfo.specialSkillsHobbies,
  );
  record.otherInfo.nonAcademicDistinctions = compactBy(
    record.otherInfo.nonAcademicDistinctions,
    (item) => item.trim() !== '',
    blank.otherInfo.nonAcademicDistinctions,
  );
  record.otherInfo.membershipInAssociations = compactBy(
    record.otherInfo.membershipInAssociations,
    (item) => item.trim() !== '',
    blank.otherInfo.membershipInAssociations,
  );
}

export async function importPdsPdf(bytes: ArrayBuffer | Uint8Array): Promise<PdsImportResult> {
  let pdf;
  try {
    pdf = await PDFDocument.load(bytes);
  } catch {
    return { ok: false, code: 'INVALID_PDF', message: PDS_IMPORT_ERRORS.INVALID_PDF };
  }

  const form = pdf.getForm();
  const pdfFieldNames = new Set(form.getFields().map((field) => field.getName()));

  if (pdfFieldNames.size === 0) {
    return {
      ok: false,
      code: 'FLATTENED_OR_SCANNED',
      message: PDS_IMPORT_ERRORS.FLATTENED_OR_SCANNED,
    };
  }

  const mappedPdfNames = Object.values(acroFields);
  const matchedFieldCount = mappedPdfNames.filter((name) => pdfFieldNames.has(name)).length;

  if (matchedFieldCount < MIN_MAPPED_FIELD_HITS) {
    return {
      ok: false,
      code: 'UNKNOWN_TEMPLATE',
      message: PDS_IMPORT_ERRORS.UNKNOWN_TEMPLATE,
    };
  }

  const values = readPdsAcroFieldValues(form);
  const blank = createNewPdsRecord();
  const record = createNewPdsRecord();
  record.personalInfo.citizenship = '';
  record.meta.title = 'Imported PDS';

  let filledFieldCount = 0;
  for (const [appDataKey, pdfFieldName] of Object.entries(acroFields)) {
    if (!values.has(pdfFieldName)) continue;
    const value = values.get(pdfFieldName) as string | boolean;
    const emptyText = typeof value === 'string' && value.trim() === '';
    const unchecked = value === false;
    if (emptyText || unchecked) continue;
    setRecordValueByKey(record, appDataKey, value);
    filledFieldCount++;
  }

  if (
    !record.personalInfo.surname.trim() &&
    !record.personalInfo.firstName.trim() &&
    filledFieldCount === 0
  ) {
    return { ok: false, code: 'NO_DATA', message: PDS_IMPORT_ERRORS.NO_DATA };
  }

  compactRecord(record, blank);

  if (
    isFilledAddress(record.personalInfo.residentialAddress) &&
    addressesEqual(record.personalInfo.residentialAddress, record.personalInfo.permanentAddress)
  ) {
    record.personalInfo.sameAsResidentialAddress = true;
  }

  const surname = record.personalInfo.surname.trim();
  const firstName = record.personalInfo.firstName.trim();
  if (surname || firstName) {
    record.meta.title = [surname, firstName].filter(Boolean).join(', ') + ' (Imported PDS)';
  }

  return {
    ok: true,
    record,
    matchedFieldCount,
    filledFieldCount,
    warnings: [PDS_IMPORT_WARNINGS.imagesAndWes],
  };
}
```

- [ ] **Step 4: Run import tests**

Run:

```bash
npx vitest run src/pdfImport/importPdsPdf.test.ts src/pdfImport/setRecordValueByKey.test.ts src/pdfImport/readPdsAcroFields.test.ts
```

Expected: PASS.

Detection rules (already in `importPdsPdf`; do not add extra branches here):

- `pdfFieldNames.size === 0` → `FLATTENED_OR_SCANNED` (GovFormsPH print PDFs, scans, empty PDF)
- `matchedFieldCount < MIN_MAPPED_FIELD_HITS` → `UNKNOWN_TEMPLATE` (includes PDFs that have fields but none of them match `fieldMap.acroFields`)
- `matchedFieldCount >= MIN_MAPPED_FIELD_HITS` and no filled values → `NO_DATA`

- [ ] **Step 5: Commit**

```bash
git add src/pdfImport/pdsImportMessages.ts src/pdfImport/importPdsPdf.ts src/pdfImport/importPdsPdf.test.ts
git commit -m "feat(pds): parse fillable CS Form 212 PDFs into PdsRecord"
```

---

### Task 4: Route File uploads through parseImportSource

**Files:**
- Modify: `src/utils/exportImport.ts`
- Create: `src/utils/exportImport.parseImportSource.test.ts`

**Interfaces:**
- Consumes: `parseImportFile(fileContent: string, passphrase?: string)` (existing); `importPdsPdf(bytes: ArrayBuffer | Uint8Array): Promise<PdsImportResult>`
- Produces:
  - `export type ImportSourceKind = 'json-bundle' | 'json-single' | 'json-array' | 'pds-pdf'`
  - `export interface ImportPreview { success: boolean; records: PdsRecord[]; salnRecords: SalnRecord[]; settings?: AppSettings; isEncrypted: boolean; requiresPassword?: boolean; error?: string; sourceKind?: ImportSourceKind; warnings?: string[] }`
  - `export async function parseImportSource(file: File, passphrase?: string): Promise<ImportPreview>`
  - Existing `parseImportFile` stays and is updated to return `sourceKind` for JSON shapes (`json-single`, `json-bundle`, `json-array`)

- [ ] **Step 1: Write failing dispatcher tests**

Create `src/utils/exportImport.parseImportSource.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { parseImportFile, parseImportSource } from './exportImport';
import { PDS_IMPORT_ERRORS } from '../pdfImport/pdsImportMessages';

function loadTemplateBytes(): Uint8Array {
  return new Uint8Array(
    readFileSync(path.resolve(process.cwd(), 'public/pdf-templates/csc212-2026/pds.pdf')),
  );
}

describe('parseImportSource', () => {
  it('routes a .pdf file to PDS PDF import', async () => {
    const pdf = await PDFDocument.load(loadTemplateBytes());
    pdf.getForm().getTextField('c1_surname').setText('DELA CRUZ');
    pdf.getForm().getTextField('c1_firstname').setText('JUAN');
    const bytes = await pdf.save();
    const file = new File([bytes], 'pds.pdf', { type: 'application/pdf' });

    const preview = await parseImportSource(file);
    expect(preview.success).toBe(true);
    expect(preview.sourceKind).toBe('pds-pdf');
    expect(preview.records).toHaveLength(1);
    expect(preview.records[0].personalInfo.surname).toBe('DELA CRUZ');
    expect(preview.salnRecords).toEqual([]);
    expect(preview.warnings?.length).toBeGreaterThan(0);
  });

  it('keeps JSON single-form import working', async () => {
    const json = JSON.stringify({
      version: '1.0',
      exportedAt: '2026-01-01T00:00:00.000Z',
      source: 'GovFormsPH',
      type: 'single-form',
      formVersion: 'CS-Form-212-2026',
      record: {
        meta: { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', formVersion: 'CS-Form-212-2026', title: 'Test' },
        personalInfo: { surname: 'REYES', firstName: 'MARIA' },
      },
    });
    const file = new File([json], 'pds-reyes.json', { type: 'application/json' });
    const preview = await parseImportSource(file);
    expect(preview.success).toBe(true);
    expect(preview.sourceKind).toBe('json-single');
    expect(preview.records[0].personalInfo.surname).toBe('REYES');
  });

  it('returns the PDS flattened error for a PDF with no mapped fields', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const file = new File([bytes], 'scan.pdf', { type: 'application/pdf' });
    const preview = await parseImportSource(file);
    expect(preview.success).toBe(false);
    expect(preview.sourceKind).toBe('pds-pdf');
    expect(preview.error).toBe(PDS_IMPORT_ERRORS.FLATTENED_OR_SCANNED);
  });
});

describe('parseImportFile sourceKind', () => {
  it('tags a single-form JSON bundle', async () => {
    const parsed = await parseImportFile(
      JSON.stringify({ type: 'single-form', record: { meta: {}, personalInfo: { surname: 'A' } } }),
    );
    expect(parsed.sourceKind).toBe('json-single');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npx vitest run src/utils/exportImport.parseImportSource.test.ts
```

Expected: FAIL because `parseImportSource` is not exported and `sourceKind` is missing.

- [ ] **Step 3: Add ImportPreview and parseImportSource**

In `src/utils/exportImport.ts`, add this import at the top with the other imports:

```ts
import { importPdsPdf } from '../pdfImport/importPdsPdf';
```

Replace the inline return type of `parseImportFile` with these exported types placed above `exportAllData`:

```ts
export type ImportSourceKind = 'json-bundle' | 'json-single' | 'json-array' | 'pds-pdf';

export interface ImportPreview {
  success: boolean;
  records: PdsRecord[];
  salnRecords: SalnRecord[];
  settings?: AppSettings;
  isEncrypted: boolean;
  requiresPassword?: boolean;
  error?: string;
  sourceKind?: ImportSourceKind;
  warnings?: string[];
}
```

Change `parseImportFile` signature to `Promise<ImportPreview>`. On the `parsed.type === 'single-form'` success return, add `sourceKind: 'json-single'`. On encrypted and plain `ExportBundle` success returns, add `sourceKind: 'json-bundle'`. On direct-array success return, add `sourceKind: 'json-array'`. Leave failure returns without a sourceKind.

Add `parseImportSource` after `parseImportFile`:

```ts
function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === 'application/pdf' || name.endsWith('.pdf');
}

export async function parseImportSource(
  file: File,
  passphrase?: string,
): Promise<ImportPreview> {
  if (isPdfFile(file)) {
    const result = await importPdsPdf(await file.arrayBuffer());
    if (!result.ok) {
      return {
        success: false,
        records: [],
        salnRecords: [],
        isEncrypted: false,
        sourceKind: 'pds-pdf',
        error: result.message,
      };
    }
    return {
      success: true,
      records: [result.record],
      salnRecords: [],
      isEncrypted: false,
      sourceKind: 'pds-pdf',
      warnings: result.warnings,
    };
  }

  const text = await file.text();
  return parseImportFile(text, passphrase);
}
```

- [ ] **Step 4: Run dispatcher tests and the PDF import suite**

Run:

```bash
npx vitest run src/utils/exportImport.parseImportSource.test.ts src/pdfImport
npx tsc --noEmit
```

Expected: all tests PASS, `tsc` exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportImport.ts src/utils/exportImport.parseImportSource.test.ts
git commit -m "feat(import): route PDF uploads through parseImportSource"
```

---

### Task 5: Export & Import UI + docs

**Files:**
- Create: `src/pages/exportImportUi.ts`
- Create: `src/pages/exportImportUi.test.ts`
- Modify: `src/pages/ExportImportPage.tsx`
- Modify: `README.md` (Client-Side Export & Import bullet list)
- Modify: `CONTRIBUTING.md` (architecture tree)

**Interfaces:**
- Consumes: `parseImportSource(file: File, passphrase?: string): Promise<ImportPreview>`; `ImportPreview.sourceKind`; `ImportPreview.warnings`; `ImportPreview.error`
- Produces: `IMPORT_FILE_ACCEPT: string`; `IMPORT_DROPZONE_HINT: string`; `isPdfImport(preview: ImportPreview | null): boolean`; `effectiveImportMode(preview: ImportPreview | null, selected: 'merge' | 'replace'): 'merge' | 'replace'`

- [ ] **Step 1: Write a failing UI contract test for file accept + merge forcing**

There is no React Testing Library in this repo. Do **not** add it. Cover the UI contract with a pure helper in `src/pages/exportImportUi.ts` (created in Step 3).

Create `src/pages/exportImportUi.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { effectiveImportMode, IMPORT_FILE_ACCEPT, isPdfImport } from './exportImportUi';
import { ImportPreview } from '../utils/exportImport';

const pdfPreview: ImportPreview = {
  success: true,
  records: [],
  salnRecords: [],
  isEncrypted: false,
  sourceKind: 'pds-pdf',
};

describe('exportImportUi', () => {
  it('accepts PDF files in the hidden file input', () => {
    expect(IMPORT_FILE_ACCEPT).toContain('.pdf');
    expect(IMPORT_FILE_ACCEPT).toContain('application/pdf');
  });

  it('forces merge for PDS PDF imports even if replace is selected', () => {
    expect(isPdfImport(pdfPreview)).toBe(true);
    expect(effectiveImportMode(pdfPreview, 'replace')).toBe('merge');
    expect(effectiveImportMode({ ...pdfPreview, sourceKind: 'json-bundle' }, 'replace')).toBe(
      'replace',
    );
  });
});
```

- [ ] **Step 2: Run the UI helper test to verify it fails**

Run:

```bash
npx vitest run src/pages/exportImportUi.test.ts
```

Expected: FAIL with `Cannot find module './exportImportUi'`.

- [ ] **Step 3: Implement the helper and wire the page**

Create `src/pages/exportImportUi.ts`:

```ts
import { ImportPreview } from '../utils/exportImport';

export const IMPORT_FILE_ACCEPT = '.json,.vault,.pdf,application/json,application/pdf';

export const IMPORT_DROPZONE_HINT =
  'Supports .GovFormsPH.json, .vault, individual form JSON, or a fillable CS Form 212 (Revised 2026) PDF';

export function isPdfImport(preview: ImportPreview | null): boolean {
  return preview?.sourceKind === 'pds-pdf';
}

export function effectiveImportMode(
  preview: ImportPreview | null,
  selected: 'merge' | 'replace',
): 'merge' | 'replace' {
  return isPdfImport(preview) ? 'merge' : selected;
}
```

Then update `src/pages/ExportImportPage.tsx`.

Add imports:

```ts
import { parseImportSource } from '../utils/exportImport';
import {
  IMPORT_DROPZONE_HINT,
  IMPORT_FILE_ACCEPT,
  effectiveImportMode,
  isPdfImport,
} from './exportImportUi';
import { AlertCircle } from 'lucide-react';
```

Remove the unused `parseImportFile` import if it is no longer referenced. Keep `exportAllData`, `restoreRecords`, `triggerDownload`.

Replace `importFileContent` state with:

```ts
const [importFile, setImportFile] = useState<File | null>(null);
```

Replace `handleFileSelect` with:

```ts
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFileName(file.name);
      setImportFile(file);
      setImportSuccessMessage(null);
      const parsed = await parseImportSource(file, importPassphrase);
      setImportPreview(parsed);
    }
  };
```

Replace `handleDecryptAttempt` with:

```ts
  const handleDecryptAttempt = async () => {
    if (!importFile) return;
    const parsed = await parseImportSource(importFile, importPassphrase);
    setImportPreview(parsed);
  };
```

In `handleExecuteImport`, compute the mode with `effectiveImportMode(importPreview, importMode)` and pass that to `restoreRecords`.

Change the hidden file input `accept` to `{IMPORT_FILE_ACCEPT}`.

Replace the drop-zone hint paragraph with `{IMPORT_DROPZONE_HINT}`.

Replace the intro paragraph under Import & Restore:

```tsx
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Select a <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.json</code>,{' '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.vault</code>, or fillable{' '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.pdf</code> CS Form 212 (Revised 2026).
          </p>
```

Immediately after the drop-zone `div`, render errors that are not password prompts:

```tsx
          {importPreview && !importPreview.success && !importPreview.requiresPassword && importPreview.error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{importPreview.error}</span>
            </div>
          )}
```

Inside the success preview, after the "Found N Form(s)" row, if `importPreview.warnings?.length`, render:

```tsx
              {importPreview.warnings?.map((warning) => (
                <p key={warning} className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  {warning}
                </p>
              ))}
```

Wrap the Replace radio so it is hidden when `isPdfImport(importPreview)` is true. Keep Merge selected. Update the confirm button label to stay `Confirm & Restore {importPreview.records.length} Form(s)`.

Clear `importFile` alongside the other resets in `handleExecuteImport` after success (`setImportFile(null)`).

In `README.md`, replace the round-trip import bullet under **Client-Side Export & Import** with these two bullets:

```markdown
  - Round-trip JSON import to restore or transfer forms between devices.
  - Import a **fillable** CS Form 212 (Revised 2026) PDF whose fields match the official template. Scanned copies and GovFormsPH print PDFs (flattened) cannot be imported; photo, signature, thumbmark, and WES duties must be re-added in the editor.
```

In `CONTRIBUTING.md`, add this line under `src/` in the architecture tree:

```
├── pdfImport/          # Fillable CS Form 212 PDF → PdsRecord
```

- [ ] **Step 4: Run tests, typecheck, and build**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected:

- Vitest: all tests PASS
- `tsc`: exit 0
- `npm run build`: production build succeeds

Manual check after `npm run dev` (do this in the same task before commit):

1. Open Export & Import. Drop-zone text mentions fillable PDF.
2. Upload `public/pdf-templates/csc212-2026/pds.pdf` (blank template) → rose error: `This PDS PDF is fillable, but no filled values were found.`
3. Upload any flattened print PDF (export one from Print / PDF) → rose error about scanned/print PDFs.
4. Upload a JSON backup → existing merge/replace UI still appears, including Replace.
5. For a filled unflattened PDS PDF (create in the Vitest helper, save fixture to `/tmp/filled-pds.pdf` during manual check if needed) → preview shows 1 form, warning about photo/signature, no Replace radio, Confirm creates a new dashboard record named `{surname}, {firstName} (Imported PDS)`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/exportImportUi.ts src/pages/exportImportUi.test.ts src/pages/ExportImportPage.tsx README.md CONTRIBUTING.md
git commit -m "feat(import): accept fillable PDS PDFs on Export & Import"
```

---

## Self-Review

**1. Spec coverage**

| Requirement | Task |
|---|---|
| Import the actual PDS file (fillable PDF), not only JSON | 1–5 |
| Reuse existing AcroForm field map | 3 |
| Inverse of `getRecordValueByKey` | 2 |
| Reject flattened GovFormsPH print PDFs and scans | 3, 4, 5 |
| Reject unknown / non-2026 templates | 3 |
| Reject empty template | 3 |
| Show errors on the Import card (today they are swallowed) | 5 |
| PDF import is merge-only | 5 |
| Warn that photo/signature/thumbmark/WES are missing | 3, 5 |
| Client-side pdf-lib only | Global + Task 1 |
| Docs | 5 |
| No OCR / Excel / SALN / 2017 map / unflatten export | Global Constraints |

**2. Placeholder scan:** No TBD, TODO, “implement later”, or “similar to Task N” steps. Each code step includes the full file or the exact patch.

**3. Type consistency:** `ImportPreview`, `ImportSourceKind`, `PdsImportResult`, `PdsImportErrorCode`, `setRecordValueByKey`, `readPdsAcroFieldValues`, `importPdsPdf`, `parseImportSource`, `effectiveImportMode` names and signatures match across tasks. Error strings live only in `PDS_IMPORT_ERRORS` / `PDS_IMPORT_WARNINGS`.
