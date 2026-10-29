import { onWrite, queryAll, queryOne, runBatch, SYNCED_TABLES, type SqlValue, type Statement } from "./db";
import { getSupabaseClient } from "./supabase";

// With sync on, a user's volumes are also kept in Supabase (public.sync_rows, see supabase/auth_sync.sql): a backup,
// and the same volumes on every device they log in on. The local database is still the one the app reads and
// writes; syncing runs in the background and never holds up editing.
//
// Triggers note every change to a synced table in sync_changes (see db.ts), stamped with when it happened. A sync
// pulls what other devices sent since the last pull, then pushes the noted rows (or a tombstone, for deleted ones).
// When both sides changed the same row, the later change wins.

export type SyncStatus = {
  // null until the user chooses, on this device.
  enabled: boolean | null;
  syncing: boolean;
  syncedAt: string | null;
  error: string | null;
  // Goes up each time a pull changes the local database, so screens know to reload.
  pulls: number;
};

type TableName = (typeof SYNCED_TABLES)[number]["table"];
type Change = { tbl: TableName; row_id: string; changed_at: string };
type RemoteRow = { tbl: TableName; row_id: string; data: Record<string, unknown> | null; changed_at: string; rev: number };

const PAGE = 1000;
const PUSH_CHUNK = 100;
// How long after a local write its changes are pushed, and how often to look for other devices' changes.
const PUSH_DELAY = 4000;
const PULL_EVERY = 3 * 60 * 1000;

// Optional references, filled only when the row they point to is here (a pulled note can point to a category that
// clashed with a local one of the same name and wasn't added).
const OPTIONAL_REFS: Record<string, string> = {
  "notes.category_id": "categories",
  "notes.subgroup_id": "subgroups",
  "subgroups.parent_id": "subgroups",
};

let session: { userId: number; stop: () => void } | null = null;
let status: SyncStatus = { enabled: null, syncing: false, syncedAt: null, error: null, pulls: 0 };
const listeners = new Set<(status: SyncStatus) => void>();

function setStatus(change: Partial<SyncStatus>) {
  status = { ...status, ...change };
  listeners.forEach(listener => listener(status));
}

export function getSyncStatus() {
  return status;
}

export function subscribeSync(listener: (status: SyncStatus) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const keyOf = (tbl: string, rowId: string) => `${tbl}/${rowId}`;
const toIso = (value: string) => new Date(value).toISOString();

function toSqlValue(value: unknown): SqlValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" || typeof value === "string") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return JSON.stringify(value);
}

// The local columns of each synced table; pulled rows only fill these, so a row from a newer app version still fits.
let columnsCache: Map<TableName, string[]> | null = null;

async function localColumns() {
  if (!columnsCache) {
    const entries = await Promise.all(
      SYNCED_TABLES.map(async ({ table }) => {
        const info = await queryAll<{ name: string }>(`PRAGMA table_info(${table})`);
        return [table, info.map(column => column.name)] as const;
      }),
    );
    columnsCache = new Map(entries);
  }
  return columnsCache;
}

// --- Push ---

async function push(userId: number) {
  const changes = await queryAll<Change>("SELECT tbl, row_id, changed_at FROM sync_changes WHERE user_id = ?", [userId]);
  if (!changes.length) return;

  const rows = new Map<string, Record<string, unknown>>();
  for (const { table, key } of SYNCED_TABLES) {
    const ids = changes.filter(change => change.tbl === table).map(change => change.row_id);
    for (let start = 0; start < ids.length; start += 500) {
      const chunk = ids.slice(start, start + 500);
      const found = await queryAll<Record<string, unknown>>(
        `SELECT *, ${key(table)} AS sync_row_id FROM ${table} WHERE ${key(table)} IN (${chunk.map(() => "?").join(", ")})`,
        chunk,
      );
      for (const { sync_row_id, ...row } of found) rows.set(keyOf(table, String(sync_row_id)), row);
    }
  }

  const supabase = getSupabaseClient();
  for (let start = 0; start < changes.length; start += PUSH_CHUNK) {
    const chunk = changes.slice(start, start + PUSH_CHUNK);
    const { error } = await supabase.from("sync_rows").upsert(
      chunk.map(change => ({
        user_id: userId,
        tbl: change.tbl,
        row_id: change.row_id,
        data: rows.get(keyOf(change.tbl, change.row_id)) ?? null,
        changed_at: change.changed_at,
      })),
      { onConflict: "user_id,tbl,row_id" },
    );
    if (error) throw error;
    // A row changed again while this was sending keeps its newer note, for the next push.
    await runBatch(
      chunk.map(change => ({
        sql: "DELETE FROM sync_changes WHERE tbl = ? AND row_id = ? AND changed_at = ?",
        params: [change.tbl, change.row_id, change.changed_at],
      })),
    );
  }
}

