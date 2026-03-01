import { getDatabase } from './src/database.js';

async function debugHistory() {
  const db = await getDatabase();
  
  const transactions = await db.all(`
    SELECT t.*, a.ticker 
    FROM transactions t 
    JOIN assets a ON t.asset_id = a.id 
    ORDER BY t.date ASC, t.id ASC
  `);
  
  const prices = await db.all(`
    SELECT p.date, p.price_usd, a.ticker 
    FROM prices p 
    JOIN assets a ON p.asset_id = a.id 
    ORDER BY p.date ASC
  `);

  console.log('Total transactions:', transactions.length);
  console.log('Total price records:', prices.length);

  const transactionDates = transactions.map(t => t.date.split('T')[0]);
  const priceDates = prices.map(p => p.date.split('T')[0]);
  const allDates = Array.from(new Set([...transactionDates, ...priceDates])).sort();

  console.log('All relevant dates:', allDates);

  const pricesByTicker = {};
  prices.forEach(p => {
    const date = p.date.split('T')[0];
    if (!pricesByTicker[p.ticker]) pricesByTicker[p.ticker] = [];
    pricesByTicker[p.ticker].push({ date, price: p.price_usd });
  });

  const history = [];
  const currentHoldings = {};
  const lastKnownPrices = {};
  let transactionIndex = 0;

  allDates.forEach(date => {
    while (transactionIndex < transactions.length && transactions[transactionIndex].date <= date) {
      const t = transactions[transactionIndex];
      if (!currentHoldings[t.ticker]) currentHoldings[t.ticker] = 0;
      if (t.type === 'buy') currentHoldings[t.ticker] += t.quantity;
      else currentHoldings[t.ticker] -= t.quantity;

      if (t.unit_price_ars && t.dollar_rate) {
        lastKnownPrices[t.ticker] = t.unit_price_ars / t.dollar_rate;
      }
      transactionIndex++;
    }

    let totalValue = 0;
    Object.entries(currentHoldings).forEach(([ticker, quantity]) => {
      if (quantity > 0.000001) {
        const tickerPrices = pricesByTicker[ticker] || [];
        let currentPrice = 0;
        for (const p of tickerPrices) {
          if (p.date <= date) currentPrice = p.price;
          else break;
        }
        if (currentPrice === 0) {
          currentPrice = lastKnownPrices[ticker] || 0;
        }
        totalValue += quantity * currentPrice;
      }
    });

    if (totalValue > 0) {
      history.push({ date, value: totalValue });
    }
  });

  console.log('Generated history points:', history.length);
  if (history.length > 0) {
    console.log('First point:', history[0]);
    console.log('Last point:', history[history.length - 1]);
  }
}

debugHistory().then(() => process.exit(0)).catch(console.error);
