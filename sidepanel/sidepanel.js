import { MSG, PRESET, DEFAULTS, TIER, STORAGE } from '../lib/constants.js';
import {
  getScenes, saveScenes, clearScenes,
  getBrandKit, saveBrandKit,
  getLicense, getProjects, saveProject, deleteProject,
} from '../lib/storage.js';
import { PRESETS } from '../lib/presets.js';

let scenes = [];
let brandKit = {};
let selectedSceneId = null;
let isCapturing = false;
let licenseState = {};

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Broll Panel] DOMContentLoaded');
  scenes = await getScenes();
  brandKit = await getBrandKit();
  brandKit.watermark = false; // Always keep watermark disabled/off
  await saveBrandKit(brandKit);
  licenseState = await getLicense();

  const storedCapturing = await chrome.storage.local.get(STORAGE.CAPTURING);
  isCapturing = !!storedCapturing[STORAGE.CAPTURING];
  const btn = document.getElementById('btn-activate');
  if (isCapturing) {
    btn.textContent = 'Stop Capturing';
    btn.classList.add('active');
  } else {
    btn.textContent = 'Capture Selection';
    btn.classList.remove('active');
  }

  console.log('[Broll Panel] Loaded scenes:', scenes.length, 'brandKit:', brandKit, 'license:', licenseState.tier, 'isCapturing:', isCapturing);

  if (scenes.length > 0) {
    selectScene(scenes[0].id);
  } else {
    selectScene(null);
  }
  forwardRedrawSceneRects();

  populateBrandKitControls();
  updateTierBadge();
  updateExportCounter();
  setupEventListeners();
  renderProjectList();

  if (brandKit && brandKit.aspectRatio) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MSG.SET_ASPECT_RATIO_STYLE,
          payload: { aspectRatio: brandKit.aspectRatio }
        }).catch(() => {});
      }
    });
  }

  try {
    chrome.runtime.connect({ name: 'broll-sidepanel' });
  } catch (err) {
    console.error('[Broll Panel] Port connection to background worker failed:', err);
  }

  const storedExport = await chrome.storage.local.get([
    STORAGE.EXPORT_ACTIVE,
    STORAGE.EXPORT_PROGRESS,
    STORAGE.EXPORT_STATUS
  ]);
  if (storedExport[STORAGE.EXPORT_ACTIVE]) {
    setExportingUI(
      storedExport[STORAGE.EXPORT_PROGRESS] || 0,
      storedExport[STORAGE.EXPORT_STATUS] || 'Rendering...'
    );
  } else {
    resetExportUI();
  }
});

function setupEventListeners() {
  document.getElementById('btn-activate').addEventListener('click', onActivateClick);
  document.getElementById('btn-clear-scenes').addEventListener('click', onClearScenes);
  document.getElementById('duration-slider').addEventListener('input', onDurationChange);
  document.getElementById('zoom-level-slider').addEventListener('input', onZoomLevelChange);
  document.getElementById('zoom-duration-slider').addEventListener('input', onZoomDurationChange);
  document.getElementById('highlight-delay-slider').addEventListener('input', onHighlightDelayChange);
  document.getElementById('start-delay-slider').addEventListener('input', onStartDelayChange);
  document.getElementById('pause-duration-slider').addEventListener('input', onPauseDurationChange);
  document.getElementById('color-highlight').addEventListener('input', onHighlightColorChange);
  document.getElementById('color-box').addEventListener('input', onBoxColorChange);
  document.getElementById('transition-select').addEventListener('change', onTransitionChange);
  document.getElementById('highlight-pace-select').addEventListener('change', onHighlightPaceChange);
  document.getElementById('aspect-ratio').addEventListener('change', onAspectRatioChange);
  document.getElementById('resolution').addEventListener('change', onResolutionChange);
  document.getElementById('export-format').addEventListener('change', onExportFormatChange);
  document.getElementById('video-end-delay-slider').addEventListener('input', onVideoEndDelayChange);
  document.getElementById('logo-upload').addEventListener('change', onLogoUpload);
  document.getElementById('watermark-toggle').addEventListener('change', onWatermarkToggle);
  document.getElementById('btn-export').addEventListener('click', onExportClick);
  document.getElementById('btn-activate-license').addEventListener('click', onActivateLicense);
  document.getElementById('btn-save-project').addEventListener('click', onSaveProject);

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  console.log('[Broll Panel] Listeners set up');
}

