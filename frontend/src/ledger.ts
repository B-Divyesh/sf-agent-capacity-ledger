import type { Ledger, Source } from './types';

export function remaining(source: Source): number {
  return Math.max(0, source.limit - source.used);
}

export function daysUntil(date: string): number {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((new Date(`${date}T00:00:00Z`).getTime() - now.getTime()) / 86_400_000));
}

export function runoutDays(source: Source): number {
  return source.dailyPace > 0 ? remaining(source) / source.dailyPace : Number.POSITIVE_INFINITY;
}

export function risk(source: Source): 'At risk' | 'Watch' | 'On track' {
  const margin = runoutDays(source) - daysUntil(source.resetsOn);
  if (margin < 0) return 'At risk';
  if (margin < 3) return 'Watch';
  return 'On track';
}

export function attributedPercent(ledger: Ledger): number {
  const total = ledger.spend.reduce((sum, item) => sum + item.amount, 0);
  const attributed = ledger.spend.filter((item) => item.project.trim().toLowerCase() !== 'unallocated').reduce((sum, item) => sum + item.amount, 0);
  return total ? Math.round((attributed / total) * 100) : 0;
}

const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;

export function ledgerCsv(ledger: Ledger): string {
  const header = ['type', 'date', 'project', 'vendor', 'plan', 'amount_usd', 'used_sessions', 'session_limit', 'resets_on'];
  const sourceRows = ledger.sources.map((source) => [
    'capacity', '', '', source.vendor, source.plan, source.monthlyCost, source.used, source.limit, source.resetsOn,
  ]);
  const spendRows = ledger.spend.map((item) => {
    const source = ledger.sources.find((candidate) => candidate.id === item.sourceId);
    return ['spend', item.date, item.project, source?.vendor ?? 'Unknown', source?.plan ?? '', item.amount, '', '', ''];
  });
  return [header, ...sourceRows, ...spendRows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadCsv(ledger: Ledger) {
  const url = URL.createObjectURL(new Blob([ledgerCsv(ledger)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'agent-capacity-ledger.csv';
  link.click();
  URL.revokeObjectURL(url);
}
