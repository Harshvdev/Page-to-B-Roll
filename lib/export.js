export function startRecording(canvas, mimeType) {
  console.log('[export] startRecording: mimeType=' + mimeType + ' canvas=' + canvas.width + 'x' + canvas.height);
  const stream = canvas.captureStream(30);
  const type = mimeType && MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm';
  console.log('[export] Using type=' + type);
  const recorder = new MediaRecorder(stream, { mimeType: type });
  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data);
      console.log('[export] Data available: ' + e.data.size + ' bytes');
    }
  };
  recorder.start();
  recorder._chunks = chunks;
  console.log('[export] Recording started, state=' + recorder.state);
  return recorder;
}

export function stopRecording(mediaRecorder) {
  console.log('[export] stopRecording, state=' + mediaRecorder.state + ' chunks=' + mediaRecorder._chunks.length);
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(mediaRecorder._chunks, { type: mediaRecorder.mimeType });
      console.log('[export] Recording stopped, blob size=' + blob.size + ' type=' + blob.type);
      resolve(blob);
    };
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      resolve(new Blob(mediaRecorder._chunks, { type: mediaRecorder.mimeType }));
    }
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateSrtContent(scenes) {
  let srt = '';
  let time = 0;
  for (let i = 0; i < scenes.length; i++) {
    const start = time;
    const end = time + scenes[i].duration;
    const startStr = formatSrtTime(start);
    const endStr = formatSrtTime(end);
    srt += `${i + 1}\n${startStr} --> ${endStr}\n${scenes[i].text || ''}\n\n`;
    time = end;
  }
  return srt.trim();
}

function formatSrtTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

export function getSupportedMimeType() {
  const types = [
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return 'video/webm';
}

export async function exportGif(frames, canvasWidth, canvasHeight, fps) {
  const delay = Math.round(1000 / fps);
  const encoder = new GIFEncoder(canvasWidth, canvasHeight);
  encoder.start();

  for (const frame of frames) {
    encoder.addFrame(frame);
  }
  encoder.finish();
  return encoder.getBlob();
}

/**
 * Minimal GIF encoder — no external dependencies.
 * Based on the GIF89a specification with color quantization.
 */
class GIFEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = [];
    this.frameIndex = 0;
    this.palette = [];
    this.transparentIndex = -1;
  }

  start() {
    this.writeHeader();
  }

  addFrame(imageData) {
    const pixels = new Uint8Array(imageData.data);
    const quantized = this.quantizeColors(pixels);
    const indexed = this.mapToPalette(pixels, quantized.palette);
    this.palette = quantized.palette;
    this.writeGraphicsControlExtension(10, false);
    this.writeImageDescriptor(indexed, quantized.palette);
    this.frameIndex++;
  }

  finish() {
    this.data.push(0x3B); // GIF trailer
  }

  getBlob() {
    return new Blob([new Uint8Array(this.data)], { type: 'image/gif' });
  }

  writeHeader() {
    // GIF89a signature
    this.writeString('GIF89a');
    // Logical screen descriptor
    this.writeWord(this.width);
    this.writeWord(this.height);
    // Packed field: no global color table
    this.data.push(0x00, 0x00, 0x00);
  }

  writeGraphicsControlExtension(delay, transparent) {
    this.data.push(0x21, 0xF9, 0x04);
    const packed = transparent ? 0x01 : 0x00;
    this.data.push(packed);
    this.writeWord(delay);
    this.data.push(transparent ? 0x00 : 0x00);
    this.data.push(0x00);
  }

  writeImageDescriptor(indexedPixels, palette) {
    // Image separator
    this.data.push(0x2C);
    // Image left, top
    this.writeWord(0);
    this.writeWord(0);
    // Image width, height
    this.writeWord(this.width);
    this.writeWord(this.height);
    // Local color table present
    const colorCount = palette.length / 3;
    const size = Math.ceil(Math.log2(colorCount)) - 1;
    const packedField = 0x80 | (size > 0 ? size : 0);
    this.data.push(packedField);
    // Color table
    for (let i = 0; i < 256; i++) {
      if (i < palette.length / 3) {
        this.data.push(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]);
      } else {
        this.data.push(0x00, 0x00, 0x00);
      }
    }
    // LZW minimum code size
    this.data.push(8);
    // LZW encoded data
    const lzwData = this.lzwEncode(indexedPixels);
    for (let i = 0; i < lzwData.length; i += 255) {
      const chunk = lzwData.slice(i, i + 255);
      this.data.push(chunk.length);
      for (const b of chunk) this.data.push(b);
    }
    this.data.push(0x00);
  }

  quantizeColors(pixels) {
    const colorMap = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const key = (r << 16) | (g << 8) | b;
      colorMap.set(key, (colorMap.get(key) || 0) + 1);
    }
    const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]);
    const maxColors = 256;
    const palette = [];
    for (let i = 0; i < Math.min(sorted.length, maxColors); i++) {
      const r = (sorted[i][0] >> 16) & 0xFF;
      const g = (sorted[i][0] >> 8) & 0xFF;
      const b = sorted[i][0] & 0xFF;
      palette.push(r, g, b);
    }
    if (palette.length === 0) palette.push(0, 0, 0);
    return { palette };
  }

  mapToPalette(pixels, palette) {
    const indexed = new Uint8Array(this.width * this.height);
    let idx = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      let bestDist = Infinity;
      let best = 0;
      for (let j = 0; j < palette.length / 3; j++) {
        const dr = r - palette[j * 3];
        const dg = g - palette[j * 3 + 1];
        const db = b - palette[j * 3 + 2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          best = j;
        }
      }
      indexed[idx++] = best;
    }
    return indexed;
  }

  lzwEncode(data) {
    const clearCode = 256;
    const eofCode = 257;
    let nextCode = 258;
    const dict = new Map();
    for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
    const output = [];
    const writeCode = (code, bits) => {
      // Simplified LZW — writes variable-length codes
      output.push(code & 0xFF);
      if (code > 255) output.push((code >> 8) & 0xFF);
    };
    writeCode(clearCode, 12);
    let w = String.fromCharCode(data[0]);
    for (let i = 1; i < data.length; i++) {
      const c = String.fromCharCode(data[i]);
      if (dict.has(w + c)) {
        w += c;
      } else {
        writeCode(dict.get(w), 12);
        if (nextCode < 4096) {
          dict.set(w + c, nextCode++);
        }
        w = c;
      }
    }
    writeCode(dict.get(w), 12);
    writeCode(eofCode, 12);
    return output;
  }

  writeString(s) {
    for (let i = 0; i < s.length; i++) this.data.push(s.charCodeAt(i));
  }

  writeWord(v) {
    this.data.push(v & 0xFF, (v >> 8) & 0xFF);
  }
}
