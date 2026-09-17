# API REST — Atendimento Médico (Plano 1/2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the standalone REST API (patients, doctors, availability, appointments, payments) with SQLite persistence, layered architecture, security guardrails, automated tests, Swagger docs, a Postman collection, and a Docker image — fully runnable and testable without N8N.

**Architecture:** Fastify + Zod at the boundary, feature-based modules under `src/modules/*` each split into `routes -> controller -> service -> repository` (never skipping a layer), `better-sqlite3` as the only place raw SQL lives, in-memory TTL cache for availability owned by the API (not N8N). N8N orchestration, Gmail, STT/TTS and the full `docker-compose.yml` (n8n + mailpit) are out of scope here — see Plano 2.

**Tech Stack:** TypeScript (`strict: true`), Fastify, `fastify-type-provider-zod`, Zod, better-sqlite3, Vitest, ESLint + Prettier, Husky + lint-staged + commitlint, `@fastify/swagger` + `@fastify/swagger-ui`, `@fastify/rate-limit`, Docker.

**Spec:** `docs/superpowers/specs/2026-09-16-atendimento-medico-essentia-design.md`

## Global Constraints

- TypeScript `strict: true`, no implicit `any`.
- Code identifiers, file names and commit messages in English; human-facing docs (README, comments when needed) in Portuguese.
- No comments unless the "why" is non-obvious; never explain "what" when the name already does.
- Readability over extreme performance, but do not write obviously wasteful code; clean code from the first commit.
- SQLite only via `better-sqlite3`, no ORM.
- Never concatenate values into SQL strings — always prepared statements with bound parameters (`?`), including dynamic filters.
- Conventional Commits in English, enforced by commitlint on `commit-msg`.
- Husky pre-commit must block the commit if lint fails, formatting is wrong, or tests fail.
- Controllers never contain business logic: they parse the already-validated request, call exactly one service method, and shape the HTTP response/DTO. All business logic lives in services. Repository is the only layer touching SQL.
- Treat every input as potentially adversarial: strict Zod schemas (reject unknown fields), generic error messages to clients, detailed errors only in server logs.
- Tests use an isolated in-memory SQLite database per test (via `buildTestApp()`), never the dev database; tests must be idempotent and safe to run in parallel.

---

## File Structure

```
package.json
tsconfig.json
eslint.config.js
.prettierrc
.lintstagedrc.json
commitlint.config.cjs
.husky/pre-commit
.husky/commit-msg
.env.example
Dockerfile
docker-compose.yml
src/
  env.ts
  server.ts
  index.ts
  db/
    schema.ts
    connection.ts
    migrate.ts
    seed.ts
    run-seed.ts
  shared/
    errors.ts
    error-handler.ts
    auth-plugin.ts
    cache/
      availability-cache.ts
  modules/
    patients/
      patient.repository.ts
      patient.service.ts
      patient.controller.ts
      patient.routes.ts
      patient.schemas.ts
    doctors/
      doctor.repository.ts
      doctor.service.ts
      doctor.controller.ts
      doctor.routes.ts
      doctor.schemas.ts
    slots/
      slot.repository.ts
    availability/
      availability.service.ts
      availability.controller.ts
      availability.routes.ts
      availability.schemas.ts
    appointments/
      appointment.repository.ts
      appointment.service.ts
      appointment.controller.ts
      appointment.routes.ts
      appointment.schemas.ts
    payments/
      payment.repository.ts
      payment.service.ts
      payment.controller.ts
      payment.routes.ts
      payment.schemas.ts
test/
  sanity.test.ts
  helpers/
    build-test-app.ts
  env.test.ts
  db.test.ts
  seed.test.ts
  error-handler.test.ts
  auth-plugin.test.ts
  availability-cache.test.ts
  patients.test.ts
  doctors.test.ts
  slot-repository.test.ts
  availability.test.ts
  appointments-create.test.ts
  appointments-cancel.test.ts
  appointments-concurrency.test.ts
  payments.test.ts
  security-edge-cases.test.ts
  swagger.test.ts
postman/
  essentia-api.postman_collection.json
README.md
```

---

### Task 1: Project scaffolding and tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `eslint.config.js`, `.prettierrc`, `.lintstagedrc.json`, `commitlint.config.cjs`
- Modify: `.gitignore`
- Create: `test/sanity.test.ts`

**Interfaces:**
- Produces: `npm run lint`, `npm run format`, `npm test`, `npm run dev`, `npm run build`, `npm run seed` script names, used by every later task.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "essentia-medical-api",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "seed": "tsx src/db/run-seed.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "format": "prettier --check .",
    "format:write": "prettier --write .",
    "prepare": "husky"
  },
  "dependencies": {
    "@fastify/rate-limit": "^10.1.1",
    "@fastify/swagger": "^9.2.0",
    "@fastify/swagger-ui": "^5.1.0",
    "better-sqlite3": "^11.3.0",
    "dotenv": "^16.4.5",
    "fastify": "^5.0.0",
    "fastify-plugin": "^5.0.1",
    "fastify-type-provider-zod": "^4.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.5.0",
    "@commitlint/config-conventional": "^19.5.0",
    "@eslint/js": "^9.11.1",
    "@types/better-sqlite3": "^7.6.11",
    "@types/node": "^22.7.4",
    "eslint": "^9.11.1",
    "eslint-config-prettier": "^9.1.0",
    "husky": "^9.1.6",
    "lint-staged": "^15.2.10",
    "prettier": "^3.3.3",
    "tsx": "^4.19.1",
    "typescript": "^5.6.2",
    "typescript-eslint": "^8.7.0",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: lockfile `package-lock.json` created, no errors (better-sqlite3 compiles its native binding locally).

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": false
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `eslint.config.js`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
);
```

- [ ] **Step 5: Create `.prettierrc`**

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 6: Create `.lintstagedrc.json`**

```json
{
  "*.{ts,js}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"]
}
```

- [ ] **Step 7: Create `commitlint.config.cjs`**

```js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

- [ ] **Step 8: Update `.gitignore`**

Append these lines to the existing `.gitignore` (keep the existing `.ideas`, `.env`, `node_modules/` lines):

```
dist/
data/
*.db
*.db-journal
*.db-wal
*.db-shm
coverage/
```

- [ ] **Step 9: Initialize Husky and create hooks**

Run: `npx husky init`

Replace the generated `.husky/pre-commit` with:

```
npx lint-staged
npm test
```

Create `.husky/commit-msg`:

```
npx --no -- commitlint --edit "$1"
```

- [ ] **Step 10: Create a sanity test**

Create `test/sanity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs vitest correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 11: Verify tooling**

Run: `npm run lint && npm run format && npm test`
Expected: all three succeed (lint: no errors; format: no files need formatting; test: 1 passed).

- [ ] **Step 12: Commit**

```bash
git add package.json package-lock.json tsconfig.json eslint.config.js .prettierrc .lintstagedrc.json commitlint.config.cjs .gitignore .husky test/sanity.test.ts
git commit -m "chore: scaffold TypeScript API project with lint, format and git hooks"
```

---

### Task 2: Environment loader

**Files:**
- Create: `src/env.ts`
- Test: `test/env.test.ts`

**Interfaces:**
- Produces: `export interface Env { port: number; databasePath: string; apiKey: string; availabilityCacheTtlSeconds: number; rateLimitMax: number; rateLimitTimeWindowMs: number }` and `export function loadEnv(source: NodeJS.ProcessEnv): Env`. Every later task that needs configuration imports `Env`/`loadEnv` from `../env` (or `./env` from `src/`).

- [ ] **Step 1: Write the failing test**

Create `test/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadEnv } from '../src/env';