function onZoomLevelChange(e) {
  const val = parseFloat(e.target.value);
  document.getElementById('zoom-level-val').textContent = val.toFixed(1) + 'x';
  if (!selectedSceneId) return;
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.zoomLevel = val;
    saveScenes(scenes);
    console.log('[Broll Panel] Zoom level set to ' + val + 'x for scene', selectedSceneId);
  }
}

function onZoomDurationChange(e) {
  const val = parseFloat(e.target.value);
  document.getElementById('zoom-duration-val').textContent = val.toFixed(1) + 's';
  if (!selectedSceneId) return;
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.zoomDuration = val;
    saveScenes(scenes);
    console.log('[Broll Panel] Zoom duration set to ' + val + 's for scene', selectedSceneId);
  }
}

function onHighlightDelayChange(e) {
  const val = parseFloat(e.target.value);
  document.getElementById('highlight-delay-val').textContent = val.toFixed(1) + 's';
  if (!selectedSceneId) return;
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.highlightDelay = val;
    saveScenes(scenes);
    console.log('[Broll Panel] Highlight delay set to ' + val + 's for scene', selectedSceneId);
  }
}

function onStartDelayChange(e) {
  const val = parseFloat(e.target.value);
  document.getElementById('start-delay-val').textContent = val.toFixed(1) + 's';
  if (!selectedSceneId) return;
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.startDelay = val;
    saveScenes(scenes);
    console.log('[Broll Panel] Start delay set to ' + val + 's for scene', selectedSceneId);
  }
}

function onPauseDurationChange(e) {
  const val = parseFloat(e.target.value);
  document.getElementById('pause-duration-val').textContent = val.toFixed(1) + 's';
  if (!selectedSceneId) return;
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.pauseDuration = val;
    saveScenes(scenes);
    renderTimeline();
    console.log('[Broll Panel] Pause duration set to ' + val + 's for scene', selectedSceneId);
  }
}

function onHighlightPaceChange(e) {
  if (!selectedSceneId) return;
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.highlightPace = e.target.value;
    saveScenes(scenes);
    console.log('[Broll Panel] Highlight pace set to ' + e.target.value + ' for scene', selectedSceneId);
  }
}

function togglePresetSettings(preset, thumb) {
  const panel = document.getElementById('preset-settings-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    panel.style.display = 'none';
  }
}

async function onActivateClick() {
  isCapturing = !isCapturing;
  await chrome.storage.local.set({ [STORAGE.CAPTURING]: isCapturing });
  const btn = document.getElementById('btn-activate');

  if (isCapturing) {
    btn.textContent = 'Stop Capturing';
    btn.classList.add('active');
    try {
      await chrome.runtime.sendMessage({ type: MSG.ACTIVATE_SELECTION });
    } catch (err) {
      console.error('ACTIVATE_SELECTION error:', err);
    }
  } else {
    btn.textContent = 'Capture Selection';
    btn.classList.remove('active');
    try {
      await chrome.runtime.sendMessage({ type: MSG.DEACTIVATE_SELECTION });
    } catch (err) {
      console.error('DEACTIVATE_SELECTION error:', err);
    }
  }
}

function onClearScenes() {
  scenes = [];
  selectedSceneId = null;
  clearScenes();
  renderSceneQueue();
  renderTimeline();
  updateStyleControlsDisabled();
  forwardRedrawSceneRects();
  console.log('[Broll Panel] Scenes cleared');
}

function onDurationChange(e) {
  const val = parseInt(e.target.value, 10);
  document.getElementById('duration-val').textContent = val + 's';
  if (!selectedSceneId) { console.log('[Broll Panel] Duration change ignored — no scene selected'); return; }
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.duration = val;
    saveScenes(scenes);
    renderTimeline();
    console.log('[Broll Panel] Duration set to ' + val + 's for scene', selectedSceneId);
  }
}

function onHighlightColorChange(e) {
  if (!selectedSceneId) { console.log('[Broll Panel] Color change ignored — no scene selected'); return; }
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.highlightColor = e.target.value;
    saveScenes(scenes);
    console.log('[Broll Panel] Highlight color set to ' + e.target.value + ' for scene', selectedSceneId);
  }
}

