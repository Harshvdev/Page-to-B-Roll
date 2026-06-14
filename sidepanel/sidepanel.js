import { MSG, PRESET, DEFAULTS, TIER } from '../lib/constants.js';
import {
  getScenes, saveScenes, clearScenes,
  getBrandKit, saveBrandKit,
  getLicense, getProjects, saveProject, deleteProject, getExportCount,
} from '../lib/storage.js';
import { isFreeUser, canExport, getRemainingFreeExports } from '../lib/license.js';
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
  licenseState = await getLicense();

  console.log('[Broll Panel] Loaded scenes:', scenes.length, 'brandKit:', brandKit, 'license:', licenseState.tier);

  renderSceneQueue();
  renderTimeline();
  renderPresetGrid(null, licenseState.tier === TIER.FREE);

  populateBrandKitControls();
  updateTierBadge();
  updateExportCounter();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('btn-activate').addEventListener('click', onActivateClick);
  document.getElementById('btn-clear-scenes').addEventListener('click', onClearScenes);
  document.getElementById('duration-slider').addEventListener('input', onDurationChange);
  document.getElementById('color-highlight').addEventListener('input', onHighlightColorChange);
  document.getElementById('color-box').addEventListener('input', onBoxColorChange);
  document.getElementById('transition-select').addEventListener('change', onTransitionChange);
  document.getElementById('aspect-ratio').addEventListener('change', onAspectRatioChange);
  document.getElementById('resolution').addEventListener('change', onResolutionChange);
  document.getElementById('export-format').addEventListener('change', onExportFormatChange);
  document.getElementById('logo-upload').addEventListener('change', onLogoUpload);
  document.getElementById('watermark-toggle').addEventListener('change', onWatermarkToggle);
  document.getElementById('btn-export').addEventListener('click', onExportClick);
  document.getElementById('btn-activate-license').addEventListener('click', onActivateLicense);
  document.getElementById('btn-save-project').addEventListener('click', onSaveProject);

  chrome.runtime.onMessage.addListener(onRuntimeMessage);
  console.log('[Broll Panel] Listeners set up');
}

async function onActivateClick() {
  isCapturing = !isCapturing;
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
}

function onResolutionChange(e) {
  brandKit.resolution = e.target.value;
  saveBrandKit(brandKit);
}

function onExportFormatChange(e) {
  brandKit.exportFormat = e.target.value;
  saveBrandKit(brandKit);
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

async function onExportClick() {
  if (scenes.length === 0) {
    alert('Add at least one scene before exporting.');
    return;
  }

  const btn = document.getElementById('btn-export');
  const progress = document.getElementById('export-progress');
  btn.disabled = true;
  progress.style.display = 'block';
  progress.value = 0;

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
      btn.disabled = false;
      progress.style.display = 'none';
      alert('Export failed: ' + response.error);
    }
  } catch (err) {
    console.error('[Broll Panel] RENDER_VIDEO send error:', err);
    btn.disabled = false;
    progress.style.display = 'none';
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
    console.log('[Broll Panel] RENDER_PROGRESS: ' + pct + '%');
    const progress = document.getElementById('export-progress');
    if (progress) {
      progress.value = pct;
    }
    return;
  }

  if (type === MSG.RENDER_COMPLETE) {
    console.log('[Broll Panel] RENDER_COMPLETE received, blobUrl:', message.payload ? message.payload.blobUrl : 'none');
    const btn = document.getElementById('btn-export');
    const progress = document.getElementById('export-progress');
    btn.disabled = false;
    progress.style.display = 'none';

    if (message.payload && message.payload.blobUrl) {
      chrome.downloads.download({ url: message.payload.blobUrl, filename: 'broll-video.mp4' });
    }
    updateExportCounter();
    return;
  }

  if (type === MSG.RENDER_ERROR) {
    console.error('[Broll Panel] RENDER_ERROR received:', message.payload);
    const btn = document.getElementById('btn-export');
    const progress = document.getElementById('export-progress');
    btn.disabled = false;
    progress.style.display = 'none';
    alert('Render error: ' + (message.payload ? message.payload.message : 'Unknown error'));
    return;
  }

  console.log('[Broll Panel] Unhandled message type:', type);
}

function forwardRedrawSceneRects() {
  chrome.runtime.sendMessage({
    type: 'REDRAW_SCENE_RECTS',
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
    },
    presetId: PRESET.HIGHLIGHT_ZOOM,
    duration: DEFAULTS.SCENE_DURATION,
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
    block.style.width = Math.max(40, scene.duration * 10) + 'px';
    block.textContent = scene.duration + 's';
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

    const nameSpan = document.createElement('span');
    nameSpan.textContent = preset.name;

    thumb.appendChild(nameSpan);

    if (preset.proOnly) {
      const lock = document.createElement('span');
      lock.className = 'lock-icon';
      lock.textContent = 'PRO';
      thumb.appendChild(lock);
    }

    thumb.addEventListener('click', () => {
      if (preset.proOnly && isFree) {
        alert('Upgrade to Pro to use the ' + preset.name + ' preset.');
        return;
      }
      if (selectedSceneId) {
        const scene = scenes.find(s => s.id === selectedSceneId);
        if (scene) {
          scene.presetId = preset.id;
          saveScenes(scenes);
          renderPresetGrid(preset.id, isFree);
          renderSceneQueue();
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

  const scene = sceneId ? scenes.find(s => s.id === sceneId) : null;
  if (scene) {
    populateStyleControls(scene);
    const isFree = licenseState.tier === TIER.FREE;
    renderPresetGrid(scene.presetId, isFree);
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
  document.getElementById('color-highlight').disabled = !hasSelection;
  document.getElementById('color-box').disabled = !hasSelection;
  document.getElementById('transition-select').disabled = !hasSelection;
}

function populateStyleControls(scene) {
  document.getElementById('duration-slider').value = scene.duration || DEFAULTS.SCENE_DURATION;
  document.getElementById('duration-val').textContent = (scene.duration || DEFAULTS.SCENE_DURATION) + 's';
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
      selectedSceneId = null;
      saveScenes(scenes);
      saveBrandKit(brandKit);
      populateBrandKitControls();
      renderSceneQueue();
      renderTimeline();
    });

    item.appendChild(nameSpan);
    item.appendChild(loadBtn);
    container.appendChild(item);
  });
}
