/**
 * Canonical Business Media Schema
 * Defined in PRD Addendum Section 8.2 and 11.1
 */

export type MediaSourceContext =
  | "business_gallery"
  | "business_profile"
  | "business_updates"
  | "review_media"
  | "unknown";

export type MediaExtractionStatus =
  | "success"
  | "partial"
  | "failed"
  | "duplicate"
  | "skipped";

export interface MediaRecord {
  media_id: string; // internal UUID, always present
  source_media_id: string | null; // platform-native ID, only when DOM exposes one
  business_id: string; // FK -> BusinessRecord.record_id
  source_business_id: string | null; // copied from BusinessRecord.place_identifier when available
  review_id: string | null; // FK -> ReviewRecord.review_id; set only when source_context is "review_media"
  type: "photo" | "video";
  source_url: string; // page/lightbox context
  media_url: string; // direct reusable asset URL
  embed_url: string; // iframe-embeddable URL, or "unavailable" (PRD §11.4)
  thumbnail_url: string; // preview variant, distinct from media_url or empty
  title: string;
  caption: string;
  width: number | null;
  height: number | null;
  duration: number | null; // seconds (video only, null for photos)
  source_context: MediaSourceContext;
  source_platform: "google_maps" | string;
  extraction_status: MediaExtractionStatus;
  extraction_timestamp: string; // ISO 8601 UTC
  missing_fields: string[];
  error_fields: string[];

  // Internal index key for deduplication lookup
  canonicalFingerprint?: string;
}

export interface RawMediaItem {
  sourceMediaId?: string | null;
  type: "photo" | "video";
  sourceUrl: string;
  mediaUrl: string;
  embedUrl?: string;
  thumbnailUrl?: string;
  title?: string;
  caption?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  sourceContext: MediaSourceContext;
  reviewId?: string | null;
}