function onBoxColorChange(e) {
  if (!selectedSceneId) { console.log('[Broll Panel] Box color change ignored — no scene selected'); return; }
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.boxColor = e.target.value;
    saveScenes(scenes);
    console.log('[Broll Panel] Box color set to ' + e.target.value + ' for scene', selectedSceneId);
  }
}

function onTransitionChange(e) {
  if (!selectedSceneId) { console.log('[Broll Panel] Transition change ignored — no scene selected'); return; }
  const scene = scenes.find(s => s.id === selectedSceneId);
  if (scene) {
    scene.transition = e.target.value;
    saveScenes(scenes);
    console.log('[Broll Panel] Transition set to ' + e.target.value + ' for scene', selectedSceneId);
  }
}

function onAspectRatioChange(e) {
  brandKit.aspectRatio = e.target.value;
  saveBrandKit(brandKit);

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: MSG.SET_ASPECT_RATIO_STYLE,
        payload: { aspectRatio: e.target.value }
      }).catch(function (err) {
        console.warn('[Broll Panel] Failed to send SET_ASPECT_RATIO_STYLE:', err);
      });
    }
  });
}

function onResolutionChange(e) {
  brandKit.resolution = e.target.value;
  saveBrandKit(brandKit);
}

function onExportFormatChange(e) {
  brandKit.exportFormat = e.target.value;
  saveBrandKit(brandKit);
}

function onVideoEndDelayChange(e) {
  const val = parseFloat(e.target.value);
  document.getElementById('video-end-delay-val').textContent = val.toFixed(1) + 's';
  brandKit.videoEndDelay = val;
  saveBrandKit(brandKit);
  console.log('[Broll Panel] Video end delay set to ' + val + 's');
}

function onLogoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    brandKit.logoDataUrl = evt.target.result;
    saveBrandKit(brandKit);
  };
  reader.readAsDataURL(file);
}

function onWatermarkToggle(e) {
  brandKit.watermark = e.target.checked;
  if (licenseState.tier === TIER.FREE) {
    brandKit.watermark = true;
    e.target.checked = true;
  }
  saveBrandKit(brandKit);
}

function setExportingUI(progressVal, statusMsg) {
  const btn = document.getElementById('btn-export');
  const progress = document.getElementById('export-progress');
  const statusText = document.getElementById('export-status');
  
  if (btn) {
    btn.textContent = 'Cancel Export';
    btn.classList.add('cancelling');
    btn.disabled = false;
  }
  if (progress) {
    progress.style.display = 'block';
    progress.value = progressVal;
  }
  if (statusText) {
    statusText.style.display = 'block';
    statusText.textContent = statusMsg;
  }
}

function resetExportUI() {
  const btn = document.getElementById('btn-export');
  const progress = document.getElementById('export-progress');
  const statusText = document.getElementById('export-status');

  if (btn) {
    btn.textContent = 'Export Video';
    btn.classList.remove('cancelling');
    btn.disabled = false;
  }
  if (progress) {
    progress.style.display = 'none';
  }
  if (statusText) {
    statusText.style.display = 'none';
  }
}

async function cancelExport() {
  console.log('[Broll Panel] Cancelling export');
  try {
    await chrome.runtime.sendMessage({ type: MSG.CANCEL_RENDER });
  } catch (err) {
    console.error('[Broll Panel] CANCEL_RENDER send error:', err);
  }
  resetExportUI();
  chrome.storage.local.remove([
    STORAGE.EXPORT_ACTIVE,
    STORAGE.EXPORT_PROGRESS,
    STORAGE.EXPORT_STATUS
  ]).catch(() => {});
}

async function onExportClick() {
  const btn = document.getElementById('btn-export');
  if (btn.classList.contains('cancelling')) {
    await cancelExport();
    return;
  }

  if (scenes.length === 0) {
    alert('Add at least one scene before exporting.');
    return;
  }

  setExportingUI(0, 'Initializing capture...');

  console.log('[Broll Panel] Sending RENDER_VIDEO, scenes:', scenes.length);
  try {
    const response = await chrome.runtime.sendMessage({
      type: MSG.RENDER_VIDEO,
      payload: {
        scenes,
        brandKit,
        license: licenseState,
      },
    });
    console.log('[Broll Panel] RENDER_VIDEO response:', response);
    if (response && response.error) {
      console.error('[Broll Panel] Export rejected:', response.error);
      resetExportUI();
      alert('Export failed: ' + response.error);
    }
  } catch (err) {
    console.error('[Broll Panel] RENDER_VIDEO send error:', err);
    resetExportUI();
  }
}