describe('loadEnv', () => {
  it('parses required values and applies defaults', () => {
    const env = loadEnv({
      DATABASE_PATH: './data/dev.db',
      API_KEY: 'a'.repeat(16),
    });

    expect(env).toEqual({
      port: 3000,
      databasePath: './data/dev.db',
      apiKey: 'a'.repeat(16),
      availabilityCacheTtlSeconds: 30,
      rateLimitMax: 100,
      rateLimitTimeWindowMs: 60_000,
    });
  });

  it('overrides defaults when variables are provided', () => {
    const env = loadEnv({
      PORT: '4000',
      DATABASE_PATH: './data/dev.db',
      API_KEY: 'a'.repeat(16),
      AVAILABILITY_CACHE_TTL_SECONDS: '10',
      RATE_LIMIT_MAX: '5',
      RATE_LIMIT_TIME_WINDOW_MS: '1000',
    });

    expect(env.port).toBe(4000);
    expect(env.availabilityCacheTtlSeconds).toBe(10);
    expect(env.rateLimitMax).toBe(5);
    expect(env.rateLimitTimeWindowMs).toBe(1000);
  });

  it('throws when a required variable is missing', () => {
    expect(() => loadEnv({})).toThrow();
  });

  it('throws when API_KEY is too short', () => {
    expect(() => loadEnv({ DATABASE_PATH: './data/dev.db', API_KEY: 'short' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/env.test.ts`
Expected: FAIL — `src/env.ts` does not exist yet.

- [ ] **Step 3: Implement `src/env.ts`**

```ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1),
  API_KEY: z.string().min(16),
  AVAILABILITY_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_TIME_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
});

export interface Env {
  port: number;
  databasePath: string;
  apiKey: string;
  availabilityCacheTtlSeconds: number;
  rateLimitMax: number;
  rateLimitTimeWindowMs: number;
}

export function loadEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.parse(source);

  return {
    port: parsed.PORT,
    databasePath: parsed.DATABASE_PATH,
    apiKey: parsed.API_KEY,
    availabilityCacheTtlSeconds: parsed.AVAILABILITY_CACHE_TTL_SECONDS,
    rateLimitMax: parsed.RATE_LIMIT_MAX,
    rateLimitTimeWindowMs: parsed.RATE_LIMIT_TIME_WINDOW_MS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/env.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/env.ts test/env.test.ts
git commit -m "feat: add environment variable loader with validation"
```

---

### Task 3: Database schema, connection and migration

**Files:**
- Create: `src/db/schema.ts`, `src/db/connection.ts`, `src/db/migrate.ts`
- Test: `test/db.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `export function createDatabase(path: string): Database.Database` (from `src/db/connection.ts`), `export function migrate(db: Database.Database): void` (from `src/db/migrate.ts`). Every later repository/test imports these.

- [ ] **Step 1: Write the failing test**

Create `test/db.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';

describe('migrate', () => {
  it('creates all required tables', () => {
    const db = createDatabase(':memory:');
    migrate(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      'appointment_slots',
      'appointments',
      'doctors',
      'patients',
      'payment_configs',
    ]);

    db.close();
  });

  it('is idempotent when run twice', () => {
    const db = createDatabase(':memory:');
    migrate(db);
    expect(() => migrate(db)).not.toThrow();
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/db.test.ts`
Expected: FAIL — modules do not exist yet.

- [ ] **Step 3: Implement `src/db/schema.ts`**

```ts
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS doctors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointment_slots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id),
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'booked')) DEFAULT 'available'
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  slot_id INTEGER NOT NULL REFERENCES appointment_slots(id),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  cancelled_at TEXT
);

CREATE TABLE IF NOT EXISTS payment_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  consultation_type TEXT NOT NULL UNIQUE,
  price REAL NOT NULL,
  payment_methods TEXT NOT NULL
);
`;
```

- [ ] **Step 4: Implement `src/db/connection.ts`**

```ts
import Database from 'better-sqlite3';

export function createDatabase(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
```

- [ ] **Step 5: Implement `src/db/migrate.ts`**

```ts
import type Database from 'better-sqlite3';
import { SCHEMA_SQL } from './schema';

export function migrate(db: Database.Database): void {
  db.exec(SCHEMA_SQL);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/db/connection.ts src/db/migrate.ts test/db.test.ts
git commit -m "feat: add SQLite schema, connection factory and migration"
```

---

### Task 4: Seed script

**Files:**
- Create: `src/db/seed.ts`, `src/db/run-seed.ts`
- Test: `test/seed.test.ts`

**Interfaces:**
- Consumes: `createDatabase`, `migrate` from Task 3; `loadEnv` from Task 2.
- Produces: `export interface SeedResult { patientIds: number[]; doctorIds: number[]; slotIds: number[] }` and `export function seedDatabase(db: Database.Database): SeedResult`. `test/helpers/build-test-app.ts` (Task 8) depends on this exact shape.

- [ ] **Step 1: Write the failing test**

Create `test/seed.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';

describe('seedDatabase', () => {
  it('inserts patients, doctors, slots, an existing booking and payment configs', () => {
    const db = createDatabase(':memory:');
    migrate(db);

    const result = seedDatabase(db);

    expect(result.patientIds).toHaveLength(2);
    expect(result.doctorIds).toHaveLength(2);
    expect(result.slotIds).toHaveLength(3);

    const patientCount = (db.prepare('SELECT COUNT(*) as count FROM patients').get() as { count: number })
      .count;
    const bookedSlot = db
      .prepare('SELECT status FROM appointment_slots WHERE id = ?')
      .get(result.slotIds[1]) as { status: string };
    const activeAppointments = (
      db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'active'").get() as {
        count: number;
      }
    ).count;
    const paymentConfigCount = (
      db.prepare('SELECT COUNT(*) as count FROM payment_configs').get() as { count: number }
    ).count;

    expect(patientCount).toBe(2);
    expect(bookedSlot.status).toBe('booked');
    expect(activeAppointments).toBe(1);
    expect(paymentConfigCount).toBe(2);

    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/seed.test.ts`
Expected: FAIL — `src/db/seed.ts` does not exist yet.

- [ ] **Step 3: Implement `src/db/seed.ts`**

```ts
import type Database from 'better-sqlite3';

export interface SeedResult {
  patientIds: number[];
  doctorIds: number[];
  slotIds: number[];
}

export function seedDatabase(db: Database.Database): SeedResult {
  const insertPatient = db.prepare('INSERT INTO patients (name, email, phone) VALUES (?, ?, ?)');
  const insertDoctor = db.prepare('INSERT INTO doctors (name, specialty) VALUES (?, ?)');
  const insertSlot = db.prepare(
    'INSERT INTO appointment_slots (doctor_id, date, start_time, end_time, status) VALUES (?, ?, ?, ?, ?)',
  );
  const insertAppointment = db.prepare(
    'INSERT INTO appointments (patient_id, slot_id, status) VALUES (?, ?, ?)',
  );
  const insertPaymentConfig = db.prepare(
    'INSERT INTO payment_configs (consultation_type, price, payment_methods) VALUES (?, ?, ?)',
  );

  const patientIds = [
    Number(insertPatient.run('Ana Souza', 'ana.souza@example.com', '+5511900000001').lastInsertRowid),
    Number(insertPatient.run('Bruno Lima', 'bruno.lima@example.com', '+5511900000002').lastInsertRowid),
  ];

  const doctorIds = [
    Number(insertDoctor.run('Dra. Carla Mendes', 'cardiology').lastInsertRowid),
    Number(insertDoctor.run('Dr. Diego Alves', 'dermatology').lastInsertRowid),
  ];

  const slotIds = [
    Number(
      insertSlot.run(doctorIds[0], '2026-09-20', '09:00', '09:30', 'available').lastInsertRowid,
    ),
    Number(insertSlot.run(doctorIds[0], '2026-09-20', '10:00', '10:30', 'booked').lastInsertRowid),
    Number(
      insertSlot.run(doctorIds[1], '2026-09-21', '14:00', '14:30', 'available').lastInsertRowid,
    ),
  ];

  // slotIds[1] starts pre-booked so tests and demos have a ready-made conflict scenario.
  insertAppointment.run(patientIds[1], slotIds[1], 'active');

  insertPaymentConfig.run('consultation', 250, JSON.stringify(['pix', 'credit_card', 'boleto']));
  insertPaymentConfig.run('follow_up', 150, JSON.stringify(['pix', 'credit_card']));

  return { patientIds, doctorIds, slotIds };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/seed.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Implement `src/db/run-seed.ts`**

```ts
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
```

- [ ] **Step 6: Commit**

```bash
git add src/db/seed.ts src/db/run-seed.ts test/seed.test.ts
git commit -m "feat: add database seed script with fixed fixture ids"
```

---

### Task 5: Domain errors and centralized error handler

**Files:**
- Create: `src/shared/errors.ts`, `src/shared/error-handler.ts`
- Test: `test/error-handler.test.ts`

**Interfaces:**
- Produces: `DomainError` and subclasses `PatientNotFoundError`, `DoctorNotFoundError`, `SlotNotFoundError`, `SlotAlreadyBookedError`, `AppointmentNotFoundError`, `AppointmentAlreadyCancelledError`, `PaymentConfigNotFoundError` (all `new (identifier: string)`, each with `readonly statusCode: number` and `readonly code: string`); `export function registerErrorHandler(app: FastifyInstance): void`. Services (Tasks 9, 13, 14, 16) throw these; `server.ts` (Task 8) calls `registerErrorHandler`.

- [ ] **Step 1: Write the failing test**

Create `test/error-handler.test.ts`:

```ts
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerErrorHandler } from '../src/shared/error-handler';
import { PatientNotFoundError, SlotAlreadyBookedError } from '../src/shared/errors';

function buildTestServer() {
  const app = Fastify();
  registerErrorHandler(app);

  app.get('/not-found', async () => {
    throw new PatientNotFoundError('42');
  });
  app.get('/conflict', async () => {
    throw new SlotAlreadyBookedError('7');
  });
  app.get('/unexpected', async () => {
    throw new Error('boom');
  });

  return app;
}

describe('registerErrorHandler', () => {
  it('maps a not-found domain error to 404 with its code', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/not-found' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'PATIENT_NOT_FOUND' });
  });

  it('maps a conflict domain error to 409 with its code', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/conflict' });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: 'SLOT_ALREADY_BOOKED' });
  });

  it('maps an unexpected error to a generic 500 without leaking details', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/unexpected' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/error-handler.test.ts`
Expected: FAIL — modules do not exist yet.

- [ ] **Step 3: Implement `src/shared/errors.ts`**

```ts
export abstract class DomainError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class PatientNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'PATIENT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Patient not found: ${identifier}`);
  }
}

export class DoctorNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'DOCTOR_NOT_FOUND';

  constructor(identifier: string) {
    super(`Doctor not found: ${identifier}`);
  }
}

export class SlotNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'SLOT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Slot not found: ${identifier}`);
  }
}

export class SlotAlreadyBookedError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'SLOT_ALREADY_BOOKED';

  constructor(identifier: string) {
    super(`Slot already booked: ${identifier}`);
  }
}

export class AppointmentNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'APPOINTMENT_NOT_FOUND';

  constructor(identifier: string) {
    super(`Appointment not found: ${identifier}`);
  }
}

export class AppointmentAlreadyCancelledError extends DomainError {
  readonly statusCode = 409;
  readonly code = 'APPOINTMENT_ALREADY_CANCELLED';

  constructor(identifier: string) {
    super(`Appointment already cancelled: ${identifier}`);
  }
}

export class PaymentConfigNotFoundError extends DomainError {
  readonly statusCode = 404;
  readonly code = 'PAYMENT_CONFIG_NOT_FOUND';

  constructor(identifier: string) {
    super(`Payment config not found: ${identifier}`);
  }
}
```

- [ ] **Step 4: Implement `src/shared/error-handler.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { DomainError } from './errors';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof DomainError) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }

    const isValidationError =
      error instanceof ZodError ||
      error.code === 'FST_ERR_VALIDATION' ||
      Boolean((error as { validation?: unknown }).validation);

    if (isValidationError) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Invalid request data' });
    }

    request.log.error(error);
    return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Unexpected error' });
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/error-handler.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/shared/errors.ts src/shared/error-handler.ts test/error-handler.test.ts
git commit -m "feat: add typed domain errors and centralized error handler"
```

---

### Task 6: API key authentication plugin

**Files:**
- Create: `src/shared/auth-plugin.ts`
- Test: `test/auth-plugin.test.ts`

**Interfaces:**
- Produces: `export interface AuthPluginOptions { apiKey: string; publicPaths?: string[] }` and `export const authPlugin: FastifyPluginAsync<AuthPluginOptions>`. `server.ts` (Task 8) registers it with `{ apiKey: env.apiKey }`.

- [ ] **Step 1: Write the failing test**

Create `test/auth-plugin.test.ts`:

```ts
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { authPlugin } from '../src/shared/auth-plugin';

