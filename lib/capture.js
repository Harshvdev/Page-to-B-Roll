export async function stitchStrips(strips, pageWidth, pageHeight, devicePixelRatio) {
  const w = Math.round(pageWidth * devicePixelRatio);
  const h = Math.round(pageHeight * devicePixelRatio);
  console.log('[capture] stitchStrips: canvas=' + w + 'x' + h + ' strips=' + strips.length);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');

  const bitmaps = [];
  for (let i = 0; i < strips.length; i++) {
    bitmaps.push(await base64ToImageBitmap(strips[i]));
  }

  if (bitmaps.length === 0) {
    const result = await createImageBitmap(canvas);
    return result;
  }

  const viewportHeight = bitmaps[0].height / devicePixelRatio;
  const offsets = calculateStripOffsets(pageHeight, viewportHeight);

  for (let i = 0; i < bitmaps.length; i++) {
    const bitmap = bitmaps[i];
    const yOff = Math.round((offsets[i] || 0) * devicePixelRatio);
    ctx.drawImage(bitmap, 0, yOff);
    console.log('[capture] Strip ' + i + ': bitmap=' + bitmap.width + 'x' + bitmap.height + ' yOff=' + yOff);
  }

  const result = await createImageBitmap(canvas);
  console.log('[capture] Stitched bitmap: ' + result.width + 'x' + result.height);
  return result;
}

export async function base64ToImageBitmap(base64Png) {
  const response = await fetch(`data:image/png;base64,${base64Png}`);
  const blob = await response.blob();
  return createImageBitmap(blob);
}

export function calculateStripOffsets(pageHeight, viewportHeight) {
  const offsets = [];
  const maxScroll = Math.max(0, pageHeight - viewportHeight);
  const step = viewportHeight * 0.9;
  let y = 0;
  while (y < maxScroll) {
    offsets.push(Math.round(y));
    y += step;
  }
  if (offsets.length === 0 || offsets[offsets.length - 1] < maxScroll) {
    offsets.push(Math.round(maxScroll));
  }
  return offsets;
}
