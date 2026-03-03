import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDatabase } from '../database.js';

const COMAFI_URL = 'https://www.comafi.com.ar/2254-CEDEARS.note.aspx';

export async function scrapeComafiRatios() {
  try {
    const { data } = await axios.get(COMAFI_URL);
    const $ = cheerio.load(data);
    const db = await getDatabase();

    const ratios: { ticker: string; ratio: number }[] = [];

    // Buscamos las filas de la tabla de CEDEARs
    // Nota: El selector puede necesitar ajustes dependiendo de la estructura exacta de Comafi
    // Se asume una tabla con filas y celdas donde el ticker y el ratio están en columnas específicas.
    // Necesitamos inspeccionar la estructura HTML para obtener los selectores correctos.
    // Por ahora, usaré selectores genéricos y ajustaré después de una inspección.
    $('table tbody tr').each((_, element) => {
      const row = $(element);
      const rawTicker = row.find('td:nth-child(3)').text().trim();
      const ticker = rawTicker.split(/\s+/)[0];
      const ratioText = row.find('td:nth-child(8)').text().trim(); // Ratio es la 8va columna

      // Extraer el número del ratio (ej. "20 : 1" -> 20, "1 : 2" -> 0.5)
      const ratioMatch = ratioText.match(/(\d+)\s*:\s*(\d+)/);
      if (ticker && ratioMatch) {
        const x = parseInt(ratioMatch[1], 10);
        const y = parseInt(ratioMatch[2], 10);
        const ratio = x / y;
        ratios.push({ ticker, ratio });
      }
    });

    // Forzar los tickers manuales para asegurar que sean correctos (prioridad sobre el scrape)
    const manualFallbacks: { [key: string]: number } = {
      'AAPL': 10,
      'GOOGL': 58,
      'MSFT': 30,
      'NVDA': 48,
      'AMZN': 144,
      'META': 24,
      'TSLA': 15,
      'KO': 5,
      'AAL': 1,
      'MELI': 120,
      'BABA': 9,
      'PBR': 1,
      'SPY': 40,
      'QQQ': 40,
      'DIA': 40,
    };

    for (const ticker of Object.keys(manualFallbacks)) {
      const existingIndex = ratios.findIndex(r => r.ticker === ticker);
      if (existingIndex !== -1) {
        ratios[existingIndex].ratio = manualFallbacks[ticker];
      } else {
        ratios.push({ ticker, ratio: manualFallbacks[ticker] });
      }
    }

    console.log(`Scraped ${ratios.length} ratios from Comafi`);

    for (const item of ratios) {
      // Asegurar que el activo existe y actualizar el ratio
      await db.run(
        'INSERT OR IGNORE INTO assets (ticker) VALUES (?)',
        [item.ticker]
      );
      await db.run(
        'UPDATE assets SET ratio_ars_usd = ? WHERE ticker = ?',
        [item.ratio, item.ticker]
      );
    }

    return ratios;
  } catch (error) {
    console.error('Error scraping Comafi ratios:', error);
    throw error;
  }
}