function buildTestServer() {
  const app = Fastify();
  void app.register(authPlugin, { apiKey: 'expected-key' });
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/protected', async () => ({ secret: true }));
  return app;
}

describe('authPlugin', () => {
  it('allows public paths without a key', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });

  it('rejects protected paths without a key', async () => {
    const app = buildTestServer();
    const response = await app.inject({ method: 'GET', url: '/protected' });
    expect(response.statusCode).toBe(401);
  });

  it('rejects protected paths with a wrong key', async () => {
    const app = buildTestServer();
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'wrong-key' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('allows protected paths with the correct key', async () => {
    const app = buildTestServer();
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { 'x-api-key': 'expected-key' },
    });
    expect(response.statusCode).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/auth-plugin.test.ts`
Expected: FAIL — `src/shared/auth-plugin.ts` does not exist yet.

- [ ] **Step 3: Implement `src/shared/auth-plugin.ts`**

```ts
import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';

export interface AuthPluginOptions {
  apiKey: string;
  publicPaths?: string[];
}

const DEFAULT_PUBLIC_PATHS = ['/health', '/docs'];

async function authPluginImpl(app: Parameters<FastifyPluginAsync<AuthPluginOptions>>[0], options: AuthPluginOptions) {
  const publicPaths = options.publicPaths ?? DEFAULT_PUBLIC_PATHS;

  app.addHook('onRequest', async (request, reply) => {
    const isPublic = publicPaths.some((path) => request.url.startsWith(path));
    if (isPublic) {
      return;
    }

    const providedKey = request.headers['x-api-key'];
    if (providedKey !== options.apiKey) {
      await reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Invalid or missing API key' });
    }
  });
}

export const authPlugin: FastifyPluginAsync<AuthPluginOptions> = fp(authPluginImpl);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/auth-plugin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/auth-plugin.ts test/auth-plugin.test.ts
git commit -m "feat: add x-api-key authentication plugin"
```

---

### Task 7: Availability cache

**Files:**
- Create: `src/shared/cache/availability-cache.ts`
- Test: `test/availability-cache.test.ts`

**Interfaces:**
- Produces: `export interface CachedSlot { id: number; doctorId: number; doctorName: string; specialty: string; date: string; startTime: string; endTime: string }`, `export function createAvailabilityCache(ttlSeconds: number)` returning `{ get(key: string): CachedSlot[] | undefined; set(key: string, value: CachedSlot[]): void; invalidateDate(date: string): void }`, `export type AvailabilityCache = ReturnType<typeof createAvailabilityCache>`. Used by Task 11 (`slot.repository.ts` reuses `CachedSlot` as `AvailableSlotView`), Task 12 (availability service) and Tasks 13-14 (appointment service invalidation).

- [ ] **Step 1: Write the failing test**

Create `test/availability-cache.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createAvailabilityCache } from '../src/shared/cache/availability-cache';

const sampleSlot = {
  id: 1,
  doctorId: 1,
  doctorName: 'Dra. Carla Mendes',
  specialty: 'cardiology',
  date: '2026-09-20',
  startTime: '09:00',
  endTime: '09:30',
};

describe('createAvailabilityCache', () => {
  it('returns undefined for a missing key', () => {
    const cache = createAvailabilityCache(30);
    expect(cache.get('2026-09-20||')).toBeUndefined();
  });

  it('returns a cached value before it expires', () => {
    const cache = createAvailabilityCache(30);
    cache.set('2026-09-20||', [sampleSlot]);
    expect(cache.get('2026-09-20||')).toEqual([sampleSlot]);
  });

  it('expires entries after the ttl', () => {
    vi.useFakeTimers();
    const cache = createAvailabilityCache(1);
    cache.set('2026-09-20||', [sampleSlot]);
    vi.advanceTimersByTime(1_001);
    expect(cache.get('2026-09-20||')).toBeUndefined();
    vi.useRealTimers();
  });

  it('invalidates every key for a given date, regardless of filters', () => {
    const cache = createAvailabilityCache(30);
    cache.set('2026-09-20|1|', [sampleSlot]);
    cache.set('2026-09-20||cardiology', [sampleSlot]);
    cache.set('2026-09-21||', [sampleSlot]);

    cache.invalidateDate('2026-09-20');

    expect(cache.get('2026-09-20|1|')).toBeUndefined();
    expect(cache.get('2026-09-20||cardiology')).toBeUndefined();
    expect(cache.get('2026-09-21||')).toEqual([sampleSlot]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/availability-cache.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement `src/shared/cache/availability-cache.ts`**

```ts
export interface CachedSlot {
  id: number;
  doctorId: number;
  doctorName: string;
  specialty: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CacheEntry {
  value: CachedSlot[];
  expiresAt: number;
}

export function createAvailabilityCache(ttlSeconds: number) {
  const store = new Map<string, CacheEntry>();

  return {
    get(key: string): CachedSlot[] | undefined {
      const entry = store.get(key);
      if (!entry) {
        return undefined;
      }
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key: string, value: CachedSlot[]): void {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    invalidateDate(date: string): void {
      for (const key of store.keys()) {
        if (key.startsWith(`${date}|`)) {
          store.delete(key);
        }
      }
    },
  };
}

export type AvailabilityCache = ReturnType<typeof createAvailabilityCache>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/availability-cache.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/cache/availability-cache.ts test/availability-cache.test.ts
git commit -m "feat: add in-memory TTL cache for availability lookups"
```

---

### Task 8: Server factory, health check and test app helper

**Files:**
- Create: `src/server.ts`, `src/index.ts`, `test/helpers/build-test-app.ts`
- Test: `test/server.test.ts`

**Interfaces:**
- Consumes: `Env` (Task 2), `registerErrorHandler` (Task 5), `authPlugin` (Task 6), `createAvailabilityCache` (Task 7), `createDatabase`/`migrate` (Task 3), `seedDatabase` (Task 4).
- Produces: `export interface BuildAppDeps { db: Database.Database; env: Env }` and `export function buildApp(deps: BuildAppDeps): FastifyInstance` (from `src/server.ts`). `test/helpers/build-test-app.ts` exports `export function buildTestApp(envOverrides?: Partial<Env>): { app: FastifyInstance; seed: SeedResult; env: Env }` and `export function authHeaders(env: Env): Record<string, string>`, used by every module test from Task 9 onward. Route modules registered inside `buildApp` are added incrementally in Tasks 9-16; for this task, `buildApp` only wires infrastructure (swagger, rate limit, auth, error handler, health route) — no domain routes yet.

- [ ] **Step 1: Write the failing test**

Create `test/server.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/build-test-app';

describe('buildApp', () => {
  it('exposes a public health check', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it('serves swagger UI without an API key', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs' });
    expect(response.statusCode).toBeLessThan(400);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/server.test.ts`
Expected: FAIL — `src/server.ts` and `test/helpers/build-test-app.ts` do not exist yet.

- [ ] **Step 3: Implement `src/server.ts`**

```ts
import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import type { Env } from './env';
import { registerErrorHandler } from './shared/error-handler';
import { authPlugin } from './shared/auth-plugin';
import { createAvailabilityCache } from './shared/cache/availability-cache';

export interface BuildAppDeps {
  db: Database.Database;
  env: Env;
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  app.get('/health', async () => ({ status: 'ok' }));

  void app.register(swagger, {
    openapi: { info: { title: 'Essentia Medical API', version: '1.0.0' } },
  });
  void app.register(swaggerUi, { routePrefix: '/docs' });

  void app.register(rateLimit, {
    max: deps.env.rateLimitMax,
    timeWindow: deps.env.rateLimitTimeWindowMs,
  });

  void app.register(authPlugin, { apiKey: deps.env.apiKey });

  const availabilityCache = createAvailabilityCache(deps.env.availabilityCacheTtlSeconds);
  void availabilityCache;

  return app;
}
```

- [ ] **Step 4: Implement `src/index.ts`**

```ts
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
```

- [ ] **Step 5: Implement `test/helpers/build-test-app.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import { createDatabase } from '../../src/db/connection';
import { migrate } from '../../src/db/migrate';
import { seedDatabase, type SeedResult } from '../../src/db/seed';
import { buildApp } from '../../src/server';
import type { Env } from '../../src/env';

export interface TestApp {
  app: FastifyInstance;
  seed: SeedResult;
  env: Env;
}

const TEST_API_KEY = 'test-api-key-0123456789';

export function buildTestApp(envOverrides: Partial<Env> = {}): TestApp {
  const db = createDatabase(':memory:');
  migrate(db);
  const seed = seedDatabase(db);

  const env: Env = {
    port: 0,
    databasePath: ':memory:',
    apiKey: TEST_API_KEY,
    availabilityCacheTtlSeconds: 30,
    rateLimitMax: 1000,
    rateLimitTimeWindowMs: 60_000,
    ...envOverrides,
  };

  const app = buildApp({ db, env });

  return { app, seed, env };
}

export function authHeaders(env: Env): Record<string, string> {
  return { 'x-api-key': env.apiKey };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/server.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add src/server.ts src/index.ts test/helpers/build-test-app.ts test/server.test.ts
git commit -m "feat: add server factory with swagger, rate limit, auth and health check"
```

---

### Task 9: Patients module

**Files:**
- Create: `src/modules/patients/patient.repository.ts`, `patient.service.ts`, `patient.controller.ts`, `patient.routes.ts`, `patient.schemas.ts`
- Modify: `src/server.ts`
- Test: `test/patients.test.ts`

**Interfaces:**
- Consumes: `PatientNotFoundError` (Task 5), `buildTestApp`/`authHeaders` (Task 8).
- Produces: `export interface PatientRow { id: number; name: string; email: string; phone: string }`, `createPatientRepository(db): PatientRepository`, `createPatientService(repository): PatientService` with `lookupPatient(params: { email?: string; phone?: string }): PatientRow`, `registerPatientRoutes(app, db): void`. `PatientRepository`/`PatientRow` are reused by Task 13 (`appointment.service.ts` needs `findById`).

- [ ] **Step 1: Write the failing test**

Create `test/patients.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /patients/lookup', () => {
  it('finds a patient by email', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=ana.souza@example.com',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: seed.patientIds[0], email: 'ana.souza@example.com' });
    await app.close();
  });

  it('finds a patient by phone', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?phone=%2B5511900000002',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: 'Bruno Lima' });
    await app.close();
  });

  it('returns 404 when no patient matches', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=unknown@example.com',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 400 when neither email nor phone is provided', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 400 when an unknown query field is provided', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=ana.souza@example.com&unexpected=1',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 401 without an API key', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/patients/lookup?email=ana.souza@example.com',
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/patients.test.ts`
Expected: FAIL — route `/patients/lookup` does not exist yet (404 from Fastify's default not-found handler).

- [ ] **Step 3: Implement `src/modules/patients/patient.schemas.ts`**

```ts
import { z } from 'zod';

export const lookupPatientQuerySchema = z
  .object({
    email: z.string().email().max(254).optional(),
    phone: z.string().min(8).max(20).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.email) || Boolean(data.phone), {
    message: 'Provide email or phone',
  });

export type LookupPatientQuery = z.infer<typeof lookupPatientQuerySchema>;

export const patientResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  phone: z.string(),
});
```

- [ ] **Step 4: Implement `src/modules/patients/patient.repository.ts`**

```ts
import type Database from 'better-sqlite3';

export interface PatientRow {
  id: number;
  name: string;
  email: string;
  phone: string;
}

export function createPatientRepository(db: Database.Database) {
  const findByEmailStmt = db.prepare('SELECT id, name, email, phone FROM patients WHERE email = ?');
  const findByPhoneStmt = db.prepare('SELECT id, name, email, phone FROM patients WHERE phone = ?');
  const findByIdStmt = db.prepare('SELECT id, name, email, phone FROM patients WHERE id = ?');

  return {
    findByEmail(email: string): PatientRow | undefined {
      return findByEmailStmt.get(email) as PatientRow | undefined;
    },
    findByPhone(phone: string): PatientRow | undefined {
      return findByPhoneStmt.get(phone) as PatientRow | undefined;
    },
    findById(id: number): PatientRow | undefined {
      return findByIdStmt.get(id) as PatientRow | undefined;
    },
  };
}

export type PatientRepository = ReturnType<typeof createPatientRepository>;
```

- [ ] **Step 5: Implement `src/modules/patients/patient.service.ts`**

```ts
import type { PatientRepository, PatientRow } from './patient.repository';
import { PatientNotFoundError } from '../../shared/errors';

export interface LookupPatientParams {
  email?: string;
  phone?: string;
}

export function createPatientService(repository: PatientRepository) {
  return {
    lookupPatient(params: LookupPatientParams): PatientRow {
      const patient = params.email
        ? repository.findByEmail(params.email)
        : params.phone
          ? repository.findByPhone(params.phone)
          : undefined;

      if (!patient) {
        throw new PatientNotFoundError(params.email ?? params.phone ?? 'unknown');
      }

      return patient;
    },
  };
}

export type PatientService = ReturnType<typeof createPatientService>;
```

- [ ] **Step 6: Implement `src/modules/patients/patient.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PatientService } from './patient.service';
import type { LookupPatientQuery } from './patient.schemas';

export function createPatientController(service: PatientService) {
  return {
    async lookup(request: FastifyRequest<{ Querystring: LookupPatientQuery }>, reply: FastifyReply) {
      const patient = service.lookupPatient(request.query);
      return reply.status(200).send(patient);
    },
  };
}
```

- [ ] **Step 7: Implement `src/modules/patients/patient.routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createPatientRepository } from './patient.repository';
import { createPatientService } from './patient.service';
import { createPatientController } from './patient.controller';
import { lookupPatientQuerySchema, patientResponseSchema } from './patient.schemas';

export function registerPatientRoutes(app: FastifyInstance, db: Database.Database): void {
  const repository = createPatientRepository(db);
  const service = createPatientService(repository);
  const controller = createPatientController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/patients/lookup',
    {
      schema: {
        querystring: lookupPatientQuerySchema,
        response: { 200: patientResponseSchema },
      },
    },
    controller.lookup,
  );
}
```

- [ ] **Step 8: Wire the routes into `src/server.ts`**

Add the import and registration call to `src/server.ts`:

```ts
import { registerPatientRoutes } from './modules/patients/patient.routes';
```

Add the following line right after `void availabilityCache;` (do NOT remove that line yet — `availabilityCache` is still unused until Task 12 wires it into `registerAvailabilityRoutes`, and removing the `void` suppressor now would fail `npm run lint`):

```ts
  registerPatientRoutes(app, deps.db);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run test/patients.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 10: Commit**

```bash
git add src/modules/patients src/server.ts test/patients.test.ts
git commit -m "feat: add patient lookup endpoint"
```

---

### Task 10: Doctors module

**Files:**
- Create: `src/modules/doctors/doctor.repository.ts`, `doctor.service.ts`, `doctor.controller.ts`, `doctor.routes.ts`, `doctor.schemas.ts`
- Modify: `src/server.ts`
- Test: `test/doctors.test.ts`

**Interfaces:**
- Produces: `export interface DoctorRow { id: number; name: string; specialty: string }`, `createDoctorRepository(db): DoctorRepository` with `findAll(): DoctorRow[]`, `registerDoctorRoutes(app, db): void`. `DoctorRow`/`DoctorRepository.findAll` shape is reused conceptually by Task 11's join (same column names).

- [ ] **Step 1: Write the failing test**

Create `test/doctors.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /doctors', () => {
  it('lists all doctors', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ name: string; specialty: string }>;
    expect(body).toHaveLength(2);
    expect(body.map((doctor) => doctor.specialty).sort()).toEqual(['cardiology', 'dermatology']);
    await app.close();
  });

  it('returns 401 without an API key', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/doctors' });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/doctors.test.ts`
Expected: FAIL — route does not exist yet.

- [ ] **Step 3: Implement `src/modules/doctors/doctor.repository.ts`**

```ts
import type Database from 'better-sqlite3';

export interface DoctorRow {
  id: number;
  name: string;
  specialty: string;
}

export function createDoctorRepository(db: Database.Database) {
  const findAllStmt = db.prepare('SELECT id, name, specialty FROM doctors');

  return {
    findAll(): DoctorRow[] {
      return findAllStmt.all() as DoctorRow[];
    },
  };
}

export type DoctorRepository = ReturnType<typeof createDoctorRepository>;
```

- [ ] **Step 4: Implement `src/modules/doctors/doctor.service.ts`**

```ts
import type { DoctorRepository } from './doctor.repository';

export function createDoctorService(repository: DoctorRepository) {
  return {
    listDoctors() {
      return repository.findAll();
    },
  };
}

export type DoctorService = ReturnType<typeof createDoctorService>;
```

- [ ] **Step 5: Implement `src/modules/doctors/doctor.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { DoctorService } from './doctor.service';

export function createDoctorController(service: DoctorService) {
  return {
    async list(_request: FastifyRequest, reply: FastifyReply) {
      return reply.status(200).send(service.listDoctors());
    },
  };
}
```

- [ ] **Step 6: Implement `src/modules/doctors/doctor.schemas.ts`**

```ts
import { z } from 'zod';

export const doctorResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  specialty: z.string(),
});

export const listDoctorsResponseSchema = z.array(doctorResponseSchema);
```

- [ ] **Step 7: Implement `src/modules/doctors/doctor.routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createDoctorRepository } from './doctor.repository';
import { createDoctorService } from './doctor.service';
import { createDoctorController } from './doctor.controller';
import { listDoctorsResponseSchema } from './doctor.schemas';

export function registerDoctorRoutes(app: FastifyInstance, db: Database.Database): void {
  const repository = createDoctorRepository(db);
  const service = createDoctorService(repository);
  const controller = createDoctorController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/doctors',
    { schema: { response: { 200: listDoctorsResponseSchema } } },
    controller.list,
  );
}
```

- [ ] **Step 8: Wire into `src/server.ts`**

Add the import:

```ts
import { registerDoctorRoutes } from './modules/doctors/doctor.routes';
```

Add after `registerPatientRoutes(app, deps.db);`:

```ts
  registerDoctorRoutes(app, deps.db);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run test/doctors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add src/modules/doctors src/server.ts test/doctors.test.ts
git commit -m "feat: add doctors listing endpoint"
```

---

### Task 11: Slot repository (shared by availability and appointments)

**Files:**
- Create: `src/modules/slots/slot.repository.ts`
- Test: `test/slot-repository.test.ts`

**Interfaces:**
- Produces: `export interface SlotRow { id: number; doctor_id: number; date: string; start_time: string; end_time: string; status: 'available' | 'booked' }`, `export interface AvailableSlotView { id: number; doctorId: number; doctorName: string; specialty: string; date: string; startTime: string; endTime: string }`, `export interface AvailabilityFilters { date: string; doctorId?: number; specialty?: string }`, `createSlotRepository(db)` returning `{ findById(id): SlotRow | undefined; markStatus(id, status): void; findAvailable(filters: AvailabilityFilters): AvailableSlotView[] }`. Consumed by Task 12 (availability service) and Tasks 13-14 (appointment service).

- [ ] **Step 1: Write the failing test**

Create `test/slot-repository.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../src/db/connection';
import { migrate } from '../src/db/migrate';
import { seedDatabase } from '../src/db/seed';
import { createSlotRepository } from '../src/modules/slots/slot.repository';

function setup() {
  const db = createDatabase(':memory:');
  migrate(db);
  const seed = seedDatabase(db);
  return { db, seed, repository: createSlotRepository(db) };
}

describe('slotRepository', () => {
  it('finds a slot by id', () => {
    const { repository, seed } = setup();
    const slot = repository.findById(seed.slotIds[0]);
    expect(slot).toMatchObject({ status: 'available' });
  });

  it('returns undefined for a missing id', () => {
    const { repository } = setup();
    expect(repository.findById(999_999)).toBeUndefined();
  });

  it('updates a slot status', () => {
    const { repository, seed } = setup();
    repository.markStatus(seed.slotIds[0], 'booked');
    expect(repository.findById(seed.slotIds[0])?.status).toBe('booked');
  });

  it('finds available slots for a date, excluding booked ones', () => {
    const { repository } = setup();
    const slots = repository.findAvailable({ date: '2026-09-20' });
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ date: '2026-09-20', specialty: 'cardiology' });
  });

  it('filters by doctorId', () => {
    const { repository, seed } = setup();
    const slots = repository.findAvailable({ date: '2026-09-21', doctorId: seed.doctorIds[1] });
    expect(slots).toHaveLength(1);
  });

  it('filters by specialty', () => {
    const { repository } = setup();
    const slots = repository.findAvailable({ date: '2026-09-21', specialty: 'dermatology' });
    expect(slots).toHaveLength(1);
  });

  it('returns an empty array when nothing matches', () => {
    const { repository } = setup();
    expect(repository.findAvailable({ date: '2099-01-01' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/slot-repository.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement `src/modules/slots/slot.repository.ts`**

```ts
import type Database from 'better-sqlite3';

export interface SlotRow {
  id: number;
  doctor_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'booked';
}

export interface AvailableSlotView {
  id: number;
  doctorId: number;
  doctorName: string;
  specialty: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface AvailabilityFilters {
  date: string;
  doctorId?: number;
  specialty?: string;
}

export function createSlotRepository(db: Database.Database) {
  const findByIdStmt = db.prepare(
    'SELECT id, doctor_id, date, start_time, end_time, status FROM appointment_slots WHERE id = ?',
  );
  const markStatusStmt = db.prepare('UPDATE appointment_slots SET status = ? WHERE id = ?');

  return {
    findById(id: number): SlotRow | undefined {
      return findByIdStmt.get(id) as SlotRow | undefined;
    },
    markStatus(id: number, status: 'available' | 'booked'): void {
      markStatusStmt.run(status, id);
    },
    findAvailable(filters: AvailabilityFilters): AvailableSlotView[] {
      const conditions = ['s.status = ?', 's.date = ?'];
      const params: Array<string | number> = ['available', filters.date];

      if (filters.doctorId !== undefined) {
        conditions.push('d.id = ?');
        params.push(filters.doctorId);
      }

      if (filters.specialty !== undefined) {
        conditions.push('d.specialty = ?');
        params.push(filters.specialty);
      }

      const query = `
        SELECT s.id as id, d.id as doctorId, d.name as doctorName, d.specialty as specialty,
               s.date as date, s.start_time as startTime, s.end_time as endTime
        FROM appointment_slots s
        JOIN doctors d ON d.id = s.doctor_id
        WHERE ${conditions.join(' AND ')}
        ORDER BY s.start_time ASC
      `;

      return db.prepare(query).all(...params) as AvailableSlotView[];
    },
  };
}

export type SlotRepository = ReturnType<typeof createSlotRepository>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/slot-repository.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/slots test/slot-repository.test.ts
git commit -m "feat: add slot repository shared by availability and appointments"
```

---

### Task 12: Availability module (with cache)

**Files:**
- Create: `src/modules/availability/availability.service.ts`, `availability.controller.ts`, `availability.routes.ts`, `availability.schemas.ts`
- Modify: `src/server.ts`
- Test: `test/availability.test.ts`

**Interfaces:**
- Consumes: `createSlotRepository`/`AvailableSlotView` (Task 11), `AvailabilityCache` (Task 7).
- Produces: `createAvailabilityService(repository, cache)` returning `{ getAvailability(query: AvailabilityQuery): AvailableSlotView[] }`, `registerAvailabilityRoutes(app, db, cache: AvailabilityCache): void`. `server.ts` now owns a single `availabilityCache` instance shared with Tasks 13-14.

- [ ] **Step 1: Write the failing test**

Create `test/availability.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /availability', () => {
  it('returns available slots for a date', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as Array<{ status?: string }>;
    expect(body).toHaveLength(1);
    await app.close();
  });

  it('returns an empty array when there is no availability', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=2099-01-01',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    await app.close();
  });

  it('filters by specialty', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-21&specialty=dermatology',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(1);
    await app.close();
  });

  it('rejects a malformed date', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/availability?date=20-09-2026',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns the same result for repeated identical queries', async () => {
    const { app, env } = buildTestApp();
    const first = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    const second = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });

    expect(first.json()).toEqual(second.json());
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/availability.test.ts`
Expected: FAIL — route does not exist yet.

- [ ] **Step 3: Implement `src/modules/availability/availability.schemas.ts`**

```ts
import { z } from 'zod';

export const availabilityQuerySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be in YYYY-MM-DD format'),
    doctorId: z.coerce.number().int().positive().optional(),
    specialty: z.string().min(1).max(100).optional(),
  })
  .strict();

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const availableSlotResponseSchema = z.object({
  id: z.number(),
  doctorId: z.number(),
  doctorName: z.string(),
  specialty: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
});

export const availabilityResponseSchema = z.array(availableSlotResponseSchema);
```

- [ ] **Step 4: Implement `src/modules/availability/availability.service.ts`**

```ts
import type { SlotRepository, AvailableSlotView } from '../slots/slot.repository';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';
import type { AvailabilityQuery } from './availability.schemas';

function buildCacheKey(query: AvailabilityQuery): string {
  return `${query.date}|${query.doctorId ?? ''}|${query.specialty ?? ''}`;
}

export function createAvailabilityService(repository: SlotRepository, cache: AvailabilityCache) {
  return {
    getAvailability(query: AvailabilityQuery): AvailableSlotView[] {
      const cacheKey = buildCacheKey(query);
      const cached = cache.get(cacheKey);
      if (cached) {
        return cached;
      }

      const slots = repository.findAvailable(query);
      cache.set(cacheKey, slots);
      return slots;
    },
  };
}

export type AvailabilityService = ReturnType<typeof createAvailabilityService>;
```

- [ ] **Step 5: Implement `src/modules/availability/availability.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AvailabilityService } from './availability.service';
import type { AvailabilityQuery } from './availability.schemas';

export function createAvailabilityController(service: AvailabilityService) {
  return {
    async list(request: FastifyRequest<{ Querystring: AvailabilityQuery }>, reply: FastifyReply) {
      const slots = service.getAvailability(request.query);
      return reply.status(200).send(slots);
    },
  };
}
```

- [ ] **Step 6: Implement `src/modules/availability/availability.routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createSlotRepository } from '../slots/slot.repository';
import { createAvailabilityService } from './availability.service';
import { createAvailabilityController } from './availability.controller';
import { availabilityQuerySchema, availabilityResponseSchema } from './availability.schemas';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';

export function registerAvailabilityRoutes(
  app: FastifyInstance,
  db: Database.Database,
  cache: AvailabilityCache,
): void {
  const repository = createSlotRepository(db);
  const service = createAvailabilityService(repository, cache);
  const controller = createAvailabilityController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/availability',
    {
      schema: {
        querystring: availabilityQuerySchema,
        response: { 200: availabilityResponseSchema },
      },
    },
    controller.list,
  );
}
```

- [ ] **Step 7: Rewire the cache ownership in `src/server.ts`**

Replace:

```ts
  const availabilityCache = createAvailabilityCache(deps.env.availabilityCacheTtlSeconds);
  void availabilityCache;

  registerPatientRoutes(app, deps.db);
  registerDoctorRoutes(app, deps.db);
