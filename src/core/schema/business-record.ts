/**
 * Canonical Business Record Schema
 * Defined in PRD Section 10
 */

export type WebsiteStatus = "website" | "social_only" | "none";

export type BusinessStatus =
  | "operational"
  | "closed_temporarily"
  | "closed_permanently"
  | "unknown";

export type ExtractionStatus =
  | "complete"
  | "partial"
  | "failed"
  | "skipped"
  | "duplicate";

export type PriceLevel = "$" | "$$" | "$$$" | "$$$$" | null;

export interface OpeningHourItem {
  day: string;
  hours: string;
}

export interface BusinessRecord {
  record_id: string; // UUID v4
  business_name: string; // Required
  primary_category: string; // Required
  secondary_categories: string[];
  rating: number | null;
  review_count: number | null;
  price_level: PriceLevel;
  address: string; // Required (best effort)
  phone: string;
  phone_raw?: string;
  phone_normalized?: string;
  phone_country?: string;
  phone_country_calling_code?: string;
  phone_country_source?: string;
  phone_status?: "valid" | "invalid" | "unknown" | "partial";
  whatsapp_link?: string;
  website: string; // URL, empty if social_only or none
  website_status: WebsiteStatus;
  social_links: string[];
  maps_url: string; // Required
  place_identifier: string | null;
  plus_code: string | null;
  latitude: number | null;
  longitude: number | null;
  opening_hours: OpeningHourItem[] | null;
  business_status: BusinessStatus;
  description: string | null;
  service_options: string[];
  attributes: string[];
  extraction_status: ExtractionStatus;
  extraction_timestamp: string; // ISO 8601, UTC
  missing_fields: string[];
  error_fields: string[];
  source_platform: "google_maps" | string;
  duplicate_of: string | null;

  // Internal index keys for storage & dedup lookups
  normalizedNameAddress?: string;
  normalizedNamePhone?: string;
}

/**
 * Raw business data extracted from a platform's DOM before normalization
 */
export interface RawBusinessData {
  name: string | null;
  primaryCategory: string | null;
  secondaryCategories?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  priceLevel?: string | null;
  address: string | null;
  phone?: string | null;
  websiteUrl?: string | null;
  socialUrls?: string[];
  mapsUrl?: string | null;
  placeIdentifier?: string | null;
  plusCode?: string | null;
  coordinates?: { lat: number | null; lng: number | null };
  hours?: OpeningHourItem[] | null;
  businessStatus?: BusinessStatus;
  description?: string | null;
  serviceOptions?: string[];
  attributes?: string[];
  unconfirmedFields?: string[];
}

/**
 * Raw card discovered from search results feed
 */
export interface RawCard {
  cardRef: string; // index or data-attribute identifier
  name: string;
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number | null;
  reviewCount?: number | null;
  cardFingerprint: string;
  discoveryIndex?: number;
}
