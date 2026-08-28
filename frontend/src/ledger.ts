import type { Ledger, Source } from './types';

export function sourceValidationError(source: Source): string {
  if (!source.vendor.trim() || !source.plan.trim()) return 'Add both a vendor and plan.';
  if (!Number.isFinite(source.limit) || source.limit <= 0) return 'Session limit must be greater than zero.';
  if (!Number.isFinite(source.used) || source.used < 0) return 'Sessions used cannot be negative.';
  if (source.used > source.limit) return 'Sessions used cannot exceed the session limit.';
  if (!Number.isFinite(source.dailyPace) || source.dailyPace < 0) return 'Daily pace cannot be negative.';
  if (!Number.isFinite(source.monthlyCost) || source.monthlyCost < 0) return 'Monthly cost cannot be negative.';
  if (!validCalendarDate(source.resetsOn)) return 'Add a valid reset date.';
  return '';
}

export function validCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day);
}

/** Parse RFC 4180 cells, including quoted commas, escaped quotes, and CRLF rows. */
export function parseCsv(text: string): string[][] | null {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
      continue;
    }
    if (character === '"') {
      if (cell.length) return null;
      quoted = true;
    } else if (character === ',') { row.push(cell); cell = ''; }
    else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += character;
  }
  if (quoted) return null;
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

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
