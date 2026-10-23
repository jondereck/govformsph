import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { PdsRecord } from '../../types/pds';
import { Modal } from './Modal';
import { Button } from './Button';
import { formatRelativeDateTime } from '../../utils/dateUtils';
import {
  FileText,
  Briefcase,
  Clock,
  Search,
  Plus,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';

interface SelectPdsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecord: (record: PdsRecord) => void;
  onCreateNewRecord: () => void;
  currentRecordId?: number;
}

export const SelectPdsModal: React.FC<SelectPdsModalProps> = ({
  isOpen,
  onClose,
  onSelectRecord,
  onCreateNewRecord,
  currentRecordId,
}) => {
  const records = useLiveQuery(
    () => db.pdsRecords.orderBy('meta.updatedAt').reverse().toArray(),
    []
  );
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = records?.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const title = (r.meta?.title || '').toLowerCase();
    const surname = (r.personalInfo?.surname || '').toLowerCase();
    const firstName = (r.personalInfo?.firstName || '').toLowerCase();
    return title.includes(term) || surname.includes(term) || firstName.includes(term);
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Personal Data Sheet (PDS)"
      description="Choose which PDS form to attach and sync this Work Experience Sheet with."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Search Bar */}
        {records && records.length > 2 && (
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or applicant name..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
        )}

        {/* List of Records */}
        {!records ? (
          <div className="text-center py-8 text-xs text-slate-500">
            Loading saved forms...
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 space-y-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6">
            <FileText className="w-10 h-10 text-slate-400 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No Personal Data Sheets Found
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                The Work Experience Sheet derives its records directly from a PDS. Create your first PDS to get started.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                onClose();
                onCreateNewRecord();
              }}
            >
              Create New PDS Form
            </Button>
          </div>
        ) : filtered && filtered.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500">
            No matching forms found for &quot;{searchTerm}&quot;.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
            {filtered?.map((rec) => {
              const isSelected = currentRecordId !== undefined && rec.id === currentRecordId;
              const expCount = rec.workExperience?.length || 0;
              const fullName = [
                rec.personalInfo?.surname,
                rec.personalInfo?.firstName,
                rec.personalInfo?.middleName,
              ]
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={rec.id}
                  onClick={() => {
                    onSelectRecord(rec);
                    onClose();
                  }}
                  className={`w-full p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 text-left group ${
                    isSelected
                      ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-950/40 ring-1 ring-teal-500/50'
                      : 'border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-600 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`p-2.5 rounded-lg flex items-center justify-center ${
                        isSelected
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-teal-100 dark:group-hover:bg-teal-900/60 group-hover:text-teal-700 dark:group-hover:text-teal-300'
                      }`}
                    >
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {rec.meta?.title || 'Personal Data Sheet'}
                        </h4>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200">
                            Currently Active
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {fullName || 'Draft (No applicant name)'}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400 font-medium">
                          <Briefcase className="w-3 h-3" />
                          {expCount} {expCount === 1 ? 'position' : 'positions'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatRelativeDateTime(rec.meta?.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal Bottom Actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            icon={<Plus className="w-3.5 h-3.5" />}
            onClick={() => {
              onClose();
              onCreateNewRecord();
            }}
          >
            Create New PDS Form
          </Button>

          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
