# B-Roll Studio — Chrome Extension
## Complete Architecture, Project Structure & AI Prompt Sequence

> **This document is the attachment.** Attach it to every AI prompt you send.
> After each file is verified working in Chrome, update the Verified Contracts
> section at the bottom with the real exports the AI generated.

---

## Part 1 — Methodology

### Recommended Tool: Claude Code (Agentic Session)

Claude Code is better than chat for this project because it keeps all 23 files
in context simultaneously, can verify integration after each file, and catches
import errors before you even see them.

**Setup:**
```bash
mkdir broll-extension && cd broll-extension
claude   # starts Claude Code in this directory
```

**First prompt in Claude Code:**
```
I am building a Chrome MV3 extension called B-Roll Studio. 
Read BROLL_STUDIO_BUILD_GUIDE.md completely, then build all files 
in the order listed in Part 4, verifying each phase compiles 
before starting the next.
```

Claude Code will build, connect, and fix all 23 files in one session.

---

### Alternative: Sequential Chat Prompts

If using Claude.ai chat, Cursor, or similar:

1. Attach this document to **every** prompt — not just the first one.
2. Build **one file at a time**, in the exact Phase order below.
3. After generating a file, load the extension in `chrome://extensions`
   (Developer Mode → Load Unpacked) and verify it doesn't throw errors.
4. After a file is verified, copy its real exported function signatures
   into the **Verified Contracts** section at the bottom of this document.
5. On the next prompt, attach the updated document so the AI sees
   what the previous file actually exported, not what it assumed.

**The core rule:** Never ask the AI to make an architectural decision.
Every decision is already made in this document. If something is unclear,
update this doc before prompting — don't ask the AI to figure it out.

---

## Part 2 — Project Tree

```
broll-extension/
│
├── manifest.json                   # Extension config (MV3)
│
├── lib/                            # Pure logic — no DOM, shared across layers
│   ├── constants.js                # All magic strings and numbers
│   ├── types.js                    # JSDoc @typedef only — no runtime code
│   ├── storage.js                  # chrome.storage read/write wrappers
│   ├── license.js                  # License key validation, tier gating
│   ├── presets.js                  # 10 preset definitions (pure data + keyframe specs)
│   ├── animation-engine.js         # Easing functions, keyframe interpolation
│   ├── canvas-compositor.js        # Frame-by-frame canvas rendering
│   ├── capture.js                  # Full-page screenshot stitching
│   └── export.js                   # MediaRecorder, GIF, PNG-sequence, SRT
│
├── content/                        # Injected into active tabs
│   ├── content.js                  # Main entry — selection engine, messaging
│   ├── overlay.js                  # SVG overlay DOM management
│   └── overlay.css                 # Overlay styles (scoped to #broll-root)
│
├── offscreen/                      # Hidden render context (no UI shown)
│   ├── offscreen.html
│   └── offscreen.js                # Canvas host + MediaRecorder controller
│
├── background/
│   └── service-worker.js           # Message bus + screenshot coordinator
│
├── sidepanel/                      # Primary UI
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
│
├── popup/                          # Extension icon click → quick launch
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
│
└── cloudflare-worker/              # Separate deploy — zero cost license check
    └── worker.js
```

**Module system rules (important — do not deviate):**
- `content/*.js` — traditional globals, NO import/export, constants hardcoded inline
- `background/service-worker.js` — ES module (`"type": "module"` in manifest)
- `lib/*.js` — ES modules (import/export), used by service-worker, sidepanel, offscreen
- `sidepanel/sidepanel.js` — ES module via `<script type="module">`
- `offscreen/offscreen.js` — ES module via `<script type="module">`
- `popup/popup.js` — traditional script (simple, no imports needed)

---

## Part 3 — Shared Data Contracts

**Every AI prompt references these definitions. Do not invent new fields.**

### 3.1 — All Message Types (chrome.runtime.sendMessage)

```
ACTIVATE_SELECTION       sidepanel → background → content
DEACTIVATE_SELECTION     sidepanel → background → content
SELECTION_READY          content → background → sidepanel  (payload: Scene)
GET_PAGE_DIMENSIONS      background → content
PAGE_DIMENSIONS_RESULT   content → background  (payload: {pageWidth, pageHeight, scrollHeight})
CAPTURE_VIEWPORT         background internal  (payload: {scrollY})
SCROLL_TAB               background → content  (payload: {y})
FULL_PAGE_READY          background → offscreen  (payload: {strips: string[]})
RENDER_VIDEO             sidepanel → background → offscreen  (payload: RenderJob)
RENDER_PROGRESS          offscreen → background → sidepanel  (payload: {percent: number})
RENDER_COMPLETE          offscreen → background → sidepanel  (payload: {blobUrl: string})
RENDER_ERROR             offscreen → background → sidepanel  (payload: {message: string})
LICENSE_ACTIVATE         sidepanel → background  (payload: {key: string})
LICENSE_STATUS           background → sidepanel  (payload: LicenseState)
```

### 3.2 — Core Type Definitions

```js
/**
 * @typedef {Object} Coordinates
 * @property {number} x            - px from page left edge
 * @property {number} y            - px from page top (absolute, not viewport)
 * @property {number} width
 * @property {number} height
 * @property {number} pageWidth    - full document scrollWidth
 * @property {number} pageHeight   - full document scrollHeight
 * @property {number} viewportWidth
 * @property {number} viewportHeight
 */

/**
 * @typedef {Object} Scene
 * @property {string}      id             - crypto.randomUUID()
 * @property {string}      url            - source page URL
 * @property {number}      tabId
 * @property {Coordinates} coordinates
 * @property {string}      presetId       - value from PRESET constants
 * @property {number}      duration       - seconds (1–30)
 * @property {string}      text           - raw selected text
 * @property {string}      highlightColor - hex, e.g. '#FFEB3B'
 * @property {string}      boxColor       - hex, e.g. '#FF5252'
 * @property {string}      transition     - 'cut' | 'dissolve' | 'flash'
 * @property {number}      order          - position in scene queue (0-indexed)
 * @property {number}      createdAt      - Date.now()
 */

/**
 * @typedef {Object} BrandKit
 * @property {string}      primaryColor    - hex
 * @property {string}      secondaryColor  - hex
 * @property {string|null} logoDataUrl     - base64 PNG or null
 * @property {string}      logoPosition    - 'top-left'|'top-right'|'bottom-left'|'bottom-right'
 * @property {number}      logoOpacity     - 0.0 to 1.0
 * @property {string}      resolution      - '1080p' | '2k' | '4k'
 * @property {string}      aspectRatio     - '16:9' | '9:16' | '1:1' | '4:3'
 * @property {string}      exportFormat    - 'mp4' | 'webm' | 'gif' | 'png_sequence'
 * @property {boolean}     watermark       - always true for free tier
 * @property {string}      defaultTransition
 */

/**
 * @typedef {Object} LicenseState
 * @property {string}  tier        - 'free' | 'pro'
 * @property {string}  key         - license key string, '' if none
 * @property {number}  validUntil  - UTC ms timestamp, 0 if free
 */

/**
 * @typedef {Object} RenderJob
 * @property {Scene[]}   scenes
 * @property {string[]}  strips       - base64 viewport screenshots in scroll order
 * @property {BrandKit}  brandKit
 * @property {number}    fps          - always 30
 * @property {LicenseState} license
 */

/**
 * @typedef {Object} Project
 * @property {string}   id
 * @property {string}   name
 * @property {Scene[]}  scenes
 * @property {BrandKit} brandKit
 * @property {number}   createdAt
 * @property {number}   updatedAt
 */
```

