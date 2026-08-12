// Lecture/écriture de l'état partagé d'ORION dans Vercel Blob.
// Un seul fichier JSON (data/settings.json) sert de source de vérité pour tout,
// sauf les octets des images (stockés séparément, référencés par leur URL).

const { head, put } = require('@vercel/blob');

const STATE_PATHNAME = 'data/settings.json';

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

async function readState() {
  try {
    const meta = await head(STATE_PATHNAME);
    const res = await fetch(meta.url, { cache: 'no-store' });
    if (!res.ok) return { ...DEFAULT_STATE };
    const data = await res.json();
    return { ...DEFAULT_STATE, ...data };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state) {
  await put(STATE_PATHNAME, JSON.stringify(state), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

module.exports = { readState, writeState, DEFAULT_STATE };
