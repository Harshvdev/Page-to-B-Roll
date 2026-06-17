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

  var modifiedElements = [];
  var scrollStyleOverride = null;

  function disableSmoothScrolling() {
    if (!scrollStyleOverride) {
      scrollStyleOverride = document.createElement('style');
      scrollStyleOverride.id = 'broll-capture-scroll-override';
      scrollStyleOverride.textContent = '\n        html, body {\n          scroll-behavior: auto !important;\n        }\n      ';
      document.documentElement.appendChild(scrollStyleOverride);
    }
  }

  function restoreSmoothScrolling() {
    if (scrollStyleOverride && scrollStyleOverride.parentNode) {
      scrollStyleOverride.parentNode.removeChild(scrollStyleOverride);
    }
    scrollStyleOverride = null;
  }

  function disableFloatingElements() {
    if (modifiedElements.length > 0) {
      restoreFloatingElements();
    }
    modifiedElements = [];

    function walk(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        try {
          var style = window.getComputedStyle(node);
          var position = style.position;
          if (position === 'fixed' || position === 'sticky') {
            modifiedElements.push({
              element: node,
              position: node.style.position
            });
            if (position === 'fixed') {
              node.style.setProperty('position', 'absolute', 'important');
            } else if (position === 'sticky') {
              node.style.setProperty('position', 'static', 'important');
            }
          }
        } catch (e) {}
      }

      if (node.shadowRoot) {
        walk(node.shadowRoot);
      }

      var child = node.firstChild;
      while (child) {
        walk(child);
        child = child.nextSibling;
      }
    }

    walk(document.documentElement);
  }

  function restoreFloatingElements() {
    modifiedElements.forEach(function (item) {
      try {
        if (item.position) {
          item.element.style.setProperty('position', item.position);
        } else {
          item.element.style.removeProperty('position');
        }
      } catch (e) {}
    });
    modifiedElements = [];
  }

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
        disableSmoothScrolling();
        disableFloatingElements();
        return false;

      case MSG_TYPES.SHOW_OVERLAY:
        if (typeof overlay.show === 'function') overlay.show();
        restoreFloatingElements();
        restoreSmoothScrolling();
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
        var actualY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
        sendResponse({ type: 'SCROLL_COMPLETE', actualY: actualY });
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
