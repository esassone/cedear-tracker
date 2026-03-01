import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cron from 'node-cron';
import multer from 'multer';
import fs from 'fs';
import { getDatabase } from './database.js';
import { scrapeIOL } from './services/scraper.js';
import { scrapeComafiRatios } from './services/comafiScraper.js';
import { scrapeBNADollarPrice } from './services/bnaScraper.js';
import { importTransactionsFromCSV } from './services/transactionImporter.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'CEDEAR Tracker API is running' });
});

async function syncAllPrices() {
  console.log(`Starting scheduled sync at ${new Date().toISOString()}`);
  try {
    await scrapeComafiRatios(); 
    await scrapeBNADollarPrice();
    const data = await scrapeIOL();
    console.log(`Scheduled sync completed successfully. Scraped ${data.length} items.`);
    return data;
  } catch (error) {
    console.error('Scheduled sync failed:', error);
    throw error;
  }
}

app.post('/api/sync-prices', async (req, res) => {
  try {
    const data = await syncAllPrices();
    res.json({ message: 'Sync successful', count: data.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync prices' });
  }
});

app.get('/api/assets', async (req, res) => {
  try {
    const db = await getDatabase();
    const assets = await db.all(`
      SELECT a.ticker, a.ratio_ars_usd, p.price_ars, p.price_usd, p.date
      FROM assets a
      LEFT JOIN prices p ON p.asset_id = a.id
      WHERE p.id = (SELECT MAX(id) FROM prices WHERE asset_id = a.id)
      OR p.id IS NULL
    `);
    res.json(assets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

app.get('/api/latest-dollar', async (req, res) => {
  try {
    const db = await getDatabase();
    const latestBNA = await db.get('SELECT sell_price FROM bna_dollar_prices ORDER BY date DESC LIMIT 1');
    res.json(latestBNA || { sell_price: 1 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch latest dollar price' });
  }
});

app.get('/api/all-assets', async (req, res) => {
  try {
    const db = await getDatabase();
    const allAssets = await db.all(`SELECT ticker, ratio_ars_usd FROM assets`);
    res.json(allAssets);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch all assets' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const db = await getDatabase();
    const transactions = await db.all(`
      SELECT t.id, t.date, t.type, t.quantity, t.price_ars, 
             t.unit_price_ars, t.market_price_ars,
             t.commission_ars, t.dollar_rate, t.owner, a.ticker, a.name 
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      ORDER BY t.date DESC
    `);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  const { ticker, date, type, quantity, price_ars, commission_ars, owner, unit_price_ars, dollar_rate } = req.body;
  if (!ticker || !date || !type || !quantity || !price_ars) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  try {
    const db = await getDatabase();
    let asset = await db.get('SELECT id FROM assets WHERE ticker = ?', [ticker]);
    if (!asset) {
      const result = await db.run('INSERT INTO assets (ticker) VALUES (?)', [ticker]);
      asset = { id: result.lastID };
    }
    const ownerValue = owner ? String(owner).slice(0, 10) : null;
    let finalDollarRate = dollar_rate;
    if (!finalDollarRate) {
      const latestBNA = await db.get('SELECT sell_price FROM bna_dollar_prices WHERE date <= ? ORDER BY date DESC LIMIT 1', [date]);
      finalDollarRate = latestBNA?.sell_price || null;
    }
    let marketPriceRow = await db.get(
      'SELECT price_ars FROM prices WHERE asset_id = ? AND date(date) <= date(?) ORDER BY date DESC LIMIT 1',
      [asset.id, date]
    );
    if (!marketPriceRow) {
      marketPriceRow = await db.get('SELECT price_ars FROM prices WHERE asset_id = ? ORDER BY date DESC LIMIT 1', [asset.id]);
    }
    const marketPriceArs = marketPriceRow?.price_ars || null;
    await db.run(
      `INSERT INTO transactions (asset_id, date, type, quantity, price_ars, unit_price_ars, market_price_ars, commission_ars, owner, dollar_rate) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [asset.id, date, type, quantity, price_ars, unit_price_ars || price_ars, marketPriceArs, commission_ars || 0, ownerValue, finalDollarRate]
    );
    res.status(201).json({ message: 'Transaction created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const db = await getDatabase();
    await db.run('DELETE FROM transactions WHERE id = ?', [id]);
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

app.post('/api/transactions/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }
  try {
    const result = await importTransactionsFromCSV(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json({ message: 'Import completed', imported: result.imported, errors: result.errors });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import transactions' });
  }
});

app.get('/api/portfolio/history', async (req, res) => {
  try {
    const db = await getDatabase();
    const transactions = await db.all(`SELECT t.*, a.ticker FROM transactions t JOIN assets a ON t.asset_id = a.id ORDER BY t.date ASC, t.id ASC`);
    const prices = await db.all(`SELECT p.date, p.price_ars, a.ticker FROM prices p JOIN assets a ON p.asset_id = a.id ORDER BY p.date ASC`);
    const bnaPrices = await db.all(`SELECT date, sell_price FROM bna_dollar_prices ORDER BY date ASC`);
    
    const pricesByTicker: Record<string, {date: string, price: number}[]> = {};
    prices.forEach(p => {
      const date = p.date.split('T')[0];
      if (!pricesByTicker[p.ticker]) pricesByTicker[p.ticker] = [];
      pricesByTicker[p.ticker].push({ date, price: p.price_ars });
    });

    const bnaHistory = bnaPrices.map(p => ({ date: p.date.split('T')[0], price: p.sell_price }));

    const allDates = Array.from(new Set([
      ...transactions.map(t => t.date),
      ...prices.map(p => p.date.split('T')[0]),
      ...bnaHistory.map(b => b.date)
    ])).sort();

    const history: { date: string, value: number, invested: number }[] = [];
    const currentHoldings: Record<string, number> = {};
    const lastKnownArsPrices: Record<string, number> = {};
    let totalInvestedUsd = 0;
    let lastKnownBnaDollar = 1;
    let transactionIndex = 0;

    allDates.forEach(date => {
      while (transactionIndex < transactions.length && transactions[transactionIndex].date <= date) {
        const t = transactions[transactionIndex];
        if (!currentHoldings[t.ticker]) currentHoldings[t.ticker] = 0;
        
        const txCostUsd = ((t.quantity * (t.unit_price_ars || t.price_ars)) + (t.commission_ars || 0)) / (t.dollar_rate || 1);

        if (t.type === 'buy') {
          currentHoldings[t.ticker] += t.quantity;
          totalInvestedUsd += txCostUsd;
        } else {
          // Para ventas, reducimos el capital invertido proporcionalmente al costo promedio anterior
          // o simplemente restamos el valor de la venta a precio de costo (simplificado)
          const ratio = t.quantity / (currentHoldings[t.ticker] || 1);
          currentHoldings[t.ticker] -= t.quantity;
          // Esto es una simplificación: restamos el proporcional del invertido
          // totalInvestedUsd -= (totalInvestedUsd * ratio); // Opcional: ajustar lógica de desinversión
        }

        if (t.unit_price_ars) lastKnownArsPrices[t.ticker] = t.unit_price_ars;
        if (t.dollar_rate) lastKnownBnaDollar = t.dollar_rate;
        transactionIndex++;
      }

      Object.keys(pricesByTicker).forEach(ticker => {
        const tickerPrices = pricesByTicker[ticker];
        for (const p of tickerPrices) {
          if (p.date <= date) lastKnownArsPrices[ticker] = p.price;
          else break;
        }
      });

      for (const b of bnaHistory) {
        if (b.date <= date) lastKnownBnaDollar = b.price;
        else break;
      }

      let totalValueArs = 0;
      Object.entries(currentHoldings).forEach(([ticker, quantity]) => {
        if (quantity > 0.000001) totalValueArs += quantity * (lastKnownArsPrices[ticker] || 0);
      });

      if (totalValueArs > 0 || totalInvestedUsd > 0) {
        history.push({ 
          date, 
          value: Number((totalValueArs / lastKnownBnaDollar).toFixed(2)),
          invested: Number(totalInvestedUsd.toFixed(2))
        });
      }
    });
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch portfolio history' });
  }
});

cron.schedule('0 10-18 * * 1-5', () => {
  syncAllPrices().catch(err => console.error('Error in scheduled job:', err));
});

async function start() {
  try {
    await getDatabase();
    console.log('Database initialized');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
  } catch (error) {
    process.exit(1);
  }
}

start();
