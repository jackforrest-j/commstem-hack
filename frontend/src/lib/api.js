/**
 * API client — all calls to your backend go through here.
 * The Vite proxy forwards /api/* to http://localhost:3001 in dev.
 *
 * Usage:
 *   import api from '../lib/api';
 *   const items = await api.get('/items');
 *   const newItem = await api.post('/items', { title: 'My item' });
 */

import { supabase } from './supabase';

// In dev, Vite proxies /api → localhost:3001. In production, point at Railway.
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

async function request(method, path, body) {
  // Attach auth token if the user is logged in
  const { data: { session } } = await supabase.auth.getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}

const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
};

export default api;
