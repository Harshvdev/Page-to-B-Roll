export async function stitchStrips(strips, pageWidth, pageHeight, devicePixelRatio) {
  const w = Math.round(pageWidth * devicePixelRatio);
  const h = Math.round(pageHeight * devicePixelRatio);
  console.log('[capture] stitchStrips: canvas=' + w + 'x' + h + ' strips=' + strips.length);
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < strips.length; i++) {
    const bitmap = await base64ToImageBitmap(strips[i]);
    const yOff = i === 0 ? 0 : i * bitmap.height;
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
  const step = viewportHeight * 0.9;
  let y = 0;
  while (y < pageHeight) {
    offsets.push(Math.round(y));
    y += step;
  }
  if (offsets.length === 0 || offsets[offsets.length - 1] < pageHeight - 1) {
    offsets.push(Math.round(pageHeight - viewportHeight));
  }
  return offsets;
}
