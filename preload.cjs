const path = require('path');
const dotenv = require('dotenv');
const { DatabaseSync } = require('node:sqlite');

dotenv.config({ path: path.join(__dirname, '.env') });

window.__ENV__ = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
};

// Updates, in the installed Windows app only: main.cjs passes the app's version, and installs a release's
// installer when asked (see src/lib/updates.ts).
const versionArg = process.argv.find(arg => arg.startsWith('--archivist-version='));
if (versionArg) {
  const { ipcRenderer } = require('electron');
  window.__UPDATER__ = {
    version: versionArg.slice('--archivist-version='.length),
    install: url => ipcRenderer.invoke('install-update', url),
  };
}

// The local database file (see src/lib/db.ts). main.cjs passes its path, inside the app's user data folder.
const dbArg = process.argv.find(arg => arg.startsWith('--archivist-db='));
const db = new DatabaseSync(dbArg.slice('--archivist-db='.length));

window.__LOCAL_DB__ = {
  exec(sql) {
    db.exec(sql);
  },
  all(sql, params) {
    return db.prepare(sql).all(...params);
  },
  batch(statements) {
    db.exec('BEGIN');
    try {
      for (const { sql, params = [] } of statements) db.prepare(sql).run(...params);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },
};
