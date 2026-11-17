import { db } from './database.js';

export function getLabsWithWorkstationsFromDb() {
  const stmt = db.prepare(`
    SELECT labs.id, labs.name, COUNT(workstations.id) AS workstation_count
    FROM labs
    LEFT JOIN workstations ON labs.id = workstations.lab_id
    GROUP BY labs.id, labs.name
    ORDER BY labs.id
  `);
  return stmt.all();
}

export function getLabById(labId) {
  const stmt = db.prepare('SELECT id, name FROM labs WHERE id = ?');
  return stmt.get(labId) || null;
}

export function getWorkstationByNameAndLab(labId, name) {
  const stmt = db.prepare('SELECT id, lab_id, name FROM workstations WHERE lab_id = ? AND name = ?');
  return stmt.get(labId, name) || null;
}

export function insertWorkstation(labId, name) {
  const stmt = db.prepare('INSERT INTO workstations (lab_id, name) VALUES (?, ?)');
  const info = stmt.run(labId, name);
  return { id: info.lastInsertRowid, lab_id: labId, name };
}

export function getLabUsageFromDb(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT labs.id, labs.name, COUNT(bookings.id) AS booking_count
    FROM labs
    LEFT JOIN workstations ON labs.id = workstations.lab_id
    LEFT JOIN bookings ON workstations.id = bookings.workstation_id AND bookings.date >= ? AND bookings.date <= ?
    GROUP BY labs.id, labs.name
    ORDER BY labs.id
  `);
  return stmt.all(startDate, endDate);
}
