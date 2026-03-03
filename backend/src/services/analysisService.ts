import { getDatabase } from '../database.js';

export interface AssetOpportunity {
  ticker: string;
  price_ars: number;
  price_usd_cedear: number;
  ccl: number;
  gap: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL';
}

export async function getArbitrageOpportunities(): Promise<AssetOpportunity[]> {
  const db = await getDatabase();
  const dateLimit = new Date();
  dateLimit.setDate(dateLimit.getDate() - 7); // Últimos 7 días
  const dateStr = dateLimit.toISOString();

  // 1. Calcular el Market CCL de referencia usando activos muy líquidos y estables
  const referenceTickers = ['AAPL', 'MSFT', 'GOOGL', 'KO'];
  const refCCLValues: number[] = [];

  for (const ticker of referenceTickers) {
    const prices = await db.get(`
      SELECT p.price_ars, p.price_usd 
      FROM prices p 
      JOIN assets a ON p.asset_id = a.id 
      WHERE a.ticker = ? AND p.price_usd > 0
      ORDER BY p.date DESC LIMIT 1
    `, [ticker]);

    if (prices) {
      refCCLValues.push(prices.price_ars / prices.price_usd);
    }
  }

  if (refCCLValues.length === 0) return [];

  const marketCcl = refCCLValues.reduce((a, b) => a + b, 0) / refCCLValues.length;

  // 2. Obtener precios actuales de todos los activos
  const allPrices = await db.all(`
    SELECT a.ticker, p.price_ars, p.price_usd 
    FROM prices p 
    JOIN assets a ON p.asset_id = a.id 
    WHERE p.date > ? AND p.price_usd > 0
    GROUP BY a.ticker
    ORDER BY p.date DESC
  `, [dateStr]);

  // 3. Calcular Gaps y filtrar basura (ej. CCLs imposibles)
  const opportunities: AssetOpportunity[] = allPrices
    .map(p => {
      const ccl = p.price_ars / p.price_usd;
      const gap = ((ccl / marketCcl) - 1) * 100;
      
      let recommendation: any = 'NEUTRAL';
      if (gap < -3) recommendation = 'BUY';
      else if (gap > 3) recommendation = 'SELL';
      else if (gap < -1.5) recommendation = 'HOLD'; // Atractivo para mantener o acumular lento

      return {
        ticker: p.ticker,
        price_ars: p.price_ars,
        price_usd_cedear: p.price_usd,
        ccl: ccl,
        gap: gap,
        recommendation
      };
    })
    .filter(o => o.ccl > 500 && o.ccl < 5000) // Filtrar errores de ratios o datos
    .sort((a, b) => a.gap - b.gap);

  return opportunities;
}