### 3.3 — Constants Reference

```js
// PRESET IDs
PRESET.HIGHLIGHT_ZOOM   = 'highlight_zoom'
PRESET.SPOTLIGHT        = 'spotlight'
PRESET.BOX_CALLOUT      = 'box_callout'
PRESET.HEADLINE_REVEAL  = 'headline_reveal'
PRESET.WORD_BY_WORD     = 'word_by_word'
PRESET.SCROLL_JOURNEY   = 'scroll_journey'
PRESET.MAGNIFIER        = 'magnifier'        // PRO only
PRESET.REDLINE          = 'redline'          // PRO only
PRESET.POINTER_TOUR     = 'pointer_tour'     // PRO only
PRESET.AUTO_SCROLL      = 'auto_scroll'      // PRO only

// STORAGE KEYS
STORAGE.SCENES          = 'broll_scenes'
STORAGE.BRAND_KIT       = 'broll_brand_kit'
STORAGE.LICENSE         = 'broll_license'
STORAGE.PROJECTS        = 'broll_projects'
STORAGE.EXPORT_COUNT    = 'broll_export_count'
STORAGE.EXPORT_MONTH    = 'broll_export_month'

// TIERS
TIER.FREE = 'free'
TIER.PRO  = 'pro'

// DEFAULTS
DEFAULTS.FPS                   = 30
DEFAULTS.SCENE_DURATION        = 4        // seconds
DEFAULTS.HIGHLIGHT_COLOR       = '#FFEB3B'
DEFAULTS.BOX_COLOR             = '#FF5252'
DEFAULTS.SPOTLIGHT_OPACITY     = 0.6
DEFAULTS.FREE_EXPORTS_MONTHLY  = 5
DEFAULTS.PRO_PRESETS           = ['magnifier','redline','pointer_tour','auto_scroll']
DEFAULTS.WATERMARK_TEXT        = 'brollstudio.com'
DEFAULTS.LICENSE_JWT_TTL       = 604800000  // 7 days in ms
DEFAULTS.CLOUDFLARE_WORKER_URL = 'https://broll-license.YOUR_SUBDOMAIN.workers.dev'
```

### 3.4 — Storage Schema

```
chrome.storage.local:
  broll_scenes        →  Scene[]               (active working queue)
  broll_brand_kit     →  BrandKit              (persists across sessions)
  broll_license       →  LicenseState          (cached JWT result)
  broll_projects      →  Project[]             (saved project library, max 30)
  broll_export_count  →  number                (resets monthly)
  broll_export_month  →  string                (YYYY-MM format)
```

---

## Part 4 — Build Phases & Prompts

Each prompt below is copy-pasteable. Always attach this document alongside it.

---

### ═══ PHASE 0 — Foundation ═══
*No dependencies. Build all three before moving to Phase 1.*

---

#### File 1 of 23 — `manifest.json`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build manifest.json only.

Requirements:
- Manifest V3
- name: "B-Roll Studio", version: "1.0.0"
- description: "Capture any webpage as cinematic B-roll video. Select text, apply camera presets, export studio-grade MP4."
- permissions: ["activeTab", "scripting", "storage", "sidePanel", "tabs", "offscreen", "downloads"]
- host_permissions: ["<all_urls>"]
- background: service_worker pointing to "background/service-worker.js", type "module"
- content_scripts: inject ["content/overlay.css", "content/overlay.js", "content/content.js"]
  into all URLs (<all_urls>), at document_idle, run_at: "document_idle"
- action: no default_popup — clicking the icon fires an event caught by the service worker
  that opens the side panel. Set default_title only, with icon paths.
- side_panel: { "default_path": "sidepanel/sidepanel.html" }
- icons: assets/icons/icon-{16,32,48,128}.png
- No web_accessible_resources needed yet.
- Output only the JSON file contents, no explanation.
```

---

#### File 2 of 23 — `lib/constants.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/constants.js only.

Requirements:
- ES module (use export const)
- Export exactly four objects: MSG, STORAGE, PRESET, TIER, FORMAT, RATIO, DEFAULTS
- Use the exact string values defined in Part 3.3 of the attached architecture document
- DEFAULTS.PRO_PRESETS is an array of the four locked preset ID strings
- Add a short JSDoc comment above each exported object describing its purpose
- No logic, no functions — constants only
- Output only the file contents, no explanation.
```

---

#### File 3 of 23 — `lib/types.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/types.js only.

Requirements:
- ES module
- Contains ONLY JSDoc @typedef blocks — zero runtime code
- Define exactly these types from Part 3.2: Coordinates, Scene, BrandKit,
  LicenseState, RenderJob, Project
- Each typedef must exactly match the fields and types in Part 3.2
- End the file with: export default {}; (so it can be imported as a module)
- Output only the file contents, no explanation.
```

---

### ═══ PHASE 1 — Pure Logic ═══
*Depends on: constants.js, types.js. Verify Phase 0 files exist before starting.*

---

#### File 4 of 23 — `lib/storage.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/storage.js only.

Imports: { STORAGE, DEFAULTS, TIER } from './constants.js'

This module wraps chrome.storage.local. Export these async functions:

getScenes()           → Promise<Scene[]>        — returns [] if empty
saveScenes(scenes)    → Promise<void>
clearScenes()         → Promise<void>

getBrandKit()         → Promise<BrandKit>        — returns default BrandKit if empty
saveBrandKit(kit)     → Promise<void>

getLicense()          → Promise<LicenseState>    — returns {tier:'free', key:'', validUntil:0} if empty
saveLicense(state)    → Promise<void>

getProjects()         → Promise<Project[]>       — returns [] if empty
saveProject(project)  → Promise<void>            — upserts by id, trims to 30 max
deleteProject(id)     → Promise<void>

getExportCount()      → Promise<number>          — resets to 0 if current month differs from stored month
incrementExportCount() → Promise<void>           — increments count, updates stored month to current YYYY-MM

