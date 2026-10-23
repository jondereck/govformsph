import React, { useRef, useState } from 'react';
import { SalnOwner, SalnRecord } from '../../types/saln';
import { db } from '../../db/db';
import { Button } from '../../components/common/Button';
import { SignaturePad } from '../../components/common/SignaturePad';
import { SalnPrintPreview } from './SalnPrintPreview';
import {
  emptyBusiness,
  emptyLiability,
  emptyPersonal,
  emptyReal,
  emptyRelative,
  salnTitle,
} from './blank';
import { computeSalnTotals, formatMoney } from './netWorth';
import { ArrowLeft, CheckCircle2, Plus, Printer, Trash2 } from 'lucide-react';

interface SalnFormEditorProps {
  initialRecord: SalnRecord;
  onBackToDashboard: () => void;
}

const SECTIONS = [
  { id: 1, label: 'Declarant' },
  { id: 2, label: 'Real property' },
  { id: 3, label: 'Personal property' },
  { id: 4, label: 'Liabilities' },
  { id: 5, label: 'Business interests' },
  { id: 6, label: 'Relatives' },
  { id: 7, label: 'Declaration' },
];

const inputClass =
  'w-full rounded-[14px] border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

export const SalnFormEditor: React.FC<SalnFormEditorProps> = ({ initialRecord, onBackToDashboard }) => {
  const [record, setRecord] = useState<SalnRecord>(initialRecord);
  const [section, setSection] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [showPrint, setShowPrint] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totals = computeSalnTotals(record);

  const change = (next: SalnRecord) => {
    const titled = {
      ...next,
      meta: { ...next.meta, title: salnTitle(next) },
    };
    setRecord(titled);
    setSaveStatus('saving');
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      const now = new Date().toISOString();
      const toSave = { ...titled, meta: { ...titled.meta, updatedAt: now } };
      if (toSave.id) await db.salnRecords.put(toSave);
      else toSave.id = await db.salnRecords.add(toSave);
      setRecord(toSave);
      setSaveStatus('saved');
    }, 500);
  };

  return (
    <div className="pb-16">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={onBackToDashboard}>
            Dashboard
          </Button>
          <div>
            <h2 className="text-lg font-medium tracking-[-0.02em] text-slate-900 dark:text-slate-100">
              SALN 2025
            </h2>
            <p className="text-xs text-slate-500">
              {saveStatus === 'saving' ? 'Saving…' : 'Saved on this device'}
              {saveStatus === 'saved' ? <CheckCircle2 className="ml-1 inline h-3.5 w-3.5 text-emerald-600" /> : null}
            </p>
          </div>
        </div>
        <Button variant="primary" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => setShowPrint(true)}>
          Print
        </Button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 rounded-[14px] border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900 md:grid-cols-5">
        <Total label="Real property" value={totals.realSubtotal} />
        <Total label="Personal property" value={totals.personalSubtotal} />
        <Total label="Total assets" value={totals.totalAssets} />
        <Total label="Liabilities" value={totals.totalLiabilities} />
        <Total label="Net worth" value={totals.netWorth} emphasize />
      </div>

      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav className="hidden md:block">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`mb-1 block w-full rounded-[10px] px-3 py-1.5 text-left text-[13px] ${
                section === item.id ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <label className="md:hidden">
          <span className="mb-1 block text-sm font-medium">Section</span>
          <select className={inputClass} value={section} onChange={(e) => setSection(Number(e.target.value))}>
            {SECTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-4">
          {section === 1 ? <DeclarantSection record={record} onChange={change} /> : null}
          {section === 2 ? (
            <RowSection
              title="Real properties"
              hint="Assessed value and fair market value are disclosed. Net worth uses acquisition cost."
              onAdd={() => change({ ...record, realProperties: [...record.realProperties, emptyReal()] })}
            >
              {record.realProperties.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-[14px] border border-slate-200 p-4 md:grid-cols-2">
                  <OwnerField value={row.owner} onChange={(owner) => patchList(record, change, 'realProperties', row.id, { owner })} />
                  <Field label="Description" value={row.description} onChange={(description) => patchList(record, change, 'realProperties', row.id, { description })} />
                  <Field label="Kind" value={row.kind} onChange={(kind) => patchList(record, change, 'realProperties', row.id, { kind })} />
                  <Field label="Exact location" value={row.location} onChange={(location) => patchList(record, change, 'realProperties', row.id, { location })} />
                  <Field label="Assessed value" value={row.assessedValue} onChange={(assessedValue) => patchList(record, change, 'realProperties', row.id, { assessedValue })} />
                  <Field label="Current fair market value" value={row.fairMarketValue} onChange={(fairMarketValue) => patchList(record, change, 'realProperties', row.id, { fairMarketValue })} />
                  <Field label="Acquisition year" value={row.acquisitionYear} onChange={(acquisitionYear) => patchList(record, change, 'realProperties', row.id, { acquisitionYear })} />
                  <Field label="Mode" value={row.acquisitionMode} onChange={(acquisitionMode) => patchList(record, change, 'realProperties', row.id, { acquisitionMode })} />
                  <Field label="Acquisition cost" value={row.acquisitionCost} onChange={(acquisitionCost) => patchList(record, change, 'realProperties', row.id, { acquisitionCost })} />
                  <Remove onClick={() => change({ ...record, realProperties: record.realProperties.filter((item) => item.id !== row.id) })} />
                </div>
              ))}
            </RowSection>
          ) : null}
          {section === 3 ? (
            <RowSection title="Personal properties" onAdd={() => change({ ...record, personalProperties: [...record.personalProperties, emptyPersonal()] })}>
              {record.personalProperties.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-[14px] border border-slate-200 p-4 md:grid-cols-2">
                  <OwnerField value={row.owner} onChange={(owner) => patchList(record, change, 'personalProperties', row.id, { owner })} />
                  <Field label="Description" value={row.description} onChange={(description) => patchList(record, change, 'personalProperties', row.id, { description })} />
                  <Field label="Year" value={row.year} onChange={(year) => patchList(record, change, 'personalProperties', row.id, { year })} />
                  <Field label="Acquisition cost / amount" value={row.cost} onChange={(cost) => patchList(record, change, 'personalProperties', row.id, { cost })} />
                  <Remove onClick={() => change({ ...record, personalProperties: record.personalProperties.filter((item) => item.id !== row.id) })} />
                </div>
              ))}
            </RowSection>
          ) : null}
          {section === 4 ? (
            <RowSection title="Liabilities" onAdd={() => change({ ...record, liabilities: [...record.liabilities, emptyLiability()] })}>
              {record.liabilities.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-[14px] border border-slate-200 p-4 md:grid-cols-2">
                  <OwnerField value={row.owner} onChange={(owner) => patchList(record, change, 'liabilities', row.id, { owner })} />
                  <Field label="Nature" value={row.nature} onChange={(nature) => patchList(record, change, 'liabilities', row.id, { nature })} />
                  <Field label="Name of creditor" value={row.creditor} onChange={(creditor) => patchList(record, change, 'liabilities', row.id, { creditor })} />
                  <Field label="Outstanding balance" value={row.balance} onChange={(balance) => patchList(record, change, 'liabilities', row.id, { balance })} />
                  <Remove onClick={() => change({ ...record, liabilities: record.liabilities.filter((item) => item.id !== row.id) })} />
                </div>
              ))}
            </RowSection>
          ) : null}
          {section === 5 ? (
            <RowSection title="Business interests and financial connections" onAdd={() => change({ ...record, businesses: [...record.businesses, emptyBusiness()] })}>
              {record.businesses.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-[14px] border border-slate-200 p-4 md:grid-cols-2">
                  <OwnerField value={row.owner} onChange={(owner) => patchList(record, change, 'businesses', row.id, { owner })} />
                  <Field label="Name of entity" value={row.entity} onChange={(entity) => patchList(record, change, 'businesses', row.id, { entity })} />
                  <Field label="Business address" value={row.address} onChange={(address) => patchList(record, change, 'businesses', row.id, { address })} />
                  <Field label="Nature of interest or connection" value={row.nature} onChange={(nature) => patchList(record, change, 'businesses', row.id, { nature })} />
                  <Field label="Date acquired" value={row.dateAcquired} onChange={(dateAcquired) => patchList(record, change, 'businesses', row.id, { dateAcquired })} />
                  <Remove onClick={() => change({ ...record, businesses: record.businesses.filter((item) => item.id !== row.id) })} />
                </div>
              ))}
            </RowSection>
          ) : null}
          {section === 6 ? (
            <RowSection title="Relatives in government" hint="Include relatives within the fourth degree, and bilas, balae, and inso in government." onAdd={() => change({ ...record, relatives: [...record.relatives, emptyRelative()] })}>
              {record.relatives.map((row) => (
                <div key={row.id} className="grid gap-3 rounded-[14px] border border-slate-200 p-4 md:grid-cols-2">
                  <Field label="Name" value={row.name} onChange={(name) => patchList(record, change, 'relatives', row.id, { name })} />
                  <Field label="Relationship" value={row.relationship} onChange={(relationship) => patchList(record, change, 'relatives', row.id, { relationship })} />
                  <Field label="Position" value={row.position} onChange={(position) => patchList(record, change, 'relatives', row.id, { position })} />
                  <Field label="Agency" value={row.agency} onChange={(agency) => patchList(record, change, 'relatives', row.id, { agency })} />
                  <Remove onClick={() => change({ ...record, relatives: record.relatives.filter((item) => item.id !== row.id) })} />
                </div>
              ))}
            </RowSection>
          ) : null}
          {section === 7 ? (
            <div className="space-y-6">
              <SignaturePad
                label="Signature of declarant"
                value={record.declarantSignature}
                onChange={(declarantSignature) => change({ ...record, declarantSignature })}
              />
              {record.filing === 'joint' ? (
                <SignaturePad
                  label="Signature of spouse declarant"
                  value={record.spouseSignature}
                  onChange={(spouseSignature) => change({ ...record, spouseSignature })}
                />
              ) : (
                <p className="text-sm text-slate-500">A second signature is used only for joint filing.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {showPrint ? <SalnPrintPreview record={record} onClose={() => setShowPrint(false)} /> : null}
    </div>
  );
};

function Total({ label, value, emphasize }: { label: string; value: number; emphasize?: boolean }) {
  return (
    <div>
      <p className="text-[13px] text-slate-500">{label}</p>
      <p className={`font-medium ${emphasize && value < 0 ? 'text-rose-600' : 'text-slate-900 dark:text-slate-100'}`}>
        {formatMoney(value)}
      </p>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function OwnerField({ value, onChange }: { value: SalnOwner; onChange: (owner: SalnOwner) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Whose</span>
      <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value as SalnOwner)}>
        <option value="declarant">Declarant</option>
        <option value="spouse">Spouse exclusive</option>
        <option value="child">Unmarried child under 18</option>
      </select>
    </label>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[13px] text-slate-500 hover:text-rose-600">
      <Trash2 className="h-3.5 w-3.5" /> Remove row
    </button>
  );
}

function RowSection({
  title,
  hint,
  onAdd,
  children,
}: {
  title: string;
  hint?: string;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-medium">{title}</h3>
          {hint ? <p className="text-sm text-slate-500">{hint}</p> : null}
        </div>
        <Button type="button" variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={onAdd}>
          Add row
        </Button>
      </div>
      {children}
    </div>
  );
}

function DeclarantSection({ record, onChange }: { record: SalnRecord; onChange: (next: SalnRecord) => void }) {
  const setDeclarant = (patch: Partial<SalnRecord['declarant']>) =>
    onChange({ ...record, declarant: { ...record.declarant, ...patch } });
  const setSpouse = (patch: Partial<SalnRecord['spouse']>) =>
    onChange({ ...record, spouse: { ...record.spouse, ...patch } });

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Compliance</span>
          <select
            className={inputClass}
            value={record.compliance}
            onChange={(e) => onChange({ ...record, compliance: e.target.value as SalnRecord['compliance'] })}
          >
            <option value="assumption">Assumption of office</option>
            <option value="annual">Annual filing as of December 31</option>
            <option value="exit">Exit</option>
          </select>
        </label>
        <Field label="As of" value={record.asOfDate} onChange={(asOfDate) => onChange({ ...record, asOfDate })} />
      </div>
      <h3 className="text-base font-medium">Declarant</h3>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Family name" value={record.declarant.surname} onChange={(surname) => setDeclarant({ surname })} />
        <Field label="First name" value={record.declarant.firstName} onChange={(firstName) => setDeclarant({ firstName })} />
        <Field label="Middle initial" value={record.declarant.middleName} onChange={(middleName) => setDeclarant({ middleName })} />
        <Field label="Position" value={record.declarant.position} onChange={(position) => setDeclarant({ position })} />
        <Field label="Agency / office" value={record.declarant.agency} onChange={(agency) => setDeclarant({ agency })} />
        <Field label="Office address" value={record.declarant.officeAddress} onChange={(officeAddress) => setDeclarant({ officeAddress })} />
      </div>
      <h3 className="text-base font-medium">Spouse</h3>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={record.spouse.inGovernment}
          onChange={(e) => setSpouse({ inGovernment: e.target.checked })}
        />
        Spouse is in government service
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Family name" value={record.spouse.surname} onChange={(surname) => setSpouse({ surname })} />
        <Field label="First name" value={record.spouse.firstName} onChange={(firstName) => setSpouse({ firstName })} />
        <Field label="Middle initial" value={record.spouse.middleName} onChange={(middleName) => setSpouse({ middleName })} />
        {record.spouse.inGovernment ? (
          <>
            <Field label="Position" value={record.spouse.position} onChange={(position) => setSpouse({ position })} />
            <Field label="Agency / office" value={record.spouse.agency} onChange={(agency) => setSpouse({ agency })} />
            <Field label="Office address" value={record.spouse.officeAddress} onChange={(officeAddress) => setSpouse({ officeAddress })} />
          </>
        ) : null}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Filing</span>
        <select className={inputClass} value={record.filing} onChange={(e) => onChange({ ...record, filing: e.target.value as SalnRecord['filing'] })}>
          <option value="joint">Joint filing</option>
          <option value="separate">Separate filing</option>
          <option value="not-applicable">Not applicable</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={record.multipleMarriagesNotApplicable}
          onChange={(e) => onChange({ ...record, multipleMarriagesNotApplicable: e.target.checked })}
        />
        Multiple marriages not applicable
      </label>
      {record.multipleMarriagesNotApplicable ? null : (
        <Field label="Names of spouses" value={record.spouseNames} onChange={(spouseNames) => onChange({ ...record, spouseNames })} />
      )}
    </div>
  );
}

function patchList<K extends 'realProperties' | 'personalProperties' | 'liabilities' | 'businesses' | 'relatives'>(
  record: SalnRecord,
  onChange: (next: SalnRecord) => void,
  key: K,
  id: string,
  patch: Partial<SalnRecord[K][number]>,
) {
  const next = record[key].map((row) => (row.id === id ? { ...row, ...patch } : row));
  onChange({ ...record, [key]: next });
}
