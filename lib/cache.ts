
type CacheEntry<T> = {
  value: T;
  expiry: number;
};

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Set a value in the cache
   * @param key The cache key
   * @param value The value to store
   * @param ttlSeconds Time to live in seconds (default 60s)
   */
  set<T>(key: string, value: T, ttlSeconds: number = 60): void {
    const expiry = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { value, expiry });
  }

  /**
   * Get a value from the cache
   * @param key The cache key
   * @returns The value or null if not found/expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Delete a value from the cache
   * @param key The cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get a value from cache or compute it if missing
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number = 60
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

export const globalCache = new MemoryCache();