Default BrandKit values:
  primaryColor: '#FFEB3B', secondaryColor: '#FF5252',
  logoDataUrl: null, logoPosition: 'bottom-right', logoOpacity: 0.8,
  resolution: '1080p', aspectRatio: '16:9', exportFormat: 'mp4',
  watermark: true, defaultTransition: 'dissolve'

All functions must use try/catch and log errors to console.error.
Output only the file contents, no explanation.
```

---

#### File 5 of 23 — `lib/license.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/license.js only.

Imports:
  { TIER, DEFAULTS } from './constants.js'
  { getLicense, saveLicense, getExportCount } from './storage.js'

The Cloudflare Worker URL is stored in DEFAULTS.CLOUDFLARE_WORKER_URL.

Export these async functions:

activateKey(key)
  - POST to CLOUDFLARE_WORKER_URL with body { key }
  - On success response { valid: true, tier: 'pro', exp: <UTC ms> }:
      save LicenseState { tier:'pro', key, validUntil: exp } to storage, return true
  - On failure or network error: return false

getCachedTier()
  - Read LicenseState from storage
  - If tier is 'pro' AND validUntil > Date.now(): return 'pro'
  - Otherwise: return 'free'

isProUser()   → Promise<boolean>
isFreeUser()  → Promise<boolean>

canExport()
  - If pro: always return true
  - If free: return exportCount < DEFAULTS.FREE_EXPORTS_MONTHLY

getRemainingFreeExports()  → Promise<number>

All network errors must fail gracefully (catch → return false or 'free').
Output only the file contents, no explanation.
```

---

#### File 6 of 23 — `lib/presets.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/presets.js only.

Imports: { PRESET, DEFAULTS } from './constants.js'

A preset defines how the canvas animates for a scene.
Each preset needs a getKeyframes(coordinates, canvasWidth, canvasHeight, duration) function
that returns an array of keyframe objects: { time: 0–1, x, y, scale, overlayType, overlayProgress }.

  x, y = canvas translation (pixels to shift the full-page image)
  scale = zoom level (1.0 = no zoom, 1.5 = 50% zoomed in)
  overlayType = 'highlight' | 'spotlight' | 'box' | 'none' | 'word'
  overlayProgress = 0–1 (how far the overlay animation has progressed)

Export a const PRESETS array. Each item:
{
  id: string,         // from PRESET constants
  name: string,       // human-readable label
  description: string,
  proOnly: boolean,
  getKeyframes: (coordinates, canvasWidth, canvasHeight, duration) => Keyframe[]
}

Implement all 10 presets from Part 1 of the architecture:

HIGHLIGHT_ZOOM: wide view → zoom to target → highlight sweeps left-to-right
  Keyframes: [{t:0, scale:1.0, overlay:'none'}, {t:0.4, scale:1.6, overlay:'none'},
               {t:0.5, overlay:'highlight', overlayProgress:0}, {t:1, overlayProgress:1}]

SPOTLIGHT: zoom to target → darken surroundings → spotlight holds
  Keyframes: [{t:0, scale:1.0}, {t:0.4, scale:1.5}, {t:0.5, overlay:'spotlight', op:0},
               {t:0.7, op:1}, {t:1, op:1}]

BOX_CALLOUT: zoom to target → box draws itself around selection
  Keyframes: [{t:0, scale:1.0}, {t:0.4, scale:1.4}, {t:0.5, overlay:'box', op:0},
               {t:0.8, op:1}, {t:1, op:1}]

HEADLINE_REVEAL: extreme zoom on title → glint sweeps across text
  Keyframes: [{t:0, scale:2.5}, {t:0.3, scale:2.5}, {t:0.4, overlay:'highlight', op:0},
               {t:0.8, op:1}, {t:1, op:1}]

WORD_BY_WORD: zoom in → word-by-word highlight progresses with time
  Keyframes: [{t:0, scale:1.4}, {t:0.2, overlay:'word', op:0}, {t:0.95, op:1}, {t:1, op:1}]

SCROLL_JOURNEY: camera starts at page top, scrolls down to target
  Start y at 0 (top of page), end y at the target coordinates.y. Scale stays 1.0.

MAGNIFIER (PRO): camera on target, circular magnifier lens moves across text
  Keyframes: similar to HIGHLIGHT_ZOOM but overlayType:'magnifier'

REDLINE (PRO): zoom to target, strikethrough animation then fade in new text
  overlayType:'redline'

POINTER_TOUR (PRO): camera pans to target, animated cursor moves to selection
  overlayType:'pointer'

AUTO_SCROLL (PRO): camera scrolls continuously from scene.coordinates.y minus 200 to plus 200
  overlayType:'none', pure vertical pan

For SCROLL_JOURNEY, the x translation should keep the target coordinates.x horizontally centered.

Export also: getPresetById(id) → finds preset in PRESETS array or returns PRESETS[0].

Output only the file contents, no explanation.
```

---

### ═══ PHASE 2 — Animation & Rendering ═══
*Depends on: Phase 0 + Phase 1.*

---

#### File 7 of 23 — `lib/animation-engine.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/animation-engine.js only.

No imports needed. Pure math functions only.

Export these functions:

Easing functions — all take t (0–1), return t (0–1):
  easeInOut(t)   — cubic ease-in-out
  easeIn(t)      — cubic ease-in
  easeOut(t)     — cubic ease-out
  easeLinear(t)  — returns t
  spring(t)      — overshoot spring: 1 - Math.cos(t * Math.PI * 2.5) * Math.pow(2, -6*t)

lerp(a, b, t)   — linear interpolation
clamp(v, min, max)

interpolateKeyframes(keyframes, t)
  - keyframes: array of objects with 'time' (0–1) + any numeric properties
  - t: current normalized time 0–1
  - Finds the two surrounding keyframes, interpolates all numeric properties using easeInOut
  - Returns interpolated keyframe object

computeTransform(coordinates, keyframe, canvasWidth, canvasHeight)
  - Takes a Coordinates object and a keyframe {scale, x, y (optional pan override)}
  - Returns { translateX, translateY, scale } to apply to canvas context
  - Centers the target region on canvas when scale > 1
  - If keyframe has x/y overrides (for SCROLL_JOURNEY), use those directly

Output only the file contents, no explanation.
```

---

#### File 8 of 23 — `lib/canvas-compositor.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/canvas-compositor.js only.

Imports:
  { interpolateKeyframes, computeTransform, lerp, clamp } from './animation-engine.js'
  { getPresetById } from './presets.js'
  { DEFAULTS } from './constants.js'

This module renders a single frame of a scene onto an OffscreenCanvas (or regular Canvas).

Export these functions:

