import {
  getLabsWithWorkstationsFromDb,
  getLabById,
  getWorkstationByNameAndLab,
  insertWorkstation,
  getLabUsageFromDb
} from '../db/labs.js';
import {
  NotStaff,
  InvalidInput,
  DuplicateWorkstation,
  LabNotFound
} from './errors.js';

export function getLabsWithWorkstations() {
  return getLabsWithWorkstationsFromDb();
}

function getLocalDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(dateStr) {
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new InvalidInput('Invalid week date');
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  if (day.getFullYear() !== y || day.getMonth() !== m - 1 || day.getDate() !== d) {
    throw new InvalidInput('Invalid week date');
  }
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday: getLocalDateString(monday), sunday: getLocalDateString(sunday) };
}

export function addWorkstation(user, labId, name) {
  if (!user || user.role !== 'staff') {
    throw new NotStaff('Not staff');
  }
  const lab = getLabById(labId);
  if (!lab) {
    throw new LabNotFound('Lab not found');
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    throw new InvalidInput('Invalid workstation name');
  }
  const existing = getWorkstationByNameAndLab(labId, name);
  if (existing) {
    throw new DuplicateWorkstation('Workstation already exists in this lab');
  }
  return insertWorkstation(labId, name);
}

export function getLabUsage(user, weekDate) {
  if (!user || user.role !== 'staff') {
    throw new NotStaff('Not staff');
  }
  const { monday, sunday } = getWeekRange(weekDate);
  return getLabUsageFromDb(monday, sunday);
}