```

with:

```ts
  const availabilityCache = createAvailabilityCache(deps.env.availabilityCacheTtlSeconds);

  registerPatientRoutes(app, deps.db);
  registerDoctorRoutes(app, deps.db);
  registerAvailabilityRoutes(app, deps.db, availabilityCache);
```

Add the import:

```ts
import { registerAvailabilityRoutes } from './modules/availability/availability.routes';
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run test/availability.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 9: Commit**

```bash
git add src/modules/availability src/server.ts test/availability.test.ts
git commit -m "feat: add cached availability endpoint"
```

---

### Task 13: Appointments module — creation

**Files:**
- Create: `src/modules/appointments/appointment.repository.ts`, `appointment.service.ts`, `appointment.controller.ts`, `appointment.routes.ts`, `appointment.schemas.ts`
- Modify: `src/server.ts`
- Test: `test/appointments-create.test.ts`

**Interfaces:**
- Consumes: `createSlotRepository` (Task 11), `createPatientRepository` (Task 9), `AvailabilityCache` (Task 7), `PatientNotFoundError`/`SlotNotFoundError`/`SlotAlreadyBookedError`/`AppointmentNotFoundError` (Task 5).
- Produces: `export interface AppointmentRow { id: number; patient_id: number; slot_id: number; status: 'active' | 'cancelled'; created_at: string; cancelled_at: string | null }`, `createAppointmentService(deps): AppointmentService` with `createAppointment(params): AppointmentRow`, `getAppointment(id): AppointmentRow`, `cancelAppointment(id): AppointmentRow` (the last one implemented in Task 14), `registerAppointmentRoutes(app, db, cache): void`.

