import { SalnFiling, SalnOwner, SalnRecord } from '../../types/saln';

export function parseMoney(value: string): number {
  const cleaned = String(value ?? '').replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export function formatMoney(amount: number): string {
  return amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Child rows never count. Spouse-exclusive rows count only on a joint filing. */
export function countsTowardNetWorth(owner: SalnOwner, filing: SalnFiling): boolean {
  if (owner === 'child') return false;
  if (owner === 'spouse') return filing === 'joint';
  return true;
}

export interface SalnTotals {
  realSubtotal: number;
  personalSubtotal: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

export function computeSalnTotals(record: SalnRecord): SalnTotals {
  const filing = record.filing;
  const realSubtotal = record.realProperties.reduce(
    (sum, row) => sum + (countsTowardNetWorth(row.owner, filing) ? parseMoney(row.acquisitionCost) : 0),
    0,
  );
  const personalSubtotal = record.personalProperties.reduce(
    (sum, row) => sum + (countsTowardNetWorth(row.owner, filing) ? parseMoney(row.cost) : 0),
    0,
  );
  const totalLiabilities = record.liabilities.reduce(
    (sum, row) => sum + (countsTowardNetWorth(row.owner, filing) ? parseMoney(row.balance) : 0),
    0,
  );
  const totalAssets = realSubtotal + personalSubtotal;
  return {
    realSubtotal,
    personalSubtotal,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  };
}
