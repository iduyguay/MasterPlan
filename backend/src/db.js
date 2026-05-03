import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

const dbPath = config.db.path.replace(/\.db$/, '.json');
mkdirSync(dirname(dbPath), { recursive: true });

const initial = {
  users: {},
  users_by_name: {},
  audit_log: [],
  vault_fragments: {},
  progress: {},
  rate_buckets: {}
};

let state = initial;
if (existsSync(dbPath)) {
  try {
    state = { ...initial, ...JSON.parse(readFileSync(dbPath, 'utf8')) };
  } catch {
    state = initial;
  }
}

let writeQueued = false;
function persist() {
  if (writeQueued) return;
  writeQueued = true;
  setImmediate(() => {
    try {
      writeFileSync(dbPath, JSON.stringify(state));
    } catch (e) {
      console.error('[db] persist error', e.message);
    } finally {
      writeQueued = false;
    }
  });
}

export const db = {
  raw: () => state,
  count(table) {
    const t = state[table];
    if (!t) return 0;
    return Array.isArray(t) ? t.length : Object.keys(t).length;
  }
};

function rowOrUndefined(v) {
  return v === undefined ? undefined : v;
}

export const stmt = {
  insertUser: {
    run(id, username, password_hash, role, clearance, created_at) {
      if (state.users_by_name[username]) {
        const err = new Error('UNIQUE constraint failed: users.username');
        err.code = 'SQLITE_CONSTRAINT_UNIQUE';
        throw err;
      }
      const row = { id, username, password_hash, role, clearance, created_at };
      state.users[id] = row;
      state.users_by_name[username] = id;
      persist();
      return { changes: 1 };
    }
  },
  findUserByName: {
    get(username) {
      const id = state.users_by_name[username];
      return rowOrUndefined(id ? state.users[id] : undefined);
    }
  },
  findUserById: {
    get(id) {
      return rowOrUndefined(state.users[id]);
    }
  },
  insertAudit: {
    run(user_id, ip, method, path, status, note, created_at) {
      state.audit_log.push({ user_id, ip, method, path, status, note, created_at });
      if (state.audit_log.length > 5000) {
        state.audit_log = state.audit_log.slice(-2500);
      }
      persist();
      return { changes: 1 };
    }
  },
  insertFragment: {
    run(id, label, fragment, revealed_at_stage) {
      state.vault_fragments[id] = { id, label, fragment, revealed_at_stage };
      persist();
      return { changes: 1 };
    }
  },
  listFragments: {
    all() {
      return Object.values(state.vault_fragments).sort((a, b) => a.id - b.id);
    }
  },
  ensureProgress: {
    run(user_id, updated_at) {
      if (!state.progress[user_id]) {
        state.progress[user_id] = {
          user_id,
          stage1: 0, stage2: 0, stage3: 0, stage4: 0, stage5: 0,
          fragments: '[]',
          updated_at
        };
        persist();
      }
      return { changes: 1 };
    }
  },
  getProgress: {
    get(user_id) {
      return rowOrUndefined(state.progress[user_id]);
    }
  },
  updateProgress: {
    run(s1, s2, s3, s4, s5, fragments, updated_at, user_id) {
      const p = state.progress[user_id];
      if (!p) return { changes: 0 };
      p.stage1 = s1; p.stage2 = s2; p.stage3 = s3; p.stage4 = s4; p.stage5 = s5;
      p.fragments = fragments;
      p.updated_at = updated_at;
      persist();
      return { changes: 1 };
    }
  },
  getRateBucket: {
    get(key) {
      return rowOrUndefined(state.rate_buckets[key]);
    }
  },
  upsertRateBucket: {
    run(bucket_key, tokens, updated_at) {
      state.rate_buckets[bucket_key] = { bucket_key, tokens, updated_at };
      persist();
      return { changes: 1 };
    }
  }
};