- [ ] **Step 1: Write the failing test**

Create `test/appointments-create.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('POST /appointments', () => {
  it('books an available slot', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      patientId: seed.patientIds[0],
      slotId: seed.slotIds[0],
      status: 'active',
    });
    await app.close();
  });

  it('returns 409 when the slot is already booked', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[1] },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it('returns 404 when the slot does not exist', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: 999_999 },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 404 when the patient does not exist', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: 999_999, slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 400 for a non-numeric patientId', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: 'not-a-number', slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('invalidates the availability cache for the booked date', async () => {
    const { app, seed, env } = buildTestApp();

    const before = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(before.json()).toHaveLength(1);

    await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });

    const after = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(after.json()).toHaveLength(0);

    await app.close();
  });
});

describe('GET /appointments/:id', () => {
  it('returns 404 for a non-existent appointment', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/appointments/999999',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/appointments-create.test.ts`
Expected: FAIL — routes do not exist yet.

- [ ] **Step 3: Implement `src/modules/appointments/appointment.schemas.ts`**

```ts
import { z } from 'zod';

export const createAppointmentBodySchema = z
  .object({
    patientId: z.coerce.number().int().positive(),
    slotId: z.coerce.number().int().positive(),
  })
  .strict();

export type CreateAppointmentBody = z.infer<typeof createAppointmentBodySchema>;

export const appointmentIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export type AppointmentIdParams = z.infer<typeof appointmentIdParamsSchema>;

export const appointmentResponseSchema = z.object({
  id: z.number(),
  patientId: z.number(),
  slotId: z.number(),
  status: z.enum(['active', 'cancelled']),
  createdAt: z.string(),
  cancelledAt: z.string().nullable(),
});
```

