// ============================================================
// ClrX — Core Types
// ============================================================

export enum SafetyLevel {
  SAFE = 'SAFE',
  CAUTION = 'CAUTION',
  CONFIRMATION_REQUIRED = 'CONFIRMATION_REQUIRED',
  PROTECTED = 'PROTECTED',
}

export interface ScanResult {
  /** Unique identifier matching the cleaner id */
  cleanerId: string;
  /** Display name for this category */
  name: string;
  /** Total size in bytes of all reclaimable items */
  sizeBytes: number;
  /** Number of items found (files/dirs at top level) */
  itemCount: number;
  /** Safety classification for this cleaner */
  safety: SafetyLevel;
  /** Whether the underlying paths/tools are available */
  isAvailable: boolean;
  /** Human-readable note about availability or warnings */
  note?: string;
  /** Individual paths and their sizes */
  paths: PathScanResult[];
}

export interface PathScanResult {
  /** Absolute resolved path */
  path: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Whether the path exists and is accessible */
  exists: boolean;
  /** Any skip reason */
  skipReason?: string;
}

export interface CleanOptions {
  /** If true, never delete anything — only report what would happen */
  dryRun: boolean;
  /** If true, skip interactive prompts (still respects safety) */
  yes: boolean;
  /** If true, produce verbose output */
  verbose: boolean;
  /** If true, suppress non-essential output */
  quiet: boolean;
}

export interface CleanResult {
  cleanerId: string;
  name: string;
  /** Bytes actually freed (0 for dry-run) */
  bytesFreed: number;
  /** Items successfully removed */
  removed: number;
  /** Items skipped (missing, permission denied, etc.) */
  skipped: number;
  /** Items that failed to remove */
  failed: number;
  /** Was this a dry-run? */
  dryRun: boolean;
  /** List of errors encountered */
  errors: CleanError[];
  /** Details of what was/would be removed */
  actions: CleanAction[];
}

export interface CleanAction {
  path: string;
  sizeBytes: number;
  /** 'removed' | 'would-remove' | 'skipped' | 'failed' */
  status: 'removed' | 'would-remove' | 'skipped' | 'failed';
  reason?: string;
}

export interface CleanError {
  path: string;
  message: string;
  code?: string;
}

export interface Cleaner {
  /** Unique machine-readable identifier */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** Short description */
  readonly description: string;
  /** Safety classification */
  readonly safety: SafetyLevel;

  /**
   * Returns true if this cleaner's targets are available
   * (e.g., app installed, paths exist, tool in PATH).
   */
  isAvailable(): Promise<boolean>;

  /**
   * Scan and report sizes/counts without deleting anything.
   */
  scan(): Promise<ScanResult>;

  /**
   * Perform the cleanup (or simulate it if options.dryRun is true).
   */
  clean(options: CleanOptions): Promise<CleanResult>;
}

export interface ScanSummary {
  platform: string;
  architecture: string;
  scannedAt: string;
  categories: CategorySummary[];
  totalReclaimableBytes: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  sizeBytes: number;
  itemCount: number;
  safety: SafetyLevel;
  isAvailable: boolean;
  note?: string;
}
