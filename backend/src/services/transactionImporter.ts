import fs from 'fs';
import { parse } from 'csv-parse';
import { getDatabase } from '../database.js';

interface RawTransaction {
  date: string;
  ticker: string;
  type: 'buy' | 'sell';
  quantity: number;
  price_ars: number;
  commission_ars?: number;
  owner?: string;
}

export async function importTransactionsFromCSV(filePath: string): Promise<{ imported: number; errors: string[] }> {
  const db = await getDatabase();
  const records: any[] = [];
  const errors: string[] = [];
  let importedCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true, // Handle Byte Order Mark
        delimiter: [',', ';'] // Soporta ambos delimitadores comunes
      }))
      .on('data', (record) => {
        records.push(record);
      })
      .on('end', async () => {
        console.log(`Starting bulk import of ${records.length} records...`);
        for (const record of records) {
          try {
            // Mapping & Validation
            const mapped = mapRecordToTransaction(record);
            console.log(`Importing record: ${mapped.ticker} on ${mapped.date}, quantity: ${mapped.quantity}`);
            
            if (!mapped.ticker || !mapped.date || isNaN(mapped.quantity) || mapped.quantity <= 0) {
              errors.push(`Invalid record: ${JSON.stringify(record)} (Mapped: ${JSON.stringify(mapped)})`);
              continue;
            }

            // Insert logic
            let asset = await db.get('SELECT id FROM assets WHERE ticker = ?', [mapped.ticker]);
            if (!asset) {
              console.log(`Creating new asset: ${mapped.ticker}`);
              const result = await db.run('INSERT INTO assets (ticker) VALUES (?)', [mapped.ticker]);
              asset = { id: result.lastID };
            }

            // Para importaciones, unit_price será price / quantity si no viene
            const unit_price = mapped.price_ars / mapped.quantity;

            // --- Lógica de autocompletado para importaciones masivas ---
            let finalDollarRate = mapped.dollar_rate || null;
            if (!finalDollarRate) {
              const dollarRow = await db.get(
                'SELECT sell_price FROM bna_dollar_prices WHERE date <= ? ORDER BY date DESC LIMIT 1',
                [mapped.date]
              );
              finalDollarRate = dollarRow?.sell_price || null;
            }

            let marketPriceRow = await db.get(
              'SELECT price_ars FROM prices WHERE asset_id = ? AND date(date) <= date(?) ORDER BY date DESC LIMIT 1',
              [asset.id, mapped.date]
            );

            if (!marketPriceRow) {
              marketPriceRow = await db.get(
                'SELECT price_ars FROM prices WHERE asset_id = ? ORDER BY date DESC LIMIT 1',
                [asset.id]
              );
            }
            const marketPriceArs = marketPriceRow?.price_ars || null;

            console.log(`Final insert values: ticker=${mapped.ticker}, date=${mapped.date}, dollarRate=${finalDollarRate}, marketPriceArs=${marketPriceArs}`);

            await db.run(
              `INSERT INTO transactions (asset_id, date, type, quantity, price_ars, unit_price_ars, market_price_ars, commission_ars, dollar_rate, owner) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                asset.id, 
                mapped.date, 
                mapped.type, 
                mapped.quantity, 
                mapped.price_ars, 
                unit_price,
                marketPriceArs,
                mapped.commission_ars || 0,
                finalDollarRate,
                mapped.owner?.slice(0, 10) || null
              ]
            );
            importedCount++;
          } catch (err: any) {
            console.error('Error importing row:', err);
            errors.push(`Error importing record ${JSON.stringify(record)}: ${err.message}`);
          }
        }
        console.log(`Bulk import finished. Total imported: ${importedCount}, Errors: ${errors.length}`);
        resolve({ imported: importedCount, errors });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

function mapRecordToTransaction(record: any): RawTransaction {
  // Normalizar claves a minúsculas
  const normalized: any = {};
  for (const key in record) {
    normalized[key.toLowerCase()] = record[key];
  }

  const date = normalized.fecha || normalized.date || normalized['fecha compra'];
  let ticker = normalized.especie || normalized.ticker || normalized.symbol || '';
  
  // Limpiar "ETF" del ticker si existe
  ticker = ticker.split(' ')[0].toUpperCase();

  const rawType = normalized.operación || normalized.operacion || normalized.type || '';
  // Si no se especifica operación, se asume compra si es del archivo de inversiones
  const type = (rawType.toLowerCase().includes('venta') || rawType.toLowerCase() === 'sell') ? 'sell' : 'buy';
  
  const cleanNumber = (val: string | number) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    // Quitar $, comas de miles, espacios
    return parseFloat(val.replace(/[$\s,]/g, '')) || 0;
  };

  const quantity = cleanNumber(normalized.cantidad || normalized.quantity || '0');
  const unitPrice = cleanNumber(normalized['precio unitario'] || normalized.precio || normalized.price || '0');
  const commission = cleanNumber(normalized.comision || normalized.comisión || normalized.commission_ars || '0');
  const dollarRate = cleanNumber(normalized['cotizacion dolar'] || normalized['cotización dólar'] || normalized.dollar_rate);
  const owner = normalized.owner || normalized.dueño || normalized.dueno;

  return {
    date: formatDate(date),
    ticker,
    type,
    quantity,
    price_ars: quantity * unitPrice,
    commission_ars: commission,
    dollar_rate: dollarRate || undefined,
    owner
  };
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  // Intentar parsear formatos comunes DD/MM/YYYY o YYYY-MM-DD
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return dateStr; // Asumir ISO o formato ya correcto
}