renderFrame(ctx, imageBitmap, scene, frameIndex, totalFrames, brandKit)
  - ctx: CanvasRenderingContext2D
  - imageBitmap: the full-page screenshot as ImageBitmap
  - scene: Scene object
  - frameIndex / totalFrames: for computing t = frameIndex/totalFrames
  - brandKit: BrandKit
  Steps:
    1. Get preset via getPresetById(scene.presetId)
    2. Compute t from frameIndex/totalFrames
    3. Get interpolated keyframe from preset's keyframes
    4. computeTransform() to get {translateX, translateY, scale}
    5. ctx.save() → apply transform → drawImage(imageBitmap) → ctx.restore()
    6. Call appropriate overlay renderer based on keyframe.overlayType
    7. If brandKit.watermark, draw watermark text in bottom corner

renderHighlightOverlay(ctx, scene, progress, color)
  - Draws a semi-transparent colored rectangle that sweeps left to right
  - progress 0→1 controls how far the sweep has gone
  - Rectangle clips to scene.coordinates region on canvas

renderSpotlightOverlay(ctx, scene, progress, canvasWidth, canvasHeight)
  - Fills full canvas with rgba(0,0,0,opacity) where opacity = progress * DEFAULTS.SPOTLIGHT_OPACITY
  - Then clears (destination-out or uses clip) the selection rectangle so it stays bright

renderBoxOverlay(ctx, scene, progress, color)
  - Draws a stroked rectangle outline around the selection
  - Uses canvas stroke dashOffset animation so the box "draws itself": total dash length * (1 - progress)

renderWordByWordOverlay(ctx, scene, progress, color)
  - Divides the selection width into approximate word segments based on text word count
  - Sweeps highlight through word segments proportional to progress

renderWatermark(ctx, text, canvasWidth, canvasHeight)
  - Small, semi-transparent text in bottom-right corner
  - Font: '12px sans-serif', fillStyle: 'rgba(255,255,255,0.5)'

Export also: getCanvasDimensions(aspectRatio, resolution)
  - Returns {width, height} for the output canvas
  - '1080p' + '16:9' → 1920×1080, '2k' → 2560×1440, '4k' → 3840×2160
  - '9:16' → swap width/height, '1:1' → square at given height, '4:3' → standard 4:3

Output only the file contents, no explanation.
```

---

### ═══ PHASE 3 — Capture & Export ═══
*Depends on: Phases 0–2.*

---

#### File 9 of 23 — `lib/capture.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/capture.js only.

No direct imports (functions receive data as parameters, no chrome API calls here — 
capture is orchestrated by the service worker which calls chrome.tabs.captureVisibleTab).

This module processes raw screenshot strips into a usable ImageBitmap.

Export these async functions:

stitchStrips(strips, pageWidth, pageHeight, devicePixelRatio)
  - strips: array of base64 PNG strings (sequential viewport screenshots from top to bottom)
  - pageWidth, pageHeight: full document dimensions in CSS px
  - devicePixelRatio: from the capturing tab
  - Creates an OffscreenCanvas of pageWidth * devicePixelRatio × pageHeight * devicePixelRatio
  - Draws each strip at the correct y-offset (strip index × viewportHeight × devicePixelRatio)
  - Returns: Promise<ImageBitmap>

base64ToImageBitmap(base64Png)
  - Converts a base64 PNG string to ImageBitmap
  - Returns: Promise<ImageBitmap>

calculateStripOffsets(pageHeight, viewportHeight)
  - Returns array of scrollY values to capture the full page
  - Last strip may overlap — that is acceptable
  - Returns: number[]

Output only the file contents, no explanation.
```

---

#### File 10 of 23 — `lib/export.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build lib/export.js only.

No imports needed. Pure browser API wrappers.

Export these functions:

startRecording(canvas, mimeType)
  - canvas: HTMLCanvasElement or OffscreenCanvas
  - mimeType: 'video/mp4' or 'video/webm;codecs=vp9'
  - Calls canvas.captureStream(30)
  - Creates MediaRecorder with given mimeType (fallback to 'video/webm' if not supported)
  - Starts recording, collects chunks via ondataavailable
  - Returns the MediaRecorder instance

stopRecording(mediaRecorder)
  - Calls mediaRecorder.stop()
  - Returns Promise<Blob> — resolves when onstop fires with collected chunks

downloadBlob(blob, filename)
  - Creates object URL, creates <a> tag, triggers download, revokes URL

generateSrtContent(scenes)
  - Takes Scene[] where each scene has .text and .duration
  - Returns SRT format string with correct timestamps derived from scene durations
  - Scene index starts at 1 per SRT spec

exportGif(frames, canvasWidth, canvasHeight, fps)
  - frames: array of ImageData objects
  - Uses a simple color-quantized GIF encoder (implement a minimal one inline — 
    no external libraries, just enough for basic animated GIF output)
  - Returns: Promise<Blob>

getSupportedMimeType()
  - Checks MediaRecorder.isTypeSupported for mp4, then webm/vp9, then webm
  - Returns the first supported mime type string

Output only the file contents, no explanation.
```

---

### ═══ PHASE 4 — Content Script ═══
*Content scripts are traditional JS globals — no import/export syntax.*

---

#### File 11 of 23 — `content/overlay.css`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build content/overlay.css only.

All styles must be scoped inside #broll-root to avoid conflicting with page CSS.
Use !important only where absolutely necessary for the overlay to appear above page content.

Style these elements:
  #broll-root              — position:fixed, top:0, left:0, width:100%, height:100%,
                             pointer-events:none, z-index:2147483646, overflow:hidden
  
  #broll-svg-layer         — full width/height SVG overlay, pointer-events:none
  
  .broll-selection-rect    — the highlight shown over selected text
                             fill: rgba(255,235,59,0.35), stroke: #FFEB3B, stroke-width: 2px
  
  .broll-selection-menu    — popup that appears after selection
                             position:fixed, background:#1a1a2e, color:#fff,
                             border-radius:8px, padding:8px 12px, font:13px system-ui,
                             box-shadow: 0 4px 20px rgba(0,0,0,0.4), pointer-events:all,
                             display:flex, gap:8px, align-items:center, z-index:2147483647
  
  .broll-menu-btn          — button inside popup: background:#FFEB3B, color:#1a1a2e,
                             border:none, border-radius:5px, padding:5px 10px,
                             font-size:12px, font-weight:600, cursor:pointer
  
  .broll-menu-btn:hover    — background:#FDD835
  
  .broll-menu-close        — close/dismiss button: background:transparent, color:#aaa,
                             border:none, cursor:pointer, font-size:16px, padding:2px 6px
  
  .broll-scene-badge       — small label showing scene number on saved selections
                             background:#FFEB3B, color:#1a1a2e, font:bold 11px system-ui,
                             padding:2px 6px, border-radius:4px
  
  .broll-active-mode       — body class added when selection mode is active
                             cursor: crosshair !important (on * selector inside body.broll-active-mode)

Output only CSS, no explanation.
```

