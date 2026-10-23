import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PdsRecord } from '../../types/pds';
import {
  deriveWesRows,
  formatApplicantFullName,
  getCurrentWesDate,
  ensureStableWorkExperienceIds,
} from '../../utils/wesUtils';
import { X, Printer } from 'lucide-react';
import { Button } from '../../components/common/Button';

interface WesPrintPreviewProps {
  record: PdsRecord;
  onClose: () => void;
}

export const WesPrintPreview: React.FC<WesPrintPreviewProps> = ({ record, onClose }) => {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // Create and manage portal container
  useEffect(() => {
    let el = document.getElementById('wes-print-portal') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'wes-print-portal';
      document.body.appendChild(el);
    }
    portalRef.current = el;
    setReady(true);

    return () => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
      portalRef.current = null;
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const { record: ensuredRecord } = ensureStableWorkExperienceIds(record);
  const rows = deriveWesRows(ensuredRecord);
  const applicantName = formatApplicantFullName(record);
  const dateAccomplished = getCurrentWesDate();

  if (!ready || !portalRef.current) {
    return null;
  }

  const printContent = (
    <>
      {/* Web-only Controls (hidden in print) */}
      <div className="wes-print-controls sticky top-0 z-20 max-w-4xl mx-auto bg-slate-900 text-white rounded-xl p-3 mb-4 shadow-xl flex items-center justify-between border border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-teal-500 animate-pulse" />
          <span className="text-sm font-semibold">
            Work Experience Sheet (WES) — Print &amp; PDF Preview
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrint}
            className="bg-teal-600 hover:bg-teal-500 text-white"
          >
            Print / Save to PDF
          </Button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet Container — single-column table matching official Annex H-2 */}
      <div
        id="wes-print-area"
        className="max-w-4xl mx-auto bg-white text-black shadow-2xl rounded-xl leading-normal p-8 sm:p-12"
        style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: '12px' }}
      >
        {/* "Attachment to CS Form No. 212" label above the table */}
        <div
          style={{
            fontFamily: "'Arial Narrow', Arial, sans-serif",
            fontWeight: 'bold',
            fontSize: '9px',
            marginBottom: '4px',
          }}
        >
          Attachment to CS Form No. 212
        </div>

        {rows.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-300 text-slate-500 my-6">
            No work experience entries recorded in the attached Personal Data Sheet.
          </div>
        ) : (
          <table
            className="w-full border-collapse"
            style={{ borderColor: '#000', border: '2px solid #000', fontSize: '12px' }}
          >
            <tbody>
              {/* Row 1: Header — Arial Narrow italic, fill #969696 */}
              <tr>
                <td
                  style={{
                    border: '2px solid #000',
                    padding: '10px 8px',
                    fontSize: '12px',
                    fontFamily: "'Arial Narrow', Arial, sans-serif",
                    fontStyle: 'italic',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    letterSpacing: '0.05em',
                    backgroundColor: '#969696',
                    color: '#000',
                  }}
                >
                  WORK EXPERIENCE SHEET
                </td>
              </tr>

              {/* Row 2: Instructions — italicized, fill #E9E9E9 */}
              <tr>
                <td
                  style={{
                    border: '2px solid #000',
                    padding: '8px 12px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    fontStyle: 'italic',
                    backgroundColor: '#E9E9E9',
                  }}
                >
                  <div style={{ marginBottom: '2px' }}>
                    <strong>Instructions:</strong>
                  </div>
                  <div style={{ paddingLeft: '12px' }}>
                    1. Include only the work experiences that are relevant to the position being applied for.<br />
                    2. Duration should be in the format dd/mm/yyyy to dd/mm/yyyy. For current employment, use &quot;Present&quot; as the end date.<br />
                    3. List your most recent work experience first.
                  </div>
                </td>
              </tr>

              {/* Row 3+: One row per work experience entry */}
              {rows.map((row, idx) => {
                const activeAccomplishments = (row.accomplishments || []).filter(
                  (acc) => acc && acc.trim().length > 0
                );

                return (
                  <tr key={row.workExperienceId || idx} className="wes-entry-group">
                    <td
                      style={{
                        border: '2px solid #000',
                        padding: '10px 14px',
                        verticalAlign: 'top',
                        fontSize: '12px',
                        lineHeight: '1.6',
                      }}
                    >
                      {/* Duration */}
                      <div style={{ marginBottom: '3px' }}>
                        <span>•&nbsp;&nbsp;</span>
                        <strong>Duration:</strong>{' '}
                        {row.duration || '—'}
                      </div>

                      {/* Position Title */}
                      <div style={{ marginBottom: '3px' }}>
                        <span>•&nbsp;&nbsp;</span>
                        <strong>Position Title:</strong>{' '}
                        {row.positionTitle || '—'}
                      </div>

                      {/* Name of Office/Unit */}
                      <div style={{ marginBottom: '3px' }}>
                        <span>•&nbsp;&nbsp;</span>
                        <strong>Name of Office/Unit:</strong>{' '}
                        {row.nameOfOffice || '—'}
                      </div>

                      {/* Immediate Supervisor */}
                      <div style={{ marginBottom: '3px' }}>
                        <span>•&nbsp;&nbsp;</span>
                        <strong>Immediate Supervisor:</strong>{' '}
                        {row.immediateSupervisor || '—'}
                      </div>

                      {/* Name of Agency/Organization and Location */}
                      <div style={{ marginBottom: '8px' }}>
                        <span>•&nbsp;&nbsp;</span>
                        <strong>Name of Agency/Organization and Location:</strong>{' '}
                        {row.combinedAgencyLocation || '—'}
                      </div>

                      {/* Accomplishments sub-section */}
                      <div style={{ marginBottom: '4px' }}>
                        <strong>List of Accomplishments and Contributions (if any):</strong>
                      </div>
                      <div style={{ paddingLeft: '20px', marginBottom: '8px' }}>
                        {activeAccomplishments.length > 0 ? (
                          activeAccomplishments.map((acc, accIdx) => (
                            <div key={accIdx} style={{ marginBottom: '2px' }}>
                              ◦&nbsp;&nbsp;{acc}
                            </div>
                          ))
                        ) : (
                          <div>—</div>
                        )}
                      </div>

                      {/* Summary of Actual Duties sub-section */}
                      <div style={{ marginBottom: '4px' }}>
                        <strong>Summary of Actual Duties:</strong>
                      </div>
                      <div
                        style={{
                          paddingLeft: '20px',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.5',
                        }}
                      >
                        {row.summaryOfDuties ? row.summaryOfDuties.trim() : '—'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Signature Line matching reference doc */}
        <div style={{ marginTop: '28px', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '320px', textAlign: 'center' }}>
            <div style={{ height: '64px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '4px' }}>

            </div>
            <div
              style={{
                borderTop: '1px solid #000',
                paddingTop: '4px',
                fontWeight: 'bold',
                fontSize: '11px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {applicantName || '_____________________________________'}
            </div>
            <p style={{ fontSize: '9px', color: '#555', marginTop: '2px' }}>
              (Signature over Printed Name of Employee/Applicant)
            </p>
            <div style={{ paddingTop: '12px', textAlign: 'left', fontSize: '11px', fontWeight: 500 }}>
              Date:{' '}
              <span
                style={{
                  fontFamily: 'Arial, sans-serif',
                  textDecoration: 'underline',
                  marginLeft: '4px',
                }}
              >
                {dateAccomplished}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-2 sm:p-6">
      {printContent}
    </div>,
    portalRef.current
  );
};
