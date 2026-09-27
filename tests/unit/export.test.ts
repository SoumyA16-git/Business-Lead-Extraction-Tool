import { describe, expect, it } from "vitest";
import { escapeCsvField, toCsv } from "../../src/core/export/csv";
import { toJson } from "../../src/core/export/json";
import { BusinessRecord } from "../../src/core/schema/business-record";
import { ExtractionSession } from "../../src/core/schema/session";
import { DEFAULT_EXTRACTION_SETTINGS } from "../../src/shared/settings";

function createMockRecord(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    record_id: "rec-uuid-1",
    business_name: "Dr. Smith, DDS",
    primary_category: "Dentist",
    secondary_categories: ["Orthodontist", "Cosmetic Dentist"],
    rating: 4.9,
    review_count: 120,
    price_level: "$$",
    address: '100 Main "North" Street, City',
    phone: "+1 555-0199",
    website: "https://drsmith.com",
    website_status: "website",
    social_links: ["https://instagram.com/drsmith"],
    maps_url: "https://maps.google.com/place/drsmith",
    place_identifier: "0x123:0x456",
    plus_code: "87C4+XX",
    latitude: 40.71,
    longitude: -74.0,
    opening_hours: [{ day: "Mon", hours: "9am - 5pm" }],
    business_status: "operational",
    description: "Quality dental care with a smile.",
    service_options: ["Wheelchair Accessible"],
    attributes: ["Free Wi-Fi"],
    extraction_status: "complete",
    extraction_timestamp: "2026-09-09T06:00:00.000Z",
    missing_fields: [],
    error_fields: [],
    source_platform: "google_maps",
    duplicate_of: null,
    ...overrides,
  };
}

describe("Export System (PRD Section 15)", () => {
  it("escapes CSV values with quotes, commas, and line breaks", () => {
    expect(escapeCsvField('Hello, "World"')).toBe('"Hello, ""World"""');
    expect(escapeCsvField("Normal Text")).toBe("Normal Text");
    expect(escapeCsvField("Line1\nLine2")).toBe('"Line1\nLine2"');
  });

  it("produces RFC 4180 compliant CSV with UTF-8 BOM and CRLF endings", () => {
    const records = [createMockRecord()];
    const csv = toCsv(records);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.includes("\r\n")).toBe(true);
    // Name with comma and quotes escaped properly
    expect(csv).toContain('"Dr. Smith, DDS"');
    expect(csv).toContain('"100 Main ""North"" Street, City"');
    // Secondary categories joined by semicolon-space
    expect(csv).toContain("Orthodontist; Cosmetic Dentist");
  });

  it("applies missingPlaceholder correctly in CSV", () => {
    const recordWithMissing = createMockRecord({
      phone: "",
      rating: null,
    });
    const csv = toCsv([recordWithMissing], { missingPlaceholder: "N/A" });
    expect(csv).toContain("N/A");
  });

  it("produces structured JSON export with metadata and businesses list", () => {
    const session: ExtractionSession = {
      sessionId: "session-1",
      platform: "google_maps",
      sourceUrl: "https://maps.google.com/search/dentists",
      searchContext: { query: "dentists", locationHint: null },
      status: "completed",
      pauseReason: null,
      createdAt: "2026-09-09T06:00:00.000Z",
      updatedAt: "2026-09-09T06:10:00.000Z",
      queue: [],
      processedCount: 1,
      successCount: 1,
      partialCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      websiteCount: 1,
      socialCount: 0,
      noWebsiteCount: 0,
      settingsSnapshot: DEFAULT_EXTRACTION_SETTINGS,
    };

    const records = [
      createMockRecord(),
      createMockRecord({ record_id: "rec-2", extraction_status: "duplicate" }),
    ];

    const jsonStr = toJson(session, records, { includeDuplicates: false });
    const parsed = JSON.parse(jsonStr);

    expect(parsed.export_metadata.source_platform).toBe("google_maps");
    expect(parsed.export_metadata.total_records).toBe(1);
    expect(parsed.export_metadata.duplicate_records_excluded).toBe(1);
    expect(parsed.businesses.length).toBe(1);
    expect(parsed.businesses[0].record_id).toBe("rec-uuid-1");
  });

  it("includes lead intelligence columns and structured JSON payload when requested", () => {
    const records = [
      createMockRecord({
        website: "",
        website_status: "none",
        review_count: 150,
        rating: 4.9,
      }),
    ];

    // CSV with lead intelligence
    const csv = toCsv(records, { nicheProfileId: "web_dev", includeLeadIntelligence: true });
    expect(csv).toContain("digital_maturity_score");
    expect(csv).toContain("opportunity_level");
    expect(csv).toContain("niche_profile");
    expect(csv).toContain("Web Development & Funnels");
    expect(csv).toContain("high");

    // JSON with lead intelligence
    const session: ExtractionSession = {
      sessionId: "session-1",
      platform: "google_maps",
      sourceUrl: "https://maps.google.com/search/dentists",
      searchContext: { query: "dentists", locationHint: null },
      status: "completed",
      pauseReason: null,
      createdAt: "2026-09-09T06:00:00.000Z",
      updatedAt: "2026-09-09T06:10:00.000Z",
      queue: [],
      processedCount: 1,
      successCount: 1,
      partialCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      websiteCount: 0,
      socialCount: 0,
      noWebsiteCount: 1,
      settingsSnapshot: DEFAULT_EXTRACTION_SETTINGS,
    };

    const jsonStr = toJson(session, records, { nicheProfileId: "web_dev", includeLeadIntelligence: true });
    const parsed = JSON.parse(jsonStr);

    expect(parsed.businesses[0].lead_intelligence).toBeDefined();
    expect(parsed.businesses[0].lead_intelligence.active_niche.profile_id).toBe("web_dev");
    expect(parsed.businesses[0].lead_intelligence.active_niche.opportunity_level).toBe("high");
    expect(parsed.businesses[0].lead_intelligence.signals.length).toBeGreaterThan(0);
  });
});
