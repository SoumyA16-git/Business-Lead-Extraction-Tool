/**
 * JSON Serializer adhering to PRD Section 15.2 & Lead Intelligence Spec
 */

import { computeLeadIntelligence } from "../classification/lead-intelligence";
import { BusinessRecord } from "../schema/business-record";
import { ExtractionSession } from "../schema/session";

export interface JsonExportMetadata {
  export_timestamp: string;
  source_platform: string;
  search_context: {
    query: string | null;
    source_url: string;
  };
  total_records: number;
  successful_records: number;
  partial_records: number;
  failed_records: number;
  duplicate_records_excluded: number;
  tool_version: string;
}

export interface JsonExportPayload {
  export_metadata: JsonExportMetadata;
  businesses: (BusinessRecord & { lead_intelligence?: any })[];
}

export interface JsonExportOptions {
  includeDuplicates?: boolean;
  includeLeadIntelligence?: boolean;
  nicheProfileId?: string;
}

export function toJson(
  session: ExtractionSession,
  records: BusinessRecord[],
  options: JsonExportOptions = {}
): string {
  const {
    includeDuplicates = false,
    includeLeadIntelligence = true,
    nicheProfileId = "general",
  } = options;

  let filteredRecords = records;
  let duplicatesExcludedCount = 0;

  if (!includeDuplicates) {
    filteredRecords = records.filter((r) => r.extraction_status !== "duplicate");
    duplicatesExcludedCount = records.length - filteredRecords.length;
  }

  const successfulCount = filteredRecords.filter(
    (r) => r.extraction_status === "complete"
  ).length;
  const partialCount = filteredRecords.filter(
    (r) => r.extraction_status === "partial"
  ).length;
  const failedCount = filteredRecords.filter(
    (r) => r.extraction_status === "failed"
  ).length;

  const outputBusinesses = filteredRecords.map((rec) => {
    if (!includeLeadIntelligence) return rec;

    const intel = computeLeadIntelligence(rec, nicheProfileId);
    return {
      ...rec,
      lead_intelligence: {
        digital_maturity_score: intel.digitalMaturityScore,
        online_presence_type: intel.onlinePresenceType,
        contactability_tier: intel.contactabilityTier,
        reputation_tier: intel.reputationTier,
        review_volume_tier: intel.reviewVolumeTier,
        profile_completeness_percentage: intel.profileCompletenessPercentage,
        active_niche: {
          profile_id: intel.activeNiche.profileId,
          profile_name: intel.activeNiche.profileName,
          opportunity_level: intel.activeNiche.opportunityLevel,
          reasons: intel.activeNiche.reasons,
        },
        signals: intel.signals.map((s) => ({
          id: s.id,
          label: s.label,
          category: s.category,
          description: s.description,
          evidence: s.evidence,
        })),
      },
    };
  });

  const payload: JsonExportPayload = {
    export_metadata: {
      export_timestamp: new Date().toISOString(),
      source_platform: session.platform || "google_maps",
      search_context: {
        query: session.searchContext.query,
        source_url: session.sourceUrl,
      },
      total_records: filteredRecords.length,
      successful_records: successfulCount,
      partial_records: partialCount,
      failed_records: failedCount,
      duplicate_records_excluded: duplicatesExcludedCount,
      tool_version: "1.0.0",
    },
    businesses: outputBusinesses,
  };

  return JSON.stringify(payload, null, 2);
}
