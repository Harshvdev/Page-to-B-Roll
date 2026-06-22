import { MSG, STORAGE, DEFAULTS } from '../lib/constants.js';
import { incrementExportCount } from '../lib/storage.js';
import { activateKey, canExport, getCachedTier, getRemainingFreeExports } from '../lib/license.js';
import { calculateStripOffsets } from '../lib/capture.js';

let activeTabId = null;
let exportGeneration = 0;

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  console.log('[Broll SW] activeTabId set to:', activeTabId);
  try {
    const tab = await chrome.tabs.get(activeTabId);
    if (!tab) return;

    // Check if extension is enabled
    const enabledResult = await chrome.storage.local.get('broll_enabled');
    const enabled = enabledResult['broll_enabled'] !== false;
    if (!enabled) {
      console.log('[Broll SW] Extension is disabled. Ensuring effects are disabled on activated tab:', activeTabId);
      await chrome.tabs.sendMessage(activeTabId, { type: 'DISABLE_EFFECTS' }).catch(() => {});
      return;
    }

    // 1. Sync capturing state if active
    const result = await chrome.storage.local.get(STORAGE.CAPTURING);
    if (result[STORAGE.CAPTURING]) {
      console.log('[Broll SW] Capturing is active, sending ACTIVATE_SELECTION to activated tab:', activeTabId);
      await chrome.tabs.sendMessage(activeTabId, { type: MSG.ACTIVATE_SELECTION }).catch(() => {});
    }

    // 2. Redraw scene rects for the page
    const scenesResult = await chrome.storage.local.get(STORAGE.SCENES);
    const scenes = scenesResult[STORAGE.SCENES];
    if (Array.isArray(scenes) && scenes.length > 0) {
      console.log('[Broll SW] Tab activated, sending REDRAW_SCENE_RECTS to tab:', activeTabId);
      await chrome.tabs.sendMessage(activeTabId, { type: MSG.REDRAW_SCENE_RECTS, payload: scenes }).catch(() => {});
    }

    // 3. Sync aspect ratio style if side panel is open
    const sidepanelResult = await chrome.storage.local.get('broll_sidepanel_open');
    if (sidepanelResult['broll_sidepanel_open']) {
      const kitResult = await chrome.storage.local.get(STORAGE.BRAND_KIT);
      const kit = kitResult[STORAGE.BRAND_KIT] || {};
      const ratio = kit.aspectRatio || '16:9';
      console.log('[Broll SW] Tab activated, sending SET_ASPECT_RATIO_STYLE to tab:', activeTabId);
      await chrome.tabs.sendMessage(activeTabId, {
        type: MSG.SET_ASPECT_RATIO_STYLE,
        payload: { aspectRatio: ratio }
      }).catch(() => {});
    }
  } catch (err) {
    console.error('[Broll SW] onActivated handlers error:', err);
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    try {
      // Check if extension is enabled
      const enabledResult = await chrome.storage.local.get('broll_enabled');
      const enabled = enabledResult['broll_enabled'] !== false;
      if (!enabled) {
        console.log('[Broll SW] Extension is disabled. Ensuring effects are disabled on updated tab:', tabId);
        await chrome.tabs.sendMessage(tabId, { type: 'DISABLE_EFFECTS' }).catch(() => {});
        return;
      }

      // 1. Sync capturing state if active
      const result = await chrome.storage.local.get(STORAGE.CAPTURING);
      if (result[STORAGE.CAPTURING]) {
        console.log('[Broll SW] Tab updated and completed, sending ACTIVATE_SELECTION to tab:', tabId);
        await chrome.tabs.sendMessage(tabId, { type: MSG.ACTIVATE_SELECTION }).catch(() => {});
      }
      
      // 2. Redraw scene rects for the page
      const scenesResult = await chrome.storage.local.get(STORAGE.SCENES);
      const scenes = scenesResult[STORAGE.SCENES];
      if (Array.isArray(scenes) && scenes.length > 0) {
        console.log('[Broll SW] Tab updated and completed, sending REDRAW_SCENE_RECTS to tab:', tabId);
        await chrome.tabs.sendMessage(tabId, { type: MSG.REDRAW_SCENE_RECTS, payload: scenes }).catch(() => {});
      }

      // 3. Sync aspect ratio style if side panel is open
      const sidepanelResult = await chrome.storage.local.get('broll_sidepanel_open');
      if (sidepanelResult['broll_sidepanel_open']) {
        const kitResult = await chrome.storage.local.get(STORAGE.BRAND_KIT);
        const kit = kitResult[STORAGE.BRAND_KIT] || {};
        const ratio = kit.aspectRatio || '16:9';
        console.log('[Broll SW] Tab updated and completed, sending SET_ASPECT_RATIO_STYLE to tab:', tabId);
        await chrome.tabs.sendMessage(tabId, {
          type: MSG.SET_ASPECT_RATIO_STYLE,
          payload: { aspectRatio: ratio }
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Broll SW] onUpdated handlers error:', err);
    }
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    console.log('[Broll SW] Extension icon clicked, opening side panel');
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (err) {
    console.error('[Broll SW] Failed to open side panel:', err);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) activeTabId = tabs[0].id;
    console.log('[Broll SW] Installed, activeTabId:', activeTabId);
  });
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveTabId() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? tab.id : activeTabId;
  } catch (err) {
    console.error('[Broll SW] Error querying active tab:', err);
    return activeTabId;
  }
}

