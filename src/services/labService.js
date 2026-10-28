import { getLabsWithWorkstationsFromDb } from '../db/labs.js';

export function getLabsWithWorkstations() {
  return getLabsWithWorkstationsFromDb();
}
