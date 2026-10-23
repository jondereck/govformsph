import React, { useState, useEffect, useRef } from 'react';
import { PdsRecord, WesDetailItem } from '../../types/pds';
import { db } from '../../db/db';
import { Button } from '../../components/common/Button';
import { WesPrintPreview } from './WesPrintPreview';
import {
  deriveWesRows,
  formatApplicantFullName,
  cleanOrphanedWesDetails,
  isMatchingDetail,
  ensureStableWorkExperienceIds,
} from '../../utils/wesUtils';
import {
  ArrowLeft,
  Printer,
  Save,
  CheckCircle2,
  FileText,
  Briefcase,
  Building2,
  MapPin,
  UserCheck,
  Plus,
  Trash2,
  Lock,
  ExternalLink,
  Clock,
} from 'lucide-react';

interface WesFormEditorProps {
  initialRecord: PdsRecord;
  onBackToDashboard: () => void;
  onNavigateToPds: () => void;
  onSwitchRecord?: () => void;
}

export const WesFormEditor: React.FC<WesFormEditorProps> = ({
  initialRecord,
  onBackToDashboard,
  onNavigateToPds,
  onSwitchRecord,
}) => {
  const [record, setRecord] = useState<PdsRecord>(initialRecord);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('Just now');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync and ensure stable IDs if initialRecord changes
  useEffect(() => {
    const { record: ensuredRecord, hasChanges } = ensureStableWorkExperienceIds(initialRecord);
    setRecord(ensuredRecord);
    if (hasChanges && ensuredRecord.id) {
      db.pdsRecords.put(ensuredRecord).catch((err) => {
        console.error('Failed to backfill stable workExperience IDs', err);
      });
    }
  }, [initialRecord]);

  // Debounced Autosave to IndexedDB
  const handleRecordChange = (updated: PdsRecord) => {
    setRecord(updated);
    setSaveStatus('saving');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        // Drop any orphaned wesDetails entries whose workExperience no longer exists
        const cleanedWesDetails = cleanOrphanedWesDetails(
          updated.workExperience || [],
          updated.wesDetails || []
        );

        const recordToSave: PdsRecord = {
          ...updated,
          wesDetails: cleanedWesDetails,
          meta: {
            ...updated.meta,
            updatedAt: now,
          },
        };

        if (recordToSave.id) {
          await db.pdsRecords.put(recordToSave);
        } else {
          const newId = await db.pdsRecords.add(recordToSave);
          recordToSave.id = newId;
        }

        setRecord(recordToSave);
        setSaveStatus('saved');
        const timeStr = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastSavedTime(timeStr);
      } catch (err) {
        console.error('Failed to autosave WES record to IndexedDB', err);
        setSaveStatus('idle');
      }
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  // Update a field in wesDetails for a specific workExperience entry
  const updateWesDetailField = <K extends keyof WesDetailItem>(
    workExperienceId: string,
    index: number,
    field: K,
    value: WesDetailItem[K]
  ) => {
    const currentDetails = [...(record.wesDetails || [])];
    const existingIdx = currentDetails.findIndex((d) =>
      isMatchingDetail(d, workExperienceId, index)
    );

    if (existingIdx >= 0) {
      currentDetails[existingIdx] = {
        ...currentDetails[existingIdx],
        workExperienceId,
        workExperienceIndex: index,
        [field]: value,
      };
    } else {
      // Create new detail entry
      const newDetail: WesDetailItem = {
        workExperienceId,
        workExperienceIndex: index,
        nameOfOffice: '',
        immediateSupervisor: '',
        location: '',
        accomplishments: [],
        summaryOfDuties: '',
        [field]: value,
      };
      currentDetails.push(newDetail);
    }

    handleRecordChange({
      ...record,
      wesDetails: currentDetails,
    });
  };

  // Add an accomplishment bullet
  const handleAddAccomplishment = (workExperienceId: string, index: number) => {
    const detail = record.wesDetails?.find((d) =>
      isMatchingDetail(d, workExperienceId, index)
    );
    const accomplishments = [...(detail?.accomplishments || []), ''];
    updateWesDetailField(workExperienceId, index, 'accomplishments', accomplishments);
  };

  // Update an accomplishment bullet
  const handleUpdateAccomplishment = (
    workExperienceId: string,
    index: number,
    accIdx: number,
    value: string
  ) => {
    const detail = record.wesDetails?.find((d) =>
      isMatchingDetail(d, workExperienceId, index)
    );
    const accomplishments = [...(detail?.accomplishments || [])];
    accomplishments[accIdx] = value;
    updateWesDetailField(workExperienceId, index, 'accomplishments', accomplishments);
  };

  // Remove an accomplishment bullet
  const handleRemoveAccomplishment = (
    workExperienceId: string,
    index: number,
    accIdx: number
  ) => {
    const detail = record.wesDetails?.find((d) =>
      isMatchingDetail(d, workExperienceId, index)
    );
    const accomplishments = [...(detail?.accomplishments || [])];
    accomplishments.splice(accIdx, 1);
    updateWesDetailField(workExperienceId, index, 'accomplishments', accomplishments);
  };

  const rows = deriveWesRows(record);
  const applicantName = formatApplicantFullName(record);

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header Controls */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-4 sm:p-5 shadow-sm transition-colors">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Back & Title */}
          <div className="flex items-start gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={onBackToDashboard}
              title="Return to Dashboard"
            >
              Dashboard
            </Button>

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                  Work Experience Sheet (WES)
                </h2>

                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  Attachment to CS Form No. 212
                </span>
              </div>

              {/* Autosave Status Indicator */}
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                {saveStatus === 'saving' ? (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                    <Save className="w-3.5 h-3.5 animate-pulse" /> Autosaving to IndexedDB...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Saved locally ({lastSavedTime})
                  </span>
                )}
                <span>•</span>
                <span>Attached to: <strong>{record.meta?.title || 'Personal Data Sheet'}</strong></span>

                {applicantName && (
                  <>
                    <span>•</span>
                    <span>{applicantName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onSwitchRecord && (
              <Button
                variant="outline"
                size="sm"
                icon={<FileText className="w-4 h-4" />}
                onClick={onSwitchRecord}
                title="Switch attached Personal Data Sheet"
              >
                Switch PDS
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={<Briefcase className="w-4 h-4" />}
              onClick={onNavigateToPds}
              title="Go to PDS Form Editor"
            >
              Edit PDS Form
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => setShowPrintModal(true)}
            >
              Preview &amp; Print WES
            </Button>
          </div>
        </div>

        {/* Informative Banner about Relational Sync */}
        <div className="mt-4 pt-3 border-t border-border-light dark:border-border-dark flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <p className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
            WES rows are dynamically synced with your PDS Work Experience. Duration, Position, and Agency are read-only to avoid duplicate data.
          </p>
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {rows.length} {rows.length === 1 ? 'Position' : 'Positions'}
          </span>
        </div>
      </div>

      {/* Main Editing Area */}
      {rows.length === 0 ? (
        <div className="p-12 text-center bg-surface-light dark:bg-surface-dark rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-4 shadow-sm">
          <Briefcase className="w-12 h-12 text-slate-400 mx-auto" />
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              No Work Experience Added Yet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              Work Experience Sheet entries are generated directly from your PDS Work Experience.
              Add your current and previous employment in Section V of your Personal Data Sheet to fill out this sheet.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="md"
            icon={<ExternalLink className="w-4 h-4" />}
            onClick={onNavigateToPds}
          >
            Add Work Experience in PDS
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {rows.map((row, idx) => {
            const hasAccomplishments = (row.accomplishments || []).length > 0;

            return (
              <div
                key={row.workExperienceId || idx}
                className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-5 sm:p-7 shadow-sm space-y-5 transition-colors"
              >
                {/* Entry Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-light dark:border-border-dark pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 text-xs font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 uppercase">
                        {row.positionTitle || '(No Position Title Entered in PDS)'}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {row.nameOfAgency || '(No Agency Entered in PDS)'}
                      </p>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {row.duration}
                  </div>
                </div>

                {/* Readonly PDS Fields Notice */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Duration */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>1. Duration</span>
                      <span className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400">
                        <Lock className="w-3 h-3" /> From PDS
                      </span>
                    </div>
                    <p className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">
                      {row.duration}
                    </p>
                  </div>

                  {/* Position */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>2. Position Title</span>
                      <span className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400">
                        <Lock className="w-3 h-3" /> From PDS
                      </span>
                    </div>
                    <p className="text-xs font-semibold uppercase text-slate-800 dark:text-slate-200 truncate">
                      {row.positionTitle || '—'}
                    </p>
                  </div>

                  {/* Agency */}
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>5. Name of Agency</span>
                      <span className="flex items-center gap-1 text-[10px] text-teal-600 dark:text-teal-400">
                        <Lock className="w-3 h-3" /> From PDS
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {row.nameOfAgency || '—'}
                    </p>
                  </div>
                </div>

                {/* Fillable Inputs Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                  {/* Field 3: Name of Office (unit) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      3. Name of Office / Unit
                    </label>
                    <input
                      type="text"
                      value={row.nameOfOffice}
                      onChange={(e) =>
                        updateWesDetailField(
                          row.workExperienceId,
                          row.workExperienceIndex,
                          'nameOfOffice',
                          e.target.value
                        )
                      }
                      placeholder="e.g. Finance and Management Division"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Specific unit, bureau, or division</p>
                  </div>

                  {/* Field 4: Immediate Supervisor */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      4. Immediate Supervisor
                    </label>
                    <input
                      type="text"
                      value={row.immediateSupervisor}
                      onChange={(e) =>
                        updateWesDetailField(
                          row.workExperienceId,
                          row.workExperienceIndex,
                          'immediateSupervisor',
                          e.target.value
                        )
                      }
                      placeholder="e.g. Maria Santos, Director IV"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Name and title of supervisor</p>
                  </div>

                  {/* Field 6: Location */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      6. Location
                    </label>
                    <input
                      type="text"
                      value={row.location}
                      onChange={(e) =>
                        updateWesDetailField(
                          row.workExperienceId,
                          row.workExperienceIndex,
                          'location',
                          e.target.value
                        )
                      }
                      placeholder="e.g. Quezon City, Metro Manila"
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">City, province, or region</p>
                  </div>
                </div>

                {/* Field 7: Live Combined Render Preview */}
                <div className="bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/50 dark:border-teal-800/40 rounded-xl p-3">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-teal-800 dark:text-teal-300 mb-1">
                    <span>7. Combined Render Preview: Name of Agency, Location</span>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400">Concatenated dynamically</span>
                  </div>
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-200">
                    {row.combinedAgencyLocation}
                  </p>
                </div>

                {/* Field 8: Accomplishments and Contributions */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        8. List of Accomplishments and Contributions (if any)
                      </label>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Optional repeatable bullet list of key contributions or innovations
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => handleAddAccomplishment(row.workExperienceId, row.workExperienceIndex)}
                    >
                      Add Accomplishment
                    </Button>
                  </div>

                  {!hasAccomplishments ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 text-center">
                      No accomplishments added yet. Click &quot;Add Accomplishment&quot; to add bullet points.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {row.accomplishments.map((acc, accIdx) => (
                        <div key={accIdx} className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs font-bold pl-1">•</span>
                          <input
                            type="text"
                            value={acc}
                            onChange={(e) =>
                              handleUpdateAccomplishment(
                                row.workExperienceId,
                                row.workExperienceIndex,
                                accIdx,
                                e.target.value
                              )
                            }
                            placeholder="e.g. Developed and deployed automated leave processing system that reduced turnaround time by 60%..."
                            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveAccomplishment(
                                row.workExperienceId,
                                row.workExperienceIndex,
                                accIdx
                              )
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors cursor-pointer"
                            title="Remove accomplishment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Field 9: Summary of Actual Duties */}
                <div className="space-y-1.5 pt-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    9. Summary of Actual Duties
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Detailed narrative description of actual duties, supervisory scope, and core responsibilities
                  </p>
                  <textarea
                    rows={4}
                    value={row.summaryOfDuties}
                    onChange={(e) =>
                      updateWesDetailField(
                        row.workExperienceId,
                        row.workExperienceIndex,
                        'summaryOfDuties',
                        e.target.value
                      )
                    }
                    placeholder="Describe main responsibilities, supervisory scope, programs administered, and day-to-day duties..."
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50 leading-relaxed"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom Footer Actions */}
      {rows.length > 0 && (
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <Button
            variant="outline"
            size="md"
            icon={<ArrowLeft className="w-4 h-4" />}
            onClick={onBackToDashboard}
          >
            Back to Dashboard
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              icon={<Briefcase className="w-4 h-4" />}
              onClick={onNavigateToPds}
            >
              Edit PDS Form
            </Button>

            <Button
              variant="primary"
              size="md"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => setShowPrintModal(true)}
            >
              Preview &amp; Print Official WES
            </Button>
          </div>
        </div>
      )}

      {/* Official WES Print Preview Modal */}
      {showPrintModal && (
        <WesPrintPreview record={record} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
};
