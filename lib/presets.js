import { PRESET } from './constants.js';

/** @type {import('./types.js').Keyframe} */

const PRESETS = [
  {
    id: PRESET.HIGHLIGHT_ZOOM,
    name: 'Highlight Zoom',
    description: 'Wide view zooms to target, highlight sweeps left-to-right',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.6;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'highlight', overlayProgress: 0 },
        { time: 1, scale: zoomLevel, overlayType: 'highlight', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.SPOTLIGHT,
    name: 'Spotlight',
    description: 'Zoom to target, darken surroundings, spotlight holds',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.5;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);
      const midpoint = (holdT + 1) / 2;

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'spotlight', overlayProgress: 0 },
        { time: midpoint, scale: zoomLevel, overlayType: 'spotlight', overlayProgress: 1 },
        { time: 1, scale: zoomLevel, overlayType: 'spotlight', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.BOX_CALLOUT,
    name: 'Box Callout',
    description: 'Zoom to target, box draws itself around selection',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.4;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);
      const midpoint = holdT + (1 - holdT) * 0.6;

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'box', overlayProgress: 0 },
        { time: midpoint, scale: zoomLevel, overlayType: 'box', overlayProgress: 1 },
        { time: 1, scale: zoomLevel, overlayType: 'box', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.HEADLINE_REVEAL,
    name: 'Headline Reveal',
    description: 'Extreme zoom on title, glint sweeps across text',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 2.5;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);
      const midpoint = holdT + (1 - holdT) * 0.8;

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'highlight', overlayProgress: 0 },
        { time: midpoint, scale: zoomLevel, overlayType: 'highlight', overlayProgress: 1 },
        { time: 1, scale: zoomLevel, overlayType: 'highlight', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.WORD_BY_WORD,
    name: 'Word by Word',
    description: 'Zoom in, word-by-word highlight progresses with time',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.4;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);
      const endT = holdT + (1 - holdT) * 0.9;

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'word', overlayProgress: 0 },
        { time: endT, scale: zoomLevel, overlayType: 'word', overlayProgress: 1 },
        { time: 1, scale: zoomLevel, overlayType: 'word', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.SCROLL_JOURNEY,
    name: 'Scroll Journey',
    description: 'Camera starts at page top, scrolls down to target',
    proOnly: false,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const targetCenterX = coordinates.x + coordinates.width / 2;
      const targetCenterY = coordinates.y + coordinates.height / 2;
      const camX = cw / 2 - targetCenterX;
      const pageHeight = coordinates.pageHeight || ch;
      const startY = 0;
      const endY = Math.min(0, Math.max(ch - pageHeight, ch / 2 - targetCenterY));
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const d = duration || 4;
      const startDelayT = Math.min(0.8, startDelay / d);
      return [
        { time: 0, x: camX, y: startY, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, x: camX, y: startY, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 1, x: camX, y: endY, scale: 1.0, overlayType: 'none', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.MAGNIFIER,
    name: 'Magnifier',
    description: 'Camera on target, circular magnifier lens moves across text',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.6;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'magnifier', overlayProgress: 0 },
        { time: 1, scale: zoomLevel, overlayType: 'magnifier', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.REDLINE,
    name: 'Redline',
    description: 'Zoom to target, strikethrough animation then fade in new text',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.4;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'redline', overlayProgress: 0 },
        { time: 1, scale: zoomLevel, overlayType: 'redline', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.POINTER_TOUR,
    name: 'Pointer Tour',
    description: 'Camera pans to target, animated cursor moves to selection',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const zoomLevel = (scene && typeof scene.zoomLevel === 'number') ? scene.zoomLevel : 1.2;
      const zoomDuration = (scene && typeof scene.zoomDuration === 'number') ? scene.zoomDuration : 1.5;
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const highlightDelay = (scene && typeof scene.highlightDelay === 'number') ? scene.highlightDelay : 0.5;
      const d = duration || 4;

      const startDelayT = Math.min(0.8, startDelay / d);
      const zoomEndT = Math.min(0.9, startDelayT + zoomDuration / d);
      const holdT = Math.min(0.95, zoomEndT + highlightDelay / d);

      return [
        { time: 0, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: zoomEndT, scale: zoomLevel, overlayType: 'none', overlayProgress: 0 },
        { time: holdT, scale: zoomLevel, overlayType: 'pointer', overlayProgress: 0 },
        { time: 1, scale: zoomLevel, overlayType: 'pointer', overlayProgress: 1 },
      ];
    },
  },
  {
    id: PRESET.AUTO_SCROLL,
    name: 'Auto Scroll',
    description: 'Camera scrolls continuously through target region',
    proOnly: true,
    getKeyframes(coordinates, cw, ch, duration, scene) {
      const targetCenterX = coordinates.x + coordinates.width / 2;
      const targetCenterY = coordinates.y + coordinates.height / 2;
      const camX = cw / 2 - targetCenterX;
      const pageHeight = coordinates.pageHeight || ch;
      const centerY = ch / 2 - targetCenterY;
      const resolutionScale = ch / 1080;
      const offset = 150 * resolutionScale;
      const startY = Math.min(0, Math.max(ch - pageHeight, centerY + offset));
      const endY = Math.min(0, Math.max(ch - pageHeight, centerY - offset));
      const startDelay = (scene && typeof scene.startDelay === 'number') ? scene.startDelay : 0.0;
      const d = duration || 4;
      const startDelayT = Math.min(0.8, startDelay / d);
      return [
        { time: 0, x: camX, y: startY, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: startDelayT, x: camX, y: startY, scale: 1.0, overlayType: 'none', overlayProgress: 0 },
        { time: 1, x: camX, y: endY, scale: 1.0, overlayType: 'none', overlayProgress: 1 },
      ];
    },
  },
];

export { PRESETS };

export function getPresetById(id) {
  return PRESETS.find(p => p.id === id) || PRESETS[0];
}
