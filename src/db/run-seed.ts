import 'dotenv/config';
import { loadEnv } from '../env';
import { createDatabase } from './connection';
import { migrate } from './migrate';
import { seedDatabase } from './seed';

const env = loadEnv(process.env);
const db = createDatabase(env.databasePath);
migrate(db);

const { count } = db.prepare('SELECT COUNT(*) as count FROM patients').get() as {
  count: number;
};

if (count === 0) {
  seedDatabase(db);
  console.log(`Seeded database at ${env.databasePath}`);
} else {
  console.log(`Database at ${env.databasePath} already has data, skipping seed`);
}

db.close();
