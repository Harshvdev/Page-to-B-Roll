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
    SET_ASPECT_RATIO_STYLE: 'SET_ASPECT_RATIO_STYLE',
  };

  var modifiedElements = [];
  var scrollStyleOverride = null;
  var currentRatioStr = null;
  var aspectStyleOverride = null;
  var isExtensionActive = false;

  function updateAspectRatioStyle() {
    if (!currentRatioStr) {
      if (aspectStyleOverride && aspectStyleOverride.parentNode) {
        aspectStyleOverride.parentNode.removeChild(aspectStyleOverride);
      }
      aspectStyleOverride = null;
      document.documentElement.style.removeProperty('max-width');
      document.documentElement.style.removeProperty('margin');
      document.documentElement.style.removeProperty('box-shadow');
      document.documentElement.style.removeProperty('min-height');
      document.documentElement.style.removeProperty('background');
      document.body.style.removeProperty('max-width');
      document.body.style.removeProperty('margin');
      document.body.style.removeProperty('min-height');
      return;
    }

    var parts = currentRatioStr.split(':');
    var r = parseFloat(parts[0]) / parseFloat(parts[1]);
    if (isNaN(r)) return;

    var targetWidth = Math.round(window.innerHeight * r);

    if (!aspectStyleOverride) {
      aspectStyleOverride = document.createElement('style');
      aspectStyleOverride.id = 'broll-aspect-ratio-style';
      document.documentElement.appendChild(aspectStyleOverride);
    }

    aspectStyleOverride.textContent = '\n      html {\n        max-width: ' + targetWidth + 'px !important;\n        margin: 0 auto !important;\n        box-shadow: 0 0 20px rgba(0,0,0,0.6) !important;\n        min-height: 100vh !important;\n        background: #0d0d14 !important;\n      }\n      body {\n        max-width: 100% !important;\n        margin: 0 auto !important;\n        min-height: 100vh !important;\n      }\n    ';

    window.dispatchEvent(new Event('resize'));
  }

  function setAspectRatio(ratioStr) {
    currentRatioStr = ratioStr;
    updateAspectRatioStyle();
  }

  window.addEventListener('resize', function () {
    if (currentRatioStr) {
      updateAspectRatioStyle();
    }
  });

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

    if (type !== 'ENABLE_EFFECTS' && type !== 'DISABLE_EFFECTS' && !isExtensionActive) {
      console.log('[Broll] Ignoring message because sidepanel is closed or extension is disabled:', type);
      return false;
    }

    switch (type) {
      case 'DISABLE_EFFECTS':
        isExtensionActive = false;
        setAspectRatio(null);
        restoreFloatingElements();
        restoreSmoothScrolling();
        if (typeof overlay.destroy === 'function') {
          overlay.destroy();
        }
        return false;

      case 'ENABLE_EFFECTS':
        syncState();
        return false;

      case MSG_TYPES.ACTIVATE_SELECTION:
        overlay.activate();
        return false;

      case MSG_TYPES.DEACTIVATE_SELECTION:
        overlay.deactivate();
        return false;

      case MSG_TYPES.SET_ASPECT_RATIO_STYLE:
        setAspectRatio(message.payload ? message.payload.aspectRatio : null);
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
        var rootEl = document.getElementById('broll-root');
        var offsetLeftVal = 0;
        if (rootEl) {
          var rootRect = rootEl.getBoundingClientRect();
          offsetLeftVal = rootRect.left + window.scrollX;
        } else {
          var htmlRect = document.documentElement.getBoundingClientRect();
          offsetLeftVal = htmlRect.left + window.scrollX;
        }
        sendResponse({
          pageWidth: document.documentElement.scrollWidth || document.body.scrollWidth,
          pageHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
          scrollHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio || 1,
          offsetLeft: offsetLeftVal,
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

  function syncState() {
    try {
      chrome.storage.local.get(['broll_sidepanel_open', 'broll_brand_kit', 'broll_enabled', 'broll_capturing_active', 'broll_scenes'], function(result) {
        if (chrome.runtime.lastError) return;
        var enabled = result['broll_enabled'] !== false;
        var sidepanelOpen = !!result['broll_sidepanel_open'];
        var overlay = window.BrollOverlay;

        isExtensionActive = enabled && sidepanelOpen;

        if (!isExtensionActive) {
          setAspectRatio(null);
          restoreFloatingElements();
          restoreSmoothScrolling();
          if (overlay && typeof overlay.destroy === 'function') {
            overlay.destroy();
          }
          return;
        }

        if (overlay && typeof overlay.init === 'function') {
          overlay.init();
        }

        var kit = result['broll_brand_kit'] || {};
        var ratio = kit.aspectRatio || '16:9';
        setAspectRatio(ratio);
        
        if (result['broll_capturing_active']) {
          if (overlay && typeof overlay.activate === 'function') overlay.activate();
        } else {
          if (overlay && typeof overlay.deactivate === 'function') overlay.deactivate();
        }
        
        var scenes = result['broll_scenes'];
        if (overlay && typeof overlay.clearSceneRects === 'function') {
          overlay.clearSceneRects();
          if (Array.isArray(scenes)) {
            scenes.forEach(function (scene, i) {
              if (scene.url === window.location.href) {
                overlay.addSceneRect(scene, i + 1);
              }
            });
          }
        }
      });
    } catch (err) {
      console.error('[Broll] Error in syncState:', err);
    }
  }

  function init() {
    syncState();

    try {
      chrome.runtime.onMessage.addListener(handleMessage);
    } catch (err) {
      console.error('chrome.runtime.onMessage error:', err);
    }

    try {
      chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === 'local') {
          if (changes.broll_sidepanel_open || changes.broll_enabled || changes.broll_capturing_active || changes.broll_scenes) {
            syncState();
          }
        }
      });
    } catch (err) {
      console.error('chrome.storage.onChanged error:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
