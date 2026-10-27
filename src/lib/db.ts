import { Capacitor } from "@capacitor/core";
import type { Database as SqlJsDatabase } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm-browser.wasm" with { type: "file" };

// Worlds, notes and categories live in a SQLite database on the device; Supabase is only used to log in.
// Each platform opens it its own way:
// - Android/iOS: a native SQLite file through @capacitor-community/sqlite.
// - Electron: a file in the app's user data folder, opened with node:sqlite by preload.cjs.
// - Browser (bun dev): sql.js in memory, saved to IndexedDB after every write.

export type SqlValue = string | number | null;
export type Statement = { sql: string; params?: SqlValue[] };
type Row = Record<string, unknown>;

type Driver = {
  exec(sql: string): Promise<void>;
  all(sql: string, params: SqlValue[]): Promise<Row[]>;
  // Runs every statement in one transaction.
  batch(statements: Statement[]): Promise<void>;
};

// Exposed by preload.cjs in the Electron app.
type ElectronLocalDb = {
  exec(sql: string): void;
  all(sql: string, params: SqlValue[]): Row[];
  batch(statements: Statement[]): void;
};

const DB_NAME = "archivist";

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS worlds (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    accent_color TEXT,
    icon TEXT,
    -- Words to write per day in this volume; null when no goal is set.
    daily_goal INTEGER,
    -- The model the volume was created from (livro, mundo, academico, rpg, branco; see volumeKinds.ts), and the
    -- features it has switched on, as a JSON array (see features.ts). Both null for volumes made before them.
    kind TEXT,
    features TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS worlds_user_idx ON worlds (user_id, created_at);

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS categories_world_name_idx ON categories (world_id, lower(trim(name)));

  -- Folders within a volume, separate from categories; parent_id nests one inside another (null at the top).
  -- position orders a subgroup among everything in its parent, notes included (see order.ts).
  -- collapsed is how the listing last showed it. The app deletes one by first moving its contents up a level
  -- (deleteSubgroup), so the cascade only applies when a whole volume goes; setting children's parent_id to null
  -- instead could clash with the unique sibling names partway through.
  CREATE TABLE IF NOT EXISTS subgroups (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES subgroups (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position REAL NOT NULL DEFAULT 0,
    collapsed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  -- Names were unique per volume before nesting; now they only need to be unique among siblings (see INDEXES).
  DROP INDEX IF EXISTS subgroups_world_name_idx;

  CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    world_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    category_id TEXT REFERENCES categories (id) ON DELETE SET NULL,
    subgroup_id TEXT REFERENCES subgroups (id) ON DELETE SET NULL,
    position REAL NOT NULL DEFAULT 0,
    -- ideia, rascunho, revisao or final (see writing.ts); null when not tracked.
    status TEXT,
    -- A line or two about the note, shown on its corkboard card.
    synopsis TEXT NOT NULL DEFAULT '',
    -- Custom fields, a JSON array of { key, value } (see NoteFields.tsx).
    fields TEXT NOT NULL DEFAULT '[]',
    -- When it happens, in the volume's own terms ("Ano 312, inverno"), for the timeline.
    timeline TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS notes_world_idx ON notes (world_id, updated_at);

  -- Saved versions of a note, to compare with or go back to.
  CREATE TABLE IF NOT EXISTS note_snapshots (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS note_snapshots_note_idx ON note_snapshots (note_id, created_at);

  -- Net words written in a volume per local day ("2026-10-27"), for the daily goal and streak.
  CREATE TABLE IF NOT EXISTS writing_days (
    world_id TEXT NOT NULL REFERENCES worlds (id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    words INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (world_id, day)
  );

  -- Users whose worlds were already copied over from Supabase (see supabaseImport.ts).
  CREATE TABLE IF NOT EXISTS supabase_imports (
    user_id INTEGER PRIMARY KEY,
    imported_at TEXT NOT NULL
  );
`;

// Milliseconds since 1970 for a stored ISO timestamp, in SQL.
const EPOCH_MS = "(julianday(created_at) - 2440587.5) * 86400000";

// Columns added after their table was first released. CREATE TABLE IF NOT EXISTS leaves existing tables alone,
// so databases created before then get them here, and `fill` sets them on the rows already there.
const ADDED_COLUMNS: { table: string; column: string; definition: string; fill?: string }[] = [
  { table: "notes", column: "subgroup_id", definition: "TEXT REFERENCES subgroups (id) ON DELETE SET NULL" },
  { table: "subgroups", column: "parent_id", definition: "TEXT REFERENCES subgroups (id) ON DELETE CASCADE" },
  // Existing items keep the order they were shown in: subgroups first, then notes, each by creation.
  {
    table: "subgroups",
    column: "position",
    definition: "REAL NOT NULL DEFAULT 0",
    fill: `UPDATE subgroups SET position = ${EPOCH_MS} - 1e13`,
  },
  { table: "notes", column: "position", definition: "REAL NOT NULL DEFAULT 0", fill: `UPDATE notes SET position = ${EPOCH_MS}` },
  { table: "notes", column: "status", definition: "TEXT" },
  { table: "notes", column: "synopsis", definition: "TEXT NOT NULL DEFAULT ''" },
  { table: "worlds", column: "daily_goal", definition: "INTEGER" },
  { table: "worlds", column: "kind", definition: "TEXT" },
  { table: "worlds", column: "features", definition: "TEXT" },
  { table: "notes", column: "fields", definition: "TEXT NOT NULL DEFAULT '[]'" },
  { table: "notes", column: "timeline", definition: "TEXT NOT NULL DEFAULT ''" },
];

// Indexes on added columns, created once the columns exist.
const INDEXES = `
  CREATE UNIQUE INDEX IF NOT EXISTS subgroups_sibling_name_idx
    ON subgroups (world_id, coalesce(parent_id, ''), lower(trim(name)));
`;

async function addMissingColumns(driver: Driver) {
  for (const { table, column, definition, fill } of ADDED_COLUMNS) {
    const columns = await driver.all(`PRAGMA table_info(${table})`, []);
    if (!columns.some(info => info.name === column)) {
      await driver.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      if (fill) await driver.exec(fill);
    }
  }
}

async function openNative(): Promise<Driver> {
  const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
  const sqlite = new SQLiteConnection(CapacitorSQLite);

  // A WebView reload keeps the native connection open, so reuse it instead of creating a second one.
  const consistent = (await sqlite.checkConnectionsConsistency()).result;
  const exists = (await sqlite.isConnection(DB_NAME, false)).result;
  const db =
    consistent && exists
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", 1, false);
  await db.open();

  return {
    async exec(sql) {
      await db.execute(sql, false);
    },
    async all(sql, params) {
      return (await db.query(sql, params)).values ?? [];
    },
    async batch(statements) {
      await db.executeSet(
        statements.map(({ sql, params }) => ({ statement: sql, values: params ?? [] })),
        true,
      );
    },
  };
}

function openElectron(localDb: ElectronLocalDb): Driver {
  return {
    async exec(sql) {
      localDb.exec(sql);
    },
    async all(sql, params) {
      return localDb.all(sql, params);
    },
    async batch(statements) {
      localDb.batch(statements);
    },
  };
}

// The whole database file is kept under a single IndexedDB key.
const IDB_STORE = "files";
const IDB_KEY = "archivist.sqlite";

function openIndexedDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(IDB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbRequest<T>(idb: IDBDatabase, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const request = run(idb.transaction(IDB_STORE, mode).objectStore(IDB_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openBrowser(): Promise<Driver> {
  const { default: initSqlJs } = await import("sql.js");
  const [SQL, idb] = await Promise.all([initSqlJs({ locateFile: () => sqlWasmUrl }), openIndexedDb()]);
  const saved = await idbRequest<Uint8Array | undefined>(idb, "readonly", store => store.get(IDB_KEY));
  const db: SqlJsDatabase = new SQL.Database(saved);
  db.exec("PRAGMA foreign_keys = ON;");

  const persist = async () => {
    const data = db.export();
    // export() reopens the database, which resets pragmas.
    db.exec("PRAGMA foreign_keys = ON;");
    await idbRequest(idb, "readwrite", store => store.put(data, IDB_KEY));
  };

  return {
    async exec(sql) {
      db.exec(sql);
      await persist();
    },
    async all(sql, params) {
      const statement = db.prepare(sql, params);
      const rows: Row[] = [];
      while (statement.step()) rows.push(statement.getAsObject());
      statement.free();
      return rows;
    },
    async batch(statements) {
      db.exec("BEGIN");
      try {
        for (const { sql, params } of statements) db.run(sql, params ?? []);
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      await persist();
    },
  };
}

async function openDriver(): Promise<Driver> {
  const electronDb = typeof window !== "undefined" ? (window as any).__LOCAL_DB__ : undefined;
  const driver = Capacitor.isNativePlatform()
    ? await openNative()
    : electronDb
      ? openElectron(electronDb)
      : await openBrowser();

  await driver.exec("PRAGMA foreign_keys = ON;");
  await driver.exec(SCHEMA);
  await addMissingColumns(driver);
  await driver.exec(INDEXES);
  return driver;
}

let driverPromise: Promise<Driver> | null = null;

function getDriver() {
  if (!driverPromise) {
    driverPromise = openDriver().catch(err => {
      driverPromise = null;
      throw err;
    });
  }
  return driverPromise;
}

// Queries run one after another, so a read never sees half of a batch.
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task);
  writeQueue = result.catch(() => {});
  return result;
}

export async function queryAll<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  const driver = await getDriver();
  return enqueue(() => driver.all(sql, params)) as Promise<T[]>;
}

export async function queryOne<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  const rows = await queryAll<T>(sql, params);
  return rows[0] ?? null;
}

export async function run(sql: string, params: SqlValue[] = []) {
  await runBatch([{ sql, params }]);
}

export async function runBatch(statements: Statement[]) {
  if (statements.length === 0) return;
  const driver = await getDriver();
  await enqueue(() => driver.batch(statements));
}

export function newId() {
  return crypto.randomUUID();
}

export function now() {
  return new Date().toISOString();
}
