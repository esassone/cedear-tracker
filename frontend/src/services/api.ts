import axios from 'axios';
import type { Asset, Transaction } from '../types';


const API_URL = 'http://localhost:3001/api';

export const api = {
  async getAssets(): Promise<Asset[]> {
    const response = await axios.get(`${API_URL}/assets`);
    return response.data;
  },

  async getAllAssets(): Promise<Asset[]> {
    const response = await axios.get(`${API_URL}/all-assets`);
    return response.data;
  },

  async getTransactions(): Promise<Transaction[]> {

    const response = await axios.get(`${API_URL}/transactions`);
    return response.data;
  },

  async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<void> {
    await axios.post(`${API_URL}/transactions`, transaction);
  },

  async updateTransaction(id: number, transaction: Omit<Transaction, 'id'>): Promise<void> {
    await axios.put(`${API_URL}/transactions/${id}`, transaction);
  },

  async deleteTransaction(id: number): Promise<void> {
    await axios.delete(`${API_URL}/transactions/${id}`);
  },

  async importTransactions(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post(`${API_URL}/transactions/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  async syncPrices(): Promise<any> {
    const response = await axios.post(`${API_URL}/sync-prices`);
    return response.data;
  },

  async getHistory(): Promise<{ date: string, value: number }[]> {
    const response = await axios.get(`${API_URL}/portfolio/history`);
    return response.data;
  },

  async getLatestDollar(): Promise<{ sell_price: number }> {
    const response = await axios.get(`${API_URL}/latest-dollar`);
    return response.data;
  },

  async getOpportunities(): Promise<any[]> {
    const response = await axios.get(`${API_URL}/portfolio/opportunities`);
    return response.data;
  }
};

