# PDS PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user import a filled official CS Form No. 212 (Revised 2026) fillable PDF on Export & Import and get a new editable PDS draft, without changing JSON backup restore.

**Architecture:** Keep JSON parsing as it is. Add a PDF path that (1) reads AcroForm values with `pdf-lib`, (2) writes them onto `createNewPdsRecord()` through `setRecordValueByKey`, the inverse of the existing `getRecordValueByKey` + `fieldMap.acroFields` table, and (3) restores that single record with merge-only. Flattened prints, scans, Excel/Word, and photo/signature/WES duties stay out of this feature.

**Tech Stack:** React 18, TypeScript, Vite 6, Dexie, pdf-lib 1.17.1 (already in dependencies), Vitest (new, tests only).

## Global Constraints

- Client-side only: no backend, no upload, no new network calls, no new runtime dependencies besides Vitest.
- Import the official CS Form 212 Revised 2026 **fillable AcroForm PDF** (`pds.pdf` field names). JSON / encrypted vault restore must keep working.
- Reuse `src/pdfExport/fieldMap-csc2122016-c1.js` `acroFields` as-is. Do not “fix” swapped or truncated PDF field names in this feature.
- Sentinel fields for template detection: `c1_surname`, `c1_firstname`, `c1_birthdate`.
- PDF import always merges one new `PdsRecord`. Never offer Replace-all for a PDF.
- Do not import photo, signature, thumbmark, or `wesDetails`.
- `generatePdsPage1Pdf` still flattens; those printed PDFs must fail with a clear error, not a corrupt draft.
- UI copy is English. Lucide SVG icons only. No emoji icons.
- Dates: convert `yyyy-mm-dd` with `formatDateToDMY`; otherwise store the string as-is.
- Node 18+ / existing `npm test` once added must be `vitest run`.

**Spec:** `docs/superpowers/specs/2026-10-23-pds-pdf-import-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `src/pdfExport/recordValueByKey.ts` | Shared `parseDMYDate`, `getRecordValueByKey` (moved), and new `setRecordValueByKey`. |
| `src/pdfExport/exportPdsPage1.ts` | PDF fill/export only. Imports mapping helpers from `recordValueByKey.ts`. |
| `src/pdfImport/extractAcroFieldValues.ts` | Load PDF bytes → field name/value map. No PDS schema knowledge. |
| `src/pdfImport/importPdsPdf.ts` | Detect CS Form 212 template, apply field map, trim empty rows, collect warnings. |
| `src/utils/exportImport.ts` | Add `ImportFileLike`, `parseImportSource`, `isPdfFile`. Keep `parseImportFile` for JSON strings. |
| `src/pages/ExportImportPage.tsx` | Accept `.pdf`, show PDF preview/warnings, hide Replace for PDF. |
| `src/pdfExport/recordValueByKey.test.ts` | Mapping round-trips and exclusive checkboxes. |
| `src/pdfImport/extractAcroFieldValues.test.ts` | Synthetic pdf-lib form extraction and encrypted-PDF detection. |
| `src/pdfImport/importPdsPdf.test.ts` | Template detection, mapping, blank/flattened/encrypted errors. |
| `src/utils/exportImport.test.ts` | JSON vs PDF routing. |
| `vitest.config.ts` | Node environment, `src/**/*.test.ts`. |
| `package.json` | `test` / `test:watch` scripts + `vitest` devDependency. |
| `README.md` | One bullet that fillable PDS PDFs can be imported. |

Do not add OCR libraries, Excel parsers, or SALN PDF import in this plan.

---

### Task 1: Record key setter (inverse of export mapping)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/pdfExport/recordValueByKey.ts`
- Create: `src/pdfExport/recordValueByKey.test.ts`
- Modify: `package.json` (add `vitest` and scripts)
- Modify: `src/pdfExport/exportPdsPage1.ts` (delete moved helpers; import them)
- Modify: `src/forms/pds/PdsPrintPreview.tsx` (import `parseDMYDate` from `recordValueByKey.ts`)

**Interfaces:**
- Consumes: `PdsRecord` in `src/types/pds.ts`; empty-row factories and `createNewPdsRecord` in `src/db/defaultPdsData.ts`; `formatDateToDMY` in `src/utils/dateUtils.ts`; existing `getRecordValueByKey` behavior in `src/pdfExport/exportPdsPage1.ts`.
- Produces: `parseDMYDate(value: string | undefined): number`; `getRecordValueByKey(record: PdsRecord, key: string): any`; `setRecordValueByKey(record: PdsRecord, key: string, value: unknown): void`.

- [ ] **Step 1: Install Vitest and add config**

```bash
npm install -D vitest@^3.2.0
```

Replace the `scripts` block in `package.json` with:

```json
  "scripts": {
    "dev": "vite",
    "predev": "node scripts/parse-changelog.js",
    "build": "tsc && vite build",
    "prebuild": "node scripts/parse-changelog.js",
    "preview": "vite preview",
    "release": "standard-version",
    "test": "vitest run",
    "test:watch": "vitest"
  },
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

- [ ] **Step 2: Write the failing tests**

Create `src/pdfExport/recordValueByKey.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { getRecordValueByKey, setRecordValueByKey } from './recordValueByKey';

