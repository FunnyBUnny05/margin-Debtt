import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getCache, getCached, setCache, clearCache } from './cache';

describe('Cache Utilities', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getCache', () => {
    it('should return empty object when cache is empty', () => {
      localStorage.getItem.mockReturnValue(null);
      const result = getCache();
      expect(result).toEqual({});
    });

    it('should return parsed cache data', () => {
      const mockCache = { key1: { data: 'value1', timestamp: Date.now() } };
      localStorage.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getCache();
      expect(result).toEqual(mockCache);
    });

    it('should return empty object when localStorage throws error', () => {
      localStorage.getItem.mockImplementation(() => {
        throw new Error('LocalStorage unavailable');
      });

      const result = getCache();
      expect(result).toEqual({});
    });

    it('should return empty object when JSON is invalid', () => {
      localStorage.getItem.mockReturnValue('invalid json{');

      const result = getCache();
      expect(result).toEqual({});
    });
  });

  describe('getCached', () => {
    it('should return null when key does not exist', () => {
      localStorage.getItem.mockReturnValue(JSON.stringify({}));

      const result = getCached('nonexistent');
      expect(result).toBeNull();
    });

    it('should return cached data when valid and not expired', () => {
      const mockData = { foo: 'bar' };
      const mockCache = {
        myKey: {
          data: mockData,
          timestamp: Date.now() - 1000 // 1 second ago
        }
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(mockCache));

      const result = getCached('myKey');
      expect(result).toEqual(mockData);
    });

    it('should return null and remove expired cache entries', () => {
      const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
      const mockCache = {
        expiredKey: {
          data: { foo: 'bar' },
          timestamp: Date.now() - CACHE_TTL_MS - 1000 // Expired
        }
      };

      let currentCache = JSON.stringify(mockCache);
      localStorage.getItem.mockImplementation(() => currentCache);
      localStorage.setItem.mockImplementation((key, value) => {
        currentCache = value;
      });

      const result = getCached('expiredKey');
      expect(result).toBeNull();
      expect(localStorage.setItem).toHaveBeenCalled();

      // Verify the key was removed
      const updatedCache = JSON.parse(currentCache);
      expect(updatedCache.expiredKey).toBeUndefined();
    });

    it('should handle corrupted cache gracefully', () => {
      localStorage.getItem.mockReturnValue('corrupted');

      const result = getCached('anyKey');
      expect(result).toBeNull();
    });
  });

  describe('setCache', () => {
    it('should store data with timestamp', () => {
      const mockData = { test: 'data' };
      localStorage.getItem.mockReturnValue(JSON.stringify({}));

      const beforeTime = Date.now();
      setCache('testKey', mockData);
      const afterTime = Date.now();

      expect(localStorage.setItem).toHaveBeenCalled();
      const setCall = localStorage.setItem.mock.calls[0];
      expect(setCall[0]).toBe('sectorZScoreCache');

      const storedCache = JSON.parse(setCall[1]);
      expect(storedCache.testKey.data).toEqual(mockData);
      expect(storedCache.testKey.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(storedCache.testKey.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should merge with existing cache', () => {
      const existingCache = {
        existingKey: { data: 'existing', timestamp: 123456 }
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCache));

      setCache('newKey', { new: 'data' });

      const setCall = localStorage.setItem.mock.calls[0];
      const storedCache = JSON.parse(setCall[1]);

      expect(storedCache.existingKey).toBeDefined();
      expect(storedCache.newKey).toBeDefined();
    });

    it('should handle localStorage quota exceeded error', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      localStorage.getItem.mockReturnValue(JSON.stringify({}));
      localStorage.setItem.mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      setCache('testKey', { data: 'test' });

      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Cache storage full'));
      expect(localStorage.removeItem).toHaveBeenCalledWith('sectorZScoreCache');

      consoleWarnSpy.mockRestore();
    });

    it('should overwrite existing key', () => {
      const existingCache = {
        myKey: { data: 'old', timestamp: 123 }
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(existingCache));

      setCache('myKey', { data: 'new' });

      const setCall = localStorage.setItem.mock.calls[0];
      const storedCache = JSON.parse(setCall[1]);

      expect(storedCache.myKey.data).toEqual({ data: 'new' });
      expect(storedCache.myKey.timestamp).not.toBe(123);
    });
  });

  describe('clearCache', () => {
    it('should remove cache from localStorage', () => {
      clearCache();

      expect(localStorage.removeItem).toHaveBeenCalledWith('sectorZScoreCache');
    });

    it('should handle multiple clears without error', () => {
      clearCache();
      clearCache();

      expect(localStorage.removeItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration scenarios', () => {
    it('should support complete cache lifecycle', () => {
      let storage = {};

      localStorage.getItem.mockImplementation((key) => storage[key] || null);
      localStorage.setItem.mockImplementation((key, value) => {
        storage[key] = value;
      });
      localStorage.removeItem.mockImplementation((key) => {
        delete storage[key];
      });

      // Set data
      setCache('user1', { name: 'John' });

      // Retrieve data
      let result = getCached('user1');
      expect(result).toEqual({ name: 'John' });

      // Clear cache
      clearCache();

      // Verify cleared
      result = getCached('user1');
      expect(result).toBeNull();
    });

    it('should handle concurrent cache operations', () => {
      let storage = {};

      localStorage.getItem.mockImplementation((key) => storage[key] || null);
      localStorage.setItem.mockImplementation((key, value) => {
        storage[key] = value;
      });

      setCache('key1', { value: 1 });
      setCache('key2', { value: 2 });
      setCache('key3', { value: 3 });

      const cache = JSON.parse(storage['sectorZScoreCache']);
      expect(Object.keys(cache)).toHaveLength(3);
      expect(getCached('key2')).toEqual({ value: 2 });
    });
  });
});
