import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDatabase } from './database.js';
import { scrapeIOL } from './services/scraper.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'CEDEAR Tracker API is running' });
});
// Endpoint para disparar el scraping manual
app.post('/api/sync-prices', async (req, res) => {
    try {
        const data = await scrapeIOL();
        res.json({ message: 'Sync successful', count: data.length });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to sync prices' });
    }
});
// Endpoint para obtener los activos actuales con su último precio
app.get('/api/assets', async (req, res) => {
    try {
        const db = await getDatabase();
        const assets = await db.all(`
      SELECT a.ticker, p.price_ars, p.date 
      FROM assets a
      LEFT JOIN prices p ON p.asset_id = a.id
      WHERE p.id = (SELECT MAX(id) FROM prices WHERE asset_id = a.id)
      OR p.id IS NULL
    `);
        res.json(assets);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});
async function start() {
    try {
        await getDatabase();
        console.log('Database initialized');
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
start();
