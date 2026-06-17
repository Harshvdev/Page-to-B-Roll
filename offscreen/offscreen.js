import { MSG, DEFAULTS } from '../lib/constants.js';
import { stitchStrips } from '../lib/capture.js';
import { renderFrame, getCanvasDimensions } from '../lib/canvas-compositor.js';
import { startRecording, stopRecording, getSupportedMimeType, exportGif, exportPngSequence } from '../lib/export.js';

let canvas = null;
let ctx = null;
let isCancelled = false;
let audioCtx = null;
let silentAudioEl = null;

function startSilentAudio() {
  try {
    // 1. Initialize and try to run AudioContext (Web Audio API)
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      console.log('[Broll Offscreen] Silent AudioContext started');
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume()
        .then(() => console.log('[Broll Offscreen] Silent AudioContext resumed successfully'))
        .catch(err => console.warn('[Broll Offscreen] AudioContext resume failed:', err));
    }

    // 2. Play silent audio via HTML5 Audio element to bypass background throttling
    if (!silentAudioEl) {
      const silentWav = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      silentAudioEl = new Audio(silentWav);
      silentAudioEl.loop = true;
      silentAudioEl.volume = 0.01; // extremely quiet but not muted (muting might disable background exemption)
      silentAudioEl.play()
        .then(() => console.log('[Broll Offscreen] Silent HTML5 audio playing successfully'))
        .catch(err => console.error('[Broll Offscreen] Silent HTML5 audio play failed:', err));
    }
  } catch (err) {
    console.error('[Broll Offscreen] Failed to start silent audio:', err);
  }
}

function stopSilentAudio() {
  try {
    if (audioCtx) {
      audioCtx.close();
      audioCtx = null;
      console.log('[Broll Offscreen] Silent AudioContext stopped');
    }
    if (silentAudioEl) {
      silentAudioEl.pause();
      silentAudioEl = null;
      console.log('[Broll Offscreen] Silent HTML5 audio stopped');
    }
  } catch (err) {
    console.error('[Broll Offscreen] Failed to stop silent audio:', err);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ pong: true });
    return false;
  }
  if (message.type === MSG.START_RENDER) {
    console.log('[Broll Offscreen] START_RENDER received, starting render');
    sendResponse({ success: true }); // Unblock service worker immediately
    handleRenderVideo(message.payload); // Run async
    return false;
  }
  if (message.type === 'CANCEL_RENDER') {
    console.log('[Broll Offscreen] CANCEL_RENDER received, aborting render');
    isCancelled = true;
    sendResponse({ success: true });
    return false;
  }
  return false;
});

function getCanvasBlob(canvas, mimeType) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType);
  });
}

