# B-Roll Studio — Comprehensive Fix Plan

## Overview
14 issues across 10 files. Grouped by file, ordered by severity within each file. Estimated effort markers: `[S]` small (< 15 min), `[M]` medium (15-45 min), `[L]` large (45+ min).

---

## Phase 1: CRITICAL — App won't run correctly

### Fix #1: Duplicate variable declarations — `offscreen/offscreen.js` `[S]`

**Problem:** `useWatermark` and `renderBrandKit` declared with `const` twice in `handleRenderVideo()` — once at lines 125-129 (inside `if (scenes.length > 0)` inside `if (isVideo)`), and again at lines 146-150 (function scope). The second declarations shadow the first, and the first pair is only used for the pre-render first-frame. This causes a SyntaxError in strict mode / some runtimes, and is logically redundant.

**Fix:**
1. Remove lines 125-129 (the `const useWatermark` / `const renderBrandKit` / `renderFrame` block inside `if (scenes.length > 0)`)
2. Move lines 146-150 (the second `const useWatermark` / `const renderBrandKit` declarations) to just after the `let currentFrame = 0;` line (after line 144), before the `for (let s = 0; ...)` loop
3. Restore the first-frame pre-render inside `if (isVideo)` using the moved variables — place the `if (scenes.length > 0) { renderFrame(...); }` block using the now-available `useWatermark`/`renderBrandKit`

**Result:** Single declaration, used by both pre-render and main loop.

---

### Fix #2: Debug license bypass — `lib/storage.js` + `lib/license.js` `[M]`

