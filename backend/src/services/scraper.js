import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDatabase } from '../database.js';
const IOL_URL = 'https://iol.invertironline.com/mercado/cotizaciones/argentina/cedears/todos';
export async function scrapeIOL() {
    try {
        const { data } = await axios.get(IOL_URL);
        const $ = cheerio.load(data);
        const db = await getDatabase();
        const date = new Date().toISOString();
        const results = [];
        // Buscamos las filas de la tabla de cotizaciones
        // Nota: El selector puede necesitar ajustes dependiendo de la estructura exacta de IOL
        $('#cotizaciones tbody tr').each((_, element) => {
            const row = $(element);
            const ticker = row.find('td:nth-child(1) a').text().trim();
            const priceText = row.find('td:nth-child(2)').text().trim().replace(/\./g, '').replace(',', '.');
            const priceArs = parseFloat(priceText);
            if (ticker && !isNaN(priceArs)) {
                results.push({ ticker, priceArs });
            }
        });
        console.log(`Scraped ${results.length} tickers from IOL`);
        // Guardar/Actualizar en la base de datos
        for (const item of results) {
            // 1. Asegurar que el activo existe
            await db.run('INSERT OR IGNORE INTO assets (ticker) VALUES (?)', [item.ticker]);
            const asset = await db.get('SELECT id FROM assets WHERE ticker = ?', [item.ticker]);
            if (asset) {
                // 2. Insertar precio actual (asumimos USD = 0 por ahora hasta calcular el CCL)
                await db.run('INSERT INTO prices (asset_id, date, price_ars, price_usd) VALUES (?, ?, ?, ?)', [asset.id, date, item.priceArs, 0]);
            }
        }
        return results;
    }
    catch (error) {
        console.error('Error scraping IOL:', error);
        throw error;
    }
}