async function handleRenderVideo(payload) {
  let recorder = null;
  let imageBitmap = null;
  try {
    isCancelled = false;
    startSilentAudio();
    const { scenes, strips, actualOffsets, brandKit, pageWidth, pageHeight, devicePixelRatio, fps } = payload;
    console.log('[Broll Offscreen] handleRenderVideo: scenes=' + scenes.length + ' strips=' + (strips ? strips.length : 0) + ' page=' + pageWidth + 'x' + pageHeight + ' dpr=' + devicePixelRatio);

    const canvasDims = getCanvasDimensions(brandKit.aspectRatio, brandKit.resolution);
    const { width, height } = canvasDims;
    console.log('[Broll Offscreen] Canvas dimensions: ' + width + 'x' + height);

    canvas = document.getElementById('render-canvas');
    if (!canvas) throw new Error('render-canvas element not found');
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext('2d');

    console.log('[Broll Offscreen] Stitching strips into image bitmap');
    imageBitmap = await stitchStrips(strips, pageWidth, pageHeight, devicePixelRatio || 1, actualOffsets);
    console.log('[Broll Offscreen] Stitched bitmap size: ' + imageBitmap.width + 'x' + imageBitmap.height);

    if (isCancelled) {
      imageBitmap.close();
      throw new Error('Render cancelled by user');
    }

    const isVideo = brandKit.exportFormat === 'mp4' || brandKit.exportFormat === 'webm' || !brandKit.exportFormat;

    const useWatermark = brandKit.watermark !== false || payload.license.tier === 'free';
    const renderBrandKit = {
      ...brandKit,
      watermark: useWatermark,
    };

    if (isVideo) {
      const mimeType = getSupportedMimeType(brandKit.exportFormat);
      console.log('[Broll Offscreen] Using MIME type: ' + mimeType);
      
      // Render the first frame before starting recorder
      if (scenes.length > 0) {
        const firstScene = scenes[0];
        const firstSceneFrames = Math.ceil(firstScene.duration * fps);
        renderFrame(ctx, imageBitmap, firstScene, 0, firstSceneFrames, renderBrandKit, null, canvasDims);
      }

      recorder = startRecording(canvas, mimeType);
      const track = recorder._stream.getVideoTracks()[0];
      if (track && typeof track.requestFrame === 'function') {
        track.requestFrame();
      }
    }

    const gifFrames = [];
    const pngBuffers = [];

    const videoEndDelay = typeof brandKit.videoEndDelay === 'number' ? brandKit.videoEndDelay : 1.0;
    const endDelayFrames = Math.ceil(videoEndDelay * fps);

    let totalFrames = 0;
    for (const scene of scenes) {
      const sceneFrames = Math.ceil(scene.duration * fps);
      const pauseDuration = scene.pauseDuration !== undefined ? scene.pauseDuration : DEFAULTS.PAUSE_DURATION;
      const pauseFrames = Math.ceil(pauseDuration * fps);
      totalFrames += (sceneFrames + pauseFrames);
    }
    totalFrames += endDelayFrames;

    console.log('[Broll Offscreen] Total frames to render (including pauses & end delay): ' + totalFrames);
    let currentFrame = 0;

    for (let s = 0; s < scenes.length; s++) {
      const scene = scenes[s];
      const sceneFrames = Math.ceil(scene.duration * fps);
      const pauseDuration = scene.pauseDuration !== undefined ? scene.pauseDuration : DEFAULTS.PAUSE_DURATION;
      const pauseFrames = Math.ceil(pauseDuration * fps);
      const totalSceneFrames = sceneFrames + pauseFrames;
      
      console.log('[Broll Offscreen] Rendering scene ' + (s + 1) + '/' + scenes.length + ' active frames: ' + sceneFrames + ', pause frames: ' + pauseFrames);

      const prevScene = s > 0 ? scenes[s - 1] : null;

      for (let f = 0; f < totalSceneFrames; f++) {
        if (isCancelled) {
          throw new Error('Render cancelled by user');
        }

        const frameStart = performance.now();
        // If we are in the active animation, use f. If we are in the pause duration, use the last active frame.
        const activeFrameIndex = f < sceneFrames ? f : Math.max(0, sceneFrames - 1);

        renderFrame(ctx, imageBitmap, scene, activeFrameIndex, sceneFrames, renderBrandKit, prevScene, canvasDims);

        if (brandKit.exportFormat === 'gif') {
          gifFrames.push(ctx.getImageData(0, 0, width, height));
        } else if (brandKit.exportFormat === 'png_sequence') {
          const blob = await getCanvasBlob(canvas, 'image/png');
          const buffer = await blob.arrayBuffer();
          pngBuffers.push(buffer);
        }

        if (isVideo) {
          const track = recorder._stream.getVideoTracks()[0];
          if (track && typeof track.requestFrame === 'function') {
            track.requestFrame();
          }
          const elapsed = performance.now() - frameStart;
          const targetDelay = 1000 / fps;
          const remainingDelay = Math.max(0, targetDelay - elapsed);
          await new Promise(resolve => setTimeout(resolve, remainingDelay));
        } else {
          // Yield to browser event loop to keep UI responsive and send messages
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        currentFrame++;
        const percent = 20 + Math.round((currentFrame / totalFrames) * 75);
        chrome.runtime.sendMessage({
          type: MSG.RENDER_PROGRESS,
          payload: {
            percent,
            status: `Rendering frame ${currentFrame}/${totalFrames} (Scene ${s + 1}/${scenes.length})...`
          },
        }).catch(() => {});
      }
    }

    // Append video end delay frames
    if (endDelayFrames > 0 && scenes.length > 0) {
      console.log('[Broll Offscreen] Rendering final video end delay frames: ' + endDelayFrames);
      const lastScene = scenes[scenes.length - 1];
      const lastSceneFrames = Math.ceil(lastScene.duration * fps);
      const lastPrevScene = scenes.length > 1 ? scenes[scenes.length - 2] : null;

      for (let f = 0; f < endDelayFrames; f++) {
        if (isCancelled) {
          throw new Error('Render cancelled by user');
        }

        const frameStart = performance.now();
        const lastFrameIndex = Math.max(0, lastSceneFrames - 1);
        renderFrame(ctx, imageBitmap, lastScene, lastFrameIndex, lastSceneFrames, renderBrandKit, lastPrevScene, canvasDims);

        if (brandKit.exportFormat === 'gif') {
          gifFrames.push(ctx.getImageData(0, 0, width, height));
        } else if (brandKit.exportFormat === 'png_sequence') {
          const blob = await getCanvasBlob(canvas, 'image/png');
          const buffer = await blob.arrayBuffer();
          pngBuffers.push(buffer);
        }

        if (isVideo) {
          const track = recorder._stream.getVideoTracks()[0];
          if (track && typeof track.requestFrame === 'function') {
            track.requestFrame();
          }
          const elapsed = performance.now() - frameStart;
          const targetDelay = 1000 / fps;
          const remainingDelay = Math.max(0, targetDelay - elapsed);
          await new Promise(resolve => setTimeout(resolve, remainingDelay));
        } else {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        currentFrame++;
        const percent = 20 + Math.round((currentFrame / totalFrames) * 75);
        chrome.runtime.sendMessage({
          type: MSG.RENDER_PROGRESS,
          payload: {
            percent,
            status: `Rendering final delay frames ${currentFrame}/${totalFrames}...`
          },
        }).catch(() => {});
      }
    }

    let blob;
    let filename = 'broll-video.webm';

    if (isVideo) {
      chrome.runtime.sendMessage({
        type: MSG.RENDER_PROGRESS,
        payload: { percent: 96, status: 'Compiling video...' },
      }).catch(() => {});
      console.log('[Broll Offscreen] All frames rendered, stopping recording');
      blob = await stopRecording(recorder);
      const actualType = blob.type || recorder.mimeType || '';
      filename = actualType.includes('mp4') ? 'broll-video.mp4' : 'broll-video.webm';
    } else if (brandKit.exportFormat === 'gif') {
      console.log('[Broll Offscreen] Compiling GIF from ' + gifFrames.length + ' frames');
      blob = await exportGif(gifFrames, width, height, fps, async (current, total) => {
        const percent = 96 + Math.round((current / total) * 3);
        chrome.runtime.sendMessage({
          type: MSG.RENDER_PROGRESS,
          payload: { percent, status: `Compiling GIF (frame ${current}/${total})...` },
        }).catch(() => {});
        // Yield to browser event loop
        await new Promise(resolve => setTimeout(resolve, 0));
      });
      filename = 'broll-video.gif';
    } else if (brandKit.exportFormat === 'png_sequence') {
      chrome.runtime.sendMessage({
        type: MSG.RENDER_PROGRESS,
        payload: { percent: 96, status: 'Compiling ZIP archive...' },
      }).catch(() => {});
      console.log('[Broll Offscreen] Compiling ZIP from ' + pngBuffers.length + ' PNG frames');
      blob = await exportPngSequence(pngBuffers);
      filename = 'broll-frames.zip';
    }

    chrome.runtime.sendMessage({
      type: MSG.RENDER_PROGRESS,
      payload: { percent: 100, status: 'Export complete! Downloading...' },
    }).catch(() => {});

    const blobUrl = URL.createObjectURL(blob);
    console.log('[Broll Offscreen] Recording complete, blob URL: ' + blobUrl + ' size: ' + blob.size);

    chrome.runtime.sendMessage({
      type: MSG.RENDER_COMPLETE,
      payload: { blobUrl, filename },
    }).catch(() => {});

    console.log('[Broll Offscreen] Render complete processed');
  } catch (err) {
    console.error('[Broll Offscreen] Render error:', err);
    if (recorder && recorder.state === 'recording') {
      try {
        recorder.stop();
        if (recorder._stream) {
          recorder._stream.getTracks().forEach(track => track.stop());
        }
      } catch (e) {}
    }
    chrome.runtime.sendMessage({
      type: MSG.RENDER_ERROR,
      payload: { message: err.message || 'Unknown render error' },
    }).catch(() => {});
  } finally {
    stopSilentAudio();
    if (typeof imageBitmap !== 'undefined' && imageBitmap) {
      imageBitmap.close();
    }
  }
}

function frameDelay(fps) {
  const delay = 1000 / (fps || 30);
  return new Promise((resolve) => setTimeout(resolve, delay));
}
