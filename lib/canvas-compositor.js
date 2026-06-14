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

export function renderFrame(ctx, imageBitmap, scene, frameIndex, totalFrames, brandKit, prevScene) {
  const { width, height } = getCanvasDimensions(brandKit.aspectRatio, brandKit.resolution);
  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;

  const preset = getPresetById(scene.presetId);
  const t = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const keyframe = interpolateKeyframes(preset.getKeyframes(scene.coordinates, width, height, scene.duration), t);
  const transform = computeTransform(scene.coordinates, keyframe, width, height);

  const transition = scene.transition || 'dissolve';
  const transitionFrames = Math.min(15, Math.ceil(totalFrames / 2));

  ctx.clearRect(0, 0, width, height);

  if (prevScene && transition !== 'cut' && frameIndex < transitionFrames) {
    const transitionProgress = frameIndex / (transitionFrames - 1 || 1);

    if (transition === 'dissolve') {
      // Draw previous scene's final frame (t=1) at 100% opacity
      const prevPreset = getPresetById(prevScene.presetId);
      const prevKeyframe = interpolateKeyframes(prevPreset.getKeyframes(prevScene.coordinates, width, height, prevScene.duration), 1.0);
      const prevTransform = computeTransform(prevScene.coordinates, prevKeyframe, width, height);

      ctx.save();
      ctx.globalAlpha = 1.0;
      ctx.translate(prevTransform.translateX, prevTransform.translateY);
      ctx.scale(prevTransform.scale, prevTransform.scale);
      ctx.drawImage(imageBitmap, 0, 0, prevScene.coordinates.pageWidth, prevScene.coordinates.pageHeight);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = 1.0;
      renderOverlay(ctx, prevScene, prevKeyframe.overlayType, prevKeyframe.overlayProgress, width, height, prevTransform, imageBitmap);
      ctx.restore();

      // Draw current scene's frame dissolved in on top
      ctx.save();
      ctx.globalAlpha = transitionProgress;
      ctx.translate(transform.translateX, transform.translateY);
      ctx.scale(transform.scale, transform.scale);
      ctx.drawImage(imageBitmap, 0, 0, scene.coordinates.pageWidth, scene.coordinates.pageHeight);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = transitionProgress;
      renderOverlay(ctx, scene, keyframe.overlayType, keyframe.overlayProgress, width, height, transform, imageBitmap);
      ctx.restore();

    } else if (transition === 'flash') {
      const flashProgress = transitionProgress;
      if (flashProgress < 0.5) {
        // Draw previous scene fading to white
        const prevPreset = getPresetById(prevScene.presetId);
        const prevKeyframe = interpolateKeyframes(prevPreset.getKeyframes(prevScene.coordinates, width, height, prevScene.duration), 1.0);
        const prevTransform = computeTransform(prevScene.coordinates, prevKeyframe, width, height);

        ctx.save();
        ctx.translate(prevTransform.translateX, prevTransform.translateY);
        ctx.scale(prevTransform.scale, prevTransform.scale);
        ctx.drawImage(imageBitmap, 0, 0, prevScene.coordinates.pageWidth, prevScene.coordinates.pageHeight);
        ctx.restore();

        renderOverlay(ctx, prevScene, prevKeyframe.overlayType, prevKeyframe.overlayProgress, width, height, prevTransform, imageBitmap);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = flashProgress * 2; // Fades in to 1.0 at flashProgress = 0.5
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      } else {
        // Draw current scene fading in from white
        ctx.save();
        ctx.translate(transform.translateX, transform.translateY);
        ctx.scale(transform.scale, transform.scale);
        ctx.drawImage(imageBitmap, 0, 0, scene.coordinates.pageWidth, scene.coordinates.pageHeight);
        ctx.restore();

        renderOverlay(ctx, scene, keyframe.overlayType, keyframe.overlayProgress, width, height, transform, imageBitmap);

        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = (1 - flashProgress) * 2; // Fades out from 1.0 at flashProgress = 0.5 to 0.0 at flashProgress = 1.0
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }
  } else {
    // Normal render: no transition
    ctx.save();
    ctx.translate(transform.translateX, transform.translateY);
    ctx.scale(transform.scale, transform.scale);
    ctx.drawImage(imageBitmap, 0, 0, scene.coordinates.pageWidth, scene.coordinates.pageHeight);
    ctx.restore();

    renderOverlay(ctx, scene, keyframe.overlayType, keyframe.overlayProgress, width, height, transform, imageBitmap);
  }

  const shouldWatermark = brandKit.watermark !== false;
  if (shouldWatermark) {
    renderWatermark(ctx, DEFAULTS.WATERMARK_TEXT, width, height);
  }
}

export function renderOverlay(ctx, scene, overlayType, progress, width, height, transform, imageBitmap) {
  if (!overlayType || overlayType === 'none') return;
  switch (overlayType) {
    case 'highlight':
      renderHighlightOverlay(ctx, scene, progress, scene.highlightColor || DEFAULTS.HIGHLIGHT_COLOR, transform);
      break;
    case 'spotlight':
      renderSpotlightOverlay(ctx, scene, progress, width, height, transform);
      break;
    case 'box':
      renderBoxOverlay(ctx, scene, progress, scene.boxColor || DEFAULTS.BOX_COLOR, transform);
      break;
    case 'word':
      renderWordByWordOverlay(ctx, scene, progress, scene.highlightColor || DEFAULTS.HIGHLIGHT_COLOR, transform);
      break;
    case 'magnifier':
      renderMagnifierOverlay(ctx, scene, progress, transform, imageBitmap);
      break;
    case 'redline':
      renderRedlineOverlay(ctx, scene, progress, transform);
      break;
    case 'pointer':
      renderPointerOverlay(ctx, scene, progress, width, height, transform);
      break;
  }
}

export function renderHighlightOverlay(ctx, scene, progress, color, transform) {
  const scale = transform.scale;
  const wordRects = scene.coordinates.wordRects;

  if (wordRects && wordRects.length > 0) {
    const N = wordRects.length;
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < N; i++) {
      const wordRect = wordRects[i];
      const startP = i / N;
      const endP = (i + 1) / N;

      const xc = transform.translateX + wordRect.x * scale;
      const yc = transform.translateY + wordRect.y * scale;
      
      let wc = wordRect.width;
      if (i < N - 1) {
        const nextWord = wordRects[i + 1];
        const yDiff = Math.abs(wordRect.y - nextWord.y);
        const threshold = Math.min(wordRect.height, nextWord.height) * 0.8;
        if (yDiff < threshold && nextWord.x > wordRect.x) {
          wc = nextWord.x - wordRect.x;
        }
      }
      
      const wc_scaled = wc * scale;
      const hc = wordRect.height * scale;

      if (progress >= endP) {
        ctx.fillRect(xc, yc, wc_scaled, hc);
      } else if (progress > startP) {
        const wordProgress = (progress - startP) / (endP - startP);
        ctx.fillRect(xc, yc, wc_scaled * wordProgress, hc);
      }
    }
    ctx.restore();
  } else {
    const { x, y, width, height } = scene.coordinates;
    const xc = transform.translateX + x * scale;
    const yc = transform.translateY + y * scale;
    const wc = width * scale;
    const hc = height * scale;
    const sweepWidth = wc * progress;

    ctx.save();
    ctx.beginPath();
    ctx.rect(xc, yc, sweepWidth, hc);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.restore();
  }
}

