import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
});

// Token automatisch meesturen
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → uitloggen
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pa_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
