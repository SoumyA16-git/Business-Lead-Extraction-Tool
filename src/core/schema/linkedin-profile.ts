/**
 * LinkedIn Profile Record Schema
 * Mirrors the Google Maps BusinessRecord / ExtractionSession pattern for LinkedIn
 */

// ---------------------------------------------------------------------------
// Website classification — same semantics as BusinessRecord.website_status
// ---------------------------------------------------------------------------
export type LinkedInWebsiteStatus = "website" | "social_only" | "none";

// ---------------------------------------------------------------------------
// Connection outcome per profile
// ---------------------------------------------------------------------------
export type LinkedInConnectionStatus =
  | "sent"               // Connect request successfully sent without a note
  | "skipped_has_website" // Profile has a real website — not our target
  | "already_connected"  // LinkedIn shows "Message" — already 1st-degree
  | "pending"            // Request previously sent — button shows "Pending"
  | "failed"             // Could not locate or click the Connect button
  | "queued";            // Not yet processed

// ---------------------------------------------------------------------------
// Per-profile extraction / queue status
// ---------------------------------------------------------------------------
export type LinkedInProfileStatus =
  | "queued"
  | "processing"
  | "complete"
  | "failed"
  | "skipped";

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------
export type LinkedInSessionStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "stopped"
  | "failed";

export type LinkedInPauseReason =
  | "user"
  | "error_threshold"
  | "unexpected_page_state"
  | null;

// ---------------------------------------------------------------------------
// Raw card discovered from the search-results page (before visiting profile)
// ---------------------------------------------------------------------------
export interface RawLinkedInCard {
  /** Absolute profile URL, e.g. https://www.linkedin.com/in/john-doe/ */
  profileUrl: string;
  profileType?: "person" | "company";
  /** Display name */
  name: string;
  /** Headline / job title shown in the card */
  headline?: string;
  /** Location text shown in the card */
  location?: string;
  /** Stable fingerprint used for dedup (hash of name + profileUrl) */
  cardFingerprint: string;
  /** Position in the search results list */
  discoveryIndex?: number;
}

// ---------------------------------------------------------------------------
// Queue item — one entry per profile to be processed
// ---------------------------------------------------------------------------
export interface LinkedInQueueItem {
  queueId: string;
  sessionId: string;
  discoveryIndex: number;
  status: LinkedInProfileStatus;
  profileUrl: string;
  profileType?: "person" | "company";
  name: string;
  headline?: string;
  location?: string;
  /** Set after profile page is visited */
  profileId: string | null;
  retryCount: number;
  lastError: string | null;
  cardFingerprint: string;
}

// ---------------------------------------------------------------------------
// Canonical saved record for each visited LinkedIn profile
// ---------------------------------------------------------------------------
export interface LinkedInProfileRecord {
  profileId: string;                     // UUID v4
  sessionId: string;
  profileUrl: string;
  name: string;
  profileType?: "person" | "company";
  headline: string;
  location: string;
  websiteStatus: LinkedInWebsiteStatus;
  foundUrls: string[];                   // all external URLs found on profile
  connectionStatus: LinkedInConnectionStatus;
  campaignMessageSent?: boolean;
  campaignMessageDate?: string;
  extractionTimestamp: string;           // ISO 8601 UTC
  error?: string;
}

// ---------------------------------------------------------------------------
// LinkedIn scraping session — mirrors ExtractionSession
// ---------------------------------------------------------------------------
export interface LinkedInSession {
  sessionId: string;
  customName?: string;
  platform: "linkedin";
  sourceUrl: string;
  searchQuery: string | null;
  status: LinkedInSessionStatus;
  phase: "scraping" | "connecting";      // 2-phase architecture
  pauseReason: LinkedInPauseReason;
  createdAt: string;                     // ISO 8601 UTC
  updatedAt: string;                     // ISO 8601 UTC
  queue: LinkedInQueueItem[];
  processedCount: number;
  connectedCount: number;                // sent connection requests
  skippedCount: number;                  // skipped because has website
  failedCount: number;
  alreadyConnectedCount: number;
  pendingCount: number;
  completionReason?: "limit_reached" | "results_exhausted" | "user_stopped" | null;
}
