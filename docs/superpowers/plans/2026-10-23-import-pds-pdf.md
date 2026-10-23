# Import the CS Form 212 PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Import restore a Personal Data Sheet from the CS Form 212 PDF itself, not only from a GovFormsPH JSON backup.

**Architecture:** A PDF exported by this app gets a full `PdsRecord` attached as `govformsph-pds.json` before the AcroForm is flattened, so a later import restores photo, signature, Work Experience Sheet text, and rows the printed form cannot hold. A fillable PDF that has no attachment is read by reversing `fieldMap.acroFields` into a new `PdsRecord`. JSON backup import stays as it is. The CSC Excel workbook is a different file and is not part of this plan.

**Tech Stack:** React 18, TypeScript, Vite, pdf-lib 1.17, Dexie, Vitest (added for these tests).

## Global Constraints

- Parsing stays in the browser. Do not upload the PDF or call a network API.
- Do not add SheetJS, ExcelJS, pdf.js, or any other parse library. pdf-lib is already a dependency.
- `PdsRecord.meta.formVersion` stays `'CS-Form-212-2026'`.
- Dates stay strings. Do not convert them to `Date`. `PRESENT` in a work "to" field becomes `isPresent: true` and an empty `inclusiveDatesTo`.
- Follow `src/pdfExport/fieldMap-csc2122016-c1.js` exactly. `monthlySalary` is paired with `c2_work_status_NN` and `statusOfAppointment` is paired with `c2_work_salary_NN`. `children_08_dateOfBirth` is `c1_children_dob_0`. `eligibility_07_careerServiceRA1080OrSpecialLaw` is `c2_cse_0`. Do not rename those pairs.
- Photo, signature, and thumbmark are drawn onto the page. They are recovered only from the embedded JSON, never from pixels.
- `pds_date` and `c4_sign_date` are print dates. Do not copy them into `declaration.dateAccomplished`.
- Existing JSON and encrypted-vault import behavior stays. Merge still drops `id`. Replace still clears both PDS and SALN stores.
- Do not hand-edit `CHANGELOG.md`. `standard-version` owns it.
- UI copy stays in English. Icons stay Lucide components.

## File Structure

- Create `src/pdfImport/applyPdfFields.ts` — write one PDF app-data key onto a `PdsRecord`, then prune blank repeating rows.
- Create `src/pdfImport/applyPdfFields.test.ts` — pure tests for that writer. No PDF document yet.
- Create `src/pdfImport/pdsPdfAttachment.ts` — attach and read `govformsph-pds.json` on a `PDFDocument`.
- Create `src/pdfImport/pdsPdfAttachment.test.ts` — round-trip the attachment on a blank PDF.
- Create `src/pdfImport/parsePdsPdf.ts` — load bytes, prefer the attachment, otherwise read AcroForm fields.
- Create `src/pdfImport/parsePdsPdf.test.ts` — real template PDF plus the JSON-byte router.
- Modify `src/pdfExport/exportPdsPage1.ts` — accept an optional template buffer and attach the record before save.
- Modify `src/utils/exportImport.ts` — route `.pdf` bytes to `parsePdsPdf` and keep JSON on the existing parser.
- Modify `src/pages/ExportImportPage.tsx` — accept a PDF on the Import card and show field-import warnings.
- Modify `package.json` — add the `test` script.
- Create `vitest.config.ts` — node test runner.
- Modify `README.md` — one bullet for PDF import.

---

### Task 1: Apply PDF field values onto a PdsRecord

**Files:**
- Create: `src/pdfImport/applyPdfFields.ts`
- Create: `src/pdfImport/applyPdfFields.test.ts`
- Modify: `package.json`
- Create: `vitest.config.ts`
- Test: `src/pdfImport/applyPdfFields.test.ts`

**Interfaces:**
- Consumes: `createNewPdsRecord` and the `createEmpty*` helpers from `src/db/defaultPdsData.ts`. `PdsRecord` from `src/types/pds.ts`. `fieldMap.acroFields` keys from `src/pdfExport/fieldMap-csc2122016-c1.js`.
- Produces:
  - `applyPdfFieldValue(record: PdsRecord, key: string, value: string | boolean): boolean`
  - `applyPdfFieldValues(values: Record<string, string | boolean>, title?: string): PdsRecord`
  - `title` defaults to `'Imported PDS'`. The returned record has no `id`. `meta.formVersion` is `'CS-Form-212-2026'`. `meta.title` is `"SURNAME, FIRST"` when those names exist, otherwise `title`.

- [ ] **Step 1: Add Vitest**

Run:

```bash
npm install -D vitest
```

Add this script to `package.json` beside the existing scripts:

```json
"test": "vitest run"
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `src/pdfImport/applyPdfFields.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { fieldMap } from '../pdfExport/fieldMap-csc2122016-c1.js';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { applyPdfFieldValue, applyPdfFieldValues } from './applyPdfFields';