async function onActivateLicense() {
  const input = document.getElementById('license-key-input');
  const status = document.getElementById('license-status');
  const key = input.value.trim();
  if (!key) {
    status.textContent = 'Please enter a license key.';
    return;
  }

  status.textContent = 'Activating...';
  try {
    const response = await chrome.runtime.sendMessage({
      type: MSG.LICENSE_ACTIVATE,
      payload: { key },
    });
    if (response && response.success) {
      licenseState = await getLicense();
      status.textContent = 'Pro activated!';
      updateTierBadge();
      renderPresetGrid(selectedSceneId ? scenes.find(s => s.id === selectedSceneId)?.presetId : null, false);
      populateBrandKitControls();
    } else {
      status.textContent = 'Invalid or expired license key.';
    }
  } catch (err) {
    console.error('LICENSE_ACTIVATE error:', err);
    status.textContent = 'Network error. Please try again.';
  }
}

async function onSaveProject() {
  if (scenes.length === 0) {
    alert('Add scenes before saving a project.');
    return;
  }
  const name = 'Project ' + new Date().toLocaleDateString();
  const project = {
    id: crypto.randomUUID(),
    name,
    scenes: [...scenes],
    brandKit: { ...brandKit },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveProject(project);
  renderProjectList();
}

function onRuntimeMessage(message) {
  const type = message.type;
  console.log('[Broll Panel] Message received:', type, JSON.stringify(message).substring(0, 200));

  if (type === MSG.SELECTION_READY) {
    if (!message.fromBackground) {
      console.log('[Broll Panel] SELECTION_READY received directly from content script, ignoring (waiting for background SW enrichment)');
      return;
    }
    console.log('[Broll Panel] Building scene from data:', message.data);
    const scene = buildScene(message.data);
    console.log('[Broll Panel] Scene built:', { id: scene.id, text: scene.text, coords: scene.coordinates });
    scenes.push(scene);
    saveScenes(scenes).then(function () {
      console.log('[Broll Panel] Scenes saved, total count:', scenes.length);
    }).catch(function (err) {
      console.error('[Broll Panel] saveScenes failed:', err);
    });
    renderSceneQueue();
    renderTimeline();
    selectScene(scene.id);
    forwardRedrawSceneRects();
    return;
  }

  if (type === MSG.RENDER_PROGRESS) {
    const pct = message.payload.percent || 0;
    const status = message.payload.status || '';
    console.log('[Broll Panel] RENDER_PROGRESS: ' + pct + '% - ' + status);
    setExportingUI(pct, status);
    return;
  }

  if (type === MSG.RENDER_COMPLETE) {
    console.log('[Broll Panel] RENDER_COMPLETE received, blobUrl:', message.payload ? message.payload.blobUrl : 'none');
    resetExportUI();
    updateExportCounter();
    return;
  }

  if (type === MSG.RENDER_ERROR) {
    console.error('[Broll Panel] RENDER_ERROR received:', message.payload);
    resetExportUI();
    const errMsg = message.payload ? message.payload.message : 'Unknown error';
    if (errMsg !== 'Render cancelled by user') {
      alert('Render error: ' + errMsg);
    }
    return;
  }

  console.log('[Broll Panel] Unhandled message type:', type);
}

function forwardRedrawSceneRects() {
  chrome.runtime.sendMessage({
    type: MSG.REDRAW_SCENE_RECTS,
    payload: scenes,
  }).catch(function (err) {
    console.error('[Broll Panel] forwardRedrawSceneRects error:', err);
  });
}

function buildScene(data) {
  const rect = data.rect || {};
  return {
    id: crypto.randomUUID(),
    url: data.url || window.location.href,
    tabId: data.tabId || 0,
    coordinates: {
      x: rect.x || 0,
      y: rect.y || 0,
      width: rect.width || 0,
      height: rect.height || 0,
      pageWidth: data.pageWidth || 0,
      pageHeight: data.pageHeight || 0,
      viewportWidth: data.viewportWidth || 0,
      viewportHeight: data.viewportHeight || 0,
      wordRects: rect.wordRects || [],
      lineRects: rect.lineRects || [],
    },
    presetId: PRESET.HIGHLIGHT_ZOOM,
    duration: DEFAULTS.SCENE_DURATION,
    zoomLevel: DEFAULTS.ZOOM_LEVEL,
    zoomDuration: DEFAULTS.ZOOM_DURATION,
    highlightDelay: DEFAULTS.HIGHLIGHT_DELAY,
    startDelay: DEFAULTS.START_DELAY,
    pauseDuration: DEFAULTS.PAUSE_DURATION,
    highlightPace: 'smooth',
    text: data.text || '',
    highlightColor: DEFAULTS.HIGHLIGHT_COLOR,
    boxColor: DEFAULTS.BOX_COLOR,
    transition: 'dissolve',
    order: scenes.length,
    createdAt: Date.now(),
  };
}

function renderSceneQueue() {
  console.log('[Broll Panel] renderSceneQueue, scenes:', scenes.length);
  const queue = document.getElementById('scene-queue');
  const emptyState = document.getElementById('scene-empty-state');

  queue.innerHTML = '';
  queue.appendChild(emptyState);

  if (scenes.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  scenes.forEach((scene, i) => {
    const card = document.createElement('div');
    card.className = 'scene-card' + (scene.id === selectedSceneId ? ' selected' : '');
    card.dataset.sceneId = scene.id;

    const title = document.createElement('div');
    title.className = 'scene-card-title';
    title.textContent = 'Scene ' + (i + 1);

    const text = document.createElement('div');
    text.className = 'scene-card-text';
    text.textContent = scene.text || '(no text)';

    const presetLabel = document.createElement('div');
    presetLabel.className = 'scene-card-preset';
    const preset = PRESETS.find(p => p.id === scene.presetId);
    presetLabel.textContent = preset ? preset.name : scene.presetId;

    const delBtn = document.createElement('button');
    delBtn.className = 'scene-card-delete';
    delBtn.textContent = '\u00D7';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = scenes.findIndex(s => s.id === scene.id);
      if (idx >= 0) {
        scenes.splice(idx, 1);
        if (selectedSceneId === scene.id) selectedSceneId = scenes.length > 0 ? scenes[0].id : null;
        saveScenes(scenes);
        renderSceneQueue();
        renderTimeline();
        if (selectedSceneId) selectScene(selectedSceneId);
        forwardRedrawSceneRects();
      }
    });

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(presetLabel);
    card.appendChild(delBtn);

    card.addEventListener('click', () => {
      selectScene(scene.id);
    });

    queue.appendChild(card);
  });
  console.log('[Broll Panel] renderSceneQueue done, cards in DOM:', queue.children.length);
}

