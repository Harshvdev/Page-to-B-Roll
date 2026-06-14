import { interpolateKeyframes, computeTransform, lerp, clamp } from './animation-engine.js';
import { getPresetById } from './presets.js';
import { DEFAULTS } from './constants.js';

export function getCanvasDimensions(aspectRatio, resolution) {
  const heights = { '1080p': 1080, '2k': 1440, '4k': 2160 };
  const h = heights[resolution] || 1080;
  let w = h;
  switch (aspectRatio) {
    case '16:9': w = h * 16 / 9; break;
    case '9:16': w = h * 9 / 16; break;
    case '1:1':  w = h; break;
    case '4:3':  w = h * 4 / 3; break;
    default:     w = h * 16 / 9;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

export function renderFrame(ctx, imageBitmap, scene, frameIndex, totalFrames, brandKit) {
  const { width, height } = getCanvasDimensions(brandKit.aspectRatio, brandKit.resolution);
  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;

  const preset = getPresetById(scene.presetId);
  const t = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const keyframe = interpolateKeyframes(preset.getKeyframes(scene.coordinates, width, height, scene.duration), t);
  const transform = computeTransform(scene.coordinates, keyframe, width, height);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(transform.translateX, transform.translateY);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(imageBitmap, 0, 0);
  ctx.restore();

  const overlayType = keyframe.overlayType || 'none';
  const progress = keyframe.overlayProgress || 0;

  switch (overlayType) {
    case 'highlight':
      renderHighlightOverlay(ctx, scene, progress, scene.highlightColor || DEFAULTS.HIGHLIGHT_COLOR);
      break;
    case 'spotlight':
      renderSpotlightOverlay(ctx, scene, progress, width, height);
      break;
    case 'box':
      renderBoxOverlay(ctx, scene, progress, scene.boxColor || DEFAULTS.BOX_COLOR);
      break;
    case 'word':
      renderWordByWordOverlay(ctx, scene, progress, scene.highlightColor || DEFAULTS.HIGHLIGHT_COLOR);
      break;
  }

  const shouldWatermark = brandKit.watermark !== false;
  if (shouldWatermark) {
    renderWatermark(ctx, DEFAULTS.WATERMARK_TEXT, width, height);
  }
}

export function renderHighlightOverlay(ctx, scene, progress, color) {
  const { x, y, width, height } = scene.coordinates;
  const sweepWidth = width * progress;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, sweepWidth, height);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.35;
  ctx.fill();
  ctx.restore();
}

export function renderSpotlightOverlay(ctx, scene, progress, canvasWidth, canvasHeight) {
  const opacity = progress * DEFAULTS.SPOTLIGHT_OPACITY;
  const { x, y, width, height } = scene.coordinates;

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${opacity})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.clearRect(x, y, width, height);
  ctx.restore();
}

export function renderBoxOverlay(ctx, scene, progress, color) {
  const { x, y, width, height } = scene.coordinates;
  const totalDash = (width + height) * 2;
  const drawLength = totalDash * progress;
  const offset = totalDash - drawLength;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([totalDash]);
  ctx.lineDashOffset = offset;
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export function renderWordByWordOverlay(ctx, scene, progress, color) {
  const { x, y, width, height } = scene.coordinates;
  const wordCount = Math.max(1, (scene.text || '').split(/\s+/).filter(Boolean).length);
  const wordWidth = width / wordCount;
  const wordsToHighlight = Math.round(wordCount * progress);

  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < wordsToHighlight; i++) {
    ctx.fillRect(x + i * wordWidth, y, wordWidth, height);
  }
  ctx.restore();
}

export function renderWatermark(ctx, text, canvasWidth, canvasHeight) {
  ctx.save();
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, canvasWidth - 10, canvasHeight - 10);
  ctx.restore();
}