**⚠️ REQUIRES USER INPUT:** These are debug shortcuts that bypass real license verification. The user needs to decide:
- **Option A:** Remove debug bypass and rely on real Cloudflare Worker verification (requires Fix #3 to be resolved first)
- **Option B:** Keep debug bypass behind a dev-mode flag (e.g., `chrome.runtime.getManifest().version !== 'production'`)
- **Option C:** Keep debug bypass for now, flag as TODO

**If Option A selected:**

**`lib/storage.js` lines 72-78 — `getLicense()`:**
```javascript
// Replace hardcoded return with actual storage read:
export async function getLicense() {
  try {
    const stored = await get(STORAGE.LICENSE);
    return stored || { tier: TIER.FREE, key: '', validUntil: 0 };
  } catch (err) {
    console.error('getLicense error:', err);
    return { tier: TIER.FREE, key: '', validUntil: 0 };
  }
}
```

**`lib/license.js` lines 28-48 — multiple functions:**
```javascript
export async function getCachedTier() {
  const license = await getLicense();
  if (license.tier === TIER.PRO && license.validUntil > Date.now()) {
    return TIER.PRO;
  }
  return TIER.FREE;
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
```

Also remove the hardcoded `defaultLicense` in `storage.js` lines 16-20 (set default to free tier).

---

### Fix #3: Placeholder Worker URL — `lib/constants.js:81` `[S]`

**⚠️ REQUIRES USER INPUT:** The Cloudflare Worker URL is `https://broll-license.YOUR_SUBDOMAIN.workers.dev` — user needs to provide their actual deployed worker URL.

**Fix:** Replace the placeholder with the real URL once provided. Optionally, add a runtime check:
```javascript
// At top of license.js activateKey():
if (DEFAULTS.CLOUDFLARE_WORKER_URL.includes('YOUR_SUBDOMAIN')) {
  console.warn('Cloudflare Worker URL not configured');
  return false;
}
```

---

## Phase 2: HIGH — Broken functionality

### Fix #4: GIF Encoder LZW broken — `lib/export.js:230-258` `[L]`

**Problem:** The `lzwEncode` method's `writeCode` function (lines 237-241) doesn't do variable-width bit packing. It just pushes raw bytes. GIF LZW requires sub-byte bit packing that starts at `minCodeSize + 1` bits and grows as the dictionary grows.

**Fix:** Replace the `lzwEncode` method with a proper variable-width LZW encoder:

```javascript
lzwEncode(data) {
  const minCodeSize = 8;
  const clearCode = 1 << minCodeSize;   // 256
  const eofCode = clearCode + 1;         // 257
  let codeSize = minCodeSize + 1;        // starts at 9 bits
  let nextCode = eofCode + 1;            // 258
  const dict = new Map();
  for (let i = 0; i < clearCode; i++) {
    dict.set(String.fromCharCode(i), i);
  }

  const bits = [];
  const emit = (code) => {
    for (let i = 0; i < codeSize; i++) {
      bits.push((code >> i) & 1);
    }
  };

  emit(clearCode);
  let w = String.fromCharCode(data[0]);
  for (let i = 1; i < data.length; i++) {
    const c = String.fromCharCode(data[i]);
    if (dict.has(w + c)) {
      w += c;
    } else {
      emit(dict.get(w));
      if (nextCode < 4096) {
        dict.set(w + c, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) {
          codeSize++;
        }
      } else {
        emit(clearCode);
        dict.clear();
        for (let j = 0; j < clearCode; j++) dict.set(String.fromCharCode(j), j);
        nextCode = eofCode + 1;
        codeSize = minCodeSize + 1;
      }
      w = c;
    }
  }
  emit(dict.get(w));
  emit(eofCode);

  // Pack bits into bytes
  const output = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8 && i + j < bits.length; j++) {
      byte |= bits[i + j] << j;
    }
    output.push(byte);
  }
  return output;
}
```

**Also fix:** The `writeGraphicsControlExtension` method (line 145) — the delay should be in centiseconds, not frames. Currently passing raw `delay` (which is `Math.round(100 / fps)` from `exportGif`), which happens to already be in centiseconds, so this is actually correct.

---

### Fix #5: Cloudflare Worker key parsing — `cloudflare-worker/worker.js:53-66` `[M]`

**Problem:** `key.split('-')` breaks because base64url-encoded payloads contain `-` characters. A key like `BROLL-eyJ0aWVy...abc-def12345` splits into 4+ parts.

**Fix:** Split only on the first two dashes (after `BROLL` and before the signature):

```javascript
// Replace lines 53-61:
const brollIdx = key.indexOf('BROLL-');
if (brollIdx !== 0) {
  return invalidResponse();
}
const withoutPrefix = key.slice(6); // remove 'BROLL-'
const lastDash = withoutPrefix.lastIndexOf('-');
if (lastDash <= 0) {
  return invalidResponse();
}
const payloadB64 = withoutPrefix.slice(0, lastDash);
const sig = withoutPrefix.slice(lastDash + 1);
```

Extract a helper to avoid repeating the invalid response:
```javascript
function invalidResponse() {
  return new Response(JSON.stringify({ valid: false }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}
```

---

### Fix #6: ImageBitmap never closed — `lib/capture.js` + `offscreen/offscreen.js` `[M]`

**Problem:** `createImageBitmap()` and `base64ToImageBitmap()` return ImageBitmap objects that are never closed, leaking GPU memory.

**Fix in `lib/capture.js`:**
```javascript
// In stitchStrips(), close bitmaps after drawing:
for (let i = 0; i < bitmaps.length; i++) {
  const bitmap = bitmaps[i];
  const yOff = Math.round((offsets[i] || 0) * devicePixelRatio);
  ctx.drawImage(bitmap, 0, yOff);
  bitmap.close();  // <-- ADD THIS
}

// Close the empty-canvas bitmap too (line 14):
if (bitmaps.length === 0) {
  const result = await createImageBitmap(canvas);
  canvas = null; // allow GC
  return result;
}

// At end, after creating final result (line 28-30):
const result = await createImageBitmap(canvas);
return result;
// Note: the OffscreenCanvas itself doesn't need closing
```

**Fix in `offscreen/offscreen.js`:**
```javascript
// After using imageBitmap (line 108), close it when done:
// At the end of handleRenderVideo (after the blob is sent), add:
if (imageBitmap) {
  try { imageBitmap.close(); } catch (e) {}
}
```

---

### Fix #7: downloadBlob revokes URL synchronously — `lib/export.js:43-50` `[S]**

**Problem:** `URL.revokeObjectURL(url)` is called immediately after `a.click()`, but the download hasn't started yet.

**Fix:**
```javascript
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Revoke after a delay to allow browser to start download
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
```

---

### Fix #8: Duplicate calculateStripOffsets — `background/service-worker.js` + `lib/capture.js` `[S]**

**Problem:** Identical function exists in both files.

**Fix:**
1. Keep the canonical implementation in `lib/capture.js` (already exported)
2. In `background/service-worker.js`:
   - Add import: `import { calculateStripOffsets } from '../lib/capture.js';`
   - Remove the local `calculateStripOffsets` function (lines 73-86)

---

### Fix #9: Missing null check on tab messaging — `background/service-worker.js:181` `[S]**

**Problem:** `chrome.tabs.get(targetTabId)` can return null/undefined if the tab was closed during capture, but line 185 accesses `win.windowId` without checking.

**Fix:**
```javascript
const win = await chrome.tabs.get(targetTabId);
if (!win) throw new Error('Tab ' + targetTabId + ' was closed during capture');
```

---

### Fix #10: Download listener leak — `background/service-worker.js:358-369` `[S]`

**Problem:** If `delta.state.current` never reaches `'complete'` or `'interrupted'` (edge cases like browser crash), the listener stays attached forever.

**Fix:** Add a timeout to auto-remove the listener:
```javascript
const listener = (delta) => {
  if (delta.id === downloadId && delta.state) {
    if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
      chrome.downloads.onChanged.removeListener(listener);
      clearTimeout(failsafeTimer);
      setTimeout(() => {
        if (gen === exportGeneration) closeOffscreenDocument();
      }, 1000);
    }
  }
};
chrome.downloads.onChanged.addListener(listener);
const failsafeTimer = setTimeout(() => {
  chrome.downloads.onChanged.removeListener(listener);
  if (gen === exportGeneration) closeOffscreenDocument();
}, 30000); // 30s safety net
```

---

## Phase 3: MEDIUM — Code quality

### Fix #11: Unused imports `[S]`

| File | Unused Import |
|------|--------------|
| `offscreen/offscreen.js:1` | `DEFAULTS` |
| `sidepanel/sidepanel.js:7` | `isFreeUser`, `canExport`, `getRemainingFreeExports` |
| `sidepanel/sidepanel.js:5` | `getExportCount` |
| `background/service-worker.js:2` | `saveLicense` |
| `background/service-worker.js:3` | `getRemainingFreeExports` |
| `lib/presets.js:1` | `DEFAULTS` |

**Fix:** Remove each unused import.

---

### Fix #12: Hardcoded message strings `[S]`

**Problem:** Several message types are used as string literals instead of MSG constants.

| File:Line | String | Action |
|-----------|--------|--------|
| `content/overlay.js:107` | `'SELECTION_READY'` | Already in MSG, use `MSG.SELECTION_READY` (but overlay.js doesn't import MSG — add import or leave as-is since it's an IIFE) |
| `background/service-worker.js:27,49,405` | `'REDRAW_SCENE_RECTS'` | Add to MSG constants, use `MSG.REDRAW_SCENE_RECTS` |
| `background/service-worker.js:394` | `'CANCEL_RENDER'` | Add to MSG constants, use `MSG.CANCEL_RENDER` |
| `sidepanel/sidepanel.js:232` | `'CANCEL_RENDER'` | Use `MSG.CANCEL_RENDER` |
| `sidepanel/sidepanel.js:383` | `'REDRAW_SCENE_RECTS'` | Use `MSG.REDRAW_SCENE_RECTS` |
| `content/content.js:22-28` | `'HIDE_OVERLAY'`, `'SHOW_OVERLAY'` | Add to MSG constants, use MSG |

**Add to `lib/constants.js` MSG object:**
```javascript
REDRAW_SCENE_RECTS: 'REDRAW_SCENE_RECTS',
CANCEL_RENDER: 'CANCEL_RENDER',
HIDE_OVERLAY: 'HIDE_OVERLAY',
SHOW_OVERLAY: 'SHOW_OVERLAY',
```

Note: `content/overlay.js` and `content/content.js` are IIFEs that don't use ES module imports. For those files, either leave as string literals or convert to modules. Low priority — leave as-is for now.

---

## Phase 4: LOW — Minor improvements

### Fix #14: sendResponse always returns true — `content/content.js:61` `[S]`

**Problem:** `handleMessage` returns `true` for all messages, keeping the Chrome message channel open even for messages that don't need async response.

**Fix:** Change the default return and only return `true` for cases that call `sendResponse` asynchronously:
```javascript
switch (type) {
  // ... existing cases ...
  default:
    break;
}
return false; // Changed from true — only return true for async sendResponse
```

The only case that uses `sendResponse` is `GET_PAGE_DIMENSIONS` (synchronous) and `SCROLL_TAB` (synchronous), both of which are handled inline. No case actually needs `return true`.

---

## Implementation Order

| Priority | Fix | Files | Effort | Blocks |
|----------|-----|-------|--------|--------|
| 1 | #1 Duplicate vars | offscreen.js | [S] | Nothing |
| 2 | #3 Worker URL placeholder | constants.js | [S] | Fix #2 (if Option A) |
| 3 | #2 License bypass | storage.js, license.js | [M] | #3 |
| 4 | #5 Worker key parsing | worker.js | [M] | #2 (if Option A) |
| 5 | #4 GIF LZW encoder | export.js | [L] | Nothing |
| 6 | #6 ImageBitmap leak | capture.js, offscreen.js | [M] | Nothing |
| 7 | #7 downloadBlob revoke | export.js | [S] | Nothing |
| 8 | #8 Duplicate offsets | service-worker.js | [S] | Nothing |
| 9 | #9 Tab null check | service-worker.js | [S] | Nothing |
| 10 | #10 Listener leak | service-worker.js | [S] | Nothing |
| 11 | #11 Unused imports | 6 files | [S] | Nothing |
| 12 | #12 MSG constants | constants.js, service-worker.js, sidepanel.js | [S] | Nothing |
| 13 | #14 sendResponse | content.js | [S] | Nothing |

**Critical path:** #3 → #2 → #5 (license system must work end-to-end)
**Independent track:** #1, #4, #6, #7, #8, #9, #10, #11, #12, #14 (can be done in any order)

---

## Testing Checklist

After all fixes:
- [ ] Extension loads without console errors
- [ ] Capture flow works (activate → select text → scene added)
- [ ] Export produces valid MP4/WebM (video mode)
- [ ] Export produces valid GIF (fix #4 — verify with gifload or browser)
- [ ] Export produces valid ZIP of PNGs
- [ ] License activation works with real Cloudflare Worker
- [ ] Free tier limits enforced (5 exports/month)
- [ ] Download completes and file is valid
- [ ] No ImageBitmap leaks (check `chrome://system/` or Task Manager for GPU memory)
- [ ] Tab closed during capture shows meaningful error