- [ ] **Step 4: Implement `src/modules/appointments/appointment.repository.ts`**

```ts
import type Database from 'better-sqlite3';

export interface AppointmentRow {
  id: number;
  patient_id: number;
  slot_id: number;
  status: 'active' | 'cancelled';
  created_at: string;
  cancelled_at: string | null;
}

export function createAppointmentRepository(db: Database.Database) {
  const insertStmt = db.prepare('INSERT INTO appointments (patient_id, slot_id, status) VALUES (?, ?, ?)');
  const findByIdStmt = db.prepare(
    'SELECT id, patient_id, slot_id, status, created_at, cancelled_at FROM appointments WHERE id = ?',
  );
  const cancelStmt = db.prepare(
    "UPDATE appointments SET status = 'cancelled', cancelled_at = datetime('now') WHERE id = ?",
  );

  return {
    create(patientId: number, slotId: number): AppointmentRow {
      const result = insertStmt.run(patientId, slotId, 'active');
      return findByIdStmt.get(result.lastInsertRowid) as AppointmentRow;
    },
    findById(id: number): AppointmentRow | undefined {
      return findByIdStmt.get(id) as AppointmentRow | undefined;
    },
    cancel(id: number): void {
      cancelStmt.run(id);
    },
  };
}

export type AppointmentRepository = ReturnType<typeof createAppointmentRepository>;
```

- [ ] **Step 5: Implement `src/modules/appointments/appointment.service.ts`**

```ts
import type Database from 'better-sqlite3';
import type { AppointmentRepository, AppointmentRow } from './appointment.repository';
import type { SlotRepository } from '../slots/slot.repository';
import type { PatientRepository } from '../patients/patient.repository';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';
import {
  PatientNotFoundError,
  SlotNotFoundError,
  SlotAlreadyBookedError,
  AppointmentNotFoundError,
  AppointmentAlreadyCancelledError,
} from '../../shared/errors';

export interface CreateAppointmentParams {
  patientId: number;
  slotId: number;
}

export interface AppointmentDependencies {
  db: Database.Database;
  appointmentRepository: AppointmentRepository;
  slotRepository: SlotRepository;
  patientRepository: PatientRepository;
  availabilityCache: AvailabilityCache;
}

export function createAppointmentService(deps: AppointmentDependencies) {
  // better-sqlite3 transactions run synchronously, so no other request can
  // interleave between the availability check and the write below.
  const createTransaction = deps.db.transaction((params: CreateAppointmentParams): AppointmentRow => {
    const patient = deps.patientRepository.findById(params.patientId);
    if (!patient) {
      throw new PatientNotFoundError(String(params.patientId));
    }

    const slot = deps.slotRepository.findById(params.slotId);
    if (!slot) {
      throw new SlotNotFoundError(String(params.slotId));
    }

    if (slot.status !== 'available') {
      throw new SlotAlreadyBookedError(String(params.slotId));
    }

    deps.slotRepository.markStatus(params.slotId, 'booked');
    return deps.appointmentRepository.create(params.patientId, params.slotId);
  });

  const cancelTransaction = deps.db.transaction((appointmentId: number): AppointmentRow => {
    const appointment = deps.appointmentRepository.findById(appointmentId);
    if (!appointment) {
      throw new AppointmentNotFoundError(String(appointmentId));
    }

    if (appointment.status === 'cancelled') {
      throw new AppointmentAlreadyCancelledError(String(appointmentId));
    }

    deps.appointmentRepository.cancel(appointmentId);
    deps.slotRepository.markStatus(appointment.slot_id, 'available');

    return deps.appointmentRepository.findById(appointmentId) as AppointmentRow;
  });

  return {
    createAppointment(params: CreateAppointmentParams): AppointmentRow {
      const appointment = createTransaction(params);
      const slot = deps.slotRepository.findById(appointment.slot_id);
      if (slot) {
        deps.availabilityCache.invalidateDate(slot.date);
      }
      return appointment;
    },
    getAppointment(id: number): AppointmentRow {
      const appointment = deps.appointmentRepository.findById(id);
      if (!appointment) {
        throw new AppointmentNotFoundError(String(id));
      }
      return appointment;
    },
    cancelAppointment(id: number): AppointmentRow {
      const appointment = cancelTransaction(id);
      const slot = deps.slotRepository.findById(appointment.slot_id);
      if (slot) {
        deps.availabilityCache.invalidateDate(slot.date);
      }
      return appointment;
    },
  };
}

export type AppointmentService = ReturnType<typeof createAppointmentService>;
```

- [ ] **Step 6: Implement `src/modules/appointments/appointment.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AppointmentService } from './appointment.service';
import type { AppointmentRow } from './appointment.repository';
import type { CreateAppointmentBody, AppointmentIdParams } from './appointment.schemas';

function toAppointmentDto(row: AppointmentRow) {
  return {
    id: row.id,
    patientId: row.patient_id,
    slotId: row.slot_id,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export function createAppointmentController(service: AppointmentService) {
  return {
    async create(request: FastifyRequest<{ Body: CreateAppointmentBody }>, reply: FastifyReply) {
      const appointment = service.createAppointment(request.body);
      return reply.status(201).send(toAppointmentDto(appointment));
    },
    async getById(request: FastifyRequest<{ Params: AppointmentIdParams }>, reply: FastifyReply) {
      const appointment = service.getAppointment(request.params.id);
      return reply.status(200).send(toAppointmentDto(appointment));
    },
    async cancel(request: FastifyRequest<{ Params: AppointmentIdParams }>, reply: FastifyReply) {
      const appointment = service.cancelAppointment(request.params.id);
      return reply.status(200).send(toAppointmentDto(appointment));
    },
  };
}
```

- [ ] **Step 7: Implement `src/modules/appointments/appointment.routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createAppointmentRepository } from './appointment.repository';
import { createSlotRepository } from '../slots/slot.repository';
import { createPatientRepository } from '../patients/patient.repository';
import { createAppointmentService } from './appointment.service';
import { createAppointmentController } from './appointment.controller';
import {
  createAppointmentBodySchema,
  appointmentResponseSchema,
  appointmentIdParamsSchema,
} from './appointment.schemas';
import type { AvailabilityCache } from '../../shared/cache/availability-cache';

export function registerAppointmentRoutes(
  app: FastifyInstance,
  db: Database.Database,
  availabilityCache: AvailabilityCache,
): void {
  const service = createAppointmentService({
    db,
    appointmentRepository: createAppointmentRepository(db),
    slotRepository: createSlotRepository(db),
    patientRepository: createPatientRepository(db),
    availabilityCache,
  });
  const controller = createAppointmentController(service);
  const typedApp = app.withTypeProvider<ZodTypeProvider>();

  typedApp.post(
    '/appointments',
    { schema: { body: createAppointmentBodySchema, response: { 201: appointmentResponseSchema } } },
    controller.create,
  );

  typedApp.get(
    '/appointments/:id',
    { schema: { params: appointmentIdParamsSchema, response: { 200: appointmentResponseSchema } } },
    controller.getById,
  );

  typedApp.post(
    '/appointments/:id/cancel',
    { schema: { params: appointmentIdParamsSchema, response: { 200: appointmentResponseSchema } } },
    controller.cancel,
  );
}
```

- [ ] **Step 8: Wire into `src/server.ts`**

Add the import:

```ts
import { registerAppointmentRoutes } from './modules/appointments/appointment.routes';
```

Add after `registerAvailabilityRoutes(app, deps.db, availabilityCache);`:

