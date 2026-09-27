import { describe, it, expect } from "vitest";
import {
  resolveSpintax,
  interpolateVariables,
  composePersonalizedMessage,
  extractCityFromAddress,
  generateSpintaxPreviews,
} from "../../src/core/outreach/spintax";
import { BusinessRecord } from "../../src/core/schema/business-record";

describe("Spintax and Personalization Engine", () => {
  it("resolves basic single-level Spintax", () => {
    const template = "{Hello|Hi|Greetings} world!";
    const result = resolveSpintax(template);
    expect(["Hello world!", "Hi world!", "Greetings world!"]).toContain(result);
  });

  it("resolves nested Spintax structures", () => {
    const template = "{Hi|{Hey|Hello}} there!";
    const result = resolveSpintax(template);
    expect(["Hi there!", "Hey there!", "Hello there!"]).toContain(result);
  });

  it("handles text without Spintax groups safely", () => {
    const template = "Simple plain text without brackets.";
    expect(resolveSpintax(template)).toBe(template);
  });

  it("interpolates lead variables correctly", () => {
    const template = "Hi {business_name}, we help {category} in {city}. Rating: {rating} ({review_count}).";
    const lead: Partial<BusinessRecord> = {
      business_name: "Bright Smiles Clinic",
      primary_category: "Dentist",
      address: "100 Ocean Drive, Miami Beach, FL 33139",
      rating: 4.9,
      review_count: 88,
    };

    const populated = interpolateVariables(template, lead);
    expect(populated).toContain("Hi Bright Smiles Clinic");
    expect(populated).toContain("we help dentist in Miami Beach");
    expect(populated).toContain("Rating: 4.9 (88)");
  });

  it("extracts city gracefully from various address formats", () => {
    expect(extractCityFromAddress("123 Main St, Bhubaneswar, Odisha 751024")).toBe("Bhubaneswar");
    expect(extractCityFromAddress("742 Evergreen Terrace, Springfield, OR")).toBe("Springfield");
    expect(extractCityFromAddress("")).toBe("your area");
  });

  it("composes full personalized message with Spintax and variables", () => {
    const template = "{Hi|Hello} {business_name}, {noticed|saw} your {category} listing!";
    const lead: Partial<BusinessRecord> = {
      business_name: "Apex Auto Care",
      primary_category: "Auto Repair",
    };

    const message = composePersonalizedMessage(template, lead);
    expect(message).toMatch(/^(Hi|Hello) Apex Auto Care, (noticed|saw) your auto repair listing!$/);
  });

  it("generates requested number of previews", () => {
    const template = "{Hi|Hey} {business_name}";
    const previews = generateSpintaxPreviews(template, undefined, 3);
    expect(previews.length).toBe(3);
    for (const p of previews) {
      expect(p).toMatch(/^(Hi|Hey) Apex Dental Care$/);
    }
  });
});
