import { scrapeIOL } from './src/services/scraper.ts';
import { getDatabase } from './src/database.ts';

async function runSync() {
  console.log('Starting manual sync...');
  await scrapeIOL();
  console.log('Manual sync completed.');
  process.exit(0);
}

runSync();