function renderTimeline() {
  const timeline = document.getElementById('timeline');
  timeline.innerHTML = '';

  scenes.forEach((scene) => {
    const block = document.createElement('div');
    block.className = 'timeline-block' + (scene.id === selectedSceneId ? ' selected' : '');
    const totalDuration = scene.duration + (scene.pauseDuration !== undefined ? scene.pauseDuration : DEFAULTS.PAUSE_DURATION);
    block.style.width = Math.max(40, totalDuration * 10) + 'px';
    block.textContent = totalDuration + 's';
    block.addEventListener('click', () => selectScene(scene.id));
    timeline.appendChild(block);
  });
}

function renderPresetGrid(selectedPresetId, isFree) {
  const grid = document.getElementById('preset-grid');
  grid.innerHTML = '';

  PRESETS.forEach((preset) => {
    const thumb = document.createElement('div');
    thumb.className = 'preset-thumb';
    if (preset.id === selectedPresetId) thumb.classList.add('selected');
    if (preset.proOnly && isFree) thumb.classList.add('locked');
    if (preset.proOnly) thumb.style.display = 'none'; // Hide pro-only presets from the UI

    const nameSpan = document.createElement('span');
    nameSpan.textContent = preset.name;
    thumb.appendChild(nameSpan);

    if (preset.proOnly) {
      const lock = document.createElement('span');
      lock.className = 'lock-icon';
      lock.textContent = 'PRO';
      thumb.appendChild(lock);
    }

    const hasOverlay = preset.id !== 'scroll_journey' && preset.id !== 'auto_scroll';

    if (preset.id === selectedPresetId && hasOverlay) {
      const settingsBtn = document.createElement('button');
      settingsBtn.className = 'preset-settings-btn';
      settingsBtn.innerHTML = '⚙';
      settingsBtn.title = 'Configure Preset Pace';
      settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePresetSettings(preset, thumb);
      });
      thumb.appendChild(settingsBtn);
    }

    thumb.addEventListener('click', () => {
      if (preset.proOnly && isFree) {
        alert('Upgrade to Pro to use the ' + preset.name + ' preset.');
        return;
      }
      if (selectedSceneId) {
        const scene = scenes.find(s => s.id === selectedSceneId);
        if (scene) {
          if (scene.presetId === preset.id) {
            if (hasOverlay) {
              togglePresetSettings(preset, thumb);
            }
          } else {
            scene.presetId = preset.id;
            document.getElementById('preset-settings-panel').style.display = 'none';
            saveScenes(scenes);
            renderPresetGrid(preset.id, isFree);
            renderSceneQueue();
          }
        }
      }
    });

    grid.appendChild(thumb);
  });
}

