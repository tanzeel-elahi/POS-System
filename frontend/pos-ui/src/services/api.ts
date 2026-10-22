import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

const client = axios.create({ baseURL: API_URL, timeout: 30000 });

// Attach token once auth exists. Add refresh handling here later (same pattern as the CRM project).
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
