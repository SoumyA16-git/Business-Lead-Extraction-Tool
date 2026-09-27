import { describe, expect, it } from "vitest";
import {
  classifyWebsite,
  isSocialOrAggregatorHost,
  unwrapUrl,
} from "../../src/core/classification/website-classifier";

describe("Website Classifier (PRD Section 11)", () => {
  it("unwraps Google redirect URLs", () => {
    const raw =
      "https://www.google.com/url?q=https://www.bhubaneswardental.com/home&sa=D&source=editors";
    expect(unwrapUrl(raw)).toBe("https://www.bhubaneswardental.com/home");
  });

  it("identifies social and aggregator domains accurately", () => {
    expect(isSocialOrAggregatorHost("instagram.com")).toBe(true);
    expect(isSocialOrAggregatorHost("www.facebook.com")).toBe(true);
    expect(isSocialOrAggregatorHost("wa.me")).toBe(true);
    expect(isSocialOrAggregatorHost("linktr.ee")).toBe(true);
    expect(isSocialOrAggregatorHost("sub.tiktok.com")).toBe(true);
    expect(isSocialOrAggregatorHost("exampledental.com")).toBe(false);
  });

  it("classifies genuine website as 'website'", () => {
    const res = classifyWebsite("https://smiledentalbbsr.com");
    expect(res.website_status).toBe("website");
    expect(res.website).toBe("https://smiledentalbbsr.com");
    expect(res.social_links).toEqual([]);
  });

  it("reclassifies website slot containing an Instagram URL as 'social_only'", () => {
    const res = classifyWebsite("https://instagram.com/smiledentalbbsr");
    expect(res.website_status).toBe("social_only");
    expect(res.website).toBe("");
    expect(res.social_links).toEqual(["https://instagram.com/smiledentalbbsr"]);
  });

  it("classifies linktree aggregator in website slot as 'social_only'", () => {
    const res = classifyWebsite("https://linktr.ee/dentistbbsr");
    expect(res.website_status).toBe("social_only");
    expect(res.website).toBe("");
    expect(res.social_links).toContain("https://linktr.ee/dentistbbsr");
  });

  it("classifies WhatsApp click-to-chat as 'social_only'", () => {
    const res = classifyWebsite("https://wa.me/919000000000");
    expect(res.website_status).toBe("social_only");
    expect(res.website).toBe("");
    expect(res.social_links).toContain("https://wa.me/919000000000");
  });

  it("classifies business with no website slot but separate social URLs as 'social_only'", () => {
    const res = classifyWebsite("", ["https://facebook.com/dentalcare"]);
    expect(res.website_status).toBe("social_only");
    expect(res.website).toBe("");
    expect(res.social_links).toEqual(["https://facebook.com/dentalcare"]);
  });

  it("classifies business with genuine website AND discovered social links as 'website'", () => {
    const res = classifyWebsite("https://dentalcare.com", [
      "https://facebook.com/dentalcare",
    ]);
    expect(res.website_status).toBe("website");
    expect(res.website).toBe("https://dentalcare.com");
    expect(res.social_links).toEqual(["https://facebook.com/dentalcare"]);
  });

  it("classifies business with no URLs as 'none'", () => {
    const res = classifyWebsite(null, []);
    expect(res.website_status).toBe("none");
    expect(res.website).toBe("");
    expect(res.social_links).toEqual([]);
  });
});
