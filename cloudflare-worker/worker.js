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

      const parts = key.split('-');
      if (parts.length !== 3 || parts[0] !== 'BROLL') {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      const [, payloadB64, sig] = parts;

      let parsed;
      try {
        const decoded = atob(payloadB64);
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
      const hashArray = Array.from(new Uint8Array(signature));
      const computedSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);

      if (computedSig.length !== sig.length) {
        return new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }

      let sigMatch = true;
      for (let i = 0; i < sig.length; i++) {
        if (computedSig[i] !== sig[i]) sigMatch = false;
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