```ts
  registerAppointmentRoutes(app, deps.db, availabilityCache);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run test/appointments-create.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 10: Commit**

```bash
git add src/modules/appointments src/server.ts test/appointments-create.test.ts
git commit -m "feat: add appointment creation and lookup endpoints"
```

---

### Task 14: Appointments module — cancellation

**Files:**
- Test: `test/appointments-cancel.test.ts`

**Interfaces:**
- Consumes: `cancelAppointment` from Task 13's `appointment.service.ts` (already implemented), route `POST /appointments/:id/cancel` (already wired in Task 13).
- Produces: nothing new — this task only adds test coverage for behavior already implemented, plus verifies cache invalidation end-to-end.

- [ ] **Step 1: Write the failing test**

Create `test/appointments-cancel.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('POST /appointments/:id/cancel', () => {
  it('cancels an active appointment and frees its slot', async () => {
    const { app, seed, env } = buildTestApp();

    const bookResponse = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });
    const appointmentId = (bookResponse.json() as { id: number }).id;

    const beforeCancel = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(beforeCancel.json()).toHaveLength(0);

    const cancelResponse = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: authHeaders(env),
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json()).toMatchObject({ status: 'cancelled' });

    const afterCancel = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(afterCancel.json()).toHaveLength(1);

    await app.close();
  });

  it('returns 404 for a non-existent appointment', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments/999999/cancel',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('returns 409 when cancelling an already-cancelled appointment', async () => {
    const { app, seed, env } = buildTestApp();

    const bookResponse = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
    });
    const appointmentId = (bookResponse.json() as { id: number }).id;

    await app.inject({ method: 'POST', url: `/appointments/${appointmentId}/cancel`, headers: authHeaders(env) });
    const secondCancel = await app.inject({
      method: 'POST',
      url: `/appointments/${appointmentId}/cancel`,
      headers: authHeaders(env),
    });

    expect(secondCancel.statusCode).toBe(409);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run test/appointments-cancel.test.ts`
Expected: PASS (3 tests) — the implementation already exists from Task 13; this step only adds coverage. If any test fails, fix `appointment.service.ts` from Task 13 to match this behavior before proceeding.

- [ ] **Step 3: Commit**

```bash
git add test/appointments-cancel.test.ts
git commit -m "test: cover appointment cancellation and cache invalidation"
```

---

### Task 15: Booking concurrency test

**Files:**
- Test: `test/appointments-concurrency.test.ts`

**Interfaces:**
- Consumes: `POST /appointments` from Task 13. No new production code — this task proves the transactional guarantee already built.

- [ ] **Step 1: Write the test**

Create `test/appointments-concurrency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('concurrent booking of the same slot', () => {
  it('only lets one of two simultaneous requests succeed', async () => {
    const { app, seed, env } = buildTestApp();

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: authHeaders(env),
        payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0] },
      }),
      app.inject({
        method: 'POST',
        url: '/appointments',
        headers: authHeaders(env),
        payload: { patientId: seed.patientIds[1], slotId: seed.slotIds[0] },
      }),
    ]);

    const statusCodes = [first.statusCode, second.statusCode].sort();
    expect(statusCodes).toEqual([201, 409]);

    const availabilityResponse = await app.inject({
      method: 'GET',
      url: '/availability?date=2026-09-20',
      headers: authHeaders(env),
    });
    expect(availabilityResponse.json()).toEqual([]);

    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run test/appointments-concurrency.test.ts`
Expected: PASS (1 test). This is guaranteed by `db.transaction()` in `appointment.service.ts` (Task 13) being synchronous, which serializes the check-then-write even though both `app.inject()` calls are issued together.

- [ ] **Step 3: Commit**

```bash
git add test/appointments-concurrency.test.ts
git commit -m "test: verify only one concurrent booking wins the same slot"
```

---

### Task 16: Payments module

**Files:**
- Create: `src/modules/payments/payment.repository.ts`, `payment.service.ts`, `payment.controller.ts`, `payment.routes.ts`, `payment.schemas.ts`
- Modify: `src/server.ts`
- Test: `test/payments.test.ts`

**Interfaces:**
- Consumes: `PaymentConfigNotFoundError` (Task 5).
- Produces: `export interface PaymentConfig { id: number; consultationType: string; price: number; paymentMethods: string[] }`, `createPaymentService(repository)` with `listPayments(consultationType?: string): PaymentConfig[]`, `registerPaymentRoutes(app, db): void`.

- [ ] **Step 1: Write the failing test**

Create `test/payments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('GET /payments', () => {
  it('lists all payment configs when no filter is given', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/payments', headers: authHeaders(env) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveLength(2);
    await app.close();
  });

  it('filters by consultationType', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/payments?consultationType=consultation',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: 1, consultationType: 'consultation', price: 250, paymentMethods: ['pix', 'credit_card', 'boleto'] },
    ]);
    await app.close();
  });

  it('returns 404 for an unknown consultationType', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/payments?consultationType=unknown',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/payments.test.ts`
Expected: FAIL — route does not exist yet.

- [ ] **Step 3: Implement `src/modules/payments/payment.repository.ts`**

```ts
import type Database from 'better-sqlite3';

export interface PaymentConfigRow {
  id: number;
  consultation_type: string;
  price: number;
  payment_methods: string;
}

export function createPaymentRepository(db: Database.Database) {
  const findAllStmt = db.prepare('SELECT id, consultation_type, price, payment_methods FROM payment_configs');
  const findByTypeStmt = db.prepare(
    'SELECT id, consultation_type, price, payment_methods FROM payment_configs WHERE consultation_type = ?',
  );

  return {
    findAll(): PaymentConfigRow[] {
      return findAllStmt.all() as PaymentConfigRow[];
    },
    findByType(type: string): PaymentConfigRow | undefined {
      return findByTypeStmt.get(type) as PaymentConfigRow | undefined;
    },
  };
}

export type PaymentRepository = ReturnType<typeof createPaymentRepository>;
```

- [ ] **Step 4: Implement `src/modules/payments/payment.service.ts`**

```ts
import type { PaymentRepository, PaymentConfigRow } from './payment.repository';
import { PaymentConfigNotFoundError } from '../../shared/errors';

export interface PaymentConfig {
  id: number;
  consultationType: string;
  price: number;
  paymentMethods: string[];
}

function toPaymentConfig(row: PaymentConfigRow): PaymentConfig {
  return {
    id: row.id,
    consultationType: row.consultation_type,
    price: row.price,
    paymentMethods: JSON.parse(row.payment_methods) as string[],
  };
}

export function createPaymentService(repository: PaymentRepository) {
  return {
    listPayments(consultationType?: string): PaymentConfig[] {
      if (consultationType) {
        const row = repository.findByType(consultationType);
        if (!row) {
          throw new PaymentConfigNotFoundError(consultationType);
        }
        return [toPaymentConfig(row)];
      }
      return repository.findAll().map(toPaymentConfig);
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
```

- [ ] **Step 5: Implement `src/modules/payments/payment.schemas.ts`**

```ts
import { z } from 'zod';

export const listPaymentsQuerySchema = z
  .object({
    consultationType: z.string().min(1).max(100).optional(),
  })
  .strict();

export type ListPaymentsQuery = z.infer<typeof listPaymentsQuerySchema>;

export const paymentConfigResponseSchema = z.object({
  id: z.number(),
  consultationType: z.string(),
  price: z.number(),
  paymentMethods: z.array(z.string()),
});

export const listPaymentsResponseSchema = z.array(paymentConfigResponseSchema);
```

- [ ] **Step 6: Implement `src/modules/payments/payment.controller.ts`**

```ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { PaymentService } from './payment.service';
import type { ListPaymentsQuery } from './payment.schemas';

export function createPaymentController(service: PaymentService) {
  return {
    async list(request: FastifyRequest<{ Querystring: ListPaymentsQuery }>, reply: FastifyReply) {
      const payments = service.listPayments(request.query.consultationType);
      return reply.status(200).send(payments);
    },
  };
}
```

- [ ] **Step 7: Implement `src/modules/payments/payment.routes.ts`**

```ts
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type Database from 'better-sqlite3';
import { createPaymentRepository } from './payment.repository';
import { createPaymentService } from './payment.service';
import { createPaymentController } from './payment.controller';
import { listPaymentsQuerySchema, listPaymentsResponseSchema } from './payment.schemas';

export function registerPaymentRoutes(app: FastifyInstance, db: Database.Database): void {
  const repository = createPaymentRepository(db);
  const service = createPaymentService(repository);
  const controller = createPaymentController(service);

  app.withTypeProvider<ZodTypeProvider>().get(
    '/payments',
    { schema: { querystring: listPaymentsQuerySchema, response: { 200: listPaymentsResponseSchema } } },
    controller.list,
  );
}
```

- [ ] **Step 8: Wire into `src/server.ts`**

Add the import:

```ts
import { registerPaymentRoutes } from './modules/payments/payment.routes';
```

Add after `registerAppointmentRoutes(app, deps.db, availabilityCache);`:

```ts
  registerPaymentRoutes(app, deps.db);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npx vitest run test/payments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add src/modules/payments src/server.ts test/payments.test.ts
git commit -m "feat: add payment configuration endpoint"
```

---

### Task 17: Cross-cutting security and edge-case tests

**Files:**
- Test: `test/security-edge-cases.test.ts`

**Interfaces:**
- Consumes: every route registered in Tasks 9-16, plus `buildTestApp` with `envOverrides` (Task 8) for the rate-limit scenario.

- [ ] **Step 1: Write the test**

Create `test/security-edge-cases.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp, authHeaders } from './helpers/build-test-app';

describe('security and edge cases', () => {
  it('rejects an oversized name-like field via strict schema (extra field)', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: seed.patientIds[0], slotId: seed.slotIds[0], notes: 'x'.repeat(10_000) },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a wrong-typed field', async () => {
    const { app, seed, env } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/appointments',
      headers: authHeaders(env),
      payload: { patientId: { $ne: null }, slotId: seed.slotIds[0] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('treats a SQL-injection-shaped email as a literal value and returns 404, not a server error', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: `/patients/lookup?email=${encodeURIComponent("a' OR '1'='1@example.com")}`,
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('rejects an overly long phone value', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: `/patients/lookup?phone=${'1'.repeat(50)}`,
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('enforces the rate limit once the configured maximum is exceeded', async () => {
    const { app, env } = buildTestApp({ rateLimitMax: 2, rateLimitTimeWindowMs: 60_000 });

    await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });
    await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });
    const third = await app.inject({ method: 'GET', url: '/doctors', headers: authHeaders(env) });

    expect(third.statusCode).toBe(429);
    await app.close();
  });

  it('never leaks internal error details to the client', async () => {
    const { app, env } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/appointments/not-a-number',
      headers: authHeaders(env),
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.stringify(response.json())).not.toMatch(/at .*\.ts:\d+/);
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails or passes**

Run: `npx vitest run test/security-edge-cases.test.ts`
Expected: most assertions should already PASS given Tasks 5-16; if any fails (for example the rate-limit test, depending on `@fastify/rate-limit` version defaults), adjust `src/server.ts`'s rate-limit registration or the relevant schema until all 6 tests pass. Do not weaken a schema or the error handler just to make a test green — fix the assertion only if it was wrong about the intended behavior from the spec.

- [ ] **Step 3: Commit**

```bash
git add test/security-edge-cases.test.ts
git commit -m "test: add cross-cutting security and edge-case coverage"
```

---

### Task 18: Swagger documentation smoke test

**Files:**
- Test: `test/swagger.test.ts`

**Interfaces:**
- Consumes: swagger registration from Task 8's `server.ts`.

- [ ] **Step 1: Write the test**

Create `test/swagger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp } from './helpers/build-test-app';

