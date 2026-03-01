import { getDatabase } from './src/database.js';

async function debugJump() {
  const db = await getDatabase();
  
  const transactions = await db.all(`SELECT t.*, a.ticker FROM transactions t JOIN assets a ON t.asset_id = a.id ORDER BY t.date ASC, t.id ASC`);
  const prices = await db.all(`SELECT p.date, p.price_ars, a.ticker FROM prices p JOIN assets a ON p.asset_id = a.id ORDER BY p.date ASC`);
  const bnaPrices = await db.all(`SELECT date, sell_price FROM bna_dollar_prices ORDER BY date ASC`);

  const pricesByTicker = {};
  prices.forEach(p => {
    const date = p.date.split('T')[0];
    if (!pricesByTicker[p.ticker]) pricesByTicker[p.ticker] = [];
    pricesByTicker[p.ticker].push({ date, price: p.price_ars });
  });

  const bnaHistory = bnaPrices.map(p => ({ date: p.date.split('T')[0], price: p.sell_price }));
  const allDates = Array.from(new Set([...transactions.map(t => t.date), ...prices.map(p => p.date.split('T')[0]), ...bnaHistory.map(b => b.date)])).sort();

  const currentHoldings = {};
  const lastKnownArsPrices = {};
  let lastKnownBnaDollar = 1;
  let transactionIndex = 0;

  for (const date of allDates) {
    while (transactionIndex < transactions.length && transactions[transactionIndex].date <= date) {
      const t = transactions[transactionIndex];
      if (!currentHoldings[t.ticker]) currentHoldings[t.ticker] = 0;
      if (t.type === 'buy') currentHoldings[t.ticker] += t.quantity;
      else currentHoldings[t.ticker] -= t.quantity;
      if (t.unit_price_ars) lastKnownArsPrices[t.ticker] = t.unit_price_ars;
      if (t.dollar_rate) lastKnownBnaDollar = t.dollar_rate;
      transactionIndex++;
    }

    Object.keys(pricesByTicker).forEach(ticker => {
      const tickerPrices = pricesByTicker[ticker];
      let found = false;
      for (const p of tickerPrices) {
        if (p.date <= date) {
          lastKnownArsPrices[ticker] = p.price;
          found = true;
        } else break;
      }
    });

    for (const b of bnaHistory) {
      if (b.date <= date) lastKnownBnaDollar = b.price;
      else break;
    }

    if (date === '2026-02-25' || date === '2026-02-28') {
      let totalValueArs = 0;
      console.log(`
--- Details for ${date} ---`);
      console.log(`Dollar rate: ${lastKnownBnaDollar}`);
      Object.entries(currentHoldings).forEach(([ticker, quantity]) => {
        if (quantity > 0) {
          const price = lastKnownArsPrices[ticker] || 0;
          const valArs = quantity * price;
          totalValueArs += valArs;
          console.log(`${ticker}: ${quantity} units * $${price} = $${valArs}`);
        }
      });
      console.log(`TOTAL USD: ${totalValueArs / lastKnownBnaDollar}`);
    }
  }
}

debugJump().then(() => process.exit(0)).catch(console.error);
