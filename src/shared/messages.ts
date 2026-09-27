/**
 * Message-passing contract between Content Script, Service Worker, and UI
 * Defined in PRD Section 24.4
 */

import { DetectedBusinessTarget } from "../core/adapters/platform-adapter";
import { BusinessRecord, RawBusinessData, RawCard } from "../core/schema/business-record";
import { MediaReviewJob, MediaReviewSettings } from "../core/schema/media-review-job";
import { MediaRecord, MediaSourceContext, RawMediaItem } from "../core/schema/media-record";
import { RawReviewItem, ReviewRecord } from "../core/schema/review-record";
import { ExtractionSession, SearchContext } from "../core/schema/session";
import { ExtractionSettings } from "./settings";
import { RawLinkedInCard, LinkedInSession, LinkedInProfileRecord } from "../core/schema/linkedin-profile";

export type ContentToWorker =
  | { type: "ACCURATE_SLEEP"; ms: number }
  | { type: "SEARCH_PAGE_DETECTED"; sourceUrl: string; searchContext: SearchContext }
  | { type: "BUSINESS_CARDS_DISCOVERED"; cards: RawCard[] }
  | { type: "BUSINESS_RAW_EXTRACTED"; queueId: string; raw: RawBusinessData }
  | { type: "EXTRACTION_ERROR"; queueId: string; error: string }
  | { type: "VERIFICATION_DETECTED" }
  | { type: "PAGE_STATE_MISMATCH"; expected: string; actual: string }
  | { type: "NAVIGATION_CHANGED"; url: string }
  | { type: "BUSINESS_PAGE_DETECTED"; target: DetectedBusinessTarget; sourceUrl: string }
  | { type: "MEDIA_ITEMS_DISCOVERED"; jobId: string; items: RawMediaItem[] }
  | { type: "REVIEWS_DISCOVERED"; jobId: string; reviews: RawReviewItem[] }
  | { type: "MEDIA_DISCOVERY_EXHAUSTED"; jobId: string }
  | { type: "REVIEWS_DISCOVERY_EXHAUSTED"; jobId: string }
  | { type: "LINKEDIN_PAGE_DETECTED"; sourceUrl: string; searchQuery: string | null }
  | { type: "LINKEDIN_PROFILE_CARDS_DISCOVERED"; cards: RawLinkedInCard[] };

export type WorkerToContent =
  | { type: "OPEN_BUSINESS"; queueId: string; cardRef: string; name?: string; discoveryIndex?: number }
  | { type: "SCROLL_RESULTS_FEED" }
  | { type: "NAVIGATE_BACK_TO_RESULTS" }
  | { type: "CHECK_PAGE_STATE" }
  | { type: "PING" }
  | { type: "TRIGGER_PAGE_SCAN" }
  | { type: "SWITCH_TAB"; tab: "Overview" | "Photos" | "Reviews" | "About" }
  | { type: "TRIGGER_MEDIA_DISCOVERY"; jobId: string; context: MediaSourceContext }
  | { type: "TRIGGER_MEDIA_SCROLL"; jobId: string }
  | { type: "TRIGGER_REVIEWS_DISCOVERY"; jobId: string }
  | { type: "TRIGGER_REVIEWS_SCROLL"; jobId: string }
  | { type: "CHECK_WHATSAPP_STATE" }
  | { type: "EXECUTE_WHATSAPP_SEND"; text: string; leadId?: string }
  | { type: "LINKEDIN_TRIGGER_PAGE_SCAN" }
  | { type: "LINKEDIN_SCAN_RESULT_CARDS" }
  | { type: "LINKEDIN_OPEN_PROFILE"; profileUrl: string; queueId: string }
  | { type: "LINKEDIN_EXTRACT_PROFILE"; queueId: string }
  | { type: "LINKEDIN_SEND_CONNECTION"; queueId: string }
  | { type: "LINKEDIN_SEND_DM"; queueId: string; message: string }
  | { type: "LINKEDIN_SCROLL_RESULTS" };

export type WorkerToUI =
  | { type: "SESSION_UPDATED"; session: ExtractionSession }
  | { type: "RECORD_SAVED"; record: BusinessRecord }
  | { type: "SETTINGS_UPDATED"; settings: ExtractionSettings }
  | { type: "MEDIA_REVIEW_JOB_UPDATED"; job: MediaReviewJob }
  | { type: "MEDIA_RECORD_SAVED"; record: MediaRecord }
  | { type: "REVIEW_RECORD_SAVED"; record: ReviewRecord }
  | { type: "BUSINESS_TARGET_DETECTED"; target: DetectedBusinessTarget | null }
  | { type: "WHATSAPP_CAMPAIGN_PROGRESS"; progress: any }
  | { type: "WHATSAPP_CAMPAIGN_LOG"; entry: any }
  | { type: "LINKEDIN_SESSION_UPDATED"; session: LinkedInSession | null }
  | { type: "LINKEDIN_PROFILE_SAVED"; profile: LinkedInProfileRecord }
  | { type: "LINKEDIN_CAMPAIGN_PROGRESS"; progress: any }
  | { type: "LINKEDIN_CAMPAIGN_LOG"; entry: any };

