import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { SalnOwner, SalnRecord } from '../../types/saln';
import { openSalnPdfInNewTab } from '../../pdfExport/exportSaln';
import { computeSalnTotals, formatMoney } from './netWorth';

const LABEL = 'bg-gray-100 p-1 font-bold border border-black text-[8px] uppercase';
const CELL = 'p-1 border border-black text-[9px] align-top';

function personName(person: { surname: string; firstName: string; middleName: string }): string {
  return [person.surname, person.firstName, person.middleName].filter(Boolean).join(', ') || '—';
}

function ownerLabel(owner: SalnOwner): string {
  if (owner === 'spouse') return 'Spouse';
  if (owner === 'child') return 'Child under 18';
  return 'Declarant';
}

function complianceLabel(record: SalnRecord): string {
  if (record.compliance === 'assumption') return `Assumption of office as of ${record.asOfDate || '—'}`;
  if (record.compliance === 'exit') return `Exit as of ${record.asOfDate || '—'}`;
  return `Annual filing as of December 31 ${record.asOfDate || ''}`.trim();
}

export const SalnPrintPreview: React.FC<{ record: SalnRecord; onClose: () => void }> = ({ record, onClose }) => {
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [isOpeningPdf, setIsOpeningPdf] = useState(false);
  const totals = computeSalnTotals(record);

  const handlePrint = async () => {
    try {
      setIsOpeningPdf(true);
      await openSalnPdfInNewTab(record);
    } catch (error) {
      console.error('[Govforms] SALN PDF failed:', error);
      alert('Could not open the SALN PDF. Please try again.');
    } finally {
      setIsOpeningPdf(false);
    }
  };

  useEffect(() => {
    let el = document.getElementById('saln-print-portal') as HTMLDivElement | null;
    if (!el) {
      el = document.createElement('div');
      el.id = 'saln-print-portal';
      document.body.appendChild(el);
    }
    portalRef.current = el;
    setReady(true);
    return () => {
      if (el?.parentNode) el.parentNode.removeChild(el);
      portalRef.current = null;
    };
  }, []);

  if (!ready || !portalRef.current) return null;

  const declarantRows = {
    real: record.realProperties.filter((row) => row.owner === 'declarant'),
    personal: record.personalProperties.filter((row) => row.owner === 'declarant'),
    liabilities: record.liabilities.filter((row) => row.owner === 'declarant'),
    businesses: record.businesses.filter((row) => row.owner === 'declarant'),
  };
  const extraRows = {
    real: record.realProperties.filter((row) => row.owner !== 'declarant'),
    personal: record.personalProperties.filter((row) => row.owner !== 'declarant'),
    liabilities: record.liabilities.filter((row) => row.owner !== 'declarant'),
    businesses: record.businesses.filter((row) => row.owner !== 'declarant'),
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-2 backdrop-blur-sm sm:p-6">
      <div className="saln-print-controls sticky top-0 z-20 mx-auto mb-4 flex max-w-5xl items-center justify-between rounded-xl border border-slate-700 bg-slate-900 p-3 text-white shadow-xl">
        <span className="text-sm font-semibold">2025 SALN — Print &amp; PDF Preview</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={<ExternalLink className="h-4 w-4" />}
            onClick={handlePrint}
            disabled={isOpeningPdf}
            className="border-teal-600 text-teal-300 hover:bg-teal-950/50"
          >
            {isOpeningPdf ? 'Opening PDF...' : 'Print'}
          </Button>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close preview">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div id="saln-print-area" className="mx-auto max-w-5xl bg-white font-sans text-[11px] leading-tight text-black shadow-2xl">
        <div className="pds-page p-6 sm:p-8">
          <div className="mb-2 text-center">
            <p className="text-[9px]">2025 SALN Form · CSC Resolution No. 2500632</p>
            <h1 className="text-base font-black uppercase tracking-wide">Sworn Statement of Assets, Liabilities, and Net Worth</h1>
            <p className="text-[9px]">As required by R.A. No. 6713</p>
            <p className="mt-1 text-[10px] font-bold">{complianceLabel(record)}</p>
          </div>
          <table className="mb-3 w-full border-collapse">
            <tbody>
              <tr>
                <td className={LABEL}>Declarant</td>
                <td className={CELL}>{personName(record.declarant)}</td>
                <td className={LABEL}>Position</td>
                <td className={CELL}>{record.declarant.position || '—'}</td>
              </tr>
              <tr>
                <td className={LABEL}>Agency / office</td>
                <td className={CELL}>{record.declarant.agency || '—'}</td>
                <td className={LABEL}>Office address</td>
                <td className={CELL}>{record.declarant.officeAddress || '—'}</td>
              </tr>
              <tr>
                <td className={LABEL}>Spouse</td>
                <td className={CELL}>{personName(record.spouse)}</td>
                <td className={LABEL}>Filing</td>
                <td className={CELL}>{record.filing === 'joint' ? 'Joint' : record.filing === 'separate' ? 'Separate' : 'Not applicable'}</td>
              </tr>
              {record.spouse.inGovernment ? (
                <tr>
                  <td className={LABEL}>Spouse position</td>
                  <td className={CELL}>{record.spouse.position || '—'}</td>
                  <td className={LABEL}>Spouse agency</td>
                  <td className={CELL}>{record.spouse.agency || '—'}</td>
                </tr>
              ) : null}
              <tr>
                <td className={LABEL}>Multiple marriages</td>
                <td className={CELL} colSpan={3}>
                  {record.multipleMarriagesNotApplicable ? 'Not applicable' : record.spouseNames || '—'}
                </td>
              </tr>
            </tbody>
          </table>
          <AssetTables title="1. Assets — declarant" real={declarantRows.real} personal={declarantRows.personal} liabilities={declarantRows.liabilities} businesses={declarantRows.businesses} showOwner={false} />
          <Relatives record={record} />
          <div className="mt-3 border border-black p-2 text-[10px]">
            <p>Real property subtotal (acquisition cost): {formatMoney(totals.realSubtotal)}</p>
            <p>Personal property subtotal: {formatMoney(totals.personalSubtotal)}</p>
            <p>Total assets: {formatMoney(totals.totalAssets)}</p>
            <p>Total liabilities: {formatMoney(totals.totalLiabilities)}</p>
            <p className="font-bold">Net worth: {formatMoney(totals.netWorth)}</p>
          </div>
          <SignatureBox label="Signature of declarant" src={record.declarantSignature} />
        </div>

        <div className="pds-page p-6 sm:p-8">
          <p className="text-[9px]">2025 SALN Form AS-2 · Spouse and unmarried children below 18</p>
          <h2 className="mb-2 text-sm font-bold uppercase">Additional sheet</h2>
          <p className="mb-2 text-[9px]">These rows are declared. They are left out of the declarant’s net worth unless the filing is joint and the row is the spouse’s exclusive property.</p>
          <AssetTables title="Exclusive property of spouse and children" real={extraRows.real} personal={extraRows.personal} liabilities={extraRows.liabilities} businesses={extraRows.businesses} showOwner />
          {record.filing === 'joint' ? <SignatureBox label="Signature of spouse declarant" src={record.spouseSignature} /> : null}
        </div>
      </div>
    </div>,
    portalRef.current,
  );
};

