import 'dotenv/config';
import { loadEnv } from './env';
import { createDatabase } from './db/connection';
import { migrate } from './db/migrate';
import { buildApp } from './server';

const env = loadEnv(process.env);
const db = createDatabase(env.databasePath);
migrate(db);

const app = buildApp({ db, env });

app.listen({ port: env.port, host: '0.0.0.0' }).catch((error: unknown) => {
  app.log.error(error);
  process.exit(1);
});
