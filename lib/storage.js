import { STORAGE, DEFAULTS, TIER } from './constants.js';

const defaultBrandKit = {
  primaryColor: '#FFEB3B',
  secondaryColor: '#FF5252',
  logoDataUrl: null,
  logoPosition: 'bottom-right',
  logoOpacity: 0.8,
  resolution: '1080p',
  aspectRatio: '16:9',
  exportFormat: 'mp4',
  watermark: true,
  defaultTransition: 'dissolve',
};

const defaultLicense = {
  tier: TIER.PRO,
  key: 'DEBUG_PRO_KEY',
  validUntil: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
};

async function get(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result[key];
  } catch (err) {
    console.error('storage.get error:', err);
    return undefined;
  }
}

async function set(key, value) {
  try {
    await chrome.storage.local.set({ [key]: value });
  } catch (err) {
    console.error('storage.set error:', err);
  }
}

export async function getScenes() {
  try {
    const scenes = await get(STORAGE.SCENES);
    return Array.isArray(scenes) ? scenes : [];
  } catch (err) {
    console.error('getScenes error:', err);
    return [];
  }
}

export async function saveScenes(scenes) {
  await set(STORAGE.SCENES, scenes);
}

export async function clearScenes() {
  await set(STORAGE.SCENES, []);
}

export async function getBrandKit() {
  try {
    const kit = await get(STORAGE.BRAND_KIT);
    return kit ? { ...defaultBrandKit, ...kit } : { ...defaultBrandKit };
  } catch (err) {
    console.error('getBrandKit error:', err);
    return { ...defaultBrandKit };
  }
}

export async function saveBrandKit(kit) {
  await set(STORAGE.BRAND_KIT, kit);
}

export async function getLicense() {
  return {
    tier: TIER.PRO,
    key: 'DEBUG_PRO_KEY',
    validUntil: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
  };
}

export async function saveLicense(state) {
  await set(STORAGE.LICENSE, state);
}

export async function getProjects() {
  try {
    const projects = await get(STORAGE.PROJECTS);
    return Array.isArray(projects) ? projects : [];
  } catch (err) {
    console.error('getProjects error:', err);
    return [];
  }
}

export async function saveProject(project) {
  try {
    let projects = await getProjects();
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }
    if (projects.length > 30) {
      projects = projects.slice(-30);
    }
    await set(STORAGE.PROJECTS, projects);
  } catch (err) {
    console.error('saveProject error:', err);
  }
}

export async function deleteProject(id) {
  try {
    const projects = await getProjects();
    await set(STORAGE.PROJECTS, projects.filter(p => p.id !== id));
  } catch (err) {
    console.error('deleteProject error:', err);
  }
}

export async function getExportCount() {
  try {
    const storedMonth = await get(STORAGE.EXPORT_MONTH);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (storedMonth !== currentMonth) {
      await set(STORAGE.EXPORT_MONTH, currentMonth);
      await set(STORAGE.EXPORT_COUNT, 0);
      return 0;
    }
    const count = await get(STORAGE.EXPORT_COUNT);
    return typeof count === 'number' ? count : 0;
  } catch (err) {
    console.error('getExportCount error:', err);
    return 0;
  }
}

export async function incrementExportCount() {
  try {
    const count = await getExportCount();
    await set(STORAGE.EXPORT_COUNT, count + 1);
  } catch (err) {
    console.error('incrementExportCount error:', err);
  }
}
