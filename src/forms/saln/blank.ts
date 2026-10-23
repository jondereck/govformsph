import {
  SalnBusiness,
  SalnLiability,
  SalnPerson,
  SalnPersonalProperty,
  SalnRealProperty,
  SalnRecord,
  SalnRelative,
} from '../../types/saln';

export function salnId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11);
}

export function emptyPerson(inGovernment = true): SalnPerson {
  return {
    surname: '',
    firstName: '',
    middleName: '',
    position: '',
    agency: '',
    officeAddress: '',
    inGovernment,
  };
}

export function emptyReal(): SalnRealProperty {
  return {
    id: salnId(),
    owner: 'declarant',
    description: '',
    kind: '',
    location: '',
    assessedValue: '',
    fairMarketValue: '',
    acquisitionYear: '',
    acquisitionMode: '',
    acquisitionCost: '',
  };
}

export function emptyPersonal(): SalnPersonalProperty {
  return { id: salnId(), owner: 'declarant', description: '', year: '', cost: '' };
}

export function emptyLiability(): SalnLiability {
  return { id: salnId(), owner: 'declarant', nature: '', creditor: '', balance: '' };
}

export function emptyBusiness(): SalnBusiness {
  return { id: salnId(), owner: 'declarant', entity: '', address: '', nature: '', dateAcquired: '' };
}

export function emptyRelative(): SalnRelative {
  return { id: salnId(), name: '', relationship: '', position: '', agency: '' };
}

export function createNewSalnRecord(): SalnRecord {
  const now = new Date().toISOString();
  return {
    meta: {
      createdAt: now,
      updatedAt: now,
      formVersion: 'SALN-2025',
      title: 'SALN 2025',
    },
    compliance: 'annual',
    asOfDate: '',
    declarant: emptyPerson(true),
    spouse: emptyPerson(false),
    filing: 'not-applicable',
    multipleMarriagesNotApplicable: true,
    spouseNames: '',
    realProperties: [emptyReal()],
    personalProperties: [emptyPersonal()],
    liabilities: [emptyLiability()],
    businesses: [emptyBusiness()],
    relatives: [emptyRelative()],
    declarantSignature: null,
    spouseSignature: null,
  };
}

export function salnTitle(record: SalnRecord): string {
  const name = [record.declarant.surname, record.declarant.firstName].filter(Boolean).join(', ');
  return name || record.meta.title || 'SALN 2025';
}
