import { describe, expect, it } from 'vitest';
import { attributedPercent, ledgerCsv, parseCsv, remaining, risk, sourceValidationError } from './ledger';
import { sampleLedger } from './sample';

describe('capacity forecast', () => {
  it('never reports negative remaining sessions', () => {
    const source = sampleLedger().sources[0];
    expect(remaining({ ...source, used: source.limit + 10 })).toBe(0);
  });

  it('marks capacity that runs out before reset', () => {
    const source = sampleLedger().sources[0];
    expect(risk({ ...source, used: 119, dailyPace: 5 })).toBe('At risk');
  });

  it('calculates attributed spend', () => {
    expect(attributedPercent(sampleLedger())).toBe(93);
  });

  it('exports sources and spend as CSV', () => {
    const ledger = sampleLedger();
    const csv = ledgerCsv(ledger);
    expect(csv).toContain('"type","date","project"');
    expect(csv.split('\n')).toHaveLength(1 + ledger.sources.length + ledger.spend.length);
    expect(csv).toContain('"Atlas migration"');
  });

  it('rejects impossible source readings', () => {
    const source = sampleLedger().sources[0];
    expect(sourceValidationError({ ...source, used: source.limit + 1 })).toBe('Sessions used cannot exceed the session limit.');
    expect(sourceValidationError({ ...source, used: -1 })).toBe('Sessions used cannot be negative.');
    expect(sourceValidationError({ ...source, dailyPace: -1 })).toBe('Daily pace cannot be negative.');
    expect(sourceValidationError({ ...source, resetsOn: '2026-02-30' })).toBe('Add a valid reset date.');
  });

  it('parses quoted RFC 4180 CSV cells and rejects malformed quote placement', () => {
    expect(parseCsv('vendor,plan\n"Anthropic, Inc",Team')).toEqual([['vendor', 'plan'], ['Anthropic, Inc', 'Team']]);
    expect(parseCsv('vendor\nnot"quoted')).toBeNull();
  });
});
