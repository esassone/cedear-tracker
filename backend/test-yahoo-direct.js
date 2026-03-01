import { getYahooFinancePrice } from './src/services/yahooScraper.ts';

async function test() {
  const tickers = ['AAPL', 'PG', 'MSFT', 'AAL'];
  for (const ticker of tickers) {
    const price = await getYahooFinancePrice(ticker);
    console.log(`${ticker}: ${price}`);
  }
}

test();