async function pingOffscreen() {
  for (let i = 0; i < 15; i++) {
    try {
      const response = await chrome.runtime.sendMessage({ type: MSG.PING });
      if (response && response.pong) {
        console.log('[Broll SW] Offscreen document is ready (ping successful)');
        return true;
      }
    } catch (e) {
      // Ignored, wait and retry
    }
    await sleep(100);
  }
  console.warn('[Broll SW] Offscreen document ping handshake failed');
  return false;
}

async function ensureOffscreenDocument() {
  try {
    const exists = await chrome.offscreen.hasDocument();
    if (exists) {
      console.log('[Broll SW] Closing existing offscreen document to ensure fresh load');
      await chrome.offscreen.closeDocument();
    }
    console.log('[Broll SW] Creating fresh offscreen document');
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen/offscreen.html'),
      reasons: ['BLOBS', 'AUDIO_PLAYBACK'],
      justification: 'Rendering video frames to canvas with audio support to prevent background throttling',
    });
  } catch (err) {
    console.error('ensureOffscreenDocument error:', err);
  }
}

async function closeOffscreenDocument() {
  try {
    const exists = await chrome.offscreen.hasDocument();
    if (exists) {
      await chrome.offscreen.closeDocument();
    }
  } catch (err) {
    console.error('closeOffscreenDocument error:', err);
  }
}

async function captureFullPage(tabId, scenes) {
  const targetTabId = tabId || activeTabId;
  if (!targetTabId) throw new Error('[Broll SW] No active tab found for capture');

  console.log('[Broll SW] captureFullPage starting for tabId:', targetTabId);
  
  // Hide overlay during capture
  await chrome.tabs.sendMessage(targetTabId, { type: MSG.HIDE_OVERLAY }).catch(() => {});

  const dims = await chrome.tabs.sendMessage(targetTabId, { type: MSG.GET_PAGE_DIMENSIONS });
  console.log('[Broll SW] Page dimensions:', dims);
  const pageWidth = dims.pageWidth;
  const pageHeight = dims.scrollHeight;
  const viewportHeight = dims.viewportHeight;
  const dpr = dims.devicePixelRatio || 1;

  let captureHeight = pageHeight;
  if (Array.isArray(scenes) && scenes.length > 0) {
    let maxSceneY = 0;
    scenes.forEach(scene => {
      const coords = scene.coordinates;
      if (coords) {
        const bottom = (coords.y || 0) + (coords.height || 0);
        if (bottom > maxSceneY) {
          maxSceneY = bottom;
        }
      }
    });
    if (maxSceneY > 0) {
      captureHeight = Math.min(pageHeight, Math.max(viewportHeight, maxSceneY + viewportHeight * 1.5));
      console.log('[Broll SW] Clamping capture height to:', captureHeight, 'original pageHeight:', pageHeight);
    }
  }

  const offsets = calculateStripOffsets(captureHeight, viewportHeight);
  console.log('[Broll SW] Capture offsets:', offsets);
  const strips = [];
  const actualOffsets = [];

  for (let i = 0; i < offsets.length; i++) {
    const scrollY = offsets[i];
    const capturePercent = Math.round((i / offsets.length) * 20);
    forwardToSidePanel({
      type: MSG.RENDER_PROGRESS,
      payload: {
        percent: capturePercent,
        status: `Capturing page strip ${i + 1}/${offsets.length}...`
      }
    });

    const scrollResponse = await chrome.tabs.sendMessage(targetTabId, { type: MSG.SCROLL_TAB, payload: { y: scrollY } }).catch(() => {});
    const actualY = (scrollResponse && typeof scrollResponse.actualY === 'number') ? scrollResponse.actualY : scrollY;
    actualOffsets.push(actualY);

    await sleep(800);
    const win = await chrome.tabs.get(targetTabId);
    if (!win) throw new Error('Tab closed during capture');
    let dataUrl;
    for (let retry = 0; retry < 3; retry++) {
      try {
        dataUrl = await chrome.tabs.captureVisibleTab(win.windowId, { format: 'png' });
        break;
      } catch (capErr) {
        console.warn('[Broll SW] captureVisibleTab attempt ' + (retry + 1) + ' failed:', capErr.message);
        if (retry < 2) await sleep(2000 * (retry + 1));
        else throw capErr;
      }
    }
    const base64 = dataUrl.split(',')[1] || dataUrl;
    strips.push(base64);
    console.log('[Broll SW] Captured strip at y=' + scrollY + ' (actual=' + actualY + '), base64 length:', base64.length);
  }

  forwardToSidePanel({
    type: MSG.RENDER_PROGRESS,
    payload: {
      percent: 20,
      status: 'Preparing renderer...'
    }
  });

  await chrome.tabs.sendMessage(targetTabId, { type: MSG.SCROLL_TAB, payload: { y: 0 } });
  
  // Show overlay again after capture
  await chrome.tabs.sendMessage(targetTabId, { type: MSG.SHOW_OVERLAY }).catch(() => {});

  console.log('[Broll SW] captureFullPage done, strips:', strips.length);

  return { strips, actualOffsets, pageWidth, pageHeight: captureHeight, devicePixelRatio: dpr };
}

