/**
 * User and session settings definitions
 * Defined in PRD Sections 14, 15, and 16
 */

export type SpeedPreset = "turbo" | "fast" | "standard" | "custom";

export interface ExtractionSettings {
  /** Speed preset mode */
  speedPreset: SpeedPreset;
  /** Minimum delay between opening detail panels in seconds (enforced floor: 0.0) */
  minDelaySeconds: number;
  /** Maximum delay between opening detail panels in seconds */
  maxDelaySeconds: number;
  /** Maximum businesses to process in a single session (0 = unlimited) */
  maxBusinesses: number;
  /** Max retries for a single business before marking failed */
  maxRetriesPerBusiness: number;
  /** Max consecutive business failures before auto-pausing session */
  maxConsecutiveFailures: number;
  /** Value used for missing fields in CSV export (default: empty string) */
  csvMissingPlaceholder: string;
  /** Whether to include duplicate records in CSV/JSON exports */
  includeDuplicateRecords: boolean;
  /** Whether to include internal IDs (record_id, place_identifier) in CSV export */
  includeInternalIdentifiers: boolean;
  /** Duplicate resolution policy */
  duplicateMergePolicy: "fill_gaps" | "keep_original";
  /** Duplicate detection scope: across all sessions or current session only */
  duplicateScope: "all_sessions" | "current_session";
  /** Optional Gemini API Key for AI generated messages */
  geminiApiKey: string;
}

export const DEFAULT_EXTRACTION_SETTINGS: ExtractionSettings = {
  speedPreset: "standard",
  minDelaySeconds: 5.0,
  maxDelaySeconds: 10.0,
  maxBusinesses: 0,
  maxRetriesPerBusiness: 2,
  maxConsecutiveFailures: 5,
  csvMissingPlaceholder: "",
  includeDuplicateRecords: false,
  includeInternalIdentifiers: false,
  duplicateMergePolicy: "fill_gaps",
  duplicateScope: "current_session",
  geminiApiKey: "",
};

export const MIN_DELAY_FLOOR = 0.0;

export function applySpeedPreset(preset: SpeedPreset, settings: ExtractionSettings): ExtractionSettings {
  const updated = { ...settings, speedPreset: preset };
  if (preset === "turbo") {
    updated.minDelaySeconds = 2.0;
    updated.maxDelaySeconds = 5.0;
  } else if (preset === "fast") {
    updated.minDelaySeconds = 4.0;
    updated.maxDelaySeconds = 7.0;
  } else if (preset === "standard") {
    updated.minDelaySeconds = 5.0;
    updated.maxDelaySeconds = 10.0;
  }
  return updated;
}

export function validateSettings(settings: Partial<ExtractionSettings>): ExtractionSettings {
  const merged: ExtractionSettings = { ...DEFAULT_EXTRACTION_SETTINGS, ...settings };
  if (!merged.speedPreset) {
    merged.speedPreset = "standard";
  }
  if (merged.minDelaySeconds < MIN_DELAY_FLOOR) {
    merged.minDelaySeconds = MIN_DELAY_FLOOR;
  }
  if (merged.maxDelaySeconds < merged.minDelaySeconds) {
    merged.maxDelaySeconds = merged.minDelaySeconds + 0.2;
  }
  if (merged.maxBusinesses < 0) {
    merged.maxBusinesses = 0;
  }
  if (merged.maxRetriesPerBusiness < 0) {
    merged.maxRetriesPerBusiness = 0;
  }
  if (merged.maxConsecutiveFailures < 1) {
    merged.maxConsecutiveFailures = 1;
  }
  return merged;
}
