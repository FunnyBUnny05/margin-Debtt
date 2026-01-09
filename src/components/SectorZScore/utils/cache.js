import { CACHE_TTL_MS } from '../constants';

const CACHE_KEY = 'sectorZScoreCache';

export const getCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return {};
    return JSON.parse(cached);
  } catch {
    return {};
  }
};

export const getCached = (key) => {
  const cache = getCache();
  const entry = cache[key];
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    // Expired, remove it
    delete cache[key];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    return null;
  }

  return entry.data;
};

export const setCache = (key, data) => {
  const cache = getCache();
  cache[key] = {
    data,
    timestamp: Date.now()
  };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // LocalStorage full, clear old entries
    console.warn('Cache storage full, clearing old entries');
    localStorage.removeItem(CACHE_KEY);
  }
};

export const clearCache = () => {
  localStorage.removeItem(CACHE_KEY);
};
