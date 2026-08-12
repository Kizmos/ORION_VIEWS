// Logique de la page d'affichage (index.html).
// Ne fait jamais d'authentification : lit uniquement les données préparées côté paramètres.

import {
  initStorage,
  getCountdown,
  getSlideshowInterval,
  getAllImages,
  getMeetings,
  getLayout,
  getImageSectionSize,
  getTicker,
  getPeriodTimes,
  getShowPeriodTimes,
} from './storage.js';
import { toDateKey } from './xlsx-parser.js';

const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');
const countdownTitleEl = document.getElementById('countdown-title');
const countdownMessage = document.getElementById('countdown-message');

const slideA = document.getElementById('slideA');
const slideB = document.getElementById('slideB');
const slideshowMessage = document.getElementById('slideshow-message');

const meetingsListEl = document.getElementById('meetingsList');
const meetingsTrackEl = document.getElementById('meetingsTrack');
const meetingsHeadingEl = document.getElementById('meetings-heading');

const tickerEl = document.getElementById('ticker');
const tickerTrackEl = document.getElementById('tickerTrack');
const tickerTextEl = document.getElementById('tickerText');
const tickerTextCopyEl = document.getElementById('tickerTextCopy');

function formatUnit(value) {
  return String(Math.max(0, value)).padStart(2, '0');
}

// --- Compte à rebours ---

let countdownTarget = null;

function applyCountdownSettings() {
  const cfg = getCountdown();
  if (!cfg || !cfg.date || isNaN(new Date(cfg.date).getTime())) {
    countdownTarget = null;
    countdownTitleEl.textContent = '';
    countdownMessage.textContent = 'Aucune date configurée. Rendez-vous dans les paramètres.';
    [daysEl, hoursEl, minutesEl, secondsEl].forEach((el) => (el.textContent = '00'));
    return;
  }

  countdownTarget = new Date(cfg.date);
  countdownTitleEl.textContent = cfg.title || '';
}

