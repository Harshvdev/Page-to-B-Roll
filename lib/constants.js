/** All message type strings for chrome.runtime.sendMessage */
export const MSG = {
  ACTIVATE_SELECTION: 'ACTIVATE_SELECTION',
  DEACTIVATE_SELECTION: 'DEACTIVATE_SELECTION',
  SELECTION_READY: 'SELECTION_READY',
  GET_PAGE_DIMENSIONS: 'GET_PAGE_DIMENSIONS',
  PAGE_DIMENSIONS_RESULT: 'PAGE_DIMENSIONS_RESULT',
  CAPTURE_VIEWPORT: 'CAPTURE_VIEWPORT',
  SCROLL_TAB: 'SCROLL_TAB',
  FULL_PAGE_READY: 'FULL_PAGE_READY',
  RENDER_VIDEO: 'RENDER_VIDEO',
  RENDER_PROGRESS: 'RENDER_PROGRESS',
  RENDER_COMPLETE: 'RENDER_COMPLETE',
  RENDER_ERROR: 'RENDER_ERROR',
  LICENSE_ACTIVATE: 'LICENSE_ACTIVATE',
  LICENSE_STATUS: 'LICENSE_STATUS',
  START_RENDER: 'START_RENDER',
};

/** Storage keys used with chrome.storage.local */
export const STORAGE = {
  SCENES: 'broll_scenes',
  BRAND_KIT: 'broll_brand_kit',
  LICENSE: 'broll_license',
  PROJECTS: 'broll_projects',
  EXPORT_COUNT: 'broll_export_count',
  EXPORT_MONTH: 'broll_export_month',
  CAPTURING: 'broll_capturing_active',
  EXPORT_ACTIVE: 'broll_export_active',
  EXPORT_PROGRESS: 'broll_export_progress',
  EXPORT_STATUS: 'broll_export_status',
};

/** Preset identifier constants */
export const PRESET = {
  HIGHLIGHT_ZOOM: 'highlight_zoom',
  SPOTLIGHT: 'spotlight',
  BOX_CALLOUT: 'box_callout',
  HEADLINE_REVEAL: 'headline_reveal',
  WORD_BY_WORD: 'word_by_word',
  SCROLL_JOURNEY: 'scroll_journey',
  MAGNIFIER: 'magnifier',
  REDLINE: 'redline',
  POINTER_TOUR: 'pointer_tour',
  AUTO_SCROLL: 'auto_scroll',
};

/** License tier strings */
export const TIER = {
  FREE: 'free',
  PRO: 'pro',
};

/** Export format strings */
export const FORMAT = {
  MP4: 'mp4',
  WEBM: 'webm',
  GIF: 'gif',
  PNG_SEQUENCE: 'png_sequence',
};

/** Aspect ratio strings */
export const RATIO = {
  SIXTEEN_NINE: '16:9',
  NINE_SIXTEEN: '9:16',
  ONE_ONE: '1:1',
  FOUR_THREE: '4:3',
};

/** Default values used across the extension */
export const DEFAULTS = {
  FPS: 30,
  SCENE_DURATION: 4,
  HIGHLIGHT_COLOR: '#FFEB3B',
  BOX_COLOR: '#FF5252',
  SPOTLIGHT_OPACITY: 0.6,
  FREE_EXPORTS_MONTHLY: 5,
  PRO_PRESETS: ['magnifier', 'redline', 'pointer_tour', 'auto_scroll'],
  WATERMARK_TEXT: 'brollstudio.com',
  LICENSE_JWT_TTL: 604800000,
  CLOUDFLARE_WORKER_URL: 'https://broll-license.YOUR_SUBDOMAIN.workers.dev',
};
