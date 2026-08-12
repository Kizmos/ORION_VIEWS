// Stockage partagé entre index.html (affichage) et settings.html (paramètres).
// localStorage pour les réglages simples, IndexedDB pour les images (plus volumineuses).

const LS_KEYS = {
  countdown: 'orion:countdown',
  slideshowInterval: 'orion:slideshowInterval',
  meetings: 'orion:meetings',
  meetingsImportedAt: 'orion:meetingsImportedAt',
  tasks: 'orion:tasks',
  layout: 'orion:layout',
  imageSectionSize: 'orion:imageSectionSize',
  ticker: 'orion:ticker',
  periodTimes: 'orion:periodTimes',
  showPeriodTimes: 'orion:showPeriodTimes',
};

const DEFAULT_PERIOD_TIMES = {
  Matin: { start: '09:00', end: '12:30' },
  'Après-midi': { start: '14:00', end: '17:30' },
};

const DEFAULT_LAYOUT_ORDER = ['countdown', 'meetings', 'images'];

const DB_NAME = 'orion-db';
const DB_VERSION = 1;
const IMAGE_STORE = 'images';

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// --- Compte à rebours ---

export function getCountdown() {
  return readJSON(LS_KEYS.countdown, null);
}

export function setCountdown({ date, title }) {
  writeJSON(LS_KEYS.countdown, { date, title: title || '' });
}

// --- Diaporama ---

export function getSlideshowInterval() {
  return readJSON(LS_KEYS.slideshowInterval, 8);
}

export function setSlideshowInterval(seconds) {
  writeJSON(LS_KEYS.slideshowInterval, seconds);
}

export function getImageSectionSize() {
  return readJSON(LS_KEYS.imageSectionSize, 'medium');
}

export function setImageSectionSize(size) {
  writeJSON(LS_KEYS.imageSectionSize, size);
}

// --- Message défilant sur l'image ---

export function getTicker() {
  return readJSON(LS_KEYS.ticker, { enabled: false, text: '', mode: 'text' });
}

export function setTicker({ enabled, text, mode }) {
  writeJSON(LS_KEYS.ticker, {
    enabled: Boolean(enabled),
    text: text || '',
    mode: mode === 'planning' ? 'planning' : 'text',
  });
}

// --- Planning de réunions (importé depuis Excel) ---

export function getMeetings() {
  return readJSON(LS_KEYS.meetings, []);
}

export function setMeetings(meetings) {
  writeJSON(LS_KEYS.meetings, meetings);
  writeJSON(LS_KEYS.meetingsImportedAt, new Date().toISOString());
}

export function getMeetingsImportedAt() {
  return readJSON(LS_KEYS.meetingsImportedAt, null);
}

export function clearMeetings() {
  localStorage.removeItem(LS_KEYS.meetings);
  localStorage.removeItem(LS_KEYS.meetingsImportedAt);
}

export function getPeriodTimes() {
  const stored = readJSON(LS_KEYS.periodTimes, null);
  return {
    Matin: { ...DEFAULT_PERIOD_TIMES.Matin, ...(stored && stored.Matin ? stored.Matin : {}) },
    'Après-midi': { ...DEFAULT_PERIOD_TIMES['Après-midi'], ...(stored && stored['Après-midi'] ? stored['Après-midi'] : {}) },
  };
}

export function setPeriodTimes(periodTimes) {
  writeJSON(LS_KEYS.periodTimes, periodTimes);
}

export function getShowPeriodTimes() {
  return readJSON(LS_KEYS.showPeriodTimes, false);
}

export function setShowPeriodTimes(value) {
  writeJSON(LS_KEYS.showPeriodTimes, Boolean(value));
}

// --- Disposition de l'affichage (blocs visibles + leur ordre) ---

export function getLayout() {
  const stored = readJSON(LS_KEYS.layout, null);

  const order = (stored && Array.isArray(stored.order) ? stored.order : []).filter((id) =>
    DEFAULT_LAYOUT_ORDER.includes(id)
  );
  DEFAULT_LAYOUT_ORDER.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  const visible = { countdown: true, meetings: true, images: true, ...(stored && stored.visible ? stored.visible : {}) };

  return { order, visible };
}

export function setLayout(layout) {
  writeJSON(LS_KEYS.layout, layout);
}

// --- Tâches / planning ---

export function getTasks() {
  return readJSON(LS_KEYS.tasks, []);
}

export function setTasks(tasks) {
  writeJSON(LS_KEYS.tasks, tasks);
}

// --- Images (IndexedDB) ---

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, mode);
    const store = tx.objectStore(IMAGE_STORE);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllImages() {
  const images = await withStore('readonly', (store) => {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  return images.sort((a, b) => a.order - b.order);
}

export async function addImages(files) {
  const existing = await getAllImages();
  let nextOrder = existing.length ? Math.max(...existing.map((img) => img.order)) + 1 : 0;

  await withStore('readwrite', (store) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      store.put({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        type: file.type,
        blob: file,
        order: nextOrder++,
        addedAt: new Date().toISOString(),
      });
    });
  });
}

export async function deleteImage(id) {
  await withStore('readwrite', (store) => store.delete(id));
}

export async function reorderImages(orderedIds) {
  const images = await getAllImages();
  const byId = new Map(images.map((img) => [img.id, img]));

  await withStore('readwrite', (store) => {
    orderedIds.forEach((id, index) => {
      const image = byId.get(id);
      if (image) {
        image.order = index;
        store.put(image);
      }
    });
  });
}
