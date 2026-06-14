import { MSG, STORAGE, DEFAULTS } from '../lib/constants.js';
import { getLicense, saveLicense, incrementExportCount } from '../lib/storage.js';
import { activateKey, canExport, getCachedTier, getRemainingFreeExports } from '../lib/license.js';

let activeTabId = null;

chrome.tabs.onActivated.addListener((activeInfo) => {
  activeTabId = activeInfo.tabId;
  console.log('[Broll SW] activeTabId set to:', activeTabId);
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

function calculateStripOffsets(pageHeight, viewportHeight) {
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
      const response = await chrome.runtime.sendMessage({ type: 'PING' });
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
    if (!exists) {
      await chrome.offscreen.createDocument({
        url: chrome.runtime.getURL('offscreen/offscreen.html'),
        reasons: ['BLOBS'],
        justification: 'Rendering video frames to canvas',
      });
    }
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

async function captureFullPage(tabId) {
  const targetTabId = tabId || activeTabId;
  if (!targetTabId) throw new Error('[Broll SW] No active tab found for capture');

  console.log('[Broll SW] captureFullPage starting for tabId:', targetTabId);
  const dims = await chrome.tabs.sendMessage(targetTabId, { type: MSG.GET_PAGE_DIMENSIONS });
  console.log('[Broll SW] Page dimensions:', dims);
  const pageWidth = dims.pageWidth;
  const pageHeight = dims.scrollHeight;
  const viewportHeight = dims.viewportHeight;
  const dpr = dims.devicePixelRatio || 1;

  const offsets = calculateStripOffsets(pageHeight, viewportHeight);
  console.log('[Broll SW] Capture offsets:', offsets);
  const strips = [];

  for (const scrollY of offsets) {
    await chrome.tabs.sendMessage(targetTabId, { type: MSG.SCROLL_TAB, payload: { y: scrollY } });
    await sleep(1500);
    const win = await chrome.tabs.get(targetTabId);
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
    console.log('[Broll SW] Captured strip at y=' + scrollY + ', base64 length:', base64.length);
  }

  await chrome.tabs.sendMessage(targetTabId, { type: MSG.SCROLL_TAB, payload: { y: 0 } });
  console.log('[Broll SW] captureFullPage done, strips:', strips.length);

  return { strips, pageWidth, pageHeight, devicePixelRatio: dpr };
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
    forwardToSidePanel(message);
    return false;
  }

  if (type === MSG.RENDER_VIDEO) {
    console.log('[Broll SW] RENDER_VIDEO received from side panel');
    (async () => {
      try {
        const can = await canExport();
        if (!can) {
          console.log('[Broll SW] Export limit reached, rejecting');
          sendResponse({ error: 'Export limit reached' });
          return;
        }

        let tabId = activeTabId;
        if (message.payload.scenes && message.payload.scenes.length > 0) {
          tabId = message.payload.scenes[0].tabId || activeTabId;
        }
        console.log('[Broll SW] Starting full-page capture for tabId:', tabId);
        const captureResult = await captureFullPage(tabId);

        console.log('[Broll SW] Ensuring offscreen document');
        await ensureOffscreenDocument();
        await pingOffscreen();

        const renderJob = {
          scenes: message.payload.scenes,
          strips: captureResult.strips,
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
    return false;
  }

  if (type === MSG.RENDER_COMPLETE) {
    (async () => {
      await incrementExportCount();
      await closeOffscreenDocument();
      forwardToSidePanel(message);
    })();
    return false;
  }

  if (type === MSG.RENDER_ERROR) {
    (async () => {
      await closeOffscreenDocument();
      forwardToSidePanel(message);
    })();
    return false;
  }

  if (type === 'REDRAW_SCENE_RECTS') {
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
