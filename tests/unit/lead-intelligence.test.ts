import { describe, expect, it } from "vitest";
import {
  calculateDigitalMaturityScore,
  computeLeadIntelligence,
  computeLeadIntelligenceSummary,
} from "../../src/core/classification/lead-intelligence";
import { BusinessRecord } from "../../src/core/schema/business-record";

function createMockRecord(overrides: Partial<BusinessRecord> = {}): BusinessRecord {
  return {
    record_id: "test-rec-1",
    business_name: "Smile Dental Clinic",
    primary_category: "Dental clinic",
    secondary_categories: [],
    rating: 4.8,
    review_count: 120,
    price_level: "$$",
    address: "123 Main Road, City Center",
    phone: "+91 99999 88888",
    website: "https://smiledental.com",
    website_status: "website",
    social_links: ["https://instagram.com/smiledental"],
    maps_url: "https://maps.google.com/place/123",
    place_identifier: "0x123:0x456",
    plus_code: "7MJP+3C",
    latitude: 20.29,
    longitude: 85.82,
    opening_hours: [{ day: "Monday", hours: "9 AM - 8 PM" }],
    business_status: "operational",
    description: "Full service modern dental clinic with advanced care.",
    service_options: ["Appointment required"],
    attributes: ["Wheelchair accessible"],
    extraction_status: "complete",
    extraction_timestamp: new Date().toISOString(),
    missing_fields: [],
    error_fields: [],
    source_platform: "google_maps",
    duplicate_of: null,
    ...overrides,
  };
}

describe("Lead Intelligence Engine", () => {
  it("calculates digital maturity score accurately", () => {
    // Complete business listing -> near 100
    const complete = createMockRecord();
    const scoreComplete = calculateDigitalMaturityScore(complete);
    expect(scoreComplete).toBeGreaterThanOrEqual(90);

    // Business with no website, no hours, no desc -> low score
    const sparse = createMockRecord({
      website: "",
      website_status: "none",
      social_links: [],
      opening_hours: null,
      description: null,
      rating: null,
      review_count: 0,
      missing_fields: ["website", "hours", "description", "rating"],
    });
    const scoreSparse = calculateDigitalMaturityScore(sparse);
    expect(scoreSparse).toBeLessThan(40);
  });

  it("detects Web Development high opportunity (No Website + High Reviews)", () => {
    const lead = createMockRecord({
      website: "",
      website_status: "none",
      social_links: [],
      rating: 4.9,
      review_count: 140,
      missing_fields: ["website"],
    });

    const intel = computeLeadIntelligence(lead, "web_dev");
    expect(intel.activeNiche.opportunityLevel).toBe("high");
    expect(intel.activeNiche.matchedSignals).toContain("sig_no_website");
    expect(intel.activeNiche.matchedSignals).toContain("sig_opp_high_rev_no_site");
    expect(intel.activeNiche.reasons.length).toBeGreaterThan(0);
  });

  it("detects SEO high opportunity (Incomplete profile with missing hours & active reviews)", () => {
    const lead = createMockRecord({
      opening_hours: null,
      description: null,
      review_count: 35,
      missing_fields: ["hours", "description"],
    });

    const intel = computeLeadIntelligence(lead, "seo");
    expect(intel.activeNiche.opportunityLevel).toBe("high");
    expect(intel.activeNiche.matchedSignals).toContain("sig_profile_incomplete");
    expect(intel.activeNiche.matchedSignals).toContain("sig_opp_incomplete_active");
  });

  it("detects Reputation Management opportunity (Low rating with active reviews)", () => {
    const lead = createMockRecord({
      rating: 3.4,
      review_count: 45,
    });

    const intel = computeLeadIntelligence(lead, "reputation");
    expect(intel.activeNiche.opportunityLevel).toBe("high");
    expect(intel.activeNiche.matchedSignals).toContain("sig_rating_poor");
    expect(intel.activeNiche.matchedSignals).toContain("sig_opp_low_rate_high_rev");
  });

  it("detects Social Media Marketing opportunity (No social links with active business)", () => {
    const lead = createMockRecord({
      social_links: [],
      review_count: 50,
    });

    const intel = computeLeadIntelligence(lead, "social_media");
    expect(intel.activeNiche.opportunityLevel).toBe("high");
    expect(intel.activeNiche.matchedSignals).toContain("sig_no_social");
  });

  it("computes comprehensive summary counts across multiple records", () => {
    const records: BusinessRecord[] = [
      createMockRecord({
        record_id: "1",
        website: "",
        website_status: "none",
        rating: 4.8,
        review_count: 150,
      }),
      createMockRecord({
        record_id: "2",
        website: "",
        website_status: "social_only",
        social_links: ["https://fb.com/salon"],
        rating: 3.2,
        review_count: 25,
      }),
      createMockRecord({
        record_id: "3",
        phone: "",
        website: "https://example.com",
        website_status: "website",
        missing_fields: ["phone"],
      }),
    ];

    const summary = computeLeadIntelligenceSummary(records, "web_dev");
    expect(summary.totalRecords).toBe(3);
    expect(summary.noWebsiteCount).toBe(1);
    expect(summary.socialOnlyCount).toBe(1);
    expect(summary.websiteCount).toBe(1);
    expect(summary.phoneAvailableCount).toBe(2);
    expect(summary.phoneMissingCount).toBe(1);
    expect(summary.highOpportunityCount).toBeGreaterThanOrEqual(1);
  });
});
