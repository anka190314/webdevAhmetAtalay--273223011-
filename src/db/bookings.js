import { query } from './database.js';

export async function getLabById(labId) {
  const res = await query('SELECT * FROM labs WHERE id = $1', [labId]);
  return res.rows[0] || null;
}

export async function getWorkstationsForLab(labId) {
  const res = await query('SELECT id, name FROM workstations WHERE lab_id = $1', [labId]);
  return res.rows;
}

export async function getWorkstationById(workstationId) {
  const res = await query('SELECT * FROM workstations WHERE id = $1', [workstationId]);
  return res.rows[0] || null;
}

export async function getBookingsForLab(labId, date) {
  const res = await query(`
    SELECT b.id, b.user_id, b.workstation_id, b.slot
    FROM bookings b
    JOIN workstations w ON b.workstation_id = w.id
    WHERE w.lab_id = $1 AND b.date = $2
  `, [labId, date]);
  return res.rows;
}

export async function insertBooking(userId, workstationId, date, slot) {
  const res = await query(`
    INSERT INTO bookings (user_id, workstation_id, date, slot)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `, [userId, workstationId, date, slot]);
  return { id: res.rows[0].id };
}

export async function getBooking(bookingId) {
  const res = await query('SELECT * FROM bookings WHERE id = $1', [bookingId]);
  return res.rows[0] || null;
}

export async function deleteBooking(bookingId) {
  await query('DELETE FROM bookings WHERE id = $1', [bookingId]);
}

export async function getUpcomingBookingsForUser(userId, today) {
  const res = await query(`
    SELECT 
      b.date,
      b.slot,
      l.name AS lab_name,
      w.name AS workstation_name
    FROM bookings b
    JOIN workstations w ON b.workstation_id = w.id
    JOIN labs l ON w.lab_id = l.id
    WHERE b.user_id = $1 AND b.date >= $2
    ORDER BY b.date ASC, b.slot ASC
  `, [userId, today]);
  return res.rows;
}
