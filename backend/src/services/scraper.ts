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

    // Obtener los tickers que tienen transacciones para priorizarlos
    const activeAssets = await db.all('SELECT DISTINCT a.ticker FROM transactions t JOIN assets a ON t.asset_id = a.id');
    const activeTickers = new Set(activeAssets.map(t => t.ticker));
    
    // Tickers clave para tener siempre actualizados
    const keyTickers = new Set(['SPY', 'QQQ', 'DIA', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'TSLA', 'AAPL', 'BRK-B', 'MELI']);
    
    // Cache para no pedir el mismo ticker a Yahoo Finance varias veces en el mismo scrape
    const yahooPriceCache = new Map<string, number | null>();
    
    // Obtener el dólar BNA más reciente para fallbacks
    const latestBNA = await db.get('SELECT sell_price FROM bna_dollar_prices ORDER BY date DESC LIMIT 1');
    const bnaRate = latestBNA?.sell_price || 0;

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
        // Fallback simple con dólar BNA si no podemos determinar ticker US
        if (bnaRate > 0) priceUsd = item.priceArs / bnaRate;
        
        await db.run(
          'INSERT INTO prices (asset_id, date, price_ars, price_usd) VALUES (?, ?, ?, ?)',
          [iolAsset.id, date, item.priceArs, priceUsd]
        );
        continue;
      }
      
      // Determinar si este ticker es "importante" para gastar una peticion a Yahoo
      const isImportant = activeTickers.has(item.ticker) || keyTickers.has(usTicker) || keyTickers.has(item.ticker);
      
      // Obtener el ratio del activo base (sin sufijo C/D)
      const baseAssetWithRatio = await db.get('SELECT ratio_ars_usd FROM assets WHERE ticker = ?', [usTicker]);

      if (isImportant && baseAssetWithRatio && baseAssetWithRatio.ratio_ars_usd && baseAssetWithRatio.ratio_ars_usd > 0) {
        // Usar cache o pedir a Yahoo
        let underlyingUsdPrice: number | null = null;
        if (yahooPriceCache.has(usTicker)) {
          underlyingUsdPrice = yahooPriceCache.get(usTicker)!;
        } else {
          // Agregar un pequeño delay para evitar bloqueos si hay muchos activos importantes
          if (yahooPriceCache.size > 0 && yahooPriceCache.size % 5 === 0) {
             await new Promise(resolve => setTimeout(resolve, 500));
          }
          underlyingUsdPrice = await getYahooFinancePrice(usTicker);
          yahooPriceCache.set(usTicker, underlyingUsdPrice);
        }

        if (underlyingUsdPrice !== null && underlyingUsdPrice > 0) {
          priceUsd = underlyingUsdPrice / baseAssetWithRatio.ratio_ars_usd;
        } else if (bnaRate > 0) {
          // Fallback a BNA si Yahoo falla
          priceUsd = item.priceArs / bnaRate;
        }
      } else if (bnaRate > 0) {
        // Para activos no importantes, usamos el dólar BNA para estimar el precio USD
        // y así no saturamos Yahoo Finance.
        priceUsd = item.priceArs / bnaRate;
      }
      
      // Insertar precio actual
      await db.run(
        'INSERT INTO prices (asset_id, date, price_ars, price_usd) VALUES (?, ?, ?, ?)',
        [iolAsset.id, date, item.priceArs, priceUsd]
      );
    }


    return results;
  } catch (error) {
    console.error('Error scraping IOL:', error);
    throw error;
  }
}
