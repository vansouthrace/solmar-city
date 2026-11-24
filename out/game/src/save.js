// save.js — save/load progress in localStorage (cash, missions done, best wanted).
const KEY = 'solmar-city-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return {
      cash: typeof s.cash === 'number' ? s.cash : 0,
      missionsDone: typeof s.missionsDone === 'number' ? s.missionsDone : 0,
      bestWanted: typeof s.bestWanted === 'number' ? s.bestWanted : 0,
    };
  } catch (e) { return null; }
}

export function writeSave(data) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage unavailable: progress lasts this visit only */ }
}