function populateBrandKitControls() {
  document.getElementById('aspect-ratio').value = brandKit.aspectRatio || '16:9';
  document.getElementById('resolution').value = brandKit.resolution || '1080p';
  document.getElementById('export-format').value = brandKit.exportFormat || 'mp4';
  document.getElementById('watermark-toggle').checked = brandKit.watermark !== false;

  const videoEndDelay = brandKit.videoEndDelay !== undefined ? brandKit.videoEndDelay : 1.0;
  document.getElementById('video-end-delay-slider').value = videoEndDelay;
  document.getElementById('video-end-delay-val').textContent = videoEndDelay.toFixed(1) + 's';

  const isFree = licenseState.tier === TIER.FREE;
  document.querySelectorAll('.pro-only').forEach(el => {
    el.disabled = isFree;
    el.style.opacity = isFree ? '0.4' : '1';
  });
}

function updateTierBadge() {
  const badge = document.getElementById('tier-badge');
  if (licenseState.tier === TIER.PRO) {
    badge.textContent = 'PRO';
    badge.style.background = '#FFEB3B';
    badge.style.color = '#1a1a2e';
  } else {
    badge.textContent = 'FREE';
    badge.style.background = '#2a2a42';
    badge.style.color = '#aaa';
  }
}

async function updateExportCounter() {
  const counter = document.getElementById('export-counter');
  counter.textContent = 'Unlimited exports';
}

function selectScene(sceneId) {
  selectedSceneId = sceneId;
  renderSceneQueue();
  renderTimeline();

  document.getElementById('preset-settings-panel').style.display = 'none';

  const scene = sceneId ? scenes.find(s => s.id === sceneId) : null;
  if (scene) {
    populateStyleControls(scene);
    const isFree = licenseState.tier === TIER.FREE;
    renderPresetGrid(scene.presetId, isFree);
    document.getElementById('highlight-pace-select').value = scene.highlightPace || 'smooth';
  } else {
    updateStyleControlsDisabled();
  }
}

function updateStyleControlsDisabled() {
  const hasSelection = selectedSceneId !== null && scenes.some(s => s.id === selectedSceneId);
  const noSceneMsg = document.getElementById('no-scene-msg');
  const presetGrid = document.getElementById('preset-grid');
  if (noSceneMsg) noSceneMsg.style.display = hasSelection ? 'none' : 'block';
  if (presetGrid) presetGrid.style.display = hasSelection ? '' : 'none';
  document.querySelectorAll('#style-studio label, #style-studio select').forEach(el => {
    el.style.opacity = hasSelection ? '1' : '0.4';
    el.style.pointerEvents = hasSelection ? 'auto' : 'none';
  });
  document.getElementById('duration-slider').disabled = !hasSelection;
  document.getElementById('zoom-level-slider').disabled = !hasSelection;
  document.getElementById('zoom-duration-slider').disabled = !hasSelection;
  document.getElementById('highlight-delay-slider').disabled = !hasSelection;
  document.getElementById('start-delay-slider').disabled = !hasSelection;
  document.getElementById('pause-duration-slider').disabled = !hasSelection;
  document.getElementById('color-highlight').disabled = !hasSelection;
  document.getElementById('color-box').disabled = !hasSelection;
  document.getElementById('transition-select').disabled = !hasSelection;
  document.getElementById('video-end-delay-slider').disabled = !hasSelection;
}

