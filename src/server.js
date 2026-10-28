import { initDb } from './db/database.js';
import app from './app.js';

const PORT = process.env.PORT || 3000;

await initDb();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
