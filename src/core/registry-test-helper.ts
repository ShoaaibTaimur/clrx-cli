// ============================================================
// ClrX — Registry Test Helper
// Exports the CleanerRegistry class for testing.
// ============================================================
import type { Cleaner } from '../types/cleaner.js';

/**
 * Exported class for testing purposes.
 */
export class CleanerRegistry {
  private readonly cleaners = new Map<string, Cleaner>();

  register(cleaner: Cleaner): void {
    if (this.cleaners.has(cleaner.id)) {
      throw new Error(`Cleaner with id "${cleaner.id}" is already registered.`);
    }
    this.cleaners.set(cleaner.id, cleaner);
  }

  get(id: string): Cleaner | undefined {
    return this.cleaners.get(id);
  }

  getAll(): Cleaner[] {
    return Array.from(this.cleaners.values());
  }

  getMany(ids: string[]): Cleaner[] {
    return ids.map((id) => {
      const c = this.cleaners.get(id);
      if (!c) throw new Error(`Unknown cleaner id: "${id}"`);
      return c;
    });
  }

  has(id: string): boolean {
    return this.cleaners.has(id);
  }

  get size(): number {
    return this.cleaners.size;
  }

  clear(): void {
    this.cleaners.clear();
  }
}
