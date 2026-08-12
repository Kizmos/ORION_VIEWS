// Logique de la page de paramétrage (settings.html).

import {
  getCountdown,
  setCountdown,
  getSlideshowInterval,
  setSlideshowInterval,
  getAllImages,
  addImages,
  deleteImage,
  reorderImages,
  getMeetings,
  setMeetings,
  getMeetingsImportedAt,
  clearMeetings,
  getTasks,
  setTasks,
  getLayout,
  setLayout,
  getImageSectionSize,
  setImageSectionSize,
  getTicker,
  setTicker,
  getPeriodTimes,
  setPeriodTimes,
  getShowPeriodTimes,
  setShowPeriodTimes,
} from './storage.js';
import { parseWorkbook } from './xlsx-parser.js';

// --- Compte à rebours ---

const endDateInput = document.getElementById('endDate');
const countdownTitleInput = document.getElementById('countdownTitle');
const setDateButton = document.getElementById('setDateButton');
const countdownMessage = document.getElementById('countdown-message');
const daysEl = document.getElementById('days');
const hoursEl = document.getElementById('hours');
const minutesEl = document.getElementById('minutes');
const secondsEl = document.getElementById('seconds');

let previewTarget = null;

function pad(value) {
  return String(value).padStart(2, '0');
}

function toDatetimeLocalValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function loadCountdownFromStorage() {
  const cfg = getCountdown();
  if (cfg && cfg.date && !isNaN(new Date(cfg.date).getTime())) {
    previewTarget = new Date(cfg.date);
    endDateInput.value = toDatetimeLocalValue(previewTarget);
    countdownTitleInput.value = cfg.title || '';
  } else {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 30);
    defaultDate.setHours(9, 0, 0, 0);
    endDateInput.value = toDatetimeLocalValue(defaultDate);
  }
}

function tickPreview() {
  if (!previewTarget) return;

  const diff = previewTarget.getTime() - Date.now();
  if (diff <= 0) {
    [daysEl, hoursEl, minutesEl, secondsEl].forEach((el) => (el.textContent = '00'));
    countdownMessage.textContent = 'Date atteinte !';
    return;
  }

  const totalSeconds = Math.floor(diff / 1000);
  daysEl.textContent = pad(Math.floor(totalSeconds / 86400));
  hoursEl.textContent = pad(Math.floor((totalSeconds % 86400) / 3600));
  minutesEl.textContent = pad(Math.floor((totalSeconds % 3600) / 60));
  secondsEl.textContent = pad(totalSeconds % 60);
  countdownMessage.textContent = "Temps restant avant l'échéance.";
}

function setCountdownDate() {
  const value = endDateInput.value;
  if (!value) {
    countdownMessage.textContent = 'Veuillez choisir une date.';
    return;
  }

  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) {
    countdownMessage.textContent = 'Date invalide.';
    return;
  }

  previewTarget = parsed;
  setCountdown({ date: parsed.toISOString(), title: countdownTitleInput.value.trim() });
  tickPreview();
}

setDateButton.addEventListener('click', setCountdownDate);
loadCountdownFromStorage();
tickPreview();
setInterval(tickPreview, 1000);

// --- Images / diaporama ---

const imageInput = document.getElementById('imageInput');
const slideshowIntervalInput = document.getElementById('slideshowInterval');
const imageManagerList = document.getElementById('imageManagerList');
const imageSettingsMessage = document.getElementById('image-settings-message');

let managerObjectUrls = [];

function revokeManagerUrls() {
  managerObjectUrls.forEach((url) => URL.revokeObjectURL(url));
  managerObjectUrls = [];
}

async function moveImage(images, index, delta) {
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= images.length) return;

  const ids = images.map((img) => img.id);
  [ids[index], ids[targetIndex]] = [ids[targetIndex], ids[index]];
  await reorderImages(ids);
  renderImageManager();
}

async function renderImageManager() {
  revokeManagerUrls();
  const images = await getAllImages();
  imageManagerList.innerHTML = '';

  if (!images.length) {
    imageSettingsMessage.textContent = 'Aucune image importée pour le moment.';
    return;
  }

  imageSettingsMessage.textContent = `${images.length} image(s) dans le diaporama.`;

  images.forEach((image, index) => {
    const item = document.createElement('div');
    item.className = 'image-manager-item';

    const thumbUrl = URL.createObjectURL(image.blob);
    managerObjectUrls.push(thumbUrl);

    const thumb = document.createElement('img');
    thumb.src = thumbUrl;
    thumb.alt = image.name;
    thumb.className = 'thumbnail';

    const name = document.createElement('span');
    name.className = 'image-manager-name';
    name.textContent = image.name;

    const actions = document.createElement('div');
    actions.className = 'image-manager-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveImage(images, index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '▼';
    downBtn.disabled = index === images.length - 1;
    downBtn.addEventListener('click', () => moveImage(images, index, 1));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = 'Supprimer';
    deleteBtn.addEventListener('click', async () => {
      await deleteImage(image.id);
      renderImageManager();
    });

    actions.append(upBtn, downBtn, deleteBtn);
    item.append(thumb, name, actions);
    imageManagerList.appendChild(item);
  });
}