describe('swagger documentation', () => {
  it('exposes an OpenAPI document listing the known paths', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const document = response.json() as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        '/patients/lookup',
        '/doctors',
        '/availability',
        '/appointments',
        '/appointments/:id/cancel',
        '/payments',
      ]),
    );
    await app.close();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run test/swagger.test.ts`
Expected: PASS (1 test). If the JSON document route differs (some `@fastify/swagger-ui` versions expose it at `/docs/json` vs `/documentation/json`), check the installed version's docs and adjust the URL in this test and, if needed, the `routePrefix` option in `src/server.ts` from Task 8 — keep them consistent.

- [ ] **Step 3: Commit**

```bash
git add test/swagger.test.ts
git commit -m "test: verify swagger document lists all registered routes"
```

---

### Task 19: Postman collection

**Files:**
- Create: `postman/essentia-api.postman_collection.json`

- [ ] **Step 1: Create the collection**

Create `postman/essentia-api.postman_collection.json`:

```json
{
  "info": {
    "name": "Essentia Medical API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:3000" },
    { "key": "apiKey", "value": "replace-with-your-api-key" },
    { "key": "patientId", "value": "1" },
    { "key": "doctorId", "value": "1" },
    { "key": "slotId", "value": "1" },
    { "key": "appointmentId", "value": "1" }
  ],
  "item": [
    {
      "name": "Lookup patient by email",
      "request": {
        "method": "GET",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }],
        "url": { "raw": "{{baseUrl}}/patients/lookup?email=ana.souza@example.com", "host": ["{{baseUrl}}"], "path": ["patients", "lookup"], "query": [{ "key": "email", "value": "ana.souza@example.com" }] }
      },
      "event": [
        {
          "listen": "test",
          "script": { "exec": ["pm.test('status is 200', () => pm.response.to.have.status(200));", "pm.test('has id', () => pm.expect(pm.response.json()).to.have.property('id'));"] }
        }
      ]
    },
    {
      "name": "List doctors",
      "request": {
        "method": "GET",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }],
        "url": { "raw": "{{baseUrl}}/doctors", "host": ["{{baseUrl}}"], "path": ["doctors"] }
      },
      "event": [
        { "listen": "test", "script": { "exec": ["pm.test('status is 200', () => pm.response.to.have.status(200));"] } }
      ]
    },
    {
      "name": "Get availability",
      "request": {
        "method": "GET",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }],
        "url": { "raw": "{{baseUrl}}/availability?date=2026-09-20", "host": ["{{baseUrl}}"], "path": ["availability"], "query": [{ "key": "date", "value": "2026-09-20" }] }
      },
      "event": [
        { "listen": "test", "script": { "exec": ["pm.test('status is 200', () => pm.response.to.have.status(200));"] } }
      ]
    },
    {
      "name": "Create appointment",
      "request": {
        "method": "POST",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }, { "key": "Content-Type", "value": "application/json" }],
        "body": { "mode": "raw", "raw": "{\n  \"patientId\": {{patientId}},\n  \"slotId\": {{slotId}}\n}" },
        "url": { "raw": "{{baseUrl}}/appointments", "host": ["{{baseUrl}}"], "path": ["appointments"] }
      },
      "event": [
        {
          "listen": "test",
          "script": {
            "exec": [
              "pm.test('status is 201', () => pm.response.to.have.status(201));",
              "const body = pm.response.json();",
              "pm.collectionVariables.set('appointmentId', body.id);"
            ]
          }
        }
      ]
    },
    {
      "name": "Get appointment",
      "request": {
        "method": "GET",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }],
        "url": { "raw": "{{baseUrl}}/appointments/{{appointmentId}}", "host": ["{{baseUrl}}"], "path": ["appointments", "{{appointmentId}}"] }
      },
      "event": [
        { "listen": "test", "script": { "exec": ["pm.test('status is 200', () => pm.response.to.have.status(200));"] } }
      ]
    },
    {
      "name": "Cancel appointment",
      "request": {
        "method": "POST",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }],
        "url": { "raw": "{{baseUrl}}/appointments/{{appointmentId}}/cancel", "host": ["{{baseUrl}}"], "path": ["appointments", "{{appointmentId}}", "cancel"] }
      },
      "event": [
        {
          "listen": "test",
          "script": { "exec": ["pm.test('status is 200', () => pm.response.to.have.status(200));", "pm.test('status is cancelled', () => pm.expect(pm.response.json().status).to.eql('cancelled'));"] }
        }
      ]
    },
    {
      "name": "List payments",
      "request": {
        "method": "GET",
        "header": [{ "key": "x-api-key", "value": "{{apiKey}}" }],
        "url": { "raw": "{{baseUrl}}/payments", "host": ["{{baseUrl}}"], "path": ["payments"] }
      },
      "event": [
        { "listen": "test", "script": { "exec": ["pm.test('status is 200', () => pm.response.to.have.status(200));"] } }
      ]
    }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add postman/essentia-api.postman_collection.json
git commit -m "docs: add Postman collection for the API"
```

---

### Task 20: Dockerfile and docker-compose (API service only)

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.env.example`

- [ ] **Step 1: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Create `docker-compose.yml`**

```yaml
services:
  api:
    build: .
    ports:
      - '3000:3000'
    env_file:
      - .env
    volumes:
      - api-data:/app/data
    healthcheck:
      test: ['CMD', 'wget', '--spider', '-q', 'http://localhost:3000/health']
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  api-data:
```

- [ ] **Step 3: Create `.env.example`**

```
PORT=3000
DATABASE_PATH=./data/dev.db
API_KEY=replace-with-a-long-random-string
AVAILABILITY_CACHE_TTL_SECONDS=30
RATE_LIMIT_MAX=100
RATE_LIMIT_TIME_WINDOW_MS=60000
```

- [ ] **Step 4: Verify locally**

Run:

```bash
cp .env.example .env
# edit .env and set a real API_KEY (16+ characters)
docker compose build
docker compose up -d
curl http://localhost:3000/health
docker compose run --rm api npm run seed
curl -H "x-api-key: <the API_KEY you set>" http://localhost:3000/doctors
docker compose down
```

Expected: `/health` returns `{"status":"ok"}`, seed completes, `/doctors` returns the two seeded doctors.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docker-compose.yml .env.example
git commit -m "chore: add Dockerfile and docker-compose for the API service"
```

---

### Task 21: README (API section)

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Essentia Technologies — Atendimento Médico Automatizado

Case técnico de automação com IA e N8N. Este README cobre a API REST; a
orquestração N8N, integrações (Gmail, STT/TTS) e o restante dos entregáveis
são adicionados em um plano seguinte.

## Arquitetura

Veja `docs/superpowers/specs/2026-09-16-atendimento-medico-essentia-design.md`
para o design completo. Resumo: API TypeScript + Fastify + Zod + SQLite
(camadas rota → controller → service → repository), N8N como orquestrador de
IA consumindo esta API via HTTP com header `x-api-key`.

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose (opcional, para rodar containerizado)

## Configuração

1. Copie `.env.example` para `.env`.
2. Defina um `API_KEY` com pelo menos 16 caracteres.

## Rodando localmente

```bash
npm install
npm run seed   # cria e popula ./data/dev.db
npm run dev    # sobe a API em http://localhost:3000
```

## Rodando via Docker Compose

```bash
docker compose build
docker compose up -d
docker compose run --rm api npm run seed
```

A API expõe `/health` (sem autenticação) e a documentação Swagger em
`/docs`. Todas as demais rotas exigem o header `x-api-key`.

## Testes

```bash
npm test
```

Os testes usam um banco SQLite em memória, isolado por teste, e não tocam
`./data/dev.db`.

## Lint e formatação

```bash
npm run lint
npm run format
```

O hook de pre-commit (Husky + lint-staged) bloqueia o commit se o lint, a
formatação ou os testes falharem.

## Coleção Postman

Importe `postman/essentia-api.postman_collection.json` no Postman, ajuste a
variável `apiKey` para o valor configurado no seu `.env`, e execute as
requisições na ordem em que aparecem na coleção.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/patients/lookup?email=` ou `?phone=` | Identifica um paciente |
| GET | `/doctors` | Lista médicos |
| GET | `/availability?date=&specialty=&doctorId=` | Lista horários disponíveis |
| POST | `/appointments` | Cria um agendamento |
| GET | `/appointments/:id` | Consulta um agendamento |
| POST | `/appointments/:id/cancel` | Cancela um agendamento |
| GET | `/payments?consultationType=` | Consulta valores e formas de pagamento |

## Limitações conhecidas

Ver seção "Limitações assumidas" no spec de design.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README covering the API subsystem"
```

---

### Task 22: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full quality gate**

Run: `npm run lint && npm run format && npm test`
Expected: lint passes with no errors, formatting is clean, all test files pass (should be around 50+ tests across Tasks 2-18).

- [ ] **Step 2: Run the build**

Run: `npm run build`
Expected: compiles without TypeScript errors into `dist/`.

- [ ] **Step 3: Confirm the pre-commit hook actually blocks bad commits**

Temporarily introduce a lint error (e.g. an unused variable) in any `src/` file, stage it, and attempt to commit:

```bash
git commit -m "test: verify hook blocks bad commit"
```

Expected: the commit is rejected by the pre-commit hook. Then revert the temporary change:

```bash
git checkout -- <the file you changed>
```

- [ ] **Step 4: Final commit confirming the API subsystem is complete**

```bash
git add -A
git commit -m "chore: complete API subsystem for the medical appointment case" --allow-empty
```
