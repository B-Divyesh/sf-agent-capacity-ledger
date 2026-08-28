export const productSlug = 'agent-capacity-ledger';
export const billingBase = 'https://api.sociobot.in/api/v1';
const tokenKey = `sb_license:${productSlug}`;
const verdictKey = `sb_license_verdict:${productSlug}`;

type Verdict = { valid: boolean; checkedAt: number; expiresAt?: string };

export function checkoutUrl(): string {
  return `${billingBase}/products/${productSlug}/checkout`;
}

export function storeLicenseFromUrl(): boolean {
  const url = new URL(window.location.href);
  const token = url.searchParams.get('license');
  if (!token) return false;
  localStorage.setItem(tokenKey, token);
  url.searchParams.delete('license');
  history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function setLicense(token: string) {
  localStorage.setItem(tokenKey, token.trim());
  localStorage.removeItem(verdictKey);
}

export function cachedLicenseValid(): boolean {
  const token = localStorage.getItem(tokenKey);
  if (!token) return false;
  try {
    const verdict = JSON.parse(localStorage.getItem(verdictKey) || 'null') as Verdict | null;
    return verdict?.valid === true;
  } catch {
    return false;
  }
}

export async function verifyLicense(force = false): Promise<boolean> {
  const token = localStorage.getItem(tokenKey);
  if (!token) return false;
  try {
    const cached = JSON.parse(localStorage.getItem(verdictKey) || 'null') as Verdict | null;
    if (!force && cached && Date.now() - cached.checkedAt < 86_400_000) return cached.valid;
  } catch { /* verify below */ }
  const response = await fetch(`${billingBase}/products/${productSlug}/verify?license=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error('License verification could not connect.');
  const result = await response.json() as { valid: boolean; expires_at?: string };
  localStorage.setItem(verdictKey, JSON.stringify({ valid: result.valid, checkedAt: Date.now(), expiresAt: result.expires_at }));
  return result.valid;
}