function AssetTables({
  title,
  real,
  personal,
  liabilities,
  businesses,
  showOwner,
}: {
  title: string;
  real: SalnRecord['realProperties'];
  personal: SalnRecord['personalProperties'];
  liabilities: SalnRecord['liabilities'];
  businesses: SalnRecord['businesses'];
  showOwner: boolean;
}) {
  return (
    <div className="mt-3">
      <div className="bg-gray-200 px-2 py-1 text-[10px] font-bold uppercase">{title}</div>
      <p className="mt-2 text-[9px] font-bold">A. Real properties</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {showOwner ? <th className={LABEL}>Whose</th> : null}
            <th className={LABEL}>Description</th>
            <th className={LABEL}>Kind</th>
            <th className={LABEL}>Exact location</th>
            <th className={LABEL}>Assessed value</th>
            <th className={LABEL}>Fair market value</th>
            <th className={LABEL}>Year</th>
            <th className={LABEL}>Mode</th>
            <th className={LABEL}>Acquisition cost</th>
          </tr>
        </thead>
        <tbody>
          {(real.length ? real : [null]).map((row, index) => (
            <tr key={row?.id ?? index}>
              {showOwner ? <td className={CELL}>{row ? ownerLabel(row.owner) : '—'}</td> : null}
              <td className={CELL}>{row?.description || '—'}</td>
              <td className={CELL}>{row?.kind || '—'}</td>
              <td className={CELL}>{row?.location || '—'}</td>
              <td className={CELL}>{row?.assessedValue || '—'}</td>
              <td className={CELL}>{row?.fairMarketValue || '—'}</td>
              <td className={CELL}>{row?.acquisitionYear || '—'}</td>
              <td className={CELL}>{row?.acquisitionMode || '—'}</td>
              <td className={CELL}>{row?.acquisitionCost || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[9px] font-bold">B. Personal properties</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {showOwner ? <th className={LABEL}>Whose</th> : null}
            <th className={LABEL}>Description</th>
            <th className={LABEL}>Year</th>
            <th className={LABEL}>Acquisition cost / amount</th>
          </tr>
        </thead>
        <tbody>
          {(personal.length ? personal : [null]).map((row, index) => (
            <tr key={row?.id ?? index}>
              {showOwner ? <td className={CELL}>{row ? ownerLabel(row.owner) : '—'}</td> : null}
              <td className={CELL}>{row?.description || '—'}</td>
              <td className={CELL}>{row?.year || '—'}</td>
              <td className={CELL}>{row?.cost || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[9px] font-bold">2. Liabilities</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {showOwner ? <th className={LABEL}>Whose</th> : null}
            <th className={LABEL}>Nature</th>
            <th className={LABEL}>Name of creditors</th>
            <th className={LABEL}>Outstanding balance</th>
          </tr>
        </thead>
        <tbody>
          {(liabilities.length ? liabilities : [null]).map((row, index) => (
            <tr key={row?.id ?? index}>
              {showOwner ? <td className={CELL}>{row ? ownerLabel(row.owner) : '—'}</td> : null}
              <td className={CELL}>{row?.nature || '—'}</td>
              <td className={CELL}>{row?.creditor || '—'}</td>
              <td className={CELL}>{row?.balance || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[9px] font-bold">Business interests and financial connections</p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {showOwner ? <th className={LABEL}>Whose</th> : null}
            <th className={LABEL}>Entity</th>
            <th className={LABEL}>Address</th>
            <th className={LABEL}>Nature</th>
            <th className={LABEL}>Date acquired</th>
          </tr>
        </thead>
        <tbody>
          {(businesses.length ? businesses : [null]).map((row, index) => (
            <tr key={row?.id ?? index}>
              {showOwner ? <td className={CELL}>{row ? ownerLabel(row.owner) : '—'}</td> : null}
              <td className={CELL}>{row?.entity || '—'}</td>
              <td className={CELL}>{row?.address || '—'}</td>
              <td className={CELL}>{row?.nature || '—'}</td>
              <td className={CELL}>{row?.dateAcquired || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Relatives({ record }: { record: SalnRecord }) {
  return (
    <div className="mt-3">
      <div className="bg-gray-200 px-2 py-1 text-[10px] font-bold uppercase">Relatives in the government</div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={LABEL}>Name</th>
            <th className={LABEL}>Relationship</th>
            <th className={LABEL}>Position</th>
            <th className={LABEL}>Agency</th>
          </tr>
        </thead>
        <tbody>
          {(record.relatives.length ? record.relatives : [null]).map((row, index) => (
            <tr key={row?.id ?? index}>
              <td className={CELL}>{row?.name || '—'}</td>
              <td className={CELL}>{row?.relationship || '—'}</td>
              <td className={CELL}>{row?.position || '—'}</td>
              <td className={CELL}>{row?.agency || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignatureBox({ label, src }: { label: string; src: string | null }) {
  return (
    <div className="mt-4 w-56 border border-black p-2">
      {src ? <img src={src} alt="" className="h-16 w-full object-contain" /> : <div className="h-16" />}
      <p className="border-t border-black pt-1 text-[8px] font-bold uppercase">{label}</p>
    </div>
  );
}
