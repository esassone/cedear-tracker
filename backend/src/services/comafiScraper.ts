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


      // Extraer el número del ratio (ej. "20 : 1" -> 20)
      const ratioMatch = ratioText.match(/(\d+)\s*:\s*1/);
      if (ticker && ratioMatch && ratioMatch[1]) {
        const ratio = parseInt(ratioMatch[1], 10);
        ratios.push({ ticker, ratio });
      }
    });

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
