/**
 * Extraction Session State Types
 * Defined in PRD Section 14
 */

import { ExtractionSettings } from "../../shared/settings";

export type SessionStatus =
  | "idle"
  | "detecting"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "stopped"
  | "failed";

export type PauseReason =
  | "user"
  | "verification_required"
  | "unexpected_page_state"
  | "error_threshold"
  | null;

export interface SearchContext {
  query: string | null;
  locationHint: string | null;
}

export type QueueItemStatus =
  | "queued"
  | "processing"
  | "complete"
  | "partial"
  | "failed"
  | "skipped"
  | "duplicate";

export interface QueueItem {
  queueId: string;
  sessionId: string;
  discoveryIndex: number;
  status: QueueItemStatus;
  cardRef: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number | null;
  reviewCount?: number | null;
  category?: string;
  recordId: string | null;
  retryCount: number;
  lastError: string | null;
  cardFingerprint: string;
}

export interface ExtractionSession {
  sessionId: string;
  customName?: string;
  platform: "google_maps" | string;
  sourceUrl: string;
  searchContext: SearchContext;
  status: SessionStatus;
  pauseReason: PauseReason;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
  queue: QueueItem[];
  processedCount: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  duplicateCount: number;
  websiteCount: number;
  socialCount: number;
  noWebsiteCount: number;
  settingsSnapshot: ExtractionSettings;
  completionReason?: "limit_reached" | "results_exhausted" | "user_stopped" | null;
}