// --- Pull ---

async function fetchSince(userId: number, lastRev: number) {
  const supabase = getSupabaseClient();
  const rows: RemoteRow[] = [];
  for (let rev = lastRev; ; ) {
    const { data, error } = await supabase
      .from("sync_rows")
      .select("tbl, row_id, data, changed_at, rev")
      .eq("user_id", userId)
      .gt("rev", rev)
      .order("rev")
      .limit(PAGE);
    if (error) throw error;
    rows.push(...(data as RemoteRow[]));
    if (data.length < PAGE) return rows;
    rev = data[data.length - 1]!.rev;
  }
}

// Subgroups with their parents before them, so each one's parent is already there when it's added.
function parentsFirst(rows: RemoteRow[]) {
  const byId = new Map(rows.map(row => [row.row_id, row]));
  const sorted: RemoteRow[] = [];
  const placed = new Set<string>();
  const place = (row: RemoteRow, depth = 0) => {
    if (placed.has(row.row_id)) return;
    placed.add(row.row_id);
    const parent = byId.get(String(row.data?.parent_id ?? ""));
    if (parent && depth < 100) place(parent, depth + 1);
    sorted.push(row);
  };
  rows.forEach(row => place(row));
  return sorted;
}

function upsertStatements(userId: number, row: RemoteRow, columns: string[]): Statement[] {
  const data = { ...row.data };
  // A volume always belongs to whoever pulled it; nothing pulled can file it under another user on this device.
  if (row.tbl === "worlds") data.user_id = userId;
  const names = columns.filter(column => column in data);
  const value = (column: string) => {
    const ref = OPTIONAL_REFS[`${row.tbl}.${column}`];
    return ref ? `(SELECT id FROM ${ref} WHERE id = ?)` : "?";
  };
  const values = names.map(column => toSqlValue(data[column]));
  const key = SYNCED_TABLES.find(entry => entry.table === row.tbl)!.key(row.tbl);
  const owner = row.tbl === "worlds" ? " AND user_id = ?" : "";

  // OR IGNORE: a row whose name clashes with a local one (two devices each made a category "Lugar") is left out
  // instead of failing the whole pull.
  return [
    {
      sql: `INSERT OR IGNORE INTO ${row.tbl} (${names.join(", ")}) VALUES (${names.map(value).join(", ")})`,
      params: values,
    },
    {
      sql: `UPDATE OR IGNORE ${row.tbl} SET ${names.map(column => `${column} = ${value(column)}`).join(", ")}
            WHERE ${key} = ?${owner}`,
      params: [...values, row.row_id, ...(owner ? [userId] : [])],
    },
  ];
}

function deleteStatement(userId: number, row: RemoteRow): Statement {
  const key = SYNCED_TABLES.find(entry => entry.table === row.tbl)!.key(row.tbl);
  return row.tbl === "worlds"
    ? { sql: "DELETE FROM worlds WHERE id = ? AND user_id = ?", params: [row.row_id, userId] }
    : { sql: `DELETE FROM ${row.tbl} WHERE ${key} = ?`, params: [row.row_id] };
}

