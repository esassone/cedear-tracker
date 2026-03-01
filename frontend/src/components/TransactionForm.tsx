import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';
import type { Transaction, Asset } from '../types';

interface TransactionFormProps {
  transaction?: Transaction;
  onSave: (data: Omit<Transaction, 'id'>) => Promise<void>;
  onClose: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ transaction, onSave, onClose }) => {
  const [allAssets, setAllAssets] = useState<Asset[]>([]);
  const [formData, setFormData] = useState<Omit<Transaction, 'id'>>({
    date: new Date().toISOString().split('T')[0],
    ticker: '',
    type: 'buy',
    quantity: 0,
    price_ars: 0,
    unit_price_ars: 0,
    commission_ars: 0,
    dollar_rate: 0,
    owner: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const assets = await api.getAllAssets();
        setAllAssets(assets.sort((a, b) => a.ticker.localeCompare(b.ticker)));
      } catch (error) {
        console.error('Error fetching assets for form:', error);
      }
    };
    fetchAssets();
  }, []);

  useEffect(() => {
    if (transaction) {
      setFormData({
        date: transaction.date.split('T')[0],
        ticker: transaction.ticker,
        type: transaction.type,
        quantity: transaction.quantity,
        price_ars: transaction.price_ars,
        unit_price_ars: transaction.unit_price_ars || transaction.price_ars,
        commission_ars: transaction.commission_ars,
        dollar_rate: transaction.dollar_rate || 0,
        owner: transaction.owner || '',
      });
    }
  }, [transaction]);

  // Auto-calculate total price
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      price_ars: (prev.quantity || 0) * (prev.unit_price_ars || 0)
    }));
  }, [formData.quantity, formData.unit_price_ars]);







  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      alert('Error al guardar la transacción');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2>{transaction ? 'Editar Transacción' : 'Nueva Transacción'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={24} color="#64748b" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Ticker</label>
              <select 
                name="ticker" 
                value={formData.ticker} 
                onChange={handleChange} 
                required 
                disabled={!!transaction}
              >
                <option value="">Seleccione un activo...</option>
                {allAssets.map(asset => (
                  <option key={asset.ticker} value={asset.ticker}>
                    {asset.ticker}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">

              <label>Fecha</label>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleChange} 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Operación</label>
              <select name="type" value={formData.type} onChange={handleChange}>
                <option value="buy">Compra</option>
                <option value="sell">Venta</option>
              </select>
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input 
                type="number" 
                name="quantity" 
                value={formData.quantity} 
                onChange={handleChange} 
                step="any" 
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Precio Unit. (ARS)</label>
              <input 
                type="number" 
                name="unit_price_ars" 
                value={formData.unit_price_ars} 
                onChange={handleChange} 
                step="any" 
                required
              />
            </div>
            <div className="form-group">
              <label>Monto Total (ARS) [Auto]</label>
              <input 
                type="number" 
                name="price_ars" 
                value={formData.price_ars} 
                readOnly
                style={{ background: '#f8fafc', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label>Comisión (ARS)</label>
              <input 
                type="number" 
                name="commission_ars" 
                value={formData.commission_ars} 
                onChange={handleChange} 
                step="any" 
              />
            </div>
            <div className="form-group">
              <label>Dueño (Owner)</label>
              <input 
                name="owner" 
                value={formData.owner || ''} 
                onChange={handleChange} 
                maxLength={10} 
                placeholder="Nombre (máx. 10 caracteres)" 
              />
            </div>
          </div>




          <div className="form-actions">

            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Guardando...' : (transaction ? 'Actualizar' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
