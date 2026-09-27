import { describe, it, expect } from "vitest";
import {
  detectCountryContext,
  generateWhatsAppLink,
  normalizePhone,
} from "../../src/core/normalization/phone-normalizer";
import { toCsv } from "../../src/core/export/csv";
import { BusinessRecord } from "../../src/core/schema/business-record";

describe("Phone Normalization & WhatsApp Link Module", () => {
  describe("Country Detection", () => {
    it("detects country from explicit +91 international prefix", () => {
      const res = detectCountryContext("+91 9876543210");
      expect(res.country?.iso).toBe("IN");
      expect(res.country?.callingCode).toBe("+91");
      expect(res.source).toBe("phone_prefix");
    });

    it("detects country from explicit +44 international prefix", () => {
      const res = detectCountryContext("+44 20 7946 0958");
      expect(res.country?.iso).toBe("GB");
      expect(res.country?.callingCode).toBe("+44");
      expect(res.source).toBe("phone_prefix");
    });

    it("detects country from explicit +971 international prefix", () => {
      const res = detectCountryContext("+971 50 123 4567");
      expect(res.country?.iso).toBe("AE");
      expect(res.country?.callingCode).toBe("+971");
      expect(res.source).toBe("phone_prefix");
    });

    it("detects country from business address", () => {
      const res = detectCountryContext("020 7946 0958", {
        address: "10 Downing Street, London, United Kingdom",
      });
      expect(res.country?.iso).toBe("GB");
      expect(res.source).toBe("business_address");
    });

    it("detects country from search context query", () => {
      const res = detectCountryContext("050 123 4567", {
        searchContextQuery: "dental clinic in dubai",
      });
      expect(res.country?.iso).toBe("AE");
      expect(res.source).toBe("search_context");
    });
  });

  describe("Indian Phone Numbers Normalization", () => {
    it("normalizes national number with trunk 0 (09876543210)", () => {
      const res = normalizePhone("09876543210", {
        address: "Paharganj, New Delhi, Delhi 110055, India",
      });
      expect(res.phone_raw).toBe("09876543210");
      expect(res.phone_normalized).toBe("+919876543210");
      expect(res.whatsapp_link).toBe("https://wa.me/919876543210");
      expect(res.phone_country).toBe("IN");
      expect(res.phone_status).toBe("valid");
    });

    it("normalizes international number with spaces (+91 9876543210)", () => {
      const res = normalizePhone("+91 9876543210");
      expect(res.phone_normalized).toBe("+919876543210");
      expect(res.whatsapp_link).toBe("https://wa.me/919876543210");
    });

    it("normalizes number without plus sign (91 9876543210)", () => {
      const res = normalizePhone("91 9876543210");
      expect(res.phone_normalized).toBe("+919876543210");
      expect(res.whatsapp_link).toBe("https://wa.me/919876543210");
    });

    it("fixes the glitch where +91 was combined with trunk 0 (+91 09876543210)", () => {
      const res = normalizePhone("+91 09876543210");
      expect(res.phone_normalized).toBe("+919876543210");
      expect(res.whatsapp_link).toBe("https://wa.me/919876543210");
    });

    it("normalizes hyphenated number (+91-9876543210)", () => {
      const res = normalizePhone("+91-9876543210");
      expect(res.phone_normalized).toBe("+919876543210");
      expect(res.whatsapp_link).toBe("https://wa.me/919876543210");
    });

    it("normalizes 10-digit number with default Indian context (9876543210)", () => {
      const res = normalizePhone("9876543210", {
        defaultCountry: "IN",
      });
      expect(res.phone_normalized).toBe("+919876543210");
      expect(res.whatsapp_link).toBe("https://wa.me/919876543210");
    });
  });

  describe("International Phone Numbers Normalization", () => {
    it("normalizes UK number with trunk prefix (020 7946 0958)", () => {
      const res = normalizePhone("020 7946 0958", {
        address: "Westminster, London, UK",
      });
      expect(res.phone_normalized).toBe("+442079460958");
      expect(res.whatsapp_link).toBe("https://wa.me/442079460958");
      expect(res.phone_country).toBe("GB");
    });

    it("normalizes UK international number with redundant trunk (+44 020 7946 0958)", () => {
      const res = normalizePhone("+44 020 7946 0958");
      expect(res.phone_normalized).toBe("+442079460958");
      expect(res.whatsapp_link).toBe("https://wa.me/442079460958");
    });

    it("normalizes US number ((212) 555-0199)", () => {
      const res = normalizePhone("(212) 555-0199", {
        address: "New York, NY 10001, USA",
      });
      expect(res.phone_normalized).toBe("+12125550199");
      expect(res.whatsapp_link).toBe("https://wa.me/12125550199");
      expect(res.phone_country).toBe("US");
    });

    it("normalizes UAE number (050 123 4567)", () => {
      const res = normalizePhone("050 123 4567", {
        address: "Downtown Dubai, Dubai, UAE",
      });
      expect(res.phone_normalized).toBe("+971501234567");
      expect(res.whatsapp_link).toBe("https://wa.me/971501234567");
      expect(res.phone_country).toBe("AE");
    });
  });

  describe("Edge cases & Missing/Invalid values", () => {
    it("handles null or empty phone strings gracefully", () => {
      const res = normalizePhone(null);
      expect(res.phone_raw).toBe("");
      expect(res.phone_normalized).toBe("");
      expect(res.whatsapp_link).toBe("");
      expect(res.phone_status).toBe("unknown");
    });

    it("handles invalid short numbers without guessing", () => {
      const res = normalizePhone("12345");
      expect(res.phone_normalized).toBe("");
      expect(res.whatsapp_link).toBe("");
      expect(res.phone_status).toBe("invalid");
    });

    it("generates WhatsApp link only for valid E.164 formats", () => {
      expect(generateWhatsAppLink("+919876543210")).toBe("https://wa.me/919876543210");
      expect(generateWhatsAppLink("")).toBe("");
      expect(generateWhatsAppLink("09876543210")).toBe(""); // Must be E.164 with +
    });
  });

  describe("CSV Export Integration", () => {
    it("includes the new phone and WhatsApp columns in RFC 4180 CSV export", () => {
      const mockRecord: BusinessRecord = {
        record_id: "rec-1",
        business_name: "Noble Dental Care",
        primary_category: "Dentist",
        secondary_categories: [],
        rating: 4.8,
        review_count: 120,
        price_level: "$$",
        address: "Paharganj, New Delhi, India",
        phone: "+91 9876543210",
        phone_raw: "09876543210",
        phone_normalized: "+919876543210",
        phone_country: "IN",
        phone_country_calling_code: "+91",
        whatsapp_link: "https://wa.me/919876543210",
        website: "https://nobledental.com",
        website_status: "website",
        social_links: [],
        maps_url: "https://maps.google.com/?cid=123",
        place_identifier: "0x123",
        plus_code: null,
        latitude: 28.6,
        longitude: 77.2,
        opening_hours: null,
        business_status: "operational",
        description: null,
        service_options: [],
        attributes: [],
        extraction_status: "complete",
        extraction_timestamp: "2026-09-09T10:00:00.000Z",
        missing_fields: [],
        error_fields: [],
        source_platform: "google_maps",
        duplicate_of: null,
      };

      const csv = toCsv([mockRecord]);
      expect(csv).toContain("phone,phone_raw,phone_normalized,phone_country,phone_country_calling_code,whatsapp_link,website");
      expect(csv).toContain("09876543210");
      expect(csv).toContain("+919876543210");
      expect(csv).toContain("IN");
      expect(csv).toContain("+91");
      expect(csv).toContain("https://wa.me/919876543210");
    });
  });
});
