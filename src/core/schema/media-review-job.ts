/**
 * MediaReviewJob State Model and Settings
 * Defined in PRD Addendum Section 18.1
 */

import { ReviewJobStatus, ReviewSummary } from "./review-record";

export type MediaTrackStatus =
  | "not_started"
  | "running"
  | "paused"
  | "complete"
  | "partial"
  | "failed"
  | "empty";

export interface MediaReviewSettings {
  maxPhotos: number; // 0 = unlimited
  maxVideos: number; // 0 = unlimited
  maxReviews: number; // 0 = unlimited
  extractPhotos: boolean;
  extractVideos: boolean;
  extractReviews: boolean;
  expandReviewText: boolean;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  requestDelayMs?: number;
}

export const DEFAULT_MEDIA_REVIEW_SETTINGS: MediaReviewSettings = {
  maxPhotos: 0, // unlimited by default per user selection
  maxVideos: 0,
  maxReviews: 0,
  extractPhotos: true,
  extractVideos: true,
  extractReviews: true,
  expandReviewText: true,
  minDelaySeconds: 2.5,
  maxDelaySeconds: 4.5,
  requestDelayMs: 2500,
};

export interface MediaReviewJob {
  jobId: string; // UUID v4
  businessId: string; // FK -> BusinessRecord.record_id
  businessName: string;
  sourceUrl: string; // Google Maps place URL
  parentSessionId: string | null; // set when launched from a search session's business row
  status: "idle" | "running" | "paused" | "completed" | "stopped" | "failed" | "partial";
  pauseReason: "user" | "verification_required" | "unexpected_page_state" | "error_threshold" | null;
  mediaStatus: MediaTrackStatus;
  reviewStatus: ReviewJobStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  error_message?: string | null;
  mediaProgress: {
    photosFound: number;
    photosExtracted: number;
    videosFound: number;
    videosExtracted: number;
  };
  reviewProgress: {
    reviewsAvailable?: number | null;
    reviewsFound: number;
    reviewsExtracted: number;
    reviewMediaFound: number;
    reviewMediaExtracted: number;
  };
  reviewSummary?: ReviewSummary;
  settingsSnapshot: MediaReviewSettings;
}