---

#### File 12 of 23 — `content/overlay.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build content/overlay.js only.

This is a traditional JS file (no import/export). It defines a global window.BrollOverlay object.
All constants are hardcoded inline (do not reference other files).

Message types used (hardcoded strings — do not import from constants.js):
  'ACTIVATE_SELECTION', 'DEACTIVATE_SELECTION', 'SELECTION_READY'

window.BrollOverlay must expose:
  init()           — injects #broll-root div + SVG layer into document.body if not already present
  activate()       — adds 'broll-active-mode' to document.body, enables selection listeners
  deactivate()     — removes 'broll-active-mode', removes all listeners, hides popup menu
  addSceneRect(scene, sceneNumber)  — draws a persistent yellow rect + badge on saved selection
  clearSceneRects() — removes all .broll-selection-rect elements from SVG layer
  destroy()        — removes #broll-root from DOM entirely

Internally:
  - Listen to document 'mouseup' event when active
  - On mouseup: check window.getSelection(), if non-empty get the DOMRect of the range
  - Show .broll-selection-menu popup positioned above the selection
  - "Add to B-Roll" button click: collect {text, rect, scrollY, pageWidth, pageHeight,
    viewportWidth, viewportHeight} and send chrome.runtime.sendMessage({type:'SELECTION_READY', data: {...}})
  - Close button dismisses popup without saving
  - All DOM manipulation uses vanilla JS only
  - Popup should reposition if it would go off-screen

Do not call chrome.storage, do not import anything, do not use fetch.
Output only the file contents, no explanation.
```

---

#### File 13 of 23 — `content/content.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build content/content.js only.

Traditional JS global, no imports. Assumes window.BrollOverlay is already defined
(overlay.js loads before content.js per manifest content_scripts order).

Message types handled (hardcoded strings):
  ACTIVATE_SELECTION    — calls BrollOverlay.activate()
  DEACTIVATE_SELECTION  — calls BrollOverlay.deactivate()
  GET_PAGE_DIMENSIONS   — responds with {pageWidth, pageHeight, scrollHeight, viewportWidth, viewportHeight}
  SCROLL_TAB            — scrolls window to payload.y, sends back 'SCROLL_COMPLETE'
  REDRAW_SCENE_RECTS    — calls BrollOverlay.clearSceneRects() then addSceneRect() for each scene in payload

On script load:
  - Call BrollOverlay.init() to inject the overlay root
  - Set up chrome.runtime.onMessage listener for the above message types
  - Handle any chrome.runtime errors gracefully (extension context invalidated)

chrome.runtime.onMessage listener must return true for async responses where needed.
Output only the file contents, no explanation.
```

---

### ═══ PHASE 5 — Offscreen Renderer ═══
*The hidden canvas context that does all heavy work.*

---

#### File 14 of 23 — `offscreen/offscreen.html`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build offscreen/offscreen.html only.

Requirements:
- Minimal HTML5 boilerplate
- A single <canvas id="render-canvas"> element, hidden with display:none
- Script imports (in order, all type="module"):
    ../lib/constants.js
    ../lib/types.js
    ../lib/animation-engine.js
    ../lib/presets.js
    ../lib/canvas-compositor.js
    ../lib/capture.js
    ../lib/export.js
    ./offscreen.js
- No visible UI elements
- No CSS beyond body { margin:0; }
Output only the HTML, no explanation.
```

---

#### File 15 of 23 — `offscreen/offscreen.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build offscreen/offscreen.js only.

Imports:
  { MSG, DEFAULTS, FORMAT } from '../lib/constants.js'
  { stitchStrips } from '../lib/capture.js'
  { renderFrame, getCanvasDimensions } from '../lib/canvas-compositor.js'
  { startRecording, stopRecording, downloadBlob, generateSrtContent,
    getSupportedMimeType } from '../lib/export.js'

This document receives a RENDER_VIDEO message from the service worker
and performs the full render pipeline.

chrome.runtime.onMessage listener handles RENDER_VIDEO:
  payload is RenderJob: { scenes, strips, brandKit, fps, license }

  Render pipeline:
  1. Get canvas dimensions from getCanvasDimensions(brandKit.aspectRatio, brandKit.resolution)
  2. Set canvas.width / canvas.height
  3. Stitch strips into one ImageBitmap via stitchStrips(strips, pageWidth, pageHeight, dpr)
     (pageWidth/pageHeight come from strips metadata — attach them to the RenderJob)
  4. For each scene in order:
     a. Calculate totalFrames = Math.ceil(scene.duration * fps)
     b. For each frame 0..totalFrames-1:
        - Call renderFrame(ctx, imageBitmap, scene, frameIndex, totalFrames, brandKit)
  5. Use MediaRecorder approach: startRecording(canvas, mimeType) before the loop,
     let canvas stream capture each frame as they render
     (use requestAnimationFrame-like approach with setTimeout(0) between frames
     to allow the stream to capture each frame)
  6. After all scenes rendered: stopRecording() → Blob
  7. Convert Blob to object URL
  8. Send RENDER_COMPLETE message with { blobUrl }
  9. Send RENDER_PROGRESS messages periodically (after each scene: percent = sceneIndex/scenes.length)

Error handling: wrap entire pipeline in try/catch, send RENDER_ERROR on failure.
Free tier: if license.tier === 'free', draw watermark on every frame regardless of brandKit.watermark setting.

Output only the file contents, no explanation.
```

---

### ═══ PHASE 6 — Background Service Worker ═══
*The message bus. All inter-layer communication routes through here.*

---

#### File 16 of 23 — `background/service-worker.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build background/service-worker.js only.

This is an ES module (type: module in manifest).

Imports:
  { MSG, STORAGE, DEFAULTS } from '../lib/constants.js'
  { getLicense, saveLicense, incrementExportCount } from '../lib/storage.js'
  { activateKey, canExport, getCachedTier } from '../lib/license.js'

Responsibilities:

1. EXTENSION ICON CLICK → open side panel:
   chrome.action.onClicked.addListener(tab => chrome.sidePanel.open({ tabId: tab.id }))

2. FULL PAGE CAPTURE (called when user clicks Export in side panel):
   Exported async function captureFullPage(tabId):
   - Send GET_PAGE_DIMENSIONS to content script, await response
   - Use calculateStripOffsets(scrollHeight, viewportHeight) 
     (inline this simple helper: return array of y values, step = viewportHeight * 0.9)
   - For each scrollY in offsets:
       a. Send SCROLL_TAB to content script, await SCROLL_COMPLETE
       b. Wait 300ms for page to settle
       c. Call chrome.tabs.captureVisibleTab(null, { format:'png' }) → base64 strip
   - Restore original scroll position
   - Return { strips: string[], pageWidth, pageHeight, devicePixelRatio }

