import { describe, expect, it } from "vitest";
import { isDuplicate } from "../../src/core/dedup/identifier-chain";
import { mergeDuplicateRecord } from "../../src/core/dedup/merge";
import {
  normalizeAddress,
  normalizeName,
  normalizeUrl,
} from "../../src/core/dedup/normalize";
import { BusinessRecord } from "../../src/core/schema/business-record";

function createMockRecord(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    record_id: "test-rec-1",
    business_name: "Smile Dental Clinic",
    primary_category: "Dentist",
    secondary_categories: [],
    rating: 4.5,
    review_count: 50,
    price_level: null,
    address: "123 Main St, Suite 4",
    phone: "+91 9876543210",
    website: "https://smiledental.com",
    website_status: "website",
    social_links: [],
    maps_url: "https://maps.google.com/?cid=123",
    place_identifier: "0x3a19:0x7b2c",
    plus_code: null,
    latitude: 20.29,
    longitude: 85.82,
    opening_hours: null,
    business_status: "operational",
    description: null,
    service_options: [],
    attributes: [],
    extraction_status: "complete",
    extraction_timestamp: "2026-09-09T06:00:00.000Z",
    missing_fields: [],
    error_fields: [],
    source_platform: "google_maps",
    duplicate_of: null,
    ...overrides,
  };
}

