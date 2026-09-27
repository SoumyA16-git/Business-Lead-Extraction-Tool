/**
 * CSV Serializer adhering to RFC 4180 and PRD Section 15.1 & Lead Intelligence Spec
 */

import { computeLeadIntelligence } from "../classification/lead-intelligence";
import { BusinessRecord, OpeningHourItem } from "../schema/business-record";

export const DEFAULT_CSV_COLUMNS: (keyof BusinessRecord)[] = [
  "extraction_status",
  "business_name",
  "primary_category",
  "secondary_categories",
  "rating",
  "review_count",
  "price_level",
  "phone",
  "phone_raw",
  "phone_normalized",
  "phone_country",
  "phone_country_calling_code",
  "whatsapp_link",
  "website",
  "website_status",
  "social_links",
  "address",
  "latitude",
  "longitude",
  "plus_code",
  "maps_url",
  "business_status",
  "opening_hours",
  "description",
  "service_options",
  "attributes",
  "missing_fields",
  "error_fields",
  "extraction_timestamp",
  "source_platform",
];

export const LEAD_INTELLIGENCE_CSV_COLUMNS = [
  "digital_maturity_score",
  "opportunity_level",
  "niche_profile",
  "lead_signals",
  "lead_reasons",
] as const;

export type LeadIntelligenceCsvColumn = (typeof LEAD_INTELLIGENCE_CSV_COLUMNS)[number];

export const INTERNAL_ID_COLUMNS: (keyof BusinessRecord)[] = [
  "record_id",
  "place_identifier",
  "duplicate_of",
];

export function escapeCsvField(value: string): string {
  const needsQuoting = /[",\r\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

export function formatOpeningHours(hours: OpeningHourItem[] | null): string {
  if (!hours || !Array.isArray(hours) || hours.length === 0) return "";
  return hours.map((h) => `${h.day}: ${h.hours}`).join("; ");
}

export function serializeFieldForCsv(
  record: BusinessRecord,
  column: keyof BusinessRecord | LeadIntelligenceCsvColumn | string,
  missingToken = "",
  nicheProfileId = "general"
): string {
  // Check Lead Intelligence columns
  if (column === "digital_maturity_score" || column === "lead_score") {
    const intel = computeLeadIntelligence(record, nicheProfileId);
    return String(intel.digitalMaturityScore);
  }

  if (column === "opportunity_level") {
    const intel = computeLeadIntelligence(record, nicheProfileId);
    return intel.activeNiche.opportunityLevel;
  }

  if (column === "niche_profile") {
    const intel = computeLeadIntelligence(record, nicheProfileId);
    return intel.activeNiche.profileName;
  }

  if (column === "lead_signals") {
    const intel = computeLeadIntelligence(record, nicheProfileId);
    if (intel.signals.length === 0) return missingToken;
    return intel.signals.map((s) => s.label).join("; ");
  }

  if (column === "lead_reasons") {
    const intel = computeLeadIntelligence(record, nicheProfileId);
    if (intel.activeNiche.reasons.length === 0) return missingToken;
    return intel.activeNiche.reasons.join("; ");
  }

  const val = (record as any)[column];

  if (val === null || val === undefined) {
    return missingToken;
  }

  if (column === "opening_hours") {
    const formatted = formatOpeningHours(val as OpeningHourItem[]);
    return formatted || missingToken;
  }

  if (Array.isArray(val)) {
    if (val.length === 0) return missingToken;
    return val.join("; ");
  }

  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed === "" ? missingToken : trimmed;
  }

  return String(val);
}

export interface CsvExportOptions {
  columns?: (keyof BusinessRecord | LeadIntelligenceCsvColumn | string)[];
  includeInternalIdentifiers?: boolean;
  includeLeadIntelligence?: boolean;
  nicheProfileId?: string;
  missingPlaceholder?: string;
  includeDuplicates?: boolean;
}

export function toCsv(
  records: BusinessRecord[],
  options: CsvExportOptions = {}
): string {
  const {
    includeInternalIdentifiers = false,
    includeLeadIntelligence = true,
    nicheProfileId = "general",
    missingPlaceholder = "",
    includeDuplicates = false,
  } = options;

  let columns: (keyof BusinessRecord | LeadIntelligenceCsvColumn | string)[];
  if (options.columns) {
    columns = [...options.columns];
  } else {
    columns = [...DEFAULT_CSV_COLUMNS];
    if (includeLeadIntelligence) {
      columns = [...columns, ...LEAD_INTELLIGENCE_CSV_COLUMNS];
    }
  }

  if (includeInternalIdentifiers) {
    columns = [...columns, ...INTERNAL_ID_COLUMNS];
  }

  const filteredRecords = includeDuplicates
    ? records
    : records.filter((r) => r.extraction_status !== "duplicate");

  const header = columns.map((col) => escapeCsvField(String(col))).join(",");

  const rows = filteredRecords.map((rec) =>
    columns
      .map((col) =>
        escapeCsvField(serializeFieldForCsv(rec, col, missingPlaceholder, nicheProfileId))
      )
      .join(",")
  );

  // UTF-8 BOM + CRLF line endings
  return "\uFEFF" + [header, ...rows].join("\r\n");
}
