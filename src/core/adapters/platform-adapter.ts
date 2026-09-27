/**
 * Platform Adapter Interface
 * Defined in PRD Section 25.2
 */

import { BusinessRecord, RawBusinessData, RawCard } from "../schema/business-record";
import { MediaSourceContext, RawMediaItem } from "../schema/media-record";
import { RawReviewItem } from "../schema/review-record";
import { SearchContext } from "../schema/session";

export interface BusinessIdentifier {
  primary: string;
  type: "place_identifier" | "website" | "maps_url" | "name_address" | "name_phone";
}

export interface PlatformAdapter {
  readonly platformId: string; // e.g. "google_maps"

  /** Is the current page this platform? */
  detectPlatform(doc: Document, url: string): boolean;

  /** Is the current page a search-results page this adapter can enumerate? */
  detectSearchPage(doc: Document, url: string): SearchContext | null;

  /** Enumerate currently-visible business cards */
  discoverBusinesses(doc: Document): RawCard[];

  /** Trigger further discovery (e.g. scroll results feed) */
  discoverMore(doc: Document): Promise<boolean>;

  /** Navigate into a business's detail view */
  openBusiness(card: RawCard): Promise<void>;

  /** Read raw, unnormalized field values from the open detail view */
  extractBusiness(doc: Document, fallbackUrl?: string): Promise<RawBusinessData>;

  /** Fallback: read field values directly from results feed card if detail view fails to open */
  extractBusinessFromFeed?(doc: Document, card: RawCard): RawBusinessData;

  /** Normalize raw data into canonical schema */
  normalizeBusiness(raw: RawBusinessData): Partial<BusinessRecord>;

  /** Derive best available dedup identifier */
  getBusinessIdentifier(record: Partial<BusinessRecord>): BusinessIdentifier;

  /** Has this business's detail view finished rendering stably? */
  detectCompletion(doc: Document): boolean;

  /** Is the platform presenting a verification/challenge/CAPTCHA interstitial? */
  detectVerification(doc: Document): boolean;

  /** Navigate back to the results list after processing a business */
  returnToResults(): Promise<void>;

  /** Did the page context change unexpectedly? */
  detectUnexpectedNavigation(doc: Document, url: string, expected: SearchContext): boolean;

  /** Detect if the current view is a single business page (PRD §7.2, §37) */
  detectBusinessPage?(doc: Document, url: string): DetectedBusinessTarget | null;

  /** Discover currently rendered media items (PRD §8, §37) */
  discoverMedia?(doc: Document, context: MediaSourceContext): Promise<RawMediaItem[]>;

  /** Discover currently rendered reviews (PRD §13, §37) */
  discoverReviews?(doc: Document): Promise<RawReviewItem[]>;
}

export interface DetectedBusinessTarget {
  business_name: string;
  address_preview: string | null;
  maps_url: string;
  confidence: "high" | "low";
}
