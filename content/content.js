;(function () {
  'use strict';

  function handleMessage(message, sender, sendResponse) {
    const type = message.type;
    const overlay = window.BrollOverlay;

    if (!overlay) {
      console.error('BrollOverlay not available');
      return false;
    }

    switch (type) {
      case 'ACTIVATE_SELECTION':
        overlay.activate();
        break;

      case 'DEACTIVATE_SELECTION':
        overlay.deactivate();
        break;

      case 'GET_PAGE_DIMENSIONS':
        sendResponse({
          pageWidth: document.documentElement.scrollWidth || document.body.scrollWidth,
          pageHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
          scrollHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
        });
        break;

      case 'SCROLL_TAB':
        window.scrollTo({ top: message.payload.y, behavior: 'instant' });
        sendResponse({ type: 'SCROLL_COMPLETE' });
        break;

      case 'REDRAW_SCENE_RECTS':
        overlay.clearSceneRects();
        if (Array.isArray(message.payload)) {
          message.payload.forEach(function (scene, i) {
            overlay.addSceneRect(scene, i + 1);
          });
        }
        break;

      default:
        break;
    }

    return true;
  }

  function init() {
    try {
      if (window.BrollOverlay) {
        window.BrollOverlay.init();
      }
    } catch (err) {
      console.error('BrollOverlay init error:', err);
    }

    try {
      chrome.runtime.onMessage.addListener(handleMessage);
    } catch (err) {
      console.error('chrome.runtime.onMessage error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
