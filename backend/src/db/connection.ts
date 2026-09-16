import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const DB_PATH = process.env.DB_PATH ?? "./sentinel.db";

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(path.resolve(DB_PATH));
  applyPragmas(_db);
  applySchema(_db);
  return _db;
}

export type Row = Record<string, SQLInputValue>;

export function q(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): Row[] {
  return db.prepare(sql).all(...params) as Row[];
}

export function qOne(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): Row | undefined {
  return db.prepare(sql).get(...params) as Row | undefined;
}

export function run(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): void {
  db.prepare(sql).run(...params);
}

function applyPragmas(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA synchronous = NORMAL");
}

function applySchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      initials TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS objects (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      display TEXT NOT NULL,
      linked_count INTEGER NOT NULL DEFAULT 0,
      first_seen TEXT,
      image_url TEXT,
      properties TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_objects_type ON objects(type);
    CREATE INDEX IF NOT EXISTS idx_objects_display ON objects(display);
    CREATE TABLE IF NOT EXISTS links (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      type TEXT NOT NULL,
      confidence INTEGER NOT NULL,
      method TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_label TEXT NOT NULL,
      observed TEXT NOT NULL,
      matched_attributes TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_id);
    CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_id);
    CREATE TABLE IF NOT EXISTS cases (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Open',
      lead_id TEXT NOT NULL,
      graph_layout TEXT,
      escalation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
    CREATE TABLE IF NOT EXISTS case_assignments (
      case_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY (case_id, user_id)
    );
    CREATE TABLE IF NOT EXISTS case_objects (
      case_id TEXT NOT NULL,
      object_id TEXT NOT NULL,
      PRIMARY KEY (case_id, object_id)
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_case ON notes(case_id);
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      label TEXT NOT NULL,
      points INTEGER NOT NULL,
      object_ids TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS idx_signals_case ON signals(case_id);
    CREATE TABLE IF NOT EXISTS er_matches (
      id TEXT PRIMARY KEY,
      confidence INTEGER NOT NULL,
      left_object TEXT NOT NULL,
      right_object TEXT NOT NULL,
      reasons TEXT NOT NULL DEFAULT '[]',
      features TEXT,
      model_version TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT
    );
    CREATE TABLE IF NOT EXISTS data_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      classification TEXT NOT NULL,
      legal_basis TEXT NOT NULL,
      owner TEXT NOT NULL,
      records_ingested INTEGER NOT NULL DEFAULT 0,
      last_sync TEXT NOT NULL DEFAULT 'Never',
      type TEXT NOT NULL,
      sync_warning TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS agencies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      reference TEXT NOT NULL,
      result TEXT NOT NULL,
      purpose TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      at TEXT NOT NULL DEFAULT (datetime('now')),
      href TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE TABLE IF NOT EXISTS provenance (
      id TEXT PRIMARY KEY,
      object_id TEXT NOT NULL,
      field TEXT NOT NULL,
      source TEXT NOT NULL,
      observed TEXT NOT NULL,
      method TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_provenance_object ON provenance(object_id);
    CREATE TABLE IF NOT EXISTS er_training_log (
      id TEXT PRIMARY KEY,
      object_type TEXT NOT NULL,
      match_id TEXT NOT NULL,
      jaro_winkler REAL NOT NULL DEFAULT 0,
      soundex_match INTEGER NOT NULL DEFAULT 0,
      exact_phone INTEGER NOT NULL DEFAULT 0,
      partial_phone INTEGER NOT NULL DEFAULT 0,
      same_city INTEGER NOT NULL DEFAULT 0,
      alias_match INTEGER NOT NULL DEFAULT 0,
      org_jw_high INTEGER NOT NULL DEFAULT 0,
      org_jw_med INTEGER NOT NULL DEFAULT 0,
      org_same_address INTEGER NOT NULL DEFAULT 0,
      org_reg_id INTEGER NOT NULL DEFAULT 0,
      label INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_training_log_type ON er_training_log(object_type);
    CREATE TABLE IF NOT EXISTS model_registry (
      id TEXT PRIMARY KEY,
      version TEXT NOT NULL,
      object_type TEXT NOT NULL,
      use_logistic INTEGER NOT NULL DEFAULT 0,
      weights TEXT NOT NULL DEFAULT '{}',
      intercept REAL,
      n_train INTEGER,
      n_test INTEGER,
      precision_score REAL,
      recall_score REAL,
      f1_score REAL,
      training_from TEXT,
      training_to TEXT,
      status TEXT NOT NULL DEFAULT 'candidate',
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_model_registry_type_status ON model_registry(object_type, status);
    CREATE TABLE IF NOT EXISTS shadow_scores (
      id TEXT PRIMARY KEY,
      candidate_version TEXT NOT NULL,
      match_left_id TEXT NOT NULL,
      match_right_id TEXT NOT NULL,
      live_confidence INTEGER NOT NULL,
      shadow_confidence INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_shadow_scores_version ON shadow_scores(candidate_version);
  `);

  // Safe column migrations for existing databases (SQLite does not support ADD COLUMN IF NOT EXISTS)
  for (const migration of [
    "ALTER TABLE er_matches ADD COLUMN features TEXT",
    "ALTER TABLE er_matches ADD COLUMN model_version TEXT",
  ]) {
    try { db.exec(migration); } catch { /* column already exists */ }
  }
}

