import 'dotenv/config';
import { loadEnv } from '../env';
import { createDatabase } from './connection';
import { migrate } from './migrate';
import { seedDatabase } from './seed';

const env = loadEnv(process.env);
const db = createDatabase(env.databasePath);
migrate(db);
seedDatabase(db);
db.close();

console.log(`Seeded database at ${env.databasePath}`);