3. OFFSCREEN DOCUMENT MANAGEMENT:
   - Before sending RENDER_VIDEO, ensure offscreen doc exists:
     Check chrome.offscreen.hasDocument(), if not: create via chrome.offscreen.createDocument()
     url: chrome.runtime.getURL('offscreen/offscreen.html')
     reasons: ['DISPLAY_MEDIA']  (use 'BLOBS' if DISPLAY_MEDIA fails)
     justification: 'Rendering video frames to canvas'
   - After render completes, close offscreen document

4. MESSAGE ROUTER (chrome.runtime.onMessage):
   ACTIVATE_SELECTION    → forward to content script of current active tab
   DEACTIVATE_SELECTION  → forward to content script
   SELECTION_READY       → forward to side panel (sendMessage to extension)
   RENDER_VIDEO          → run captureFullPage, attach strips to job, forward to offscreen
   RENDER_PROGRESS       → forward to side panel
   RENDER_COMPLETE       → increment export count, forward to side panel
   LICENSE_ACTIVATE      → call activateKey(payload.key), respond with LicenseState
   LICENSE_STATUS        → respond with current LicenseState from getCachedTier()

5. All chrome.runtime.sendMessage calls to content scripts must target the correct tabId.
   Store activeTabId on chrome.tabs.onActivated listener.

Handle all chrome.runtime.lastError checks to avoid unhandled promise rejections.
Output only the file contents, no explanation.
```

---

### ═══ PHASE 7 — Side Panel UI ═══
*The most complex file. Build HTML → CSS → JS in order.*

---

#### File 17 of 23 — `sidepanel/sidepanel.html`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build sidepanel/sidepanel.html only.

Structure (all IDs are referenced by sidepanel.js — do not change them):

<div id="app">
  <header id="header">
    <div id="logo">B-Roll Studio</div>
    <div id="tier-badge">FREE</div>
  </header>

  <div id="toolbar">
    <button id="btn-activate">Capture Selection</button>
    <button id="btn-region" title="Select region">⬚</button>
    <button id="btn-clear-scenes">Clear All</button>
  </div>

  <div id="scene-queue">
    <!-- .scene-card elements injected here by sidepanel.js -->
    <div id="scene-empty-state">No scenes yet. Activate capture and select text on any webpage.</div>
  </div>

  <div id="timeline">
    <!-- .timeline-block elements injected here by sidepanel.js -->
  </div>

  <section id="style-studio">
    <h3>Style Studio</h3>
    <div id="preset-grid">
      <!-- .preset-thumb elements injected by sidepanel.js -->
    </div>
    <label>Duration <input type="range" id="duration-slider" min="1" max="30" value="4"> <span id="duration-val">4s</span></label>
    <label>Highlight <input type="color" id="color-highlight" value="#FFEB3B"></label>
    <label>Box Color  <input type="color" id="color-box"       value="#FF5252"></label>
    <label>Transition
      <select id="transition-select">
        <option value="dissolve">Dissolve</option>
        <option value="cut">Cut</option>
        <option value="flash">Flash</option>
      </select>
    </label>
  </section>

  <section id="brand-kit">
    <h3>Brand Kit</h3>
    <label>Aspect Ratio
      <select id="aspect-ratio">
        <option value="16:9">16:9 YouTube</option>
        <option value="9:16">9:16 Shorts/TikTok</option>
        <option value="1:1">1:1 Square</option>
        <option value="4:3">4:3 Classic</option>
      </select>
    </label>
    <label>Resolution
      <select id="resolution">
        <option value="1080p">1080p (Free)</option>
        <option value="2k" class="pro-only">2K (Pro)</option>
        <option value="4k" class="pro-only">4K (Pro)</option>
      </select>
    </label>
    <label>Logo <input type="file" id="logo-upload" accept="image/png,image/svg+xml"></label>
    <label>Watermark <input type="checkbox" id="watermark-toggle" checked></label>
    <label>Export Format
      <select id="export-format">
        <option value="mp4">MP4</option>
        <option value="webm">WebM</option>
        <option value="gif" class="pro-only">GIF (Pro)</option>
        <option value="png_sequence" class="pro-only">PNG Sequence (Pro)</option>
      </select>
    </label>
  </section>

  <div id="export-section">
    <div id="export-counter">5 free exports remaining this month</div>
    <button id="btn-export">Export Video</button>
    <progress id="export-progress" value="0" max="100" style="display:none"></progress>
  </div>

  <section id="license-section">
    <h3>Unlock Pro</h3>
    <p>One-time purchase. Unlimited exports, 4K, no watermark.</p>
    <input type="text" id="license-key-input" placeholder="Enter license key">
    <button id="btn-activate-license">Activate</button>
    <div id="license-status"></div>
  </section>

  <section id="projects-section">
    <h3>Projects</h3>
    <button id="btn-save-project">Save Current Project</button>
    <div id="project-list"></div>
  </section>
</div>

<link rel="stylesheet" href="sidepanel.css">
<script type="module" src="sidepanel.js"></script>
Output only the HTML, no explanation.
```

---

#### File 18 of 23 — `sidepanel/sidepanel.css`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build sidepanel/sidepanel.css only.

