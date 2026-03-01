import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
// ES Module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let db = null;
export async function getDatabase() {
    if (db)
        return db;
    db = await open({
        filename: path.join(__dirname, '..', 'database.sqlite'),
        driver: sqlite3.Database
    });
    await db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT UNIQUE NOT NULL,
      name TEXT,
      ratio_ars_usd REAL -- Relación para convertir de CEDEAR a Acción subyacente
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      type TEXT CHECK(type IN ('buy', 'sell')) NOT NULL,
      quantity REAL NOT NULL,
      price_ars REAL NOT NULL,
      price_usd REAL NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      price_ars REAL NOT NULL,
      price_usd REAL NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id)
    );
  `);
    return db;
}
