/**
 * B-Roll Studio — License Key Verification Worker
 *
 * Validates license keys using HMAC-SHA256 signatures.
 * No database needed — validity is encoded in the key itself.
 *
 * To generate a license key (Node.js):
 *   const secret = 'your-secret-here';
 *   const payload = Buffer.from(JSON.stringify({
 *     tier: 'pro',
 *     exp: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
 *     uid: crypto.randomUUID(),
 *   })).toString('base64url');
 *   const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 8);
 *   const key = `BROLL-${payload}-${sig}`;
 *   console.log(key);
 *
 * To deploy:
 *   npx wrangler deploy
 *
 * To set the secret:
 *   npx wrangler secret put LICENSE_SECRET
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    try {
      const { key } = await request.json();
      if (!key || typeof key !== 'string') {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const firstDash = key.indexOf('-');
      const lastDash = key.lastIndexOf('-');
      if (firstDash === -1 || firstDash === lastDash || key.substring(0, firstDash) !== 'BROLL') {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const prefix = key.substring(0, firstDash);
      const payloadB64 = key.substring(firstDash + 1, lastDash);
      const sig = key.substring(lastDash + 1);

      let parsed;
      try {
        const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        const decoded = atob(padded);
        parsed = JSON.parse(decoded);
      } catch {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const encoder = new TextEncoder();
      const keyData = encoder.encode(env.LICENSE_SECRET || '');
      const messageData = encoder.encode(payloadB64);

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const sigBytes = new Uint8Array(signature);
      const expectedSigBytes = new Uint8Array(sig.length / 2);
      for (let i = 0; i < expectedSigBytes.length; i++) {
        expectedSigBytes[i] = parseInt(sig.substring(i * 2, i * 2 + 2), 16);
      }

      let sigMatch = sigBytes.length >= expectedSigBytes.length;
      for (let i = 0; i < expectedSigBytes.length && sigMatch; i++) {
        if (sigBytes[i] !== expectedSigBytes[i]) sigMatch = false;
      }

      if (!sigMatch || parsed.exp <= Date.now()) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      return new Response(JSON.stringify({ valid: true, tier: parsed.tier, exp: parsed.exp }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    } catch (err) {
      return new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  },
};
