;(function () {
  'use strict';

  var MSG_TYPES = {
    ACTIVATE_SELECTION: 'ACTIVATE_SELECTION',
    DEACTIVATE_SELECTION: 'DEACTIVATE_SELECTION',
    HIDE_OVERLAY: 'HIDE_OVERLAY',
    SHOW_OVERLAY: 'SHOW_OVERLAY',
    GET_PAGE_DIMENSIONS: 'GET_PAGE_DIMENSIONS',
    SCROLL_TAB: 'SCROLL_TAB',
    REDRAW_SCENE_RECTS: 'REDRAW_SCENE_RECTS',
  };

  function handleMessage(message, sender, sendResponse) {
    var type = message.type;
    var overlay = window.BrollOverlay;

    if (!overlay) {
      console.error('BrollOverlay not available');
      return false;
    }

    switch (type) {
      case MSG_TYPES.ACTIVATE_SELECTION:
        overlay.activate();
        return false;

      case MSG_TYPES.DEACTIVATE_SELECTION:
        overlay.deactivate();
        return false;

      case MSG_TYPES.HIDE_OVERLAY:
        if (typeof overlay.hide === 'function') overlay.hide();
        return false;

      case MSG_TYPES.SHOW_OVERLAY:
        if (typeof overlay.show === 'function') overlay.show();
        return false;

      case MSG_TYPES.GET_PAGE_DIMENSIONS:
        sendResponse({
          pageWidth: document.documentElement.scrollWidth || document.body.scrollWidth,
          pageHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
          scrollHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
        });
        return true;

      case MSG_TYPES.SCROLL_TAB:
        window.scrollTo({ top: message.payload.y, behavior: 'instant' });
        sendResponse({ type: 'SCROLL_COMPLETE' });
        return true;

      case MSG_TYPES.REDRAW_SCENE_RECTS:
        overlay.clearSceneRects();
        if (Array.isArray(message.payload)) {
          message.payload.forEach(function (scene, i) {
            if (scene.url === window.location.href) {
              overlay.addSceneRect(scene, i + 1);
            }
          });
        }
        return false;

      default:
        return false;
    }
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
