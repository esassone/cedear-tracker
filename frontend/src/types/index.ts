export interface Asset {
  ticker: string;
  name?: string;
  ratio_ars_usd?: number;
  price_ars: number;
  price_usd: number;
  date: string;
}

export interface Transaction {
  id: number;
  date: string;
  type: 'buy' | 'sell';
  quantity: number;
  price_ars: number;
  unit_price_ars?: number;
  market_price_ars?: number | null;
  commission_ars: number;
  dollar_rate?: number | null;
  owner?: string | null;
  ticker: string;
  name?: string;
}

export interface PortfolioItem {
  ticker: string;
  quantity: number;
  avg_price_ars: number;
  avg_price_usd: number;
  current_price_ars: number;
  current_price_usd: number;
  total_ars: number;
  total_usd: number;
  profit_ars: number;
  profit_usd: number;
  profit_percent: number;
}
