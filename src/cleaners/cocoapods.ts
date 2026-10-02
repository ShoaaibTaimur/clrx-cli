// ============================================================
// ClrX — CocoaPods Cache Cleaner
// Target: ~/Library/Caches/CocoaPods
// Safety: SAFE — CocoaPods cache is rebuilt on next pod install
// ============================================================
import { SafetyLevel } from '../types/cleaner.js';
import { BaseCleaner } from './base.js';

export class CocoaPodsCleaner extends BaseCleaner {
  readonly id = 'cocoapods-cache';
  readonly name = 'CocoaPods Cache';
  readonly description =
    'CocoaPods package cache (~/Library/Caches/CocoaPods). Rebuilt on next `pod install`.';
  readonly safety = SafetyLevel.SAFE;

  protected getTargetPaths(): string[] {
    return [this.homeJoin('Library', 'Caches', 'CocoaPods')];
  }
}

export const cocoaPodsCleaner = new CocoaPodsCleaner();
