CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  workstation_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 5),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workstation_id) REFERENCES workstations(id) ON DELETE CASCADE,
  UNIQUE(workstation_id, date, slot)
);
