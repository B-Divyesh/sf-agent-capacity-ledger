import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Claim = { id: string; test: string };

describe('public claim contract', () => {
  it('has exactly one tagged browser test for every listed claim', () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const claims = JSON.parse(readFileSync(resolve(root, '.factory/claims.json'), 'utf8')) as Claim[];
    const browserTests = [
      readFileSync(resolve(root, 'tests/claims.spec.ts'), 'utf8'),
      readFileSync(resolve(root, 'tests/site.spec.ts'), 'utf8'),
    ].join('\n');
    const ids = claims.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const claim of claims) {
      expect(claim.test).toBe(`npm run test:e2e -- --grep @claim:${claim.id}`);
      expect(browserTests.match(new RegExp(`@claim:${claim.id}(?![a-z0-9-])`, 'g')) ?? []).toHaveLength(1);
    }
    const taggedIds = [...browserTests.matchAll(/@claim:([a-z0-9-]+)/g)].map((match) => match[1]);
    expect([...new Set(taggedIds)].sort()).toEqual([...ids].sort());
  });
});
