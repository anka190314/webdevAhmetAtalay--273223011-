import { db } from './database.js';

export function getLabById(labId) {
  const stmt = db.prepare('SELECT * FROM labs WHERE id = ?');
  return stmt.get(labId);
}

export function getWorkstationsForLab(labId) {
  const stmt = db.prepare('SELECT id, name FROM workstations WHERE lab_id = ?');
  return stmt.all(labId);
}

export function getWorkstationById(workstationId) {
  const stmt = db.prepare('SELECT * FROM workstations WHERE id = ?');
  return stmt.get(workstationId);
}

export function getBookingsForLab(labId, date) {
  const stmt = db.prepare(`
    SELECT b.id, b.user_id, b.workstation_id, b.slot
    FROM bookings b
    JOIN workstations w ON b.workstation_id = w.id
    WHERE w.lab_id = ? AND b.date = ?
  `);
  return stmt.all(labId, date);
}

export function insertBooking(userId, workstationId, date, slot) {
  const stmt = db.prepare(`
    INSERT INTO bookings (user_id, workstation_id, date, slot)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(userId, workstationId, date, slot);
}

export function getBooking(bookingId) {
  const stmt = db.prepare('SELECT * FROM bookings WHERE id = ?');
  return stmt.get(bookingId);
}

export function deleteBooking(bookingId) {
  const stmt = db.prepare('DELETE FROM bookings WHERE id = ?');
  return stmt.run(bookingId);
}

export function getUpcomingBookingsForUser(userId, today) {
  const stmt = db.prepare(`
    SELECT 
      b.date,
      b.slot,
      l.name AS lab_name,
      w.name AS workstation_name
    FROM bookings b
    JOIN workstations w ON b.workstation_id = w.id
    JOIN labs l ON w.lab_id = l.id
    WHERE b.user_id = ? AND b.date >= ?
    ORDER BY b.date ASC, b.slot ASC
  `);
  return stmt.all(userId, today);
}
