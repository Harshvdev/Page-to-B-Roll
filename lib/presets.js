import { PRESET, DEFAULTS } from './constants.js';

/** @type {import('./types.js').Keyframe} */

const PRESETS = [
  {
    id: PRESET.HIGHLIGHT_ZOOM,
    name: 'Highlight Zoom',
    description: 'Wide view zooms to target, highlight sweeps left-to-right',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 0.4, scale: 1.6, overlayType: 'none', overlayProgress: 0 },
        { time: 0.5, scale: 1.6, overlayType: 'highlight', overlayProgress: 0 },
        { time: 1, scale: 1.6, overlayType: 'highlight', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.SPOTLIGHT,
    name: 'Spotlight',
    description: 'Zoom to target, darken surroundings, spotlight holds',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 0.4, scale: 1.5, overlayType: 'none', overlayProgress: 0 },
        { time: 0.5, scale: 1.5, overlayType: 'spotlight', overlayProgress: 0 },
        { time: 0.7, scale: 1.5, overlayType: 'spotlight', overlayProgress: 1 },
        { time: 1, scale: 1.5, overlayType: 'spotlight', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.BOX_CALLOUT,
    name: 'Box Callout',
    description: 'Zoom to target, box draws itself around selection',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 0.4, scale: 1.4, overlayType: 'none', overlayProgress: 0 },
        { time: 0.5, scale: 1.4, overlayType: 'box', overlayProgress: 0 },
        { time: 0.8, scale: 1.4, overlayType: 'box', overlayProgress: 1 },
        { time: 1, scale: 1.4, overlayType: 'box', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.HEADLINE_REVEAL,
    name: 'Headline Reveal',
    description: 'Extreme zoom on title, glint sweeps across text',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 2.5, overlayType: 'none', overlayProgress: 0 },
        { time: 0.3, scale: 2.5, overlayType: 'none', overlayProgress: 0 },
        { time: 0.4, scale: 2.5, overlayType: 'highlight', overlayProgress: 0 },
        { time: 0.8, scale: 2.5, overlayType: 'highlight', overlayProgress: 1 },
        { time: 1, scale: 2.5, overlayType: 'highlight', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.WORD_BY_WORD,
    name: 'Word by Word',
    description: 'Zoom in, word-by-word highlight progresses with time',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.4, overlayType: 'none', overlayProgress: 0 },
        { time: 0.2, scale: 1.4, overlayType: 'word', overlayProgress: 0 },
        { time: 0.95, scale: 1.4, overlayType: 'word', overlayProgress: 1 },
        { time: 1, scale: 1.4, overlayType: 'word', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.SCROLL_JOURNEY,
    name: 'Scroll Journey',
    description: 'Camera starts at page top, scrolls down to target',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration) {
      const targetCenterX = coordinates.x + coordinates.width / 2;
      const targetCenterY = coordinates.y + coordinates.height / 2;
      const camX = cw / 2 - targetCenterX;
      const pageHeight = coordinates.pageHeight || ch;
      const startY = 0;
      const endY = Math.min(0, Math.max(ch - pageHeight, ch / 2 - targetCenterY));
      return [
        { time: 0, x: camX, y: startY, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 1, x: camX, y: endY, scale: 1.0, overlayType: 'none', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.MAGNIFIER,
    name: 'Magnifier',
    description: 'Camera on target, circular magnifier lens moves across text',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.6, overlayType: 'magnifier', overlayProgress: 0 },
        { time: 0.3, scale: 1.6, overlayType: 'magnifier', overlayProgress: 0 },
        { time: 1, scale: 1.6, overlayType: 'magnifier', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.REDLINE,
    name: 'Redline',
    description: 'Zoom to target, strikethrough animation then fade in new text',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.4, overlayType: 'redline', overlayProgress: 0 },
        { time: 0.5, scale: 1.4, overlayType: 'redline', overlayProgress: 0.5 },
        { time: 1, scale: 1.4, overlayType: 'redline', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.POINTER_TOUR,
    name: 'Pointer Tour',
    description: 'Camera pans to target, animated cursor moves to selection',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration) {
      return [
        { time: 0, scale: 1.0, overlayType: 'pointer', overlayProgress: 0 },
        { time: 0.5, scale: 1.0, overlayType: 'pointer', overlayProgress: 0.6 },
        { time: 1, scale: 1.2, overlayType: 'pointer', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.AUTO_SCROLL,
    name: 'Auto Scroll',
    description: 'Camera scrolls continuously through target region',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration) {
      const targetCenterX = coordinates.x + coordinates.width / 2;
      const targetCenterY = coordinates.y + coordinates.height / 2;
      const camX = cw / 2 - targetCenterX;
      const pageHeight = coordinates.pageHeight || ch;
      const centerY = ch / 2 - targetCenterY;
      const startY = Math.min(0, Math.max(ch - pageHeight, centerY + 150));
      const endY = Math.min(0, Math.max(ch - pageHeight, centerY - 150));
      return [
        { time: 0, x: camX, y: startY, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 1, x: camX, y: endY, scale: 1.0, overlayType: 'none', overlayProgress: 1 },
      ];
    },
  },
];

export { PRESETS };

export function getPresetById(id) {
  return PRESETS.find(p => p.id === id) || PRESETS[0];
}
