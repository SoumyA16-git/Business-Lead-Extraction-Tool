import { describe, expect, it } from "vitest";
import { computeMissingFields } from "../../src/core/missing-data/compute-missing";
import { BusinessRecord } from "../../src/core/schema/business-record";

describe("Missing and Error Data System (PRD Section 12)", () => {
  it("flags absent optional fields in missing_fields", () => {
    const record: Partial<BusinessRecord> = {
      business_name: "Apex Hospital",
      primary_category: "Hospital",
      address: "Bhubaneswar",
      maps_url: "https://maps.google.com/place/123",
      source_platform: "google_maps",
      phone: "",
      website: "",
      price_level: null,
      rating: null,
      review_count: null,
      opening_hours: null,
      description: null,
      service_options: [],
      attributes: [],
      secondary_categories: [],
      error_fields: [],
    };

    const { missing_fields, error_fields } = computeMissingFields(record);
    expect(missing_fields).toContain("phone");
    expect(missing_fields).toContain("website");
    expect(missing_fields).toContain("price_level");
    expect(missing_fields).toContain("rating");
    expect(missing_fields).toContain("opening_hours");
    expect(error_fields).toEqual([]);
  });

  it("does not flag unconfirmed error fields as missing_fields", () => {
    const record: Partial<BusinessRecord> = {
      business_name: "Apex Hospital",
      primary_category: "Hospital",
      address: "Bhubaneswar",
      maps_url: "https://maps.google.com/place/123",
      source_platform: "google_maps",
      phone: "",
      error_fields: [],
    };

    const { missing_fields, error_fields } = computeMissingFields(record, ["phone"]);
    expect(error_fields).toContain("phone");
    expect(missing_fields).not.toContain("phone");
  });

  it("flags missing required fields as error_fields", () => {
    const record: Partial<BusinessRecord> = {
      business_name: "",
      primary_category: "Dentist",
      address: "Bhubaneswar",
      maps_url: "",
      source_platform: "google_maps",
    };

    const { error_fields } = computeMissingFields(record);
    expect(error_fields).toContain("business_name");
    expect(error_fields).toContain("maps_url");
  });
});
