/**
 * Website Classifier
 * Implements deterministic classification per PRD Section 11
 */

import { WebsiteStatus } from "../schema/business-record";
import { AGGREGATOR_DOMAINS, SOCIAL_DOMAINS } from "./social-domains";

export interface WebsiteClassificationResult {
  website: string;
  website_status: WebsiteStatus;
  social_links: string[];
  error_fields?: string[];
}

/**
 * Extracts and unwraps redirect URLs (such as google.com/url?q=...)
 */
export function unwrapUrl(rawUrl: string): string {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return "";
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("google.") && parsed.pathname.includes("/url")) {
      const q = parsed.searchParams.get("q") || parsed.searchParams.get("url");
      if (q) return q.trim();
    }
    return trimmed;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Checks if a hostname belongs to social domains or aggregators
 */
export function isSocialOrAggregatorHost(hostname: string): boolean {
  const cleanHost = hostname.replace(/^www\./, "").toLowerCase();
  const allDomains = [...SOCIAL_DOMAINS, ...AGGREGATOR_DOMAINS];
  return allDomains.some(
    (domain) => cleanHost === domain || cleanHost.endsWith("." + domain)
  );
}

/**
 * Classify website presence given raw website slot URL and additional social URLs
 */
export function classifyWebsite(
  rawWebsiteUrl?: string | null,
  additionalSocialUrls?: string[]
): WebsiteClassificationResult {
  const socialLinksSet = new Set<string>();
  const errorFields: string[] = [];

  // Add additional discovered social links first
  if (additionalSocialUrls && Array.isArray(additionalSocialUrls)) {
    for (const link of additionalSocialUrls) {
      const unwrapped = unwrapUrl(link);
      if (unwrapped) {
        socialLinksSet.add(unwrapped);
      }
    }
  }

  const unwrappedWebsite = rawWebsiteUrl ? unwrapUrl(rawWebsiteUrl) : "";

  if (!unwrappedWebsite) {
    if (socialLinksSet.size > 0) {
      return {
        website: "",
        website_status: "social_only",
        social_links: Array.from(socialLinksSet),
      };
    }
    return {
      website: "",
      website_status: "none",
      social_links: [],
    };
  }

  try {
    const parsed = new URL(unwrappedWebsite);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      // Invalid protocol
      errorFields.push("website_invalid_protocol");
      return {
        website: "",
        website_status: socialLinksSet.size > 0 ? "social_only" : "none",
        social_links: Array.from(socialLinksSet),
        error_fields: errorFields,
      };
    }

    if (isSocialOrAggregatorHost(parsed.hostname)) {
      socialLinksSet.add(unwrappedWebsite);
      return {
        website: "",
        website_status: "social_only",
        social_links: Array.from(socialLinksSet),
      };
    }

    // Valid real website
    return {
      website: unwrappedWebsite,
      website_status: "website",
      social_links: Array.from(socialLinksSet),
    };
  } catch {
    // Malformed URL
    errorFields.push("website_malformed_url");
    return {
      website: "",
      website_status: socialLinksSet.size > 0 ? "social_only" : "none",
      social_links: Array.from(socialLinksSet),
      error_fields: errorFields,
    };
  }
}
