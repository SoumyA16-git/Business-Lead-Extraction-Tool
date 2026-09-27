/**
 * Missing Data and Error Fields Computation
 * Defined in PRD Section 12
 */

import { BusinessRecord } from "../schema/business-record";

/**
 * List of optional canonical fields that can be flagged as missing
 */
export const TRACKABLE_OPTIONAL_FIELDS: (keyof BusinessRecord)[] = [
  "phone",
  "website",
  "rating",
  "review_count",
  "price_level",
  "opening_hours",
  "description",
  "plus_code",
  "latitude",
  "longitude",
  "service_options",
  "attributes",
  "secondary_categories",
];

/**
 * Required fields where absence constitutes an extraction error
 */
export const REQUIRED_FIELDS: (keyof BusinessRecord)[] = [
  "business_name",
  "primary_category",
  "address",
  "maps_url",
  "source_platform",
];

/**
 * Computes missing_fields and validates error_fields for a business record
 */
export function computeMissingFields(
  record: Partial<BusinessRecord>,
  unconfirmedFields: string[] = []
): { missing_fields: string[]; error_fields: string[] } {
  const missing_fields: string[] = [];
  const error_fields: string[] = [...(record.error_fields || []), ...unconfirmedFields];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    const val = record[field];
    if (val === undefined || val === null || val === "") {
      if (!error_fields.includes(field)) {
        error_fields.push(field);
      }
    }
  }

  // Check optional fields
  for (const field of TRACKABLE_OPTIONAL_FIELDS) {
    // If the field had an extraction error, it is an error_field, not a confirmed-missing field
    if (error_fields.includes(field)) {
      continue;
    }

    const val = record[field];
    if (val === undefined || val === null) {
      missing_fields.push(field);
    } else if (typeof val === "string" && val.trim() === "") {
      missing_fields.push(field);
    } else if (Array.isArray(val) && val.length === 0) {
      missing_fields.push(field);
    }
  }

  return {
    missing_fields,
    error_fields: Array.from(new Set(error_fields)),
  };
}