function tickCountdown() {
  if (!countdownTarget) return;

  const diff = countdownTarget.getTime() - Date.now();

  if (diff <= 0) {
    [daysEl, hoursEl, minutesEl, secondsEl].forEach((el) => (el.textContent = '00'));
    countdownMessage.textContent = 'Date atteinte !';
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  daysEl.textContent = formatUnit(Math.floor(totalSeconds / 86400));
  hoursEl.textContent = formatUnit(Math.floor((totalSeconds % 86400) / 3600));
  minutesEl.textContent = formatUnit(Math.floor((totalSeconds % 3600) / 60));
  secondsEl.textContent = formatUnit(totalSeconds % 60);
  countdownMessage.textContent = '';
}

// --- Diaporama d'images ---

const slideEls = [slideA, slideB];
let activeSlide = 0;
let images = [];
let currentImageIndex = 0;
let slideshowTimer = null;
let currentImageIds = '';

function showSlide(index) {
  if (!images.length) return;

  const image = images[index];
  const outgoingEl = slideEls[activeSlide];
  const incomingEl = slideEls[(activeSlide + 1) % 2];

  incomingEl.src = image.url;
  incomingEl.alt = image.name;
  incomingEl.onload = () => {
    incomingEl.classList.add('visible');
    outgoingEl.classList.remove('visible');
    activeSlide = (activeSlide + 1) % 2;
  };
}

function scheduleSlideshow() {
  if (slideshowTimer) clearInterval(slideshowTimer);
  if (images.length < 2) return;

  const intervalMs = Math.max(2, getSlideshowInterval() || 8) * 1000;
  slideshowTimer = setInterval(() => {
    currentImageIndex = (currentImageIndex + 1) % images.length;
    showSlide(currentImageIndex);
  }, intervalMs);
}

async function refreshImages() {
  const loaded = await getAllImages();
  const ids = loaded.map((img) => img.id).join(',');
  if (ids === currentImageIds) return;

  currentImageIds = ids;
  images = loaded;
  currentImageIndex = 0;

  if (!images.length) {
    slideshowMessage.textContent = "Aucune image importée. Rendez-vous dans les paramètres.";
    slideA.classList.remove('visible');
    slideB.classList.remove('visible');
    if (slideshowTimer) clearInterval(slideshowTimer);
    return;
  }

  slideshowMessage.textContent = '';
  showSlide(0);
  scheduleSlideshow();
}

// --- Planning des réunions : logique partagée (jour courant ou prochain jour disponible) ---

const PERIOD_ORDER = { Matin: 0, 'Après-midi': 1 };

function getDayMeetingsInfo() {
  const meetings = getMeetings();
  if (!meetings.length) return { dayKey: null, dayMeetings: [], isToday: false };

  const todayKey = toDateKey(new Date());
  let dayKey = todayKey;
  let dayMeetings = meetings.filter((m) => m.date === todayKey);

  if (!dayMeetings.length) {
    const upcoming = meetings.filter((m) => m.date > todayKey).sort((a, b) => a.date.localeCompare(b.date));
    if (upcoming.length) {
      dayKey = upcoming[0].date;
      dayMeetings = meetings.filter((m) => m.date === dayKey);
    }
  }

  return { dayKey, dayMeetings, isToday: dayKey === todayKey };
}

function periodLabel(period) {
  const showTimes = getShowPeriodTimes();
  const periodTimes = getPeriodTimes();
  if (showTimes && periodTimes[period]) {
    return `${periodTimes[period].start} - ${periodTimes[period].end}`;
  }
  return period;
}

// --- Message défilant ---

let currentTickerSignature = '';

function buildPlanningTickerText() {
  const { dayKey, dayMeetings, isToday } = getDayMeetingsInfo();
  if (!dayKey || !dayMeetings.length) return 'Aucune réunion prévue.';

  const dayLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const prefix = isToday ? `Réunions du jour (${dayLabel})` : `Prochaines réunions (${dayLabel})`;

  const items = dayMeetings
    .slice()
    .sort((a, b) => (PERIOD_ORDER[a.period] ?? 0) - (PERIOD_ORDER[b.period] ?? 0))
    .map((m) => `${m.room ? `${m.room} : ` : ''}${m.squad} - ${m.subject} (${periodLabel(m.period)})`);

  return `${prefix}   •   ${items.join('     •     ')}`;
}

function applyTicker() {
  const ticker = getTicker();
  const text = ticker.mode === 'planning' ? buildPlanningTickerText() : ticker.text;
  const hasText = Boolean(ticker.enabled && text.trim());
  const signature = JSON.stringify({ enabled: ticker.enabled, mode: ticker.mode, text });
  if (signature === currentTickerSignature) return;
  currentTickerSignature = signature;

  tickerEl.classList.toggle('visible', hasText);
  if (!hasText) return;

  tickerTextEl.textContent = text;
  tickerTextCopyEl.textContent = text;

  requestAnimationFrame(() => {
    const singleWidth = tickerTextEl.getBoundingClientRect().width;
    const pixelsPerSecond = 90;
    const duration = Math.max(6, singleWidth / pixelsPerSecond);
    tickerTrackEl.style.animationDuration = `${duration}s`;
  });
}

// --- Rendu de la liste du planning ---

function stopMeetingsScroll() {
  meetingsTrackEl.classList.remove('scrolling');
  meetingsTrackEl.style.animationDuration = '';
}

function renderMeetings() {
  const allMeetings = getMeetings();
  meetingsTrackEl.innerHTML = '';
  stopMeetingsScroll();

  if (!allMeetings.length) {
    meetingsHeadingEl.textContent = 'Réunions du jour';
    const empty = document.createElement('p');
    empty.textContent = 'Aucun planning importé. Rendez-vous dans les paramètres.';
    meetingsTrackEl.appendChild(empty);
    return;
  }

  const { dayKey, dayMeetings, isToday } = getDayMeetingsInfo();

  const dayLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  meetingsHeadingEl.textContent = isToday ? `Réunions du jour - ${dayLabel}` : `Prochaines réunions - ${dayLabel}`;

  if (!dayMeetings.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Aucune réunion prévue.';
    meetingsTrackEl.appendChild(empty);
    return;
  }

  const byRoom = new Map();
  dayMeetings.forEach((meeting) => {
    const room = meeting.room || 'Salle non précisée';
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room).push(meeting);
  });

  Array.from(byRoom.keys())
    .sort((a, b) => a.localeCompare(b))
    .forEach((room) => {
      const roomHeading = document.createElement('h3');
      roomHeading.className = 'meetings-room-heading';
      roomHeading.textContent = room;
      meetingsTrackEl.appendChild(roomHeading);

      byRoom
        .get(room)
        .sort((a, b) => (PERIOD_ORDER[a.period] ?? 0) - (PERIOD_ORDER[b.period] ?? 0))
        .forEach((meeting) => {
          const item = document.createElement('div');
          item.className = 'event-card';

          const title = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = `${meeting.squad} - ${meeting.subject}`;
          title.appendChild(strong);

          const details = document.createElement('div');
          const periodSpan = document.createElement('span');
          periodSpan.textContent = periodLabel(meeting.period);
          details.appendChild(periodSpan);

          item.appendChild(title);
          item.appendChild(details);
          meetingsTrackEl.appendChild(item);
        });
    });

  // Si le planning du jour ne tient pas dans le cadre, on double son contenu et on
  // fait défiler verticalement en boucle continue pour que tout finisse par s'afficher.
  requestAnimationFrame(() => {
    const viewportHeight = meetingsListEl.clientHeight;
    const contentHeight = meetingsTrackEl.scrollHeight;
    if (contentHeight <= viewportHeight + 4) return;

    Array.from(meetingsTrackEl.children).forEach((node) => {
      meetingsTrackEl.appendChild(node.cloneNode(true));
    });

    const pixelsPerSecond = 32;
    const duration = Math.max(10, contentHeight / pixelsPerSecond);
    meetingsTrackEl.style.animationDuration = `${duration}s`;
    meetingsTrackEl.classList.add('scrolling');
  });
}

