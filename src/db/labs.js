import { db } from './database.js';

export function getLabsWithWorkstationsFromDb() {
  const stmt = db.prepare(`
    SELECT labs.id, labs.name, COUNT(workstations.id) AS workstation_count
    FROM labs
    LEFT JOIN workstations ON labs.id = workstations.lab_id
    GROUP BY labs.id, labs.name
  `);
  return stmt.all();
}
