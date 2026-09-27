/**
 * Canonical Review Schema & Summary Types
 * Defined in PRD Addendum Section 14, 15, and 16
 */

import { MediaExtractionStatus, MediaRecord, RawMediaItem } from "./media-record";

export type ReviewJobStatus =
  | "not_started"
  | "running"
  | "paused"
  | "complete"
  | "partial"
  | "blocked"
  | "failed"
  | "empty";

export interface ReviewSummary {
  reported_review_count: number | null;
  reviews_found: number;
  reviews_extracted: number;
  reviews_failed: number;
  count_discrepancy: boolean;
  status: ReviewJobStatus;
  sort_mode: "default";
}

export interface ReviewOwnerResponse {
  text: string;
  date: string;
}

export interface ReviewRecord {
  review_id: string; // internal UUID, always present
  source_review_id: string | null; // platform-native ID, only when exposed
  business_id: string; // FK -> BusinessRecord.record_id
  source_business_id: string | null; // copied from BusinessRecord.place_identifier
  author_name: string;
  author_profile_url: string; // "" if not exposed
  author_review_count: number | null;
  rating: number; // 1-5
  review_text: string;
  review_date: string; // ISO 8601 when resolvable, or ""
  review_relative_time: string; // raw platform string, e.g. "3 months ago"
  review_url: string; // permalink or ""
  language: string; // language code or ""
  owner_response: ReviewOwnerResponse | null;
  media: MediaRecord[]; // user-uploaded media attached to this review
  source_platform: "google_maps" | string;
  extraction_status: MediaExtractionStatus;
  extraction_timestamp: string; // ISO 8601 UTC
  missing_fields: string[];
  error_fields: string[];

  // Internal index key for deduplication lookup
  reviewFingerprint?: string;
}

export interface RawReviewItem {
  sourceReviewId?: string | null;
  authorName: string;
  authorProfileUrl?: string;
  authorReviewCount?: number | null;
  rating: number;
  reviewText: string;
  reviewDate?: string;
  reviewRelativeTime?: string;
  reviewUrl?: string;
  language?: string;
  ownerResponse?: ReviewOwnerResponse | null;
  media?: RawMediaItem[];
}