imageInput.addEventListener('change', async (event) => {
  await addImages(event.target.files);
  imageInput.value = '';
  renderImageManager();
});

slideshowIntervalInput.value = getSlideshowInterval();
slideshowIntervalInput.addEventListener('change', () => {
  const value = parseInt(slideshowIntervalInput.value, 10);
  if (!isNaN(value) && value >= 2) {
    setSlideshowInterval(value);
  }
});

const imageSectionSizeSelect = document.getElementById('imageSectionSize');
imageSectionSizeSelect.value = getImageSectionSize();
imageSectionSizeSelect.addEventListener('change', () => {
  setImageSectionSize(imageSectionSizeSelect.value);
});

renderImageManager();

// --- Message défilant ---

const tickerEnabledInput = document.getElementById('tickerEnabled');
const tickerModeSelect = document.getElementById('tickerMode');
const tickerTextInput = document.getElementById('tickerText');
const tickerTextRow = document.getElementById('tickerTextRow');

function updateTickerTextRowVisibility() {
  tickerTextRow.classList.toggle('hidden', tickerModeSelect.value === 'planning');
}

function loadTicker() {
  const ticker = getTicker();
  tickerEnabledInput.checked = ticker.enabled;
  tickerModeSelect.value = ticker.mode;
  tickerTextInput.value = ticker.text;
  updateTickerTextRowVisibility();
}

function saveTicker() {
  setTicker({ enabled: tickerEnabledInput.checked, text: tickerTextInput.value, mode: tickerModeSelect.value });
}

tickerEnabledInput.addEventListener('change', saveTicker);
tickerTextInput.addEventListener('input', saveTicker);
tickerModeSelect.addEventListener('change', () => {
  updateTickerTextRowVisibility();
  saveTicker();
});

loadTicker();

// --- Planning des réunions (import Excel) ---

const meetingsFileInput = document.getElementById('meetingsFileInput');
const clearMeetingsButton = document.getElementById('clearMeetingsButton');
const meetingsStatus = document.getElementById('meetings-status');
const meetingsPreviewEl = document.getElementById('meetingsPreview');

function updateMeeting(id, changes) {
  const meetings = getMeetings();
  const meeting = meetings.find((m) => m.id === id);
  if (!meeting) return;
  Object.assign(meeting, changes);
  setMeetings(meetings);
}

function renderMeetingsPreview() {
  const meetings = getMeetings();
  const importedAt = getMeetingsImportedAt();

  meetingsPreviewEl.innerHTML = '';

  if (!meetings.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Aucun planning importé pour le moment.';
    meetingsPreviewEl.appendChild(empty);
    meetingsStatus.textContent = '';
    return;
  }

  meetingsStatus.textContent = `${meetings.length} réunion(s) importée(s)${
    importedAt ? ` le ${new Date(importedAt).toLocaleString('fr-FR')}` : ''
  }. Modifiez la salle ou le créneau ci-dessous si besoin.`;

  meetings
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period))
    .forEach((meeting) => {
      const item = document.createElement('div');
      item.className = 'event-card';

      const title = document.createElement('div');
      const strong = document.createElement('strong');
      strong.textContent = `${meeting.squad} - ${meeting.subject}`;
      title.appendChild(strong);

      const dateSpan = document.createElement('div');
      dateSpan.className = 'message';
      dateSpan.textContent = new Date(meeting.date).toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });

      const editRow = document.createElement('div');
      editRow.className = 'meeting-edit-row';

      const periodSelect = document.createElement('select');
      ['Matin', 'Après-midi'].forEach((period) => {
        const option = document.createElement('option');
        option.value = period;
        option.textContent = period;
        option.selected = meeting.period === period;
        periodSelect.appendChild(option);
      });
      periodSelect.addEventListener('change', () => {
        updateMeeting(meeting.id, { period: periodSelect.value });
      });

      const roomInput = document.createElement('input');
      roomInput.type = 'text';
      roomInput.placeholder = 'Salle';
      roomInput.value = meeting.room || '';
      roomInput.addEventListener('change', () => {
        updateMeeting(meeting.id, { room: roomInput.value.trim() });
      });

      editRow.append(periodSelect, roomInput);

      item.append(title, dateSpan, editRow);
      meetingsPreviewEl.appendChild(item);
    });
}

meetingsFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  meetingsStatus.textContent = 'Import en cours…';
  try {
    const buffer = await file.arrayBuffer();
    const meetings = parseWorkbook(buffer);
    if (!meetings.length) {
      meetingsStatus.textContent = "Aucune réunion trouvée dans ce fichier. Vérifiez qu'il contient bien les colonnes Squad/Salle.";
      return;
    }
    setMeetings(meetings);
    renderMeetingsPreview();
  } catch (err) {
    meetingsStatus.textContent = `Erreur d'import : ${err.message}`;
  } finally {
    meetingsFileInput.value = '';
  }
});

