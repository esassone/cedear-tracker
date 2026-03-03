import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface Opportunity {
  ticker: string;
  ccl: number;
  gap: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD' | 'NEUTRAL';
}

interface Props {
  ownedTickers: string[];
}

const ArbitrageOpportunities: React.FC<Props> = ({ ownedTickers }) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      const data = await api.getOpportunities();
      setOpportunities(data);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ marginBottom: '2rem', color: '#64748b' }}>Cargando análisis de arbitraje...</div>;

  // Mostramos los 50 más baratos (menor Gap) para asegurar que la lista sea scroleable y útil
  const topBuys = [...opportunities]
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 50);

  // Solo mostrar alertas de venta para los activos que el usuario posee
  const topSells = opportunities
    .filter(o => o.recommendation === 'SELL' && ownedTickers.includes(o.ticker))
    .sort((a, b) => b.gap - a.gap) 
    .slice(0, 10);

  return (
    <div className="arbitrage-section">
      <div 
        className="section-header-collapsible" 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={20} color="var(--primary)" />
          <h3 style={{ margin: 0 }}>Análisis de Arbitraje (GAP CCL)</h3>
        </div>
        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </div>

      {isExpanded && (
        <div className="opportunities-grid">
          <div className="opportunity-card buy">
            <h4>🚀 Mejores Compras (CCL Barato)</h4>
            <div className="scrollable-list">
              <table>
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>CCL</th>
                    <th>Desvío</th>
                  </tr>
                </thead>
                <tbody>
                  {topBuys.map(o => (
                    <tr key={o.ticker}>
                      <td>{o.ticker}</td>
                      <td>${o.ccl.toFixed(2)}</td>
                      <td className="gap-down">{o.gap.toFixed(2)}%</td>
                    </tr>
                  ))}
                  {topBuys.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8' }}>Sin oportunidades claras</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="opportunity-card sell">
            <h4>⚠️ Alertas de Venta (Tu Cartera)</h4>
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>CCL</th>
                  <th>Desvío</th>
                </tr>
              </thead>
              <tbody>
                {topSells.map(o => (
                  <tr key={o.ticker}>
                    <td>{o.ticker}</td>
                    <td>${o.ccl.toFixed(2)}</td>
                    <td className="gap-up">+{o.gap.toFixed(2)}%</td>
                  </tr>
                ))}
                {topSells.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8' }}>No hay alertas para tu cartera</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArbitrageOpportunities;
