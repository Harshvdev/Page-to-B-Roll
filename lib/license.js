import { TIER, DEFAULTS } from './constants.js';
import { getLicense, saveLicense, getExportCount } from './storage.js';

export async function activateKey(key) {
  try {
    if (!key || typeof key !== 'string') return false;
    await saveLicense({
      tier: TIER.PRO,
      key,
      validUntil: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    });
    return true;
  } catch (err) {
    console.error('activateKey error:', err);
    return false;
  }
}

export async function getCachedTier() {
  return TIER.PRO;
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
  return true;
}

export async function getRemainingFreeExports() {
  return Infinity;
}
