/**
 * Duplicate Detection Identifier Priority Chain
 * Defined in PRD Section 13.2
 */

import { BusinessRecord } from "../schema/business-record";
import { getPhoneSuffix, normalizeAddress, normalizeName, normalizeUrl } from "./normalize";

export interface RecordFingerprints {
  placeIdentifier: string | null;
  normalizedWebsite: string | null;
  normalizedMapsUrl: string | null;
  nameAddressKey: string | null;
  namePhoneKey: string | null;
}

export function computeRecordFingerprints(record: Partial<BusinessRecord>): RecordFingerprints {
  const placeIdentifier = record.place_identifier?.trim() || null;

  // 1. Normalized genuine website (excluding generic root domains)
  let normalizedWebsite: string | null = null;
  if (record.website_status === "website" && record.website) {
    const norm = normalizeUrl(record.website);
    const genericHosts = ["google.com", "maps.google.com", "goo.gl", "bit.ly", "tinyurl.com"];
    const isGeneric = genericHosts.some(
      (h) => norm === h || norm.startsWith(`${h}/`)
    );
    if (!isGeneric && norm.length > 3) {
      normalizedWebsite = norm;
    }
  }

  // 2. Canonical Maps URL - ONLY specific place URLs, NEVER search URLs or generic map views
  let normalizedMapsUrl: string | null = null;
  if (record.maps_url) {
    const rawUrl = record.maps_url.trim().toLowerCase();
    const isSearchUrl =
      rawUrl.includes("/maps/search/") ||
      rawUrl.includes("/search?") ||
      rawUrl.endsWith("/maps") ||
      rawUrl.endsWith("/maps/");
    const isPlaceUrl =
      rawUrl.includes("/maps/place/") ||
      rawUrl.includes("maps.app.goo.gl") ||
      rawUrl.includes("goo.gl/maps");

    if (!isSearchUrl && isPlaceUrl) {
      normalizedMapsUrl = normalizeUrl(record.maps_url);
    }
  }

  // 3. Name normalization with invalid/generic name guard
  const rawName = record.business_name ? normalizeName(record.business_name) : "";
  const isGenericOrBadName =
    !rawName ||
    rawName.length < 2 ||
    rawName === "results" ||
    rawName === "search results" ||
    rawName.startsWith("results for") ||
    rawName === "local business" ||
    rawName === "google maps";
  const normName = isGenericOrBadName ? "" : rawName;

  // 4. Address normalization (requires at least 5 chars to prevent weak matches)
  const rawAddr = record.address ? normalizeAddress(record.address) : "";
  const normAddr = rawAddr.length >= 5 ? rawAddr : "";

  // 5. Phone suffix (requires at least 8 digits)
  const phoneSuffix = record.phone ? getPhoneSuffix(record.phone, 8) : "";

  const nameAddressKey = normName && normAddr ? `${normName}|${normAddr}` : null;
  const namePhoneKey = normName && phoneSuffix ? `${normName}|${phoneSuffix}` : null;

  return {
    placeIdentifier,
    normalizedWebsite,
    normalizedMapsUrl,
    nameAddressKey,
    namePhoneKey,
  };
}

/**
 * Checks if two business records represent the same business per the priority chain
 */
export function isDuplicate(
  candidate: Partial<BusinessRecord>,
  existing: BusinessRecord
): boolean {
  const cFp = computeRecordFingerprints(candidate);
  const eFp = computeRecordFingerprints(existing);

  // 1. Platform place identifier (primary URL-derived identifier)
  // If both records have place identifiers, their equality strictly determines if they are the same place
  if (cFp.placeIdentifier && eFp.placeIdentifier) {
    return cFp.placeIdentifier.toLowerCase() === eFp.placeIdentifier.toLowerCase();
  }

  // 2. Canonical Maps place URL
  // If both records have valid Maps place URLs, their equality strictly determines if they are the same place
  if (cFp.normalizedMapsUrl && eFp.normalizedMapsUrl) {
    return cFp.normalizedMapsUrl === eFp.normalizedMapsUrl;
  }

  // 3. Canonical business website (only when both have genuine websites)
  if (cFp.normalizedWebsite && eFp.normalizedWebsite) {
    if (cFp.normalizedWebsite === eFp.normalizedWebsite) {
      return true;
    }
  }

  // 4. Name + Address (fallback when URL / place ID could not be resolved)
  if (cFp.nameAddressKey && eFp.nameAddressKey) {
    if (cFp.nameAddressKey === eFp.nameAddressKey) {
      return true;
    }
  }

  // 5. Name + Phone (fallback when URL / place ID could not be resolved)
  if (cFp.namePhoneKey && eFp.namePhoneKey) {
    if (cFp.namePhoneKey === eFp.namePhoneKey) {
      return true;
    }
  }

  return false;
}
