import { TIER, DEFAULTS } from './constants.js';
import { getLicense, saveLicense, getExportCount } from './storage.js';

export async function activateKey(key) {
  try {
    const response = await fetch(DEFAULTS.CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });
    if (!response.ok) return false;
    const data = await response.json();
    if (data.valid === true) {
      await saveLicense({
        tier: TIER.PRO,
        key,
        validUntil: data.exp,
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('activateKey error:', err);
    return false;
  }
}

export async function getCachedTier() {
  try {
    const state = await getLicense();
    if (state.tier === TIER.PRO && state.validUntil > Date.now()) {
      return TIER.PRO;
    }
    return TIER.FREE;
  } catch (err) {
    console.error('getCachedTier error:', err);
    return TIER.FREE;
  }
}

export async function isProUser() {
  const tier = await getCachedTier();
  return tier === TIER.PRO;
}

export async function isFreeUser() {
  const tier = await getCachedTier();
  return tier === TIER.FREE;
}

export async function canExport() {
  const tier = await getCachedTier();
  if (tier === TIER.PRO) return true;
  const count = await getExportCount();
  return count < DEFAULTS.FREE_EXPORTS_MONTHLY;
}

export async function getRemainingFreeExports() {
  const tier = await getCachedTier();
  if (tier === TIER.PRO) return Infinity;
  const count = await getExportCount();
  return Math.max(0, DEFAULTS.FREE_EXPORTS_MONTHLY - count);
}