export function renderSpotlightOverlay(ctx, scene, progress, canvasWidth, canvasHeight, transform) {
  const opacity = progress * DEFAULTS.SPOTLIGHT_OPACITY;
  const { x, y, width, height } = scene.coordinates;
  const scale = transform.scale;
  const xc = transform.translateX + x * scale;
  const yc = transform.translateY + y * scale;
  const wc = width * scale;
  const hc = height * scale;

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${opacity})`;
  
  // 1. Top rect: from top of canvas down to top of spotlight area
  if (yc > 0) {
    ctx.fillRect(0, 0, canvasWidth, yc);
  }
  // 2. Bottom rect: from bottom of spotlight area to bottom of canvas
  if (yc + hc < canvasHeight) {
    ctx.fillRect(0, yc + hc, canvasWidth, canvasHeight - (yc + hc));
  }
  // 3. Left rect: from left of canvas to left of spotlight area, between top and bottom of spotlight area
  if (xc > 0 && hc > 0) {
    ctx.fillRect(0, yc, xc, hc);
  }
  // 4. Right rect: from right of spotlight area to right of canvas, between top and bottom of spotlight area
  if (xc + wc < canvasWidth && hc > 0) {
    ctx.fillRect(xc + wc, yc, canvasWidth - (xc + wc), hc);
  }
  
  ctx.restore();
}

export function renderBoxOverlay(ctx, scene, progress, color, transform) {
  const { x, y, width, height } = scene.coordinates;
  const scale = transform.scale;
  const xc = transform.translateX + x * scale;
  const yc = transform.translateY + y * scale;
  const wc = width * scale;
  const hc = height * scale;

  const totalDash = (wc + hc) * 2;
  const drawLength = totalDash * progress;
  const offset = totalDash - drawLength;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.setLineDash([totalDash]);
  ctx.lineDashOffset = offset;
  ctx.strokeRect(xc, yc, wc, hc);
  ctx.restore();
}

export function renderWordByWordOverlay(ctx, scene, progress, color, transform) {
  const scale = transform.scale;
  const wordRects = scene.coordinates.wordRects;

  if (wordRects && wordRects.length > 0) {
    const N = wordRects.length;
    const wordsToHighlight = Math.round(N * progress);

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < wordsToHighlight; i++) {
      const wordRect = wordRects[i];
      const xc = transform.translateX + wordRect.x * scale;
      const yc = transform.translateY + wordRect.y * scale;
      
      let wc = wordRect.width;
      if (i < N - 1) {
        const nextWord = wordRects[i + 1];
        const yDiff = Math.abs(wordRect.y - nextWord.y);
        const threshold = Math.min(wordRect.height, nextWord.height) * 0.8;
        if (yDiff < threshold && nextWord.x > wordRect.x) {
          wc = nextWord.x - wordRect.x;
        }
      }
      
      const wc_scaled = wc * scale;
      const hc = wordRect.height * scale;
      ctx.fillRect(xc, yc, wc_scaled, hc);
    }
    ctx.restore();
  } else {
    const { x, y, width, height } = scene.coordinates;
    const xc = transform.translateX + x * scale;
    const yc = transform.translateY + y * scale;
    const wc = width * scale;
    const hc = height * scale;

    const wordCount = Math.max(1, (scene.text || '').split(/\s+/).filter(Boolean).length);
    const wordWidth = wc / wordCount;
    const wordsToHighlight = Math.round(wordCount * progress);

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < wordsToHighlight; i++) {
      ctx.fillRect(xc + i * wordWidth, yc, wordWidth, hc);
    }
    ctx.restore();
  }
}

export function renderMagnifierOverlay(ctx, scene, progress, transform, imageBitmap) {
  const { x, y, width, height } = scene.coordinates;
  const scale = transform.scale;
  const xc = transform.translateX + x * scale;
  const yc = transform.translateY + y * scale;
  const wc = width * scale;
  const hc = height * scale;

  const startX = xc;
  const endX = xc + wc;
  const centerX = startX + (endX - startX) * progress;
  const centerY = yc + hc / 2;
  const radius = Math.max(hc * 1.2, 40);

  ctx.save();

  // Create clipping path for magnifying glass lens
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  // Draw magnified image (1.3x zoom of original scale)
  const magnifiedScale = scale * 1.3;
  const translateX_m = centerX - (centerX - transform.translateX) * 1.3;
  const translateY_m = centerY - (centerY - transform.translateY) * 1.3;

  ctx.save();
  ctx.translate(translateX_m, translateY_m);
  ctx.scale(magnifiedScale, magnifiedScale);
  ctx.drawImage(imageBitmap, 0, 0, scene.coordinates.pageWidth, scene.coordinates.pageHeight);
  ctx.restore();

  ctx.restore(); // end clip

  // Draw lens frame
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 235, 59, 0.9)'; // yellow lens frame
  ctx.lineWidth = 3;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.restore();
}

export function renderRedlineOverlay(ctx, scene, progress, transform) {
  const { x, y, width, height } = scene.coordinates;
  const scale = transform.scale;
  const xc = transform.translateX + x * scale;
  const yc = transform.translateY + y * scale;
  const wc = width * scale;
  const hc = height * scale;

  ctx.save();
  ctx.strokeStyle = '#FF5252'; // secondary red color
  ctx.lineWidth = Math.max(2, 2.5 * scale);
  ctx.lineCap = 'round';

  // Strikethrough line (sweeps across selection during first 66% of progress)
  const lineY = yc + hc / 2;
  const strikeProgress = Math.min(1, progress * 1.5);
  ctx.beginPath();
  ctx.moveTo(xc, lineY);
  ctx.lineTo(xc + wc * strikeProgress, lineY);
  ctx.stroke();

  // Correction text (fades in during last 34% of progress)
  if (progress > 0.66) {
    const fadeOpacity = (progress - 0.66) / 0.34;
    ctx.fillStyle = '#FF5252';
    ctx.globalAlpha = fadeOpacity;
    ctx.font = `bold ${Math.max(12, 9 * scale)}px sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText('REVISED', xc, yc - 4);
  }
  ctx.restore();
}

export function renderPointerOverlay(ctx, scene, progress, canvasWidth, canvasHeight, transform) {
  const { x, y, width, height } = scene.coordinates;
  const scale = transform.scale;
  const xc = transform.translateX + x * scale;
  const yc = transform.translateY + y * scale;
  const wc = width * scale;
  const hc = height * scale;

  // Move from bottom-right of canvas to center of selection
  const startX = canvasWidth;
  const startY = canvasHeight;
  const endX = xc + wc / 2;
  const endY = yc + hc / 2;

  const currentX = startX + (endX - startX) * progress;
  const currentY = startY + (endY - startY) * progress;

  // Draw click ripple at the end
  if (progress > 0.8) {
    const rippleProgress = (progress - 0.8) / 0.2; // 0 to 1
    const r = rippleProgress * 25 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(endX, endY, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 235, 59, ${1 - rippleProgress})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Draw cursor arrow pointing to current position
  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.scale(Math.max(0.8, scale * 0.7), Math.max(0.8, scale * 0.7));
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 15);
  ctx.lineTo(4.5, 11.5);
  ctx.lineTo(8.5, 18.5);
  ctx.lineTo(11.5, 17);
  ctx.lineTo(7.5, 10);
  ctx.lineTo(12, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
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