// --- Disposition des blocs (visibilité + ordre) ---

const panelEls = {
  countdown: document.getElementById('countdown-section'),
  meetings: document.getElementById('meetings-display-section'),
  images: document.getElementById('slideshow-section'),
};

let currentLayoutSignature = '';

const IMAGE_SIZE_RATIOS = { small: 0.6, medium: 1, large: 1.8 };
const gridEl = document.querySelector('.display-only-grid');

// Place explicitement chaque bloc visible (au lieu de compter sur l'ordre du DOM),
// pour que le classement choisi dans les paramètres soit respecté à coup sûr.
function gridPlacementFor(rank, total) {
  if (total <= 1) return { gridColumn: '1 / -1', gridRow: '1' };
  if (total === 2) return { gridColumn: rank === 0 ? '1 / span 1' : '2 / span 1', gridRow: '1' };
  if (rank === 0) return { gridColumn: '1 / span 1', gridRow: '1' };
  if (rank === 1) return { gridColumn: '2 / span 1', gridRow: '1' };
  return { gridColumn: '1 / -1', gridRow: '2' };
}

function applyLayout() {
  const layout = getLayout();
  const imageSize = getImageSectionSize();
  const signature = JSON.stringify({ layout, imageSize });
  if (signature === currentLayoutSignature) return;
  currentLayoutSignature = signature;

  const enabledIds = layout.order.filter((id) => layout.visible[id] !== false);

  layout.order.forEach((id) => {
    const el = panelEls[id];
    if (!el) return;
    el.style.display = layout.visible[id] !== false ? '' : 'none';
  });

  let imagesRow = null;
  enabledIds.forEach((id, rank) => {
    const el = panelEls[id];
    if (!el) return;
    const placement = gridPlacementFor(rank, enabledIds.length);
    el.style.gridColumn = placement.gridColumn;
    el.style.gridRow = placement.gridRow;
    if (id === 'images') imagesRow = placement.gridRow;
  });

  if (!gridEl) return;

  if (enabledIds.length === 3 && imagesRow) {
    const factor = IMAGE_SIZE_RATIOS[imageSize] ?? 1;
    const row1 = imagesRow === '1' ? factor : 1;
    const row2 = imagesRow === '2' ? factor : 1;
    gridEl.style.gridTemplateRows = `${row1}fr ${row2}fr`;
  } else {
    gridEl.style.gridTemplateRows = '';
  }
}

// --- Démarrage ---
// initStorage() va chercher l'état courant sur le serveur (partagé entre tous les
// appareils). On le rappelle périodiquement pour détecter les changements faits
// depuis un autre navigateur (ex: la page paramètres ouverte ailleurs), puis on
// ré-applique tous les rendus avec les données fraîches.

async function refreshFromServer() {
  await initStorage();
  applyCountdownSettings();
  applyLayout();
  await refreshImages();
  renderMeetings();
  applyTicker();
}

refreshFromServer();
setInterval(refreshFromServer, 5000);

tickCountdown();
setInterval(tickCountdown, 1000);
