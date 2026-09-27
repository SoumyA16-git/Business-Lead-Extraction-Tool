/**
 * Fill-Gaps Duplicate Merge Policy
 * Defined in PRD Section 13.4
 */

import { computeMissingFields } from "../missing-data/compute-missing";
import { BusinessRecord } from "../schema/business-record";

/**
 * Checks if a value is considered empty/unpopulated
 */
function isFieldEmpty(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

/**
 * Merges missing data from duplicate record into original record.
 * First-seen value wins; only unpopulated fields on original are filled.
 */
export function mergeDuplicateRecord(
  original: BusinessRecord,
  duplicate: Partial<BusinessRecord>
): BusinessRecord {
  const merged: BusinessRecord = { ...original };

  const mergeableKeys: (keyof BusinessRecord)[] = [
    "phone",
    "website",
    "rating",
    "review_count",
    "price_level",
    "plus_code",
    "latitude",
    "longitude",
    "opening_hours",
    "description",
    "service_options",
    "attributes",
    "secondary_categories",
    "place_identifier",
  ];

  for (const key of mergeableKeys) {
    const originalVal = original[key];
    const duplicateVal = duplicate[key];

    if (isFieldEmpty(originalVal) && !isFieldEmpty(duplicateVal)) {
      // Fill the gap
      (merged as unknown as Record<string, unknown>)[key] = duplicateVal;
    }
  }

  // If website was filled, re-evaluate website_status and social_links
  if (isFieldEmpty(original.website) && !isFieldEmpty(duplicate.website)) {
    merged.website = duplicate.website!;
    merged.website_status = duplicate.website_status || "website";
  }

  if ((!original.social_links || original.social_links.length === 0) && duplicate.social_links?.length) {
    merged.social_links = [...duplicate.social_links];
  }

  // Recompute missing fields on merged record
  const { missing_fields, error_fields } = computeMissingFields(merged, original.error_fields);
  merged.missing_fields = missing_fields;
  merged.error_fields = error_fields;

  return merged;
}
