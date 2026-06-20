import { interpolateKeyframes, computeTransform, easeInOut } from './animation-engine.js';
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

export function renderFrame(ctx, imageBitmap, scene, frameIndex, totalFrames, brandKit, prevScene, cachedDims) {
  const { width, height } = cachedDims || getCanvasDimensions(brandKit.aspectRatio, brandKit.resolution);
  if (ctx.canvas.width !== width) ctx.canvas.width = width;
  if (ctx.canvas.height !== height) ctx.canvas.height = height;

  const resolutionScale = height / 1080;

  const scaleCoordinates = (coords) => {
    if (!coords) return null;
    return {
      ...coords,
      x: coords.x * resolutionScale,
      y: coords.y * resolutionScale,
      width: coords.width * resolutionScale,
      height: coords.height * resolutionScale,
      pageWidth: coords.pageWidth * resolutionScale,
      pageHeight: coords.pageHeight * resolutionScale,
      viewportWidth: coords.viewportWidth * resolutionScale,
      viewportHeight: coords.viewportHeight * resolutionScale,
      wordRects: (coords.wordRects || []).map(w => ({
        ...w,
        x: w.x * resolutionScale,
        y: w.y * resolutionScale,
        width: w.width * resolutionScale,
        height: w.height * resolutionScale
      })),
      lineRects: (coords.lineRects || []).map(l => ({
        ...l,
        x: l.x * resolutionScale,
        y: l.y * resolutionScale,
        width: l.width * resolutionScale,
        height: l.height * resolutionScale
      }))
    };
  };

  const scaledCoords = scaleCoordinates(scene.coordinates);
  if (scaledCoords && imageBitmap) {
    scaledCoords.pageWidth = scaledCoords.pageWidth || width;
    scaledCoords.pageHeight = scaledCoords.pageWidth * (imageBitmap.height / imageBitmap.width);
  }
  const scaledScene = { ...scene, coordinates: scaledCoords };

  const preset = getPresetById(scene.presetId);
  const t = totalFrames > 1 ? frameIndex / (totalFrames - 1) : 0;
  const keyframes = preset.getKeyframes(scaledCoords, width, height, scene.duration, scene);

  // Post-process keyframes for continuous scroll/zoom
  if (keyframes && keyframes.length > 0) {
    if (!prevScene) {
      // First scene: start at the top of the page, zoomed out (scale 1.0)
      if (scene.presetId !== 'scroll_journey' && scene.presetId !== 'auto_scroll') {
        const startScale = 1.0;
        const pageWidth = scaledCoords ? (scaledCoords.pageWidth || width) : width;
        const startTargetX = pageWidth / 2;
        const startTargetY = height / 2;
        keyframes[0].scale = startScale;
        keyframes[0].targetX = startTargetX;
        keyframes[0].targetY = startTargetY;
        delete keyframes[0].x;
        delete keyframes[0].y;
        
        if (keyframes.length > 1 && keyframes[1].time < 0.9) {
          keyframes[1].scale = startScale;
          keyframes[1].targetX = startTargetX;
          keyframes[1].targetY = startTargetY;
          delete keyframes[1].x;
          delete keyframes[1].y;
        }
      }
    } else {
      // Subsequent scenes: start at the end position and scale of the previous scene
      const prevScaledCoords = scaleCoordinates(prevScene.coordinates);
      if (prevScaledCoords && imageBitmap) {
        prevScaledCoords.pageWidth = prevScaledCoords.pageWidth || width;
        prevScaledCoords.pageHeight = prevScaledCoords.pageWidth * (imageBitmap.height / imageBitmap.width);
      }
      const prevPreset = getPresetById(prevScene.presetId);
      const prevKeyframes = prevPreset.getKeyframes(prevScaledCoords, width, height, prevScene.duration, prevScene);
      
      // Calculate coordinates for all keyframes of the previous scene
      for (const kf of prevKeyframes) {
        if (kf.x === undefined || kf.y === undefined) {
          const trans = computeTransform(prevScaledCoords, kf, width, height);
          kf.x = trans.translateX;
          kf.y = trans.translateY;
        }
      }
      const prevEndKeyframe = interpolateKeyframes(prevKeyframes, 1.0, prevScene);
      const prevEndTransform = computeTransform(prevScaledCoords, prevEndKeyframe, width, height);
      
      const prevTargetX = (width / 2 - prevEndTransform.translateX) / prevEndTransform.scale;
      const prevTargetY = (height / 2 - prevEndTransform.translateY) / prevEndTransform.scale;
      
      keyframes[0].scale = prevEndTransform.scale;
      keyframes[0].targetX = prevTargetX;
      keyframes[0].targetY = prevTargetY;
      
      if (keyframes.length > 1 && keyframes[1].time < 0.9) {
        keyframes[1].scale = prevEndTransform.scale;
        keyframes[1].targetX = prevTargetX;
        keyframes[1].targetY = prevTargetY;
      }
    }
  }

  const targetCenterX = scaledCoords ? (scaledCoords.x + scaledCoords.width / 2) : width / 2;
  const targetCenterY = scaledCoords ? (scaledCoords.y + scaledCoords.height / 2) : height / 2;
  for (const kf of keyframes) {
    if (kf.x === undefined && kf.y === undefined && kf.targetX === undefined && kf.targetY === undefined) {
      kf.targetX = targetCenterX;
      kf.targetY = targetCenterY;
    }
  }

  // Pre-calculate resolved absolute x and y coordinates for all keyframes
  // to ensure smooth linear interpolation in translation space.
  for (const kf of keyframes) {
    if (kf.x === undefined || kf.y === undefined) {
      const trans = computeTransform(scaledCoords, kf, width, height);
      kf.x = trans.translateX;
      kf.y = trans.translateY;
    }
  }
  const keyframe = interpolateKeyframes(keyframes, t, scene);
  const transform = computeTransform(scaledCoords, keyframe, width, height);

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  ctx.translate(transform.translateX, transform.translateY);
  ctx.scale(transform.scale, transform.scale);
  ctx.drawImage(imageBitmap, 0, 0, scaledCoords.pageWidth, scaledCoords.pageHeight);
  ctx.restore();

  renderOverlay(ctx, scaledScene, keyframe.overlayType, keyframe.overlayProgress, width, height, transform, imageBitmap);

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
    case 'underline':
      renderUnderlineOverlay(ctx, scene, progress, scene.highlightColor || DEFAULTS.HIGHLIGHT_COLOR, transform);
      break;
  }
}

