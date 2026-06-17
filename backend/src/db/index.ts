import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';

let SQL: SqlJsStatic;
let db: Database | null = null;
let dbPath: string;

export async function initDatabase(dbFilePath?: string): Promise<Database> {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  dbPath = dbFilePath || path.join(process.cwd(), 'data', 'tools.db');
  
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    saveDatabase();
  }

  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  return db;
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
}

export function saveDatabase(): void {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export function prepare(sql: string): StatementWrapper {
  return new StatementWrapper(sql);
}

export class StatementWrapper {
  private sql: string;

  constructor(sql: string) {
    this.sql = sql;
  }

  all(...params: any[]): any[] {
    const database = getDatabase();
    const stmt = database.prepare(this.sql);
    stmt.bind(params);
    
    const results: any[] = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  get(...params: any[]): any | undefined {
    const database = getDatabase();
    const stmt = database.prepare(this.sql);
    stmt.bind(params);
    
    let result: any | undefined;
    if (stmt.step()) {
      result = stmt.getAsObject();
    }
    stmt.free();
    return result;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const database = getDatabase();
    const stmt = database.prepare(this.sql);
    stmt.bind(params);
    stmt.step();
    stmt.free();
    
    const changes = database.getRowsModified();
    const lastIdResult = database.exec('SELECT last_insert_rowid() as id');
    const lastInsertRowid = Number(lastIdResult[0]?.values[0]?.[0] || 0);
    
    saveDatabase();
    return { changes, lastInsertRowid };
  }
}

export default {
  init: initDatabase,
  get: getDatabase,
  save: saveDatabase,
  prepare,
};
