/**
 * Spintax and Dynamic Personalization Engine
 * Defined in PRD: Automated WhatsApp Cold Outreach & Duplicate Prevention Engine
 */

import { BusinessRecord } from "../schema/business-record";

/**
 * Recursively resolves Spintax groups like {A|B|{C|D}} into a randomly chosen variation.
 */
export function resolveSpintax(text: string): string {
  if (!text) return "";

  // Innermost non-nested {group} pattern
  const innermostRegex = /\{([^{}]+)\}/;

  let current = text;
  let iterations = 0;
  const maxIterations = 50; // Safety guard against runaway loops

  while (innermostRegex.test(current) && iterations < maxIterations) {
    current = current.replace(innermostRegex, (_match, group) => {
      const options = group.split("|");
      const chosen = options[Math.floor(Math.random() * options.length)];
      return chosen;
    });
    iterations++;
  }

  return current;
}

/**
 * Extracts a candidate city name from a formatted business address
 */
export function extractCityFromAddress(address: string | null | undefined): string {
  if (!address || !address.trim()) return "your area";

  // Common address pattern: Street, City, State ZIP (or City, State)
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 3) {
    // Usually the second part or second-to-last part contains the city
    const candidate = parts[parts.length - 2];
    // Strip numbers/zip codes from city candidate
    const cleaned = candidate.replace(/\b\d{4,8}\b/g, "").trim();
    if (cleaned.length > 1) return cleaned;
  } else if (parts.length === 2) {
    const candidate = parts[0].replace(/\b\d{4,8}\b/g, "").trim();
    if (candidate.length > 1) return candidate;
  }

  return parts[0] || "your area";
}

/**
 * Replaces lead variables in the text template
 */
export function interpolateVariables(
  template: string,
  record: Partial<BusinessRecord>
): string {
  if (!template) return "";

  const businessName = record.business_name ? record.business_name.trim() : "Business Owner";
  const primaryCategory = record.primary_category
    ? record.primary_category.trim().toLowerCase()
    : "local";
  const address = record.address ? record.address.trim() : "";
  const city = extractCityFromAddress(address);
  const rating = record.rating !== null && record.rating !== undefined ? record.rating.toFixed(1) : "";
  const reviewCount =
    record.review_count !== null && record.review_count !== undefined
      ? String(record.review_count)
      : "";

  return template
    .replace(/\{business_name\}/gi, businessName)
    .replace(/\{category\}/gi, primaryCategory)
    .replace(/\{city\}/gi, city)
    .replace(/\{address\}/gi, address)
    .replace(/\{rating\}/gi, rating)
    .replace(/\{review_count\}/gi, reviewCount);
}

/**
 * Fully composes a message for a target business by running Spintax resolution and variable interpolation
 */
export function composePersonalizedMessage(
  template: string,
  record: Partial<BusinessRecord>
): string {
  // Interpolate variables first, then resolve Spintax (allows variables to exist inside spintax choices)
  const populated = interpolateVariables(template, record);
  return resolveSpintax(populated);
}

/**
 * Generates sample variations of a template for preview in the UI
 */
export function generateSpintaxPreviews(
  template: string,
  sampleRecord?: Partial<BusinessRecord>,
  count = 3
): string[] {
  const fallbackSample: Partial<BusinessRecord> = sampleRecord || {
    business_name: "Apex Dental Care",
    primary_category: "Dental clinic",
    address: "742 Evergreen Terrace, Springfield, OR 97477",
    rating: 4.8,
    review_count: 56,
  };

  const previews: string[] = [];
  for (let i = 0; i < count; i++) {
    previews.push(composePersonalizedMessage(template, fallbackSample));
  }
  return previews;
}
