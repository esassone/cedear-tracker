import { importTransactionsFromCSV } from './src/services/transactionImporter.js';

async function testImport() {
  const filePath = '/Users/esassone/projects/fpa/20260228 - Inversiones.csv';
  try {
    const result = await importTransactionsFromCSV(filePath);
    console.log('Import Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Import failed:', error);
  }
}

testImport();
