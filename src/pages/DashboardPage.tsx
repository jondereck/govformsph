import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/db";
import { PdsRecord } from "../types/pds";
import { SalnRecord } from "../types/saln";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { formatRelativeDateTime } from "../utils/dateUtils";
import { exportSingleRecord, triggerDownload } from "../utils/exportImport";
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Download,
  Search,
  ShieldCheck,
  Clock,
} from "lucide-react";

interface DashboardPageProps {
  onSelectRecord: (record: PdsRecord) => void;
  onSelectRecordForWes?: (record: PdsRecord) => void;
  onNewForm: () => void;
  onNavigateToExport: () => void;
  onNavigateToInstall?: () => void;
  onNavigateToWes?: () => void;
  onNewSaln?: () => void;
  onSelectSaln?: (record: SalnRecord) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onSelectRecord,
  onSelectRecordForWes,
  onNewForm,
  onNavigateToExport,
  onNavigateToWes,
  onNewSaln,
  onSelectSaln,
}) => {
  const records = useLiveQuery(
    () => db.pdsRecords.orderBy("meta.updatedAt").reverse().toArray(),
    [],
  );
  const salnRecords = useLiveQuery(
    () => db.salnRecords.orderBy("meta.updatedAt").reverse().toArray(),
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirmRecord, setDeleteConfirmRecord] =
    useState<PdsRecord | null>(null);

  const filteredRecords = records?.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const title = (r.meta?.title || "").toLowerCase();
    const surname = (r.personalInfo?.surname || "").toLowerCase();
    const firstName = (r.personalInfo?.firstName || "").toLowerCase();
    return (
      title.includes(term) || surname.includes(term) || firstName.includes(term)
    );
  });

  const handleDelete = async (record: PdsRecord) => {
    if (record.id) {
      await db.pdsRecords.delete(record.id);
    }
    setDeleteConfirmRecord(null);
  };

  const handleDuplicate = async (record: PdsRecord) => {
    const duplicated: PdsRecord = {
      ...record,
      meta: {
        ...record.meta,
        title: `${record.meta.title || "PDS Form"} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    delete duplicated.id;
    const newId = await db.pdsRecords.add(duplicated);
    duplicated.id = newId;
    onSelectRecord(duplicated);
  };

  const handleExportSingle = (record: PdsRecord, e: React.MouseEvent) => {
    e.stopPropagation();
    const { fileName, blob } = exportSingleRecord(record);
    triggerDownload(fileName, blob);
  };

  const getSalnCompletionPercent = (record: SalnRecord) => {
    let score = 0;
    if (record.declarant.surname.trim() && record.declarant.firstName.trim()) score += 25;
    if (record.declarant.position.trim() && record.declarant.agency.trim()) score += 25;
    const hasDisclosure = [
      ...record.realProperties.map((row) => [row.description, row.kind, row.location, row.assessedValue, row.fairMarketValue, row.acquisitionYear, row.acquisitionMode, row.acquisitionCost]),
      ...record.personalProperties.map((row) => [row.description, row.year, row.cost]),
      ...record.liabilities.map((row) => [row.nature, row.creditor, row.balance]),
      ...record.businesses.map((row) => [row.entity, row.address, row.nature, row.dateAcquired]),
      ...record.relatives.map((row) => [row.name, row.relationship, row.position, row.agency]),
    ].some((values) => values.some((value) => value.trim()));
    if (hasDisclosure) score += 25;
    if (record.declarantSignature) score += 25;
    return score;
  };

  // Helper to compute section completion
  const getCompletionPercent = (record: PdsRecord) => {
    let score = 0;
    if (record.personalInfo?.surname && record.personalInfo?.firstName)
      score += 25;
    if (
      record.education?.elementary?.nameOfSchool ||
      record.education?.college?.[0]?.nameOfSchool
    )
      score += 25;
    if (
      record.workExperience?.length > 0 &&
      record.workExperience[0]?.positionTitle
    )
      score += 25;
    if (record.declaration?.acknowledgedTerms) score += 25;
    return score;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-[#D6E4FF] bg-[#F3F7FF] shadow-lg">
        <img
          src="/brand/hero-banner.jpg"
          alt=""
          className="h-52 w-full object-cover object-[68%_center] sm:h-64 lg:hidden"
        />
        <img
          src="/brand/hero-banner.jpg"
          alt=""
          className="hidden h-auto w-full lg:block"
        />
        <div className="flex flex-col justify-center px-5 py-6 sm:px-8 sm:py-8 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[34%] lg:px-8 lg:py-6">
            <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#C5D4F5] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#0040E7]">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Offline & Private
            </div>
            <h1 className="mb-3 text-2xl font-medium tracking-[-0.02em] text-[#1A1A2E] lg:text-[1.65rem] lg:leading-tight">
              Philippine Government Form Builder & Filler
            </h1>
            <p className="mb-6 max-w-xl text-sm leading-relaxed text-[#64748B] lg:text-[13px] lg:leading-snug">
              Fill, manage, and print your{" "}
              <strong className="font-medium text-[#1A1A2E]">Personal Data Sheet</strong>,{" "}
              <strong className="font-medium text-[#1A1A2E]">Work Experience Sheet</strong>, and{" "}
              <strong className="font-medium text-[#1A1A2E]">SALN</strong>. All data is saved strictly in your device.
            </p>
            <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap min-[420px]:items-center">
              <Button
                variant="primary"
                size="lg"
                icon={<Plus className="w-5 h-5" />}
                onClick={onNewForm}
                className="w-full !border-transparent !bg-[#0040E7] hover:!bg-[#0035C4] focus:!ring-[#0040E7] min-[420px]:w-auto"
              >
                Create New PDS Form
              </Button>
              <Button
                variant="outline"
                size="lg"
                icon={<Download className="w-4 h-4" />}
                onClick={onNavigateToExport}
                className="w-full !border-[#C5D4F5] !bg-white !text-[#1A1A2E] hover:!bg-[#F0F4FF] dark:!border-[#C5D4F5] dark:!bg-white dark:!text-[#1A1A2E] dark:hover:!bg-[#F0F4FF] min-[420px]:w-auto"
              >
                Backup / Restore
              </Button>
            </div>
        </div>
      </div>

      {/* Stats and Quick Info Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Saved Forms
            </p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {(records?.length ?? 0) + (salnRecords?.length ?? 0)}{" "}
              {(records?.length ?? 0) + (salnRecords?.length ?? 0) === 1 ? "Record" : "Records"}
            </p>
          </div>
        </Card>
      </div>

      {/* Saved Forms Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Saved Forms & Drafts
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select any form to continue editing, print, or export.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or name..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
        </div>

        {/* Form List / Cards */}
        {filteredRecords === undefined ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            Loading saved forms...
          </div>
        ) : filteredRecords.length === 0 && (salnRecords?.length ?? 0) === 0 ? (
          <div className="text-center py-12 px-4 bg-surface-light dark:bg-surface-dark border border-dashed border-border-light dark:border-border-dark rounded-2xl">
            <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {searchTerm ? "No matching forms found" : "No forms saved yet"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-5">
              {searchTerm
                ? "Try searching with different keywords."
                : "Create your first Personal Data Sheet (CS Form 212 Revised 2026) draft to get started."}
            </p>
            <Button
              variant="primary"
              size="md"
              icon={<Plus className="w-4 h-4" />}
              onClick={onNewForm}
            >
              Start New Form
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(salnRecords ?? [])
              .filter((rec) => {
                if (!searchTerm) return true;
                const term = searchTerm.toLowerCase();
                return (
                  (rec.meta?.title || "").toLowerCase().includes(term) ||
                  rec.declarant.surname.toLowerCase().includes(term) ||
                  rec.declarant.firstName.toLowerCase().includes(term)
                );
              })
              .map((rec) => {
                const completion = getSalnCompletionPercent(rec);
                return (
                <Card
                  key={`saln-${rec.id}`}
                  hoverable
                  onClick={() => onSelectSaln?.(rec)}
                  className="flex flex-col justify-between cursor-pointer"
                >
                  <div>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                        {rec.meta?.title || "SALN 2025"}
                      </h3>
                      <Badge variant="info" size="sm">SALN 2025</Badge>
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
                      {[rec.declarant.surname, rec.declarant.firstName].filter(Boolean).join(", ") || "No name yet"}
                    </p>
                    <div className="mb-4">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>Completion</span>
                        <span className="font-semibold">{completion}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${completion}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{formatRelativeDateTime(rec.meta.updatedAt)}</span>
                    <button
                      type="button"
                      className="hover:text-rose-600"
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (rec.id) await db.salnRecords.delete(rec.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </Card>
                );
              })}
            {filteredRecords.map((rec) => {
              const fullName = [
                rec.personalInfo?.surname,
                rec.personalInfo?.firstName,
                rec.personalInfo?.middleName,
              ]
                .filter(Boolean)
                .join(", ");
              const completion = getCompletionPercent(rec);

              return (
                <Card
                  key={rec.id}
                  hoverable
                  onClick={() => onSelectRecord(rec)}
                  className="flex flex-col justify-between cursor-pointer group relative"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors line-clamp-1">
                        {rec.meta?.title || "Personal Data Sheet"}
                      </h3>
                      <Badge variant="info" size="sm">
                        {rec.meta?.formVersion || "2026"}
                      </Badge>
                    </div>

                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-3">
                      {fullName ? (
                        fullName.toUpperCase()
                      ) : (
                        <span className="italic text-slate-400">
                          No name specified yet
                        </span>
                      )}
                    </p>

                    {/* Progress indicator */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                        <span>Completion</span>
                        <span className="font-semibold">{completion}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 rounded-full"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Meta & Actions */}
                  <div className="pt-3 border-t border-border-light dark:border-border-dark flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatRelativeDateTime(rec.meta?.updatedAt)}
                    </span>

                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          onSelectRecordForWes
                            ? onSelectRecordForWes(rec)
                            : onSelectRecord(rec)
                        }
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 transition-colors cursor-pointer flex items-center gap-1 mr-0.5"
                        title="Open Work Experience Sheet (WES) for this form"
                      >
                        <FileText className="w-3 h-3" />
                        WES
                      </button>

                      <button
                        onClick={(e) => handleExportSingle(rec, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Export JSON"
                        aria-label="Export JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDuplicate(rec)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Duplicate"
                        aria-label="Duplicate"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmRecord(rec)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors cursor-pointer"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Template Catalog & Future Forms */}
      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Form Catalog & Templates
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Govforms is built to support all standard Philippine civil service
            and government documents.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active: PDS */}
          <Card className="border-teal-500/40 dark:border-teal-400/40 bg-teal-50/20 dark:bg-teal-950/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="success" size="sm">
                  Active (Revised 2026)
                </Badge>
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Personal Data Sheet (PDS)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                CSC Form No. 212 with complete Sections I–VIII, Questions 34–40,
                and 4-page print preview.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onNewForm}>
              Fill PDS Form
            </Button>
          </Card>

          {/* Active: Work Experience Sheet */}
          <Card className="border-teal-500/40 dark:border-teal-400/40 bg-teal-50/20 dark:bg-teal-950/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Badge variant="success" size="sm">
                  Active (Attachment)
                </Badge>
                <FileText className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                Work Experience Sheet
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Attachment to CS Form No. 212 with dynamic relational sync from PDS Work Experience and client-side PDF export.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => (onNavigateToWes ? onNavigateToWes() : onNewForm())}
            >
              Fill Work Experience Sheet
            </Button>
          </Card>

          <Card className="flex flex-col justify-between border-teal-500/40 bg-teal-50/20 dark:border-teal-400/40 dark:bg-teal-950/20">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="success" size="sm">
                  Active
                </Badge>
                <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="mb-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                SALN
              </h3>
              <p className="mb-4 text-xs text-slate-600 dark:text-slate-400">
                2025 Statement of Assets, Liabilities, and Net Worth. Totals update as you type.
              </p>
            </div>
            <Button variant="primary" size="sm" onClick={onNewSaln}>
              Fill SALN
            </Button>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deleteConfirmRecord)}
        onClose={() => setDeleteConfirmRecord(null)}
        title="Delete Form"
        description="Are you sure you want to delete this form draft?"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This action will permanently delete{" "}
            <strong>{deleteConfirmRecord?.meta?.title}</strong> from this
            browser.
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmRecord(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() =>
                deleteConfirmRecord && handleDelete(deleteConfirmRecord)
              }
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
