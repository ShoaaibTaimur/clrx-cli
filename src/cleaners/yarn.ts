// ============================================================
// ClrX — Yarn Cache Cleaner
// Target: ~/Library/Caches/Yarn
// Safety: SAFE — Yarn cache is rebuilt automatically
// ============================================================
import { SafetyLevel } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';

export class YarnCleaner extends BaseCleaner {
  readonly id = 'yarn-cache';
  readonly name = 'Yarn Cache';
  readonly description = 'Yarn v1 package cache (~/Library/Caches/Yarn). Safe to clear.';
  readonly safety = SafetyLevel.SAFE;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('Library', 'Caches', 'Yarn')];
  }
}

export const yarnCleaner = new YarnCleaner();
