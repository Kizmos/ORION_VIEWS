// Lecture du planning de réunions depuis un classeur Excel (type "Orion_Planning.xlsx").
//
// Format attendu, par feuille (une feuille = une semaine) :
//   - une ligne d'en-tête avec "Squad" puis un jour par paire de colonnes (Matin / Après-midi),
//     et "Salle" en dernière colonne ;
//   - une ligne de sous-en-tête "Matin" / "Après-midi" ;
//   - une ligne par squad : nom en 1ère colonne, sujet de réunion dans les cellules jour/créneau,
//     salle en dernière colonne (s'applique à toutes les réunions de la ligne).
//
// N'utilise que le SDK SheetJS (window.XLSX), chargé via CDN dans settings.html.

const FRENCH_MONTHS = {
  janvier: 0,
  février: 1,
  fevrier: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  août: 7,
  aout: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  décembre: 11,
  decembre: 11,
};

function cellText(sheet, r, c, XLSX) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const cell = sheet[addr];
  if (!cell) return '';
  const raw = cell.w !== undefined ? cell.w : cell.v;
  if (raw === undefined || raw === null) return '';
  return String(raw)
    .replace(/\r\n/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHeaderDate(text) {
  if (!text) return null;

  const native = new Date(text);
  if (!isNaN(native.getTime()) && native.getFullYear() > 2000) {
    return native;
  }

  const match = text
    .toLowerCase()
    .match(/(\d{1,2})\s+([a-zéûôàê]+)\s+(\d{4})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = FRENCH_MONTHS[match[2]];
    const year = parseInt(match[3], 10);
    if (month !== undefined) return new Date(year, month, day);
  }

  return null;
}

export function toDateKey(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function findHeaderCell(sheet, range, targetText, XLSX) {
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      if (cellText(sheet, r, c, XLSX).toLowerCase() === targetText) {
        return { r, c };
      }
    }
  }
  return null;
}

function parseSheet(sheet, sheetName, XLSX) {
  if (!sheet['!ref']) return [];
  const range = XLSX.utils.decode_range(sheet['!ref']);

  const squadHeader = findHeaderCell(sheet, range, 'squad', XLSX);
  const roomHeader = findHeaderCell(sheet, range, 'salle', XLSX);
  if (!squadHeader || !roomHeader) return [];

  const headerRow = squadHeader.r;
  const squadCol = squadHeader.c;
  const roomCol = roomHeader.c;
  const dataStartRow = headerRow + 2;

  const days = [];
  for (let c = squadCol + 1; c < roomCol; c += 2) {
    const dateText = cellText(sheet, headerRow, c, XLSX);
    const date = parseHeaderDate(dateText);
    if (date) days.push({ col: c, date });
  }

  const meetings = [];

  for (let r = dataStartRow; r <= range.e.r; r++) {
    const squad = cellText(sheet, r, squadCol, XLSX);
    if (!squad) break;

    const room = cellText(sheet, r, roomCol, XLSX);

    days.forEach(({ col, date }) => {
      [
        { col, period: 'Matin' },
        { col: col + 1, period: 'Après-midi' },
      ].forEach(({ col: periodCol, period }) => {
        const subject = cellText(sheet, r, periodCol, XLSX);
        if (!subject) return;
        meetings.push({
          id: `${sheetName}-${r}-${periodCol}`,
          date: toDateKey(date),
          period,
          squad,
          subject,
          room,
        });
      });
    });
  }

  return meetings;
}

export function parseWorkbook(arrayBuffer) {
  if (typeof window.XLSX === 'undefined') {
    throw new Error("La bibliothèque de lecture Excel n'est pas chargée (vérifiez la connexion internet).");
  }

  const XLSX = window.XLSX;
  const wb = XLSX.read(arrayBuffer, { type: 'array' });

  const meetings = wb.SheetNames.flatMap((name) => parseSheet(wb.Sheets[name], name, XLSX));
  meetings.sort((a, b) => a.date.localeCompare(b.date) || a.period.localeCompare(b.period));
  return meetings;
}
