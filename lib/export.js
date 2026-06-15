export function startRecording(canvas, mimeType) {
  console.log('[export] startRecording: mimeType=' + mimeType + ' canvas=' + canvas.width + 'x' + canvas.height);
  const stream = canvas.captureStream(0);
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
  recorder._stream = stream;
  console.log('[export] Recording started, state=' + recorder.state);
  return recorder;
}

export function stopRecording(mediaRecorder) {
  console.log('[export] stopRecording, state=' + mediaRecorder.state + ' chunks=' + mediaRecorder._chunks.length);
  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      if (mediaRecorder._stream) {
        mediaRecorder._stream.getTracks().forEach(track => track.stop());
      }
      const blob = new Blob(mediaRecorder._chunks, { type: mediaRecorder.mimeType });
      console.log('[export] Recording stopped, blob size=' + blob.size + ' type=' + blob.type);
      resolve(blob);
    };
    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      if (mediaRecorder._stream) {
        mediaRecorder._stream.getTracks().forEach(track => track.stop());
      }
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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const delay = Math.round(100 / fps); // delay in hundredths of a second
  const encoder = new GIFEncoder(canvasWidth, canvasHeight);
  encoder.start();

  for (const frame of frames) {
    encoder.addFrame(frame, delay);
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

  addFrame(imageData, delay) {
    const pixels = new Uint8Array(imageData.data);
    const quantized = this.quantizeColors(pixels);
    const indexed = this.mapToPalette(pixels, quantized.palette);
    this.palette = quantized.palette;
    this.writeGraphicsControlExtension(delay, false);
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
    let codeSize = 9;
    const dict = new Map();
    for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);

    const output = [];
    let bitBuf = 0;
    let bitCount = 0;

    const writeBits = (code, bits) => {
      bitBuf |= (code << bitCount);
      bitCount += bits;
      while (bitCount >= 8) {
        output.push(bitBuf & 0xFF);
        bitBuf >>= 8;
        bitCount -= 8;
      }
    };

    const resetDict = () => {
      dict.clear();
      for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
      nextCode = eofCode + 1;
      codeSize = 9;
    };

    writeBits(clearCode, codeSize);
    let w = String.fromCharCode(data[0]);
    for (let i = 1; i < data.length; i++) {
      const c = String.fromCharCode(data[i]);
      if (dict.has(w + c)) {
        w += c;
      } else {
        writeBits(dict.get(w), codeSize);
        if (nextCode < 4096) {
          dict.set(w + c, nextCode++);
          if (nextCode > (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeBits(clearCode, codeSize);
          resetDict();
        }
        w = c;
      }
    }
    writeBits(dict.get(w), codeSize);
    writeBits(eofCode, codeSize);
    if (bitCount > 0) {
      output.push(bitBuf & 0xFF);
    }
    return output;
  }

  writeString(s) {
    for (let i = 0; i < s.length; i++) this.data.push(s.charCodeAt(i));
  }

  writeWord(v) {
    this.data.push(v & 0xFF, (v >> 8) & 0xFF);
  }
}

/**
 * Minimal ZIP encoder — builds a stored ZIP file from PNG buffers.
 * Avoids any external dependencies (like JSZip).
 */
export async function exportPngSequence(pngFrames) {
  const zipParts = [];
  const centralDirParts = [];
  let currentOffset = 0;

  // CRC32 table
  const crcTable = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }

  function getCrc32(uint8arr) {
    let crc = 0 ^ -1;
    for (let i = 0; i < uint8arr.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ uint8arr[i]) & 0xFF];
    }
    return (crc ^ -1) >>> 0;
  }

  for (let i = 0; i < pngFrames.length; i++) {
    const data = new Uint8Array(pngFrames[i]);
    const filename = `frame_${String(i).padStart(4, '0')}.png`;
    const filenameBytes = new TextEncoder().encode(filename);
    const crc = getCrc32(data);

    // 1. Local File Header
    const lfh = new ArrayBuffer(30 + filenameBytes.length);
    const lfhView = new DataView(lfh);
    lfhView.setUint32(0, 0x04034b50, true); // signature
    lfhView.setUint16(4, 10, true);         // version needed to extract
    lfhView.setUint16(6, 0, true);          // flags
    lfhView.setUint16(8, 0, true);          // compression (0 = store)
    lfhView.setUint16(10, 0, true);         // mod time
    lfhView.setUint16(12, 0, true);         // mod date
    lfhView.setUint32(14, crc, true);       // crc-32
    lfhView.setUint32(18, data.length, true); // compressed size
    lfhView.setUint32(22, data.length, true); // uncompressed size
    lfhView.setUint16(26, filenameBytes.length, true);
    lfhView.setUint16(28, 0, true);         // extra field length

    const lfhBytes = new Uint8Array(lfh);
    lfhBytes.set(filenameBytes, 30);

    zipParts.push(lfhBytes);
    zipParts.push(data);

    // 2. Central Directory Header
    const cdh = new ArrayBuffer(46 + filenameBytes.length);
    const cdhView = new DataView(cdh);
    cdhView.setUint32(0, 0x02014b50, true); // signature
    cdhView.setUint16(4, 10, true);         // version made by
    cdhView.setUint16(6, 10, true);         // version needed to extract
    cdhView.setUint16(8, 0, true);          // flags
    cdhView.setUint16(10, 0, true);         // compression
    cdhView.setUint16(12, 0, true);         // mod time
    cdhView.setUint16(14, 0, true);         // mod date
    cdhView.setUint32(16, crc, true);       // crc
    cdhView.setUint32(20, data.length, true); // compressed size
    cdhView.setUint32(24, data.length, true); // uncompressed size
    cdhView.setUint16(28, filenameBytes.length, true);
    cdhView.setUint16(30, 0, true);         // extra field length
    cdhView.setUint16(32, 0, true);         // comment length
    cdhView.setUint16(34, 0, true);         // disk number start
    cdhView.setUint16(36, 0, true);         // internal attributes
    cdhView.setUint32(38, 0, true);         // external attributes
    cdhView.setUint32(42, currentOffset, true); // relative offset of local header

    const cdhBytes = new Uint8Array(cdh);
    cdhBytes.set(filenameBytes, 46);
    centralDirParts.push(cdhBytes);

    currentOffset += lfhBytes.length + data.length;
  }

  const centralDirOffset = currentOffset;
  let centralDirSize = 0;
  for (const cdh of centralDirParts) {
    zipParts.push(cdh);
    centralDirSize += cdh.length;
  }

  // 3. End of Central Directory
  const eocd = new ArrayBuffer(22);
  const eocdView = new DataView(eocd);
  eocdView.setUint32(0, 0x06054b50, true); // signature
  eocdView.setUint16(4, 0, true);          // disk number
  eocdView.setUint16(6, 0, true);          // disk with CD start
  eocdView.setUint16(8, pngFrames.length, true); // CD records on this disk
  eocdView.setUint16(10, pngFrames.length, true); // total CD records
  eocdView.setUint32(12, centralDirSize, true); // size of CD
  eocdView.setUint32(16, centralDirOffset, true); // offset of CD

  zipParts.push(new Uint8Array(eocd));

  return new Blob(zipParts, { type: 'application/zip' });
}
