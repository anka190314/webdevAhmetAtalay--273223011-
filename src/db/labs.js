import { query } from './database.js';

export async function getLabsWithWorkstationsFromDb() {
  const res = await query(`
    SELECT labs.id, labs.name, COUNT(workstations.id)::int AS workstation_count
    FROM labs
    LEFT JOIN workstations ON labs.id = workstations.lab_id
    GROUP BY labs.id, labs.name
    ORDER BY labs.id
  `);
  return res.rows;
}

export async function getLabById(labId) {
  const res = await query('SELECT id, name FROM labs WHERE id = $1', [labId]);
  return res.rows[0] || null;
}

export async function getWorkstationByNameAndLab(labId, name) {
  const res = await query('SELECT id, lab_id, name FROM workstations WHERE lab_id = $1 AND name = $2', [labId, name]);
  return res.rows[0] || null;
}

export async function insertWorkstation(labId, name) {
  const res = await query('INSERT INTO workstations (lab_id, name) VALUES ($1, $2) RETURNING id', [labId, name]);
  return { id: res.rows[0].id, lab_id: labId, name };
}

export async function getLabUsageFromDb(startDate, endDate) {
  const res = await query(`
    SELECT labs.id, labs.name, COUNT(bookings.id)::int AS booking_count
    FROM labs
    LEFT JOIN workstations ON labs.id = workstations.lab_id
    LEFT JOIN bookings ON workstations.id = bookings.workstation_id AND bookings.date >= $1 AND bookings.date <= $2
    GROUP BY labs.id, labs.name
    ORDER BY labs.id
  `, [startDate, endDate]);
  return res.rows;
}
