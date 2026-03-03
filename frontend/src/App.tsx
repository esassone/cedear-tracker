import { useEffect, useState, useMemo } from 'react';
import { RefreshCw, Download, Plus, Trash2, TrendingUp, DollarSign, Briefcase, Edit2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts';
import { api } from './services/api';
import { usePortfolio } from './services/usePortfolio';
import TransactionForm from './components/TransactionForm';
import ArbitrageOpportunities from './components/ArbitrageOpportunities';
import type { Asset, Transaction } from './types';
import './App.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [history, setHistory] = useState<{ date: string, value: number }[]>([]);
  const [latestDollar, setLatestDollar] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOwner, setFilterOwner] = useState('');
  const [filterTicker, setFilterTicker] = useState('');
  const [filterType, setFilterType] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);

  const itemsPerPage = 10;

  // Aplicar filtros
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchOwner = !filterOwner || t.owner === filterOwner;
      const matchTicker = !filterTicker || t.ticker === filterTicker;
      const matchType = !filterType || t.type === filterType;
      return matchOwner && matchTicker && matchType;
    });
  }, [transactions, filterOwner, filterTicker, filterType]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  const fetchData = async () => {
    try {
      const [assetsData, transactionsData, historyData, dollarData] = await Promise.all([
        api.getAssets(),
        api.getTransactions(),
        api.getHistory(),
        api.getLatestDollar()
      ]);
      setAssets(assetsData);
      setTransactions(transactionsData);
      setHistory(historyData);
      setLatestDollar(dollarData.sell_price);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { items, summary } = usePortfolio(transactions, assets, latestDollar);

  // Resetear a la página 1 cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [filterOwner, filterTicker, filterType]);

  const uniqueOwners = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.owner).filter(Boolean))).sort();
  }, [transactions]);

  const uniqueTickers = useMemo(() => {
    return Array.from(new Set(transactions.map(t => t.ticker))).sort();
  }, [transactions]);

  const chartData = items.map(item => ({
    name: item.ticker,
    value: item.total_usd
  })).sort((a, b) => b.value - a.value);

  // Datos para el gráfico de Waterfall
  const waterfallData = useMemo(() => {
    const totalCost = summary.total_usd - summary.profit_usd;
    const data: any[] = [];
    
    // Ancla inicial: Inversión Total
    data.push({
      name: 'Invertido',
      value: [0, totalCost],
      display: totalCost,
      color: '#94a3b8'
    });

    let currentLevel = totalCost;
    
    // Buckets por activo (G/P)
    items.forEach(item => {
      const start = currentLevel;
      const end = currentLevel + item.profit_usd;
      data.push({
        name: item.ticker,
        value: [start, end],
        display: item.profit_usd,
        color: item.profit_usd >= 0 ? 'var(--success)' : 'var(--danger)'
      });
      currentLevel = end;
    });

    // Ancla final: Valor Actual
    data.push({
      name: 'Actual',
      value: [0, summary.total_usd],
      display: summary.total_usd,
      color: 'var(--primary)'
    });

    return data;
  }, [items, summary]);

  // Historial de precios de compra unitarios por ticker
  const purchaseHistoryData = useMemo(() => {
    const dates = Array.from(new Set(transactions.map(t => t.date))).sort();
    const tickers = Array.from(new Set(transactions.map(t => t.ticker)));
    
    return dates.map(date => {
      const entry: any = { date };
      tickers.forEach(ticker => {
        // Buscamos si hubo una compra de este ticker en esta fecha
        const tx = transactions.find(t => t.date === date && t.ticker === ticker && t.type === 'buy');
        if (tx) {
          const unitPriceUsd = (tx.unit_price_ars || tx.price_ars) / (tx.dollar_rate || 1);
          entry[ticker] = Number(unitPriceUsd.toFixed(2));
        }
      });
      return entry;
    }).filter(e => Object.keys(e).length > 1); // Solo fechas con alguna compra
  }, [transactions]);

  const allTickers = Array.from(new Set(transactions.map(t => t.ticker)));

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncPrices();
      await fetchData();
    } finally {
      setSyncing(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await api.importTransactions(file);
        await fetchData();
      } catch (error) {
        alert('Error importing file');
      }
    }
  };

  const handleDeleteTransaction = async (id: number) => {
    if (confirm('¿Eliminar esta transacción?')) {
      await api.deleteTransaction(id);
      await fetchData();
    }
  };

  const handleSaveTransaction = async (data: Omit<Transaction, 'id'>) => {
    if (editingTransaction) {
      await api.updateTransaction(editingTransaction.id, data);
    } else {
      await api.addTransaction(data);
    }
    await fetchData();
  };

  if (loading) return <div className="container">Cargando...</div>;

  return (
    <div className="container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Briefcase size={32} color="var(--primary)" />
          <h1>CEDEAR Tracker</h1>
        </div>
        <div className="controls">
          <button className="btn btn-primary" onClick={() => { setEditingTransaction(undefined); setIsModalOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nueva Transacción
          </button>
          <label className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <Download size={18} /> Importar CSV
            <input type="file" accept=".csv" hidden onChange={handleImport} />
          </label>
          <button className="btn btn-outline" onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      </header>

      <section className="summary-grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>Valor Total Cartera</h3>
            <Briefcase size={20} color="#64748b" />
          </div>
          <div className="value" style={{ marginBottom: '0.5rem' }}>
            U$S {summary.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Equivalente:</span>
              <span>${summary.total_ars.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ARS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Dólar BNA:</span>
              <span>${latestDollar.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>Ganancia/Pérdida (USD)</h3>
            <TrendingUp size={20} color={summary.profit_usd >= 0 ? 'var(--success)' : 'var(--danger)'} />
          </div>
          <div className={`value ${summary.profit_usd >= 0 ? 'profit-positive' : 'profit-negative'}`} style={{ marginBottom: '0.5rem' }}>
            {summary.profit_usd >= 0 ? '+' : ''}U$S {summary.profit_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SPY:</span>
              <span className={summary.spy_profit_usd >= 0 ? 'profit-positive' : 'profit-negative'}>
                {summary.spy_profit_usd >= 0 ? '+' : ''}U$S {summary.spy_profit_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Otros:</span>
              <span className={summary.others_profit_usd >= 0 ? 'profit-positive' : 'profit-negative'}>
                {summary.others_profit_usd >= 0 ? '+' : ''}U$S {summary.others_profit_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </section>

      <ArbitrageOpportunities ownedTickers={items.map(i => i.ticker)} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <section className="card" style={{ marginBottom: 0 }}>
          <h2>Evolución de la Cartera (USD)</h2>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `U$S ${value}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  name="Valor Actual"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
                <Line
                  type="stepAfter"
                  name="Invertido"
                  dataKey="invested"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 0 }}>
          <h2>Precio Compra CEDEARs (USD)</h2>
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={purchaseHistoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickFormatter={(value) => `U$S ${value}`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                />
                <Legend />
                {allTickers.map((ticker, index) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    connectNulls={true}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <section className="card" style={{ marginBottom: 0 }}>
          <h2>Distribución</h2>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined) => [value !== undefined ? `U$S ${value.toLocaleString()}` : '0', 'Valor']}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card" style={{ marginBottom: 0 }}>
          <h2>Inversión vs Valor Actual (USD)</h2>
          <div style={{ height: '350px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} tickFormatter={(val) => `U$S ${val}`} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  formatter={(value: any) => {
                    const val = Array.isArray(value) ? Math.abs(value[1] - value[0]) : value;
                    return [`U$S ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`];
                  }}
                />
                <Bar dataKey="value">
                  {waterfallData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginBottom: '2rem' }}>
        <h2>Mis Activos</h2>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Cantidad</th>
              <th>PPC (USD)</th>
              <th>Precio (USD)</th>
              <th>Total (USD)</th>
              <th>G/P %</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.ticker}>
                <td><strong>{item.ticker}</strong></td>
                <td>{item.quantity}</td>
                <td>U$S {item.avg_price_usd.toFixed(2)}</td>
                <td>U$S {item.current_price_usd.toFixed(2)}</td>
                <td>U$S {item.total_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className={item.profit_percent >= 0 ? 'profit-positive' : 'profit-negative'}>
                  {item.profit_percent >= 0 ? '+' : ''}{item.profit_percent.toFixed(2)}%
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No hay activos en la cartera</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>          <h2>Últimas Transacciones</h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select 
              className="btn btn-outline" 
              style={{ height: '38px', padding: '0 1rem' }}
              value={filterOwner} 
              onChange={(e) => setFilterOwner(e.target.value)}
            >
              <option value="">Todos los Owners</option>
              {uniqueOwners.map(owner => (
                <option key={owner} value={owner!}>{owner}</option>
              ))}
            </select>

            <select 
              className="btn btn-outline" 
              style={{ height: '38px', padding: '0 1rem' }}
              value={filterTicker} 
              onChange={(e) => setFilterTicker(e.target.value)}
            >
              <option value="">Todos los Activos</option>
              {uniqueTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>

            <select 
              className="btn btn-outline" 
              style={{ height: '38px', padding: '0 1rem' }}
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="">Todos los Tipos</option>
              <option value="buy">Compra</option>
              <option value="sell">Venta</option>
            </select>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Activo</th>
              <th>Tipo</th>
              <th>Fecha</th>
              <th>Cant.</th>
              <th>Precio Unit.</th>
              <th>CEDEAR hoy</th>
              <th>Monto Total</th>
              <th>Comisión</th>
              <th>Cotiz. Dólar</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentTransactions.map(t => (
              <tr key={t.id}>
                <td>{t.owner || '-'}</td>
                <td>{t.ticker}</td>
                <td style={{ color: t.type === 'buy' ? 'var(--success)' : 'var(--danger)' }}>
                  {t.type === 'buy' ? 'Compra' : 'Venta'}
                </td>
                <td>{t.date}</td>
                <td>{t.quantity}</td>
                <td>${(t.unit_price_ars || t.price_ars).toLocaleString('es-AR')}</td>
                <td>{t.market_price_ars ? `$${t.market_price_ars.toLocaleString('es-AR')}` : '-'}</td>
                <td>${t.price_ars.toLocaleString('es-AR')}</td>
                <td>${(t.commission_ars || 0).toLocaleString('es-AR')}</td>
                <td>{t.dollar_rate ? `U$S ${t.dollar_rate.toFixed(2)}` : '-'}</td>

                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>

                    <button onClick={() => { setEditingTransaction(t); setIsModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDeleteTransaction(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Página {currentPage} de {totalPages}
            </span>
            <button 
              className="btn btn-outline" 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </button>
          </div>
        )}
      </section>

      {isModalOpen && (
        <TransactionForm 
          transaction={editingTransaction}
          onSave={handleSaveTransaction}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}


export default App;

