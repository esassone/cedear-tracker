import { useMemo } from 'react';
import type { Transaction, Asset, PortfolioItem } from '../types';


export function usePortfolio(transactions: Transaction[], assets: Asset[], latestDollar: number) {
  const portfolio = useMemo(() => {
    const holdings: Record<string, { quantity: number; total_cost_ars: number; total_cost_usd: number }> = {};

    // 1. Calcular cantidades y precios promedio
    transactions.forEach(t => {
      if (!holdings[t.ticker]) {
        holdings[t.ticker] = { quantity: 0, total_cost_ars: 0, total_cost_usd: 0 };
      }

      const upArs = t.unit_price_ars || t.price_ars;
      const dollarRate = t.dollar_rate || 1;

      const txCostArs = (t.quantity * upArs) + t.commission_ars;
      const txCostUsd = txCostArs / dollarRate;

      if (t.type === 'buy') {
        holdings[t.ticker].quantity += t.quantity;
        holdings[t.ticker].total_cost_ars += txCostArs;
        holdings[t.ticker].total_cost_usd += txCostUsd;
      } else {
        const avg_cost_ars = holdings[t.ticker].total_cost_ars / holdings[t.ticker].quantity;
        const avg_cost_usd = holdings[t.ticker].total_cost_usd / holdings[t.ticker].quantity;
        
        holdings[t.ticker].quantity -= t.quantity;
        holdings[t.ticker].total_cost_ars -= (t.quantity * avg_cost_ars);
        holdings[t.ticker].total_cost_usd -= (t.quantity * avg_cost_usd);
      }
    });


    // 2. Cruzar con precios actuales
    const portfolioItems: PortfolioItem[] = Object.entries(holdings)
      .filter(([_, data]) => data.quantity > 0.000001)
      .map(([ticker, data]) => {
        const asset = assets.find(a => a.ticker === ticker);
        const current_price_ars = asset?.price_ars || 0;
        
        // VALOR DE LIQUIDACIÓN REAL: Precio ARS / Dólar Actual
        const current_price_usd = latestDollar > 0 ? current_price_ars / latestDollar : 0;
        
        const total_ars = (data.quantity || 0) * current_price_ars;
        const total_usd = latestDollar > 0 ? total_ars / latestDollar : 0;
        
        const avg_price_ars = data.quantity > 0 ? data.total_cost_ars / data.quantity : 0;
        const avg_price_usd = data.quantity > 0 ? data.total_cost_usd / data.quantity : 0;

        const profit_ars = total_ars - (data.total_cost_ars || 0);
        const profit_usd = total_usd - (data.total_cost_usd || 0);
        const profit_percent = data.total_cost_usd > 0 ? (profit_usd / data.total_cost_usd) * 100 : 0;

        return {
          ticker,
          quantity: data.quantity || 0,
          avg_price_ars,
          avg_price_usd,
          current_price_ars,
          current_price_usd,
          total_ars,
          total_usd,
          profit_ars,
          profit_usd,
          profit_percent
        };
      });

    const summary = portfolioItems.reduce(
      (acc, item) => ({
        total_ars: acc.total_ars + (item.total_ars || 0),
        total_usd: acc.total_usd + (item.total_usd || 0),
        profit_ars: acc.profit_ars + (item.profit_ars || 0),
        profit_usd: acc.profit_usd + (item.profit_usd || 0),
      }),
      { total_ars: 0, total_usd: 0, profit_ars: 0, profit_usd: 0 }
    );


    return { items: portfolioItems, summary };
  }, [transactions, assets]);

  return portfolio;
}
