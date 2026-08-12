// Stockage partagé entre index.html (affichage) et settings.html (paramètres).
// Toutes les données vivent côté serveur (API /api/*, backées par Vercel Blob) afin
// que n'importe quel navigateur/appareil voie les mêmes réglages. Un cache mémoire
// (`state`) évite de refaire un appel réseau à chaque lecture ; `initStorage()`
// doit être attendu une fois au chargement de la page, et peut être rappelé pour
// récupérer les changements faits depuis un autre appareil.

const DEFAULT_STATE = {
  countdown: null,
  slideshowInterval: 8,
  imageSectionSize: 'medium',
  ticker: { enabled: false, text: '', mode: 'text' },
  periodTimes: {
    Matin: { start: '09:00', end: '12:30' },
    'Après-midi': { start: '14:00', end: '17:30' },
  },
  showPeriodTimes: false,
  layout: {
    order: ['countdown', 'meetings', 'images'],
    visible: { countdown: true, meetings: true, images: true },
  },
  tasks: [],
  meetings: [],
  meetingsImportedAt: null,
  images: [],
};

let state = { ...DEFAULT_STATE };

export async function initStorage() {
  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    state = res.ok ? { ...DEFAULT_STATE, ...(await res.json()) } : { ...DEFAULT_STATE };
  } catch {
    // Hors-ligne ou API indisponible : on garde le dernier état connu en mémoire.
  }
  return state;
}

let saveTimer = null;

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    }).catch(() => {
      // Pas de UI d'erreur dédiée : on retentera à la prochaine modification.
    });
  }, 400);
}

// --- Compte à rebours ---

export function getCountdown() {
  return state.countdown;
}

export function setCountdown({ date, title }) {
  state.countdown = { date, title: title || '' };
  persist();
}

// --- Diaporama ---

export function getSlideshowInterval() {
  return state.slideshowInterval ?? 8;
}

export function setSlideshowInterval(seconds) {
  state.slideshowInterval = seconds;
  persist();
}

export function getImageSectionSize() {
  return state.imageSectionSize ?? 'medium';
}

export function setImageSectionSize(size) {
  state.imageSectionSize = size;
  persist();
}

// --- Message défilant sur l'image ---

export function getTicker() {
  return { ...DEFAULT_STATE.ticker, ...(state.ticker || {}) };
}

export function setTicker({ enabled, text, mode }) {
  state.ticker = {
    enabled: Boolean(enabled),
    text: text || '',
    mode: mode === 'planning' ? 'planning' : 'text',
  };
  persist();
}

// --- Planning de réunions (importé depuis Excel) ---

export function getMeetings() {
  return state.meetings || [];
}

export function setMeetings(meetings) {
  state.meetings = meetings;
  state.meetingsImportedAt = new Date().toISOString();
  persist();
}

export function getMeetingsImportedAt() {
  return state.meetingsImportedAt;
}

export function clearMeetings() {
  state.meetings = [];
  state.meetingsImportedAt = null;
  persist();
}

export function getPeriodTimes() {
  const stored = state.periodTimes || {};
  return {
    Matin: { ...DEFAULT_STATE.periodTimes.Matin, ...(stored.Matin || {}) },
    'Après-midi': { ...DEFAULT_STATE.periodTimes['Après-midi'], ...(stored['Après-midi'] || {}) },
  };
}

export function setPeriodTimes(periodTimes) {
  state.periodTimes = periodTimes;
  persist();
}

export function getShowPeriodTimes() {
  return Boolean(state.showPeriodTimes);
}

export function setShowPeriodTimes(value) {
  state.showPeriodTimes = Boolean(value);
  persist();
}

// --- Disposition de l'affichage (blocs visibles + leur ordre) ---

const DEFAULT_LAYOUT_ORDER = DEFAULT_STATE.layout.order;

export function getLayout() {
  const stored = state.layout || {};

  const order = (Array.isArray(stored.order) ? stored.order : []).filter((id) =>
    DEFAULT_LAYOUT_ORDER.includes(id)
  );
  DEFAULT_LAYOUT_ORDER.forEach((id) => {
    if (!order.includes(id)) order.push(id);
  });

  const visible = { ...DEFAULT_STATE.layout.visible, ...(stored.visible || {}) };

  return { order, visible };
}

export function setLayout(layout) {
  state.layout = layout;
  persist();
}

// --- Tâches / planning ---

export function getTasks() {
  return state.tasks || [];
}

export function setTasks(tasks) {
  state.tasks = tasks;
  persist();
}

// --- Images (Vercel Blob) ---

export async function getAllImages() {
  return [...(state.images || [])].sort((a, b) => a.order - b.order);
}

export async function addImages(files) {
  const existing = state.images || [];
  let nextOrder = existing.length ? Math.max(...existing.map((img) => img.order)) + 1 : 0;

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;

    const res = await fetch(`/api/upload-image?name=${encodeURIComponent(file.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    });
    if (!res.ok) continue;

    const { id, name, url, pathname } = await res.json();
    existing.push({ id, name, url, pathname, order: nextOrder++, addedAt: new Date().toISOString() });
  }

  state.images = existing;
  persist();
}

export async function deleteImage(id) {
  const existing = state.images || [];
  const image = existing.find((img) => img.id === id);
  state.images = existing.filter((img) => img.id !== id);
  persist();

  if (image && image.pathname) {
    await fetch(`/api/delete-image?pathname=${encodeURIComponent(image.pathname)}`, { method: 'DELETE' }).catch(() => {});
  }
}

export async function reorderImages(orderedIds) {
  const byId = new Map((state.images || []).map((img) => [img.id, img]));
  orderedIds.forEach((id, index) => {
    const image = byId.get(id);
    if (image) image.order = index;
  });
  persist();
}
