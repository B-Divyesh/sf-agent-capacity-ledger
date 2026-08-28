import type { Ledger } from './types';

const future = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const sampleLedger = (): Ledger => ({
  teamName: 'Northstar Engineering',
  sources: [
    { id: 'claude-max', vendor: 'Claude Code', plan: 'Max seat', limit: 120, used: 103, dailyPace: 7, resetsOn: future(6), monthlyCost: 100, fallbackId: 'codex-team', notes: 'Use for repository-wide changes.' },
    { id: 'codex-team', vendor: 'Codex', plan: 'Team seat', limit: 180, used: 81, dailyPace: 8, resetsOn: future(11), monthlyCost: 60, fallbackId: 'github-copilot', notes: 'Approved fallback for Atlas and Relay.' },
    { id: 'github-copilot', vendor: 'GitHub Copilot', plan: 'Business', limit: 300, used: 142, dailyPace: 10, resetsOn: future(16), monthlyCost: 57, fallbackId: '', notes: 'Completion and small fixes only.' },
  ],
  spend: [
    { id: 's1', date: new Date().toISOString().slice(0, 10), project: 'Atlas migration', sourceId: 'claude-max', amount: 76 },
    { id: 's2', date: new Date().toISOString().slice(0, 10), project: 'Relay API', sourceId: 'codex-team', amount: 52 },
    { id: 's3', date: new Date().toISOString().slice(0, 10), project: 'Support rotation', sourceId: 'github-copilot', amount: 31 },
    { id: 's4', date: new Date().toISOString().slice(0, 10), project: 'Unallocated', sourceId: 'github-copilot', amount: 12 },
  ],
});

export const emptyLedger = (): Ledger => ({ teamName: 'My engineering team', sources: [], spend: [] });