describe('setRecordValueByKey', () => {
  it('writes personal info and address keys that getRecordValueByKey can read back', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'surname', 'DELA CRUZ');
    setRecordValueByKey(record, 'firstName', 'JUAN');
    setRecordValueByKey(record, 'dateOfBirth', '1990-05-17');
    setRecordValueByKey(record, 'residentialAddress_barangay', 'San Isidro');
    setRecordValueByKey(record, 'residentialAddress_cityMunicipality', 'Quezon City');

    expect(getRecordValueByKey(record, 'surname')).toBe('DELA CRUZ');
    expect(getRecordValueByKey(record, 'firstName')).toBe('JUAN');
    expect(getRecordValueByKey(record, 'dateOfBirth')).toBe('17/05/1990');
    expect(getRecordValueByKey(record, 'residentialAddress_barangay')).toBe('San Isidro');
    expect(record.personalInfo.residentialAddress.cityMunicipality).toBe('Quezon City');
  });

  it('applies exclusive checkbox groups only when checked', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'sexAtBirth_female', false);
    setRecordValueByKey(record, 'sexAtBirth_male', true);
    setRecordValueByKey(record, 'civilStatus_single', false);
    setRecordValueByKey(record, 'civilStatus_married', true);
    setRecordValueByKey(record, 'citizenship_filipino', false);
    setRecordValueByKey(record, 'citizenship_dual', true);
    setRecordValueByKey(record, 'dualCitizenship_byNaturalization', true);

    expect(record.personalInfo.sexAtBirth).toBe('Male');
    expect(record.personalInfo.civilStatus).toBe('Married');
    expect(record.personalInfo.citizenship).toBe('Dual Citizenship');
    expect(record.personalInfo.dualCitizenshipMode).toBe('by naturalization');
    expect(getRecordValueByKey(record, 'sexAtBirth_male')).toBe(true);
    expect(getRecordValueByKey(record, 'sexAtBirth_female')).toBe(false);
  });

  it('grows indexed children and eligibility rows', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'children_03_fullName', 'Ana Dela Cruz');
    setRecordValueByKey(record, 'children_03_dateOfBirth', '12/12/2012');
    setRecordValueByKey(record, 'eligibility_02_rating', '85.00');
    setRecordValueByKey(record, 'eligibility_02_careerServiceRA1080OrSpecialLaw', 'Career Service Professional');

    expect(record.familyBackground.children[2].fullName).toBe('Ana Dela Cruz');
    expect(record.familyBackground.children[2].dateOfBirth).toBe('12/12/2012');
    expect(record.eligibility[1].rating).toBe('85.00');
    expect(getRecordValueByKey(record, 'eligibility_02_rating')).toBe('85.00');
  });

  it('maps work experience PRESENT and Y/N without using the sorted getter', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'workExperience_01_positionTitle', 'Administrative Officer II');
    setRecordValueByKey(record, 'workExperience_01_inclusiveDatesFrom', '01/01/2020');
    setRecordValueByKey(record, 'workExperience_01_inclusiveDatesTo', 'PRESENT');
    setRecordValueByKey(record, 'workExperience_01_isGovernmentService', 'Y');

    expect(record.workExperience[0].positionTitle).toBe('Administrative Officer II');
    expect(record.workExperience[0].isPresent).toBe(true);
    expect(record.workExperience[0].inclusiveDatesTo).toBe('');
    expect(record.workExperience[0].isGovernmentService).toBe(true);
  });

  it('maps background yes/no and government-id date/place split', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'backgroundQuestions_34a_n', true);
    setRecordValueByKey(record, 'backgroundQuestions_40c_y', true);
    setRecordValueByKey(record, 'backgroundQuestions_40c_details', 'SP-123');
    setRecordValueByKey(record, 'declaration_governmentIssuedId', 'Passport');
    setRecordValueByKey(record, 'declaration_dateAndPlaceOfIssuance', '01/02/2024, DFA Manila');

    expect(record.backgroundQuestions.relatedWithinThirdDegree.answer).toBe(false);
    expect(record.backgroundQuestions.soloParent.answer).toBe(true);
    expect(record.backgroundQuestions.soloParent.soloParentIdNo).toBe('SP-123');
    expect(record.declaration.governmentIssuedId).toBe('Passport');
    expect(record.declaration.dateOfIssuance).toBe('01/02/2024');
    expect(record.declaration.placeOfIssuance).toBe('DFA Manila');
  });

  it('ignores empty values so createNewPdsRecord defaults remain', () => {
    const record = createNewPdsRecord();
    setRecordValueByKey(record, 'surname', 'REYES');
    setRecordValueByKey(record, 'surname', '');
    setRecordValueByKey(record, 'citizenship_dual', false);
    expect(record.personalInfo.surname).toBe('REYES');
    expect(record.personalInfo.citizenship).toBe('Filipino');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/pdfExport/recordValueByKey.test.ts`

Expected: FAIL with `Cannot find module './recordValueByKey'` (or `setRecordValueByKey is not a function` if the file exists empty).

- [ ] **Step 4: Move `parseDMYDate` / `getRecordValueByKey` and add `setRecordValueByKey`**

Create `src/pdfExport/recordValueByKey.ts` with the complete contents below.

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
import { PdsRecord } from '../types/pds';
import { formatDateToDMY } from '../utils/dateUtils';

/** Parses a strict dd/mm/yyyy string to epoch ms; returns 0 for blank/invalid/out-of-range dates. */
export function parseDMYDate(value: string | undefined): number {
  if (!value) return 0;
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return 0;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date.getTime()
    : 0;
}

/**
 * Extract value from PdsRecord by appDataKey.
 * Supports:
 * - Direct personalInfo fields (e.g. 'surname', 'firstName', 'dateOfBirth')
 * - Address sub-fields with underscore or dot (e.g. 'residentialAddress_houseBlockLot')
 * - Family background / Education / Top-level properties
 */
export function getRecordValueByKey(record: PdsRecord, key: string): any {
  if (!record) return '';

  const p = record.personalInfo || {};

  const civilStatusCheckboxKeys: Record<string, string[]> = {
    civilStatus_single: ['Single'],
    civilStatus_married: ['Married'],
    civilStatus_widowed: ['Widow/er'],
    civilStatus_separated: ['Separated'],
    civilStatus_others: ['Others', 'Solo Parent'],
  };
  switch (key) {
    case 'sexAtBirth_male':
      return p.sexAtBirth === 'Male';
    case 'sexAtBirth_female':
      return p.sexAtBirth === 'Female';
    case 'citizenship_filipino':
      return p.citizenship === 'Filipino';
    case 'citizenship_dual':
      return p.citizenship === 'Dual Citizenship';
    case 'dualCitizenship_byBirth':
      return p.dualCitizenshipMode === 'by birth';
    case 'dualCitizenship_byNaturalization':
      return p.dualCitizenshipMode === 'by naturalization';
    case 'signature':
    case 'signature_page4':
      return record.declaration?.signature ?? '';
    case 'declaration_dateAndPlaceOfIssuance': {
      const d = record.declaration;
      return d ? [d.dateOfIssuance, d.placeOfIssuance].filter(Boolean).join(', ') : '';
    }
    default:
      if (key in civilStatusCheckboxKeys) {
        return civilStatusCheckboxKeys[key].includes(p.civilStatus as string);
      }
  }

  if (key.startsWith('declaration_') || key.startsWith('declaration.')) {
    const subKey = key.replace(/^declaration[_.]/, '');
    return record.declaration ? (record.declaration as any)[subKey] ?? '' : '';
  }

  if (key in p) {
    return (p as any)[key];
  }

  if (key.startsWith('residentialAddress_') || key.startsWith('residentialAddress.')) {
    const subKey = key.replace(/^residentialAddress[_.]/, '');
    return p.residentialAddress ? (p.residentialAddress as any)[subKey] ?? '' : '';
  }

  if (key.startsWith('permanentAddress_') || key.startsWith('permanentAddress.')) {
    const subKey = key.replace(/^permanentAddress[_.]/, '');
    if (p.sameAsResidentialAddress && p.residentialAddress) {
      return (p.residentialAddress as any)[subKey] ?? '';
    }
    return p.permanentAddress ? (p.permanentAddress as any)[subKey] ?? '' : '';
  }

  const f = record.familyBackground || {};
  if (key.startsWith('spouse_') || key.startsWith('spouse.')) {
    const subKey = key.replace(/^spouse[_.]/, '');
    return f.spouse ? (f.spouse as any)[subKey] ?? '' : '';
  }
  if (key.startsWith('father_') || key.startsWith('father.')) {
    const subKey = key.replace(/^father[_.]/, '');
    return f.father ? (f.father as any)[subKey] ?? '' : '';
  }
  if (key.startsWith('mother_') || key.startsWith('mother.')) {
    const subKey = key.replace(/^mother[_.]/, '');
    return f.mother ? (f.mother as any)[subKey] ?? '' : '';
  }

  const childMatch = key.match(/^children_(\d{2})_(fullName|dateOfBirth)$/);
  if (childMatch) {
    const child = f.children?.[parseInt(childMatch[1], 10) - 1];
    return child ? (child as any)[childMatch[2]] ?? '' : '';
  }

  const eligibilityMatch = key.match(
    /^eligibility_(\d{2})_(careerServiceRA1080OrSpecialLaw|rating|dateOfExamConferment|placeOfExamConferment|licenseNumber|licenseValidityDate)$/
  );
  if (eligibilityMatch) {
    const entry = record.eligibility?.[parseInt(eligibilityMatch[1], 10) - 1];
    return entry ? (entry as any)[eligibilityMatch[2]] ?? '' : '';
  }

  const workExperienceMatch = key.match(
    /^workExperience_(\d{2})_(inclusiveDatesFrom|inclusiveDatesTo|positionTitle|departmentAgencyOfficeCompany|monthlySalary|salaryJobPayGradeStepIncrement|statusOfAppointment|isGovernmentService)$/
  );
  if (workExperienceMatch) {
    const sortedWorkExperience = [...(record.workExperience ?? [])].sort((first, second) => {
      if (first.isPresent !== second.isPresent) return first.isPresent ? -1 : 1;
      const firstDate = parseDMYDate(first.inclusiveDatesTo) || parseDMYDate(first.inclusiveDatesFrom);
      const secondDate = parseDMYDate(second.inclusiveDatesTo) || parseDMYDate(second.inclusiveDatesFrom);
      return secondDate - firstDate;
    });
    const entry = sortedWorkExperience[parseInt(workExperienceMatch[1], 10) - 1];
    if (!entry) return '';
    const subKey = workExperienceMatch[2];
    if (subKey === 'inclusiveDatesTo' && entry.isPresent) return 'PRESENT';
    if (subKey === 'isGovernmentService') {
      const isGov = (entry as any)[subKey];
      return isGov === true ? 'Y' : isGov === false ? 'N' : '';
    }
    return (entry as any)[subKey] ?? '';
  }

  const trainingMatch = key.match(
    /^trainings_(\d{2})_(title|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|typeOfLD|conductedSponsoredBy)$/
  );
  if (trainingMatch) {
    const sortedTrainings = [...(record.trainings ?? [])].sort((first, second) => {
      const firstDate = parseDMYDate(first.inclusiveDatesTo) || parseDMYDate(first.inclusiveDatesFrom);
      const secondDate = parseDMYDate(second.inclusiveDatesTo) || parseDMYDate(second.inclusiveDatesFrom);
      return secondDate - firstDate;
    });
    const entry = sortedTrainings[parseInt(trainingMatch[1], 10) - 1];
    return entry ? (entry as any)[trainingMatch[2]] ?? '' : '';
  }

  const voluntaryWorkMatch = key.match(
    /^voluntaryWork_(\d{2})_(organizationNameAddress|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|positionNatureOfWork)$/
  );
  if (voluntaryWorkMatch) {
    const entry = record.voluntaryWork?.[parseInt(voluntaryWorkMatch[1], 10) - 1];
    return entry ? (entry as any)[voluntaryWorkMatch[2]] ?? '' : '';
  }

  const otherInfoListKeys: Record<string, keyof PdsRecord['otherInfo']> = {
    hobbies: 'specialSkillsHobbies',
    distinction: 'nonAcademicDistinctions',
    membership: 'membershipInAssociations',
  };
  const otherInfoMatch = key.match(/^otherInfo_(hobbies|distinction|membership)_(\d{2})$/);
  if (otherInfoMatch) {
    const list = record.otherInfo?.[otherInfoListKeys[otherInfoMatch[1]]] as string[] | undefined;
    return list?.[parseInt(otherInfoMatch[2], 10) - 1] ?? '';
  }

  const backgroundQuestionKeyMap: Record<string, keyof PdsRecord['backgroundQuestions']> = {
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
  const backgroundQuestionDetailsKeyMap: Record<string, string> = {
    immigrantOrPermanentResidentAbroad: 'country',
    indigenousGroupMember: 'specify',
    personWithDisability: 'pwdIdNo',
    soloParent: 'soloParentIdNo',
  };
  const backgroundQuestionMatch = key.match(
    /^backgroundQuestions_(34a|34b|35a|35b|36|37|38a|38b|39|40a|40b|40c)_(y|n|details|dateFiled|statusOfCase)$/
  );
  if (backgroundQuestionMatch) {
    const questionKey = backgroundQuestionKeyMap[backgroundQuestionMatch[1]];
    const question = record.backgroundQuestions?.[questionKey] as any;
    if (!question) return backgroundQuestionMatch[2] === 'y' || backgroundQuestionMatch[2] === 'n' ? false : '';
    if (backgroundQuestionMatch[2] === 'y') return question.answer === true;
    if (backgroundQuestionMatch[2] === 'n') return question.answer === false;
    if (question.answer !== true) return '';
    if (backgroundQuestionMatch[2] === 'dateFiled') return question.dateFiled ?? '';
    if (backgroundQuestionMatch[2] === 'statusOfCase') return question.statusOfCase ?? '';
    const detailsKey = backgroundQuestionDetailsKeyMap[questionKey] ?? 'details';
    return question[detailsKey] ?? question.details ?? '';
  }

  const referenceMatch = key.match(/^references_(\d{2})_(name|officeResidentialAddress|contactNoOrEmail)$/);
  if (referenceMatch) {
    const entry = record.references?.[parseInt(referenceMatch[1], 10) - 1];
    return entry ? (entry as any)[referenceMatch[2]] ?? '' : '';
  }

  const edu = record.education || {};
  if (key.startsWith('elementary_') || key.startsWith('elementary.')) {
    const subKey = key.replace(/^elementary[_.]/, '');
    return edu.elementary ? (edu.elementary as any)[subKey] ?? '' : '';
  }
  if (key.startsWith('secondary_') || key.startsWith('secondary.')) {
    const subKey = key.replace(/^secondary[_.]/, '');
    return edu.secondary ? (edu.secondary as any)[subKey] ?? '' : '';
  }
  if (key.startsWith('vocationalTrade_') || key.startsWith('vocationalTrade.')) {
    const subKey = key.replace(/^vocationalTrade[_.]/, '');
    const entry = Array.isArray(edu.vocationalTrade) ? edu.vocationalTrade[0] : (edu.vocationalTrade as any);
    return entry ? (entry as any)[subKey] ?? '' : '';
  }
  if (key.startsWith('college_') || key.startsWith('college.')) {
    const subKey = key.replace(/^college[_.]/, '');
    const entry = Array.isArray(edu.college) ? edu.college[0] : (edu.college as any);
    return entry ? (entry as any)[subKey] ?? '' : '';
  }
  if (key.startsWith('graduateStudies_') || key.startsWith('graduateStudies.')) {
    const subKey = key.replace(/^graduateStudies[_.]/, '');
    const entry = Array.isArray(edu.graduateStudies) ? edu.graduateStudies[0] : (edu.graduateStudies as any);
    return entry ? (entry as any)[subKey] ?? '' : '';
  }

  if (key in record) {
    return (record as any)[key];
  }

  return '';
}

const BACKGROUND_ITEM_RE =
  /^(34a|34b|35a|35b|36|37|38a|38b|39|40a|40b|40c)$/;

const BACKGROUND_QUESTION_KEY_MAP: Record<string, keyof PdsRecord['backgroundQuestions']> = {
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

const BACKGROUND_DETAILS_KEY_MAP: Record<string, string> = {
  immigrantOrPermanentResidentAbroad: 'country',
  indigenousGroupMember: 'specify',
  personWithDisability: 'pwdIdNo',
  soloParent: 'soloParentIdNo',
};

const EXCLUSIVE_CHECKBOX_KEYS = new Set([
  'sexAtBirth_male',
  'sexAtBirth_female',
  'civilStatus_single',
  'civilStatus_married',
  'civilStatus_widowed',
  'civilStatus_separated',
  'civilStatus_others',
  'citizenship_filipino',
  'citizenship_dual',
  'dualCitizenship_byBirth',
  'dualCitizenship_byNaturalization',
]);

function asChecked(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === 'on' || normalized === '1';
}

function asText(value: unknown): string {
  if (value == null || value === false) return '';
  if (typeof value === 'boolean') return value ? 'Y' : '';
  return String(value).trim();
}

function asDateText(value: unknown): string {
  const text = asText(value);
  return text ? formatDateToDMY(text) : '';
}

function ensureLength<T>(items: T[] | undefined, index: number, factory: () => T): T[] {
  const next = items ? items.slice() : [];
  while (next.length <= index) next.push(factory());
  return next;
}

function ensureEducationEntry(
  entries: PdsRecord['education']['college'] | undefined
): NonNullable<PdsRecord['education']['college']> {
  if (Array.isArray(entries) && entries[0]) return entries;
  return [createEmptyEducationEntry()];
}

function isExclusiveCheckboxKey(key: string): boolean {
  if (EXCLUSIVE_CHECKBOX_KEYS.has(key)) return true;
  return /^backgroundQuestions_(34a|34b|35a|35b|36|37|38a|38b|39|40a|40b|40c)_(y|n)$/.test(key);
}

/**
 * Write a PDF / field-map value onto a PdsRecord.
 * Empty and unchecked exclusive-checkbox values are ignored so defaults stay intact.
 */
export function setRecordValueByKey(record: PdsRecord, key: string, value: unknown): void {
  if (isExclusiveCheckboxKey(key)) {
    if (!asChecked(value)) return;
  } else {
    const text = asText(value);
    if (!text) return;
  }

  const p = record.personalInfo;

  switch (key) {
    case 'sexAtBirth_male':
      p.sexAtBirth = 'Male';
      return;
    case 'sexAtBirth_female':
      p.sexAtBirth = 'Female';
      return;
    case 'civilStatus_single':
      p.civilStatus = 'Single';
      return;
    case 'civilStatus_married':
      p.civilStatus = 'Married';
      return;
    case 'civilStatus_widowed':
      p.civilStatus = 'Widow/er';
      return;
    case 'civilStatus_separated':
      p.civilStatus = 'Separated';
      return;
    case 'civilStatus_others':
      p.civilStatus = 'Others';
      return;
    case 'citizenship_filipino':
      p.citizenship = 'Filipino';
      return;
    case 'citizenship_dual':
      p.citizenship = 'Dual Citizenship';
      return;
    case 'dualCitizenship_byBirth':
      p.dualCitizenshipMode = 'by birth';
      return;
    case 'dualCitizenship_byNaturalization':
      p.dualCitizenshipMode = 'by naturalization';
      return;
    case 'signature':
    case 'signature_page4':
      return;
    case 'declaration_dateAndPlaceOfIssuance': {
      const raw = asText(value);
      const comma = raw.indexOf(',');
      if (comma === -1) {
        record.declaration.dateOfIssuance = asDateText(raw);
        return;
      }
      record.declaration.dateOfIssuance = asDateText(raw.slice(0, comma));
      record.declaration.placeOfIssuance = raw.slice(comma + 1).trim();
      return;
    }
    default:
      break;
  }

  if (key.startsWith('declaration_') || key.startsWith('declaration.')) {
    const subKey = key.replace(/^declaration[_.]/, '');
    (record.declaration as any)[subKey] = asDateText(value) || asText(value);
    return;
  }

  if (key in p && typeof (p as any)[key] === 'string') {
    (p as any)[key] = key === 'dateOfBirth' ? asDateText(value) : asText(value);
    return;
  }

  if (key.startsWith('residentialAddress_') || key.startsWith('residentialAddress.')) {
    const subKey = key.replace(/^residentialAddress[_.]/, '');
    (p.residentialAddress as any)[subKey] = asText(value);
    return;
  }

  if (key.startsWith('permanentAddress_') || key.startsWith('permanentAddress.')) {
    const subKey = key.replace(/^permanentAddress[_.]/, '');
    (p.permanentAddress as any)[subKey] = asText(value);
    return;
  }

  const f = record.familyBackground;
  if (key.startsWith('spouse_') || key.startsWith('spouse.')) {
    const subKey = key.replace(/^spouse[_.]/, '');
    (f.spouse as any)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('father_') || key.startsWith('father.')) {
    const subKey = key.replace(/^father[_.]/, '');
    (f.father as any)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('mother_') || key.startsWith('mother.')) {
    const subKey = key.replace(/^mother[_.]/, '');
    (f.mother as any)[subKey] = asText(value);
    return;
  }

  const childMatch = key.match(/^children_(\d{2})_(fullName|dateOfBirth)$/);
  if (childMatch) {
    const index = parseInt(childMatch[1], 10) - 1;
    f.children = ensureLength(f.children, index, createEmptyChild);
    const field = childMatch[2];
    (f.children[index] as any)[field] = field === 'dateOfBirth' ? asDateText(value) : asText(value);
    return;
  }

  const eligibilityMatch = key.match(
    /^eligibility_(\d{2})_(careerServiceRA1080OrSpecialLaw|rating|dateOfExamConferment|placeOfExamConferment|licenseNumber|licenseValidityDate)$/
  );
  if (eligibilityMatch) {
    const index = parseInt(eligibilityMatch[1], 10) - 1;
    record.eligibility = ensureLength(record.eligibility, index, createEmptyEligibility);
    const field = eligibilityMatch[2];
    const dateField = field === 'dateOfExamConferment' || field === 'licenseValidityDate';
    (record.eligibility[index] as any)[field] = dateField ? asDateText(value) : asText(value);
    return;
  }

  const workExperienceMatch = key.match(
    /^workExperience_(\d{2})_(inclusiveDatesFrom|inclusiveDatesTo|positionTitle|departmentAgencyOfficeCompany|monthlySalary|salaryJobPayGradeStepIncrement|statusOfAppointment|isGovernmentService)$/
  );
  if (workExperienceMatch) {
    const index = parseInt(workExperienceMatch[1], 10) - 1;
    record.workExperience = ensureLength(record.workExperience, index, createEmptyWorkExperience);
    const entry = record.workExperience[index];
    const field = workExperienceMatch[2];
    if (field === 'inclusiveDatesTo') {
      const text = asText(value);
      if (/^present$/i.test(text)) {
        entry.isPresent = true;
        entry.inclusiveDatesTo = '';
      } else {
        entry.inclusiveDatesTo = asDateText(text);
      }
      return;
    }
    if (field === 'isGovernmentService') {
      const text = asText(value).toUpperCase();
      if (text === 'Y' || text === 'YES') entry.isGovernmentService = true;
      else if (text === 'N' || text === 'NO') entry.isGovernmentService = false;
      return;
    }
    if (field === 'inclusiveDatesFrom') {
      entry.inclusiveDatesFrom = asDateText(value);
      return;
    }
    (entry as any)[field] = asText(value);
    return;
  }

  const trainingMatch = key.match(
    /^trainings_(\d{2})_(title|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|typeOfLD|conductedSponsoredBy)$/
  );
  if (trainingMatch) {
    const index = parseInt(trainingMatch[1], 10) - 1;
    record.trainings = ensureLength(record.trainings, index, createEmptyTraining);
    const field = trainingMatch[2];
    const dateField = field === 'inclusiveDatesFrom' || field === 'inclusiveDatesTo';
    (record.trainings[index] as any)[field] = dateField ? asDateText(value) : asText(value);
    return;
  }

  const voluntaryWorkMatch = key.match(
    /^voluntaryWork_(\d{2})_(organizationNameAddress|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|positionNatureOfWork)$/
  );
  if (voluntaryWorkMatch) {
    const index = parseInt(voluntaryWorkMatch[1], 10) - 1;
    record.voluntaryWork = ensureLength(record.voluntaryWork, index, createEmptyVoluntaryWork);
    const field = voluntaryWorkMatch[2];
    const dateField = field === 'inclusiveDatesFrom' || field === 'inclusiveDatesTo';
    (record.voluntaryWork[index] as any)[field] = dateField ? asDateText(value) : asText(value);
    return;
  }

  const otherInfoListKeys: Record<string, keyof PdsRecord['otherInfo']> = {
    hobbies: 'specialSkillsHobbies',
    distinction: 'nonAcademicDistinctions',
    membership: 'membershipInAssociations',
  };
  const otherInfoMatch = key.match(/^otherInfo_(hobbies|distinction|membership)_(\d{2})$/);
  if (otherInfoMatch) {
    const listKey = otherInfoListKeys[otherInfoMatch[1]];
    const index = parseInt(otherInfoMatch[2], 10) - 1;
    record.otherInfo[listKey] = ensureLength(record.otherInfo[listKey], index, () => '');
    record.otherInfo[listKey][index] = asText(value);
    return;
  }

  const backgroundQuestionMatch = key.match(
    /^backgroundQuestions_(34a|34b|35a|35b|36|37|38a|38b|39|40a|40b|40c)_(y|n|details|dateFiled|statusOfCase)$/
  );
  if (backgroundQuestionMatch && BACKGROUND_ITEM_RE.test(backgroundQuestionMatch[1])) {
    const questionKey = BACKGROUND_QUESTION_KEY_MAP[backgroundQuestionMatch[1]];
    const question = record.backgroundQuestions[questionKey] as any;
    const suffix = backgroundQuestionMatch[2];
    if (suffix === 'y') {
      question.answer = true;
      return;
    }
    if (suffix === 'n') {
      question.answer = false;
      return;
    }
    if (suffix === 'dateFiled') {
      question.dateFiled = asDateText(value);
      return;
    }
    if (suffix === 'statusOfCase') {
      question.statusOfCase = asText(value);
      return;
    }
    const detailsKey = BACKGROUND_DETAILS_KEY_MAP[questionKey] ?? 'details';
    question[detailsKey] = asText(value);
    return;
  }

  const referenceMatch = key.match(/^references_(\d{2})_(name|officeResidentialAddress|contactNoOrEmail)$/);
  if (referenceMatch) {
    const index = parseInt(referenceMatch[1], 10) - 1;
    record.references = ensureLength(record.references, index, createEmptyReference);
    (record.references[index] as any)[referenceMatch[2]] = asText(value);
    return;
  }

  const edu = record.education;
  if (key.startsWith('elementary_') || key.startsWith('elementary.')) {
    const subKey = key.replace(/^elementary[_.]/, '');
    (edu.elementary as any)[subKey] = subKey.includes('Year') || subKey === 'periodFromYear' || subKey === 'periodToYear'
      ? asText(value)
      : asText(value);
    return;
  }
  if (key.startsWith('secondary_') || key.startsWith('secondary.')) {
    const subKey = key.replace(/^secondary[_.]/, '');
    (edu.secondary as any)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('vocationalTrade_') || key.startsWith('vocationalTrade.')) {
    const subKey = key.replace(/^vocationalTrade[_.]/, '');
    edu.vocationalTrade = ensureEducationEntry(edu.vocationalTrade);
    (edu.vocationalTrade[0] as any)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('college_') || key.startsWith('college.')) {
    const subKey = key.replace(/^college[_.]/, '');
    edu.college = ensureEducationEntry(edu.college);
    (edu.college[0] as any)[subKey] = asText(value);
    return;
  }
  if (key.startsWith('graduateStudies_') || key.startsWith('graduateStudies.')) {
    const subKey = key.replace(/^graduateStudies[_.]/, '');
    edu.graduateStudies = ensureEducationEntry(edu.graduateStudies);
    (edu.graduateStudies[0] as any)[subKey] = asText(value);
    return;
  }
}

```

In `src/pdfExport/exportPdsPage1.ts`:

1. Change the first import block to:

```ts
import { PDFDocument, PDFFont, PDFForm, PDFTextField, PDFCheckBox, PDFRadioGroup, PDFDropdown, PDFButton, PDFName, PDFDict, StandardFonts } from 'pdf-lib';
import { PdsRecord } from '../types/pds';
import { fieldMap } from './fieldMap-csc2122016-c1.js';
import { getRecordValueByKey } from './recordValueByKey';

export { getRecordValueByKey, parseDMYDate } from './recordValueByKey';
```

2. Delete the entire `parseDMYDate` function, the `getRecordValueByKey` function, and the comment block immediately above `parseDMYDate` (from `/** Parses a strict dd/mm/yyyy` through the closing `}` of `getRecordValueByKey`). Leave `embedDataUrlImage` and everything after it in place.

In `src/forms/pds/PdsPrintPreview.tsx`, change:

```ts
import { parseDMYDate } from '../../pdfExport/exportPdsPage1';
```

to:

```ts
import { parseDMYDate } from '../../pdfExport/recordValueByKey';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pdfExport/recordValueByKey.test.ts`

Expected: PASS (6 tests).

Also run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts \
  src/pdfExport/recordValueByKey.ts src/pdfExport/recordValueByKey.test.ts \
  src/pdfExport/exportPdsPage1.ts src/forms/pds/PdsPrintPreview.tsx
git commit -m "feat(import): add inverse PDS field-map setter"
```

---

### Task 2: Extract AcroForm values from PDF bytes

**Files:**
- Create: `src/pdfImport/extractAcroFieldValues.ts`
- Test: `src/pdfImport/extractAcroFieldValues.test.ts`

**Interfaces:**
- Consumes: `pdf-lib` `PDFDocument`, `PDFTextField`, `PDFCheckBox`, `PDFRadioGroup`, `PDFDropdown`.
- Produces: `export type AcroFieldValue = string | boolean;`  
  `export interface ExtractedAcroForm { fieldNames: string[]; values: Record<string, AcroFieldValue>; hasForm: boolean; encrypted: boolean; }`  
  `export async function extractAcroFieldValues(bytes: ArrayBuffer | Uint8Array): Promise<ExtractedAcroForm>`

- [ ] **Step 1: Write the failing test**

Create `src/pdfImport/extractAcroFieldValues.test.ts`:

```ts
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { extractAcroFieldValues } from './extractAcroFieldValues';

async function buildFilledPdsLikePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();

  const surname = form.createTextField('c1_surname');
  surname.addToPage(page, { x: 20, y: 320, width: 160, height: 18 });
  surname.setText('DELA CRUZ');

  const firstName = form.createTextField('c1_firstname');
  firstName.addToPage(page, { x: 20, y: 290, width: 160, height: 18 });
  firstName.setText('JUAN');

  const male = form.createCheckBox('c1_male');
  male.addToPage(page, { x: 20, y: 260, width: 12, height: 12 });
  male.check();

  const female = form.createCheckBox('c1_female');
  female.addToPage(page, { x: 40, y: 260, width: 12, height: 12 });

  return doc.save();
}

describe('extractAcroFieldValues', () => {
  it('reads text and checkbox values from a fillable PDF', async () => {
    const bytes = await buildFilledPdsLikePdf();
    const extracted = await extractAcroFieldValues(bytes);

    expect(extracted.encrypted).toBe(false);
    expect(extracted.hasForm).toBe(true);
    expect(extracted.values.c1_surname).toBe('DELA CRUZ');
    expect(extracted.values.c1_firstname).toBe('JUAN');
    expect(extracted.values.c1_male).toBe(true);
    expect(extracted.values.c1_female).toBe(false);
    expect(extracted.fieldNames).toEqual(expect.arrayContaining(['c1_surname', 'c1_firstname', 'c1_male', 'c1_female']));
  });

  it('reports a PDF with no form as hasForm false', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const extracted = await extractAcroFieldValues(bytes);
    expect(extracted.hasForm).toBe(false);
    expect(extracted.fieldNames).toEqual([]);
  });

  it('flags encrypted PDFs without throwing', async () => {
    const load = vi.spyOn(PDFDocument, 'load').mockRejectedValueOnce(
      new Error('Input document to `PDFDocument.load` is encrypted.')
    );
    const extracted = await extractAcroFieldValues(new Uint8Array([1, 2, 3]));
    expect(extracted.encrypted).toBe(true);
    expect(extracted.hasForm).toBe(false);
    expect(extracted.fieldNames).toEqual([]);
    load.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pdfImport/extractAcroFieldValues.test.ts`

Expected: FAIL with `Cannot find module './extractAcroFieldValues'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pdfImport/extractAcroFieldValues.ts`:

```ts
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';

export type AcroFieldValue = string | boolean;

export interface ExtractedAcroForm {
  fieldNames: string[];
  values: Record<string, AcroFieldValue>;
  hasForm: boolean;
  encrypted: boolean;
}

function isEncryptionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /encrypt/i.test(message);
}

function readFieldValue(field: unknown): AcroFieldValue | undefined {
  if (field instanceof PDFTextField) {
    return field.getText() ?? '';
  }
  if (field instanceof PDFCheckBox) {
    return field.isChecked();
  }
  if (field instanceof PDFRadioGroup || field instanceof PDFDropdown) {
    return field.getSelected() ?? '';
  }
  return undefined;
}

export async function extractAcroFieldValues(
  bytes: ArrayBuffer | Uint8Array
): Promise<ExtractedAcroForm> {
  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes);
  } catch (error) {
    if (isEncryptionError(error)) {
      return { fieldNames: [], values: {}, hasForm: false, encrypted: true };
    }
    throw error;
  }

  const form = pdfDoc.getForm();
  const fields = form.getFields();
  const values: Record<string, AcroFieldValue> = {};
  const fieldNames: string[] = [];

  for (const field of fields) {
    const name = field.getName();
    fieldNames.push(name);
    const value = readFieldValue(field);
    if (value !== undefined) {
      values[name] = value;
    }
  }

  return {
    fieldNames,
    values,
    hasForm: fieldNames.length > 0,
    encrypted: false,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pdfImport/extractAcroFieldValues.test.ts`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pdfImport/extractAcroFieldValues.ts src/pdfImport/extractAcroFieldValues.test.ts
git commit -m "feat(import): extract AcroForm values from PDS PDFs"
```

---

### Task 3: Map extracted PDF fields onto a PdsRecord

**Files:**
- Create: `src/pdfImport/importPdsPdf.ts`
- Test: `src/pdfImport/importPdsPdf.test.ts`

**Interfaces:**
- Consumes: `extractAcroFieldValues` from Task 2; `setRecordValueByKey` from Task 1; `fieldMap.acroFields` from `src/pdfExport/fieldMap-csc2122016-c1.js`; `createNewPdsRecord` from `src/db/defaultPdsData.ts`.
- Produces:  
  `export const CS212_2026_SENTINEL_FIELDS: readonly ['c1_surname', 'c1_firstname', 'c1_birthdate']`  
  `export interface PdsPdfImportResult { success: boolean; record?: PdsRecord; warnings: string[]; error?: string; mappedFieldCount: number; recognizedTemplate: boolean; }`  
  `export async function importPdsPdf(bytes: ArrayBuffer | Uint8Array, sourceFileName?: string): Promise<PdsPdfImportResult>`

- [ ] **Step 1: Write the failing tests**

Create `src/pdfImport/importPdsPdf.test.ts`:

```ts
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it, vi } from 'vitest';
import { importPdsPdf } from './importPdsPdf';

async function pdfWithFields(
  fields: Array<{ name: string; text?: string; checked?: boolean }>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 700]);
  const form = doc.getForm();
  let top = 650;
  for (const field of fields) {
    if (field.checked !== undefined) {
      const box = form.createCheckBox(field.name);
      box.addToPage(page, { x: 20, y: top, width: 12, height: 12 });
      if (field.checked) box.check();
    } else {
      const text = form.createTextField(field.name);
      text.addToPage(page, { x: 20, y: top, width: 200, height: 16 });
      if (field.text) text.setText(field.text);
    }
    top -= 24;
  }
  return doc.save();
}

describe('importPdsPdf', () => {
  it('maps a recognized CS Form 212 fillable PDF onto a new PdsRecord', async () => {
    const bytes = await pdfWithFields([
      { name: 'c1_surname', text: 'DELA CRUZ' },
      { name: 'c1_firstname', text: 'JUAN' },
      { name: 'c1_birthdate', text: '17/05/1990' },
      { name: 'c1_male', checked: true },
      { name: 'c1_married', checked: true },
      { name: 'c1_res_bgy', text: 'San Isidro' },
      { name: 'c1_perm_bgy', text: 'San Isidro' },
      { name: 'c1_children_name_01', text: 'Ana Dela Cruz' },
      { name: 'c2_work_position_01', text: 'AO II' },
      { name: 'c2_work_to_01', text: 'PRESENT' },
      { name: 'c2_work_govt_01', text: 'Y' },
      { name: 'c4_34a_n', checked: true },
      { name: 'c4_govid', text: 'UMID' },
    ]);

    const result = await importPdsPdf(bytes, 'DELA-CRUZ-PDS.pdf');

    expect(result.success).toBe(true);
    expect(result.recognizedTemplate).toBe(true);
    expect(result.record?.personalInfo.surname).toBe('DELA CRUZ');
    expect(result.record?.personalInfo.firstName).toBe('JUAN');
    expect(result.record?.personalInfo.sexAtBirth).toBe('Male');
    expect(result.record?.personalInfo.civilStatus).toBe('Married');
    expect(result.record?.personalInfo.sameAsResidentialAddress).toBe(true);
    expect(result.record?.familyBackground.children[0].fullName).toBe('Ana Dela Cruz');
    expect(result.record?.workExperience[0].positionTitle).toBe('AO II');
    expect(result.record?.workExperience[0].isPresent).toBe(true);
    expect(result.record?.workExperience[0].isGovernmentService).toBe(true);
    expect(result.record?.backgroundQuestions.relatedWithinThirdDegree.answer).toBe(false);
    expect(result.record?.declaration.governmentIssuedId).toBe('UMID');
    expect(result.record?.meta.title).toContain('DELA CRUZ');
    expect(result.warnings.join(' ')).toMatch(/Photo, signature, and thumbmark/i);
    expect(result.warnings.join(' ')).toMatch(/Work Experience Sheet/i);
    expect(result.mappedFieldCount).toBeGreaterThanOrEqual(8);
  });

  it('rejects a PDF with no fillable fields', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const result = await importPdsPdf(bytes);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no fillable fields/i);
  });

  it('rejects a fillable PDF that is not CS Form 212 Revised 2026', async () => {
    const bytes = await pdfWithFields([{ name: 'some_other_field', text: 'hello' }]);
    const result = await importPdsPdf(bytes);
    expect(result.success).toBe(false);
    expect(result.recognizedTemplate).toBe(false);
    expect(result.error).toMatch(/not a recognized CS Form 212/i);
  });

  it('rejects a recognized but blank PDS PDF', async () => {
    const bytes = await pdfWithFields([
      { name: 'c1_surname' },
      { name: 'c1_firstname' },
      { name: 'c1_birthdate' },
    ]);
    const result = await importPdsPdf(bytes);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/blank/i);
  });

  it('asks the user to unlock a password-protected PDF', async () => {
    const load = vi.spyOn(PDFDocument, 'load').mockRejectedValueOnce(
      new Error('Input document to `PDFDocument.load` is encrypted.')
    );
    const result = await importPdsPdf(new Uint8Array([1, 2, 3]));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/password-protected/i);
    load.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pdfImport/importPdsPdf.test.ts`

Expected: FAIL with `Cannot find module './importPdsPdf'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/pdfImport/importPdsPdf.ts`:

```ts
import { createNewPdsRecord } from '../db/defaultPdsData';
import { fieldMap } from '../pdfExport/fieldMap-csc2122016-c1.js';
import { setRecordValueByKey } from '../pdfExport/recordValueByKey';
import { Address, PdsRecord } from '../types/pds';
import { extractAcroFieldValues } from './extractAcroFieldValues';

export const CS212_2026_SENTINEL_FIELDS = ['c1_surname', 'c1_firstname', 'c1_birthdate'] as const;

export interface PdsPdfImportResult {
  success: boolean;
  record?: PdsRecord;
  warnings: string[];
  error?: string;
  mappedFieldCount: number;
  recognizedTemplate: boolean;
}

const STANDARD_WARNINGS = [
  'Photo, signature, and thumbmark are not imported from the PDF.',
  'Work Experience Sheet duties are not on the PDS PDF.',
  'Review every section before using this draft for an official submission.',
];

function isNonEmptyValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.trim().length > 0;
  return false;
}

function addressesMatch(a: Address, b: Address): boolean {
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

function addressHasValue(address: Address): boolean {
  return Object.values(address).some((value) => value.trim().length > 0);
}

function isEmptyChild(child: PdsRecord['familyBackground']['children'][number]): boolean {
  return !child.fullName.trim() && !child.dateOfBirth.trim();
}

function isEmptyEligibility(item: PdsRecord['eligibility'][number]): boolean {
  return (
    !item.careerServiceRA1080OrSpecialLaw.trim() &&
    !item.rating.trim() &&
    !item.dateOfExamConferment.trim() &&
    !item.placeOfExamConferment.trim() &&
    !item.licenseNumber.trim() &&
    !item.licenseValidityDate.trim()
  );
}

function isEmptyWork(item: PdsRecord['workExperience'][number]): boolean {
  return (
    !item.inclusiveDatesFrom.trim() &&
    !item.inclusiveDatesTo.trim() &&
    !item.isPresent &&
    !item.positionTitle.trim() &&
    !item.departmentAgencyOfficeCompany.trim() &&
    !item.monthlySalary.trim() &&
    !item.salaryJobPayGradeStepIncrement.trim() &&
    !item.statusOfAppointment.trim() &&
    item.isGovernmentService == null
  );
}

function isEmptyTraining(item: PdsRecord['trainings'][number]): boolean {
  return (
    !item.title.trim() &&
    !item.inclusiveDatesFrom.trim() &&
    !item.inclusiveDatesTo.trim() &&
    !item.numberOfHours.trim() &&
    !item.typeOfLD.trim() &&
    !item.conductedSponsoredBy.trim()
  );
}

function isEmptyVoluntary(item: PdsRecord['voluntaryWork'][number]): boolean {
  return (
    !item.organizationNameAddress.trim() &&
    !item.inclusiveDatesFrom.trim() &&
    !item.inclusiveDatesTo.trim() &&
    !item.numberOfHours.trim() &&
    !item.positionNatureOfWork.trim()
  );
}

function isEmptyReference(item: PdsRecord['references'][number]): boolean {
  return !item.name.trim() && !item.officeResidentialAddress.trim() && !item.contactNoOrEmail.trim();
}

function isEmptyEducation(item: PdsRecord['education']['college'][number]): boolean {
  return (
    !item.nameOfSchool.trim() &&
    !item.degreeCourse.trim() &&
    !item.periodFromYear.trim() &&
    !item.periodToYear.trim() &&
    !item.highestLevelUnitsEarned.trim() &&
    !item.yearGraduated.trim() &&
    !item.scholarshipAcademicHonors.trim()
  );
}

function trimTrailing<T>(items: T[], isEmpty: (item: T) => boolean, minLength: number): T[] {
  const next = items.slice();
  while (next.length > minLength && isEmpty(next[next.length - 1])) {
    next.pop();
  }
  return next;
}

function trimImportedRecord(record: PdsRecord): void {
  record.familyBackground.children = trimTrailing(record.familyBackground.children, isEmptyChild, 1);
  record.eligibility = trimTrailing(record.eligibility, isEmptyEligibility, 1);
  record.workExperience = trimTrailing(record.workExperience, isEmptyWork, 1);
  record.trainings = trimTrailing(record.trainings, isEmptyTraining, 1);
  record.voluntaryWork = trimTrailing(record.voluntaryWork, isEmptyVoluntary, 1);
  record.references = trimTrailing(record.references, isEmptyReference, 3);
  record.education.vocationalTrade = trimTrailing(record.education.vocationalTrade, isEmptyEducation, 1);
  record.education.college = trimTrailing(record.education.college, isEmptyEducation, 1);
  record.education.graduateStudies = trimTrailing(record.education.graduateStudies, isEmptyEducation, 1);
  record.otherInfo.specialSkillsHobbies = trimTrailing(
    record.otherInfo.specialSkillsHobbies,
    (value) => !value.trim(),
    1
  );
  record.otherInfo.nonAcademicDistinctions = trimTrailing(
    record.otherInfo.nonAcademicDistinctions,
    (value) => !value.trim(),
    1
  );
  record.otherInfo.membershipInAssociations = trimTrailing(
    record.otherInfo.membershipInAssociations,
    (value) => !value.trim(),
    1
  );
}

function buildTitle(record: PdsRecord, sourceFileName?: string): string {
  const surname = record.personalInfo.surname.trim();
  const firstName = record.personalInfo.firstName.trim();
  if (surname || firstName) {
    return `Imported PDS — ${[surname, firstName].filter(Boolean).join(', ')}`;
  }
  if (sourceFileName) {
    return `Imported PDS — ${sourceFileName.replace(/\.pdf$/i, '')}`;
  }
  return 'Imported PDS';
}

export async function importPdsPdf(
  bytes: ArrayBuffer | Uint8Array,
  sourceFileName?: string
): Promise<PdsPdfImportResult> {
  const extracted = await extractAcroFieldValues(bytes);

  if (extracted.encrypted) {
    return {
      success: false,
      warnings: [],
      mappedFieldCount: 0,
      recognizedTemplate: false,
      error: 'This PDF is password-protected. Unlock it in another app, then import the unlocked file.',
    };
  }

  if (!extracted.hasForm) {
    return {
      success: false,
      warnings: [],
      mappedFieldCount: 0,
      recognizedTemplate: false,
      error:
        'This PDF has no fillable fields. Flattened prints, scans, and Save-as-PDF copies cannot be imported. Use a filled CS Form 212 (Revised 2026) fillable PDF, or a GovFormsPH JSON backup.',
    };
  }

  const fieldNameSet = new Set(extracted.fieldNames);
  const recognizedTemplate = CS212_2026_SENTINEL_FIELDS.every((name) => fieldNameSet.has(name));
  if (!recognizedTemplate) {
    return {
      success: false,
      warnings: [],
      mappedFieldCount: 0,
      recognizedTemplate: false,
      error:
        'This fillable PDF is not a recognized CS Form 212 (Revised 2026) template. GovFormsPH can import the official fillable PDS (pds.pdf), not Excel, Word, or older revisions.',
    };
  }

  const record = createNewPdsRecord();
  const acroFields = (fieldMap.acroFields || {}) as Record<string, string>;
  let mappedFieldCount = 0;

  for (const [appDataKey, pdfFieldName] of Object.entries(acroFields)) {
    if (!(pdfFieldName in extracted.values)) continue;
    const value = extracted.values[pdfFieldName];
    if (!isNonEmptyValue(value)) continue;
    setRecordValueByKey(record, appDataKey, value);
    mappedFieldCount += 1;
  }

  if (mappedFieldCount === 0) {
    return {
      success: false,
      warnings: [],
      mappedFieldCount: 0,
      recognizedTemplate: true,
      error: 'This PDS PDF looks blank. Fill the official form fields, then import again.',
    };
  }

  if (
    addressHasValue(record.personalInfo.residentialAddress) &&
    addressesMatch(record.personalInfo.residentialAddress, record.personalInfo.permanentAddress)
  ) {
    record.personalInfo.sameAsResidentialAddress = true;
  }

  trimImportedRecord(record);
  record.meta.title = buildTitle(record, sourceFileName);
  record.meta.updatedAt = new Date().toISOString();

  return {
    success: true,
    record,
    warnings: [...STANDARD_WARNINGS],
    mappedFieldCount,
    recognizedTemplate: true,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pdfImport/importPdsPdf.test.ts`

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pdfImport/importPdsPdf.ts src/pdfImport/importPdsPdf.test.ts
git commit -m "feat(import): map CS Form 212 PDF fields onto a PDS draft"
```

---

### Task 4: Wire PDF files into Export & Import

**Files:**
- Modify: `src/utils/exportImport.ts`
- Create: `src/utils/exportImport.test.ts`
- Modify: `src/pages/ExportImportPage.tsx`
- Modify: `README.md` (Client-Side Export & Import bullet)

**Interfaces:**
- Consumes: `parseImportFile` (existing JSON parser); `importPdsPdf` from Task 3.
- Produces:  
  `export type ImportSourceKind = 'json' | 'pds-pdf';`  
  `export interface ImportFileLike { name: string; type?: string; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string>; }`  
  `export function isPdfFile(file: { name: string; type?: string }): boolean`  
  `export interface ImportPreview { success: boolean; records: PdsRecord[]; salnRecords: SalnRecord[]; settings?: AppSettings; isEncrypted: boolean; requiresPassword?: boolean; error?: string; sourceKind: ImportSourceKind; warnings: string[]; mappedFieldCount?: number; }`  
  `export async function parseImportSource(file: ImportFileLike, passphrase?: string): Promise<ImportPreview>`

- [ ] **Step 1: Write the failing routing tests**

Create `src/utils/exportImport.test.ts`:

```ts
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { parseImportSource } from './exportImport';
import type { ImportFileLike } from './exportImport';

function fileLike(name: string, type: string, payload: string | Uint8Array): ImportFileLike {
  const bytes = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
  return {
    name,
    type,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
    async text() {
      return new TextDecoder().decode(bytes);
    },
  };
}

describe('parseImportSource', () => {
  it('still restores a GovFormsPH single-form JSON export', async () => {
    const json = JSON.stringify({
      version: '1.0',
      type: 'single-form',
      record: { meta: { title: 'JSON PDS' }, personalInfo: { surname: 'SANTOS' } },
    });
    const result = await parseImportSource(fileLike('pds-santos.json', 'application/json', json));
    expect(result.success).toBe(true);
    expect(result.sourceKind).toBe('json');
    expect(result.records[0].personalInfo.surname).toBe('SANTOS');
    expect(result.warnings).toEqual([]);
  });

  it('routes a CS Form 212 PDF to the PDS PDF importer', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 400]);
    const form = doc.getForm();
    const surname = form.createTextField('c1_surname');
    surname.addToPage(page, { x: 10, y: 300, width: 120, height: 16 });
    surname.setText('REYES');
    const firstName = form.createTextField('c1_firstname');
    firstName.addToPage(page, { x: 10, y: 270, width: 120, height: 16 });
    firstName.setText('MARIA');
    const birth = form.createTextField('c1_birthdate');
    birth.addToPage(page, { x: 10, y: 240, width: 120, height: 16 });
    birth.setText('01/01/1988');
    const bytes = await doc.save();

    const result = await parseImportSource(fileLike('reyes.pds.pdf', 'application/pdf', bytes));
    expect(result.success).toBe(true);
    expect(result.sourceKind).toBe('pds-pdf');
    expect(result.records).toHaveLength(1);
    expect(result.records[0].personalInfo.surname).toBe('REYES');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('returns the flattened-PDF error instead of treating bytes as JSON', async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    const result = await parseImportSource(fileLike('scan.pdf', 'application/pdf', bytes));
    expect(result.success).toBe(false);
    expect(result.sourceKind).toBe('pds-pdf');
    expect(result.error).toMatch(/no fillable fields/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/exportImport.test.ts`

Expected: FAIL with `parseImportSource is not a function` (or similar named export missing).

- [ ] **Step 3: Add `isPdfFile` and `parseImportSource`**

At the top of `src/utils/exportImport.ts`, keep the existing imports and add:

```ts
import { importPdsPdf } from '../pdfImport/importPdsPdf';
```

Add these types and functions **above** `parseImportFile` (leave `parseImportFile` and `restoreRecords` unchanged except that `parseImportFile` should keep returning the same shape it does today):

```ts
export type ImportSourceKind = 'json' | 'pds-pdf';

export interface ImportFileLike {
  name: string;
  type?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

export interface ImportPreview {
  success: boolean;
  records: PdsRecord[];
  salnRecords: SalnRecord[];
  settings?: AppSettings;
  isEncrypted: boolean;
  requiresPassword?: boolean;
  error?: string;
  sourceKind: ImportSourceKind;
  warnings: string[];
  mappedFieldCount?: number;
}

export function isPdfFile(file: { name: string; type?: string }): boolean {
  const type = (file.type ?? '').toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'application/pdf' || name.endsWith('.pdf');
}

export async function parseImportSource(
  file: ImportFileLike,
  passphrase?: string
): Promise<ImportPreview> {
  if (isPdfFile(file)) {
    const bytes = await file.arrayBuffer();
    const pdfResult = await importPdsPdf(bytes, file.name);
    return {
      success: pdfResult.success,
      records: pdfResult.record ? [pdfResult.record] : [],
      salnRecords: [],
      isEncrypted: false,
      error: pdfResult.error,
      sourceKind: 'pds-pdf',
      warnings: pdfResult.warnings,
      mappedFieldCount: pdfResult.mappedFieldCount,
    };
  }

  const parsed = await parseImportFile(await file.text(), passphrase);
  return {
    ...parsed,
    sourceKind: 'json',
    warnings: [],
  };
}
```

- [ ] **Step 4: Run routing tests**

Run: `npx vitest run src/utils/exportImport.test.ts`

Expected: PASS (3 tests).

- [ ] **Step 5: Update Export & Import UI**

In `src/pages/ExportImportPage.tsx`:

1. Change the import from `../utils/exportImport` to:

```ts
import { exportAllData, isPdfFile, parseImportFile, parseImportSource, restoreRecords, triggerDownload } from '../utils/exportImport';
```

2. Extend `importPreview` state:

```ts
  const [importPreview, setImportPreview] = useState<{
    success?: boolean;
    records: PdsRecord[];
    salnRecords?: SalnRecord[];
    isEncrypted: boolean;
    requiresPassword?: boolean;
    error?: string;
    sourceKind?: 'json' | 'pds-pdf';
    warnings?: string[];
    mappedFieldCount?: number;
  } | null>(null);
```

3. Replace `handleFileSelect` with:

```ts
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFileName(file.name);
      setImportFileContent(null);
      setImportSuccessMessage(null);
      setImportMode('merge');

      if (isPdfFile(file)) {
        const parsed = await parseImportSource(file, importPassphrase);
        setImportPreview(parsed);
        return;
      }

      const text = await file.text();
      setImportFileContent(text);
      const parsed = await parseImportSource(file, importPassphrase);
      setImportPreview(parsed);
    }
  };
```

`handleDecryptAttempt` stays on the JSON string path:

```ts
  const handleDecryptAttempt = async () => {
    if (!importFileContent) return;
    const parsed = await parseImportFile(importFileContent, importPassphrase);
    setImportPreview({ ...parsed, sourceKind: 'json', warnings: [] });
  };
```

4. Change the import card copy and file input `accept` to:

```tsx
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Select a filled official CS Form 212 PDF (the fillable PDS itself), or a{' '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.json</code>
            {' / '}
            <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.vault</code>
            {' '}backup created by GovFormsPH.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.vault,.pdf,application/json,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
```

5. Change the dropzone helper line to:

```tsx
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              Supports fillable CS Form 212 PDFs, .GovFormsPH.json, .vault, or individual form JSON exports
            </p>
```

6. After the encrypted-password block, add an error block for failed PDF/JSON parses that are not password prompts:

```tsx
          {importPreview && !importPreview.success && !importPreview.requiresPassword && importPreview.error && (
            <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-4 text-xs text-rose-800 dark:text-rose-200">
              {importPreview.error}
            </div>
          )}
```

7. Inside the success preview, after the “Found N Form(s)” row, add:

```tsx
              {importPreview.sourceKind === 'pds-pdf' && (
                <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                  <p>
                    {importPreview.records[0]?.personalInfo?.surname || 'PDS'}
                    {importPreview.records[0]?.personalInfo?.firstName
                      ? `, ${importPreview.records[0].personalInfo.firstName}`
                      : ''}
                    {typeof importPreview.mappedFieldCount === 'number'
                      ? ` — ${importPreview.mappedFieldCount} field(s) read`
                      : ''}
                  </p>
                  {(importPreview.warnings ?? []).map((warning) => (
                    <p key={warning} className="text-amber-700 dark:text-amber-300">
                      {warning}
                    </p>
                  ))}
                </div>
              )}
```

8. Wrap the Replace radio so it only renders for JSON:

```tsx
                  {importPreview.sourceKind !== 'pds-pdf' && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-rose-600 dark:text-rose-400">
                      <input
                        type="radio"
                        name="importMode"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>Replace (Overwrite all)</span>
                    </label>
                  )}
```

9. Change the confirm button label:

```tsx
                {importPreview.sourceKind === 'pds-pdf'
                  ? 'Create PDS draft from PDF'
                  : `Confirm & Restore ${importPreview.records.length} Form(s)`}
```

`handleExecuteImport` already calls `restoreRecords` with `importMode`. For PDF, `handleFileSelect` resets mode to `'merge'`, and Replace is hidden, so restore adds a new draft.

- [ ] **Step 6: Document in README**

In `README.md`, under **Client-Side Export & Import**, add this bullet after the round-trip JSON bullet:

```markdown
  - Import a filled official CS Form 212 (Revised 2026) fillable PDF and create a local PDS draft. Flattened prints, scans, and Excel/Word copies are not supported.
```

- [ ] **Step 7: Run the full test suite, typecheck, and commit**

```bash
npx vitest run
npx tsc --noEmit
```

Expected: all new tests PASS; `tsc` exits 0.

```bash
git add src/utils/exportImport.ts src/utils/exportImport.test.ts \
  src/pages/ExportImportPage.tsx README.md
git commit -m "feat(import): accept official fillable PDS PDFs on Export & Import"
```

---

## Self-review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| Import filled CS Form 212 Revised 2026 AcroForm PDF | Tasks 2–4 |
| Reuse `fieldMap.acroFields` unchanged | Task 3 |
| Inverse of `getRecordValueByKey` | Task 1 |
| JSON / vault restore unchanged | Task 4 routing tests |
| Preview: name, field count, limitations | Task 4 UI |
| PDF merge-only, no Replace-all | Task 4 UI + `handleFileSelect` resets mode | 
| Encrypted PDF error | Tasks 2–3 |
| No AcroForm / flattened error | Tasks 3–4 |
| Unrecognized template error | Task 3 |
| Blank PDF error | Task 3 |
| Checkbox groups, PRESENT, Y/N, date/place split, `yyyy-mm-dd` | Task 1 tests |
| `sameAsResidentialAddress` when addresses match | Task 3 |
| No photo/signature/thumbmark/WES | Task 3 standard warnings; setter ignores signature keys |
| Client-side only, existing pdf-lib | All tasks |
| Vitest coverage listed in spec | Tasks 1–4 |
| Out of scope: OCR, Excel, 2017, SALN, unflatten export | Not scheduled |

**2. Placeholder scan:** no TBD / “handle edge cases” / “similar to Task N” leftovers. Error strings and UI copy are exact.

**3. Type consistency:** `setRecordValueByKey(record, key, value)` / `getRecordValueByKey(record, key)` / `extractAcroFieldValues` → `ExtractedAcroForm` / `importPdsPdf` → `PdsPdfImportResult` / `parseImportSource` → `ImportPreview` with `sourceKind: 'json' | 'pds-pdf'` are the names later tasks use.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-23-pds-pdf-import.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
