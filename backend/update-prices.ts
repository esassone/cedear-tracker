import { getDatabase } from './src/database.js';

async function updateExistingTransactions() {
  const db = await getDatabase();
  const transactions = await db.all('SELECT * FROM transactions WHERE market_price_ars IS NULL');
  console.log(`Updating ${transactions.length} transactions...`);
  
  for (const t of transactions) {
    let marketPriceRow = await db.get(
      'SELECT price_ars FROM prices WHERE asset_id = ? AND date(date) <= date(?) ORDER BY date DESC LIMIT 1',
      [t.asset_id, t.date]
    );
    
    if (!marketPriceRow) {
      marketPriceRow = await db.get(
        'SELECT price_ars FROM prices WHERE asset_id = ? ORDER BY date DESC LIMIT 1',
        [t.asset_id]
      );
    }

    if (marketPriceRow) {
      await db.run('UPDATE transactions SET market_price_ars = ? WHERE id = ?', [marketPriceRow.price_ars, t.id]);
      console.log(`Updated transaction ${t.id} with price ${marketPriceRow.price_ars}`);
    } else {
      console.log(`No price found for asset ${t.asset_id}`);
    }
  }
}

updateExistingTransactions().then(() => {
  console.log('Update complete');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
