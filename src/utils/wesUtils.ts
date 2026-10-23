/**
 * GovFormsPH — Work Experience Sheet (WES) Utilities
 * Derives WES entries relationally from PDS Work Experience (Item 28).
 */

import { PdsRecord, WorkExperienceItem, WesDetailItem } from '../types/pds';

export interface DerivedWesRow {
  /** Stable source ID from workExperience[i].id */
  workExperienceId: string;
  /** Array index in record.workExperience */
  workExperienceIndex: number;
  /** Field 1: Duration (readonly) — formatted from dates */
  duration: string;
  /** Field 2: Position (readonly) — from positionTitle */
  positionTitle: string;
  /** Field 3: Name of Office (fillable) — unit/division within agency */
  nameOfOffice: string;
  /** Field 4: Immediate Supervisor (fillable) */
  immediateSupervisor: string;
  /** Field 5: Name of Agency (readonly) — from departmentAgencyOfficeCompany */
  nameOfAgency: string;
  /** Field 6: Location (fillable) */
  location: string;
  /** Field 7: Combined render only — "Name of Agency, Location" */
  combinedAgencyLocation: string;
  /** Field 8: List of Accomplishments and Contributions (fillable, repeatable list) */
  accomplishments: string[];
  /** Field 9: Summary of Actual Duties (fillable, textarea) */
  summaryOfDuties: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Parses dates formatted as DD/MM/YYYY, YYYY-MM-DD, etc. and formats as
 * "D MMMM YYYY" without leading zero on day (e.g. "11 February 2011", "2 January 2002").
 */
export function formatWesDate(val: string | undefined): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

  // Check DD/MM/YYYY or DD-MM-YYYY (day first)
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
    }
  }

  // Check YYYY-MM-DD or YYYY/MM/DD (year first)
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${day} ${MONTH_NAMES[month - 1]} ${year}`;
    }
  }

  return trimmed;
}

/**
 * Format duration string from inclusiveDatesFrom and inclusiveDatesTo
 * e.g. "11 February 2011 – present" or "2 January 2002 – 10 February 2011"
 */
export function formatDuration(item: WorkExperienceItem): string {
  const rawFrom = (item.inclusiveDatesFrom || '').trim();
  const rawTo = (item.inclusiveDatesTo || '').trim();
  const isPresent = Boolean(item.isPresent || rawTo.toLowerCase() === 'present');

  const fromFormatted = formatWesDate(rawFrom);
  const toFormatted = isPresent ? 'present' : formatWesDate(rawTo);

  if (!fromFormatted && !toFormatted) return '—';
  if (fromFormatted && !toFormatted) return isPresent ? `${fromFormatted} \u2013 present` : fromFormatted;
  if (!fromFormatted && toFormatted) return toFormatted;
  return `${fromFormatted} \u2013 ${toFormatted}`;
}

/**
 * Parses date string (DD/MM/YYYY, YYYY-MM-DD, or ISO) to epoch timestamp for sorting.
 * Returns 0 if invalid or empty.
 */
export function parseDateToEpoch(value: string | undefined): number {
  if (!value) return 0;
  const trimmed = value.trim();
  if (!trimmed) return 0;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return d.getTime() || 0;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    return d.getTime() || 0;
  }

  const parsed = Date.parse(trimmed);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Comparator matching PDS sorting:
 * 1. Present jobs first (isPresent === true)
 * 2. Latest end date (inclusiveDatesTo) or start date (inclusiveDatesFrom) descending
 */
export function compareWorkExperienceDescending(a: WorkExperienceItem, b: WorkExperienceItem): number {
  if (Boolean(a.isPresent) !== Boolean(b.isPresent)) {
    return a.isPresent ? -1 : 1;
  }
  const aDate = parseDateToEpoch(a.inclusiveDatesTo) || parseDateToEpoch(a.inclusiveDatesFrom);
  const bDate = parseDateToEpoch(b.inclusiveDatesTo) || parseDateToEpoch(b.inclusiveDatesFrom);
  return bDate - aDate;
}

/**
 * Returns current date formatted as "D MMMM YYYY" (e.g. "15 September 2026")
 */
export function getCurrentWesDate(): string {
  const today = new Date();
  const day = today.getDate();
  const month = MONTH_NAMES[today.getMonth()];
  const year = today.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Combine Name of Agency and Location for render time only.
 * Do not store this string; compute dynamically.
 */
export function formatAgencyLocation(agency?: string, location?: string): string {
  const cleanAgency = (agency || '').trim();
  const cleanLocation = (location || '').trim();

  if (cleanAgency && cleanLocation) {
    return `${cleanAgency}, ${cleanLocation}`;
  }
  return cleanAgency || cleanLocation || '—';
}

/**
 * Checks if a WesDetailItem matches a target workExperience item.
 * Strict rule: If workExperienceId is present on both, it MUST match exactly.
 * An entry with an existing workExperienceId will NEVER match a different workExperienceId.
 */
export function isMatchingDetail(
  detail: WesDetailItem,
  targetId: string | undefined,
  targetIndex: number
): boolean {
  // If targetId is provided and detail has workExperienceId:
  if (targetId && detail.workExperienceId) {
    return detail.workExperienceId === targetId;
  }
  // If detail already has a workExperienceId that doesn't match targetId, NEVER match by index!
  if (detail.workExperienceId && targetId && detail.workExperienceId !== targetId) {
    return false;
  }
  // Fallback: only if detail has no workExperienceId or target has no id
  return detail.workExperienceIndex === targetIndex;
}

/**
 * Ensures all workExperience items in a PDS record have stable IDs, and backfills
 * legacy wesDetails entries so they link stably by workExperienceId.
 */
export function ensureStableWorkExperienceIds(record: PdsRecord): {
  record: PdsRecord;
  hasChanges: boolean;
} {
  const workExpList = record.workExperience || [];
  let hasChanges = false;

  const updatedWorkExp = workExpList.map((item, idx) => {
    if (!item.id) {
      hasChanges = true;
      const generatedId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `we-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
      return { ...item, id: generatedId };
    }
    return item;
  });

  // Also backfill wesDetails with workExperienceId if it was only stored with workExperienceIndex,
  // or migrate synthetic IDs like "we-0" to the real stable workExperienceId.
  const updatedWesDetails = (record.wesDetails || []).map((detail) => {
    const isSynthetic = detail.workExperienceId && /^we-\d+$/.test(detail.workExperienceId);
    if ((!detail.workExperienceId || isSynthetic) && detail.workExperienceIndex !== undefined) {
      const matchedWorkExp = updatedWorkExp[detail.workExperienceIndex];
      if (matchedWorkExp && matchedWorkExp.id) {
        hasChanges = true;
        return { ...detail, workExperienceId: matchedWorkExp.id };
      }
    }
    return detail;
  });

  if (!hasChanges) {
    return { record, hasChanges: false };
  }

  return {
    record: {
      ...record,
      workExperience: updatedWorkExp,
      wesDetails: updatedWesDetails,
    },
    hasChanges: true,
  };
}