// Applies pulled rows, skipping the ones changed here more recently (those get pushed instead). Each statement group
// is one row; the triggers don't note any of it, since it came from the cloud.
async function applyPulled(userId: number, rows: RemoteRow[]) {
  const pending = new Map(
    (await queryAll<Change>("SELECT tbl, row_id, changed_at FROM sync_changes WHERE user_id = ?", [userId])).map(
      change => [keyOf(change.tbl, change.row_id), change.changed_at],
    ),
  );
  const columns = await localColumns();
  const order = SYNCED_TABLES.map(entry => entry.table as string);
  const newer = rows.filter(row => {
    const local = pending.get(keyOf(row.tbl, row.row_id));
    return !local || local < toIso(row.changed_at);
  });

  const forget = (row: RemoteRow): Statement => ({
    sql: "DELETE FROM sync_changes WHERE tbl = ? AND row_id = ?",
    params: [row.tbl, row.row_id],
  });
  const upserts = newer.filter(row => row.data && columns.has(row.tbl));
  const upsertGroups = SYNCED_TABLES.flatMap(({ table }) => {
    const ofTable = upserts.filter(row => row.tbl === table);
    return (table === "subgroups" ? parentsFirst(ofTable) : ofTable).map(row => [
      ...upsertStatements(userId, row, columns.get(table)!),
      forget(row),
    ]);
  });
  // Children before parents; a subgroup's contents were already moved by the upserts above.
  const deleteGroups = newer
    .filter(row => !row.data && columns.has(row.tbl))
    .sort((a, b) => order.indexOf(b.tbl) - order.indexOf(a.tbl))
    .map(row => [deleteStatement(userId, row), forget(row)]);
  const groups = [...upsertGroups, ...deleteGroups];
  if (!groups.length) return false;

  const applying = (statements: Statement[]): Statement[] => [
    { sql: "UPDATE sync_state SET applying = 1" },
    ...statements,
    { sql: "UPDATE sync_state SET applying = 0" },
  ];
  try {
    await runBatch(applying(groups.flat()));
  } catch (err) {
    // Something pulled doesn't fit (say, a note whose volume never arrived). Add the rows one at a time and leave
    // out the ones that fail, so one bad row can't stop every sync after it.
    console.warn("Sincronização: aplicando as mudanças uma a uma.", err);
    for (const group of groups) {
      await runBatch(applying(group)).catch(rowErr => console.warn("Sincronização: mudança ignorada.", rowErr));
    }
  }
  return true;
}

async function pull(userId: number) {
  const settings = await queryOne<{ last_rev: number }>("SELECT last_rev FROM sync_settings WHERE user_id = ?", [userId]);
  const rows = await fetchSince(userId, settings?.last_rev ?? 0);
  if (!rows.length) return;
  const changed = await applyPulled(userId, rows);
  await runBatch([
    { sql: "UPDATE sync_settings SET last_rev = ? WHERE user_id = ?", params: [rows[rows.length - 1]!.rev, userId] },
  ]);
  if (changed) setStatus({ pulls: status.pulls + 1 });
}

// --- Running syncs ---

let queue: Promise<void> = Promise.resolve();

// Syncs run one after another. A full sync pulls first; a push only sends local changes.
function queueSync(full: boolean) {
  const run = queue.then(async () => {
    const current = session;
    if (!current || !status.enabled) return;
    setStatus({ syncing: true });
    try {
      if (full) await pull(current.userId);
      await push(current.userId);
      if (session !== current) return;
      const syncedAt = new Date().toISOString();
      await runBatch([{ sql: "UPDATE sync_settings SET synced_at = ? WHERE user_id = ?", params: [syncedAt, current.userId] }]);
      setStatus({ syncedAt, error: null });
    } catch (err) {
      console.warn("Não foi possível sincronizar.", err);
      if (session === current) {
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        setStatus({ error: offline ? "Sem conexão; sincroniza quando voltar." : "Não foi possível sincronizar." });
      }
    } finally {
      setStatus({ syncing: false });
    }
  });
  queue = run.catch(() => {});
  return run;
}

export function syncNow() {
  return queueSync(true);
}

