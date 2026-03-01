import axios from 'axios';
import * as cheerio from 'cheerio';

export async function getYahooFinancePrice(usTicker: string): Promise<number | null> {
  const YAHOO_FINANCE_URL = `https://finance.yahoo.com/quote/${usTicker}`;

  try {
    const { data } = await axios.get(YAHOO_FINANCE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(data);

    const priceSelectors = [
      `fin-streamer[data-symbol="${usTicker}"][data-field="regularMarketPrice"]`,
      'fin-streamer[data-field="regularMarketPrice"]',
      'div[data-test="qsp-price"] span.Fw\\(b\\)',
      '.livePrice span',
      '[data-test="qsp-price"]'
    ];

    let priceText = '';
    for (const selector of priceSelectors) {
      const elements = $(selector);
      // Si hay varios, intentar encontrar el que coincida con el symbol
      if (elements.length > 1) {
        elements.each((_, el) => {
          if ($(el).attr('data-symbol') === usTicker) {
            priceText = $(el).attr('value') || $(el).text().trim();
            return false;
          }
        });
      } else {
        priceText = elements.attr('value') || elements.text().trim();
      }
      if (priceText) break;
    }
    
    // Si no hay texto, o si el precio parece ser el de un índice (ej. S&P 500 es ~6800 y estamos buscando AAPL que es ~260)
    // Intentar buscar en los scripts de datos JSON
    if (!priceText || (priceText.includes('6,878') && usTicker !== '^GSPC')) {
      $('script').each((_, el) => {
        const content = $(el).text();
        // Usamos [\s\S] para que el punto coincida con saltos de línea
        if (content.includes('symbol') && content.includes(usTicker) && content.includes('regularMarketPrice')) {
          // Intentar una búsqueda más precisa dentro del JSON, manejando posibles escapes de comillas
          const regex = new RegExp(`[\\\\"]+symbol[\\\\"]+\\s*:\\s*[\\\\"]+${usTicker}[\\\\"]+[\\s\\S]*?[\\\\"]+regularMarketPrice[\\\\"]+\\s*:\\s*{\\s*[\\\\"]+raw[\\\\"]+\\s*:\\s*([\\d.]+)`);
          const match = content.match(regex);
          if (match) {
            priceText = match[1];
            return false;
          }
          // Caso alternativo: el precio viene antes que el symbol
          const regexRev = new RegExp(`[\\\\"]+regularMarketPrice[\\\\"]+\\s*:\\s*{\\s*[\\\\"]+raw[\\\\"]+\\s*:\\s*([\\d.]+)[\\s\\S]*?[\\\\"]+symbol[\\\\"]+\\s*:\\s*[\\\\"]+${usTicker}[\\\\"]+`);
          const matchRev = content.match(regexRev);
          if (matchRev) {
            priceText = matchRev[1];
            return false;
          }
        }
      });
    }

    const price = parseFloat(priceText.replace(/,/g, ''));


    if (isNaN(price)) {
      console.warn(`Could not parse price for ${usTicker}. Raw text: ${priceText}`);
      return null;
    }

    return price;

  } catch (error) {
    // Para errores 404, etc. de Yahoo Finance, solo loguear el warning
    if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
        console.warn(`Yahoo Finance Ticker not found for ${usTicker}.`);
    } else {
        console.error(`Error fetching price for ${usTicker} from Yahoo Finance:`, error);
    }
    return null;
  }
}

