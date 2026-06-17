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
 * @property {number}      pauseDuration  - seconds (0-10)
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
 * @property {number}      videoEndDelay   - seconds (0-10)
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

export default {};