// Starts listening for local writes, the clock, and the app coming back to the foreground.
function startBackgroundSync() {
  let pushTimer: ReturnType<typeof setTimeout> | undefined;
  const stopWrites = onWrite(() => {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => queueSync(false), PUSH_DELAY);
  });
  const pullTimer = setInterval(() => queueSync(true), PULL_EVERY);
  const onVisible = () => {
    if (document.visibilityState === "visible") queueSync(true);
  };
  const onOnline = () => queueSync(true);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);

  return () => {
    clearTimeout(pushTimer);
    stopWrites();
    clearInterval(pullTimer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
  };
}

// At login: changes from now on are this user's, and if they turned sync on here, it starts. Resolves to their
// choice, or null if they haven't made one on this device yet.
export async function startSyncSession(userId: number): Promise<boolean | null> {
  endSyncSession();
  await runBatch([{ sql: "UPDATE sync_state SET user_id = ?", params: [userId] }]);
  const settings = await queryOne<{ enabled: number; synced_at: string | null }>(
    "SELECT enabled, synced_at FROM sync_settings WHERE user_id = ?",
    [userId],
  );
  const enabled = settings ? settings.enabled === 1 : null;
  session = { userId, stop: () => {} };
  setStatus({ enabled, syncing: false, syncedAt: settings?.synced_at ?? null, error: null });
  if (enabled) {
    session.stop = startBackgroundSync();
    void syncNow();
  }
  return enabled;
}

// At logout. Changes not sent yet stay noted and go with the next sync.
export function endSyncSession() {
  session?.stop();
  session = null;
  setStatus({ enabled: null, syncing: false, syncedAt: null, error: null });
  void runBatch([{ sql: "UPDATE sync_state SET user_id = NULL" }]);
}

// Notes every row the user has as changed, stamped with when it last changed, so the first sync sends anything the
// cloud doesn't have yet, and a newer cloud copy of a row still wins over an older one here.
function markAllStatements(userId: number): Statement[] {
  const insert = "INSERT OR IGNORE INTO sync_changes (tbl, row_id, user_id, changed_at)";
  const params = [userId, userId];
  return [
    { sql: `${insert} SELECT 'worlds', id, ?, updated_at FROM worlds WHERE user_id = ?`, params },
    ...(["categories", "subgroups"] as const).map(table => ({
      sql: `${insert} SELECT '${table}', t.id, ?, t.created_at FROM ${table} t JOIN worlds w ON w.id = t.world_id
            WHERE w.user_id = ?`,
      params,
    })),
    {
      sql: `${insert} SELECT 'notes', n.id, ?, n.updated_at FROM notes n JOIN worlds w ON w.id = n.world_id
            WHERE w.user_id = ?`,
      params,
    },
    {
      sql: `${insert} SELECT 'note_snapshots', s.id, ?, s.created_at FROM note_snapshots s
              JOIN notes n ON n.id = s.note_id JOIN worlds w ON w.id = n.world_id
            WHERE w.user_id = ?`,
      params,
    },
    {
      sql: `${insert} SELECT 'writing_days', d.world_id || '|' || d.day, ?, d.day || 'T00:00:00.000Z'
            FROM writing_days d JOIN worlds w ON w.id = d.world_id WHERE w.user_id = ?`,
      params,
    },
  ];
}

// Turning sync off stops it on this device; the copy already in the cloud stays.
export async function setSyncEnabled(userId: number, enabled: boolean) {
  await runBatch([
    ...(enabled ? markAllStatements(userId) : []),
    {
      sql: `INSERT INTO sync_settings (user_id, enabled) VALUES (?, ?)
            ON CONFLICT (user_id) DO UPDATE SET enabled = excluded.enabled`,
      params: [userId, enabled ? 1 : 0],
    },
  ]);
  if (session?.userId !== userId) return;
  session.stop();
  session.stop = enabled ? startBackgroundSync() : () => {};
  setStatus({ enabled, error: null });
  if (enabled) void syncNow();
}