describe('applyPdfFieldValues', () => {
  it('accepts every key in fieldMap.acroFields', () => {
    const record = createNewPdsRecord();
    for (const key of Object.keys(fieldMap.acroFields)) {
      expect(applyPdfFieldValue(record, key, ''), key).toBe(true);
    }
  });

  it('returns false for a key the PDF map does not use', () => {
    const record = createNewPdsRecord();
    expect(applyPdfFieldValue(record, 'signature', 'data:image/png;base64,abc')).toBe(false);
  });

  it('copies personal text, sex, and address', () => {
    const record = applyPdfFieldValues({
      surname: ' dela cruz ',
      firstName: 'JUAN',
      dateOfBirth: '01/02/1990',
      sexAtBirth_male: true,
      residentialAddress_cityMunicipality: 'Manila',
    });
    expect(record.personalInfo.surname).toBe('dela cruz');
    expect(record.personalInfo.firstName).toBe('JUAN');
    expect(record.personalInfo.dateOfBirth).toBe('01/02/1990');
    expect(record.personalInfo.sexAtBirth).toBe('Male');
    expect(record.personalInfo.residentialAddress.cityMunicipality).toBe('Manila');
    expect(record.meta.title).toBe('dela cruz, JUAN');
    expect(record.meta.formVersion).toBe('CS-Form-212-2026');
    expect(record.id).toBeUndefined();
  });

  it('does not assume Filipino when citizenship is unchecked', () => {
    const record = applyPdfFieldValues({ surname: 'REYES' });
    expect(record.personalInfo.citizenship).toBe('');
  });

  it('imports the Filipino checkbox', () => {
    const record = applyPdfFieldValues({ citizenship_filipino: true, surname: 'REYES' });
    expect(record.personalInfo.citizenship).toBe('Filipino');
  });

  it('imports the Others checkbox as Others', () => {
    const record = applyPdfFieldValues({ civilStatus_others: true, surname: 'CRUZ' });
    expect(record.personalInfo.civilStatus).toBe('Others');
  });

  it('keeps a filled child and drops a blank row between filled rows', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      children_01_fullName: 'ANA REYES',
      children_01_dateOfBirth: '03/04/2015',
      children_02_fullName: '',
      children_03_fullName: 'LUIS REYES',
    });
    expect(record.familyBackground.children.map((child) => child.fullName)).toEqual([
      'ANA REYES',
      'LUIS REYES',
    ]);
  });

  it('imports PRESENT as the current job and drops a blank government-service row', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      workExperience_01_positionTitle: 'Teacher',
      workExperience_01_inclusiveDatesTo: 'PRESENT',
      workExperience_01_isGovernmentService: 'Y',
      workExperience_02_isGovernmentService: 'N',
    });
    expect(record.workExperience).toHaveLength(1);
    expect(record.workExperience[0].positionTitle).toBe('Teacher');
    expect(record.workExperience[0].isPresent).toBe(true);
    expect(record.workExperience[0].inclusiveDatesTo).toBe('');
    expect(record.workExperience[0].isGovernmentService).toBe(true);
  });

  it('imports a YES answer and stores question 40b details on pwdIdNo', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      backgroundQuestions_34a_y: true,
      backgroundQuestions_34a_details: 'Cousin in HR',
      backgroundQuestions_40b_y: true,
      backgroundQuestions_40b_details: 'PWD-123',
    });
    expect(record.backgroundQuestions.relatedWithinThirdDegree.answer).toBe(true);
    expect(record.backgroundQuestions.relatedWithinThirdDegree.details).toBe('Cousin in HR');
    expect(record.backgroundQuestions.personWithDisability.answer).toBe(true);
    expect(record.backgroundQuestions.personWithDisability.pwdIdNo).toBe('PWD-123');
  });

  it('lets NO win when both YES and NO are checked', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      backgroundQuestions_36_y: true,
      backgroundQuestions_36_n: true,
    });
    expect(record.backgroundQuestions.convictedOfCrimeOrViolation.answer).toBe(false);
  });

  it('splits the combined ID issuance field', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      declaration_dateAndPlaceOfIssuance: '01/05/2020, Quezon City',
    });
    expect(record.declaration.dateOfIssuance).toBe('01/05/2020');
    expect(record.declaration.placeOfIssuance).toBe('Quezon City');
  });

  it('writes the first college row and leaves one blank graduate-studies row', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      college_nameOfSchool: 'UP Diliman',
      college_degreeCourse: 'BS CS',
    });
    expect(record.education.college).toHaveLength(1);
    expect(record.education.college[0].nameOfSchool).toBe('UP Diliman');
    expect(record.education.college[0].degreeCourse).toBe('BS CS');
    expect(record.education.graduateStudies).toHaveLength(1);
    expect(record.education.graduateStudies[0].nameOfSchool).toBe('');
  });

  it('pads references back to three rows', () => {
    const record = applyPdfFieldValues({
      surname: 'REYES',
      references_01_name: 'MARIA SANTOS',
    });
    expect(record.references).toHaveLength(3);
    expect(record.references[0].name).toBe('MARIA SANTOS');
    expect(record.references[1].name).toBe('');
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/pdfImport/applyPdfFields.test.ts`

Expected: FAIL because `src/pdfImport/applyPdfFields.ts` does not exist.

- [ ] **Step 4: Write the implementation**

Create `src/pdfImport/applyPdfFields.ts`:

```typescript
import {
  CitizenshipType,
  CivilStatus,
  DualCitizenshipMode,
  EducationEntry,
  PdsRecord,
  SexAtBirth,
} from '../types/pds';
import {
  createEmptyChild,
  createEmptyEducationEntry,
  createEmptyEligibility,
  createEmptyReference,
  createEmptyTraining,
  createEmptyVoluntaryWork,
  createEmptyWorkExperience,
  createNewPdsRecord,
} from '../db/defaultPdsData';

const PERSONAL_TEXT_KEYS = new Set([
  'surname',
  'firstName',
  'middleName',
  'nameExtension',
  'dateOfBirth',
  'placeOfBirth',
  'height',
  'weight',
  'bloodType',
  'umidIdNo',
  'pagIbigIdNo',
  'philhealthNo',
  'philSysCardNumber',
  'tinNo',
  'agencyEmployeeNo',
  'dualCitizenshipCountry',
  'telephoneNo',
  'mobileNo',
  'emailAddress',
]);

const SEX_KEYS: Record<string, SexAtBirth> = {
  sexAtBirth_male: 'Male',
  sexAtBirth_female: 'Female',
};

const CIVIL_STATUS_KEYS: Record<string, CivilStatus> = {
  civilStatus_single: 'Single',
  civilStatus_married: 'Married',
  civilStatus_widowed: 'Widow/er',
  civilStatus_separated: 'Separated',
  civilStatus_others: 'Others',
};

const CITIZENSHIP_KEYS: Record<string, CitizenshipType> = {
  citizenship_filipino: 'Filipino',
  citizenship_dual: 'Dual Citizenship',
};

const DUAL_MODE_KEYS: Record<string, DualCitizenshipMode> = {
  dualCitizenship_byBirth: 'by birth',
  dualCitizenship_byNaturalization: 'by naturalization',
};

const ADDRESS_PREFIXES = ['residentialAddress', 'permanentAddress'] as const;

const BACKGROUND_KEYS: Record<string, keyof PdsRecord['backgroundQuestions']> = {
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

const BACKGROUND_DETAILS: Record<string, string> = {
  immigrantOrPermanentResidentAbroad: 'country',
  indigenousGroupMember: 'specify',
  personWithDisability: 'pwdIdNo',
  soloParent: 'soloParentIdNo',
};

const OTHER_INFO_LISTS = {
  hobbies: 'specialSkillsHobbies',
  distinction: 'nonAcademicDistinctions',
  membership: 'membershipInAssociations',
} as const;

function text(value: string | boolean): string {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureIndex<T>(list: T[], index: number, create: () => T): T {
  while (list.length <= index) list.push(create());
  return list[index];
}

function blankEducation(entry: EducationEntry): boolean {
  return (
    !entry.nameOfSchool.trim() &&
    !entry.degreeCourse.trim() &&
    !entry.periodFromYear.trim() &&
    !entry.periodToYear.trim() &&
    !entry.highestLevelUnitsEarned.trim() &&
    !entry.yearGraduated.trim() &&
    !entry.scholarshipAcademicHonors.trim()
  );
}

function pruneImportedLists(record: PdsRecord): void {
  const children = record.familyBackground.children.filter(
    (child) => child.fullName.trim() || child.dateOfBirth.trim(),
  );
  record.familyBackground.children = children.length > 0 ? children : [createEmptyChild()];

  const eligibility = record.eligibility.filter(
    (entry) =>
      entry.careerServiceRA1080OrSpecialLaw.trim() ||
      entry.rating.trim() ||
      entry.dateOfExamConferment.trim() ||
      entry.placeOfExamConferment.trim() ||
      entry.licenseNumber.trim() ||
      entry.licenseValidityDate.trim(),
  );
  record.eligibility = eligibility.length > 0 ? eligibility : [createEmptyEligibility()];

  const work = record.workExperience.filter(
    (entry) =>
      entry.inclusiveDatesFrom.trim() ||
      entry.inclusiveDatesTo.trim() ||
      entry.isPresent ||
      entry.positionTitle.trim() ||
      entry.departmentAgencyOfficeCompany.trim() ||
      entry.monthlySalary.trim() ||
      entry.salaryJobPayGradeStepIncrement.trim() ||
      entry.statusOfAppointment.trim(),
  );
  record.workExperience = work.length > 0 ? work : [createEmptyWorkExperience()];

  const trainings = record.trainings.filter(
    (entry) =>
      entry.title.trim() ||
      entry.inclusiveDatesFrom.trim() ||
      entry.inclusiveDatesTo.trim() ||
      entry.numberOfHours.trim() ||
      entry.typeOfLD.trim() ||
      entry.conductedSponsoredBy.trim(),
  );
  record.trainings = trainings.length > 0 ? trainings : [createEmptyTraining()];

  const voluntary = record.voluntaryWork.filter(
    (entry) =>
      entry.organizationNameAddress.trim() ||
      entry.inclusiveDatesFrom.trim() ||
      entry.inclusiveDatesTo.trim() ||
      entry.numberOfHours.trim() ||
      entry.positionNatureOfWork.trim(),
  );
  record.voluntaryWork = voluntary.length > 0 ? voluntary : [createEmptyVoluntaryWork()];

  for (const level of ['vocationalTrade', 'college', 'graduateStudies'] as const) {
    const filled = record.education[level].filter((entry) => !blankEducation(entry));
    record.education[level] = filled.length > 0 ? filled : [createEmptyEducationEntry()];
  }

  for (const listKey of [
    'specialSkillsHobbies',
    'nonAcademicDistinctions',
    'membershipInAssociations',
  ] as const) {
    const list = record.otherInfo[listKey];
    while (list.length > 1 && list[list.length - 1].trim() === '') list.pop();
    if (list.length === 0) list.push('');
  }

  while (record.references.length < 3) record.references.push(createEmptyReference());
}

export function applyPdfFieldValue(record: PdsRecord, key: string, value: string | boolean): boolean {
  const personal = record.personalInfo;

  if (key in SEX_KEYS) {
    if (value === true) personal.sexAtBirth = SEX_KEYS[key];
    return true;
  }
  if (key in CIVIL_STATUS_KEYS) {
    if (value === true) personal.civilStatus = CIVIL_STATUS_KEYS[key];
    return true;
  }
  if (key in CITIZENSHIP_KEYS) {
    if (value === true) personal.citizenship = CITIZENSHIP_KEYS[key];
    return true;
  }
  if (key in DUAL_MODE_KEYS) {
    if (value === true) personal.dualCitizenshipMode = DUAL_MODE_KEYS[key];
    return true;
  }
  if (PERSONAL_TEXT_KEYS.has(key)) {
    (personal as unknown as Record<string, string>)[key] = text(value);
    return true;
  }

  for (const prefix of ADDRESS_PREFIXES) {
    if (key.startsWith(`${prefix}_`)) {
      const subKey = key.slice(prefix.length + 1);
      (personal[prefix] as unknown as Record<string, string>)[subKey] = text(value);
      return true;
    }
  }

  if (key.startsWith('spouse_')) {
    const subKey = key.slice('spouse_'.length);
    (record.familyBackground.spouse as unknown as Record<string, string>)[subKey] = text(value);
    return true;
  }
  if (key.startsWith('father_')) {
    const subKey = key.slice('father_'.length);
    (record.familyBackground.father as unknown as Record<string, string>)[subKey] = text(value);
    return true;
  }
  if (key.startsWith('mother_')) {
    const subKey = key.slice('mother_'.length);
    (record.familyBackground.mother as unknown as Record<string, string>)[subKey] = text(value);
    return true;
  }

  const childMatch = key.match(/^children_(\d{2})_(fullName|dateOfBirth)$/);
  if (childMatch) {
    const child = ensureIndex(
      record.familyBackground.children,
      Number(childMatch[1]) - 1,
      createEmptyChild,
    );
    child[childMatch[2] as 'fullName' | 'dateOfBirth'] = text(value);
    return true;
  }

  for (const level of ['elementary', 'secondary', 'vocationalTrade', 'college', 'graduateStudies'] as const) {
    if (!key.startsWith(`${level}_`)) continue;
    const subKey = key.slice(level.length + 1);
    if (level === 'elementary' || level === 'secondary') {
      (record.education[level] as unknown as Record<string, string>)[subKey] = text(value);
    } else {
      const entry = ensureIndex(record.education[level], 0, createEmptyEducationEntry);
      (entry as unknown as Record<string, string>)[subKey] = text(value);
    }
    return true;
  }

  const eligibilityMatch = key.match(
    /^eligibility_(\d{2})_(careerServiceRA1080OrSpecialLaw|rating|dateOfExamConferment|placeOfExamConferment|licenseNumber|licenseValidityDate)$/,
  );
  if (eligibilityMatch) {
    const entry = ensureIndex(record.eligibility, Number(eligibilityMatch[1]) - 1, createEmptyEligibility);
    (entry as unknown as Record<string, string>)[eligibilityMatch[2]] = text(value);
    return true;
  }

  const workMatch = key.match(
    /^workExperience_(\d{2})_(inclusiveDatesFrom|inclusiveDatesTo|positionTitle|departmentAgencyOfficeCompany|monthlySalary|salaryJobPayGradeStepIncrement|statusOfAppointment|isGovernmentService)$/,
  );
  if (workMatch) {
    const entry = ensureIndex(record.workExperience, Number(workMatch[1]) - 1, createEmptyWorkExperience);
    const subKey = workMatch[2];
    if (subKey === 'inclusiveDatesTo') {
      const raw = text(value);
      if (raw.toUpperCase() === 'PRESENT') {
        entry.isPresent = true;
        entry.inclusiveDatesTo = '';
      } else {
        entry.inclusiveDatesTo = raw;
        if (raw) entry.isPresent = false;
      }
      return true;
    }
    if (subKey === 'isGovernmentService') {
      if (value === true || value === 'Y' || value === 'YES') entry.isGovernmentService = true;
      else if (value === false || value === 'N' || value === 'NO') entry.isGovernmentService = false;
      else entry.isGovernmentService = null;
      return true;
    }
    (entry as unknown as Record<string, string>)[subKey] = text(value);
    return true;
  }

  const trainingMatch = key.match(
    /^trainings_(\d{2})_(title|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|typeOfLD|conductedSponsoredBy)$/,
  );
  if (trainingMatch) {
    const entry = ensureIndex(record.trainings, Number(trainingMatch[1]) - 1, createEmptyTraining);
    (entry as unknown as Record<string, string>)[trainingMatch[2]] = text(value);
    return true;
  }

  const voluntaryMatch = key.match(
    /^voluntaryWork_(\d{2})_(organizationNameAddress|inclusiveDatesFrom|inclusiveDatesTo|numberOfHours|positionNatureOfWork)$/,
  );
  if (voluntaryMatch) {
    const entry = ensureIndex(record.voluntaryWork, Number(voluntaryMatch[1]) - 1, createEmptyVoluntaryWork);
    (entry as unknown as Record<string, string>)[voluntaryMatch[2]] = text(value);
    return true;
  }

  const otherMatch = key.match(/^otherInfo_(hobbies|distinction|membership)_(\d{2})$/);
  if (otherMatch) {
    const listKey = OTHER_INFO_LISTS[otherMatch[1] as keyof typeof OTHER_INFO_LISTS];
    const list = record.otherInfo[listKey];
    const index = Number(otherMatch[2]) - 1;
    while (list.length <= index) list.push('');
    list[index] = text(value);
    return true;
  }

  const backgroundMatch = key.match(
    /^backgroundQuestions_(34a|34b|35a|35b|36|37|38a|38b|39|40a|40b|40c)_(y|n|details|dateFiled|statusOfCase)$/,
  );
  if (backgroundMatch) {
    const questionKey = BACKGROUND_KEYS[backgroundMatch[1]];
    const question = record.backgroundQuestions[questionKey] as unknown as Record<string, unknown>;
    const part = backgroundMatch[2];
    if (part === 'y' && value === true) question.answer = true;
    if (part === 'n' && value === true) question.answer = false;
    if (part === 'dateFiled') question.dateFiled = text(value);
    if (part === 'statusOfCase') question.statusOfCase = text(value);
    if (part === 'details') {
      const detailsKey = BACKGROUND_DETAILS[questionKey] ?? 'details';
      question[detailsKey] = text(value);
    }
    return true;
  }

  const referenceMatch = key.match(/^references_(\d{2})_(name|officeResidentialAddress|contactNoOrEmail)$/);
  if (referenceMatch) {
    const entry = ensureIndex(record.references, Number(referenceMatch[1]) - 1, createEmptyReference);
    (entry as unknown as Record<string, string>)[referenceMatch[2]] = text(value);
    return true;
  }

  if (key === 'declaration_governmentIssuedId' || key === 'declaration_idLicensePassportNo') {
    const subKey = key.slice('declaration_'.length);
    (record.declaration as unknown as Record<string, string>)[subKey] = text(value);
    return true;
  }
  if (key === 'declaration_dateAndPlaceOfIssuance') {
    const raw = text(value);
    const comma = raw.indexOf(',');
    if (comma === -1) {
      record.declaration.dateOfIssuance = raw;
      record.declaration.placeOfIssuance = '';
    } else {
      record.declaration.dateOfIssuance = raw.slice(0, comma).trim();
      record.declaration.placeOfIssuance = raw.slice(comma + 1).trim();
    }
    return true;
  }

  return false;
}

export function applyPdfFieldValues(
  values: Record<string, string | boolean>,
  title = 'Imported PDS',
): PdsRecord {
  const record = createNewPdsRecord(title);
  record.personalInfo.citizenship = '';
  const keys = Object.keys(values).sort((left, right) => {
    const score = (key: string) => (key.endsWith('_n') ? 1 : 0);
    return score(left) - score(right);
  });
  for (const key of keys) applyPdfFieldValue(record, key, values[key]);
  pruneImportedLists(record);
  const surname = record.personalInfo.surname.trim();
  const firstName = record.personalInfo.firstName.trim();
  record.meta.title = [surname, firstName].filter(Boolean).join(', ') || title;
  return record;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/pdfImport/applyPdfFields.test.ts`

Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/pdfImport/applyPdfFields.ts src/pdfImport/applyPdfFields.test.ts
git commit -m "test: map CS Form 212 field values onto a PDS record"
```

---

### Task 2: Attach the full PDS record inside the PDF

**Files:**
- Create: `src/pdfImport/pdsPdfAttachment.ts`
- Create: `src/pdfImport/pdsPdfAttachment.test.ts`
- Test: `src/pdfImport/pdsPdfAttachment.test.ts`

**Interfaces:**
- Consumes: `PdsRecord` from `src/types/pds.ts`. `PDFDocument` from `pdf-lib`.
- Produces:
  - `PDS_ATTACHMENT_NAME = 'govformsph-pds.json'`
  - `attachPdsRecord(pdfDoc: PDFDocument, record: PdsRecord): void`
  - `readAttachedPdsRecord(pdfDoc: PDFDocument): PdsRecord | null`
  - `isPdsRecord(value: unknown): value is PdsRecord` — true only when `personalInfo`, `familyBackground`, `education`, `declaration`, and `meta` are objects.

- [ ] **Step 1: Write the failing test**

Create `src/pdfImport/pdsPdfAttachment.test.ts`:

```typescript
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { attachPdsRecord, readAttachedPdsRecord } from './pdsPdfAttachment';

describe('pdsPdfAttachment', () => {
  it('round-trips the record through a saved PDF', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    const record = createNewPdsRecord('Attached');
    record.personalInfo.surname = 'SANTOS';
    record.declaration.idPhoto = 'data:image/png;base64,aaaa';
    attachPdsRecord(pdfDoc, record);

    const reloaded = await PDFDocument.load(await pdfDoc.save());
    const attached = readAttachedPdsRecord(reloaded);
    expect(attached?.personalInfo.surname).toBe('SANTOS');
    expect(attached?.declaration.idPhoto).toBe('data:image/png;base64,aaaa');
    expect(attached?.meta.formVersion).toBe('CS-Form-212-2026');
  });

  it('returns null when the PDF has no attachment', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    expect(readAttachedPdsRecord(pdfDoc)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pdfImport/pdsPdfAttachment.test.ts`

Expected: FAIL because `src/pdfImport/pdsPdfAttachment.ts` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/pdfImport/pdsPdfAttachment.ts`:

```typescript
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFString,
} from 'pdf-lib';
import { PdsRecord } from '../types/pds';

export const PDS_ATTACHMENT_NAME = 'govformsph-pds.json';

export function isPdsRecord(value: unknown): value is PdsRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as PdsRecord;
  return Boolean(
    record.personalInfo &&
      typeof record.personalInfo === 'object' &&
      record.familyBackground &&
      typeof record.familyBackground === 'object' &&
      record.education &&
      typeof record.education === 'object' &&
      record.declaration &&
      typeof record.declaration === 'object' &&
      record.meta &&
      typeof record.meta === 'object',
  );
}

function decodeName(value: unknown): string {
  if (value instanceof PDFHexString || value instanceof PDFString) return value.decodeText();
  return '';
}

export function attachPdsRecord(pdfDoc: PDFDocument, record: PdsRecord): void {
  const bytes = new TextEncoder().encode(JSON.stringify(record));
  const fileStreamRef = pdfDoc.context.register(
    pdfDoc.context.flateStream(bytes, {
      Type: 'EmbeddedFile',
      Params: { Size: bytes.length },
    }),
  );
  const fileSpecRef = pdfDoc.context.register(
    pdfDoc.context.obj({
      Type: 'Filespec',
      F: PDFString.of(PDS_ATTACHMENT_NAME),
      UF: PDFHexString.fromText(PDS_ATTACHMENT_NAME),
      EF: { F: fileStreamRef },
      Desc: PDFString.of('GovFormsPH PDS record'),
    }),
  );

  let namesDict = pdfDoc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  if (!namesDict) {
    namesDict = pdfDoc.context.obj({});
    pdfDoc.catalog.set(PDFName.of('Names'), namesDict);
  }
  namesDict.set(
    PDFName.of('EmbeddedFiles'),
    pdfDoc.context.obj({
      Names: [PDFHexString.fromText(PDS_ATTACHMENT_NAME), fileSpecRef],
    }),
  );
}

export function readAttachedPdsRecord(pdfDoc: PDFDocument): PdsRecord | null {
  const namesDict = pdfDoc.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
  const embeddedFiles = namesDict?.lookupMaybe(PDFName.of('EmbeddedFiles'), PDFDict);
  const nameTree = embeddedFiles?.lookupMaybe(PDFName.of('Names'), PDFArray);
  if (!nameTree) return null;

  for (let index = 0; index < nameTree.size(); index += 2) {
    const name = decodeName(nameTree.lookup(index));
    if (name !== PDS_ATTACHMENT_NAME) continue;
    const spec = nameTree.lookup(index + 1, PDFDict);
    const embedded = spec?.lookupMaybe(PDFName.of('EF'), PDFDict);
    const stream = embedded?.lookupMaybe(PDFName.of('F'), PDFRawStream);
    if (!stream) return null;
    try {
      const json = new TextDecoder().decode(decodePDFRawStream(stream).decode());
      const parsed: unknown = JSON.parse(json);
      return isPdsRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pdfImport/pdsPdfAttachment.test.ts`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/pdfImport/pdsPdfAttachment.ts src/pdfImport/pdsPdfAttachment.test.ts
git commit -m "feat: attach the PDS record inside the exported PDF"
```

---

### Task 3: Parse a PDS PDF into one record

**Files:**
- Create: `src/pdfImport/parsePdsPdf.ts`
- Create: `src/pdfImport/parsePdsPdf.test.ts`
- Modify: `src/utils/exportImport.ts`
- Test: `src/pdfImport/parsePdsPdf.test.ts`

**Interfaces:**
- Consumes: `applyPdfFieldValues` from Task 1. `attachPdsRecord`, `readAttachedPdsRecord`, and `isPdsRecord` from Task 2. `fieldMap.acroFields`. `parseImportFile` already exported from `src/utils/exportImport.ts`.
- Produces:
  - `readAcroAppValues(pdfDoc: PDFDocument): Record<string, string | boolean>` — keys are app-data keys, not PDF field names. Text fields become trimmed strings. Checkboxes become booleans. Other field types are skipped.
  - `ACROFORM_IMPORT_WARNINGS: string[]` — the three warning strings in Step 3.
  - `parsePdsPdf(bytes: Uint8Array, fileName?: string): Promise<PdsPdfImportResult>`
  - `PdsPdfImportResult` fields: `success`, `records`, `salnRecords`, `isEncrypted`, `warnings`, `source` (`'attachment' | 'acroform' | 'unrecognized'`), optional `error`.
  - `parseImportBytes(fileName: string, bytes: Uint8Array, passphrase?: string)` in `src/utils/exportImport.ts`. PDF bytes go to `parsePdsPdf`. Every other file is decoded as UTF-8 and passed to `parseImportFile`.

- [ ] **Step 1: Write the failing test**

Create `src/pdfImport/parsePdsPdf.test.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { createNewPdsRecord } from '../db/defaultPdsData';
import { parseImportBytes } from '../utils/exportImport';
import { attachPdsRecord } from './pdsPdfAttachment';
import { parsePdsPdf } from './parsePdsPdf';

const templateBytes = new Uint8Array(readFileSync('public/pdf-templates/csc212-2026/pds.pdf'));

describe('parsePdsPdf', () => {
  it('reads filled AcroForm fields from the official template', async () => {
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const surname = form.getField('c1_surname');
    const male = form.getField('c1_male');
    expect(surname).toBeInstanceOf(PDFTextField);
    expect(male).toBeInstanceOf(PDFCheckBox);
    form.getTextField('c1_surname').setText('DELA CRUZ');
    form.getTextField('c1_firstname').setText('JUAN');
    form.getCheckBox('c1_male').check();

    const result = await parsePdsPdf(await pdfDoc.save(), 'juan-pds.pdf');
    expect(result.success).toBe(true);
    expect(result.source).toBe('acroform');
    expect(result.records).toHaveLength(1);
    expect(result.salnRecords).toEqual([]);
    expect(result.records[0].personalInfo.surname).toBe('DELA CRUZ');
    expect(result.records[0].personalInfo.firstName).toBe('JUAN');
    expect(result.records[0].personalInfo.sexAtBirth).toBe('Male');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('prefers the embedded record over form fields', async () => {
    const pdfDoc = await PDFDocument.load(templateBytes);
    pdfDoc.getForm().getTextField('c1_surname').setText('FIELD');
    const attached = createNewPdsRecord('Attached');
    attached.personalInfo.surname = 'ATTACHED';
    attachPdsRecord(pdfDoc, attached);

    const result = await parsePdsPdf(await pdfDoc.save());
    expect(result.success).toBe(true);
    expect(result.source).toBe('attachment');
    expect(result.records[0].personalInfo.surname).toBe('ATTACHED');
    expect(result.warnings).toEqual([]);
  });

  it('rejects a PDF that is not a CS Form 212', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    const result = await parsePdsPdf(await pdfDoc.save());
    expect(result.success).toBe(false);
    expect(result.source).toBe('unrecognized');
    expect(result.error).toMatch(/no fillable CS Form 212 fields/);
    expect(result.records).toEqual([]);
  });

  it('rejects a blank official template', async () => {
    const result = await parsePdsPdf(templateBytes);
    expect(result.success).toBe(false);
    expect(result.source).toBe('acroform');
    expect(result.error).toMatch(/every mapped field is blank/);
  });

  it('routes a JSON backup through the existing parser', async () => {
    const record = createNewPdsRecord('Backup');
    record.personalInfo.surname = 'JSON';
    const bytes = new TextEncoder().encode(
      JSON.stringify({ type: 'single-form', record }),
    );
    const result = await parseImportBytes('backup.json', bytes);
    expect(result.success).toBe(true);
    expect(result.records[0].personalInfo.surname).toBe('JSON');
  });

  it('routes a PDF even when the file name is not .pdf', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    const result = await parseImportBytes('notes.json', await pdfDoc.save());
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no fillable CS Form 212 fields/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pdfImport/parsePdsPdf.test.ts`

Expected: FAIL because `parsePdsPdf` and `parseImportBytes` are not defined.

- [ ] **Step 3: Write the PDF parser**

Create `src/pdfImport/parsePdsPdf.ts`:

```typescript
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib';
import { fieldMap } from '../pdfExport/fieldMap-csc2122016-c1.js';
import { PdsRecord } from '../types/pds';
import { SalnRecord } from '../types/saln';
import { applyPdfFieldValues } from './applyPdfFields';
import { isPdsRecord, readAttachedPdsRecord } from './pdsPdfAttachment';

const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const ACROFORM_IMPORT_WARNINGS = [
  'Photo, signature, and thumbmark are not form fields, so they were not imported.',
  'Work Experience Sheet duties, graduate studies, and extra school rows beyond the first vocational or college line are not in the PDF fields.',
  'Civil status "Solo Parent" is stored in the PDF as Others, so it imports as Others.',
];

export interface PdsPdfImportResult {
  success: boolean;
  records: PdsRecord[];
  salnRecords: SalnRecord[];
  isEncrypted: boolean;
  warnings: string[];
  source: 'attachment' | 'acroform' | 'unrecognized';
  error?: string;
}

function emptyResult(source: PdsPdfImportResult['source'], error: string): PdsPdfImportResult {
  return {
    success: false,
    records: [],
    salnRecords: [],
    isEncrypted: false,
    warnings: [],
    source,
    error,
  };
}

export function readAcroAppValues(pdfDoc: PDFDocument): Record<string, string | boolean> {
  const pdfNameToAppKey = new Map<string, string>();
  for (const [appKey, pdfName] of Object.entries(fieldMap.acroFields as Record<string, string>)) {
    pdfNameToAppKey.set(pdfName, appKey);
  }
  const values: Record<string, string | boolean> = {};
  for (const field of pdfDoc.getForm().getFields()) {
    const appKey = pdfNameToAppKey.get(field.getName());
    if (!appKey) continue;
    if (field instanceof PDFTextField) values[appKey] = (field.getText() ?? '').trim();
    else if (field instanceof PDFCheckBox) values[appKey] = field.isChecked();
  }
  return values;
}

function hasFilledValue(values: Record<string, string | boolean>): boolean {
  return Object.values(values).some(
    (value) => value === true || (typeof value === 'string' && value.trim() !== ''),
  );
}

export async function parsePdsPdf(bytes: Uint8Array, fileName = 'pds.pdf'): Promise<PdsPdfImportResult> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    return emptyResult('unrecognized', 'This PDF is larger than 25 MB and was not imported.');
  }
  const header = bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  if (!header) return emptyResult('unrecognized', 'This file is not a readable PDF.');

  let pdfDoc: PDFDocument;
  try {
    pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch {
    return emptyResult('unrecognized', 'This file is not a readable PDF.');
  }

  const attached = readAttachedPdsRecord(pdfDoc);
  if (attached && isPdsRecord(attached)) {
    return {
      success: true,
      records: [attached],
      salnRecords: [],
      isEncrypted: false,
      warnings: [],
      source: 'attachment',
    };
  }

  const values = readAcroAppValues(pdfDoc);
  if (Object.keys(values).length === 0) {
    return emptyResult(
      'unrecognized',
      'This PDF has no fillable CS Form 212 fields and no GovFormsPH record attached. Print PDFs made before this update are flattened and cannot be imported. Import the JSON backup, or a fillable PDS PDF.',
    );
  }
  if (!hasFilledValue(values)) {
    return emptyResult('acroform', 'This looks like a CS Form 212 PDF, but every mapped field is blank.');
  }

  const title = fileName.replace(/\.pdf$/i, '') || 'Imported PDS';
  return {
    success: true,
    records: [applyPdfFieldValues(values, title)],
    salnRecords: [],
    isEncrypted: false,
    warnings: [...ACROFORM_IMPORT_WARNINGS],
    source: 'acroform',
  };
}
```

In `src/utils/exportImport.ts`, add this import next to the existing imports:

```typescript
import { parsePdsPdf } from '../pdfImport/parsePdsPdf';
```

Add this function after `parseImportFile`:

```typescript
export async function parseImportBytes(
  fileName: string,
  bytes: Uint8Array,
  passphrase?: string,
) {
  const isPdf =
    fileName.toLowerCase().endsWith('.pdf') ||
    (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
  if (isPdf) return parsePdsPdf(bytes, fileName);
  return parseImportFile(new TextDecoder().decode(bytes), passphrase);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/pdfImport/parsePdsPdf.test.ts`

Expected: PASS, 6 tests. If `c1_male` is not a `PDFCheckBox`, stop and report the actual field type. Do not switch that assertion to the type the template happens to use without checking `generatePdsPage1Pdf`, which checks the male box with `PDFCheckBox.check()`.

- [ ] **Step 5: Commit**

```bash
git add src/pdfImport/parsePdsPdf.ts src/pdfImport/parsePdsPdf.test.ts src/utils/exportImport.ts
git commit -m "feat: parse a CS Form 212 PDF into a PDS record"
```

---

### Task 4: Embed the record when the PDS PDF is generated

**Files:**
- Modify: `src/pdfExport/exportPdsPage1.ts` (`generatePdsPage1Pdf`, around the current signature at line 366 and the save at line 607)
- Modify: `src/pdfImport/parsePdsPdf.test.ts`
- Test: `src/pdfImport/parsePdsPdf.test.ts`

**Interfaces:**
- Consumes: `attachPdsRecord` from Task 2. `parsePdsPdf` from Task 3. The existing template fetch in `fetchTemplateBuffer`.
- Produces: `generatePdsPage1Pdf(record: PdsRecord, templateBytes?: ArrayBuffer | Uint8Array): Promise<PdfExportResult>`. Callers that pass one argument keep working. The saved PDF still flattens the form, and `parsePdsPdf` on those bytes returns `source: 'attachment'` with the same surname.

- [ ] **Step 1: Write the failing test**

Append this import and test inside `describe('parsePdsPdf')` in `src/pdfImport/parsePdsPdf.test.ts`:

```typescript
import { generatePdsPage1Pdf } from '../pdfExport/exportPdsPage1';
```

```typescript
it('recovers a record from a flattened export PDF', async () => {
  const record = createNewPdsRecord('Export');
  record.personalInfo.surname = 'EXPORT';
  record.personalInfo.firstName = 'MARIA';
  record.wesDetails = [
    {
      workExperienceId: 'job-1',
      nameOfOffice: 'DepEd',
      immediateSupervisor: 'Ms. Cruz',
      location: 'Manila',
      accomplishments: ['Led a class'],
      summaryOfDuties: 'Taught math',
    },
  ];
  const exported = await generatePdsPage1Pdf(record, templateBytes);
  const result = await parsePdsPdf(exported.bytes, exported.fileName);
  expect(result.success).toBe(true);
  expect(result.source).toBe('attachment');
  expect(result.records[0].personalInfo.surname).toBe('EXPORT');
  expect(result.records[0].wesDetails?.[0].summaryOfDuties).toBe('Taught math');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/pdfImport/parsePdsPdf.test.ts`

Expected: FAIL. The current exporter flattens the form and does not attach JSON, so `source` is `'unrecognized'` or the function rejects the second argument at compile time.

- [ ] **Step 3: Attach the record before save**

In `src/pdfExport/exportPdsPage1.ts`, add this import:

```typescript
import { attachPdsRecord } from '../pdfImport/pdsPdfAttachment';
```

Change the function signature and the template load:

```typescript
export async function generatePdsPage1Pdf(
  record: PdsRecord,
  templateBytes?: ArrayBuffer | Uint8Array,
): Promise<PdfExportResult> {
  console.info('[GovFormsPH PDF Export] Starting PDS Page 1 export with pdf-lib...');

  const templateBuffer = templateBytes ?? (await fetchTemplateBuffer());
  const pdfDoc = await PDFDocument.load(templateBuffer);
```

Leave the fill, checkbox, and flatten steps as they are. Immediately after the flatten `try/catch` and before `const bytes = await pdfDoc.save();`, add:

```typescript
  attachPdsRecord(pdfDoc, record);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/pdfImport/parsePdsPdf.test.ts src/pdfImport/pdsPdfAttachment.test.ts`

Expected: PASS. The export test's `source` is `'attachment'`.

- [ ] **Step 5: Commit**

```bash
git add src/pdfExport/exportPdsPage1.ts src/pdfImport/parsePdsPdf.test.ts
git commit -m "feat: keep the PDS record attached to the exported PDF"
```

---

### Task 5: Accept the PDS PDF on the Import card

**Files:**
- Modify: `src/pages/ExportImportPage.tsx`
- Test: `src/pdfImport/parsePdsPdf.test.ts` (the `parseImportBytes` coverage from Task 3 is the automated check; this task is the screen)

**Interfaces:**
- Consumes: `parseImportBytes` from `src/utils/exportImport.ts`. `restoreRecords` is unchanged. A successful PDF result has `records.length === 1`, `salnRecords: []`, `warnings`, and `source`.
- Produces: the Import card reads `File.arrayBuffer()`, accepts `.pdf`, and shows `warnings` under the preview. Decrypt still passes the original bytes and the passphrase to `parseImportBytes`.

- [ ] **Step 1: Confirm the router test already covers the bytes the page will pass**

Run: `npx vitest run src/pdfImport/parsePdsPdf.test.ts`

Expected: PASS, including "routes a JSON backup" and "routes a PDF even when the file name is not .pdf".

- [ ] **Step 2: Switch the page from text to bytes**

In `src/pages/ExportImportPage.tsx`, change the import line to:

```typescript
import { exportAllData, parseImportBytes, restoreRecords, triggerDownload } from '../utils/exportImport';
```

Replace `importFileContent` state with:

```typescript
const [importFileBytes, setImportFileBytes] = useState<Uint8Array | null>(null);
```

Extend the preview state type with:

```typescript
warnings?: string[];
source?: 'attachment' | 'acroform' | 'unrecognized';
```

Replace `handleFileSelect`:

```typescript
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
    const file = e.target.files[0];
    setImportFileName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    setImportFileBytes(bytes);
    setImportSuccessMessage(null);

    const parsed = await parseImportBytes(file.name, bytes, importPassphrase);
    setImportPreview(parsed);
  }
};
```

Replace `handleDecryptAttempt`:

```typescript
const handleDecryptAttempt = async () => {
  if (!importFileBytes) return;
  const parsed = await parseImportBytes(importFileName, importFileBytes, importPassphrase);
  setImportPreview(parsed);
};
```

In `handleExecuteImport`, the reset block must clear bytes instead of the old string:

```typescript
setImportFileBytes(null);
```

Change the file input to:

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept=".json,.vault,.pdf,application/json,application/pdf"
  onChange={handleFileSelect}
  className="hidden"
/>
```

Replace the paragraph above the drop zone with:

```tsx
<p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
  Select a GovFormsPH <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.json</code> backup, an encrypted <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">.vault</code>, or the CS Form 212 PDF itself.
</p>
```

Replace the drop-zone hint with:

```tsx
<p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
  Supports a CS Form 212 PDF, .GovFormsPH.json, .vault, or an individual form JSON export
</p>
```

Inside the success preview, after the file-name row and before Import Action, add:

```tsx
{importPreview.source === 'attachment' && (
  <p className="text-[11px] text-slate-600 dark:text-slate-300">
    Full record recovered from the PDS PDF.
  </p>
)}
{importPreview.source === 'acroform' && (
  <p className="text-[11px] text-slate-600 dark:text-slate-300">
    Read from CS Form 212 fields.
  </p>
)}
{importPreview.warnings?.map((warning) => (
  <p key={warning} className="text-[11px] text-amber-700 dark:text-amber-300">
    {warning}
  </p>
))}
```

Leave Merge and Replace wired to `restoreRecords`. A PDF import of one form still uses those modes.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: exit code 0. `importFileContent` must not remain anywhere in `src/pages/ExportImportPage.tsx`.

- [ ] **Step 4: Check the Import screen in the browser**

Run `npm run dev`. Open Export & Import.

1. Choose `public/pdf-templates/csc212-2026/pds.pdf`. Expected: the blank-template error "every mapped field is blank." No restore button.
2. Fill a PDS, export its PDF from the form preview, then import that PDF. Expected: preview says "Full record recovered from the PDS PDF." and the form count is 1. Confirm restore, then open the draft and check the surname.
3. Import an existing `.json` backup. Expected: the old preview still appears, with no PDF warning.
4. At 375px width, the Import card stacks under Export and the warning text stays inside the card.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ExportImportPage.tsx
git commit -m "feat: import a CS Form 212 PDF from the Import card"
```

---

### Task 6: Document PDF import

**Files:**
- Modify: `README.md` (the "Client-Side Export & Import" list, around lines 42–46)

**Interfaces:**
- Consumes: the behavior from Tasks 3–5.
- Produces: one new bullet. No other README sections change.

- [ ] **Step 1: Add the bullet**

Under "Client-Side Export & Import", after the round-trip JSON bullet, add:

```markdown
  - Import the CS Form 212 PDF itself. A PDF exported by GovFormsPH restores the full draft. A fillable PDF restores the form fields only.
```

- [ ] **Step 2: Run the full test file set**

Run: `npx vitest run`

Expected: PASS. Then run `npx tsc --noEmit`. Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: describe CS Form 212 PDF import"
```

---

## Self-Review

Spec coverage:

- Import the PDS file itself: Tasks 3 and 5.
- PDFs this app generates are flattened today, so a plain field read would fail: Task 4 attaches the record and Task 3 prefers it.
- Fillable official template `public/pdf-templates/csc212-2026/pds.pdf`: Task 3 reads `fieldMap.acroFields`.
- JSON backup still imports: Task 3 router test and Task 5 manual check.
- Photo, signature, WES, graduate studies, extra school rows, and Solo Parent: recovered from the attachment; field-only import shows the three warnings.
- Excel `.xlsx` is out of this plan. There is no workbook in the repo and no cell map to invert.

Placeholder scan: every task has the test code, the implementation, the command, and the expected result. Field-name exceptions are copied from `fieldMap-csc2122016-c1.js`.

Type consistency: `applyPdfFieldValue` / `applyPdfFieldValues` are defined in Task 1 and called in Task 3. `attachPdsRecord` / `readAttachedPdsRecord` / `isPdsRecord` are defined in Task 2 and called in Tasks 3 and 4. `parsePdsPdf` and `parseImportBytes` are defined in Task 3 and called in Tasks 4 and 5. `source` is `'attachment' | 'acroform' | 'unrecognized'` everywhere. `ACROFORM_IMPORT_WARNINGS` is the only warning list.
