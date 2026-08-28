import { describe, expect, it } from 'vitest';
import { attributedPercent, ledgerCsv, remaining, risk } from './ledger';
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
});