/**
 * Find matching WesDetailItem for a work experience entry strictly by stable ID or index fallback
 */
export function findWesDetail(
  item: WorkExperienceItem,
  index: number,
  wesDetails?: WesDetailItem[]
): WesDetailItem | undefined {
  if (!wesDetails || wesDetails.length === 0) return undefined;
  return wesDetails.find((d) => isMatchingDetail(d, item.id, index));
}

/**
 * Derive full WES rows directly from PDS record.workExperience and record.wesDetails.
 * Zero duplication of readonly fields. Only real workExperience entries get rows.
 * Sorted latest first (same as PDS).
 */
export function deriveWesRows(record: PdsRecord): DerivedWesRow[] {
  const workExpList = record.workExperience || [];

  // Pair each item with its original index in record.workExperience so that
  // relational links to record.wesDetails (which may use workExperienceIndex) remain intact
  const indexed = workExpList.map((item, originalIndex) => ({ item, originalIndex }));

  // Sort latest first matching PDS
  indexed.sort((a, b) => compareWorkExperienceDescending(a.item, b.item));

  return indexed.map(({ item, originalIndex }) => {
    const detail = findWesDetail(item, originalIndex, record.wesDetails);

    const nameOfOffice = detail?.nameOfOffice || '';
    const immediateSupervisor = detail?.immediateSupervisor || '';
    const location = detail?.location || '';
    // Accomplishments list (clean up empty items if needed for display)
    const accomplishments = detail?.accomplishments || [];
    // Summary of duties: fallback to item.dutiesDescription if detail is not yet set
    const summaryOfDuties = detail?.summaryOfDuties ?? (item.dutiesDescription || '');

    return {
      workExperienceId: item.id || `we-${originalIndex}`,
      workExperienceIndex: originalIndex,
      duration: formatDuration(item),
      positionTitle: (item.positionTitle || '').trim(),
      nameOfOffice,
      immediateSupervisor,
      nameOfAgency: (item.departmentAgencyOfficeCompany || '').trim(),
      location,
      combinedAgencyLocation: formatAgencyLocation(item.departmentAgencyOfficeCompany, location),
      accomplishments,
      summaryOfDuties,
    };
  });
}

/**
 * Clean up orphaned wesDetails entries whose workExperienceId or index
 * no longer exists in record.workExperience.
 */
export function cleanOrphanedWesDetails(
  workExperience: WorkExperienceItem[],
  wesDetails: WesDetailItem[]
): WesDetailItem[] {
  if (!wesDetails || wesDetails.length === 0) return [];
  if (!workExperience || workExperience.length === 0) return [];

  const validIds = new Set(workExperience.map((w) => w.id).filter(Boolean));
  const maxIndex = workExperience.length - 1;

  return wesDetails.filter((detail) => {
    // If detail has workExperienceId and validIds has items, check validIds
    if (detail.workExperienceId && validIds.size > 0) {
      if (validIds.has(detail.workExperienceId)) return true;
      // If it's a synthetic "we-X", fallback to index bounds check
      if (/^we-\d+$/.test(detail.workExperienceId) && detail.workExperienceIndex !== undefined) {
        return detail.workExperienceIndex <= maxIndex;
      }
      return false;
    }
    // Fallback: check valid index bounds
    if (detail.workExperienceIndex !== undefined && detail.workExperienceIndex >= 0) {
      return detail.workExperienceIndex <= maxIndex;
    }
    return true;
  });
}

/**
 * Format applicant's full name from PersonalInfo
 */
export function formatApplicantFullName(record: PdsRecord): string {
  const p = record.personalInfo;
  if (!p) return '';
  const parts = [
    p.firstName,
    p.middleName,
    p.surname,
    p.nameExtension,
  ].filter((str) => str && str.trim().length > 0);

  return parts.join(' ').trim();
}