export type UIToWorker =
  | { type: "GET_CURRENT_STATE" }
  | { type: "GET_ALL_SESSIONS" }
  | { type: "LOAD_SESSION"; sessionId: string }
  | { type: "SET_ACTIVE_SESSION"; sessionId: string }
  | { type: "RENAME_SESSION"; sessionId: string; newName: string }
  | { type: "DELETE_SESSION"; sessionId: string }
  | { type: "BULK_DELETE_SESSIONS"; sessionIds: string[] }
  | { type: "START_EXTRACTION"; settings?: Partial<ExtractionSettings> }
  | { type: "PAUSE_EXTRACTION" }
  | { type: "RESUME_EXTRACTION" }
  | { type: "STOP_EXTRACTION" }
  | { type: "RETRY_FAILED" }
  | { type: "CLEAR_SESSION"; sessionId?: string }
  | { type: "CLOSE_ACTIVE_SESSION" }
  | { type: "CLEAR_ALL_DATA" }
  | { type: "UPDATE_SETTINGS"; settings: Partial<ExtractionSettings> }
  | { type: "GET_SETTINGS" }
  | { type: "EXPORT"; format: "csv" | "json" | "both" | "vcf"; exportSettings?: { csvMissingPlaceholder?: string; includeDuplicateRecords?: boolean; includeInternalIdentifiers?: boolean } }
  | { type: "ENSURE_CONTENT_SCRIPT"; tabId?: number }
  | { type: "START_MEDIA_REVIEW_JOB"; target: DetectedBusinessTarget; settings?: Partial<MediaReviewSettings> }
  | { type: "PAUSE_MEDIA_REVIEW_JOB"; jobId: string; track?: "media" | "review" | "all" }
  | { type: "RESUME_MEDIA_REVIEW_JOB"; jobId: string; track?: "media" | "review" | "all" }
  | { type: "STOP_MEDIA_REVIEW_JOB"; jobId: string }
  | { type: "GET_MEDIA_REVIEW_JOB"; jobId?: string }
  | { type: "GET_MEDIA_RECORDS"; businessId?: string; filter?: any }
  | { type: "GET_REVIEW_RECORDS"; businessId?: string; filter?: any }
  | { type: "EXPORT_MEDIA_REVIEWS"; jobId?: string; businessId?: string; format: "media_csv" | "reviews_csv" | "combined_json" | "all" }
  | { type: "START_WHATSAPP_CAMPAIGN"; leads: BusinessRecord[]; template: string; templatePool?: string[]; sessionId?: string; settings?: any }
  | { type: "PAUSE_WHATSAPP_CAMPAIGN" }
  | { type: "RESUME_WHATSAPP_CAMPAIGN" }
  | { type: "STOP_WHATSAPP_CAMPAIGN" }
  | { type: "GET_WHATSAPP_CAMPAIGN_STATE" }
  | { type: "GET_WHATSAPP_OUTREACH_HISTORY" }
  | { type: "GET_WHATSAPP_TEMPLATES" }
  | { type: "SAVE_WHATSAPP_TEMPLATE"; template: any }
  | { type: "DELETE_WHATSAPP_TEMPLATE"; templateId: string }
  | { type: "START_LINKEDIN_CAMPAIGN"; sessionId: string }
  | { type: "PAUSE_LINKEDIN_CAMPAIGN" }
  | { type: "STOP_LINKEDIN_CAMPAIGN" }
  | { type: "GET_LINKEDIN_CAMPAIGN_STATE" }
  | { type: "START_LINKEDIN_SESSION" }
  | { type: "PAUSE_LINKEDIN_SESSION" }
  | { type: "RESUME_LINKEDIN_SESSION" }
  | { type: "STOP_LINKEDIN_SESSION" }
  | { type: "GET_LINKEDIN_SESSION_STATE" }
  | { type: "GET_ALL_LINKEDIN_SESSIONS" }
  | { type: "GET_LINKEDIN_PROFILES"; sessionId: string }
  | { type: "DELETE_LINKEDIN_SESSION"; sessionId: string }
  | { type: "EXPORT_LINKEDIN_PROFILES"; sessionId: string; format: "csv" | "json" };

export type ExtensionMessage = ContentToWorker | WorkerToContent | WorkerToUI | UIToWorker;