async function forwardToContent(tabId, message) {
  try {
    const id = tabId || activeTabId;
    if (id) {
      console.log('[Broll SW] Forwarding to content tab', id, ':', message.type);
      await chrome.tabs.sendMessage(id, message);
    } else {
      console.warn('[Broll SW] No tabId to forward content message:', message.type);
    }
  } catch (err) {
    console.error('[Broll SW] forwardToContent error:', err, 'tabId:', id);
  }
}

async function forwardToSidePanel(message) {
  try {
    console.log('[Broll SW] Forwarding to side panel:', message.type);
    await chrome.runtime.sendMessage(message);
    console.log('[Broll SW] Successfully forwarded to side panel:', message.type);
  } catch (err) {
    console.error('[Broll SW] forwardToSidePanel error:', err, 'message:', message.type);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const type = message.type;
  console.log('[Broll SW] Message received:', type, 'from tab:', sender.tab ? sender.tab.id : 'extension');

  if (type === MSG.ACTIVATE_SELECTION) {
    (async () => {
      const tabId = await getActiveTabId();
      console.log('[Broll SW] ACTIVATE_SELECTION, target tabId:', tabId);
      forwardToContent(tabId, message);
    })();
    return false;
  }

  if (type === MSG.DEACTIVATE_SELECTION) {
    (async () => {
      const tabId = await getActiveTabId();
      console.log('[Broll SW] DEACTIVATE_SELECTION, target tabId:', tabId);
      forwardToContent(tabId, message);
    })();
    return false;
  }

  if (type === MSG.SELECTION_READY) {
    console.log('[Broll SW] SELECTION_READY data:', message.data);
    if (sender.tab) {
      message.data.tabId = sender.tab.id;
    }
    message.fromBackground = true;
    forwardToSidePanel(message);
    return false;
  }

  if (type === MSG.RENDER_VIDEO) {
    exportGeneration++;
    console.log('[Broll SW] RENDER_VIDEO received from side panel');
    (async () => {
      try {
        const can = await canExport();
        if (!can) {
          console.log('[Broll SW] Export limit reached, rejecting');
          sendResponse({ error: 'Export limit reached' });
          return;
        }

        const tabId = await getActiveTabId();
        if (message.payload.scenes) {
          message.payload.scenes.forEach(scene => {
            scene.tabId = tabId;
          });
        }
        await chrome.storage.local.set({
          [STORAGE.EXPORT_ACTIVE]: true,
          [STORAGE.EXPORT_PROGRESS]: 0,
          [STORAGE.EXPORT_STATUS]: 'Initializing capture...',
        });
        console.log('[Broll SW] Starting full-page capture for tabId:', tabId);
        const captureResult = await captureFullPage(tabId, message.payload.scenes);

        console.log('[Broll SW] Ensuring offscreen document');
        await ensureOffscreenDocument();
        const ready = await pingOffscreen();
        if (!ready) {
          throw new Error('Offscreen document failed to initialize');
        }

        const renderJob = {
          scenes: message.payload.scenes,
          strips: captureResult.strips,
          actualOffsets: captureResult.actualOffsets,
          pageWidth: captureResult.pageWidth,
          pageHeight: captureResult.pageHeight,
          devicePixelRatio: captureResult.devicePixelRatio,
          brandKit: message.payload.brandKit,
          fps: DEFAULTS.FPS,
          license: message.payload.license,
        };

        console.log('[Broll SW] Forwarding render job to offscreen, scenes:', renderJob.scenes.length, 'strips:', renderJob.strips.length);
        await chrome.runtime.sendMessage({ type: MSG.START_RENDER, payload: renderJob });
        console.log('[Broll SW] Offscreen render message sent');
        sendResponse({ success: true });
      } catch (err) {
        console.error('[Broll SW] RENDER_VIDEO error:', err);
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (type === MSG.RENDER_PROGRESS) {
    forwardToSidePanel(message);
    (async () => {
      await chrome.storage.local.set({
        [STORAGE.EXPORT_PROGRESS]: message.payload.percent,
        [STORAGE.EXPORT_STATUS]: message.payload.status,
      }).catch(() => {});
    })();
    return false;
  }

  if (type === MSG.RENDER_COMPLETE) {
    const gen = exportGeneration;
    (async () => {
      if (gen !== exportGeneration) return;
      await chrome.storage.local.remove([
        STORAGE.EXPORT_ACTIVE,
        STORAGE.EXPORT_PROGRESS,
        STORAGE.EXPORT_STATUS
      ]).catch(() => {});
      await incrementExportCount();
      forwardToSidePanel(message);
      const { blobUrl, filename } = message.payload;
      console.log('[Broll SW] Initiating download of:', filename);

      chrome.downloads.download({ url: blobUrl, filename: filename }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('[Broll SW] download failed to start:', chrome.runtime.lastError.message);
          if (gen === exportGeneration) closeOffscreenDocument();
          return;
        }

        const listener = (delta) => {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
              console.log('[Broll SW] Download finished, status:', delta.state.current);
              chrome.downloads.onChanged.removeListener(listener);
              clearTimeout(failsafeTimer);
              setTimeout(() => {
                if (gen === exportGeneration) closeOffscreenDocument();
              }, 1000);
            }
          }
        };
        chrome.downloads.onChanged.addListener(listener);
        const failsafeTimer = setTimeout(() => {
          console.warn('[Broll SW] Download listener timeout, cleaning up');
          chrome.downloads.onChanged.removeListener(listener);
          if (gen === exportGeneration) closeOffscreenDocument();
        }, 30000); // 30s failsafe timer
      });
    })();
    return false;
  }

  if (type === MSG.RENDER_ERROR) {
    const gen = exportGeneration;
    (async () => {
      if (gen !== exportGeneration) return;
      await chrome.storage.local.remove([
        STORAGE.EXPORT_ACTIVE,
        STORAGE.EXPORT_PROGRESS,
        STORAGE.EXPORT_STATUS
      ]).catch(() => {});
      forwardToSidePanel(message);
      await closeOffscreenDocument();
    })();
    return false;
  }

  if (type === MSG.CANCEL_RENDER) {
    console.log('[Broll SW] CANCEL_RENDER received, forwarding to offscreen');
    (async () => {
      try {
        await chrome.runtime.sendMessage({ type: MSG.CANCEL_RENDER });
      } catch (e) {}
      await chrome.storage.local.remove([
        STORAGE.EXPORT_ACTIVE,
        STORAGE.EXPORT_PROGRESS,
        STORAGE.EXPORT_STATUS
      ]).catch(() => {});
    })();
    return false;
  }

  if (type === MSG.REDRAW_SCENE_RECTS) {
    (async () => {
      const tabId = await getActiveTabId();
      forwardToContent(tabId, message);
    })();
    return false;
  }

  if (type === MSG.LICENSE_ACTIVATE) {
    (async () => {
      const result = await activateKey(message.payload.key);
      const tier = await getCachedTier();
      sendResponse({ success: result, tier });
    })();
    return true;
  }

  if (type === MSG.LICENSE_STATUS) {
    (async () => {
      const tier = await getCachedTier();
      const remaining = await getRemainingFreeExports();
      sendResponse({ tier, remainingFreeExports: remaining });
    })();
    return true;
  }

  return false;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'broll-sidepanel') {
    console.log('[Broll SW] Side panel connected');
    chrome.storage.local.set({ broll_sidepanel_open: true }).catch(() => {});
    
    port.onDisconnect.addListener(async () => {
      console.log('[Broll SW] Side panel disconnected (closed)');
      chrome.storage.local.set({ broll_sidepanel_open: false }).catch(() => {});
      
      const tabId = await getActiveTabId();
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: MSG.SET_ASPECT_RATIO_STYLE,
          payload: { aspectRatio: null }
        }).catch(() => {});
      }
    });
  }
});