Design direction: Dark studio aesthetic. Near-black background (#0d0d14), 
accent yellow (#FFEB3B), secondary red (#FF5252). Compact — this is a 380px wide panel.
System font stack. No external font imports. Minimal but polished.

Style all IDs and classes from sidepanel.html:

Body/Root:
  body: margin:0, background:#0d0d14, color:#e0e0e0, font: 13px/1.5 system-ui, overflow-x:hidden

#app: display:flex, flex-direction:column, height:100vh, gap:0

#header: padding:12px 16px, background:#16162a, display:flex, align-items:center,
  justify-content:space-between, border-bottom: 1px solid #2a2a42
#logo: font-weight:700, font-size:15px, color:#FFEB3B, letter-spacing:-0.3px
#tier-badge: font-size:10px, background:#2a2a42, color:#aaa, padding:2px 7px,
  border-radius:10px, font-weight:600

#toolbar: padding:10px 16px, display:flex, gap:8px, background:#0d0d14

#btn-activate: flex:1, background:#FFEB3B, color:#1a1a2e, border:none,
  border-radius:6px, padding:8px, font-weight:700, cursor:pointer, font-size:12px
#btn-activate.active: background:#FF5252, color:#fff (when selection mode is on)
#btn-region, #btn-clear-scenes: background:#1e1e30, color:#aaa, border: 1px solid #2a2a42,
  border-radius:6px, padding:8px, cursor:pointer

#scene-queue: flex:1, overflow-y:auto, padding:8px 16px, min-height:80px, max-height:220px

.scene-card: background:#16162a, border-radius:8px, padding:10px, margin-bottom:8px,
  border: 1px solid #2a2a42, cursor:pointer, position:relative
.scene-card.selected: border-color:#FFEB3B
.scene-card-title: font-size:11px, font-weight:600, color:#FFEB3B, margin-bottom:3px
.scene-card-text: font-size:11px, color:#888, white-space:nowrap, overflow:hidden,
  text-overflow:ellipsis, max-width:270px
.scene-card-preset: font-size:10px, color:#555, margin-top:4px
.scene-card-delete: position:absolute, top:6px, right:8px, background:transparent,
  border:none, color:#444, cursor:pointer, font-size:14px
.scene-card-delete:hover: color:#FF5252

#scene-empty-state: color:#444, font-size:12px, text-align:center, padding:20px 0

#timeline: height:48px, background:#0a0a12, border-top:1px solid #1e1e30,
  border-bottom:1px solid #1e1e30, display:flex, align-items:center,
  padding:0 16px, gap:4px, overflow-x:auto

.timeline-block: height:32px, min-width:40px, background:#1e1e30, border-radius:4px,
  border: 1px solid #2a2a42, display:flex, align-items:center, justify-content:center,
  font-size:10px, color:#666, cursor:pointer, flex-shrink:0
.timeline-block.selected: background:#FFEB3B22, border-color:#FFEB3B, color:#FFEB3B

#style-studio, #brand-kit, #license-section, #projects-section:
  padding:12px 16px, border-top: 1px solid #1e1e30
  h3: font-size:11px, font-weight:700, color:#FFEB3B, text-transform:uppercase,
      letter-spacing:0.8px, margin:0 0 10px

label: display:flex, align-items:center, justify-content:space-between,
  font-size:11px, color:#888, margin-bottom:8px
input[type=range]: width:100px, accent-color:#FFEB3B
input[type=color]: width:32px, height:24px, border:none, border-radius:4px, cursor:pointer, background:none
select: background:#1e1e30, color:#e0e0e0, border: 1px solid #2a2a42,
  border-radius:5px, padding:3px 6px, font-size:11px

#preset-grid: display:grid, grid-template-columns:repeat(3,1fr), gap:6px, margin-bottom:10px
.preset-thumb: background:#1e1e30, border: 1px solid #2a2a42, border-radius:6px,
  padding:8px 4px, text-align:center, cursor:pointer, font-size:10px, color:#888
.preset-thumb.selected: border-color:#FFEB3B, color:#FFEB3B, background:#FFEB3B11
.preset-thumb.locked: opacity:0.4, cursor:not-allowed
.preset-thumb .lock-icon: font-size:8px, display:block, color:#555

#export-section: padding:12px 16px, border-top:1px solid #1e1e30
#export-counter: font-size:10px, color:#555, margin-bottom:8px
#btn-export: width:100%, background:#FF5252, color:#fff, border:none,
  border-radius:7px, padding:10px, font-weight:700, font-size:13px, cursor:pointer
#btn-export:disabled: opacity:0.4, cursor:not-allowed
#export-progress: width:100%, margin-top:8px, accent-color:#FFEB3B

#license-key-input: width:100%, background:#1e1e30, border:1px solid #2a2a42,
  border-radius:5px, padding:6px 10px, color:#e0e0e0, font-size:12px,
  box-sizing:border-box, margin-bottom:6px
#btn-activate-license: width:100%, background:#2a2a42, color:#FFEB3B,
  border:none, border-radius:5px, padding:7px, font-weight:600, cursor:pointer
#license-status: font-size:11px, margin-top:6px, color:#FFEB3B

.pro-only-label: color:#FFEB3B, font-size:9px, margin-left:4px
#btn-save-project: background:#1e1e30, color:#aaa, border:1px solid #2a2a42,
  border-radius:5px, padding:5px 10px, cursor:pointer, font-size:11px, margin-bottom:8px
.project-item: display:flex, justify-content:space-between, align-items:center,
  padding:6px 0, border-bottom:1px solid #1a1a28, font-size:11px

Output only CSS, no explanation.
```

---

#### File 19 of 23 — `sidepanel/sidepanel.js`

```
You are building a Chrome extension called "B-Roll Studio".
The attached document is the full architecture. Build sidepanel/sidepanel.js only.
This is the most complex file. Read the entire architecture document carefully before writing.

Imports:
  { MSG, PRESET, DEFAULTS, TIER, FORMAT } from '../lib/constants.js'
  { getScenes, saveScenes, clearScenes, getBrandKit, saveBrandKit,
    getLicense, getProjects, saveProject, deleteProject, getExportCount } from '../lib/storage.js'
  { isFreeUser, canExport, getRemainingFreeExports } from '../lib/license.js'
  { PRESETS } from '../lib/presets.js'

State variables (module-level, not global):
  let scenes = []          // Scene[]
  let brandKit = {}        // BrandKit
  let selectedSceneId = null
  let isCapturing = false
  let licenseState = {}    // LicenseState

On DOMContentLoaded:
  1. Load scenes from storage → render scene queue
  2. Load brandKit from storage → populate brand kit form fields
  3. Load license from storage → update tier badge, lock pro-only presets/options
  4. Load export count → update export counter text
  5. Render preset grid from PRESETS array
  6. Set up all event listeners

Event listeners:
  #btn-activate click:
    - Toggle isCapturing
    - If activating: send ACTIVATE_SELECTION to background, button turns red "Stop Capturing"
    - If deactivating: send DEACTIVATE_SELECTION to background, button returns to normal
  
  #btn-clear-scenes click: call clearScenes(), scenes=[], re-render queue
  
  #duration-slider input: update #duration-val text, update selectedScene.duration, save
  
  #color-highlight / #color-box change: update selectedScene colors, save
  
  #transition-select change: update selectedScene transition, save
  
  #aspect-ratio / #resolution / #export-format change: update brandKit, save
  
  #logo-upload change: read file as base64 DataURL, set brandKit.logoDataUrl, save
  
  #watermark-toggle change: update brandKit.watermark (free tier: always force to true)
  
  #btn-export click:
    - Check canExport() — if false, show alert with remaining count
    - Send RENDER_VIDEO to background with { scenes, brandKit, license: licenseState }
    - Disable export button, show progress bar
  
  #btn-activate-license click:
    - Send LICENSE_ACTIVATE with { key: input value }
    - On success: update tier badge, unlock pro options
  
  #btn-save-project click: save current scenes+brandKit as new Project, reload project list

  chrome.runtime.onMessage:
    SELECTION_READY  → add scene to queue (build Scene object from payload), save, re-render, 
                       send REDRAW_SCENE_RECTS to content script with all scenes
    RENDER_PROGRESS  → update progress bar value
    RENDER_COMPLETE  → re-enable export button, hide progress bar, 
                       trigger chrome.downloads.download with the blobUrl
    RENDER_ERROR     → re-enable button, show error message

Functions:

renderSceneQueue()
  - Clear #scene-queue innerHTML (preserve empty state div)
  - For each scene: create .scene-card div with title (Scene N), truncated text,
    preset name, delete button
  - Clicking card: set selectedSceneId, add .selected class, populate style controls
  - Delete button: removes scene from array, saves, re-renders

renderTimeline()
  - Clear #timeline
  - For each scene: create .timeline-block with width proportional to duration (min 40px)
  - Click → select that scene

renderPresetGrid(selectedPresetId, isFree)
  - Clear #preset-grid
  - For each preset in PRESETS: create .preset-thumb
  - Mark locked if preset.proOnly && isFree
  - Mark selected if preset.id === selectedPresetId
  - Click: if locked show "Upgrade to Pro" alert, else update scene.presetId, save, re-render

populateStyleControls(scene)
  - Set duration slider, color pickers, transition select to scene's current values

buildScene(selectionData)
  - Creates a full Scene object from the raw selection data received from content script
  - Generates UUID for id, sets defaults for preset, duration, colors, transition
  - Returns the Scene object

Output only the file contents, no explanation.
```

---

### ═══ PHASE 8 — Popup ═══

---

#### File 20 of 23 — `popup/popup.html`

```
You are building a Chrome extension called "B-Roll Studio".
Build popup/popup.html — the small popup that appears if the user clicks the extension
icon on a page where the side panel is already open (fallback UI).

Content:
- Extension name header
- Current tab URL (truncated) shown in a code-like element
- One button: "Open B-Roll Panel" (id="btn-open-panel")
- License status line (id="license-line") showing "Free" or "Pro ✓"
- Small footer: "brollstudio.com"

Style: dark theme matching sidepanel.css, width:280px, inline <style> tag.
Script: <script src="popup.js"></script>
Output only HTML, no explanation.
```

---

#### File 21 of 23 — `popup/popup.css`

```
You are building a Chrome extension called "B-Roll Studio".
Build popup/popup.css — minimal dark styles for the popup.
Width: 280px. Same color tokens as sidepanel (#0d0d14, #FFEB3B, #FF5252).
Style: body, header, #btn-open-panel, #license-line, footer.
Output only CSS, no explanation.
```

---

#### File 22 of 23 — `popup/popup.js`

```
You are building a Chrome extension called "B-Roll Studio".
Build popup/popup.js — traditional script (no imports).

On load:
1. Display current tab URL in the URL element (chrome.tabs.query {active:true})
2. Send LICENSE_STATUS message to background, display tier in #license-line
3. #btn-open-panel click → chrome.sidePanel.open({ tabId }) → window.close()

All chrome API calls wrapped in try/catch.
Output only JS, no explanation.
```

---

### ═══ PHASE 9 — Cloudflare Worker ═══
*Deploy separately at cloudflare.com/workers — free tier.*

---

#### File 23 of 23 — `cloudflare-worker/worker.js`

```
You are building a Cloudflare Worker for "B-Roll Studio" Chrome Extension.
The attached document is the full architecture. Build cloudflare-worker/worker.js only.

This Worker validates license keys. It has NO database — validity is encoded in the key.

License key format: `BROLL-{BASE64_PAYLOAD}-{SIGNATURE}`
where PAYLOAD = base64(JSON.stringify({ tier:'pro', exp: <UTC ms>, uid: <uuid> }))
and SIGNATURE = first 8 chars of HMAC-SHA256(PAYLOAD, SECRET_KEY)

The SECRET_KEY is set as a Cloudflare environment variable named LICENSE_SECRET.

Handle POST /validate:
  - Parse request body as JSON, extract { key }
  - Split key into [prefix, payload, sig] by '-'
  - Verify prefix === 'BROLL'
  - Decode payload from base64, parse JSON
  - Recompute HMAC-SHA256(payload, LICENSE_SECRET) using crypto.subtle
  - Compare first 8 chars of computed hash with sig (constant-time comparison)
  - If valid AND parsed.exp > Date.now(): respond { valid:true, tier:parsed.tier, exp:parsed.exp }
  - If invalid or expired: respond { valid:false }

Handle OPTIONS (CORS preflight):
  - Allow-Origin: * (Chrome extensions need this)
  - Allow-Methods: POST, OPTIONS
  - Allow-Headers: Content-Type

Add CORS headers to all responses.
Use only Web Crypto API (crypto.subtle) — available in Cloudflare Workers natively.
Output only the Worker JS, no explanation.

Also write a brief README comment at the top of the file explaining:
- How to generate valid license keys (a simple Node.js snippet using the same algorithm)
- How to deploy: `npx wrangler deploy`
- How to set the secret: `npx wrangler secret put LICENSE_SECRET`
```

---

## Part 5 — Test Checkpoints

After each phase, verify in Chrome before continuing.

**After Phase 0:**
- Load extension in chrome://extensions (Developer Mode → Load Unpacked)
- Should load without errors in the Extensions panel

**After Phase 4:**
- Open any webpage, click extension icon → side panel should open
- Click "Capture Selection" → cursor should change to crosshair on the page
- Select text → yellow popup menu should appear above selection

**After Phase 6:**
- Select text and click "Add to B-Roll" → scene should appear in the side panel queue
- Multiple scenes from different tabs should accumulate

**After Phase 7:**
- All style controls should respond and update the selected scene
- Export button should appear (may fail at render — that's okay, offscreen comes next)

**After Phase 5 (Offscreen — build after Phase 7):**
- Full export pipeline should work end-to-end
- Video file should download to computer

**After Phase 9:**
- Deploy worker, update DEFAULTS.CLOUDFLARE_WORKER_URL in constants.js
- Enter a test key → should receive Pro tier response

---

## Part 6 — Verified Contracts

*Fill this section after each file is built and verified. Paste real exports here.
On each new prompt, this section tells the AI exactly what previous files exported.*

```
lib/constants.js     → [fill after building]
lib/types.js         → [fill after building]
lib/storage.js       → [fill after building]
lib/license.js       → [fill after building]
lib/presets.js       → [fill after building]
lib/animation-engine.js  → [fill after building]
lib/canvas-compositor.js → [fill after building]
lib/capture.js       → [fill after building]
lib/export.js        → [fill after building]
```
