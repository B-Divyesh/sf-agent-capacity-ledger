export type Source = {
  id: string;
  vendor: string;
  plan: string;
  limit: number;
  used: number;
  dailyPace: number;
  resetsOn: string;
  monthlyCost: number;
  fallbackId: string;
  notes: string;
};

export type SpendEntry = {
  id: string;
  date: string;
  project: string;
  sourceId: string;
  amount: number;
};

export type Ledger = {
  teamName: string;
  sources: Source[];
  spend: SpendEntry[];
};

export type SaveState = 'idle' | 'saving' | 'saved' | 'error' | 'offline';
