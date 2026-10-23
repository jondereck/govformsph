export type SalnCompliance = 'assumption' | 'annual' | 'exit' | '';
export type SalnFiling = 'joint' | 'separate' | 'not-applicable' | '';
export type SalnOwner = 'declarant' | 'spouse' | 'child';

export interface SalnMeta {
  createdAt: string;
  updatedAt: string;
  formVersion: 'SALN-2025';
  title?: string;
}

export interface SalnPerson {
  surname: string;
  firstName: string;
  middleName: string;
  position: string;
  agency: string;
  officeAddress: string;
  inGovernment: boolean;
}

export interface SalnRealProperty {
  id: string;
  owner: SalnOwner;
  description: string;
  kind: string;
  location: string;
  assessedValue: string;
  fairMarketValue: string;
  acquisitionYear: string;
  acquisitionMode: string;
  acquisitionCost: string;
}

export interface SalnPersonalProperty {
  id: string;
  owner: SalnOwner;
  description: string;
  year: string;
  cost: string;
}

export interface SalnLiability {
  id: string;
  owner: SalnOwner;
  nature: string;
  creditor: string;
  balance: string;
}

export interface SalnBusiness {
  id: string;
  owner: SalnOwner;
  entity: string;
  address: string;
  nature: string;
  dateAcquired: string;
}

export interface SalnRelative {
  id: string;
  name: string;
  relationship: string;
  position: string;
  agency: string;
}

export interface SalnRecord {
  id?: number;
  meta: SalnMeta;
  compliance: SalnCompliance;
  asOfDate: string;
  declarant: SalnPerson;
  spouse: SalnPerson;
  filing: SalnFiling;
  multipleMarriagesNotApplicable: boolean;
  spouseNames: string;
  realProperties: SalnRealProperty[];
  personalProperties: SalnPersonalProperty[];
  liabilities: SalnLiability[];
  businesses: SalnBusiness[];
  relatives: SalnRelative[];
  declarantSignature: string | null;
  spouseSignature: string | null;
}
