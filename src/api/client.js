/**
 * Unified API Client for Netlify Functions
 */

const BASE_URL = '/.netlify/functions';

export async function apiRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok || !data.success) {
      const error = new Error(data.message || `Request failed with status ${response.status}`);
      error.errorCode = data.errorCode;
      error.status = response.status;
      error.details = data.details;
      throw error;
    }

    return data.data;
  } catch (err) {
    if (!err.status && err.name === 'TypeError') {
      // Network connectivity or dev proxy failure
      const fallbackErr = new Error('Cannot connect to server API. Check Netlify Functions or network.');
      fallbackErr.errorCode = 'NETWORK_ERROR';
      throw fallbackErr;
    }
    throw err;
  }
}

export const api = {
  login: (credentials) => apiRequest('/login', { method: 'POST', body: credentials }),
  getDashboard: () => apiRequest('/dashboard'),
  getTransactions: (params = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, v);
      }
    });
    return apiRequest(`/transactions?${searchParams.toString()}`);
  },
  createTransaction: (txData) => apiRequest('/transactions', { method: 'POST', body: txData }),
  getTransaction: (id) => apiRequest(`/transaction?id=${id}`),
  updateTransaction: (id, txData) => apiRequest(`/transaction?id=${id}`, { method: 'PUT', body: txData }),
  syncTransaction: (payload) => apiRequest('/tally-sync', { method: 'POST', body: payload }),
  retrySync: (transactionId) => apiRequest('/tally-retry', { method: 'POST', body: { transactionId } }),
  getTallyStatus: () => apiRequest('/tally-status'),
  getMasters: () => apiRequest('/masters'),
  createMaster: (data) => apiRequest('/masters', { method: 'POST', body: data }),
  getSettings: () => apiRequest('/settings'),
  saveSettings: (payload) => apiRequest('/settings', { method: 'POST', body: payload }),
};