function populateStyleControls(scene) {
  document.getElementById('duration-slider').value = scene.duration || DEFAULTS.SCENE_DURATION;
  document.getElementById('duration-val').textContent = (scene.duration || DEFAULTS.SCENE_DURATION) + 's';
  document.getElementById('zoom-level-slider').value = scene.zoomLevel !== undefined ? scene.zoomLevel : DEFAULTS.ZOOM_LEVEL;
  document.getElementById('zoom-level-val').textContent = (scene.zoomLevel !== undefined ? scene.zoomLevel : DEFAULTS.ZOOM_LEVEL).toFixed(1) + 'x';
  document.getElementById('zoom-duration-slider').value = scene.zoomDuration !== undefined ? scene.zoomDuration : DEFAULTS.ZOOM_DURATION;
  document.getElementById('zoom-duration-val').textContent = (scene.zoomDuration !== undefined ? scene.zoomDuration : DEFAULTS.ZOOM_DURATION).toFixed(1) + 's';
  document.getElementById('highlight-delay-slider').value = scene.highlightDelay !== undefined ? scene.highlightDelay : DEFAULTS.HIGHLIGHT_DELAY;
  document.getElementById('highlight-delay-val').textContent = (scene.highlightDelay !== undefined ? scene.highlightDelay : DEFAULTS.HIGHLIGHT_DELAY).toFixed(1) + 's';
  document.getElementById('start-delay-slider').value = scene.startDelay !== undefined ? scene.startDelay : DEFAULTS.START_DELAY;
  document.getElementById('start-delay-val').textContent = (scene.startDelay !== undefined ? scene.startDelay : DEFAULTS.START_DELAY).toFixed(1) + 's';
  const pauseDuration = scene.pauseDuration !== undefined ? scene.pauseDuration : DEFAULTS.PAUSE_DURATION;
  document.getElementById('pause-duration-slider').value = pauseDuration;
  document.getElementById('pause-duration-val').textContent = pauseDuration.toFixed(1) + 's';
  document.getElementById('color-highlight').value = scene.highlightColor || DEFAULTS.HIGHLIGHT_COLOR;
  document.getElementById('color-box').value = scene.boxColor || DEFAULTS.BOX_COLOR;
  document.getElementById('transition-select').value = scene.transition || 'dissolve';
  updateStyleControlsDisabled();
}

async function renderProjectList() {
  const container = document.getElementById('project-list');
  container.innerHTML = '';
  const projects = await getProjects();
  projects.forEach((proj) => {
    const item = document.createElement('div');
    item.className = 'project-item';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = proj.name;

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '4px';

    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load';
    loadBtn.style.background = '#1e1e30';
    loadBtn.style.color = '#aaa';
    loadBtn.style.border = '1px solid #2a2a42';
    loadBtn.style.borderRadius = '4px';
    loadBtn.style.padding = '2px 8px';
    loadBtn.style.cursor = 'pointer';
    loadBtn.style.fontSize = '10px';
    loadBtn.addEventListener('click', () => {
      scenes = [...proj.scenes];
      brandKit = { ...proj.brandKit };
      saveScenes(scenes);
      saveBrandKit(brandKit);
      populateBrandKitControls();
      if (scenes.length > 0) {
        selectScene(scenes[0].id);
      } else {
        selectScene(null);
      }
      forwardRedrawSceneRects();
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '✕';
    deleteBtn.style.background = '#1e1e30';
    deleteBtn.style.color = '#ff5252';
    deleteBtn.style.border = '1px solid #2a2a42';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.padding = '2px 6px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '10px';
    deleteBtn.title = 'Delete Project';
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Are you sure you want to delete this project?')) {
        await deleteProject(proj.id);
        renderProjectList();
      }
    });

    btnGroup.appendChild(loadBtn);
    btnGroup.appendChild(deleteBtn);

    item.appendChild(nameSpan);
    item.appendChild(btnGroup);
    container.appendChild(item);
  });
}
