import axios from 'axios';
import * as cheerio from 'cheerio';
import { getDatabase } from '../database.js';
import { getUsTicker, getYahooFinancePrice } from './yahooScraper.js';

const IOL_URL = 'https://iol.invertironline.com/mercado/cotizaciones/argentina/cedears/todos';

export async function scrapeIOL() {
  try {
    const { data } = await axios.get(IOL_URL);
    const $ = cheerio.load(data);
    const db = await getDatabase();
    const date = new Date().toISOString();

    const results: any[] = [];

    $('#cotizaciones tbody tr').each((_, element) => {
      const row = $(element);
      const rawTicker = row.find('td:nth-child(1) a').text().trim();
      // El ticker suele ser la primera palabra (ej: "AAPL Cedear Apple Inc." -> "AAPL")
      const ticker = rawTicker.split(/\s+/)[0];
      const priceText = row.find('td:nth-child(2)').text().trim().replace(/\./g, '').replace(',', '.');
      const priceArs = parseFloat(priceText);

      if (ticker && !isNaN(priceArs)) {
        results.push({ ticker, priceArs });
      }
    });


    console.log(`Scraped ${results.length} tickers from IOL`);

    for (const item of results) {
      // 1. Asegurar que el activo existe para el ticker de IOL (con sufijo)
      await db.run(
        'INSERT OR IGNORE INTO assets (ticker) VALUES (?)',
        [item.ticker]
      );

      // Obtener el ID del activo del ticker de IOL (para almacenar en 'prices')
      const iolAsset = await db.get('SELECT id FROM assets WHERE ticker = ?', [item.ticker]);

      if (!iolAsset || !iolAsset.id) {
        console.warn(`Could not find asset ID for CEDEAR: ${item.ticker}. Skipping price insert.`);
        continue;
      }

      const usTicker = getUsTicker(item.ticker); // Obtener el ticker de Yahoo Finance
      let priceUsd = 0; // Por defecto

      if (!usTicker) {
        console.warn(`Could not determine US Ticker for CEDEAR: ${item.ticker}, cannot calculate USD price.`);
        await db.run(
          'INSERT INTO prices (asset_id, date, price_ars, price_usd) VALUES (?, ?, ?, ?)',
          [iolAsset.id, date, item.priceArs, priceUsd] // Guardar ARS, USD como 0
        );
        continue;
      }
      
      // Obtener el ratio del activo base (sin sufijo C/D)
      const baseAssetWithRatio = await db.get('SELECT ratio_ars_usd FROM assets WHERE ticker = ?', [usTicker]);

      if (baseAssetWithRatio && baseAssetWithRatio.ratio_ars_usd && baseAssetWithRatio.ratio_ars_usd > 0) {
        const underlyingUsdPrice = await getYahooFinancePrice(usTicker);
        if (underlyingUsdPrice !== null && underlyingUsdPrice > 0) {
          priceUsd = underlyingUsdPrice / baseAssetWithRatio.ratio_ars_usd;
        } else {
          console.warn(`Could not get underlying USD price for ${usTicker} (CEDEAR: ${item.ticker})`);
          // Fallback: Usar dólar BNA para estimar si Yahoo falla
          const latestBNA = await db.get('SELECT sell_price FROM bna_dollar_prices ORDER BY date DESC LIMIT 1');
          if (latestBNA && latestBNA.sell_price > 0) {
            priceUsd = item.priceArs / latestBNA.sell_price;
          }
        }
        
        // Insertar precio actual (ARS y USD)
        await db.run(
          'INSERT INTO prices (asset_id, date, price_ars, price_usd) VALUES (?, ?, ?, ?)',
          [iolAsset.id, date, item.priceArs, priceUsd]
        );
      } else {
        console.warn(`Missing ratio for base ticker ${usTicker} (CEDEAR: ${item.ticker}), cannot calculate USD price.`);
        // Fallback: Usar dólar BNA para estimar si no hay ratio
        const latestBNA = await db.get('SELECT sell_price FROM bna_dollar_prices ORDER BY date DESC LIMIT 1');
        let estimatedPriceUsd = 0;
        if (latestBNA && latestBNA.sell_price > 0) {
          estimatedPriceUsd = item.priceArs / latestBNA.sell_price;
        }
        
        await db.run(
          'INSERT INTO prices (asset_id, date, price_ars, price_usd) VALUES (?, ?, ?, ?)',
          [iolAsset.id, date, item.priceArs, estimatedPriceUsd]
        );
      }
    }


    return results;
  } catch (error) {
    console.error('Error scraping IOL:', error);
    throw error;
  }
}
