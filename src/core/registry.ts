// ============================================================
// ClrX — Cleaner Registry
// ============================================================
import type { Cleaner } from '../types/cleaner.js';

/**
 * Central registry of all ClrX cleaners.
 * Cleaners register themselves here during module initialization.
 */
class CleanerRegistry {
  private readonly cleaners = new Map<string, Cleaner>();

  /**
   * Register a cleaner. Throws if a cleaner with the same id is already registered.
   */
  register(cleaner: Cleaner): void {
    if (this.cleaners.has(cleaner.id)) {
      throw new Error(`Cleaner with id "${cleaner.id}" is already registered.`);
    }
    this.cleaners.set(cleaner.id, cleaner);
  }

  /**
   * Get a cleaner by id. Returns undefined if not found.
   */
  get(id: string): Cleaner | undefined {
    return this.cleaners.get(id);
  }

  /**
   * Get all registered cleaners in registration order.
   */
  getAll(): Cleaner[] {
    return Array.from(this.cleaners.values());
  }

  /**
   * Get cleaners by ids. Throws if any id is not found.
   */
  getMany(ids: string[]): Cleaner[] {
    return ids.map((id) => {
      const c = this.cleaners.get(id);
      if (!c) throw new Error(`Unknown cleaner id: "${id}"`);
      return c;
    });
  }

  /**
   * Returns true if a cleaner with this id is registered.
   */
  has(id: string): boolean {
    return this.cleaners.has(id);
  }

  /**
   * Number of registered cleaners.
   */
  get size(): number {
    return this.cleaners.size;
  }

  /**
   * Clear all registered cleaners (for testing only).
   */
  clear(): void {
    this.cleaners.clear();
  }
}

/**
 * The singleton registry instance.
 */
export const registry = new CleanerRegistry();
