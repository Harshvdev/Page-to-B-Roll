export function easeInOut(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeIn(t) {
  return t * t * t;
}

export function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function easeLinear(t) {
  return t;
}

export function spring(t) {
  return 1 - Math.cos(t * Math.PI * 2.5) * Math.pow(2, -6 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

export function interpolateKeyframes(keyframes, t) {
  if (!keyframes || keyframes.length === 0) return {};
  if (keyframes.length === 1) return { ...keyframes[0] };
  if (t <= keyframes[0].time) return { ...keyframes[0] };
  if (t >= keyframes[keyframes.length - 1].time) return { ...keyframes[keyframes.length - 1] };

  let i = 0;
  for (let j = 0; j < keyframes.length - 1; j++) {
    if (t >= keyframes[j].time && t < keyframes[j + 1].time) {
      i = j;
      break;
    }
  }

  const a = keyframes[i];
  const b = keyframes[i + 1];
  const localT = (t - a.time) / (b.time - a.time);
  const easedT = easeInOut(localT);

  const result = { time: t };
  for (const key of Object.keys(a)) {
    if (key === 'time') continue;
    if (typeof a[key] === 'number' && typeof b[key] === 'number') {
      result[key] = lerp(a[key], b[key], easedT);
    } else {
      result[key] = localT < 0.5 ? a[key] : b[key];
    }
  }
  return result;
}

export function computeTransform(coordinates, keyframe, canvasWidth, canvasHeight) {
  let translateX = 0;
  let translateY = 0;
  const scale = keyframe.scale || 1;
  const pageWidth = coordinates.pageWidth || canvasWidth;
  const pageHeight = coordinates.pageHeight || canvasHeight;

  if (keyframe.x !== undefined && keyframe.y !== undefined) {
    translateX = keyframe.x;
    translateY = keyframe.y;
  } else {
    const targetCenterX = coordinates.x + coordinates.width / 2;
    const targetCenterY = coordinates.y + coordinates.height / 2;
    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;
    translateX = canvasCenterX - targetCenterX * scale;
    translateY = canvasCenterY - targetCenterY * scale;
  }

  // Clamp translateX to page boundaries
  const scaledPageWidth = pageWidth * scale;
  if (scaledPageWidth >= canvasWidth) {
    translateX = Math.min(0, Math.max(canvasWidth - scaledPageWidth, translateX));
  } else {
    translateX = (canvasWidth - scaledPageWidth) / 2;
  }

  // Clamp translateY to page boundaries
  const scaledPageHeight = pageHeight * scale;
  if (scaledPageHeight >= canvasHeight) {
    translateY = Math.min(0, Math.max(canvasHeight - scaledPageHeight, translateY));
  } else {
    translateY = (canvasHeight - scaledPageHeight) / 2;
  }

  return { translateX, translateY, scale };
}
