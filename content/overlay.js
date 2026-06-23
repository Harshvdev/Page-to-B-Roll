;(function () {
  'use strict';

  if (window.BrollOverlay) {
    return;
  }

  const BROLL_ROOT_ID = 'broll-root';
  const BROLL_SVG_ID = 'broll-svg-layer';
  const ACTIVE_CLASS = 'broll-active-mode';
  const MENU_CLASS = 'broll-selection-menu';
  const MENU_BTN_CLASS = 'broll-menu-btn';
  const MENU_CLOSE_CLASS = 'broll-menu-close';
  const RECT_CLASS = 'broll-selection-rect';
  const BADGE_CLASS = 'broll-scene-badge';

  let root = null;
  let svgLayer = null;
  let menu = null;
  let activeListeners = false;
  let mouseUpHandler = null;
  let sceneRects = [];

  function updateDimensions() {
    if (!root) return;
    const w = document.documentElement.scrollWidth || document.body.scrollWidth;
    const h = document.documentElement.scrollHeight || document.body.scrollHeight;
    root.style.width = w + 'px';
    root.style.height = h + 'px';
  }

  function init() {
    const existing = document.getElementById(BROLL_ROOT_ID);
    if (existing) {
      root = existing;
      svgLayer = document.getElementById(BROLL_SVG_ID);
      updateDimensions();
      return;
    }
    root = document.createElement('div');
    root.id = BROLL_ROOT_ID;
    document.body.appendChild(root);

    svgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgLayer.id = BROLL_SVG_ID;
    root.appendChild(svgLayer);

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
  }

  function activate() {
    document.body.classList.add(ACTIVE_CLASS);
    if (activeListeners) return;
    activeListeners = true;

    mouseUpHandler = function (e) {
      if (menu && menu.contains(e.target)) return;
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return;

      const rootRect = root.getBoundingClientRect();
      const offsetLeft = rootRect.left + window.scrollX;
      const offsetTop = rootRect.top + window.scrollY;
      const pageWidth = document.documentElement.scrollWidth || document.body.scrollWidth;
      const wordRects = getWordRectsForRange(range, offsetLeft, offsetTop);
      const clientRects = Array.from(range.getClientRects());
      const lineRects = clientRects.map(r => ({
        x: r.left + window.scrollX - offsetLeft,
        y: r.top + window.scrollY - offsetTop,
        width: r.width,
        height: r.height,
      }));

      showMenu(rect, {
        text: selection.toString().trim(),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        pageWidth: pageWidth,
        pageHeight: document.documentElement.scrollHeight || document.body.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        clientX: rect.left + window.scrollX - offsetLeft,
        clientY: rect.top + window.scrollY - offsetTop,
        rectWidth: rect.width,
        rectHeight: rect.height,
        wordRects: wordRects,
        lineRects: lineRects,
      });
    };

    document.addEventListener('mouseup', mouseUpHandler);
  }

  function deactivate() {
    document.body.classList.remove(ACTIVE_CLASS);
    if (mouseUpHandler) {
      document.removeEventListener('mouseup', mouseUpHandler);
      mouseUpHandler = null;
    }
    activeListeners = false;
    hideMenu();
  }

  function showMenu(selectionRect, selectionData) {
    hideMenu();

    menu = document.createElement('div');
    menu.className = MENU_CLASS;

    const label = document.createElement('span');
    label.textContent = '"' + selectionData.text.substring(0, 40) + (selectionData.text.length > 40 ? '…' : '') + '"';
    menu.appendChild(label);

    const addBtn = document.createElement('button');
    addBtn.className = MENU_BTN_CLASS;
    addBtn.textContent = 'Add to B-Roll';
    addBtn.addEventListener('click', function () {
      const payload = {
        text: selectionData.text,
        rect: {
          x: selectionData.clientX,
          y: selectionData.clientY,
          width: selectionData.rectWidth,
          height: selectionData.rectHeight,
          wordRects: selectionData.wordRects || [],
          lineRects: selectionData.lineRects || [],
        },
        scrollX: selectionData.scrollX,
        scrollY: selectionData.scrollY,
        pageWidth: selectionData.pageWidth,
        pageHeight: selectionData.pageHeight,
        viewportWidth: selectionData.viewportWidth,
        viewportHeight: selectionData.viewportHeight,
        url: window.location.href,
      };
      console.log('[Broll] Sending SELECTION_READY', payload);
      chrome.runtime.sendMessage({ type: 'SELECTION_READY', data: payload })
        .catch(function (err) {
          console.error('[Broll] SELECTION_READY sendMessage failed:', err);
        });
      hideMenu();
      window.getSelection().removeAllRanges();
    });
    menu.appendChild(addBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = MENU_CLOSE_CLASS;
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', hideMenu);
    menu.appendChild(closeBtn);

    document.body.appendChild(menu);

    const menuRect = menu.getBoundingClientRect();
    let top = selectionRect.top - menuRect.height - 8;
    let left = selectionRect.left + selectionRect.width / 2 - menuRect.width / 2;

    if (top < 8) top = selectionRect.bottom + 8;
    if (left < 8) left = 8;
    if (left + menuRect.width > window.innerWidth - 8) {
      left = window.innerWidth - menuRect.width - 8;
    }

    menu.style.top = Math.round(top) + 'px';
    menu.style.left = Math.round(left) + 'px';
  }

  function hideMenu() {
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
    }
    menu = null;
  }

  function addSceneRect(scene, sceneNumber) {
    if (!svgLayer) init();
    updateDimensions();
    const c = scene.coordinates;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.dataset.sceneId = scene.id;

    const highlightColor = scene.highlightColor || '#FFEB3B';

    if (c.lineRects && c.lineRects.length > 0) {
      c.lineRects.forEach(lr => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', RECT_CLASS);
        rect.setAttribute('x', String(lr.x));
        rect.setAttribute('y', String(lr.y));
        rect.setAttribute('width', String(lr.width));
        rect.setAttribute('height', String(lr.height));
        rect.style.fill = highlightColor;
        rect.style.fillOpacity = '0.35';
        rect.style.stroke = highlightColor;
        g.appendChild(rect);
      });
    } else {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('class', RECT_CLASS);
      rect.setAttribute('x', String(c.x));
      rect.setAttribute('y', String(c.y));
      rect.setAttribute('width', String(c.width));
      rect.setAttribute('height', String(c.height));
      rect.style.fill = highlightColor;
      rect.style.fillOpacity = '0.35';
      rect.style.stroke = highlightColor;
      g.appendChild(rect);
    }

    const badge = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    badge.setAttribute('class', BADGE_CLASS);
    const badgeX = (c.lineRects && c.lineRects.length > 0) ? c.lineRects[0].x : c.x;
    const badgeY = (c.lineRects && c.lineRects.length > 0) ? c.lineRects[0].y : c.y;
    badge.setAttribute('x', String(badgeX + 4));
    badge.setAttribute('y', String(badgeY + 14));
    badge.textContent = String(sceneNumber);
    g.appendChild(badge);

    svgLayer.appendChild(g);
    sceneRects.push(g);
  }

  function clearSceneRects() {
    for (const g of sceneRects) {
      if (g.parentNode) g.parentNode.removeChild(g);
    }
    sceneRects = [];
  }

  function hide() {
    if (root) {
      root.style.display = 'none';
    }
  }

  function show() {
    if (root) {
      root.style.display = '';
    }
  }

  function getWordRectsForRange(range, offsetLeft, offsetTop) {
    const rects = [];
    const container = range.commonAncestorContainer;
    const doc = container.ownerDocument || document;

    if (container.nodeType === Node.TEXT_NODE) {
      getWordsFromTextNode(container, range.startOffset, range.endOffset, rects, offsetLeft, offsetTop);
      return rects;
    }

    const treeWalker = doc.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = treeWalker.nextNode())) {
      const nodeRange = doc.createRange();
      try {
        nodeRange.selectNodeContents(node);
        if (!range.intersectsNode(node)) {
          continue;
        }

        let startIdx = 0;
        let endIdx = node.nodeValue.length;

        if (node === range.startContainer) {
          startIdx = range.startOffset;
        }
        if (node === range.endContainer) {
          endIdx = range.endOffset;
        }

        getWordsFromTextNode(node, startIdx, endIdx, rects, offsetLeft, offsetTop);
      } catch (e) {
        console.error('[Broll] Error traversing text node:', e);
      }
    }
    return rects;
  }

  function getWordsFromTextNode(node, startIdx, endIdx, rects, offsetLeft, offsetTop) {
    const text = node.nodeValue;
    const regex = /[^\s]+/g;
    let match;
    const textSegment = text.substring(startIdx, endIdx);
    while ((match = regex.exec(textSegment)) !== null) {
      const wordStart = startIdx + match.index;
      const wordEnd = wordStart + match[0].length;

      const wordRange = node.ownerDocument.createRange();
      wordRange.setStart(node, wordStart);
      wordRange.setEnd(node, wordEnd);

      const clientRect = wordRange.getBoundingClientRect();
      if (clientRect && clientRect.width > 0 && clientRect.height > 0) {
        rects.push({
          word: match[0],
          x: clientRect.left + window.scrollX - offsetLeft,
          y: clientRect.top + window.scrollY - offsetTop,
          width: clientRect.width,
          height: clientRect.height,
        });
      }
    }
  }

  function destroy() {
    deactivate();
    clearSceneRects();
    window.removeEventListener('resize', updateDimensions);
    const existing = root || document.getElementById(BROLL_ROOT_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    root = null;
    svgLayer = null;
  }

  window.BrollOverlay = {
    init: init,
    activate: activate,
    deactivate: deactivate,
    addSceneRect: addSceneRect,
    clearSceneRects: clearSceneRects,
    destroy: destroy,
    hide: hide,
    show: show,
  };
})();