describe("Deduplication Engine (PRD Section 13)", () => {
  it("normalizes names including Unicode characters and extra whitespace", () => {
    expect(normalizeName("  City Dental Care, Pvt. Ltd. ")).toBe(
      "city dental care pvt ltd"
    );
    expect(normalizeName("भुवनेश्वर क्लीनिक")).toBe("भुवनेश्वर क्लीनिक");
  });

  it("normalizes addresses expanding common abbreviations", () => {
    expect(normalizeAddress("14 Jaydev Vihar Rd., Apt 2B")).toBe(
      "14 jaydev vihar road apartment 2b"
    );
    expect(normalizeAddress("Plot 5, Forest Park St.")).toBe(
      "plot 5 forest park street"
    );
  });

  it("normalizes URLs stripping protocol, www, and query params", () => {
    expect(
      normalizeUrl("https://www.SmileDental.com/home/?utm_source=maps#section")
    ).toBe("smiledental.com/home");
  });

  it("matches duplicate via place_identifier (Tier 1)", () => {
    const orig = createMockRecord({ place_identifier: "0xABC:0x123" });
    const candidate = {
      business_name: "Totally Different Display Name",
      address: "Unknown",
      place_identifier: "0xABC:0x123",
    };
    expect(isDuplicate(candidate, orig)).toBe(true);
  });

  it("matches duplicate via canonical website (Tier 2)", () => {
    const orig = createMockRecord({
      place_identifier: null,
      website: "https://www.citysmile.in/",
      website_status: "website",
    });
    const candidate = {
      place_identifier: null,
      website: "http://citysmile.in",
      website_status: "website" as const,
    };
    expect(isDuplicate(candidate, orig)).toBe(true);
  });

  it("matches duplicate via normalized Name + Address (Tier 4)", () => {
    const orig = createMockRecord({
      place_identifier: null,
      website: "",
      business_name: "Apollo Pharmacy",
      address: "Plot 10, Station Rd.",
    });
    const candidate = {
      place_identifier: null,
      website: "",
      business_name: "Apollo Pharmacy!",
      address: "Plot 10, Station Road",
    };
    expect(isDuplicate(candidate, orig)).toBe(true);
  });

  it("matches duplicate via normalized Name + Phone (Tier 5)", () => {
    const orig = createMockRecord({
      place_identifier: null,
      website: "",
      business_name: "Dental Care Center",
      address: "Location A",
      phone: "+91 99999 88888",
    });
    const candidate = {
      place_identifier: null,
      website: "",
      business_name: "Dental Care Center",
      address: "Different Address Line 2",
      phone: "09999988888",
    };
    expect(isDuplicate(candidate, orig)).toBe(true);
  });

  it("does not match two distinct businesses", () => {
    const orig = createMockRecord({
      business_name: "City Dental Care",
      address: "10 Janpath Rd",
      place_identifier: "0x111:0x222",
    });
    const candidate = {
      business_name: "Apex Dental Care",
      address: "99 Saheed Nagar",
      place_identifier: "0x333:0x444",
    };
    expect(isDuplicate(candidate, orig)).toBe(false);
  });

  it("strictly distinguishes two listings with different place identifiers even if address matches", () => {
    const orig = createMockRecord({
      business_name: "Apex Dental Clinic",
      address: "Plot 10, Station Road, Unit 3",
      place_identifier: "0x3a19:0x1111",
      phone: "+91 99999 11111",
    });
    const candidate = {
      business_name: "Apex Dental Clinic",
      address: "Plot 10, Station Road, Unit 3",
      place_identifier: "0x3a19:0x2222",
      phone: "+91 99999 11111",
    };
    // Because place identifiers differ, judgment by URL/place ID guarantees they are distinct listings
    expect(isDuplicate(candidate, orig)).toBe(false);
  });

  it("does NOT treat distinct businesses sharing a Google Maps search URL as duplicates", () => {
    const orig = createMockRecord({
      business_name: "Maxdent Clinic",
      address: "Plot 12, Khandagiri",
      place_identifier: null,
      maps_url: "https://www.google.com/maps/search/Dentist+in+bhubaneshwar?authuser=0&hl=en",
      website: "",
      phone: "+91 99370 11111",
    });
    const candidate = {
      business_name: "Smile Ray Dental Care",
      address: "Plot 45, Patia",
      place_identifier: null,
      maps_url: "https://www.google.com/maps/search/Dentist+in+bhubaneshwar?authuser=0&hl=en",
      website: "",
      phone: "+91 99370 22222",
    };
    // Even though both have the identical search URL, they MUST NOT be marked as duplicate!
    expect(isDuplicate(candidate, orig)).toBe(false);
  });

  it("does NOT treat businesses with placeholder name 'Results' as duplicates", () => {
    const orig = createMockRecord({
      business_name: "Results",
      address: "Bhubaneswar, Odisha",
      place_identifier: null,
      phone: "+91 99999 00000",
    });
    const candidate = {
      business_name: "Results",
      address: "Bhubaneswar, Odisha",
      place_identifier: null,
      phone: "+91 99999 00000",
    };
    // Invalid/generic names must never form valid nameAddressKey or namePhoneKey
    expect(isDuplicate(candidate, orig)).toBe(false);
  });

  it("matches duplicate via canonical Maps place URL when place_identifier is missing", () => {
    const orig = createMockRecord({
      business_name: "Alpha Dental",
      place_identifier: null,
      maps_url: "https://www.google.com/maps/place/Alpha+Dental",
    });
    const candidate = {
      business_name: "Alpha Dental Clinic",
      place_identifier: null,
      maps_url: "https://www.google.com/maps/place/Alpha+Dental/?hl=en",
    };
    expect(isDuplicate(candidate, orig)).toBe(true);
  });

  it("applies fill-gaps merge policy without overwriting populated fields", () => {
    const original = createMockRecord({
      phone: "", // gap to fill
      rating: 4.8, // already populated
      opening_hours: null, // gap to fill
    });

    const duplicate: Partial<BusinessRecord> = {
      phone: "+91 9123456789",
      rating: 3.2, // lower rating should NOT overwrite
      opening_hours: [{ day: "Monday", hours: "9 AM - 5 PM" }],
    };

    const merged = mergeDuplicateRecord(original, duplicate);
    expect(merged.phone).toBe("+91 9123456789");
    expect(merged.rating).toBe(4.8); // Preserved original
    expect(merged.opening_hours).toEqual([{ day: "Monday", hours: "9 AM - 5 PM" }]);
  });
});
