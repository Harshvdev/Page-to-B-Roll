import { MSG, DEFAULTS } from '../lib/constants.js';
import { stitchStrips } from '../lib/capture.js';
import { renderFrame, getCanvasDimensions } from '../lib/canvas-compositor.js';
import { startRecording, stopRecording, getSupportedMimeType, exportGif, exportPngSequence } from '../lib/export.js';

let canvas = null;
let ctx = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ pong: true });
    return false;
  }
  if (message.type === MSG.START_RENDER) {
    console.log('[Broll Offscreen] START_RENDER received, starting render');
    handleRenderVideo(message.payload, sendResponse);
    return true;
  }
  return false;
});

function getCanvasBlob(canvas, mimeType) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType);
  });
}

async function handleRenderVideo(payload, sendResponse) {
  try {
    const { scenes, strips, brandKit, pageWidth, pageHeight, devicePixelRatio, fps } = payload;
    console.log('[Broll Offscreen] handleRenderVideo: scenes=' + scenes.length + ' strips=' + (strips ? strips.length : 0) + ' page=' + pageWidth + 'x' + pageHeight + ' dpr=' + devicePixelRatio);

    const { width, height } = getCanvasDimensions(brandKit.aspectRatio, brandKit.resolution);
    console.log('[Broll Offscreen] Canvas dimensions: ' + width + 'x' + height);

    canvas = document.getElementById('render-canvas');
    if (!canvas) throw new Error('render-canvas element not found');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');

    console.log('[Broll Offscreen] Stitching strips into image bitmap');
    const imageBitmap = await stitchStrips(strips, pageWidth, pageHeight, devicePixelRatio || 1);
    console.log('[Broll Offscreen] Stitched bitmap size: ' + imageBitmap.width + 'x' + imageBitmap.height);

    const isVideo = brandKit.exportFormat === 'mp4' || brandKit.exportFormat === 'webm' || !brandKit.exportFormat;
    let recorder = null;

    if (isVideo) {
      const mimeType = getSupportedMimeType();
      console.log('[Broll Offscreen] Using MIME type: ' + mimeType);
      recorder = startRecording(canvas, mimeType);
    }

    const gifFrames = [];
    const pngBuffers = [];

    let totalFrames = 0;
    for (const scene of scenes) {
      totalFrames += Math.ceil(scene.duration * fps);
    }
    console.log('[Broll Offscreen] Total frames to render: ' + totalFrames);
    let currentFrame = 0;

    for (let s = 0; s < scenes.length; s++) {
      const scene = scenes[s];
      const sceneFrames = Math.ceil(scene.duration * fps);
      console.log('[Broll Offscreen] Rendering scene ' + (s + 1) + '/' + scenes.length + ' frames: ' + sceneFrames);

      for (let f = 0; f < sceneFrames; f++) {
        const useWatermark = brandKit.watermark !== false || payload.license.tier === 'free';
        const renderBrandKit = {
          ...brandKit,
          watermark: useWatermark,
        };

        const prevScene = s > 0 ? scenes[s - 1] : null;
        renderFrame(ctx, imageBitmap, scene, f, sceneFrames, renderBrandKit, prevScene);

        if (brandKit.exportFormat === 'gif') {
          gifFrames.push(ctx.getImageData(0, 0, width, height));
        } else if (brandKit.exportFormat === 'png_sequence') {
          const blob = await getCanvasBlob(canvas, 'image/png');
          const buffer = await blob.arrayBuffer();
          pngBuffers.push(buffer);
        }

        await frameDelay(fps);

        currentFrame++;
        const percent = Math.round((currentFrame / totalFrames) * 100);
        chrome.runtime.sendMessage({
          type: MSG.RENDER_PROGRESS,
          payload: { percent },
        }).catch(() => {});
      }

      chrome.runtime.sendMessage({
        type: MSG.RENDER_PROGRESS,
        payload: { percent: Math.round(((s + 1) / scenes.length) * 100) },
      }).catch(() => {});
    }

    let blob;
    let filename = 'broll-video.webm';

    if (isVideo) {
      console.log('[Broll Offscreen] All frames rendered, waiting for final encoding chunks');
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log('[Broll Offscreen] Stopping recording');
      blob = await stopRecording(recorder);
      filename = brandKit.exportFormat === 'mp4' ? 'broll-video.mp4' : 'broll-video.webm';
    } else if (brandKit.exportFormat === 'gif') {
      console.log('[Broll Offscreen] Compiling GIF from ' + gifFrames.length + ' frames');
      blob = await exportGif(gifFrames, width, height, fps);
      filename = 'broll-video.gif';
    } else if (brandKit.exportFormat === 'png_sequence') {
      console.log('[Broll Offscreen] Compiling ZIP from ' + pngBuffers.length + ' PNG frames');
      blob = await exportPngSequence(pngBuffers);
      filename = 'broll-frames.zip';
    }

    const blobUrl = URL.createObjectURL(blob);
    console.log('[Broll Offscreen] Recording complete, blob URL: ' + blobUrl + ' size: ' + blob.size);

    chrome.runtime.sendMessage({
      type: MSG.RENDER_COMPLETE,
      payload: { blobUrl, filename },
    }).catch(() => {});

    sendResponse({ success: true });
    console.log('[Broll Offscreen] sendResponse success sent');
  } catch (err) {
    console.error('[Broll Offscreen] Render error:', err);
    chrome.runtime.sendMessage({
      type: MSG.RENDER_ERROR,
      payload: { message: err.message || 'Unknown render error' },
    }).catch(() => {});
    sendResponse({ success: false, error: err.message });
  }
}

function frameDelay(fps) {
  return new Promise((resolve) => setTimeout(resolve, 1000 / (fps || 30)));
}