// Helper para convertir CEDEAR ticker a US ticker
export function getUsTicker(cedearTicker: string): string | null {
  // Eliminar sufijos 'C' o 'D' que indican variantes de CEDEAR (CCL, MEP)
  let baseTicker = cedearTicker.replace(/[CD]$/, '');
  // Eliminar sufijo 'ETF' que a veces aparece en IOL para ETFs (ej. SPY ETF -> SPY)
  baseTicker = baseTicker.replace(/ ETF$/, '');

  // Mapeos manuales para tickers con diferencias conocidas entre IOL y Yahoo Finance o nombres base
  const manualMapping: { [key: string]: string } = {
    // Comunes
    'BRKB': 'BRK-B', // Berkshire Hathaway (IOL usa BRKB, Yahoo usa BRK-B)
    'BABA': 'BABA', // Alibaba
    'GOOGL': 'GOOGL', // Google Class A
    'GOOG': 'GOOG', // Google Class C
    'MELI': 'MELI', // Mercado Libre
    'FB': 'META', // Facebook (Meta) - Ticker oficial en Yahoo es META
    'TSLA': 'TSLA', // Tesla
    'AAPL': 'AAPL', // Apple
    'AMZN': 'AMZN', // Amazon
    'MSFT': 'MSFT', // Microsoft
    'NVDA': 'NVDA', // Nvidia
    'KO': 'KO', // Coca-Cola
    'MMM': 'MMM', // 3M
    'ABT': 'ABT', // Abbott Labs
    'ABBV': 'ABBV', // AbbVie
    'ADBE': 'ADBE', // Adobe
    'XOM': 'XOM', // ExxonMobil
    'SPY': 'SPY', // SPDR S&P 500 ETF (Para este, el Comafi scraper podría capturarlo como "SPY ETF")
    'QQQ': 'QQQ', // Invesco QQQ Trust

    // Otros que suelen dar problemas o son de interes
    'DIA': 'DIA', // SPDR Dow Jones Industrial Average ETF
    'ARKK': 'ARKK', // ARK Innovation ETF
    'AMD': 'AMD', // Advanced Micro Devices
    'INTC': 'INTC', // Intel
    'PBR': 'PBR', // Petrobras SA
    'LVS': 'LVS', // Las Vegas Sands Corp.
    'MRK': 'MRK', // Merck & Co., Inc.
    'NKE': 'NKE', // Nike, Inc.
    'V': 'V', // Visa Inc.
    'WMT': 'WMT', // Walmart Inc.
    'BAC': 'BAC', // Bank of America Corp
    'JPM': 'JPM', // JPMorgan Chase & Co.
    'MS': 'MS', // Morgan Stanley
    'GS': 'GS', // Goldman Sachs Group Inc.
    'UNH': 'UNH', // UnitedHealth Group Incorporated
    'HD': 'HD', // The Home Depot, Inc.
    'CRM': 'CRM', // Salesforce, Inc.
    'BBD': 'BBD', // Banco Bradesco SA
    'ITUB': 'ITUB', // Itau Unibanco Holding SA
    'VALE': 'VALE', // Vale S.A.
    'XLP': 'XLP', // Consumer Staples Select Sector SPDR Fund
    'XLE': 'XLE', // Energy Select Sector SPDR Fund
    'XLF': 'XLF', // Financial Select Sector SPDR Fund
    'XLK': 'XLK', // Technology Select Sector SPDR Fund
    'XLV': 'XLV', // Health Care Select Sector SPDR Fund
    'XLY': 'XLY', // Consumer Discretionary Select Sector SPDR Fund
    'XLI': 'XLI', // Industrial Select Sector SPDR Fund
    'XLU': 'XLU', // Utilities Select Sector SPDR Fund
    'XLB': 'XLB', // Materials Select Sector SPDR Fund
    'XLRE': 'XLRE', // Real Estate Select Sector SPDR Fund
    // ... agregar más si es necesario
  };

  // Si existe un mapeo manual para el ticker base (sin sufijos C/D), usarlo
  if (manualMapping[baseTicker]) {
    return manualMapping[baseTicker];
  }

  // Si no se encuentra un mapeo manual, y el ticker base tiene longitud, usarlo directamente
  if (baseTicker.length > 0) {
    return baseTicker;
  }

  return null; // Si no podemos determinar un US Ticker válido
}
