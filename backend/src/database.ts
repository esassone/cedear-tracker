import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module replacement for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database | null = null;

export async function getDatabase() {
  if (db) return db;

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
      unit_price_ars REAL,
      market_price_ars REAL,
      commission_ars REAL DEFAULT 0,
      dollar_rate REAL,
      owner TEXT, -- Max 10 chars (enforced in application layer)
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

    CREATE TABLE IF NOT EXISTS bna_dollar_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      buy_price REAL NOT NULL,
      sell_price REAL NOT NULL
    );
  `);

  // Migrations for existing tables
  const transactionColumns = await db.all("PRAGMA table_info(transactions)");
  if (!transactionColumns.find(c => c.name === 'commission_ars')) {
    await db.exec("ALTER TABLE transactions ADD COLUMN commission_ars REAL DEFAULT 0");
  }
  if (!transactionColumns.find(c => c.name === 'owner')) {
    await db.exec("ALTER TABLE transactions ADD COLUMN owner TEXT");
  }
  if (!transactionColumns.find(c => c.name === 'unit_price_ars')) {
    await db.exec("ALTER TABLE transactions ADD COLUMN unit_price_ars REAL");
    await db.exec("UPDATE transactions SET unit_price_ars = price_ars");
  }
  if (!transactionColumns.find(c => c.name === 'dollar_rate')) {
    await db.exec("ALTER TABLE transactions ADD COLUMN dollar_rate REAL");
  }
  if (!transactionColumns.find(c => c.name === 'market_price_ars')) {
    await db.exec("ALTER TABLE transactions ADD COLUMN market_price_ars REAL");
  }

  // Final Cleanup: Check if old USD columns still exist and remove them by recreating the table
  if (transactionColumns.find(c => c.name === 'price_usd')) {
    console.log('Migrating transactions table to remove USD columns...');
    await db.exec(`
      CREATE TABLE transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        type TEXT CHECK(type IN ('buy', 'sell')) NOT NULL,
        quantity REAL NOT NULL,
        price_ars REAL NOT NULL,
        unit_price_ars REAL,
        market_price_ars REAL,
        commission_ars REAL DEFAULT 0,
        dollar_rate REAL,
        owner TEXT,
        FOREIGN KEY (asset_id) REFERENCES assets(id)
      );
      
      INSERT INTO transactions_new (id, asset_id, date, type, quantity, price_ars, unit_price_ars, market_price_ars, commission_ars, dollar_rate, owner)
      SELECT id, asset_id, date, type, quantity, price_ars, unit_price_ars, NULL, commission_ars, dollar_rate, owner FROM transactions;
      
      DROP TABLE transactions;
      ALTER TABLE transactions_new RENAME TO transactions;
    `);
  }

  return db;
}