export function renderHighlightOverlay(ctx, scene, progress, color, transform) {
  const scale = transform.scale;
  const wordRects = scene.coordinates.wordRects;

  if (wordRects && wordRects.length > 0) {
    const N = wordRects.length;
    
    // 1. Calculate adjusted widths (weights) for each word
    const weights = new Float32Array(N);
    const adjustedWidths = new Float32Array(N);
    
    for (let i = 0; i < N; i++) {
      const wordRect = wordRects[i];
      let wc = wordRect.width;
      if (i < N - 1) {
        const nextWord = wordRects[i + 1];
        const yDiff = Math.abs(wordRect.y - nextWord.y);
        const threshold = Math.min(wordRect.height, nextWord.height) * 0.8;
        if (yDiff < threshold && nextWord.x > wordRect.x) {
          wc = nextWord.x - wordRect.x;
        }
      }
      adjustedWidths[i] = wc;
      weights[i] = Math.max(1, wc);
    }

    // 2. Compute cumulative weights to get start and end progress for each word
    let totalWeight = 0;
    for (let i = 0; i < N; i++) {
      totalWeight += weights[i];
    }

    const startP = new Float32Array(N);
    const endP = new Float32Array(N);
    let currentWeight = 0;
    for (let i = 0; i < N; i++) {
      startP[i] = currentWeight / totalWeight;
      currentWeight += weights[i];
      endP[i] = currentWeight / totalWeight;
    }

    // 3. Draw highlight overlay
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    for (let i = 0; i < N; i++) {
      const wordRect = wordRects[i];
      const xc = transform.translateX + wordRect.x * scale;
      const yc = transform.translateY + wordRect.y * scale;
      const wc_scaled = adjustedWidths[i] * scale;
      const hc = wordRect.height * scale;

      if (progress >= endP[i]) {
        ctx.fillRect(xc, yc, wc_scaled, hc);
      } else if (progress > startP[i]) {
        const wordProgress = (progress - startP[i]) / (endP[i] - startP[i]);
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
    ctx.globalCompositeOperation = 'multiply';
    ctx.beginPath();
    ctx.rect(xc, yc, sweepWidth, hc);
    ctx.fillStyle = color;
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

  const resolutionScale = canvasHeight / 1080;
  const padX = 8 * resolutionScale * scale;
  const padY = 1 * resolutionScale * scale;
  const xc_spot = xc - padX;
  const yc_spot = yc - padY;
  const wc_spot = wc + 2 * padX;
  const hc_spot = hc + 2 * padY;

  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${opacity})`;
  
  // 1. Top rect: from top of canvas down to top of spotlight area
  if (yc_spot > 0) {
    ctx.fillRect(0, 0, canvasWidth, yc_spot);
  }
  // 2. Bottom rect: from bottom of spotlight area to bottom of canvas
  if (yc_spot + hc_spot < canvasHeight) {
    ctx.fillRect(0, yc_spot + hc_spot, canvasWidth, canvasHeight - (yc_spot + hc_spot));
  }
  // 3. Left rect: from left of canvas to left of spotlight area, between top and bottom of spotlight area
  if (xc_spot > 0 && hc_spot > 0) {
    ctx.fillRect(0, yc_spot, xc_spot, hc_spot);
  }
  // 4. Right rect: from right of spotlight area to right of canvas, between top and bottom of spotlight area
  if (xc_spot + wc_spot < canvasWidth && hc_spot > 0) {
    ctx.fillRect(xc_spot + wc_spot, yc_spot, canvasWidth - (xc_spot + wc_spot), hc_spot);
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

  const resolutionScale = ctx.canvas.height / 1080;
  const padX = 8 * resolutionScale * scale;
  const padY = 1 * resolutionScale * scale;
  const xc_box = xc - padX;
  const yc_box = yc - padY;
  const wc_box = wc + 2 * padX;
  const hc_box = hc + 2 * padY;

  const totalDash = (wc_box + hc_box) * 2;
  const drawLength = totalDash * progress;
  const offset = totalDash - drawLength;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, 3 * resolutionScale);
  ctx.setLineDash([totalDash]);
  ctx.lineDashOffset = offset;
  ctx.strokeRect(xc_box, yc_box, wc_box, hc_box);
  ctx.restore();
}

export function renderWordByWordOverlay(ctx, scene, progress, color, transform) {
  const scale = transform.scale;
  const wordRects = scene.coordinates.wordRects;

  if (wordRects && wordRects.length > 0) {
    const N = wordRects.length;
    
    // 1. Calculate weights
    const weights = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      weights[i] = Math.max(1, wordRects[i].width);
    }
    
    let totalWeight = 0;
    for (let i = 0; i < N; i++) {
      totalWeight += weights[i];
    }
    
    const endP = new Float32Array(N);
    let currentWeight = 0;
    for (let i = 0; i < N; i++) {
      currentWeight += weights[i];
      endP[i] = currentWeight / totalWeight;
    }
    
    // Find active word
    let currentIdx = 0;
    for (let i = 0; i < N; i++) {
      if (progress <= endP[i]) {
        currentIdx = i;
        break;
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    
    const wordRect = wordRects[currentIdx];
    const xc = transform.translateX + wordRect.x * scale;
    const yc = transform.translateY + wordRect.y * scale;
    const wc_scaled = wordRect.width * scale;
    const hc = wordRect.height * scale;
    
    ctx.fillRect(xc, yc, wc_scaled, hc);
    ctx.restore();
  } else {
    const { x, y, width, height } = scene.coordinates;
    const xc = transform.translateX + x * scale;
    const yc = transform.translateY + y * scale;
    const wc = width * scale;
    const hc = height * scale;

    const wordCount = Math.max(1, (scene.text || '').split(/\s+/).filter(Boolean).length);
    const wordWidth = wc / wordCount;
    const currentIdx = Math.min(wordCount - 1, Math.floor(progress * wordCount));

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = color;
    ctx.fillRect(xc + currentIdx * wordWidth, yc, wordWidth, hc);
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
  
  const resolutionScale = ctx.canvas.height / 1080;
  const radius = Math.max(hc * 1.2, 40 * resolutionScale);

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
  ctx.lineWidth = 3 * resolutionScale;
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8 * resolutionScale;
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

  const resolutionScale = ctx.canvas.height / 1080;

  ctx.save();
  ctx.strokeStyle = '#FF5252'; // secondary red color
  ctx.lineWidth = Math.max(2 * resolutionScale, 2.5 * scale * resolutionScale);
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
    ctx.font = `bold ${Math.max(12 * resolutionScale, 9 * scale * resolutionScale)}px sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText('REVISED', xc, yc - 4 * resolutionScale);
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

  const resolutionScale = canvasHeight / 1080;

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
    const r = rippleProgress * 25 * scale * resolutionScale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(endX, endY, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 235, 59, ${1 - rippleProgress})`;
    ctx.lineWidth = 2 * resolutionScale;
    ctx.stroke();
    ctx.restore();
  }

  // Draw cursor arrow pointing to current position
  ctx.save();
  ctx.translate(currentX, currentY);
  ctx.scale(Math.max(0.8, scale * 0.7) * resolutionScale, Math.max(0.8, scale * 0.7) * resolutionScale);
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 4 * resolutionScale;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5 * resolutionScale;
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
  const resolutionScale = canvasHeight / 1080;
  ctx.font = `${12 * resolutionScale}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, canvasWidth - 10 * resolutionScale, canvasHeight - 10 * resolutionScale);
  ctx.restore();
}

export function renderUnderlineOverlay(ctx, scene, progress, color, transform) {
  const scale = transform.scale;
  let lineRects = scene.coordinates.lineRects || [];
  lineRects = mergeLineRects(lineRects);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const resolutionScale = ctx.canvas.height / 1080;
  ctx.lineWidth = Math.max(1.5, 4 * scale * resolutionScale);

  if (lineRects.length > 0) {
    const N = lineRects.length;
    const weights = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      weights[i] = Math.max(1, lineRects[i].width);
    }
    let totalWeight = 0;
    for (let i = 0; i < N; i++) {
      totalWeight += weights[i];
    }

    const startP = new Float32Array(N);
    const endP = new Float32Array(N);
    let currentWeight = 0;
    for (let i = 0; i < N; i++) {
      startP[i] = currentWeight / totalWeight;
      currentWeight += weights[i];
      endP[i] = currentWeight / totalWeight;
    }

    for (let i = 0; i < N; i++) {
      const lineRect = lineRects[i];
      // Draw underline 2px (at 1080p) below bottom of line box
      const yUnderline = transform.translateY + (lineRect.y + lineRect.height + 2 * resolutionScale) * scale;
      const xStart = transform.translateX + lineRect.x * scale;
      const lineWidth = lineRect.width * scale;

      ctx.beginPath();
      if (progress >= endP[i]) {
        ctx.moveTo(xStart, yUnderline);
        ctx.lineTo(xStart + lineWidth, yUnderline);
        ctx.stroke();
      } else if (progress > startP[i]) {
        const lineProgress = (progress - startP[i]) / (endP[i] - startP[i]);
        ctx.moveTo(xStart, yUnderline);
        ctx.lineTo(xStart + lineWidth * lineProgress, yUnderline);
        ctx.stroke();
      }
    }
  } else {
    // Fallback: draw single underline under selection rect
    const { x, y, width, height } = scene.coordinates;
    const xStart = transform.translateX + x * scale;
    const yUnderline = transform.translateY + (y + height + 2 * resolutionScale) * scale;
    const lineWidth = width * scale;

    ctx.beginPath();
    ctx.moveTo(xStart, yUnderline);
    ctx.lineTo(xStart + lineWidth * progress, yUnderline);
    ctx.stroke();
  }
  ctx.restore();
}

export function mergeLineRects(rects) {
  if (!rects || rects.length === 0) return [];
  
  // 1. Filter out empty/invalid rects
  const valid = rects.filter(r => r.width > 2 && r.height > 2);
  if (valid.length <= 1) return valid;
  
  // 2. Group rects by y-coordinate (lines)
  // Two rects are on the same line if their vertical overlap is significant
  // or if the difference in their y-coordinate is small.
  // Sort them by y first, then by x.
  const sorted = [...valid].sort((a, b) => {
    if (Math.abs(a.y - b.y) > Math.min(a.height, b.height) * 0.5) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
  
  const merged = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const isSameLine = Math.abs(next.y - current.y) < Math.min(current.height, next.height) * 0.5;
    
    if (isSameLine) {
      // Overlapping or adjacent horizontally?
      const gap = next.x - (current.x + current.width);
      // If gap is small (e.g. less than 30px), merge them!
      if (gap < 30) {
        const newRight = Math.max(current.x + current.width, next.x + next.width);
        current.width = newRight - current.x;
        current.height = Math.max(current.height, next.height);
        current.y = Math.min(current.y, next.y);
      } else {
        merged.push(current);
        current = { ...next };
      }
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}
