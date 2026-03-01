import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDatabase } from '../database.js';

const BNA_URL = 'https://www.bna.com.ar/Personas';

export async function scrapeBNADollarPrice() {
  try {
    const { data } = await axios.get(BNA_URL);
    const $ = cheerio.load(data);
    const db = await getDatabase();
    const date = new Date().toISOString();

    // Selectores basados en la inspección de la página del BNA:
    // /table/tbody/tr[1]/td[2] para compra, /table/tbody/tr[1]/td[3] para venta
    const buyPriceText = $('table tbody tr:nth-child(1) td:nth-child(2)').text().trim().replace(',', '.');
    const sellPriceText = $('table tbody tr:nth-child(1) td:nth-child(3)').text().trim().replace(',', '.');

    const buyPrice = parseFloat(buyPriceText);
    const sellPrice = parseFloat(sellPriceText);

    if (isNaN(buyPrice) || isNaN(sellPrice)) {
      console.warn(`Could not parse BNA dollar prices. Raw text - Buy: ${buyPriceText}, Sell: ${sellPriceText}`);
      return null;
    }

    // Insertar en la tabla de historial del dólar BNA
    await db.run(
      'INSERT INTO bna_dollar_prices (date, buy_price, sell_price) VALUES (?, ?, ?)',
      [date, buyPrice, sellPrice]
    );

    console.log(`Scraped BNA dollar prices: Buy ${buyPrice}, Sell ${sellPrice}`);
    return { buyPrice, sellPrice };

  } catch (error) {
    console.error('Error scraping BNA dollar price:', error);
    return null;
  }
}