clearMeetingsButton.addEventListener('click', () => {
  clearMeetings();
  renderMeetingsPreview();
});

renderMeetingsPreview();

// --- Horaires des créneaux Matin / Après-midi ---

const morningStartInput = document.getElementById('morningStart');
const morningEndInput = document.getElementById('morningEnd');
const afternoonStartInput = document.getElementById('afternoonStart');
const afternoonEndInput = document.getElementById('afternoonEnd');
const showPeriodTimesInput = document.getElementById('showPeriodTimes');

function loadPeriodTimes() {
  const periodTimes = getPeriodTimes();
  morningStartInput.value = periodTimes.Matin.start;
  morningEndInput.value = periodTimes.Matin.end;
  afternoonStartInput.value = periodTimes['Après-midi'].start;
  afternoonEndInput.value = periodTimes['Après-midi'].end;
  showPeriodTimesInput.checked = getShowPeriodTimes();
}

function savePeriodTimes() {
  setPeriodTimes({
    Matin: { start: morningStartInput.value, end: morningEndInput.value },
    'Après-midi': { start: afternoonStartInput.value, end: afternoonEndInput.value },
  });
}

[morningStartInput, morningEndInput, afternoonStartInput, afternoonEndInput].forEach((input) => {
  input.addEventListener('change', savePeriodTimes);
});

showPeriodTimesInput.addEventListener('change', () => {
  setShowPeriodTimes(showPeriodTimesInput.checked);
});

loadPeriodTimes();

// --- Agenda / planning ---

const taskTitleInput = document.getElementById('taskTitle');
const taskDateInput = document.getElementById('taskDate');
const addTaskButton = document.getElementById('addTaskButton');
const taskListEl = document.getElementById('taskList');

let tasks = getTasks();

function renderTasks() {
  taskListEl.innerHTML = '';
  if (!tasks.length) {
    taskListEl.innerHTML = '<p>Aucune tâche ajoutée pour le moment.</p>';
    return;
  }

  tasks.forEach((task, index) => {
    const item = document.createElement('div');
    item.className = 'task-item';

    const title = document.createElement('div');
    title.textContent = task.title;

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = new Date(task.date).toLocaleString('fr-FR');
    const statusSpan = document.createElement('span');
    statusSpan.textContent = task.completed ? 'Terminée' : 'En cours';
    meta.append(dateSpan, statusSpan);

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.textContent = task.completed ? 'Reprendre' : 'Terminer';
    toggleButton.addEventListener('click', () => {
      tasks[index].completed = !tasks[index].completed;
      setTasks(tasks);
      renderTasks();
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Supprimer';
    removeButton.addEventListener('click', () => {
      tasks.splice(index, 1);
      setTasks(tasks);
      renderTasks();
    });

    actions.append(toggleButton, removeButton);
    item.append(title, meta, actions);
    taskListEl.appendChild(item);
  });
}

addTaskButton.addEventListener('click', () => {
  const titleValue = taskTitleInput.value.trim();
  const dateValue = taskDateInput.value;

  if (!titleValue || !dateValue) {
    alert('Veuillez compléter le titre et la date de la tâche.');
    return;
  }

  tasks.push({ title: titleValue, date: dateValue, completed: false });
  taskTitleInput.value = '';
  taskDateInput.value = '';
  setTasks(tasks);
  renderTasks();
});

renderTasks();

// --- Disposition de l'affichage ---

const layoutManagerList = document.getElementById('layoutManagerList');

const PANEL_LABELS = {
  countdown: 'Compte à rebours',
  meetings: 'Planning des réunions',
  images: 'Images (diaporama)',
};

function moveLayoutItem(index, delta) {
  const layout = getLayout();
  const targetIndex = index + delta;
  if (targetIndex < 0 || targetIndex >= layout.order.length) return;

  [layout.order[index], layout.order[targetIndex]] = [layout.order[targetIndex], layout.order[index]];
  setLayout(layout);
  renderLayoutManager();
}

function renderLayoutManager() {
  const layout = getLayout();
  layoutManagerList.innerHTML = '';

  layout.order.forEach((id, index) => {
    const item = document.createElement('div');
    item.className = 'image-manager-item';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'layout-toggle';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = layout.visible[id] !== false;
    checkbox.addEventListener('change', () => {
      const current = getLayout();
      current.visible[id] = checkbox.checked;
      setLayout(current);
    });
    toggleLabel.appendChild(checkbox);

    const name = document.createElement('span');
    name.className = 'image-manager-name';
    name.textContent = PANEL_LABELS[id] || id;

    const actions = document.createElement('div');
    actions.className = 'image-manager-actions';

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.textContent = '▲';
    upBtn.disabled = index === 0;
    upBtn.addEventListener('click', () => moveLayoutItem(index, -1));

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.textContent = '▼';
    downBtn.disabled = index === layout.order.length - 1;
    downBtn.addEventListener('click', () => moveLayoutItem(index, 1));

    actions.append(upBtn, downBtn);
    item.append(toggleLabel, name, actions);
    layoutManagerList.appendChild(item);
  });
}

renderLayoutManager();
